/* Store credentials in Script Properties, never in this source. */
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return json_({ok:false, code:'AUTH', message:'Use the merch app to unlock inventory.'}); }
function doPost(e) {
  let lock;
  try {
    const body = e && e.postData && e.postData.contents;
    if (!body || body.length > 8192) return json_({ok:false,code:'INVALID',definitive:true,message:'Invalid request.'});
    let req;
    try { req = JSON.parse(body); } catch (_) { return json_({ok:false,code:'INVALID',definitive:true,message:'Invalid request.'}); }
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('BAND_PASSPHRASE');
    if (!secret || secret.length < 16) return json_({ok:false,code:'SETUP',message:'The owner must configure the pilot passphrase.'});
    if (!req || typeof req.passphrase !== 'string' || !sameSecret_(req.passphrase,secret)) return json_({ok:false,code:'AUTH',message:'Incorrect passphrase.'});
    if (!['read','apply','export'].includes(req.action)) return json_({ok:false,code:'INVALID',definitive:true,message:'Unknown request.'});
    const id = props.getProperty('SHEET_ID');
    if (!id) return json_({ok:false,code:'SETUP',message:'The owner must run setupPilot first.'});
    const sheet = SpreadsheetApp.openById(id).getSheetByName('Events');
    if (req.action !== 'apply') {
      // Reads return a coherent prefix of the append-only log. They do not need
      // to queue behind saves, and an older response cannot replace newer state
      // in the browser because state versions are monotonic.
      const events = readEvents_(sheet);
      const state = Inventory.replay(events);
      return json_(req.action === 'export' ? {ok:true,state,events} : {ok:true,state});
    }
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return json_({ok:false,code:'BUSY',message:'Another save is in progress. Retry in a moment.'});
    const events = readEvents_(sheet);
    // Validate stored data separately: errors here must never acknowledge a pending action.
    let state = Inventory.replay(events);
    let result;
    try { result = Inventory.plan(events,req.operation,Date.now()); }
    catch (err) { return json_({ok:false,code:err.code || 'INVALID',definitive:true,message:err.message,state}); }
    if (result.event) {
      // One authoritative write. No separate stock table/counter to get out of step.
      sheet.getRange(sheet.getLastRow()+1,1).setValue(JSON.stringify(result.event));
      SpreadsheetApp.flush();
    }
    state = result.state;
    return json_({ok:true,state,ack:req.operation.id});
  } catch (_) {
    // Do not expose credentials, request bodies, internal errors, or partial-write guesses.
    return json_({ok:false,code:'TEMPORARY',message:'Could not confirm the result. Retry the same action.'});
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}
function sameSecret_(a,b) {
  const hash = s=>Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8);
  const x=hash(a), y=hash(b); let difference=0;
  for(let i=0;i<x.length;i++) difference |= x[i]^y[i];
  return difference===0;
}
function readEvents_(sheet) {
  if (!sheet) throw Error('Missing log.');
  const lastRow=sheet.getLastRow();
  if (lastRow < 2) throw Error('Missing log.');
  return sheet.getRange(2,1,lastRow-1,1).getValues().map(row=>JSON.parse(row[0]));
}
// Run manually in the Apps Script editor. Does not replace an existing log.
function setupPilot() {
  const lock=LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const props=PropertiesService.getScriptProperties();
    const secret=props.getProperty('BAND_PASSPHRASE');
    if(!secret || secret.length<16) throw Error('Set BAND_PASSPHRASE to a long random passphrase (at least 16 characters) in Project Settings > Script Properties.');
    const existing=props.getProperty('SHEET_ID');
    if(existing) { Inventory.replay(readEvents_(SpreadsheetApp.openById(existing).getSheetByName('Events'))); return; }
    const book=SpreadsheetApp.create('Hottt Probs — pilot inventory');
    const sheet=book.getSheets()[0]; sheet.setName('Events');
    sheet.getRange(1,1,2,1).setValues([['Event JSON — do not edit rows'],[JSON.stringify({schema:1,type:'seed',id:Utilities.getUuid(),t:Date.now(),stock:Inventory.opening()})]]);
    SpreadsheetApp.flush();
    props.setProperty('SHEET_ID',book.getId());
  } finally { lock.releaseLock(); }
}
