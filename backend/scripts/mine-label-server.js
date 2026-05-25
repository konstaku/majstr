/**
 * Super-basic local labeling UI (issue #92, v2 — thread-aware).
 * Zero deps. Autosaves into the gitignored sample JSON in place.
 *
 * Each screen is ONE atom:
 *   answer       — the QUESTION (pinned on top) + ONE responder's bundled
 *                  reply below. Mark whether the reply is useful master data.
 *   announcement — a standalone specialist advert.
 *
 * Usage (from backend/):
 *   node scripts/mine-label-server.js [--file ..] [--port 4100]
 * Keys: ← not useful/relevant (0)  → useful/relevant (1)  Space skip  ⌫ back
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i !== -1 ? process.argv[i + 1] : d;
};
const FILE = path.resolve(arg('--file', '../chat-history/italy/veneto/label-sample.json'));
const PORT = parseInt(arg('--port', '4100'), 10);
if (!fs.existsSync(FILE)) {
  console.error(`Sample not found: ${FILE}\nRun mine-sample.js first.`);
  process.exit(1);
}
const load = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
const save = (d) => fs.writeFileSync(FILE, JSON.stringify(d, null, 2));

const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Label</title><style>
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#0d1117;
color:#e6edf3;height:100vh;display:flex;flex-direction:column}
header{padding:10px 18px;border-bottom:1px solid #30363d;display:flex;gap:20px;align-items:center;
flex-wrap:wrap;font-size:13px;color:#8b949e}header b{color:#e6edf3}
.bar{flex:1;min-width:120px;height:7px;background:#21262d;border-radius:4px;overflow:hidden}
.bar>i{display:block;height:100%;background:#2f81f7}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:22px;overflow:auto}
.card{max-width:780px;width:100%}.tag{display:inline-block;font-size:12px;padding:2px 9px;
border-radius:99px;margin-bottom:10px}.tg-a{background:#1f6feb33;color:#79c0ff}
.tg-n{background:#bb800933;color:#e3b341}
.q{background:#161b22;border:1px solid #30363d;border-left:3px solid #2f81f7;border-radius:10px;
padding:16px 18px;margin-bottom:14px}.q .lbl{font-size:12px;color:#8b949e;margin-bottom:5px}
.q .t{font-size:17px;white-space:pre-wrap;word-break:break-word}
.ans{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:18px}
.ans .lbl{font-size:12px;color:#8b949e;margin-bottom:8px}
.m{white-space:pre-wrap;word-break:break-word;font-size:18px;padding:6px 0;border-bottom:1px dashed #21262d}
.m:last-child{border:0}.ex{margin-top:12px;font-size:13px;color:#8b949e}
.ex code{background:#21262d;padding:2px 6px;border-radius:4px;color:#e6edf3}
.flash{transition:background .15s}.y .ans,.y .card>.solo{background:#16301b!important}
.n .ans,.n .card>.solo{background:#301717!important}
footer{padding:12px 18px;border-top:1px solid #30363d;text-align:center;color:#8b949e;font-size:13px}
kbd{background:#21262d;border:1px solid #30363d;border-radius:4px;padding:2px 7px;color:#e6edf3}
.done{font-size:21px;text-align:center;padding:40px}
</style></head><body>
<header><div>#<b id="ix">–</b>/<b id="tot">–</b></div>
<div class="bar"><i id="pg" style="width:0"></i></div>
<div>useful/yes <b id="c1">0</b> · no <b id="c0">0</b> · skip <b id="cs">0</b> · left <b id="cl">0</b></div>
</header>
<main><div class="card flash" id="card"></div></main>
<footer><kbd>←</kbd> not useful &nbsp;<kbd>→</kbd> useful &nbsp;<kbd>Space</kbd> skip
&nbsp;<kbd>⌫</kbd> back &nbsp;— autosaves</footer>
<script>
let U=[],i=0;
const $=x=>document.getElementById(x);
const esc=s=>{const d=document.createElement('div');d.textContent=s==null?'':s;return d.innerHTML;};
function val(u){return u.type==='answer'?u.useful:u.type==='random'?u.useful:u.label;}
function counts(){let a=0,b=0,s=0,l=0;for(const u of U){const v=val(u);
 if(v===1)a++;else if(v===0)b++;else if(u._seen)s++;else l++;}
 $('c1').textContent=a;$('c0').textContent=b;$('cs').textContent=s;$('cl').textContent=l;}
function exHtml(e){if(!e)return'';const p=[];
 if(e.profession)p.push('prof <code>'+esc(e.profession)+'</code>');
 if(e.name)p.push('name <code>'+esc(e.name)+'</code>');
 if(e.contacts)p.push('contact <code>'+e.contacts.map(c=>esc(c.value)).join(', ')+'</code>');
 if(e.description)p.push('desc “'+esc(e.description.slice(0,90))+'”');
 return p.length?'<div class="ex">heuristic guess: '+p.join(' · ')+'</div>':'';}
function render(){
 if(i>=U.length){$('card').innerHTML='<div class="done">All '+U.length+
  ' reviewed. Autosaved — tell Claude to run mine-eval.</div>';counts();return;}
 const u=U[i];$('ix').textContent=i+1;$('tot').textContent=U.length;
 $('pg').style.width=(100*i/U.length)+'%';
 let h='';
 if(u.type==='answer'){
  h+='<span class="tag tg-a">inquiry + reply</span>';
  h+='<div class="q"><div class="lbl">QUESTION  #'+u.inquiryID+'  ['+(u.inquiryLang||'?')+
     ']'+(u.profession?'  · prof '+esc(u.profession):'')+'</div><div class="t">'+
     esc(u.inquiryText)+'</div></div>';
  h+='<div class="ans"><div class="lbl">REPLY by '+esc(u.responderHash)+
     '  (answer '+(u.answerIndex+1)+'/'+u.answerCount+', '+u.messages.length+' msg)</div>';
  for(const m of u.messages)h+='<div class="m">'+esc(m.text)+'</div>';
  h+=exHtml(u.extracted)+'</div>';
 }else if(u.type==='random'){
  h+='<span class="tag tg-a">random / recall check · '+esc(u.chatLabel)+'</span>';
  if(u.context.parent){h+='<div class="q"><div class="lbl">IN REPLY TO  #'+
   u.context.parent.messageID+'</div><div class="t" style="font-size:14px;color:#8b949e">'+
   esc(u.context.parent.text)+'</div></div>';}
  h+='<div class="ans solo"><div class="lbl">MESSAGE  #'+u.messageID+'  ['+(u.lang||'?')+']'+
   '</div><div class="m">'+esc(u.text)+'</div></div>';
  if(u.context.replies&&u.context.replies.length){
   h+='<div class="q" style="margin-top:14px;border-left-color:#bb8009"><div class="lbl">REPLIES ('+
    u.context.replies.length+')</div>';
   for(const r of u.context.replies)h+='<div class="t" style="font-size:14px;color:#8b949e;border-bottom:1px dashed #21262d;padding:4px 0">#'+
    r.messageID+': '+esc(r.text)+'</div>';
   h+='</div>';
  }
 }else{
  h+='<span class="tag tg-n">announcement</span>';
  h+='<div class="ans solo"><div class="lbl">MESSAGE #'+u.messageID+'  ['+(u.lang||'?')+
     ']</div><div class="m">'+esc(u.text)+'</div>'+exHtml(u.extracted)+'</div>';
 }
 $('card').innerHTML=h;counts();
}
function flash(c){const e=$('card');e.classList.add(c);setTimeout(()=>e.classList.remove(c),150);}
async function set(v){const u=U[i];if(u.type==='answer'||u.type==='random')u.useful=v;else u.label=v;u._seen=true;
 await fetch('/api/label',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({uid:u.uid,value:v})});
 flash(v===1?'y':'n');i++;render();}
addEventListener('keydown',e=>{
 if(e.key==='ArrowLeft'){e.preventDefault();set(0);}
 else if(e.key==='ArrowRight'){e.preventDefault();set(1);}
 else if(e.key===' '){e.preventDefault();U[i]._seen=true;i++;render();}
 else if(e.key==='Backspace'){e.preventDefault();if(i>0)i--;render();}});
fetch('/api/data').then(r=>r.json()).then(d=>{U=d.units;
 i=U.findIndex(u=>{const v=u.type==='answer'?u.useful:u.label;return v!==0&&v!==1;});
 if(i<0)i=U.length;render();});
</script></body></html>`;

http
  .createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(HTML);
    }
    if (req.url === '/api/data') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(load()));
    }
    if (req.url === '/api/label' && req.method === 'POST') {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => {
        try {
          const { uid, value } = JSON.parse(b);
          const d = load();
          const u = d.units.find((x) => x.uid === uid);
          if (u) {
            if (u.type === 'answer' || u.type === 'random') u.useful = value;
            else u.label = value;
          }
          save(d);
          res.writeHead(200);
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
  })
  .listen(PORT, () => {
    const d = load();
    const done = d.units.filter((u) => {
      const v = u.type === 'answer' || u.type === 'random' ? u.useful : u.label;
      return v === 0 || v === 1;
    }).length;
    console.log(`Labeling UI: http://localhost:${PORT}`);
    console.log(`File: ${FILE}  (${done}/${d.units.length} done)`);
  });
