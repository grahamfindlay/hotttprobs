const test=require('node:test');
const assert=require('node:assert/strict');
const Inventory=require('../apps-script/Inventory');
const seed=()=>[{schema:1,type:'seed',id:'gig-original',t:1,stock:Inventory.opening()}];
const sale=(id,gigId='gig-original')=>({id:id.padEnd(16,'0'),type:'sale',gigId,styleId:'pink',size:'S'});
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
 const state=Inventory.replay(seed());delete state.stock.pink;assert.throws(()=>Inventory.validateState(state));
 const events=seed();events[0].stock.pink.S=-1;assert.throws(()=>Inventory.replay(events));
});
