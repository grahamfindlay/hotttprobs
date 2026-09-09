const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const crypto=require('node:crypto');
const Inventory=require('../apps-script/Inventory');
function backend(){
 const rows=[['Event JSON'],[JSON.stringify({schema:1,type:'seed',id:'gig-original',t:1,stock:Inventory.opening()})]];
 const flags={locked:false,busy:false,failAfterWrite:false};let writes=0;
 const sheet={getLastRow:()=>rows.length,getRange(row,col,count=1){return {getValues:()=>rows.slice(row-1,row-1+count),setValue(value){rows[row-1]=[value];writes++;if(flags.failAfterWrite)throw Error('lost acknowledgment');}}}};
 const props={BAND_PASSPHRASE:'long random testing passphrase',SHEET_ID:'test-sheet'};
 const c=vm.createContext({Inventory,Date,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(a,s)=>[...crypto.createHash(a).update(s).digest()]},LockService:{getScriptLock:()=>({tryLock:()=>{if(flags.busy)return false;flags.locked=true;return true},hasLock:()=>flags.locked,releaseLock:()=>flags.locked=false})},SpreadsheetApp:{openById:id=>{assert.equal(id,'test-sheet');return {getSheetByName:()=>sheet}},flush(){}},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}});
 vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),c);
 return {rows,flags,props,get writes(){return writes},request:req=>c.doPost({postData:{contents:JSON.stringify(req)}}),get:()=>c.doGet()};
}
const op={id:'sale-00000000000',type:'sale',gigId:'gig-original',styleId:'pink',size:'S'};
const request=(b,action='apply',operation=op)=>b.request({passphrase:b.props.BAND_PASSPHRASE,action,operation});
test('all read/write/export actions require server-side authentication',()=>{
 const b=backend();for(const action of ['read','apply','export'])assert.equal(b.request({action,operation:op,passphrase:'wrong'}).code,'AUTH');
 assert.equal(b.get().ok,false);assert.equal(b.writes,0);
});
test('uncertain write failure is safely retried without a second row',()=>{
 const b=backend();b.flags.failAfterWrite=true;assert.equal(request(b).code,'TEMPORARY');assert.equal(b.flags.locked,false);
 b.flags.failAfterWrite=false;const result=request(b);assert.equal(result.ok,true);assert.equal(result.state.stock.pink.S,4);assert.equal(b.writes,1);
});
test('lock contention never proceeds with a write',()=>{
 const b=backend();b.flags.busy=true;assert.equal(request(b).code,'BUSY');assert.equal(b.writes,0);
 assert.equal(request(b,'read').ok,true);assert.equal(request(b,'export').events.length,1);
});
test('corrupt persisted data produces a retryable failure, not a definitive rejection',()=>{
 const b=backend();b.rows[1]=['bad json'];const result=request(b);assert.equal(result.code,'TEMPORARY');assert.equal(result.definitive,undefined);assert.equal(b.writes,0);
});
test('validation errors cannot mutate the log',()=>{
 const b=backend();const result=request(b,'apply',{...op,size:'BAD'});assert.equal(result.definitive,true);assert.equal(result.state.stock.pink.S,5);assert.equal(b.writes,0);
});
