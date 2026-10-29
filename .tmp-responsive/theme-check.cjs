const http=require('http'),fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root=path.resolve('admin-ui/dist');
const user={id:1,username:'testuser',full_name:'Responsive Test User',email:'test@example.test',status:'active',is_trial:0,max_connections:1,max_live_devices:1,auth_epoch:1,entitlements_version:1};
const pkg={id:1,name:'Premium',status:'active'};
const ch={id:1,name:'Example channel',number:1,channel_key:'example',enabled:1,category_id:1};
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;if(p.startsWith('/api/')){let data={ok:true,items:[],packages:[pkg],categories:[{id:1,name:'Entertainment',enabled:1}],channels:[ch],paging:{total:1,limit:25,offset:0}};if(p.includes('/auth/me'))data.admin={id:1,username:'admin',full_name:'Test Administrator',email:'admin@example.test'};if(p.includes('reg-users'))data.items=[user];if(p.includes('metrics'))data.metrics={generated_at:'2026-10-27 00:00:00',users_total:2,users_active:2,users_disabled:0,users_suspended:0,users_trial:0,packages_total:1,channels_total:1,categories_total:1,users_by_package:[{package_id:1,package_name:'Premium',users_count:2,channels_count:1,categories_count:1}]};res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(data));}let f=path.join(root,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(root,'index.html');res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(f));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await new Promise(r=>server.listen(4179,'127.0.0.1',r));const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9234','--user-data-dir='+path.resolve('.tmp-responsive/chrome'),'about:blank'],{windowsHide:true,stdio:'ignore'});let ws;try{let pages;for(let i=0;i<40;i++){try{pages=await(await fetch('http://127.0.0.1:9234/json')).json();break}catch{await sleep(200)}}if(!pages)throw Error('Browser did not start');ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}};const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,m=>m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result));ws.send(JSON.stringify({id:n,method,params}));});const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
const assert = (ok, message) => { if (!ok) throw Error(message); };
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://127.0.0.1:4179/settings'}); await sleep(350);
await evaluate(`localStorage.removeItem('starstream-theme')`);
await send('Page.reload'); await sleep(250);
assert(await evaluate(`document.documentElement.dataset.theme === 'dark'`),'Default must be dark');
await evaluate(`document.querySelector('#tab-appearance').click()`); await sleep(100);
assert(await evaluate(`document.querySelectorAll('input[name="website-theme"]').length === 2`),'Appearance choices missing');
await evaluate(`document.querySelector('input[value="light"]').click()`); await sleep(120);
assert(await evaluate(`document.documentElement.dataset.theme === 'light' && localStorage.getItem('starstream-theme') === 'light'`),'Light selection/persistence failed');
fs.writeFileSync('.tmp-responsive/theme-light-settings.png',Buffer.from((await send('Page.captureScreenshot')).data,'base64'));
await send('Page.reload'); await sleep(250);
assert(await evaluate(`document.documentElement.dataset.theme === 'light'`),'Reload lost theme');
await evaluate(`document.querySelector('#tab-account').focus()`);
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End'});
assert(await evaluate(`document.activeElement.id === 'tab-appearance'`),'Tab keyboard navigation failed');
await send('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End'});
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13}); await sleep(80);
assert(await evaluate(`document.querySelector('#tab-appearance').getAttribute('aria-selected') === 'true'`),'Appearance keyboard activation failed');
const results=[];
for(const width of [390,768,1440]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:false});
  for(const route of ['dashboard','users','categories','channels','packages','package-channels','settings','portal']) {
    await send('Page.navigate',{url:'http://127.0.0.1:4179/'+route}); await sleep(200);
    if(route==='settings') { await evaluate(`document.querySelector('#tab-appearance').click()`); await sleep(80); }
    const result=await evaluate(`({theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth+1,body:getComputedStyle(document.body).backgroundColor,text:getComputedStyle(document.body).color})`);
    assert(result.theme==='light'&&!result.overflow,JSON.stringify({width,route,...result}));
    results.push({width,route,...result});
    if((route==='users'&&width===1440)||(route==='settings'&&width===390)) fs.writeFileSync('.tmp-responsive/theme-light-'+route+'-'+width+'.png',Buffer.from((await send('Page.captureScreenshot')).data,'base64'));
  }
}
await send('Page.navigate',{url:'http://127.0.0.1:4179/settings'}); await sleep(200);
await evaluate(`document.querySelector('#tab-appearance').click()`); await sleep(80);
await evaluate(`document.querySelector('input[value="dark"]').click()`); await sleep(80);
assert(await evaluate(`document.documentElement.dataset.theme === 'dark' && localStorage.getItem('starstream-theme') === 'dark'`),'Dark restoration failed');
await send('Page.reload'); await sleep(200);
assert(await evaluate(`document.documentElement.dataset.theme === 'dark'`),'Dark reload failed');
await evaluate(`document.querySelector('#tab-appearance').click()`); await sleep(80);
await evaluate(`window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(){throw new Error('Storage unavailable')}; document.querySelector('input[value="light"]').click()`); await sleep(80);
assert(await evaluate(`document.documentElement.dataset.theme === 'light' && document.querySelector('[role="status"]').textContent.includes('cannot be saved')`),'Blocked storage must keep switching usable');
await evaluate(`Storage.prototype.setItem = window.originalSetItem; document.querySelector('input[value="dark"]').click()`); await sleep(80);
console.log(JSON.stringify({passed:true,responsiveChecks:results.length,defaultDark:true,themeSwitching:true,reloadPersistence:true,keyboardNavigation:true,blockedStorageFallback:true},null,2));
await send('Browser.close');
}finally{ws?.close();chrome.kill();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
