/**
 * Super-basic local labeling UI for the pre-filter sample (issue #92).
 * Zero dependencies (Node http+fs). Reads/writes the sample JSON in place —
 * autosaves on every keypress, nothing leaves your machine.
 *
 * Usage (from backend/):
 *   node scripts/mine-label-server.js
 *   node scripts/mine-label-server.js --file ../chat-history/italy/veneto/label-sample.json --port 4100
 *
 * Keys:  ← = NOT relevant (0)   → = relevant (1)   Space = skip
 *        Backspace = previous   (autosaves; just close the tab when done)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : def;
}

const FILE = path.resolve(
  arg('--file', '../chat-history/italy/veneto/label-sample.json')
);
const PORT = parseInt(arg('--port', '4100'), 10);

if (!fs.existsSync(FILE)) {
  console.error(`Sample file not found: ${FILE}\nRun mine-sample.js first.`);
  process.exit(1);
}

const load = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
const save = (d) => fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<title>Label sample</title><style>
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,sans-serif;
background:#0d1117;color:#e6edf3;height:100vh;display:flex;flex-direction:column}
header{padding:12px 20px;border-bottom:1px solid #30363d;display:flex;
gap:24px;align-items:center;flex-wrap:wrap;font-size:14px;color:#8b949e}
header b{color:#e6edf3}.bar{flex:1;min-width:120px;height:8px;background:#21262d;
border-radius:4px;overflow:hidden}.bar>i{display:block;height:100%;background:#2f81f7}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:760px;width:100%;background:#161b22;border:1px solid #30363d;
border-radius:12px;padding:28px}.meta{font-size:13px;color:#8b949e;margin-bottom:14px}
.msg{font-size:21px;white-space:pre-wrap;word-break:break-word;min-height:120px}
.flash{transition:background .15s}.y{background:#1f3a23!important}
.n{background:#3a1f1f!important}footer{padding:14px 20px;border-top:1px solid #30363d;
text-align:center;color:#8b949e;font-size:14px}kbd{background:#21262d;border:1px solid
#30363d;border-radius:4px;padding:2px 7px;color:#e6edf3}.done{font-size:22px;text-align:center}
</style></head><body>
<header>
<div>Item <b id="idx">–</b>/<b id="tot">–</b></div>
<div class="bar"><i id="prog" style="width:0"></i></div>
<div>relevant <b id="c1">0</b> · not <b id="c0">0</b> · skipped <b id="cs">0</b> · left <b id="cl">0</b></div>
</header>
<main><div class="card flash" id="card">
<div class="meta" id="mt"></div><div class="msg" id="tx"></div></div></main>
<footer><kbd>←</kbd> not relevant &nbsp; <kbd>→</kbd> relevant &nbsp;
<kbd>Space</kbd> skip &nbsp; <kbd>⌫</kbd> back &nbsp;— autosaves</footer>
<script>
let rows=[],i=0;
const $=id=>document.getElementById(id);
function counts(){let c1=0,c0=0,cs=0,cl=0;for(const r of rows){
 if(r.label===1)c1++;else if(r.label===0)c0++;else if(r._seen)cs++;else cl++;}
 $('c1').textContent=c1;$('c0').textContent=c0;$('cs').textContent=cs;$('cl').textContent=cl;}
function render(){
 if(i>=rows.length){$('card').innerHTML='<div class="done">All '+rows.length+
  ' items reviewed. Autosaved — tell Claude to run mine-eval.</div>';return;}
 const r=rows[i];
 $('idx').textContent=i+1;$('tot').textContent=rows.length;
 $('prog').style.width=(100*(i)/rows.length)+'%';
 $('mt').textContent='#'+r.messageID+'  ['+(r.lang||'?')+']'+
   (r.label===1?'  ▶ relevant':r.label===0?'  ▶ not relevant':'');
 $('tx').textContent=r.text;counts();}
function flash(c){const e=$('card');e.classList.add(c);
 setTimeout(()=>e.classList.remove(c),150);}
async function set(label){
 const r=rows[i];r.label=label;r._seen=true;
 await fetch('/api/label',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({messageID:r.messageID,label})});
 flash(label===1?'y':label===0?'n':'');i++;render();}
function skip(){rows[i]._seen=true;i++;render();}
function back(){if(i>0)i--;render();}
addEventListener('keydown',e=>{
 if(e.key==='ArrowLeft'){e.preventDefault();set(0);}
 else if(e.key==='ArrowRight'){e.preventDefault();set(1);}
 else if(e.key===' '){e.preventDefault();skip();}
 else if(e.key==='Backspace'){e.preventDefault();back();}});
fetch('/api/data').then(r=>r.json()).then(d=>{rows=d.rows;
 i=rows.findIndex(r=>r.label!==0&&r.label!==1);if(i<0)i=rows.length;render();});
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/' ) {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(HTML);
  }
  if (req.url === '/api/data') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(load()));
  }
  if (req.url === '/api/label' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { messageID, label } = JSON.parse(body);
        const d = load();
        const row = d.rows.find((r) => r.messageID === messageID);
        if (row) row.label = label;
        save(d);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      } catch (e) {
        res.writeHead(400);
        res.end('{"ok":false}');
      }
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  const labeled = load().rows.filter((r) => r.label === 0 || r.label === 1).length;
  console.log(`Labeling UI: http://localhost:${PORT}`);
  console.log(`File: ${FILE}  (${labeled} already labeled)`);
  console.log('← not relevant   → relevant   Space skip   Backspace back   Ctrl+C to stop');
});
