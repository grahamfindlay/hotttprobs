"use strict";
const {SIZES,STYLES} = Inventory;
let state=null, sel=STYLES[0].id, selSize='S', exportUrl=null;
let stockDraft={}, stockDraftOpId=null, stockSaving=false;
const byId=id=>document.getElementById(id);
const client=new MerchSync({endpoint:HP_CONFIG.endpoint,storage:localStorage,fetcher:fetch,uuid:()=>crypto.randomUUID(),onChange:update});
function canEdit(){return navigator.onLine && client.ready();}
function update(){
 if(stockDraftOpId && client.lastAcknowledged===stockDraftOpId){stockDraft={};stockDraftOpId=null;stockSaving=false;}
 if(stockDraftOpId && client.lastRejected===stockDraftOpId){stockDraftOpId=null;stockSaving=false;}
 state=client.state;
 byId('syncMsg').textContent=client.busy?'Checking and saving…':(!navigator.onLine?'Offline — reconnect before editing.':client.message);
 byId('syncBar').className=client.busy?'busy':client.healthy && navigator.onLine?'ok':'bad';
 byId('syncNow').disabled=client.busy || !client.passphrase || !navigator.onLine;
 byId('logoutBtn').disabled=client.busy || stockSaving;
 byId('unlockBtn').disabled=client.busy || !HP_CONFIG.endpoint;
 byId('inventory').hidden=!state;
 byId('unlockForm').hidden=!!state;
 byId('soldN').textContent=state?state.sales.length:'—';
 byId('leftN').textContent=state?grandTotal():'—';
 if(state)render();
 byId('closeBtn').disabled=!canEdit() || !state?.sales.length;
 byId('exportBtn').disabled=!canEdit();
 byId('copyBtn').disabled=!state;
 if(!state){
   if(exportUrl){URL.revokeObjectURL(exportUrl);exportUrl=null;}
   byId('exportDownload').hidden=true;byId('exportStatus').textContent='';
 }
}
/* ---------- helpers ---------- */
const styleById = id => STYLES.find(s=>s.id===id);
const styleTotal = id => SIZES.reduce((a,z)=>a+state.stock[id][z],0);
const grandTotal = () => STYLES.reduce((a,s)=>a+styleTotal(s.id),0);
const draftKey = (styleId,size) => styleId+':'+size;
const draftEntries = () => Object.values(stockDraft);
const draftDelta = (styleId,size) => stockDraft[draftKey(styleId,size)]?.delta || 0;
const draftStock = (styleId,size) => state.stock[styleId][size]+draftDelta(styleId,size);
const draftStyleTotal = id => SIZES.reduce((a,z)=>a+draftStock(id,z),0);
const draftFitTotal = fit => STYLES.filter(s=>s.fit===fit).reduce((a,s)=>a+draftStyleTotal(s.id),0);
const draftGrandTotal = () => STYLES.reduce((a,s)=>a+draftStyleTotal(s.id),0);
const soldCount = () => state.sales.length;
const clock = t => new Date(t).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});

/* ---------- render ---------- */
function render(){
  document.getElementById("soldN").textContent = soldCount();
  document.getElementById("leftN").textContent = grandTotal();
  renderChips(); renderSizes(); renderStock(); renderLog();
}

function renderChips(){
  const box = document.getElementById("styleChips");
  box.innerHTML = "";
  STYLES.forEach(s=>{
    const n = styleTotal(s.id);
    const b = document.createElement("button");
    b.className = "chip" + (n===0 ? " empty":"");
    b.setAttribute("aria-pressed", s.id===sel);
    b.innerHTML = s.short + '<span class="n">' + n + '</span>';
    b.onclick = ()=>{ sel = s.id; renderChips(); renderSizes(); };
    box.appendChild(b);
  });
}

function renderSizes(){
  const grid = document.getElementById("sizeGrid");
  grid.innerHTML = "";
  SIZES.forEach(z=>{
    const n = state.stock[sel][z];
    const b = document.createElement("button");
    b.className = "size" + (n>0 && n<=2 ? " low":"");
    b.innerHTML = '<span class="lbl">'+z+'</span><span class="qty">'+n+'</span>';
    if(n===0 || !canEdit()){ b.disabled = true; }
    else b.onclick = ()=> sell(sel, z);
    grid.appendChild(b);
  });
}

function renderStock(){
  const head = document.getElementById("sizeHead");
  head.innerHTML = "";
  SIZES.forEach(z=>{
    const b = document.createElement("button");
    const changed=draftEntries().filter(x=>x.size===z).length;
    b.innerHTML = z+(changed?'<span class="draft-badge">'+changed+'</span>':'');
    if(changed)b.setAttribute("aria-label",z+", "+changed+" unsaved "+(changed===1?'change':'changes'));
    b.setAttribute("aria-pressed", z===selSize);
    b.onclick = ()=>{ selSize = z; renderStock(); };
    head.appendChild(b);
  });

  const rows = document.getElementById("stockRows");
  rows.innerHTML = "";
  STYLES.forEach(s=>{
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = '<div class="name">'+s.name+'<em>'+draftStyleTotal(s.id)+' across all sizes</em></div>';
    const st = document.createElement("div");
    st.className = "stepper";
    const minus = document.createElement("button"); minus.textContent = "–";
    minus.setAttribute("aria-label","One fewer "+s.short+" "+selSize);
    const shown=draftStock(s.id,selSize), changed=draftDelta(s.id,selSize)!==0;
    const val = document.createElement("span"); val.className="val"+(changed?' changed':'')+(shown<0?' invalid':''); val.textContent = shown;
    const plus = document.createElement("button"); plus.textContent = "+";
    plus.setAttribute("aria-label","One more "+s.short+" "+selSize);
    minus.disabled = stockSaving || !!stockDraftOpId || shown <= 0;
    minus.onclick = ()=> changeStockDraft(s.id, selSize, -1);
    plus.disabled = stockSaving || !!stockDraftOpId || shown >= 1000000;
    plus.onclick = ()=> changeStockDraft(s.id, selSize, 1);
    st.append(minus, val, plus);
    row.appendChild(st);
    rows.appendChild(row);
  });

  document.getElementById("stockTotals").innerHTML =
    '<div><b>'+draftFitTotal("regular")+'</b>regular fit</div>' +
    '<div><b>'+draftFitTotal("crop")+'</b>crops</div>' +
    '<div><b>'+draftFitTotal("tank")+'</b>tanks</div>' +
    '<div><b>'+draftGrandTotal()+'</b>everything</div>';

  const changes=draftEntries(), bar=byId('stockDraftBar');
  byId('stockNavBtn').textContent=changes.length?'Stock •':'Stock';
  byId('stockNavBtn').classList.toggle('has-draft',!!changes.length);
  byId('stockNavBtn').setAttribute('aria-label',changes.length?'Stock, unsaved changes':'Stock');
  bar.hidden=!changes.length;
  if(changes.length){
    byId('stockDraftTitle').textContent=stockDraftOpId?'Stock save pending':changes.length+' unsaved '+(changes.length===1?'change':'changes');
    const detail=changes.map(x=>styleById(x.styleId).short+' '+x.size+' '+(x.delta>0?'+':'−')+Math.abs(x.delta)).join(', ');
    byId('stockDraftSummary').textContent=(stockDraftOpId?'Waiting for confirmation. ':'')+detail;
    byId('stockSaveBtn').textContent=stockSaving?'Saving…':'Save '+changes.length+' '+(changes.length===1?'change':'changes');
    byId('stockSaveBtn').disabled=stockSaving || !!stockDraftOpId || !canEdit();
    byId('stockDiscardBtn').disabled=stockSaving || !!stockDraftOpId;
  }
}

function renderLog(){
  const box = document.getElementById("saleLog");
  box.innerHTML = "";
  if(!state.sales.length){
    box.innerHTML = '<p class="empty">Nothing sold yet. Head to Sell and start ringing people up.</p>';
    return;
  }
  [...state.sales].reverse().forEach(x=>{
    const row = document.createElement("div");
    row.className = "sale";
    row.innerHTML = '<time>'+clock(x.t)+'</time><span class="sz">'+x.size+
                    '</span><span class="nm">'+styleById(x.styleId).short+'</span>';
    const v = document.createElement("button");
    v.className = "void"; v.textContent = "void";
    v.disabled = !canEdit();
    v.onclick = ()=> voidSale(x.id);
    row.appendChild(v);
    box.appendChild(row);
  });
}

async function sell(styleId,size){if(canEdit())await client.submit({type:'sale',styleId,size});}
function changeStockDraft(styleId,size,delta){
  if(!state || stockSaving || stockDraftOpId)return;
  const key=draftKey(styleId,size), next=draftDelta(styleId,size)+delta;
  const shown=state.stock[styleId][size]+next;
  if(shown<0 || shown>1000000)return;
  if(next)stockDraft[key]={styleId,size,delta:next};else delete stockDraft[key];
  renderStock();
}
async function saveStockDraft(){
  const changes=draftEntries().map(x=>({...x}));
  if(!changes.length || !canEdit() || stockSaving || stockDraftOpId)return;
  stockSaving=true;renderStock();
  const saved=await client.submit({type:'adjustBatch',changes});
  stockSaving=false;
  if(saved)stockDraft={};
  else if(client.lastSubmissionId && client.pending().some(x=>x.op.id===client.lastSubmissionId))stockDraftOpId=client.lastSubmissionId;
  renderStock();
}
async function voidSale(saleId){if(canEdit())await client.submit({type:'void',saleId});}
byId('unlockForm').onsubmit=async e=>{
  e.preventDefault();const input=byId('passphrase');const value=input.value;input.value='';
  await client.unlock(value);
};
byId('logoutBtn').onclick=()=>client.logout();
byId('syncNow').onclick=()=>client.refresh();
byId('stockSaveBtn').onclick=saveStockDraft;
byId('stockDiscardBtn').onclick=()=>{if(!stockSaving && !stockDraftOpId){stockDraft={};renderStock();}};
byId('closeBtn').onclick=async()=>{
  if(canEdit() && confirm('Close this gig for everyone? Its sales will remain in the exported history.'))await client.submit({type:'close'});
};
byId('copyBtn').onclick=async()=>{
  if(!state)return;
  const counts={};state.sales.forEach(s=>{const k=styleById(s.styleId).name+' '+s.size;counts[k]=(counts[k]||0)+1;});
  const text='HOTTT PROBS — current gig\n'+state.sales.length+' pieces sold\n\n'+Object.entries(counts).map(([k,v])=>v+' × '+k).join('\n')+'\n\nLeft in the tubs: '+grandTotal();
  try{await navigator.clipboard.writeText(text);byId('copyBtn').textContent='Copied';}
  catch(_){byId('copyBtn').textContent='Could not copy — use Export instead';}
  setTimeout(()=>byId('copyBtn').textContent='Copy the recap',2000);
};
byId('exportBtn').onclick=async()=>{
  byId('exportDownload').hidden=true;
  byId('exportStatus').textContent='Preparing backup…';
  try {
    const data=await client.exportLog();
    if(exportUrl)URL.revokeObjectURL(exportUrl);
    exportUrl=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=byId('exportDownload');a.href=exportUrl;a.download='hp-inventory-'+new Date().toISOString().slice(0,10)+'.json';a.hidden=false;
    byId('exportStatus').textContent='Backup ready. Use the download link below.';
  }catch(err){byId('exportStatus').textContent=err.message;}
};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button').forEach(x=>x.setAttribute('aria-current',x===b));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+b.dataset.view));
  window.scrollTo(0,0);
});
window.addEventListener('offline',update);
window.addEventListener('online',()=>client.refresh());
window.addEventListener('storage',()=>client.refresh());
window.addEventListener('beforeunload',e=>{if(draftEntries().length && !stockDraftOpId){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')client.refresh();});
byId('pilotLabel').textContent=HP_CONFIG.label;
if(!HP_CONFIG.endpoint){byId('setupHint').textContent='Pilot setup is in progress. The owner needs to connect the new backend.';byId('unlockBtn').disabled=true;}
update();
if(!HP_CONFIG.endpoint)byId('unlockBtn').disabled=true;
