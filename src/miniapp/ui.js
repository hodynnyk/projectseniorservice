export function miniAppHtml() {
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>Соня · projectseniorservice</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
:root{
  color-scheme:dark;
  --bg:#080203;--bg2:#140508;--card:rgba(28,8,13,.86);--card2:rgba(18,6,10,.92);
  --text:#fff5f6;--muted:#c8a4ad;--line:rgba(255,82,111,.22);--red:#ff4d68;--red2:#ff7a8d;
  --ok:#ff9aad;--warn:#ffd166;--shadow:0 24px 80px rgba(0,0,0,.46);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;
}
*{box-sizing:border-box}body{margin:0;min-height:100dvh;color:var(--text);background:
  radial-gradient(circle at 50% -10%,rgba(255,77,104,.24),transparent 42vw),
  radial-gradient(circle at 100% 18%,rgba(255,0,0,.13),transparent 36vw),
  linear-gradient(180deg,var(--bg),var(--bg2) 55%,#070203);
  padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
button,input{font:inherit}.app{max-width:560px;margin:0 auto;padding:14px 14px 86px}.top{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0 12px}.brand{display:flex;align-items:center;gap:10px}.mark{width:38px;height:38px;border-radius:16px;background:radial-gradient(circle at 30% 24%,#fff,#ffb1bd 24%,#ff4d68 52%,#4b101a 78%);box-shadow:0 0 32px rgba(255,77,104,.35)}h1{margin:0;font-size:19px;letter-spacing:-.045em}.sub,.meta{font-size:12px;color:var(--muted);line-height:1.42}.pill{font-size:11px;color:#ffd9df;border:1px solid var(--line);border-radius:999px;padding:6px 9px;background:rgba(255,255,255,.035)}.card{border:1px solid var(--line);border-radius:28px;background:linear-gradient(180deg,rgba(40,12,20,.82),rgba(16,6,10,.86));box-shadow:var(--shadow);padding:16px;margin-bottom:12px}.hero{position:relative;overflow:hidden;text-align:left}.hero:before{content:"";position:absolute;inset:-40%;background:radial-gradient(circle,rgba(255,77,104,.18),transparent 42%);animation:slowGlow 6s ease-in-out infinite}.heroIn{position:relative;display:grid;grid-template-columns:142px 1fr;gap:14px;align-items:center}.avatarWrap{position:relative;display:grid;place-items:center}.avatar{width:138px;height:176px;object-fit:cover;border-radius:26px;border:1px solid rgba(255,83,112,.34);box-shadow:0 0 26px rgba(255,77,104,.26),0 0 78px rgba(255,0,0,.16);animation:sonyaIdle 4.8s ease-in-out infinite, redPulse 5.8s ease-in-out infinite}.bubble{position:relative;border:1px solid rgba(255,90,120,.25);background:rgba(18,6,10,.82);border-radius:22px;padding:13px;line-height:1.42;color:#fff4f6}.bubble b{color:white}.tabs{position:fixed;left:0;right:0;bottom:0;z-index:20;background:linear-gradient(180deg,rgba(8,2,3,.72),rgba(8,2,3,.98));backdrop-filter:blur(16px);border-top:1px solid var(--line);padding:8px max(10px,env(safe-area-inset-left)) max(10px,env(safe-area-inset-bottom));display:flex;justify-content:center;gap:8px}.tabs button{border:1px solid transparent;background:rgba(255,255,255,.035);color:var(--muted);border-radius:16px;padding:10px 11px;font-weight:800;min-width:64px}.tabs button.active{color:#fff;border-color:rgba(255,77,104,.42);background:rgba(255,77,104,.14)}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.metric{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.035);border-radius:20px;padding:12px}.metric b{display:block;font-size:24px;letter-spacing:-.05em}.list{display:grid;gap:9px}.item{border:1px solid rgba(255,255,255,.07);background:rgba(0,0,0,.14);border-radius:19px;padding:12px}.item b{display:block;margin-bottom:4px}.type{display:inline-flex;font-size:11px;color:#ffdce2;border:1px solid rgba(255,77,104,.22);border-radius:999px;padding:4px 7px;margin-right:6px}.empty{border:1px dashed var(--line);border-radius:20px;padding:16px;text-align:center;color:var(--muted);background:rgba(0,0,0,.12)}.login{min-height:calc(100dvh - 28px);display:grid;align-content:center}.input{width:100%;border:1px solid var(--line);background:#13060a;color:var(--text);border-radius:18px;padding:14px;outline:none}.btn{border:1px solid rgba(255,77,104,.38);background:linear-gradient(135deg,var(--red),var(--red2));color:#26040b;border-radius:18px;padding:13px 15px;font-weight:950}.btn.ghost{background:rgba(255,255,255,.04);color:#fff;border-color:var(--line)}.row{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.smallBtn{border:1px solid var(--line);background:rgba(255,255,255,.04);color:#fff;border-radius:14px;padding:8px 10px;font-size:12px;font-weight:800}.hidden{display:none!important}@keyframes sonyaIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes redPulse{0%,100%{box-shadow:0 0 24px rgba(255,77,104,.20),0 0 58px rgba(255,0,0,.10)}50%{box-shadow:0 0 42px rgba(255,77,104,.50),0 0 118px rgba(255,0,0,.28)}}@keyframes slowGlow{0%,100%{opacity:.55;transform:scale(.98)}50%{opacity:1;transform:scale(1.06)}}@media(max-width:420px){.heroIn{grid-template-columns:118px 1fr}.avatar{width:116px;height:154px}.app{padding-left:12px;padding-right:12px}.tabs button{min-width:auto;flex:1;padding:10px 6px}.grid2{grid-template-columns:1fr 1fr}}
</style>
</head>
<body><div id="app" class="app"></div><div id="tabs" class="tabs hidden"></div>
<script>
try{window.Telegram&&Telegram.WebApp&&Telegram.WebApp.ready&&Telegram.WebApp.ready()}catch(e){}
const VERSION='sonya-v21-smart-telegram-voice-maps-memory';
const S={token:localStorage.sonya_token||'',user:null,tab:'today',today:null,items:[],google:null,loading:false};
const app=document.getElementById('app'), tabs=document.getElementById('tabs');
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function api(path,opt={}){
  const h={'accept':'application/json'};
  if(opt.body!=null)h['content-type']='application/json';
  if(S.token)h.authorization='Bearer '+S.token;
  const url=new URL(path, location.origin).toString();
  let r,txt='';
  try{r=await fetch(url,{...opt,headers:{...h,...(opt.headers||{})},cache:'no-store'});txt=await r.text();}
  catch(e){throw new Error('Немає звʼязку із сервером. Оновіть Mini App і спробуйте ще раз.')}
  let j=null;
  try{j=txt?JSON.parse(txt):{};}catch(e){
    if(r.status===404)throw new Error('Сервер ще не оновив API. Залийте останній ZIP або відкрийте Mini App заново.');
    throw new Error('Сервер повернув неочікувану відповідь. Оновіть сторінку або перевірте /route-check.');
  }
  if(!r.ok||j.ok===false)throw new Error(humanError(j.error||j.message||'Request failed'));
  return j;
}
function humanError(m){
  m=String(m||'').replace(/^Bad JSON$/i,'Сервер повернув неочікувану відповідь. Оновіть Mini App.');
  if(/Bad access code/i.test(m))return 'Код не підійшов. Перевірте access code.';
  if(/Login required/i.test(m))return 'Сесія закінчилась. Увійдіть ще раз.';
  if(/First setup/i.test(m))return 'Систему ще не налаштовано. Спочатку відкрийте адмінку.';
  if(/Invalid JSON/i.test(m))return 'Mini App відправив некоректний запит. Я вже виправив це в цій збірці.';
  return m;
}
function imgFor(tab){return tab==='body'?'/assets/sonya-fitness.webp':tab==='system'?'/assets/sonya-work.webp':tab==='tasks'?'/assets/sonya-night.webp':'/assets/sonya-welcome-red.webp'}
function phrase(){if(!S.user)return 'Введіть приватний access code. Я відкрию тільки вашу панель.';if(S.user.role==='owner')return 'Сер, я показую тільки головне. Команди краще давати в Telegram — тут нічого зайвого.';return 'Показую сімейні задачі й потрібну інформацію. Без зайвих дій.'}
function shell(inner){app.innerHTML='<div class="top"><div class="brand"><div class="mark"></div><div><h1>Соня</h1><div class="sub">особиста панель · тільки головне</div></div></div><div class="pill">'+esc(S.user?S.user.role:'private')+'</div></div>'+inner}
function hero(title, text, tab){return '<div class="card hero"><div class="heroIn"><div class="avatarWrap"><img class="avatar" src="'+imgFor(tab||S.tab)+'" alt="Соня"></div><div><div class="bubble"><b>'+esc(title)+'</b><br>'+esc(text)+'</div></div></div></div>'}
function loginView(msg=''){tabs.classList.add('hidden');const intro='Доброго вечору, сер. Я на місці. Введіть access code — без підказок і зайвих кнопок.';shell('<div class="login">'+hero('Приватний вхід', intro,'today')+'<div class="card"><input id="code" class="input" placeholder="Access code" autocomplete="current-password"><br><br><button class="btn" onclick="login()">Увійти</button>'+(msg?'<div class="meta" style="margin-top:12px;color:#ffd9df">'+esc(msg)+'</div>':'')+'</div></div>')}
function login(){const code=document.getElementById('code').value.trim();if(!code)return loginView('Порожній код, сер.');api('/api/auth/login',{method:'POST',body:JSON.stringify({accessCode:code,source:'miniapp',publicBaseUrl:location.origin})}).then(r=>{S.token=r.token;S.user=r.user;localStorage.sonya_token=r.token;loadAll()}).catch(e=>loginView(e.message))}
function boot(){if(!S.token)return loginView();api('/api/me').then(r=>{S.user=r.user;loadAll()}).catch(()=>{localStorage.removeItem('sonya_token');S.token='';loginView()})}
function loadAll(){S.loading=true;Promise.all([
 api('/api/today').catch(e=>({ok:false,error:e.message,data:null})),
 api('/api/items?limit=80').catch(e=>({ok:false,error:e.message,items:[]})),
 api('/api/google/status').catch(e=>({ok:false,error:e.message,status:null,gemini:null}))
]).then(([t,i,g])=>{S.today=t.data||{};S.items=i.items||[];S.google=g;S.loading=false;render()}).catch(e=>{S.loading=false;render(e.message)})}
function render(err){tabs.classList.remove('hidden');tabs.innerHTML=['today:Today','tasks:Tasks','body:Body','system:System'].map(x=>{const [id,label]=x.split(':');return '<button class="'+(S.tab===id?'active':'')+'" onclick="S.tab=\\''+id+'\\';render()">'+label+'</button>'}).join('');if(S.tab==='today')return renderToday(err);if(S.tab==='tasks')return renderTasks();if(S.tab==='body')return renderBody();return renderSystem()}
function renderToday(err){const c=S.today?.counts||{};const next=(S.today?.next||[]).slice(0,5);shell(hero('Доброго вечору', phrase(),'today')+'<div class="grid2"><div class="metric"><span class="meta">Відкриті</span><b>'+num(c.open)+'</b></div><div class="metric"><span class="meta">Сьогодні</span><b>'+num(c.today)+'</b></div><div class="metric"><span class="meta">Прострочені</span><b>'+num(c.overdue)+'</b></div><div class="metric"><span class="meta">Усього</span><b>'+num(c.all)+'</b></div></div><div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0;font-size:17px">Найближче</h2><button class="smallBtn" onclick="loadAll()">Оновити</button></div><br>'+list(next,'Немає найближчих задач')+(err?'<div class="meta">'+esc(err)+'</div>':'')+'</div>')}
function renderTasks(){const rows=S.items.filter(x=>['task','reminder'].includes(x.type)&&x.status!=='done').slice(0,10);shell(hero('Задачі', 'Тільки перегляд. Створення й команди — через Telegram, щоб тут було чисто.','tasks')+'<div class="card"><h2 style="margin-top:0">Відкриті задачі</h2>'+list(rows,'Відкритих задач немає')+'</div>')}
function renderBody(){const rows=S.items.filter(x=>['workout','nutrition','food_book','health'].includes(x.type)).slice(0,10);shell(hero('Тіло і раціон','Тренування, харчування і книга їжі. Тут лише акуратний журнал без зайвих полів.','body')+'<div class="card"><h2 style="margin-top:0">Останні записи</h2>'+list(rows,'Записів ще немає')+'</div>')}
function renderSystem(){const gs=S.google?.status||{};const gm=S.google?.gemini||{};const connected=gs.connected?'Підключено':'Не підключено';shell(hero('Стан системи','Коротко показую, що живе, а що треба доробити в адмінці.','system')+'<div class="card"><div class="item"><b>Google Gmail / Calendar</b><div class="meta">'+esc(connected)+'</div></div><div class="item"><b>Client ID</b><div class="meta">'+esc(gs.clientIdLooksValid?'OK':'needs check')+'</div></div><div class="item"><b>Gemini</b><div class="meta">'+esc(gm.configured?'configured':'not configured')+'</div></div><div class="item"><b>R2</b><div class="meta">вимкнено навмисно</div></div><br><button class="smallBtn" onclick="loadAll()">Оновити</button><button class="smallBtn" onclick="logout()">Вийти</button></div>')}
function list(rows,empty){if(!rows||!rows.length)return '<div class="empty">'+esc(empty)+'</div>';return '<div class="list">'+rows.map(x=>'<div class="item"><span class="type">'+esc(x.type||'item')+'</span><b>'+esc(x.title||'Без назви')+'</b><div class="meta">'+esc([x.status,x.visibility,fmt(x.dueAt)].filter(Boolean).join(' · '))+'</div>'+(x.content?'<div class="meta">'+esc(String(x.content).slice(0,120))+'</div>':'')+'</div>').join('')+'</div>'}
function fmt(s){if(!s)return '';try{return new Date(s).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return ''}}
function num(x){return Number(x||0)}
function logout(){localStorage.removeItem('sonya_token');S.token='';S.user=null;loginView('Вийшли з Mini App.')}
boot();
</script>
</body></html>`;
}
