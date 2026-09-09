const test=require('node:test');const assert=require('node:assert/strict');
global.Inventory=require('../apps-script/Inventory');const Sync=require('../sync');
const endpoint='https://script.google.com/macros/s/TEST_PILOT/exec';
function storage(){const map=new Map();return {get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
function server(){const events=[{schema:1,type:'seed',id:'gig-original',t:1,stock:Inventory.opening()}];let calls=[];
 return {events,calls,async fetcher(url,options){const req=JSON.parse(options.body);calls.push(req);let out;
 if(req.passphrase!=='test passphrase only')out={ok:false,code:'AUTH',message:'Incorrect passphrase.'};
 else if(req.action==='apply'){try{const result=Inventory.plan(events,req.operation,10);if(result.event)events.push(result.event);out={ok:true,state:result.state,ack:req.operation.id};}catch(e){out={ok:false,code:e.code,message:e.message,definitive:true,state:Inventory.replay(events)};}}
 else out={ok:true,state:Inventory.replay(events),...(req.action==='export'?{events}: {})};
 return {ok:true,json:async()=>structuredClone(out)};}};
}
let seq=0;
function client(s,store=storage()){return new Sync({endpoint,storage:store,fetcher:s.fetcher,uuid:()=>String(++seq).padStart(16,'0')});}
const unlock=c=>c.unlock('test passphrase only');
const sale={type:'sale',styleId:'pink',size:'S'};
test('native fetch is invoked as a function, not as a client instance method',async()=>{
 const s=server();const c=new Sync({endpoint,storage:storage(),uuid:()=>'',fetcher:async function(url,options){
  'use strict';assert.equal(this,undefined);return s.fetcher(url,options);
 }});
 await unlock(c);assert.equal(c.ready(),true);
});
test('fresh client only reads the backend, never uploads opening stock',async()=>{
 const s=server();s.events[0].stock.pink.S=2;const c=client(s);await unlock(c);
 assert.equal(c.state.stock.pink.S,2);assert.deepEqual(s.calls.map(r=>r.action),['read']);
});
test('reload preserves uncertain request and retry applies it exactly once',async()=>{
 const s=server(),store=storage(),c=client(s,store);await unlock(c);
 c.fetcher=async(u,o)=>{await s.fetcher(u,o);throw Error('response lost');};await c.submit(sale);
 assert.equal(c.pending().length,1);assert.equal(c.ready(),false);assert.equal(s.events.length,2);
 const reloaded=client(s,store);await unlock(reloaded);
 assert.equal(reloaded.state.stock.pink.S,4);assert.equal(reloaded.pending().length,0);assert.equal(s.events.length,2);
});
test('HTTP errors and malformed acknowledgments retain pending operations',async()=>{
 for(const response of [{ok:false},{ok:true,json:async()=>({ok:true,state:{}})},{ok:true,json:async()=>({ok:true,state:Inventory.replay(server().events),ack:'wrong'})}]){
 const s=server(),c=client(s);await unlock(c);c.fetcher=async()=>response;await c.submit(sale);
 assert.equal(c.pending().length,1);assert.equal(c.healthy,false);
 }
});
test('failed startup read never reports healthy',async()=>{
 const s=server(),c=client(s);c.fetcher=async()=>{throw Error('unavailable')};await unlock(c);
 assert.equal(c.state,null);assert.equal(c.ready(),false);assert.equal(c.message,'unavailable');
});
test('a second edit is blocked while an upload is in flight',async()=>{
 const s=server(),c=client(s);await unlock(c);let release;
 c.fetcher=async(u,o)=>{if(JSON.parse(o.body).action==='apply')await new Promise(r=>release=r);return s.fetcher(u,o)};
 const first=c.submit(sale);assert.equal(c.ready(),false);await c.submit(sale);release();await first;
 assert.equal(s.events.length,2);assert.equal(c.state.stock.pink.S,4);
});
test('a successful edit uses its acknowledged state without a second read',async()=>{
 const s=server(),c=client(s);await unlock(c);await c.submit(sale);
 assert.deepEqual(s.calls.map(r=>r.action),['read','apply']);assert.equal(c.message,'Saved');
});
test('browser storage failure prevents sending a sale',async()=>{
 const s=server(),c=client(s);await unlock(c);c.storage.setItem=()=>{throw Error('quota')};await c.submit(sale);
 assert.equal(s.events.length,1);assert.equal(c.ready(),false);assert.match(c.message,/No action was sent/);
});
test('another device closing the gig rejects pending sale and refreshes state',async()=>{
 const s=server(),a=client(s),b=client(s);await unlock(a);await unlock(b);await a.submit({type:'close'});await b.submit(sale);
 assert.equal(b.pending().length,0);assert.equal(b.state.gigId,a.state.gigId);assert.equal(s.events.length,2);assert.match(b.message,/closed/);
});
test('pending actions are isolated by backend URL and contain no credential',async()=>{
 const s=server(),store=storage(),c=client(s,store);await unlock(c);c.fetcher=async()=>{throw Error('offline')};await c.submit(sale);
 assert.doesNotMatch(store.getItem(store.key(0)),/passphrase/);
 const other=new Sync({endpoint:endpoint.replace('TEST_PILOT','PRODUCTION'),storage:store,fetcher:s.fetcher,uuid:()=>''});assert.equal(other.pending().length,0);
});
test('export preserves closed-gig history and reconstructs inventory',async()=>{
 const s=server(),c=client(s);await unlock(c);await c.submit(sale);await c.submit({type:'close'});
 const backup=await c.exportLog();assert.equal(backup.events.length,3);assert.deepEqual(Inventory.replay(backup.events),c.state);
});
