const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function page(endpoint='https://script.google.com/macros/s/PILOT/exec') {
 const elements=new Map();
 function element(){return {children:[],hidden:false,disabled:false,value:'',textContent:'',classList:{toggle(){}},setAttribute(){},appendChild(x){this.children.push(x)},append(...xs){this.children.push(...xs)},set innerHTML(value){this.html=value;this.children=[]},get innerHTML(){return this.html}};}
 const html=fs.readFileSync('index.html','utf8');for(const match of html.matchAll(/id="([^"]+)"/g))elements.set(match[1],element());
 const map=new Map();const localStorage={get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 let events,sequence=0;
 const c=vm.createContext({HP_CONFIG:{endpoint,label:'Pilot'},localStorage,AbortController,setTimeout,clearTimeout,setInterval(){},console,navigator:{onLine:true},window:{addEventListener(){},scrollTo(){}},document:{getElementById:id=>elements.get(id),createElement:element,querySelectorAll:()=>[],addEventListener(){},visibilityState:'visible'},crypto:{randomUUID:()=>String(++sequence).padStart(16,'0')},confirm:()=>true,fetch:async(url,options)=>{
 const req=JSON.parse(options.body);let result={ok:true};
 if(req.action==='apply'){const planned=c.Inventory.plan(events,req.operation,10);events.push(planned.event);result.ack=req.operation.id;}
 result.state=c.Inventory.replay(events);return {ok:true,json:async()=>JSON.parse(JSON.stringify(result))};
 }});
 for(const file of ['apps-script/Inventory.js','sync.js','app.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
 events=[{schema:1,type:'seed',id:'gig-original',t:1,stock:c.Inventory.opening()}];
 return {elements,c,events,async unlock(){elements.get('passphrase').value='test passphrase';await elements.get('unlockForm').onsubmit({preventDefault(){}});}};
}
test('unconfigured pilot boots locked with no invented inventory',()=>{
 const p=page('');assert.equal(p.elements.get('inventory').hidden,true);assert.equal(p.elements.get('leftN').textContent,'—');assert.equal(p.elements.get('unlockBtn').disabled,true);
});
test('UI unlocks, records a sale, voids by ID, and locks again',async()=>{
 const p=page();await p.unlock();assert.equal(p.elements.get('inventory').hidden,false);assert.equal(p.elements.get('passphrase').value,'');
 await vm.runInContext("sell('pink','S')",p.c);assert.equal(p.elements.get('soldN').textContent,1);
 const row=p.elements.get('saleLog').children[0];await row.children[0].onclick();assert.equal(p.elements.get('soldN').textContent,0);
 p.elements.get('lockBtn').onclick();assert.equal(p.elements.get('inventory').hidden,true);assert.equal(p.elements.get('leftN').textContent,'—');
});
