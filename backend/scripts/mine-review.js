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
const Location = require('../database/schema/Location');
const MasterAudit = require('../database/schema/MasterAudit');
const CandidateModel = require('../database/schema/Candidate');

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i !== -1 ? process.argv[i + 1] : d;
};
const PORT = parseInt(arg('--port', '4102'), 10);
const MINING_DB = arg('--miningDb', 'majstr_mining');

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

let Candidate, professions, locations;

async function getData() {
  const candidates = await Candidate.find({ status: 'new' })
    .sort({ score: -1 })
    .lean();
  const counts = await Candidate.aggregate([
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  return {
    stats: counts.reduce((a, c) => ((a[c._id] = c.n), a), {}),
    professions: professions.map((p) => ({ id: p.id, name: p.name })),
    locations: locations.map((l) => ({ id: l.id, name: l.name })),
    candidates: candidates.map((c) => ({
      id: String(c._id),
      chatID: c.chatID,
      kind: c.kind,
      score: c.score,
      sourceType: c.sourceType,
      anchorMessageID: c.anchorMessageID,
      inquiryText: c.inquiryText,
      text: c.text,
      responderName: c.responderName,
      tgLink: `https://t.me/c/${c.chatID}/${c.anchorMessageID}`,
      extracted: c.extracted || {},
      suggestProfessionID: matchRef(c.extracted && c.extracted.profession, professions, [
        'ua', 'ru', 'it', 'en',
      ]),
      suggestLocationID: matchRef(c.extracted && c.extracted.city, locations, [
        'en', 'it', 'ua', 'ua_alt', 'ru', 'ru_alt',
      ]),
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
</style></head><body>
<header><div>#<b id="ix">–</b>/<b id="tot">–</b></div>
<div class="bar"><i id="pg" style="width:0"></i></div>
<div>approved <b id="cc">0</b> · declined <b id="cd">0</b> · left <b id="cl">0</b></div></header>
<main id="main"></main>
<script>
let D=null,Q=[],i=0,approved=0,declined=0;
const $=x=>document.getElementById(x);
const esc=s=>{const d=document.createElement('div');d.textContent=s==null?'':s;return d.innerHTML;};
function opts(list,sel,blank){let h='<option value="">'+(blank||'— select —')+'</option>';
 for(const o of list){const nm=o.name.en||o.name.ua||o.id;h+='<option value="'+o.id+'"'+(o.id===sel?' selected':'')+'>'+esc(nm)+'</option>';}return h;}
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
 h+='<label>Name</label><input id="f_name" value="'+esc(e.name||c.responderName||'')+'">';
 h+='<label>Profession</label><select id="f_prof">'+opts(D.professions,c.suggestProfessionID)+'</select>';
 if(e.profession)h+='<div class="hint">Haiku read: “'+esc(e.profession)+'”</div>';
 h+='<label>City</label><select id="f_loc">'+opts(D.locations,c.suggestLocationID)+'</select>';
 if(e.city)h+='<div class="hint">Haiku read: “'+esc(e.city)+'”</div>';
 h+='<label>Contacts</label><div id="contacts">'+
   ((e.contacts&&e.contacts.length?e.contacts:[]).map(contactRow).join('')||'')+'</div>';
 h+='<button class="btnsm add" onclick="addContact()">+ add contact</button>';
 h+='<label>Description (optional)</label><textarea id="f_desc">'+esc(e.description||'')+'</textarea>';
 h+='<div class="warn" id="warn"></div>';
 h+='<div class="actions"><button class="dec" onclick="decline()">Decline</button>'+
   '<button class="skip" onclick="i++;render()">Skip</button>'+
   '<button class="app" id="appBtn" onclick="approve()">Approve → publish live</button></div></div>';
 $('main').innerHTML=h;
 ['f_name','f_prof','f_loc'].forEach(id=>$(id).addEventListener('input',sync));
 sync();
}
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
  locationID:$('f_loc').value,contacts:readContacts(),about:$('f_desc').value.trim()};
 const btn=$('appBtn');btn.disabled=true;btn.textContent='saving...';
 const r=await fetch('/api/approve',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({id:c.id,master})});
 if(r.ok){approved++;i++;render();}
 else{btn.textContent='FAILED — retry';btn.disabled=false;}
}
document.addEventListener('keydown',e=>{
 if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
 if(e.key==='ArrowLeft')decline();
 if(e.key===' '){e.preventDefault();i++;render();}
});
fetch('/api/data').then(r=>r.json()).then(d=>{D=d;Q=d.candidates;render();});
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
      // The review IS the quality gate — publish live (status: 'approved').
      const created = await Master.create({
        name: master.name,
        professionID: master.professionID,
        locationID: master.locationID,
        countryID: 'IT',
        contacts: master.contacts,
        about: master.about || '',
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
  professions = await Profession.find().lean();
  locations = await Location.find().lean();
  if (!professions.length || !locations.length) {
    throw new Error('No reference data in the default DB — wrong DB target?');
  }
  const pending = await Candidate.countDocuments({ status: 'new' });
  server.listen(PORT, () => {
    console.log(`Review UI: http://localhost:${PORT}`);
    console.log(
      `${pending} candidates to review · candidates DB: ${MINING_DB} · ` +
        `Masters write to: production (default DB)`
    );
  });
}

main().catch((e) => {
  console.error('mine-review failed:', e.message);
  process.exit(1);
});
