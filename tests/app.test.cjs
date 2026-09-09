const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function page(endpoint='https://script.google.com/macros/s/PILOT/exec') {
 const elements=new Map();
 function element(){return {children:[],hidden:false,disabled:false,value:'',textContent:'',classList:{toggle(){}},setAttribute(){},appendChild(x){this.children.push(x)},append(...xs){this.children.push(...xs)},set innerHTML(value){this.html=value;this.children=[]},get innerHTML(){return this.html}};}
 const html=fs.readFileSync('index.html','utf8');for(const match of html.matchAll(/id="([^"]+)"/g))elements.set(match[1],element());
 const map=new Map();const localStorage={get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 let events,sequence=0;
 const c=vm.createContext({HP_CONFIG:{endpoint,label:'Pilot'},localStorage,AbortController,Blob,URL:{createObjectURL:()=> 'blob:test-backup',revokeObjectURL(){}},setTimeout,clearTimeout,setInterval(){},console,navigator:{onLine:true},window:{addEventListener(){},scrollTo(){}},document:{getElementById:id=>elements.get(id),createElement:element,querySelectorAll:()=>[],addEventListener(){},visibilityState:'visible'},crypto:{randomUUID:()=>String(++sequence).padStart(16,'0')},confirm:()=>true,fetch:async(url,options)=>{
 const req=JSON.parse(options.body);let result={ok:true};
 if(req.action==='apply'){const planned=c.Inventory.plan(events,req.operation,10);if(planned.event)events.push(planned.event);result.ack=req.operation.id;}
 if(req.action==='export')result.events=events;
 result.state=c.Inventory.replay(events);return {ok:true,json:async()=>JSON.parse(JSON.stringify(result))};
 }});
 for(const file of ['apps-script/Inventory.js','sync.js','app.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 events=[{schema:1,type:'seed',id:'gig-original',t:1,stock:c.Inventory.opening()}];
 return {elements,c,events,async unlock(){elements.get('passphrase').value='test passphrase';await elements.get('unlockForm').onsubmit({preventDefault(){}});}};
}
test('unconfigured pilot boots locked with no invented inventory',()=>{
 const p=page('');assert.equal(p.elements.get('inventory').hidden,true);assert.equal(p.elements.get('leftN').textContent,'—');assert.equal(p.elements.get('unlockBtn').disabled,true);
});
test('export exposes a persistent download link and removes it on logout',async()=>{
 const p=page();await p.unlock();await p.elements.get('exportBtn').onclick();
 assert.equal(p.elements.get('exportDownload').hidden,false);
 assert.equal(p.elements.get('exportDownload').href,'blob:test-backup');
 assert.match(p.elements.get('exportStatus').textContent,/Backup ready/);
 p.elements.get('logoutBtn').onclick();assert.equal(p.elements.get('exportDownload').hidden,true);
});
test('UI unlocks, records a sale, voids by ID, and logs out',async()=>{
 const p=page();await p.unlock();assert.equal(p.elements.get('inventory').hidden,false);assert.equal(p.elements.get('passphrase').value,'');
 await vm.runInContext("sell('pink','S')",p.c);assert.equal(p.elements.get('soldN').textContent,1);
 const row=p.elements.get('saleLog').children[0];await row.children[0].onclick();assert.equal(p.elements.get('soldN').textContent,0);
 p.elements.get('logoutBtn').onclick();assert.equal(p.elements.get('inventory').hidden,true);assert.equal(p.elements.get('leftN').textContent,'—');
});
test('stock steppers create a draft and Save sends one combined adjustment',async()=>{
 const p=page();await p.unlock();
 let row=p.elements.get('stockRows').children[0];row.children[0].children[2].onclick();
 row=p.elements.get('stockRows').children[0];row.children[0].children[2].onclick();
 assert.equal(p.events.length,1);assert.equal(p.elements.get('stockDraftBar').hidden,false);
 assert.equal(p.elements.get('stockNavBtn').textContent,'Stock •');
 assert.equal(p.elements.get('stockSaveBtn').textContent,'Save 1 change');
 await p.elements.get('stockSaveBtn').onclick();
 assert.equal(p.events.length,2);assert.equal(p.events[1].type,'adjustBatch');assert.equal(p.events[1].changes[0].delta,2);
 row=p.elements.get('stockRows').children[0];assert.equal(p.elements.get('stockDraftBar').hidden,true);assert.equal(p.elements.get('stockNavBtn').textContent,'Stock');assert.equal(row.children[0].children[1].textContent,7);
});
test('an uncertain stock save remains visible until its idempotent retry is acknowledged',async()=>{
 const p=page();await p.unlock();let row=p.elements.get('stockRows').children[0];row.children[0].children[2].onclick();
 vm.runInContext("client.fetcher=async(...args)=>{await fetch(...args);throw Error('response lost')}",p.c);
 await p.elements.get('stockSaveBtn').onclick();
 assert.equal(p.events.length,2);assert.equal(p.elements.get('stockDraftBar').hidden,false);assert.equal(p.elements.get('stockDraftTitle').textContent,'Stock save pending');
 vm.runInContext("client.fetcher=(...args)=>fetch(...args)",p.c);await p.elements.get('syncNow').onclick();
 assert.equal(p.events.length,2);assert.equal(p.elements.get('stockDraftBar').hidden,true);
});
