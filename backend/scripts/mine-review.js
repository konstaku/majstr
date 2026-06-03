/**
 * Mining review tool — approve/decline candidates into production Masters.
 *
 * Reads Candidate docs from the isolated `majstr_mining` DB; reads reference
 * data and writes Masters to the PRODUCTION (default) DB. No Telegram bot, no
 * messages — Approve does a direct DB insert of a `scraped` / `pending` Master.
 *
 * One candidate per screen: message text + inquiry + a t.me deep link to the
 * original (to fetch a contact), and editable Name / Profession / City /
 * Contacts / Description pre-filled from Haiku's extraction. Approve requires a
 * complete card — name + profession + city + >=1 contact — and publishes it
 * live: the Master is created `approved` (the review IS the quality gate) with
 * a MasterAudit entry. Decline marks the candidate.
 *
 * Usage (from backend/):
 *   node scripts/mine-review.js [--port 4102] [--miningDb majstr_mining]
 * Do NOT set MONGO_DB_NAME — the default connection must point at prod.
 */
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const Master = require('../database/schema/Master');
const Profession = require('../database/schema/Profession');
const ProfCategory = require('../database/schema/ProfCategory');
const Location = require('../database/schema/Location');
const Country = require('../database/schema/Country');
const MasterAudit = require('../database/schema/MasterAudit');
const CandidateModel = require('../database/schema/Candidate');
// Reuse the same create logic the API uses, so the CLI and dashboard stay in
// sync on validation, slugging, duplicate-detection and the rebuild mutex.
const {
  createProfessionDoc,
  createProfCategoryDoc,
  createLocationDoc,
  runLexiconRebuild,
} = require('../routes/referenceAdmin');
const RawMessageModel = require('../database/schema/RawMessage');
const { applyDedup, buildMasterIndex } = require('../mining/dedup');
const {
  fetchAndUploadPhotoForMaster,
} = require('../helpers/telegramPhotoByHandle');
const { translateName, translateList } = require('../helpers/ollamaTranslate');
// Per-profession service-tag suggestions, shared with the TMA onboarding flow.
// Keyed professionID -> lang -> string[], with a `_default` fallback.
const tagSuggestions = require('../../frontend/src/data/tag-suggestions.i18n.json');

// Default city per source chat — pre-selected when a candidate has no extracted
// city. Resolved to a real locationID at startup (chat name -> Location match).
const CHAT_DEFAULT_CITY_NAME = { '1513619004': 'Roma', '1685394644': 'Florence' };

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i !== -1 ? process.argv[i + 1] : d;
};
const PORT = parseInt(arg('--port', '4102'), 10);
const MINING_DB = arg('--miningDb', 'majstr_mining');
// Optional: restrict the review queue to a single source chat (e.g. Roma).
// When unset, all chats are reviewed merged (original behavior).
const CHAT_ID = arg('--chatId', null);
// Optional: force the default-city pre-selection to a specific locationID,
// overriding the chat-name lookup. Useful when the chat name isn't a city.
const DEFAULT_CITY = arg('--defaultCity', null);
const candidateFilter = (extra = {}) =>
  CHAT_ID ? { chatID: CHAT_ID, ...extra } : { ...extra };

let RawMessage; // bound to the mining connection in main()

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

// Best-effort match of free-text extraction to a reference id.
function matchRef(text, refs, langs) {
  const t = norm(text);
  if (!t) return '';
  for (const r of refs) {
    for (const lang of langs) {
      const v = norm(r.name && r.name[lang]);
      if (v && (t.includes(v) || v.includes(t))) return r.id;
    }
  }
  return '';
}

let Candidate, professions, locations, categories, countries;

async function reloadRefs() {
  [professions, locations, categories, countries] = await Promise.all([
    Profession.find().lean(),
    Location.find().lean(),
    ProfCategory.find().lean(),
    Country.find().lean(),
  ]);
}

async function getData() {
  const [candidatesRaw, counts, liveMasters] = await Promise.all([
    Candidate.find(candidateFilter({ status: 'new' })).sort({ score: -1 }).lean(),
    Candidate.aggregate([
      ...(CHAT_ID ? [{ $match: { chatID: CHAT_ID } }] : []),
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    // Cross-DB collision check: production Masters this candidate may already
    // duplicate. Only `approved` (live) — declined / pending are not collisions.
    Master.find({ status: 'approved' })
      .select('_id name contacts professionID locationID')
      .lean(),
  ]);

  const masterIndex = buildMasterIndex(liveMasters);
  const { reps, suppressed } = applyDedup(candidatesRaw, masterIndex);

  const supByReason = {};
  for (const s of suppressed.values()) {
    supByReason[s.reason] = (supByReason[s.reason] || 0) + 1;
  }

  // #8 — surface the poster's Telegram display name. Join the anchor message
  // (chatID + messageID) of every visible rep; fromName fills the Name field.
  const fromNameByKey = new Map();
  const anchorKeys = reps.map((c) => ({ chatID: c.chatID, messageID: c.anchorMessageID }));
  if (anchorKeys.length) {
    const rawMsgs = await RawMessage.find({ $or: anchorKeys })
      .select('chatID messageID fromName')
      .lean();
    for (const m of rawMsgs) {
      fromNameByKey.set(m.chatID + ':' + m.messageID, m.fromName || '');
    }
  }

  // #7 — resolve each chat's default city name to a real locationID once.
  const defaultLocByChat = new Map();
  const resolveChatDefaultLoc = (chatID) => {
    if (defaultLocByChat.has(chatID)) return defaultLocByChat.get(chatID);
    let id = DEFAULT_CITY || '';
    if (!id) {
      const cityName = CHAT_DEFAULT_CITY_NAME[chatID];
      if (cityName) {
        id = matchRef(cityName, locations, ['en', 'it', 'ua', 'ua_alt', 'ru', 'ru_alt']);
      }
    }
    defaultLocByChat.set(chatID, id);
    return id;
  };

  return {
    stats: {
      ...counts.reduce((a, c) => ((a[c._id] = c.n), a), {}),
      visible: reps.length,
      hiddenTotal: suppressed.size,
      hiddenBy: supByReason, // { 'duplicate-of': N, 'existing-master': N, 'cross-border-transport': N }
    },
    professions: professions.map((p) => ({ id: p.id, categoryID: p.categoryID, name: p.name })),
    locations: locations.map((l) => ({ id: l.id, name: l.name })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    countries: countries.map((c) => ({ id: c.id, name: c.name, flag: c.flag })),
    tagSuggestions, // professionID -> lang -> string[] (with `_default`)
    candidates: reps.map((c) => ({
      id: String(c._id),
      chatID: c.chatID,
      kind: c.kind,
      score: c.score,
      sourceType: c.sourceType,
      anchorMessageID: c.anchorMessageID,
      inquiryText: c.inquiryText,
      text: c.text,
      responderName: c.responderName,
      fromName: fromNameByKey.get(c.chatID + ':' + c.anchorMessageID) || '',
      tgLink: `https://t.me/c/${c.chatID}/${c.anchorMessageID}`,
      extracted: c.extracted || {},
      suggestProfessionID: matchRef(c.extracted && c.extracted.profession, professions, [
        'ua', 'ru', 'it', 'en',
      ]),
      suggestLocationID: matchRef(c.extracted && c.extracted.city, locations, [
        'en', 'it', 'ua', 'ua_alt', 'ru', 'ru_alt',
      ]),
      chatDefaultLocationID: resolveChatDefaultLoc(c.chatID),
    })),
  };
}

function body(req) {
  return new Promise((res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try {
        res(JSON.parse(b || '{}'));
      } catch (_) {
        res({});
      }
    });
  });
}

const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Mining review</title><style>
*{box-sizing:border-box}body{margin:0;font:14px/1.55 system-ui,sans-serif;background:#0d1117;color:#e6edf3}
header{position:sticky;top:0;background:#0d1117;border-bottom:1px solid #30363d;padding:10px 18px;display:flex;gap:18px;align-items:center;font-size:13px;color:#8b949e;z-index:9}
header b{color:#e6edf3}.bar{flex:1;min-width:100px;height:7px;background:#21262d;border-radius:4px;overflow:hidden}.bar>i{display:block;height:100%;background:#2ea043}
main{max-width:820px;margin:0 auto;padding:20px}
.tag{display:inline-block;font-size:11px;padding:2px 9px;border-radius:99px;background:#1f6feb33;color:#79c0ff;margin-right:6px}
.src{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:14px 16px;margin-bottom:14px}
.q{border-left:3px solid #2f81f7;padding:6px 12px;margin-bottom:10px;font-size:13px;color:#adbac7;white-space:pre-wrap}
.q .l{font-size:11px;color:#8b949e;display:block}
.msg{white-space:pre-wrap;word-break:break-word;font-size:15px}
a.tg{display:inline-block;margin-top:10px;color:#79c0ff;font-size:13px}
.form label{display:block;font-size:12px;color:#8b949e;margin:12px 0 4px}
input,select,textarea{width:100%;background:#0d1117;border:1px solid #30363d;color:#e6edf3;border-radius:6px;padding:8px 10px;font:inherit}
textarea{min-height:54px;resize:vertical}
.crow{display:flex;gap:6px;margin-bottom:6px}.crow select{width:130px}.crow button{width:34px;flex:none}
.btnsm{background:#21262d;border:1px solid #30363d;color:#e6edf3;border-radius:6px;cursor:pointer;padding:6px}
.add{margin-top:4px;font-size:12px}
.actions{display:flex;gap:10px;margin-top:20px}
.actions button{flex:1;padding:11px;border-radius:8px;border:0;cursor:pointer;font-size:14px;font-weight:600}
.dec{background:#3a1f1f;color:#f85149}.skip{background:#21262d;color:#8b949e}.app{background:#238636;color:#fff}
.app:disabled{background:#21343a;color:#5b6b70;cursor:not-allowed}
.warn{color:#e3b341;font-size:12px;margin-top:8px}.done{text-align:center;padding:60px;font-size:20px}
.hint{font-size:11px;color:#8b949e;margin-top:2px}
.picker-row{display:flex;gap:6px}.picker-row select{flex:1}
#rebuildBtn{margin-left:auto}
#rebuild-msg{font-size:12px;color:#8b949e;padding:6px 18px;border-bottom:1px solid #30363d;background:#0d1117}
.hidden-bar{font-size:11px;color:#8b949e;padding:6px 18px;border-bottom:1px solid #30363d;background:#0d1117}
.hidden-bar:empty{display:none}
.hidden-bar b{color:#e6edf3}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:18px;z-index:50}
.modal{background:#161b22;border:1px solid #30363d;border-radius:10px;width:100%;max-width:480px;max-height:90vh;overflow:auto;padding:16px 18px;color:#e6edf3}
.modal h3{margin:0 0 12px;font-size:16px}
.modal label{display:block;font-size:12px;color:#8b949e;margin:10px 0 4px}
.modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
.modal-actions button{padding:8px 14px;border-radius:6px;cursor:pointer;border:0;font:inherit;font-weight:600}
.modal-err{color:#f85149;font-size:12px;margin-top:6px;min-height:1em}
.modal-hint{color:#8b949e;font-size:11px;margin:4px 0 0}
.btn-go{background:#238636;color:#fff}.btn-go:disabled{background:#21343a;color:#5b6b70;cursor:not-allowed}
.btn-cancel{background:#21262d;border:1px solid #30363d;color:#e6edf3}
.tagbox{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.chip{font-size:12px;padding:4px 10px;border-radius:99px;border:1px solid #30363d;background:#0d1117;color:#adbac7;cursor:pointer;user-select:none}
.chip.on{background:#1f6feb33;border-color:#388bfd;color:#79c0ff}
.chip.off{opacity:.4;cursor:not-allowed}
.chip .x{margin-left:6px;color:#8b949e}
.tagadd{display:flex;gap:6px;margin-top:6px}.tagadd input{flex:1}.tagadd button{width:auto;flex:none}
.btn-tr{background:#21262d;border:1px solid #30363d;color:#adbac7;border-radius:6px;cursor:pointer;padding:6px 10px;font:inherit;font-size:12px;margin-top:8px}
.btn-tr:disabled{opacity:.6;cursor:wait}
</style></head><body>
<header><div>#<b id="ix">–</b>/<b id="tot">–</b></div>
<div class="bar"><i id="pg" style="width:0"></i></div>
<div>approved <b id="cc">0</b> · declined <b id="cd">0</b> · left <b id="cl">0</b></div>
<button class="btnsm" id="rebuildBtn" onclick="rebuildLex()" title="Regenerate the profession lexicon after creating new professions">Rebuild lexicon</button></header>
<div id="hidden-bar" class="hidden-bar"></div>
<main id="main"></main>
<div id="modal-root"></div>
<script>
let D=null,Q=[],i=0,approved=0,declined=0;
const $=x=>document.getElementById(x);
const esc=s=>{const d=document.createElement('div');d.textContent=s==null?'':s;return d.innerHTML;};
function opts(list,sel,blank){let h='<option value="">'+(blank||'— select —')+'</option>';
 for(const o of list){const nm=o.name.en||o.name.ua||o.id;h+='<option value="'+o.id+'"'+(o.id===sel?' selected':'')+'>'+esc(nm)+'</option>';}return h;}
// #2 — professions filtered by category. Empty category => all professions.
function catOf(profId){const p=(D.professions||[]).find(x=>x.id===profId);return p?p.categoryID||'':'';}
function profOpts(catID,sel){
 const list=(D.professions||[]).filter(p=>!catID||p.categoryID===catID);
 return opts(list,sel,'— select profession —');}
function contactRow(c){
 const types=['phone','telegram','instagram','whatsapp','viber','other'];
 return '<div class="crow"><select class="ctype">'+types.map(t=>'<option'+(c&&c.contactType===t?' selected':'')+'>'+t+'</option>').join('')+
   '</select><input class="cval" placeholder="number / @handle / link" value="'+esc(c?c.value:'')+'">'+
   '<button class="btnsm" onclick="this.parentNode.remove();sync()">×</button></div>';
}
function render(){
 $('cc').textContent=approved;$('cd').textContent=declined;
 const total=Q.length;$('cl').textContent=total-i;
 if(i>=Q.length){$('main').innerHTML='<div class="done">All '+Q.length+' candidates reviewed.<br>'+
   approved+' published live on the site.</div>';$('pg').style.width='100%';return;}
 const c=Q[i];$('ix').textContent=i+1;$('tot').textContent=Q.length;$('pg').style.width=(100*i/Q.length)+'%';
 const e=c.extracted||{};
 let h='<div class="src"><span class="tag">'+c.kind+'</span><span class="tag">'+c.sourceType+'</span>'+
   '<span style="color:#8b949e;font-size:12px">score '+c.score.toFixed(2)+'</span>';
 if(c.inquiryText)h+='<div class="q" style="margin-top:10px"><span class="l">QUESTION ASKED'+
   (c.responderName?' · responder: '+esc(c.responderName):'')+'</span>'+esc(c.inquiryText)+'</div>';
 h+='<div class="msg">'+esc(c.text)+'</div>';
 h+='<a class="tg" href="'+c.tgLink+'" target="_blank">↗ open original message in Telegram (to fetch a contact)</a></div>';
 h+='<div class="form">';
 // #8 — default Name to the poster's Telegram display name.
 h+='<label>Name</label><input id="f_name" value="'+esc(e.name||c.fromName||c.responderName||'')+'">';
 if(c.fromName)h+='<div class="hint">Posted by: “'+esc(c.fromName)+'”</div>';
 // #2 — Category → Profession cascade.
 const suggCat=catOf(c.suggestProfessionID);
 h+='<label>Profession</label><div class="picker-row">'+
   '<select id="f_cat" onchange="onCatChange()">'+opts(D.categories,suggCat,'— category —')+'</select>'+
   '<select id="f_prof" onchange="onProfChange()">'+profOpts(suggCat,c.suggestProfessionID)+'</select>'+
   '<button type="button" class="btnsm" onclick="openCreateProf()">+ Add</button></div>';
 if(e.profession)h+='<div class="hint">Classifier read: “'+esc(e.profession)+'”</div>';
 // #7 — default City to the chat's city when none was extracted.
 const locSel=c.suggestLocationID||c.chatDefaultLocationID||'';
 h+='<label>City</label><div class="picker-row"><select id="f_loc">'+opts(D.locations,locSel)+'</select>'+
   '<button type="button" class="btnsm" onclick="openCreateLoc()">+ Add new</button></div>';
 if(e.city)h+='<div class="hint">Classifier read: “'+esc(e.city)+'”</div>';
 else if(!c.suggestLocationID&&c.chatDefaultLocationID)h+='<div class="hint">Defaulted to this chat\\'s city.</div>';
 h+='<label>Contacts</label><div id="contacts">'+
   ((e.contacts&&e.contacts.length?e.contacts:[]).map(contactRow).join('')||'')+'</div>';
 h+='<button class="btnsm add" onclick="addContact()">+ add contact</button>';
 // #3 — service tags (up to 3), pre-filled from the message.
 h+='<label>Tags (up to 3)</label><div id="tagbox" class="tagbox"></div>'+
   '<div class="tagadd"><input id="f_tagnew" placeholder="add a tag"><button type="button" class="btnsm" id="f_tagadd">+ add</button></div>';
 h+='<label>Description (optional)</label><textarea id="f_desc">'+esc(e.description||'')+'</textarea>';
 h+='<div class="warn" id="warn"></div>';
 h+='<div class="actions"><button class="dec" onclick="decline()">Decline</button>'+
   '<button class="skip" onclick="i++;render()">Skip</button>'+
   '<button class="app" id="appBtn" onclick="approve()">Approve → publish live</button></div></div>';
 $('main').innerHTML=h;
 ['f_name','f_prof','f_loc'].forEach(id=>$(id).addEventListener('input',sync));
 // tag input wiring (no inline handlers — avoids attribute-quoting issues)
 const tn=$('f_tagnew');
 tn.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();addTag(tn.value);tn.value='';}});
 $('f_tagadd').addEventListener('click',()=>{addTag(tn.value);tn.value='';tn.focus();});
 $('tagbox').addEventListener('click',ev=>{const chip=ev.target.closest('.chip');
  if(chip&&chip.dataset.tag)toggleTag(chip.dataset.tag);});
 curTags=prefillTags(c,$('f_prof').value);
 renderTags();
 sync();
}
// #3 — tag-picker state + helpers.
let curTags=[];
function profTagSuggestions(profId){
 const dict=(D&&D.tagSuggestions)||{};const byProf=dict[profId]||dict['_default']||{};
 return byProf.uk||byProf.en||[];
}
// Pre-check up to 3 suggested tags whose label appears in the message text.
function prefillTags(c,profId){
 const txt=((c.text||'')+' '+(c.inquiryText||'')).toLowerCase();
 const out=[];
 for(const t of profTagSuggestions(profId)){
  if(out.length>=3)break;
  if(txt.includes(String(t).toLowerCase()))out.push(t);
 }
 return out;
}
function addTag(t){t=String(t||'').trim();if(!t)return;
 if(curTags.length>=3){return;}
 if(!curTags.some(x=>x.toLowerCase()===t.toLowerCase()))curTags.push(t);
 renderTags();}
function removeTag(t){curTags=curTags.filter(x=>x!==t);renderTags();}
function toggleTag(t){if(curTags.some(x=>x.toLowerCase()===t.toLowerCase()))removeTag(t);else addTag(t);}
function renderTags(){
 const box=$('tagbox');if(!box)return;
 const profId=($('f_prof')&&$('f_prof').value)||'';
 const sugg=profTagSuggestions(profId);
 const seen=new Set();let h='';
 // selected first (always shown, removable), then remaining suggestions.
 // data-tag + delegated click (wired in render) — no inline handlers.
 for(const t of curTags){seen.add(t.toLowerCase());
  h+='<span class="chip on" data-tag="'+esc(t)+'">'+esc(t)+'<span class="x">×</span></span>';}
 const full=curTags.length>=3;
 for(const t of sugg){if(seen.has(String(t).toLowerCase()))continue;
  h+='<span class="chip'+(full?' off':'')+'" data-tag="'+esc(t)+'">'+esc(t)+'</span>';}
 box.innerHTML=h||'<span class="hint">No suggestions — type to add.</span>';
}
function onCatChange(){const cat=$('f_cat').value;$('f_prof').innerHTML=profOpts(cat,'');renderTags();sync();}
function onProfChange(){curTags=prefillTags(Q[i],$('f_prof').value);renderTags();sync();}
function addContact(){$('contacts').insertAdjacentHTML('beforeend',contactRow(null));
 $('contacts').lastChild.querySelector('.cval').addEventListener('input',sync);sync();}
function readContacts(){return [...document.querySelectorAll('#contacts .crow')]
 .map(r=>({contactType:r.querySelector('.ctype').value,value:r.querySelector('.cval').value.trim()}))
 .filter(c=>c.value);}
function sync(){
 const ok=$('f_name').value.trim()&&$('f_prof').value&&$('f_loc').value&&readContacts().length>0;
 $('appBtn').disabled=!ok;
 $('warn').textContent=ok?'':'Approve needs: name + profession + city + at least one contact.';
}
async function decline(){
 const c=Q[i];
 await fetch('/api/decline',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({id:c.id})});
 declined++;i++;render();
}
async function approve(){
 const c=Q[i];
 const master={name:$('f_name').value.trim(),professionID:$('f_prof').value,
  locationID:$('f_loc').value,contacts:readContacts(),about:$('f_desc').value.trim(),
  tags:curTags.slice(0,3)};
 const btn=$('appBtn');btn.disabled=true;btn.textContent='saving...';
 const r=await fetch('/api/approve',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({id:c.id,master})});
 if(r.ok){approved++;i++;render();}
 else{btn.textContent='FAILED — retry';btn.disabled=false;}
}

// ----- inline-create profession / category / city, + lexicon rebuild ------
function langInputs(prefix,values){
 // #6 — type the Ukrainian name, auto-fill the rest. UA is listed first.
 const rows=[['ua','Українська (type here)'],['en','English (required)'],['ru','Русский'],['it','Italiano']];
 let h='';
 for(const [k,lab] of rows){
  h+='<label>'+lab+'</label><input id="'+prefix+'_'+k+'" value="'+esc((values&&values[k])||'')+'">';
  if(k==='ua')h+='<button type="button" class="btn-tr" id="'+prefix+'_tr" onclick="autoTranslate(\\''+prefix+'\\')">↻ Auto-translate from Ukrainian</button>';
 }
 return h;
}
async function autoTranslate(prefix){
 const ua=(($(prefix+'_ua')||{}).value||'').trim();const btn=$(prefix+'_tr');
 if(!ua){if(btn)btn.textContent='Type the Ukrainian name first';return;}
 if(btn){btn.disabled=true;btn.textContent='Translating…';}
 try{
  const r=await fetch('/api/translate',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({text:ua,langs:['en','ru','it']})});
  const d=await r.json();
  for(const k of ['en','ru','it']){if(d[k]&&$(prefix+'_'+k))$(prefix+'_'+k).value=d[k];}
 }catch(e){}
 if(btn){btn.disabled=false;btn.textContent='↻ Auto-translate from Ukrainian';}
}
function readLangs(prefix){
 const out={};
 for (const k of ['en','ua','ru','it']){const el=$(prefix+'_'+k);const v=(el&&el.value||'').trim();if(v)out[k]=v;}
 return out;
}
function closeModal(){$('modal-root').innerHTML='';}
function modalShell(title,inner){
 return '<div class="modal-bg" onclick="closeModal()"><div class="modal" onclick="event.stopPropagation()">'+
   '<h3>'+esc(title)+'</h3>'+inner+'</div></div>';
}
function openCreateProf(){
 const cats=(D.categories||[]).map(c=>'<option value="'+c.id+'">'+esc(c.name.en||c.name.ua||c.id)+'</option>').join('');
 const inner=langInputs('np',{})+
   '<label>Category</label><div class="picker-row"><select id="np_cat"><option value="">— select —</option>'+cats+'</select>'+
   '<button type="button" class="btnsm" onclick="openCreateCat()">+ Add</button></div>'+
   '<p class="modal-hint">After saving a batch, click "Rebuild lexicon" so the mining heuristic recognises the new profession.</p>'+
   '<div id="np_err" class="modal-err"></div>'+
   '<div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>'+
   '<button type="button" class="btn-go" id="np_go" onclick="submitCreateProf()">Create profession</button></div>';
 $('modal-root').innerHTML=modalShell('New profession',inner);
 setTimeout(()=>$('np_ua').focus(),0);
}
async function submitCreateProf(){
 const name=readLangs('np');const categoryID=$('np_cat').value;const err=$('np_err');err.textContent='';
 if(!name.en){err.textContent='English name required';return;}
 if(!categoryID){err.textContent='Pick or add a category';return;}
 if(!name.ua&&!name.ru){err.textContent='At least one of UA/RU is required for the mining lexicon';return;}
 const btn=$('np_go');btn.disabled=true;btn.textContent='Saving…';
 const r=await fetch('/api/create-profession',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({categoryID,name})});
 const data=await r.json();btn.disabled=false;btn.textContent='Create profession';
 if(!r.ok){err.textContent='Failed: '+(data.error||r.status);return;}
 D.professions.push({id:data.id,categoryID,name:data.name});
 closeModal();
 // keep the cascade consistent: select the new prof's category, then the prof.
 if($('f_cat'))$('f_cat').value=categoryID;
 const sel=$('f_prof');if(sel){sel.innerHTML=profOpts(categoryID,data.id);sel.value=data.id;}
 renderTags();
 sync();
}
function openCreateCat(){
 const inner=langInputs('nc',{})+
   '<div id="nc_err" class="modal-err"></div>'+
   '<div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>'+
   '<button type="button" class="btn-go" id="nc_go" onclick="submitCreateCat()">Create category</button></div>';
 $('modal-root').innerHTML=modalShell('New category',inner);
 setTimeout(()=>$('nc_ua').focus(),0);
}
async function submitCreateCat(){
 const name=readLangs('nc');const err=$('nc_err');err.textContent='';
 if(!name.en){err.textContent='English name required';return;}
 const btn=$('nc_go');btn.disabled=true;btn.textContent='Saving…';
 const r=await fetch('/api/create-category',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name})});
 const data=await r.json();btn.disabled=false;btn.textContent='Create category';
 if(!r.ok){err.textContent='Failed: '+(data.error||r.status);return;}
 if(!D.categories)D.categories=[];
 D.categories.push({id:data.id,name:data.name});
 // re-open profession modal with the fresh category pre-selected
 openCreateProf();
 setTimeout(()=>{const s=$('np_cat');if(s)s.value=data.id;},0);
}
function openCreateLoc(){
 const cs=(D.countries||[]).map(c=>'<option value="'+c.id+'">'+(c.flag?c.flag+' ':'')+esc(c.name.en||c.name.ua||c.id)+'</option>').join('');
 const inner=langInputs('nl',{})+
   '<label>Country</label><select id="nl_country"><option value="">— select —</option>'+cs+'</select>'+
   '<div id="nl_err" class="modal-err"></div>'+
   '<div class="modal-actions"><button type="button" class="btn-cancel" onclick="closeModal()">Cancel</button>'+
   '<button type="button" class="btn-go" id="nl_go" onclick="submitCreateLoc()">Create city</button></div>';
 $('modal-root').innerHTML=modalShell('New city',inner);
 setTimeout(()=>{$('nl_country').value='IT';$('nl_ua').focus();},0);
}
async function submitCreateLoc(){
 const name=readLangs('nl');const countryID=$('nl_country').value;const err=$('nl_err');err.textContent='';
 if(!name.en){err.textContent='English name required';return;}
 if(!countryID){err.textContent='Pick a country';return;}
 const btn=$('nl_go');btn.disabled=true;btn.textContent='Saving…';
 const r=await fetch('/api/create-location',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({countryID,name})});
 const data=await r.json();btn.disabled=false;btn.textContent='Create city';
 if(!r.ok){err.textContent='Failed: '+(data.error||r.status);return;}
 D.locations.push({id:data.id,name:data.name});
 closeModal();
 const sel=$('f_loc');if(sel){sel.innerHTML=opts(D.locations,data.id);sel.value=data.id;}
 sync();
}
async function rebuildLex(){
 const btn=$('rebuildBtn');btn.disabled=true;const orig=btn.textContent;btn.textContent='Rebuilding…';
 let msgEl=$('rebuild-msg');
 if(!msgEl){msgEl=document.createElement('div');msgEl.id='rebuild-msg';document.body.insertBefore(msgEl,document.querySelector('main'));}
 msgEl.textContent='Rebuilding lexicon…';
 try{
  const r=await fetch('/api/rebuild-lexicon',{method:'POST'});
  const data=await r.json();
  if(r.ok)msgEl.textContent='✓ Lexicon rebuilt: '+data.professions+' professions → '+data.terms+' terms ('+data.ms+'ms)';
  else msgEl.textContent='✗ Rebuild failed: '+(data.error||'unknown');
 }catch(e){msgEl.textContent='✗ Rebuild failed: '+e.message;}
 btn.disabled=false;btn.textContent=orig;
}
document.addEventListener('keydown',e=>{
 if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
 if(e.key==='ArrowLeft')decline();
 if(e.key===' '){e.preventDefault();i++;render();}
});
function updateHiddenBar(){
 const s=(D&&D.stats)||{};const by=s.hiddenBy||{};const total=s.hiddenTotal||0;
 const bar=$('hidden-bar');if(!bar)return;
 if(!total){bar.innerHTML='';return;}
 const parts=[];
 if(by['duplicate-of'])parts.push(by['duplicate-of']+' duplicate'+(by['duplicate-of']>1?'s':''));
 if(by['existing-master'])parts.push(by['existing-master']+' already published');
 if(by['cross-border-transport'])parts.push(by['cross-border-transport']+' cross-border transport');
 bar.innerHTML='<b>'+total+'</b> candidate'+(total>1?'s':'')+' hidden by dedup/policy ('+parts.join(' · ')+'). Showing '+(s.visible||0)+' to review.';
}
fetch('/api/data').then(r=>r.json()).then(d=>{D=d;Q=d.candidates;updateHiddenBar();render();});
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(HTML);
    }
    if (req.url === '/api/data') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(await getData()));
    }
    // #6 — auto-translate a Ukrainian reference name into the other languages.
    if (req.url === '/api/translate' && req.method === 'POST') {
      const { text, langs } = await body(req);
      const out = await translateName(text, langs || ['en', 'ru', 'it']);
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(out));
    }
    // --- inline create reference data ----------------------------------
    if (req.url === '/api/create-category' && req.method === 'POST') {
      try {
        const created = await createProfCategoryDoc(await body(req));
        await reloadRefs();
        res.writeHead(201, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(created));
      } catch (e) {
        const code = e.code === 'duplicate' ? 409 : 400;
        res.writeHead(code, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message, existing: e.existing }));
      }
    }
    if (req.url === '/api/create-profession' && req.method === 'POST') {
      try {
        const created = await createProfessionDoc(await body(req));
        await reloadRefs();
        res.writeHead(201, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(created));
      } catch (e) {
        const code = e.code === 'duplicate' ? 409 : 400;
        res.writeHead(code, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message, existing: e.existing }));
      }
    }
    if (req.url === '/api/create-location' && req.method === 'POST') {
      try {
        const created = await createLocationDoc(await body(req));
        await reloadRefs();
        res.writeHead(201, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(created));
      } catch (e) {
        const code = e.code === 'duplicate' ? 409 : 400;
        res.writeHead(code, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message, existing: e.existing }));
      }
    }
    if (req.url === '/api/rebuild-lexicon' && req.method === 'POST') {
      try {
        const r = await runLexiconRebuild();
        console.log(
          `[mine-review] lexicon rebuilt: ${r.professions} professions, ${r.terms} terms in ${r.ms}ms`
        );
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, ...r }));
      } catch (e) {
        const code = e.code === 'in_progress' ? 409 : 500;
        res.writeHead(code, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    }
    if (req.url === '/api/decline' && req.method === 'POST') {
      const { id } = await body(req);
      await Candidate.updateOne({ _id: id }, { $set: { status: 'declined' } });
      res.writeHead(200);
      return res.end('{"ok":true}');
    }
    if (req.url === '/api/approve' && req.method === 'POST') {
      const { id, master } = await body(req);
      const cand = await Candidate.findById(id).lean();
      if (!cand) {
        res.writeHead(404);
        return res.end('{"ok":false}');
      }
      const now = new Date();
      // #3 — picked service tags (Ukrainian). English is filled best-effort in
      // the background below so approve stays snappy.
      const uaTags = Array.isArray(master.tags)
        ? master.tags.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 3)
        : [];
      // The review IS the quality gate — publish live (status: 'approved').
      const created = await Master.create({
        name: master.name,
        professionID: master.professionID,
        locationID: master.locationID,
        countryID: 'IT',
        contacts: master.contacts,
        about: master.about || '',
        tags: { ua: uaTags, en: [] },
        source: 'scraped',
        status: 'approved',
        claimable: true,
        submittedAt: now,
        approvedAt: now,
        sourceMetadata: {
          chatID: cand.chatID,
          anchorMessageID: cand.anchorMessageID,
          candidateRef: String(cand._id),
          classifierName: cand.classifierName,
          classifierVersion: cand.classifierVersion,
          scrapedAt: now,
        },
      });
      await MasterAudit.create({
        masterID: created._id,
        actorTelegramID: process.env.TELEGRAM_ADMIN_CHAT_ID
          ? Number(process.env.TELEGRAM_ADMIN_CHAT_ID)
          : undefined,
        action: 'approve',
        from: null,
        to: 'approved',
        reason: 'mining-review',
      });
      await Candidate.updateOne(
        { _id: id },
        { $set: { status: 'carded', masterRef: created._id } }
      );
      // #117 — kick off the Telegram-photo fetch in the background; the admin
      // doesn't wait. Photo is written via a follow-up Master.updateOne.
      fetchAndUploadPhotoForMaster(created)
        .then((url) => {
          if (url) return Master.updateOne({ _id: created._id }, { $set: { photo: url } });
        })
        .catch((e) => console.error('[scraped-photo] post-approve', e.message));
      // #3 — best-effort English tags in the background (Ollama). Empty on fail.
      if (uaTags.length) {
        translateList(uaTags, 'en')
          .then((enTags) => {
            if (enTags.length)
              return Master.updateOne(
                { _id: created._id },
                { $set: { 'tags.en': enTags } }
              );
          })
          .catch((e) => console.error('[tag-translate] post-approve', e.message));
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, masterId: String(created._id) }));
    }
    res.writeHead(404);
    res.end();
  } catch (e) {
    console.error('request error:', e.message);
    res.writeHead(500);
    res.end('{"ok":false}');
  }
});

async function main() {
  await runDB(); // default connection -> production DB
  const miningConn = mongoose.connection.useDb(MINING_DB);
  Candidate = miningConn.model('Candidate', CandidateModel.schema);
  RawMessage = miningConn.model('RawMessage', RawMessageModel.schema);
  await reloadRefs();
  if (!professions.length || !locations.length) {
    throw new Error('No reference data in the default DB — wrong DB target?');
  }
  const pending = await Candidate.countDocuments(candidateFilter({ status: 'new' }));
  server.listen(PORT, () => {
    console.log(`Review UI: http://localhost:${PORT}`);
    console.log(
      `${pending} candidates to review · candidates DB: ${MINING_DB} · ` +
        (CHAT_ID ? `chat filter: ${CHAT_ID} · ` : '') +
        `Masters write to: production (default DB)`
    );
  });
}

main().catch((e) => {
  console.error('mine-review failed:', e.message);
  process.exit(1);
});
