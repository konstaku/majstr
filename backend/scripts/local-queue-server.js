'use strict';

/**
 * Local LLM review server — runs on YOUR machine (where Ollama lives), not the
 * server. The bot only stores RAW forwarded text/screenshots in Mongo; this tool
 * is where the LLM actually runs:
 *
 *   1. You open http://127.0.0.1:4300 in your browser.
 *   2. It pulls RAW items from the DB. You click "Process" (one) or "Process all"
 *      — it runs your local Ollama on the TEXT and turns them into editable cards.
 *      Forwarded screenshots are shown on the card so you read/type the contact.
 *   3. Approve → publishes a live master.  Decline → removed from the queue.
 *
 * You can also paste a chat snippet directly — it's stored + processed on the spot.
 *
 * Usage (from backend/):
 *   ollama serve                                   # text model running
 *   node scripts/local-queue-server.js             # http://127.0.0.1:4300
 *   node scripts/local-queue-server.js --port 5300
 *
 * Env: OLLAMA_MODEL (text, default qwen2.5:14b). Needs backend/.env for Mongo + S3
 * (S3 only to display forwarded screenshots).
 */

require('dotenv').config();
const express = require('express');
const { runDB } = require('../database/db');

const Profession = require('../database/schema/Profession');
const ProfCategory = require('../database/schema/ProfCategory');
const Location = require('../database/schema/Location');
const Country = require('../database/schema/Country');

const {
  listCandidates,
  acceptCandidate,
  declineCandidate,
} = require('../routes/miningReview');
const {
  createProfession,
  createLocation,
  createProfCategory,
  rebuildLexicon,
} = require('../routes/referenceAdmin');
const { storeRawForward, processCandidate } = require('../mining/forwardIntake');
const miningDb = require('../database/miningDb');
const CHAT_REGION = require('../mining/chatRegions');

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const PORT = parseInt(arg('--port', process.env.REVIEW_PORT || '4300'), 10);
const HOST = '127.0.0.1'; // localhost only — never exposed
const ADMIN_TG = Number(process.env.TELEGRAM_ADMIN_CHAT_ID) || 0;

function stubAdmin(req, _res, next) {
  req.user = { telegramID: ADMIN_TG || undefined, isAdmin: true };
  next();
}

async function main() {
  await runDB();
  const app = express();
  app.use(express.json());
  app.use(stubAdmin);

  // Review queue + actions (reuse prod handlers verbatim).
  app.get('/api/mining/candidates', listCandidates);
  app.post('/api/mining/candidates/:id/accept', acceptCandidate);
  app.post('/api/mining/candidates/:id/decline', declineCandidate);

  // Reference data for the accept-form dropdowns.
  app.get('/api/reference/professions', async (_req, res) => res.json(await Profession.find()));
  app.get('/api/reference/prof-categories', async (_req, res) => res.json(await ProfCategory.find()));
  app.get('/api/reference/locations', async (_req, res) => res.json(await Location.find()));
  app.get('/api/reference/countries', async (_req, res) => res.json(await Country.find()));
  app.post('/api/reference/professions', createProfession);
  app.post('/api/reference/locations', createLocation);
  app.post('/api/reference/prof-categories', createProfCategory);
  app.post('/api/admin/lexicon/rebuild', rebuildLexicon);

  // Source dropdown: distinct origins in the reviewable queue (raw+new).
  // 'forwarded' = bot-sent leads; otherwise one entry per mined chat (by chatID).
  app.get('/api/local/sources', async (_req, res) => {
    try {
      const Candidate = miningDb.Candidate();
      const rows = await Candidate.aggregate([
        { $match: { status: { $in: ['raw', 'new'] } } },
        { $group: { _id: { sourceType: '$sourceType', chatID: '$chatID' }, count: { $sum: 1 } } },
      ]);
      let forwarded = 0;
      const chats = new Map(); // chatID -> count
      for (const r of rows) {
        if (r._id.sourceType === 'forwarded') forwarded += r.count;
        else chats.set(r._id.chatID, (chats.get(r._id.chatID) || 0) + r.count);
      }
      const sources = [];
      if (forwarded) sources.push({ key: 'forwarded', label: '📨 Forwarded (bot)', count: forwarded });
      for (const [chatID, count] of [...chats.entries()].sort((a, b) => b[1] - a[1])) {
        sources.push({ key: 'chat:' + chatID, label: CHAT_REGION[chatID] || ('chat ' + chatID), count });
      }
      res.json({ sources });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Run the local LLM on a raw candidate's text -> status 'new'.
  app.post('/api/local/process/:id', async (req, res) => {
    try {
      const r = await processCandidate(req.params.id);
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Paste -> store raw -> process immediately (you're at the machine with Ollama).
  app.post('/api/local/extract', async (req, res) => {
    const text = String((req.body && req.body.text) || '').trim();
    const chatTitle = (req.body && req.body.chatTitle) || null;
    if (!text) return res.status(400).json({ error: 'text required' });
    try {
      const { candidate, duplicate } = await storeRawForward({
        texts: [text],
        receivedMessageIDs: [],
        origin: { chatID: null, chatTitle, messageID: null },
        submitter: { telegramID: ADMIN_TG || null, name: 'local', isAdmin: true },
      });
      if (duplicate) return res.json({ ok: true, duplicate: true });
      const result = await processCandidate(String(candidate._id));
      res.json({
        ok: true,
        duplicate: false,
        duplicateMaster: result.duplicateMaster || null,
        summary: result.summary,
        candidateID: String(candidate._id),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/', (_req, res) => res.type('html').send(HTML));

  app.listen(PORT, HOST, () => {
    console.log(`\n  Local review queue → http://${HOST}:${PORT}\n`);
    console.log(`  Text model: ${process.env.OLLAMA_MODEL || 'qwen2.5:14b'}`);
    console.log(`  Screenshots are shown on each card for manual reading (no OCR).`);
    console.log(`  Mongo connected. Open the URL, then Process raw items.\n`);
  });
}

// ---------------------------------------------------------------------------
const HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Majstr · local review queue</title>
<style>
  :root { --bg:#0f1115; --card:#181b22; --line:#2a2f3a; --fg:#e7e9ee; --mut:#9aa3b2;
          --accent:#6ea8fe; --amber:#f0b34a; --red:#f0726a; --green:#5cc98a; }
  * { box-sizing:border-box; }
  body { margin:0; font:14px/1.45 system-ui,sans-serif; background:var(--bg); color:var(--fg); }
  header { position:sticky; top:0; background:var(--bg); border-bottom:1px solid var(--line); padding:12px 18px; z-index:5; }
  h1 { font-size:16px; margin:0 0 6px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:var(--mut); margin:18px 0 8px; }
  .row { display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
  .mut { color:var(--mut); } .small { font-size:12px; }
  .pill { background:var(--card); border:1px solid var(--line); border-radius:999px; padding:2px 9px; font-size:12px; }
  main { padding:18px; max-width:780px; margin:0 auto; }
  .paste { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px; margin-bottom:6px; }
  textarea, input, select { background:#11141a; color:var(--fg); border:1px solid var(--line); border-radius:7px; padding:7px 9px; font:inherit; width:100%; }
  input[type=checkbox] { width:auto; padding:0; margin:0; flex:none; }
  textarea { min-height:70px; resize:vertical; }
  label { display:block; font-size:12px; color:var(--mut); margin:8px 0 3px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px; margin-bottom:14px; }
  .card.raw { border-style:dashed; }
  .meta { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:8px; }
  .tag { background:#11141a; border:1px solid var(--line); border-radius:5px; padding:1px 7px; font-size:11px; color:var(--mut); }
  .msg { white-space:pre-wrap; background:#11141a; border:1px solid var(--line); border-radius:8px; padding:9px; font-size:13px; margin:8px 0; max-height:170px; overflow:auto; }
  .src { font-size:12px; color:var(--mut); }
  .dup { border:1px solid var(--amber); border-radius:8px; padding:8px 10px; margin:8px 0; font-size:12px; }
  .dup ul { margin:4px 0 6px; padding-left:18px; }
  .shots { display:flex; gap:8px; flex-wrap:wrap; margin:8px 0; }
  .shots a { display:block; }
  .shots img { height:120px; border:1px solid var(--line); border-radius:8px; object-fit:cover; }
  .ocr { font-size:11px; color:var(--mut); white-space:pre-wrap; background:#11141a; border:1px dashed var(--line); border-radius:6px; padding:6px; margin-top:4px; max-height:90px; overflow:auto; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .contact { display:grid; grid-template-columns:120px 1fr auto; gap:6px; margin-bottom:6px; }
  .btns { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; }
  button { background:#222734; color:var(--fg); border:1px solid var(--line); border-radius:8px; padding:8px 14px; cursor:pointer; font:inherit; }
  button:hover { border-color:#3a4150; } button:disabled { opacity:.5; cursor:default; }
  .primary { background:var(--accent); color:#06122b; border-color:var(--accent); font-weight:600; }
  .danger { color:var(--red); } .warn { color:var(--amber); font-size:12px; } .err { color:var(--red); font-size:12px; }
  .langbox { display:flex; gap:20px; flex-wrap:wrap; align-items:center; margin:4px 0 2px; }
  .langbox label { display:inline-flex; align-items:center; gap:7px; margin:0; color:var(--fg); font-size:18px; cursor:pointer; }
  .nav { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
  .empty { text-align:center; color:var(--mut); padding:24px 0; }
  .x { width:34px; text-align:center; }
  .row-pair { display:flex; gap:6px; align-items:center; }
  .row-pair select { flex:1; }
  .addbtn { white-space:nowrap; padding:7px 10px; }
  .backdrop { position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:flex-start; justify-content:center; padding:40px 16px; z-index:20; overflow:auto; }
  .modal { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; width:100%; max-width:440px; }
  .modal h3 { margin:0 0 10px; font-size:15px; }
  .modal .mlrow { display:grid; grid-template-columns:140px 1fr; gap:8px; align-items:center; margin-bottom:6px; }
  .modal .mlrow span { font-size:12px; color:var(--mut); }
  .modal .acts { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
</style>
</head>
<body>
<header>
  <h1>Majstr · local review queue <span class="mut small" id="conn"></span></h1>
  <div class="row">
    <span class="pill">raw <b id="qRaw">–</b></span>
    <span class="pill">ready <b id="qNew">–</b></span>
    <span class="pill">accepted <b id="cAcc">0</b></span>
    <span class="pill">declined <b id="cDec">0</b></span>
    <button id="procAll" class="small primary">Process all raw</button>
    <label class="small" style="margin:0"><input type="checkbox" id="auto" checked style="width:auto;display:inline"> auto-refresh</label>
    <button id="reload" class="small">Reload</button>
    <button id="rebuild" class="small" title="Rebuild the mining lexicon after adding professions">Rebuild lexicon</button>
  </div>
  <div class="row" style="margin-top:8px">
    <label class="small" style="margin:0">Source
      <select id="fSource" style="width:auto;display:inline-block;margin-left:4px;min-width:180px"></select>
    </label>
    <span class="mut small" id="procMsg"></span>
  </div>
</header>
<main>
  <div class="paste">
    <label>Paste a recommendation / chat snippet — stored + processed through Ollama right away</label>
    <textarea id="pText" placeholder="Q: хто може полагодити айфон, замінити екран?&#10;A: звернись до Георгія, +39 351 998 7766"></textarea>
    <div class="grid2" style="margin-top:8px">
      <input id="pChat" placeholder="Origin chat title (optional city hint, e.g. Українці в Мілано)" />
      <button id="pRun" class="primary">Extract → queue</button>
    </div>
    <div id="pMsg" class="small" style="margin-top:6px"></div>
  </div>

  <h2>Raw — process next</h2>
  <div id="rawArea"></div>

  <h2>Review <span id="pos" class="mut small"></span></h2>
  <div class="nav">
    <button id="prev">← Prev</button>
    <button id="next">Next →</button>
  </div>
  <div id="review"></div>
</main>
<div id="modalRoot"></div>

<script>
// Languages a master speaks (per-card checkboxes, flags). UA + RU default-checked.
const SPEAK_LANGS = [['ua','🇺🇦'],['ru','🇷🇺'],['en','🇬🇧'],['it','🇮🇹']];
const SPEAK_DEFAULT = ['ua','ru'];
// Fixed display preference for profession/city dropdown labels.
const NAME_PREF = ['ua','ru','en','it'];
let professions = [], locations = [], categories = [], countries = [];
let rawC = [], newC = [];
let idx = 0, currentId = null; // one-card-at-a-time review pointer
let counters = { acc:0, dec:0 };
let sourceFilter = localStorage.getItem('reviewSource') || 'forwarded'; // 'all' | 'forwarded' | 'chat:<id>'

function pickName(n){ if(!n) return ''; for(const l of NAME_PREF) if(n[l]&&String(n[l]).trim()) return n[l];
  for(const k in n) if(n[k]&&String(n[k]).trim()) return n[k]; return ''; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Turn the source filter into query params for /api/mining/candidates.
function sourceParams(){
  if(sourceFilter==='forwarded') return '&sourceType=forwarded';
  if(sourceFilter.startsWith('chat:')) return '&chatID='+encodeURIComponent(sourceFilter.slice(5));
  return '';
}
async function loadSources(){
  try{
    const { sources } = await fetch('/api/local/sources').then(r=>r.json());
    const sel=document.getElementById('fSource');
    const opts=[{key:'all',label:'All sources'},...(sources||[]).map(s=>({key:s.key,label:s.label+' ('+s.count+')'}))];
    if(!opts.find(o=>o.key===sourceFilter)) sourceFilter='all';
    sel.innerHTML=opts.map(o=>'<option value="'+esc(o.key)+'"'+(o.key===sourceFilter?' selected':'')+'>'+esc(o.label)+'</option>').join('');
  }catch(e){}
}
async function loadRefs(){
  [professions,locations,categories,countries]=await Promise.all([
    fetch('/api/reference/professions').then(r=>r.json()),
    fetch('/api/reference/locations').then(r=>r.json()),
    fetch('/api/reference/prof-categories').then(r=>r.json()),
    fetch('/api/reference/countries').then(r=>r.json()),
  ]);
}
async function loadQueue(){
  try{
    const sp=sourceParams();
    const [raw,nw]=await Promise.all([
      fetch('/api/mining/candidates?status=raw&sort=created&pageSize=50'+sp).then(r=>r.json()),
      fetch('/api/mining/candidates?status=new&sort=created&pageSize=100'+sp).then(r=>r.json()),
    ]);
    rawC=raw.candidates||[]; newC=nw.candidates||[];
    document.getElementById('qRaw').textContent=raw.total??rawC.length;
    document.getElementById('qNew').textContent=nw.total??newC.length;
    document.getElementById('conn').textContent='· connected';
    // Preserve the review position across refreshes: keep showing the same
    // candidate if it's still in the queue (so auto-refresh doesn't wipe edits).
    if(currentId){ const pos=newC.findIndex(c=>c.id===currentId); if(pos>=0) idx=pos; else currentId=null; }
    if(idx>=newC.length) idx=Math.max(0,newC.length-1);
    loadSources();
    renderRaw();
    renderCurrent(false);
  }catch(e){ document.getElementById('conn').textContent='· offline'; }
}

function shots(c){
  if(!c.images||!c.images.length) return '';
  return '<div class="shots">'+c.images.map(im=>'<a href="'+esc(im.url)+'" target="_blank"><img src="'+esc(im.url)+'"></a>').join('')+'</div>';
}
function provenance(c){
  return c.sourceType==='forwarded'
    ? '<div class="src">forwarded'+(c.submittedBy&&c.submittedBy.name?(' by '+esc(c.submittedBy.name)):'')+(c.originChatTitle?(' · chat: '+esc(c.originChatTitle)):'')+'</div>' : '';
}

// Raw area: show the NEXT raw item only (one at a time) with Process / Discard.
function renderRaw(){
  const area=document.getElementById('rawArea');
  document.getElementById('procAll').textContent='Process all raw'+(rawC.length?(' ('+rawC.length+')'):'');
  document.getElementById('procAll').style.display=rawC.length?'inline-block':'none';
  if(!rawC.length){ area.innerHTML='<div class="mut small">No raw items to process.</div>'; return; }
  const c=rawC[0];
  const el=document.createElement('div'); el.className='card raw';
  el.innerHTML='<div class="meta"><span class="tag">raw 1 / '+rawC.length+'</span><span class="tag">'+esc(c.sourceType)+'</span>'+
    (c.images&&c.images.length?'<span class="tag">'+c.images.length+' image(s)</span>':'')+'</div>'+
    provenance(c)+ shots(c)+
    (c.text?'<div class="msg">'+esc(c.text)+'</div>':'<div class="mut small">(no text — read the contact from the screenshot)</div>')+
    '<div class="btns"><button class="primary go">Process with Ollama</button>'+
    '<button class="danger del">Discard</button></div><div class="err pe"></div>';
  el.querySelector('.go').onclick=async(ev)=>{
    ev.target.disabled=true; ev.target.textContent='Running Ollama…';
    try{ const r=await fetch('/api/local/process/'+c.id,{method:'POST'});
      const b=await r.json(); if(!r.ok) throw new Error(b.error||'failed'); currentId=c.id; loadQueue(); }
    catch(e){ el.querySelector('.pe').textContent=e.message; ev.target.disabled=false; ev.target.textContent='Process with Ollama'; }
  };
  el.querySelector('.del').onclick=async()=>{
    if(!confirm('Discard this raw item?')) return;
    await fetch('/api/mining/candidates/'+c.id+'/decline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reasonCode:'other',note:'discarded raw'})});
    loadQueue();
  };
  area.innerHTML=''; area.appendChild(el);
}

// Review area: ONE processed card at a time. force=true always re-renders;
// force=false preserves the current card DOM (and your edits) if it's unchanged.
function renderCurrent(force){
  const area=document.getElementById('review');
  document.getElementById('pos').textContent = newC.length ? (idx+1)+' / '+newC.length : '';
  if(!newC.length){ area.innerHTML='<div class="empty">Nothing to review. Process raw items above, or change the source.</div>'; currentId=null; return; }
  if(idx>=newC.length) idx=newC.length-1;
  const c=newC[idx];
  if(!force && currentId===c.id && area.firstChild) return; // keep edits on refresh
  currentId=c.id;
  area.innerHTML=''; area.appendChild(card(c));
}

function catSelectOptions(s){ return '<option value="">— all categories —</option>'+categories.map(c=>'<option value="'+c.id+'"'+(c.id===s?' selected':'')+'>'+esc(pickName(c.name))+'</option>').join(''); }
// Profession options, optionally filtered to a category. Empty category = all.
function profOptions(catId,s){ const list=catId?professions.filter(p=>p.categoryID===catId):professions;
  return '<option value="">— profession —</option>'+list.map(p=>'<option value="'+p.id+'"'+(p.id===s?' selected':'')+'>'+esc(pickName(p.name))+'</option>').join(''); }
function locOptions(s){ return '<option value="">— city —</option>'+locations.map(l=>'<option value="'+l.id+'"'+(l.id===s?' selected':'')+'>'+esc(pickName(l.name))+'</option>').join(''); }
function catOfProfession(profId){ const p=professions.find(x=>x.id===profId); return p?p.categoryID:''; }

function card(c){
  const ex=c.extracted||{}; const el=document.createElement('div'); el.className='card';
  const dups=c.duplicateMasters||[];
  const suggestedCat=catOfProfession(c.suggestProfessionID); // pre-filter category from the suggested profession
  el.innerHTML=
    '<div class="meta"><span class="tag">'+esc(c.kind)+'</span><span class="tag">'+esc(c.sourceType)+'</span>'+
      '<span class="tag">score '+(c.score||0).toFixed(2)+'</span><span class="tag">'+esc(c.classifierName)+' '+esc(c.classifierVersion)+'</span></div>'+
    provenance(c)+ shots(c)+
    (c.inquiryText?'<div class="msg"><b>Q:</b> '+esc(c.inquiryText)+'</div>':'')+
    (c.text?'<div class="msg">'+esc(c.text)+'</div>':'')+
    (c.tgLink?'<div class="small"><a href="'+c.tgLink+'" target="_blank" style="color:var(--accent)">↗ original in Telegram</a></div>':'')+
    (dups.length?'<div class="dup"><b>⚠ Possible duplicate — live master already has this contact:</b><ul>'+
      dups.map(d=>'<li>'+esc(d.name||'(no name)')+' · '+esc(d.status)+'/'+esc(d.source)+' · '+esc((d.contacts||[]).map(x=>x.value).join(', '))+'</li>').join('')+'</ul></div>':'')+
    '<label>Name</label><input class="f-name" value="'+esc(ex.name||c.responderName||'')+'">'+
    '<label>Category</label><select class="f-cat">'+catSelectOptions(suggestedCat)+'</select>'+
    '<div class="grid2"><div><label>Profession</label><div class="row-pair"><select class="f-prof">'+profOptions(suggestedCat,c.suggestProfessionID)+'</select><button type="button" class="addbtn addProf">+ Add</button></div>'+
      (ex.profession?'<div class="mut small">read: "'+esc(ex.profession)+'"</div>':'')+'</div>'+
    '<div><label>City</label><div class="row-pair"><select class="f-loc">'+locOptions(c.suggestLocationID)+'</select><button type="button" class="addbtn addCity">+ Add</button></div>'+
      (ex.city?'<div class="mut small">read: "'+esc(ex.city)+'"</div>':'')+'</div></div>'+
    '<label>Contacts</label><div class="f-contacts"></div><button class="addc small" style="margin-top:4px">+ contact</button>'+
    '<label>Tags (UA, comma — from the announcement)</label><input class="f-tua" value="'+esc((ex.tags&&ex.tags.ua||[]).join(', '))+'">'+
    '<label>Languages spoken</label><div class="langbox">'+
      SPEAK_LANGS.map(([code,lab])=>'<label><input type="checkbox" class="f-lang" value="'+code+'"'+(SPEAK_DEFAULT.includes(code)?' checked':'')+'> '+lab+'</label>').join('')+'</div>'+
    '<label>Description</label><textarea class="f-about">'+esc(ex.description||'')+'</textarea>'+
    '<div class="msg-err err"></div>'+
    '<div class="btns"><button class="primary act-accept">Approve → publish</button>'+
      '<button class="act-reproc">Re-run LLM</button>'+
      '<button class="act-decline danger">Decline</button><button class="act-skip">Skip</button></div>';

  const cWrap=el.querySelector('.f-contacts');
  const contacts=(ex.contacts||[]).map(x=>({contactType:x.contactType||'phone',value:x.value||''}));
  function drawContacts(){ cWrap.innerHTML='';
    contacts.forEach((ct,i)=>{ const row=document.createElement('div'); row.className='contact';
      row.innerHTML='<select>'+['phone','telegram','instagram','whatsapp','viber','other'].map(t=>'<option'+(t===ct.contactType?' selected':'')+'>'+t+'</option>').join('')+'</select>'+
        '<input value="'+esc(ct.value)+'" placeholder="number / @handle / link"><button class="x">×</button>';
      row.children[0].onchange=e=>ct.contactType=e.target.value; row.children[1].oninput=e=>ct.value=e.target.value;
      row.children[2].onclick=()=>{contacts.splice(i,1);drawContacts();}; cWrap.appendChild(row); });
  }
  drawContacts();
  el.querySelector('.addc').onclick=()=>{contacts.push({contactType:'phone',value:''});drawContacts();};
  el.querySelector('.f-cat').onchange=(e)=>{ el.querySelector('.f-prof').innerHTML=profOptions(e.target.value,''); };
  el.querySelector('.addProf').onclick=()=>openAddProfession((p)=>{ professions.push(p);
    el.querySelector('.f-cat').innerHTML=catSelectOptions(p.categoryID);
    el.querySelector('.f-prof').innerHTML=profOptions(p.categoryID,p.id); });
  el.querySelector('.addCity').onclick=()=>openAddCity((l)=>{ locations.push(l); el.querySelector('.f-loc').innerHTML=locOptions(l.id); });

  function payload(){ const split=s=>s.split(',').map(t=>t.trim()).filter(Boolean);
    const tua=split(el.querySelector('.f-tua').value);
    const languages=[...el.querySelectorAll('.f-lang:checked')].map(x=>x.value);
    return { name:el.querySelector('.f-name').value.trim(), professionID:el.querySelector('.f-prof').value,
      locationID:el.querySelector('.f-loc').value, countryID:'IT', about:el.querySelector('.f-about').value.trim()||undefined,
      contacts:contacts.map(x=>({contactType:x.contactType,value:x.value.trim()})).filter(x=>x.value),
      ...(tua.length?{tags:{ua:tua,en:[]}}:{}),
      ...(languages.length?{languages}:{}) }; }
  const errEl=el.querySelector('.msg-err');
  async function accept(force){ const m=payload();
    if(!m.name||!m.professionID||!m.locationID||!m.contacts.length){ errEl.textContent='Need name + profession + city + ≥1 contact.'; return; }
    errEl.textContent='';
    const r=await fetch('/api/mining/candidates/'+c.id+'/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({master:m,force:!!force})});
    const b=await r.json().catch(()=>({}));
    if(r.ok){ counters.acc++; document.getElementById('cAcc').textContent=counters.acc; loadQueue(); return; }
    if(b.error==='duplicate_master'&&b.duplicates){ errEl.innerHTML='<span class="warn">Duplicate of: '+b.duplicates.map(d=>esc(d.name||d.id)).join(', ')+'</span> <button class="force">Publish anyway</button>';
      errEl.querySelector('.force').onclick=()=>accept(true); }
    else errEl.textContent=b.error||('HTTP '+r.status);
  }
  el.querySelector('.act-accept').onclick=()=>accept(false);
  el.querySelector('.act-reproc').onclick=async(ev)=>{ ev.target.disabled=true; ev.target.textContent='…';
    try{ const r=await fetch('/api/local/process/'+c.id,{method:'POST'}); const b=await r.json(); if(!r.ok)throw new Error(b.error); loadQueue(); }
    catch(e){ errEl.textContent=e.message; ev.target.disabled=false; ev.target.textContent='Re-run LLM'; } };
  el.querySelector('.act-skip').onclick=()=>{ if(idx<newC.length-1) idx++; renderCurrent(true); };
  el.querySelector('.act-decline').onclick=async()=>{ const reason=prompt('Decline reason: not_a_master / spam / duplicate / wrong_extraction / out_of_scope / other','out_of_scope'); if(!reason) return;
    const r=await fetch('/api/mining/candidates/'+c.id+'/decline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reasonCode:reason})});
    if(r.ok){ counters.dec++; document.getElementById('cDec').textContent=counters.dec; loadQueue(); } else { const b=await r.json().catch(()=>({})); errEl.textContent=b.error||'decline failed'; } };
  return el;
}

document.getElementById('procAll').onclick=async()=>{
  const msg=document.getElementById('procMsg'); const items=[...rawC];
  if(!items.length){ msg.textContent='Nothing raw to process.'; return; }
  document.getElementById('procAll').disabled=true;
  let done=0;
  for(const c of items){ msg.textContent='Processing '+(++done)+'/'+items.length+'…';
    try{ await fetch('/api/local/process/'+c.id,{method:'POST'}); }catch(e){}
  }
  msg.textContent='Processed '+done+'.'; document.getElementById('procAll').disabled=false; loadQueue();
};
document.getElementById('pRun').onclick=async()=>{
  const text=document.getElementById('pText').value.trim();
  const chatTitle=document.getElementById('pChat').value.trim()||null;
  const msg=document.getElementById('pMsg');
  if(!text){ msg.innerHTML='<span class="err">Paste some text first.</span>'; return; }
  msg.textContent='Running Ollama…';
  try{ const r=await fetch('/api/local/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,chatTitle})});
    const b=await r.json(); if(!r.ok){ msg.innerHTML='<span class="err">'+esc(b.error||'failed')+'</span>'; return; }
    if(b.duplicateMaster) msg.innerHTML='<span class="warn">Already listed: '+esc(b.duplicateMaster.name||'')+'.</span>';
    else if(b.duplicate) msg.innerHTML='<span class="warn">Already in queue.</span>';
    else { msg.innerHTML='<span style="color:var(--green)">Added: '+esc(b.summary||'')+'</span>'; document.getElementById('pText').value=''; }
    loadQueue();
  }catch(e){ msg.innerHTML='<span class="err">'+esc(e.message)+'</span>'; }
};
// ---- inline create: profession (w/ category) + city, stacked modals ----
function pushModal(title, inner){
  const root=document.getElementById('modalRoot');
  const wrap=document.createElement('div'); wrap.className='backdrop';
  wrap.innerHTML='<div class="modal"><h3>'+esc(title)+'</h3>'+inner+
    '<div class="err merr"></div><div class="acts"><button class="cancel">Cancel</button><button class="primary ok"></button></div></div>';
  wrap.onclick=(e)=>{ if(e.target===wrap) wrap.remove(); };
  wrap.querySelector('.cancel').onclick=()=>wrap.remove();
  root.appendChild(wrap);
  return wrap;
}
function nameRows(){
  return [['en','English (required)'],['ua','Українська'],['ru','Русский'],['it','Italiano']]
    .map(([c,l])=>'<div class="mlrow"><span>'+l+'</span><input class="m-'+c+'"'+(c==='en'?' autofocus':'')+'></div>').join('');
}
function readName(box){ const n={}; for(const c of ['en','ua','ru','it']){ const v=box.querySelector('.m-'+c).value.trim(); if(v) n[c]=v; } return n; }
async function postJSON(url,body){ const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const b=await r.json().catch(()=>({})); if(!r.ok) throw new Error(b.error||('HTTP '+r.status)); return b; }

function openAddCategory(cb){
  const wrap=pushModal('New category', nameRows());
  const box=wrap.querySelector('.modal'); box.querySelector('.ok').textContent='Create category';
  box.querySelector('.ok').onclick=async()=>{
    const name=readName(box); if(!name.en){ box.querySelector('.merr').textContent='English name required.'; return; }
    try{ const c=await postJSON('/api/reference/prof-categories',{name}); categories.push(c); wrap.remove(); cb&&cb(c); }
    catch(e){ box.querySelector('.merr').textContent=e.message; }
  };
}
function catOptions(selId){ return '<option value="">— select —</option>'+categories.map(c=>'<option value="'+c.id+'"'+(c.id===selId?' selected':'')+'>'+esc(pickName(c.name))+'</option>').join(''); }

function openAddProfession(cb){
  const inner=nameRows()+
    '<div class="mlrow"><span>Category</span><div class="row-pair"><select class="m-cat">'+catOptions('')+'</select><button class="addbtn addcat">+ Add</button></div></div>'+
    '<div class="mut small" style="margin-top:6px">At least one of UA / RU is required for the mining lexicon.</div>';
  const wrap=pushModal('New profession', inner);
  const box=wrap.querySelector('.modal'); box.querySelector('.ok').textContent='Create profession';
  box.querySelector('.addcat').onclick=()=>openAddCategory((c)=>{ box.querySelector('.m-cat').innerHTML=catOptions(c.id); });
  box.querySelector('.ok').onclick=async()=>{
    const name=readName(box); const categoryID=box.querySelector('.m-cat').value;
    if(!name.en){ box.querySelector('.merr').textContent='English name required.'; return; }
    if(!categoryID){ box.querySelector('.merr').textContent='Pick or add a category.'; return; }
    if(!name.ua&&!name.ru){ box.querySelector('.merr').textContent='Add UA or RU (for the lexicon).'; return; }
    try{ const p=await postJSON('/api/reference/professions',{categoryID,name}); wrap.remove(); cb&&cb(p); }
    catch(e){ box.querySelector('.merr').textContent=e.message; }
  };
}

function countryOptions(selId){ return '<option value="">— select —</option>'+countries.map(c=>'<option value="'+c.id+'"'+(c.id===selId?' selected':'')+'>'+(c.flag?c.flag+' ':'')+esc(pickName(c.name))+'</option>').join(''); }
function openAddCity(cb){
  const inner=nameRows()+'<div class="mlrow"><span>Country</span><select class="m-country">'+countryOptions('IT')+'</select></div>';
  const wrap=pushModal('New city', inner);
  const box=wrap.querySelector('.modal'); box.querySelector('.ok').textContent='Create city';
  box.querySelector('.ok').onclick=async()=>{
    const name=readName(box); const countryID=box.querySelector('.m-country').value;
    if(!name.en){ box.querySelector('.merr').textContent='English name required.'; return; }
    if(!countryID){ box.querySelector('.merr').textContent='Pick a country.'; return; }
    try{ const l=await postJSON('/api/reference/locations',{countryID,name}); wrap.remove(); cb&&cb(l); }
    catch(e){ box.querySelector('.merr').textContent=e.message; }
  };
}

document.getElementById('rebuild').onclick=async(ev)=>{
  ev.target.disabled=true; const t=ev.target.textContent; ev.target.textContent='Rebuilding…';
  try{ const r=await postJSON('/api/admin/lexicon/rebuild',{}); document.getElementById('procMsg').textContent='Lexicon rebuilt: '+r.professions+' professions → '+r.terms+' terms.'; }
  catch(e){ document.getElementById('procMsg').textContent='Rebuild failed: '+e.message; }
  finally{ ev.target.disabled=false; ev.target.textContent=t; }
};

document.getElementById('reload').onclick=loadQueue;
document.getElementById('prev').onclick=()=>{ if(idx>0){ idx--; renderCurrent(true); } };
document.getElementById('next').onclick=()=>{ if(idx<newC.length-1){ idx++; renderCurrent(true); } };
document.getElementById('fSource').onchange=(e)=>{ sourceFilter=e.target.value; localStorage.setItem('reviewSource',sourceFilter); currentId=null; idx=0; loadQueue(); };
loadSources().then(loadRefs).then(loadQueue);
setInterval(()=>{ if(document.getElementById('auto').checked) loadQueue(); }, 6000);
</script>
</body>
</html>`;

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
