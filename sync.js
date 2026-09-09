/* Authenticated, acknowledged writes. No timers that mark unsent data as saved. */
var MerchSync = class {
  constructor({endpoint,storage,fetcher,uuid,onChange=()=>{}}) {
    this.endpoint=endpoint;this.storage=storage;this.fetcher=(...args)=>fetcher(...args);this.uuid=uuid;this.onChange=onChange;
    this.prefix='hp-pilot-v2:pending:'+encodeURIComponent(endpoint)+':';
    this.passphrase='';this.state=null;this.busy=false;this.healthy=false;this.message='Unlock to load inventory.';
    this.lastSubmissionId='';this.lastAcknowledged='';this.lastRejected='';
  }
  pending() {
    const result=[];
    for(let i=0;i<this.storage.length;i++) {
      const key=this.storage.key(i);
      if(key && key.startsWith(this.prefix)) result.push({key,op:Inventory.operation(JSON.parse(this.storage.getItem(key)))});
    }
    return result;
  }
  ready() { try {return !!(this.passphrase && this.state && this.healthy && !this.busy && !this.pending().length);}catch(_){return false;} }
  emit() { this.onChange(this); }
  async request(action,operation) {
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(this.endpoint)) throw Error('The pilot backend has not been configured.');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
    try {
      const response=await this.fetcher(this.endpoint,{method:'POST',credentials:'omit',redirect:'follow',signal:controller.signal,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action,passphrase:this.passphrase,operation})});
      if(!response.ok) throw Error('Server error. The save has not been confirmed.');
      const result=await response.json();
      if(!result || typeof result.ok!=='boolean') throw Error('Invalid server response.');
      if(result.state) Inventory.validateState(result.state);
      if(result.ok && (!result.state || (action==='apply' && result.ack!==operation.id))) throw Error('Missing save confirmation.');
      return result;
    } finally {clearTimeout(timer);}
  }
  accept(state) {if(state && (!this.state || state.version>=this.state.version))this.state=state;}
  async unlock(passphrase) {this.passphrase=passphrase;return this.refresh();}
  logout() {if(this.busy)return;this.passphrase='';this.state=null;this.healthy=false;this.message='Logged out. Pending actions, if any, will retry after signing in again.';this.emit();}
  async refresh() {
    if(this.busy || !this.passphrase)return;
    this.busy=true;this.emit();
    try {
      const entries=this.pending();
      for(const entry of entries) {
        const result=await this.request('apply',entry.op);
        if(result.ok) {this.accept(result.state);this.storage.removeItem(entry.key);this.lastAcknowledged=entry.op.id;}
        else if(result.definitive && result.state) {
          this.accept(result.state);this.storage.removeItem(entry.key);this.lastRejected=entry.op.id;this.healthy=true;this.message=result.message;return;
        } else {throw Error(result.message || 'Save not confirmed. Retry.');}
      }
      if(entries.length) {
        // Each apply response already contains authoritative state computed
        // while holding the write lock. A second read doubles Apps Script
        // latency and creates needless contention between devices.
        this.healthy=true;this.message='Saved';return;
      }
      const result=await this.request('read');
      if(!result.ok)throw Error(result.message || 'Could not load inventory.');
      this.accept(result.state);this.healthy=true;this.message='Inventory refreshed';
    } catch(err) {
      this.healthy=false;this.message=err.name==='AbortError'?'Request timed out. Retry to check whether it saved.':err.message;
    } finally {this.busy=false;this.emit();}
  }
  async submit(action) {
    if(!this.ready())return false;
    const op=Inventory.operation({...action,id:this.uuid(),gigId:this.state.gigId});
    this.lastSubmissionId=op.id;this.lastAcknowledged='';this.lastRejected='';
    try {this.storage.setItem(this.prefix+op.id,JSON.stringify(op));}
    catch(_) {this.healthy=false;this.message='Browser storage is unavailable. No action was sent.';this.emit();return false;}
    await this.refresh();
    return this.lastAcknowledged===op.id;
  }
  async exportLog() {
    if(!this.ready())throw Error('Refresh inventory before exporting.');
    this.busy=true;this.emit();
    try {
      const result=await this.request('export');
      if(!result.ok)throw Error(result.message || 'Export failed.');
      const reconstructed=Inventory.replay(result.events);
      if(JSON.stringify(reconstructed)!==JSON.stringify(result.state))throw Error('Export failed validation.');
      this.accept(result.state);return {schema:1,exportedAt:Date.now(),events:result.events};
    } finally {this.busy=false;this.emit();}
  }
};
if(typeof module!=='undefined')module.exports=MerchSync;
