/**
 * Inspect Haiku predictions against the human-labeled fixtures.
 *
 * Runs Haiku across all three labeled fixtures (Veneto / Milano / Recall),
 * caches predictions to disk (so re-opening the viewer is free), and serves a
 * filterable HTML viewer at http://localhost:<port>.
 *
 * Usage (from backend/):
 *   node scripts/mine-haiku-inspect.js              # first run = ~$0.46
 *   node scripts/mine-haiku-inspect.js --force      # re-run predictions
 *   node scripts/mine-haiku-inspect.js --port 4101  # custom port
 *
 * Predictions cache: ../chat-history/haiku-predictions.json (gitignored).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const haiku = require('../mining/classifier/adapters/haiku');

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i !== -1 ? process.argv[i + 1] : d;
};
const PORT = parseInt(arg('--port', '4101'), 10);
const FORCE = process.argv.includes('--force');
const CACHE = path.resolve('../chat-history/haiku-predictions.json');

const FIXTURES = [
  { name: 'Veneto', file: '../chat-history/italy/veneto/label-sample.json' },
  { name: 'Milano', file: '../chat-history/italy/lombardia/milano/label-sample.json' },
  { name: 'Recall', file: '../chat-history/recall/label-sample.json' },
];

const unitLabel = (u) => (u.type === 'answer' || u.type === 'random' ? u.useful : u.label);
function unitInput(u) {
  if (u.type === 'answer')
    return {
      inquiry: u.inquiryText,
      responderName: u.responderName || null,
      text: (u.messages || []).map((m) => m.text).join('\n'),
    };
  if (u.type === 'announcement') return { text: u.text };
  if (u.type === 'random') {
    const inq = u.context && u.context.parent ? u.context.parent.text : null;
    return inq ? { inquiry: inq, text: u.text } : { text: u.text };
  }
}

async function predictAll() {
  haiku.resetCost();
  const all = [];
  for (const fx of FIXTURES) {
    const fp = path.resolve(fx.file);
    if (!fs.existsSync(fp)) {
      console.log(`[${fx.name}] missing — skipping`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const units = (data.units || []).filter((u) => {
      const v = unitLabel(u);
      return v === 0 || v === 1;
    });
    console.log(`[${fx.name}] ${units.length} labeled`);
    let ok = 0,
      failed = 0;
    for (const u of units) {
      const y = unitLabel(u);
      const inp = unitInput(u);
      let r = null;
      for (let attempt = 0; attempt < 3 && !r; attempt++) {
        try {
          r = await haiku.classify(inp);
        } catch (e) {
          if (attempt === 2) failed++;
          else await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
        }
      }
      if (!r) continue;
      ok++;
      all.push({
        fixture: fx.name,
        uid: u.uid,
        type: u.type,
        label: y,
        pred_kind: r.kind,
        pred_score: r.score,
        extracted: r.extracted,
        text: inp.text,
        inquiry: inp.inquiry || null,
        responderName: inp.responderName || null,
      });
      if (ok % 25 === 0) {
        process.stdout.write(`\r  ${ok}/${units.length} cost: $${haiku.getCumulativeCost().toFixed(3)}`);
      }
      await new Promise((res) => setTimeout(res, 50));
    }
    process.stdout.write('\n');
    console.log(`[${fx.name}] ok=${ok} failed=${failed}`);
  }
  fs.writeFileSync(CACHE, JSON.stringify(all, null, 2));
  console.log(`wrote ${all.length} predictions -> ${CACHE}`);
  console.log(`total: $${haiku.getCumulativeCost().toFixed(3)}`);
  return all;
}

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<title>Haiku predictions</title><style>
*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,sans-serif;background:#0d1117;color:#e6edf3}
header{position:sticky;top:0;background:#0d1117;border-bottom:1px solid #30363d;padding:12px 18px;z-index:9}
header h1{margin:0 0 8px;font-size:15px;font-weight:600}
.pills{display:flex;gap:6px;flex-wrap:wrap;font-size:12px}
.pill{padding:4px 10px;border:1px solid #30363d;border-radius:99px;cursor:pointer;color:#8b949e;background:#161b22}
.pill.on{background:#1f6feb33;color:#79c0ff;border-color:#79c0ff}
.metric{color:#8b949e;font-size:12px;margin-left:8px}.metric b{color:#e6edf3}
main{padding:14px 18px;max-width:1180px;margin:0 auto}
.card{margin-bottom:12px;border:1px solid #30363d;border-radius:8px;padding:12px 14px;border-left-width:4px}
.card.tp{border-left-color:#2ea043}.card.fp{border-left-color:#e3b341}.card.fn{border-left-color:#f85149}.card.tn{border-left-color:#3a3f47}
.head{display:flex;gap:10px;font-size:12px;color:#8b949e;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.tag{padding:2px 8px;border-radius:99px;font-size:11px;font-weight:500}
.tag.fx{background:#21262d;color:#e6edf3}.tag.ans{background:#1f6feb33;color:#79c0ff}.tag.tp{background:#1f3a23;color:#7ee787}
.tag.fp{background:#3a2f1f;color:#e3b341}.tag.fn{background:#3a1f1f;color:#f85149}.tag.tn{background:#21262d;color:#8b949e}
.case{font-weight:600}.score{margin-left:auto;color:#8b949e}
.q{font-size:13px;background:#161b22;border-left:3px solid #2f81f7;padding:8px 12px;margin:6px 0;border-radius:4px;white-space:pre-wrap}
.q .lbl{font-size:11px;color:#8b949e;display:block;margin-bottom:2px}
.t{font-size:14px;white-space:pre-wrap;word-break:break-word;padding:6px 0}
.ex{margin-top:8px;font-size:12px;color:#8b949e}.ex code{background:#21262d;padding:1px 6px;border-radius:3px;color:#e6edf3}
.ex .k{color:#79c0ff}
</style></head><body>
<header>
<h1>Haiku predictions vs human labels</h1>
<div class="pills" id="pills"></div>
<div class="metric" id="met"></div>
</header>
<main id="list"></main>
<script>
let D=[],view='all',fxView='all';
const $=id=>document.getElementById(id);
const esc=s=>{const d=document.createElement('div');d.textContent=s==null?'':s;return d.innerHTML;};
function caseOf(r){const pred=r.pred_kind!=='unknown';if(pred&&r.label===1)return'tp';if(pred&&r.label===0)return'fp';if(!pred&&r.label===1)return'fn';return'tn';}
function pillsHtml(){
  const C={all:'all',tp:'true positives',fp:'false positives',fn:'false negatives (missed)',tn:'true negatives'};
  let h='';for(const k of ['all','tp','fp','fn','tn'])h+='<span class="pill '+(view===k?'on':'')+'" data-v="'+k+'">'+C[k]+'</span>';
  h+='<span style="width:14px"></span>';
  for(const f of ['all','Veneto','Milano','Recall'])h+='<span class="pill '+(fxView===f?'on':'')+'" data-fx="'+f+'">'+f+'</span>';
  return h;
}
function metrics(rows){
  let tp=0,fp=0,fn=0,tn=0;for(const r of rows){const c=caseOf(r);if(c==='tp')tp++;else if(c==='fp')fp++;else if(c==='fn')fn++;else tn++;}
  const prec=(tp+fp)?tp/(tp+fp):0,rec=(tp+fn)?tp/(tp+fn):0;
  return {tp,fp,fn,tn,prec,rec};
}
function exHtml(e){if(!e)return'';const p=[];const k=v=>'<span class="k">'+v+'</span>';
  if(e.profession)p.push(k('prof')+' <code>'+esc(e.profession)+'</code>');
  if(e.name)p.push(k('name')+' <code>'+esc(e.name)+'</code>');
  if(e.city)p.push(k('city')+' <code>'+esc(e.city)+'</code>');
  if(e.contacts&&e.contacts.length)p.push(k('contact')+' <code>'+e.contacts.map(c=>esc(c.contactType+': '+c.value)).join(', ')+'</code>');
  if(e.description)p.push(k('desc')+' &ldquo;'+esc(String(e.description).slice(0,160))+'&rdquo;');
  return p.length?'<div class="ex">'+p.join('<br>')+'</div>':'';
}
function render(){
  $('pills').innerHTML=pillsHtml();
  let rows=D.slice();
  if(fxView!=='all')rows=rows.filter(r=>r.fixture===fxView);
  const m=metrics(rows);
  $('met').innerHTML='showing <b>'+rows.length+'</b> · precision <b>'+(m.prec*100).toFixed(1)+'%</b> · recall <b>'+(m.rec*100).toFixed(1)+'%</b> · tp <b>'+m.tp+'</b> · fp <b>'+m.fp+'</b> · fn <b>'+m.fn+'</b> · tn <b>'+m.tn+'</b>';
  if(view!=='all')rows=rows.filter(r=>caseOf(r)===view);
  rows.sort((a,b)=>{const ca=caseOf(a),cb=caseOf(b);const order={fn:0,fp:1,tp:2,tn:3};return order[ca]-order[cb]||a.fixture.localeCompare(b.fixture)||a.uid-b.uid;});
  let h='';
  for(const r of rows){
    const c=caseOf(r);
    h+='<div class="card '+c+'">';
    h+='<div class="head"><span class="tag fx">'+r.fixture+'</span><span class="tag ans">'+r.type+'</span>'+
      '<span class="case">human '+(r.label===1?'✓':'✗')+' vs haiku '+r.pred_kind+'</span>'+
      '<span class="tag '+c+'">'+c.toUpperCase()+'</span>'+
      '<span class="score">score '+r.pred_score.toFixed(2)+' · #'+r.uid+'</span></div>';
    if(r.inquiry)h+='<div class="q"><span class="lbl">QUESTION ASKED'+(r.responderName?' · responder: '+esc(r.responderName):'')+'</span>'+esc(r.inquiry)+'</div>';
    h+='<div class="t">'+esc(r.text)+'</div>';
    h+=exHtml(r.extracted);
    h+='</div>';
  }
  $('list').innerHTML=h||'<p style="color:#8b949e;text-align:center;padding:40px">no rows match</p>';
}
document.addEventListener('click',e=>{
  if(e.target.dataset.v){view=e.target.dataset.v;render();}
  if(e.target.dataset.fx){fxView=e.target.dataset.fx;render();}
});
fetch('/api/data').then(r=>r.json()).then(d=>{D=d;render();});
</script></body></html>`;

async function main() {
  let data;
  if (fs.existsSync(CACHE) && !FORCE) {
    data = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    console.log(`loaded ${data.length} cached predictions from ${CACHE}`);
    console.log('(--force to re-run Haiku)');
  } else {
    if (FORCE) console.log('--force: re-running Haiku predictions...');
    data = await predictAll();
  }

  http
    .createServer((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(HTML);
      }
      if (req.url === '/api/data') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(data));
      }
      res.writeHead(404);
      res.end();
    })
    .listen(PORT, () => {
      console.log(`Inspect UI: http://localhost:${PORT}`);
    });
}

main().catch((e) => {
  console.error('mine-haiku-inspect failed:', e.message);
  process.exit(1);
});
