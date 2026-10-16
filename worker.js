// Funisville overlay hub: one Cloudflare Worker.
//   /admin               edit every overlay (needs your ADMIN_TOKEN to save)
//   /overlay/starting    OBS browser source (also /overlay/brb, /overlay/ending)
// Needs: KV binding named KV, and a secret named ADMIN_TOKEN.

const D = {
  name: "FunisWokodeneer", handle: "", noteSeconds: 8,
  theme: { ink: "#0e1713", ink2: "#17251e", brass: "#c9a45c", bone: "#efe8d6", sage: "#8fb99a" },
  scenes: {
    starting: { label: "Starting soon", title: "Starting soon", sub: "Welcome to Funisville", minutes: 5, endText: "Here we go!", endAt: 0,
      h1: "Order of the day", h2: "Town crier",
      today: ["Minecraft on the Funisville SMP", "A little game dev", "Chat hangout"],
      notes: [["Say hi in chat while you wait.", "Every voice counts in Funisville."], ["Speak Chinese with me in chat!", "用中文跟我聊天吧！"], ["Alerts are on. Be loud, be kind.", ""]] },
    brb: { label: "Be right back", title: "Be right back", sub: "The kingdom keeps watch", minutes: 5, endText: "Back any second", endAt: 0,
      h1: "While you wait", h2: "Town crier",
      today: ["Stretch, snack, hydrate", "Back in a few minutes"],
      notes: [["Chat among yourselves.", "Be kind to each other."]] },
    ending: { label: "Stream ending", title: "Thanks for visiting", sub: "See you next time in Funisville", minutes: 0, endText: "", endAt: 0,
      h1: "Next time", h2: "Parting words",
      today: ["Check the schedule for the next stream"],
      notes: [["Thanks for hanging out.", "Take care of each other."]] }
  }
};

async function getCfg(env) {
  const raw = await env.KV.get("config");
  const c = raw ? JSON.parse(raw) : {};
  const scenes = {};
  for (const k of Object.keys(D.scenes)) scenes[k] = { ...D.scenes[k], ...((c.scenes || {})[k] || {}) };
  return { ...D, ...c, theme: { ...D.theme, ...(c.theme || {}) }, scenes };
}
const H = { "content-type": "text/html;charset=utf-8", "cache-control": "no-store" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const authed = (req, env) => !!env.ADMIN_TOKEN && req.headers.get("Authorization") === "Bearer " + env.ADMIN_TOKEN;

export default {
  async fetch(req, env) {
    const p = new URL(req.url).pathname;
    if (p === "/" || p === "/admin") return new Response(ADMIN, { headers: H });
    if (p.startsWith("/overlay/")) return new Response(OVERLAY, { headers: H });
    if (p === "/api/config" && req.method === "GET") return json({ config: await getCfg(env), now: Date.now() });
    if (p.startsWith("/api/")) {
      if (!authed(req, env)) return json({ error: "Wrong or missing token" }, 401);
      if (p === "/api/config" && req.method === "PUT") {
        const t = await req.text();
        if (t.length > 100000) return json({ error: "Too large" }, 413);
        const b = JSON.parse(t);
        if (!b || typeof b !== "object" || !b.scenes) return json({ error: "Bad config" }, 400);
        await env.KV.put("config", t);
        return json({ ok: true });
      }
      if (p === "/api/timer" && req.method === "POST") {
        const { scene, action } = await req.json();
        const c = await getCfg(env);
        if (!c.scenes[scene]) return json({ error: "No such scene" }, 400);
        c.scenes[scene].endAt = action === "start" ? Date.now() + c.scenes[scene].minutes * 60000 : 0;
        await env.KV.put("config", JSON.stringify(c));
        return json({ ok: true, endAt: c.scenes[scene].endAt });
      }
    }
    return new Response("Not found", { status: 404 });
  }
};

const OVERLAY = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Funisville overlay</title>
<style>
:root{--ink:#0e1713;--ink2:#17251e;--brass:#c9a45c;--bone:#efe8d6;--sage:#8fb99a;--serif:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;--sans:"Segoe UI",system-ui,-apple-system,Arial,sans-serif}
*{box-sizing:border-box;margin:0}html,body{width:100%;height:100%;overflow:hidden;background:#000}
#stage{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;background:radial-gradient(ellipse at 50% 55%,var(--ink2) 0%,var(--ink) 70%);color:var(--bone);font-family:var(--sans);overflow:hidden}
.mote{position:absolute;border-radius:50%;background:var(--brass);opacity:0;animation:drift linear infinite}
@keyframes drift{0%{transform:translateY(0);opacity:0}15%{opacity:.5}85%{opacity:.35}100%{transform:translateY(-1100px);opacity:0}}
#orrery{position:absolute;left:660px;top:370px;width:600px;height:600px}#orrery svg{width:100%;height:100%;overflow:visible}
.slow{transform-origin:300px 300px;animation:spin 90s linear infinite}.rev{transform-origin:300px 300px;animation:spin 140s linear infinite reverse}
@keyframes spin{to{transform:rotate(360deg)}}
#progress{transition:stroke-dashoffset .9s linear}
#center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 90px}
#title{font-family:var(--serif);font-size:46px;letter-spacing:.02em}
#count{font-family:var(--serif);font-size:140px;line-height:1.05;font-variant-numeric:tabular-nums;margin:6px 0 2px}
#sub{font-size:26px;color:var(--sage);letter-spacing:.04em}
.notimer #title{font-size:62px;line-height:1.15}.notimer #count{display:none}.notimer #sub{margin-top:18px}
.panel{position:absolute;top:430px;width:460px;padding:28px 32px 30px;background:rgba(23,37,30,.78);border:1px solid rgba(201,164,92,.55);border-radius:3px}
.panel::before{content:"";position:absolute;left:-1px;top:22px;width:5px;height:46px;background:var(--brass)}
.panel h2{font-family:var(--serif);font-weight:400;font-size:32px;color:var(--brass);margin-bottom:16px}
#today{left:90px}#crier{right:90px;min-height:300px}
#todayList{list-style:none;padding:0}#todayList li{font-size:27px;line-height:1.35;padding:9px 0;border-top:1px solid rgba(239,232,214,.14)}#todayList li:first-child{border-top:0}
#note{font-size:27px;line-height:1.45;transition:opacity .6s}#note.out{opacity:0}
#note small{display:block;margin-top:14px;font-size:22px;color:var(--sage)}
#foot{position:absolute;left:0;right:0;bottom:48px;text-align:center;font-family:var(--serif);font-size:30px}
#foot span{color:var(--sage);font-family:var(--sans);font-size:24px;margin-left:14px}
#zone{position:absolute;left:710px;top:30px;width:500px;height:310px;display:none;border:2px dashed rgba(143,185,154,.7);color:var(--sage);font-size:24px;align-items:center;justify-content:center}
#zone.show{display:flex}
@media (prefers-reduced-motion:reduce){.slow,.rev,.mote{animation:none}}
</style></head><body>
<div id="stage">
<div id="zone">Alerts appear here (500 x 310)</div>
<div id="orrery"><svg viewBox="0 0 600 600" aria-hidden="true">
<g class="slow" fill="none" stroke="#c9a45c" stroke-width="1.5" opacity=".55"><circle cx="300" cy="300" r="296" stroke-dasharray="2 12"/><circle cx="300" cy="4" r="9" fill="#c9a45c" stroke="none"/><circle cx="596" cy="300" r="5" fill="#c9a45c" stroke="none"/><circle cx="122" cy="538" r="6" fill="#c9a45c" stroke="none"/></g>
<g class="rev" fill="none" stroke="#8fb99a" stroke-width="1" opacity=".5"><circle cx="300" cy="300" r="272" stroke-dasharray="60 18 6 18"/><circle cx="300" cy="28" r="6" fill="#8fb99a" stroke="none"/></g>
<circle cx="300" cy="300" r="244" fill="rgba(14,23,19,.82)" stroke="rgba(201,164,92,.25)" stroke-width="2"/>
<circle id="progress" cx="300" cy="300" r="244" fill="none" stroke="#c9a45c" stroke-width="6" stroke-linecap="round" transform="rotate(-90 300 300)" stroke-dasharray="1533" stroke-dashoffset="0"/></svg>
<div id="center"><div id="title"></div><div id="count"></div><div id="sub"></div></div></div>
<section class="panel" id="today"><h2 id="h1"></h2><ul id="todayList"></ul></section>
<section class="panel" id="crier"><h2 id="h2"></h2><div id="note"></div></section>
<div id="foot"><b id="name"></b><span id="handle"></span></div>
</div>
<script>
var $=function(i){return document.getElementById(i)};
var q=new URLSearchParams(location.search),sc=location.pathname.split("/").pop();
var cfg=null,last="",off=0,n=0,timer=null,C=1533;
function fit(){var s=Math.min(innerWidth/1920,innerHeight/1080),st=$("stage");st.style.transform="scale("+s+")";st.style.left=(innerWidth-1920*s)/2+"px";st.style.top=(innerHeight-1080*s)/2+"px"}
addEventListener("resize",fit);fit();
if(q.get("zone"))$("zone").classList.add("show");
for(var i=0;i<28;i++){var m=document.createElement("div");m.className="mote";var z=3+Math.random()*4;
m.style.cssText="left:"+Math.random()*1920+"px;top:"+(700+Math.random()*420)+"px;width:"+z+"px;height:"+z+"px;animation-duration:"+(14+Math.random()*16)+"s;animation-delay:-"+Math.random()*20+"s";$("stage").appendChild(m)}
function note(){var s=cfg.scenes[sc],a=s.notes.length?s.notes[n%s.notes.length]:["",""];$("note").textContent=a[0];
if(a[1]){var sm=document.createElement("small");sm.textContent=a[1];$("note").appendChild(sm)}n++}
function build(){
 var s=cfg.scenes[sc];if(!s){document.body.textContent="Unknown overlay: "+sc;return}
 var r=document.documentElement.style,t=cfg.theme;
 r.setProperty("--ink",t.ink);r.setProperty("--ink2",t.ink2);r.setProperty("--brass",t.brass);r.setProperty("--bone",t.bone);r.setProperty("--sage",t.sage);
 $("title").textContent=s.title;$("sub").textContent=s.sub;$("h1").textContent=s.h1;$("h2").textContent=s.h2;
 $("name").textContent=cfg.name;$("handle").textContent=cfg.handle;
 $("orrery").className=s.minutes>0?"":"notimer";$("progress").style.display=s.minutes>0?"":"none";
 $("todayList").innerHTML="";s.today.forEach(function(x){var li=document.createElement("li");li.textContent=x;$("todayList").appendChild(li)});
 n=0;note();clearInterval(timer);timer=setInterval(function(){$("note").classList.add("out");setTimeout(function(){note();$("note").classList.remove("out")},600)},Math.max(3,cfg.noteSeconds)*1000);
 tick();
}
function tick(){
 if(!cfg)return;var s=cfg.scenes[sc];if(!s||!(s.minutes>0))return;
 var total=s.minutes*60,left=s.endAt?Math.max(0,Math.ceil((s.endAt-(Date.now()+off))/1000)):total,c=$("count");
 if(s.endAt&&left===0){c.textContent=s.endText;c.style.fontSize="84px"}
 else{c.style.fontSize="";c.textContent=Math.floor(left/60)+":"+String(left%60).padStart(2,"0")}
 $("progress").style.strokeDashoffset=C*(1-left/total);
}
function load(){fetch("/api/config",{cache:"no-store"}).then(function(r){return r.json()}).then(function(j){
 off=j.now-Date.now();var s=JSON.stringify(j.config);if(s!==last){last=s;cfg=j.config;build()}}).catch(function(){})}
load();setInterval(load,3000);setInterval(tick,250);
</script></body></html>`;

const ADMIN = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Funisville overlay editor</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;background:#0e1713;color:#efe8d6;font:16px/1.4 "Segoe UI",system-ui,Arial,sans-serif}
header{padding:16px 24px;border-bottom:1px solid rgba(201,164,92,.4);display:flex;gap:16px;align-items:center;flex-wrap:wrap}
h1{font:400 26px "Palatino Linotype",Georgia,serif;color:#c9a45c;margin:0;margin-right:auto}
main{display:grid;grid-template-columns:minmax(320px,440px) 1fr;gap:24px;padding:24px;align-items:start}
@media(max-width:1000px){main{grid-template-columns:1fr}}
fieldset{border:1px solid rgba(239,232,214,.2);border-radius:4px;margin:0 0 18px;padding:14px 16px}
legend{color:#c9a45c;padding:0 8px;font-family:Georgia,serif;font-size:18px}
label{display:block;font-size:14px;color:#8fb99a;margin:10px 0 4px}
input[type=text],input[type=number],input[type=password],textarea{width:100%;background:#17251e;color:#efe8d6;border:1px solid rgba(239,232,214,.25);border-radius:3px;padding:8px 10px;font:inherit}
textarea{min-height:92px;resize:vertical}
.row{display:flex;gap:10px;flex-wrap:wrap}.row>div{flex:1;min-width:120px}
input[type=color]{width:100%;height:38px;background:#17251e;border:1px solid rgba(239,232,214,.25);border-radius:3px;padding:2px}
button{background:#17251e;color:#efe8d6;border:1px solid #c9a45c;border-radius:3px;padding:9px 16px;font:inherit;cursor:pointer}
button.main{background:#c9a45c;color:#0e1713;font-weight:600}.tab.on{background:#c9a45c;color:#0e1713}
.tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
#msg{min-height:22px;color:#8fb99a}#msg.err{color:#f0a0a0}
#pv{width:768px;max-width:100%;aspect-ratio:16/9;position:relative;border:1px solid rgba(201,164,92,.4);overflow:hidden}
#pv iframe{position:absolute;left:0;top:0;width:1920px;height:1080px;border:0;transform-origin:0 0}
.hint{font-size:13px;color:#8fb99a;margin-top:4px}code{color:#c9a45c}
</style></head><body>
<header><h1>Funisville overlays</h1>
<input type="password" id="tok" placeholder="Admin token" style="width:200px">
<button class="main" id="save">Save changes</button></header>
<main><div>
<div id="msg"></div>
<fieldset><legend>Everywhere</legend>
<label>Name in footer</label><input type="text" data-g="name">
<label>Handle in footer (optional)</label><input type="text" data-g="handle">
<label>Seconds between town crier messages</label><input type="number" min="3" data-g="noteSeconds">
<div class="row" id="colors"></div></fieldset>
<div class="tabs" id="tabs"></div>
<fieldset><legend id="lg">Overlay</legend>
<label>Title</label><input type="text" data-k="title">
<label>Subtitle</label><input type="text" data-k="sub">
<div class="row"><div><label>Timer minutes (0 = no timer)</label><input type="number" min="0" data-k="minutes"></div>
<div><label>Text when timer hits zero</label><input type="text" data-k="endText"></div></div>
<div class="row" style="margin-top:12px"><button id="start">Start timer</button><button id="stop">Reset timer</button></div>
<div class="hint">Timer buttons act right away. Save first if you changed the minutes.</div>
<div class="row"><div><label>Left box heading</label><input type="text" data-k="h1"></div>
<div><label>Right box heading</label><input type="text" data-k="h2"></div></div>
<label>Left box lines (one per line)</label><textarea id="today"></textarea>
<label>Right box messages (one per line, small text after a | )</label><textarea id="notes"></textarea>
<div class="hint">Example: <code>Say hi in chat | Every voice counts</code></div>
</fieldset></div>
<div><div id="pv"><iframe id="fr"></iframe></div>
<p class="hint">OBS browser source URL for this overlay (1920 x 1080): <code id="url"></code></p></div></main>
<script>
var $=function(i){return document.getElementById(i)},cfg,scene="starting",tok=localStorage.getItem("tok")||"";
var COL=["ink","ink2","brass","bone","sage"],NAMES={ink:"Background",ink2:"Panels",brass:"Brass accent",bone:"Main text",sage:"Soft text"};
$("tok").value=tok;$("tok").oninput=function(){tok=this.value;localStorage.setItem("tok",tok)};
function say(t,e){$("msg").textContent=t;$("msg").className=e?"err":""}
function api(path,method,body){return fetch(path,{method:method,headers:{"Authorization":"Bearer "+tok,"content-type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||"Request failed");return j})})}
function scale(){$("fr").style.transform="scale("+($("pv").clientWidth/1920)+")"}addEventListener("resize",scale);
function show(){
 var s=cfg.scenes[scene];
 $("tabs").innerHTML="";Object.keys(cfg.scenes).forEach(function(k){var b=document.createElement("button");b.className="tab"+(k===scene?" on":"");b.textContent=cfg.scenes[k].label;b.onclick=function(){scene=k;show()};$("tabs").appendChild(b)});
 $("lg").textContent=s.label;
 document.querySelectorAll("[data-g]").forEach(function(e){e.value=cfg[e.dataset.g]});
 document.querySelectorAll("[data-k]").forEach(function(e){e.value=s[e.dataset.k]});
 $("today").value=s.today.join("\\n");
 $("notes").value=s.notes.map(function(a){return a[1]?a[0]+" | "+a[1]:a[0]}).join("\\n");
 $("colors").innerHTML="";COL.forEach(function(c){var d=document.createElement("div"),l=document.createElement("label"),i=document.createElement("input");
  l.textContent=NAMES[c];i.type="color";i.value=cfg.theme[c];i.oninput=function(){cfg.theme[c]=i.value};d.appendChild(l);d.appendChild(i);$("colors").appendChild(d)});
 $("url").textContent=location.origin+"/overlay/"+scene;
 $("fr").src="/overlay/"+scene;scale();
}
document.addEventListener("input",function(e){var t=e.target;
 if(t.dataset.g)cfg[t.dataset.g]=t.type==="number"?Number(t.value):t.value;
 if(t.dataset.k)cfg.scenes[scene][t.dataset.k]=t.type==="number"?Number(t.value):t.value;
 if(t.id==="today")cfg.scenes[scene].today=t.value.split("\\n").filter(function(x){return x.trim()});
 if(t.id==="notes")cfg.scenes[scene].notes=t.value.split("\\n").filter(function(x){return x.trim()}).map(function(x){var p=x.split("|");return[p[0].trim(),(p[1]||"").trim()]})});
$("save").onclick=function(){say("Saving...");api("/api/config","PUT",cfg).then(function(){say("Saved. Overlays update within a few seconds.")}).catch(function(e){say(e.message,1)})};
function timer(a){api("/api/timer","POST",{scene:scene,action:a}).then(function(j){cfg.scenes[scene].endAt=j.endAt;say(a==="start"?"Timer started.":"Timer reset.")}).catch(function(e){say(e.message,1)})}
$("start").onclick=function(){timer("start")};$("stop").onclick=function(){timer("reset")};
fetch("/api/config").then(function(r){return r.json()}).then(function(j){cfg=j.config;show()});
</script></body></html>`;
