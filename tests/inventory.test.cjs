const test=require('node:test');
const assert=require('node:assert/strict');
const Inventory=require('../apps-script/Inventory');
const seed=()=>[{schema:1,type:'seed',id:'gig-original',t:1,stock:Inventory.opening()}];
const sale=(id,gigId='gig-original')=>({id:id.padEnd(16,'0'),type:'sale',gigId,styleId:'pink',size:'S'});
const batch=(id,changes,gigId='gig-original')=>({id:id.padEnd(16,'0'),type:'adjustBatch',gigId,changes});
function append(events,op,t=2){const result=Inventory.plan(events,op,t);if(result.event)events.push(result.event);return result.state;}
test('two phones selling from the same inventory count both sales',()=>{
 const events=seed();append(events,sale('phone-a'));const state=append(events,sale('phone-b'));
 assert.equal(state.stock.pink.S,3);assert.equal(state.sales.length,2);
});
test('retry after a lost response returns current state without duplicating a sale',()=>{
 const events=seed(),op=sale('retry');append(events,op);append(events,sale('second'));
 const result=Inventory.plan(events,op,99);assert.equal(result.event,null);assert.equal(result.state.stock.pink.S,3);assert.equal(events.length,3);
});
test('reusing an ID for a different action is rejected',()=>{
 const events=seed(),op=sale('collision');append(events,op);
 assert.throws(()=>append(events,{...op,size:'M'}),{code:'ID_CONFLICT'});
});
test('stock cannot go below zero, including concurrent last-item sales',()=>{
 const events=seed();events[0].stock.pink.S=1;append(events,sale('last-one'));
 assert.throws(()=>append(events,sale('too-late')),{code:'OUT_OF_STOCK'});assert.equal(events.length,2);
});
test('a stock draft is one atomic event with multiple relative changes',()=>{
 const events=seed();const op=batch('recount',[{styleId:'pink',size:'S',delta:3},{styleId:'dinot',size:'M',delta:-2}]);
 const state=append(events,op);
 assert.equal(state.stock.pink.S,8);assert.equal(state.stock.dinot.M,5);assert.equal(events.length,2);assert.equal(events[1].type,'adjustBatch');
 const retry=Inventory.plan(events,op,99);assert.equal(retry.event,null);assert.equal(retry.state.stock.pink.S,8);
});
test('stock draft deltas preserve concurrent sales',()=>{
 const events=seed();append(events,sale('other-phone'));
 const state=append(events,batch('restock',[{styleId:'pink',size:'S',delta:2}]));
 assert.equal(state.stock.pink.S,6);assert.equal(state.sales.length,1);
});
test('an invalid stock draft rejects every change',()=>{
 const events=seed();const before=Inventory.replay(events);
 assert.throws(()=>append(events,batch('bad-recount',[{styleId:'dinot',size:'M',delta:2},{styleId:'pink',size:'S',delta:-6}])),{code:'OUT_OF_STOCK'});
 assert.equal(events.length,1);assert.deepEqual(Inventory.replay(events),before);
});
test('void restores the correct sale once; timestamps are not identities',()=>{
 const events=seed();append(events,sale('one'),10);append(events,{...sale('two'),size:'M'},10);
 const op={id:'void-action-00000',type:'void',gigId:'gig-original',saleId:sale('two').id};
 const state=append(events,op);assert.equal(state.stock.pink.M,1);assert.equal(state.stock.pink.S,4);
 append(events,op);
 assert.throws(()=>append(events,{...op,id:'another-void-0000'}),{code:'SALE_CHANGED'});
});
test('closing a gig retains history and rejects delayed old-gig edits',()=>{
 const events=seed();const op=sale('old-sale');append(events,op);
 const state=append(events,{id:'new-gig-00000000',type:'close',gigId:'gig-original'});
 assert.equal(state.stock.pink.S,4);assert.equal(state.sales.length,0);assert.equal(events.length,3);
 assert.throws(()=>append(events,sale('late-sale')),{code:'GIG_CHANGED'});
 assert.equal(Inventory.plan(events,op,100).event,null);
});
test('invalid catalogue, quantity, and incomplete response are rejected',()=>{
 assert.throws(()=>Inventory.plan(seed(),{...sale('bad'),styleId:'unknown'},2),{code:'INVALID'});
 assert.throws(()=>Inventory.plan(seed(),{...sale('bad'),type:'adjust',delta:100},2),{code:'INVALID'});
 assert.throws(()=>Inventory.plan(seed(),batch('bad-batch',[{styleId:'pink',size:'S',delta:0}]),2),{code:'INVALID'});
 assert.throws(()=>Inventory.plan(seed(),batch('duplicate',[{styleId:'pink',size:'S',delta:1},{styleId:'pink',size:'S',delta:2}]),2),{code:'INVALID'});
 const state=Inventory.replay(seed());delete state.stock.pink;assert.throws(()=>Inventory.validateState(state));
 const events=seed();events[0].stock.pink.S=-1;assert.throws(()=>Inventory.replay(events));
});
