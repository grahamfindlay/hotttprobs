"use strict";
const {SIZES,STYLES} = Inventory;
let state=null, sel=STYLES[0].id, selSize='S', exportUrl=null;
const byId=id=>document.getElementById(id);
const client=new MerchSync({endpoint:HP_CONFIG.endpoint,storage:localStorage,fetcher:fetch,uuid:()=>crypto.randomUUID(),onChange:update});
function canEdit(){return navigator.onLine && client.ready();}
function update(){
 state=client.state;
 byId('syncMsg').textContent=client.busy?'Checking and saving…':(!navigator.onLine?'Offline — reconnect before editing.':client.message);
 byId('syncBar').className=client.busy?'busy':client.healthy && navigator.onLine?'ok':'bad';
 byId('syncNow').disabled=client.busy || !client.passphrase || !navigator.onLine;
 byId('logoutBtn').disabled=client.busy;
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
const fitTotal = fit => STYLES.filter(s=>s.fit===fit).reduce((a,s)=>a+styleTotal(s.id),0);
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
    b.textContent = z;
    b.setAttribute("aria-pressed", z===selSize);
    b.onclick = ()=>{ selSize = z; renderStock(); };
    head.appendChild(b);
  });

  const rows = document.getElementById("stockRows");
  rows.innerHTML = "";
  STYLES.forEach(s=>{
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = '<div class="name">'+s.name+'<em>'+styleTotal(s.id)+' across all sizes</em></div>';
    const st = document.createElement("div");
    st.className = "stepper";
    const minus = document.createElement("button"); minus.textContent = "–";
    minus.setAttribute("aria-label","One fewer "+s.short+" "+selSize);
    const val = document.createElement("span"); val.className="val"; val.textContent = state.stock[s.id][selSize];
    const plus = document.createElement("button"); plus.textContent = "+";
    plus.setAttribute("aria-label","One more "+s.short+" "+selSize);
    minus.disabled = !canEdit() || state.stock[s.id][selSize] <= 0;
    minus.onclick = ()=> adjust(s.id, selSize, -1);
    plus.disabled = !canEdit();
    plus.onclick = ()=> adjust(s.id, selSize, 1);
    st.append(minus, val, plus);
    row.appendChild(st);
    rows.appendChild(row);
  });

  document.getElementById("stockTotals").innerHTML =
    '<div><b>'+fitTotal("regular")+'</b>regular fit</div>' +
    '<div><b>'+fitTotal("crop")+'</b>crops</div>' +
    '<div><b>'+fitTotal("tank")+'</b>tanks</div>' +
    '<div><b>'+grandTotal()+'</b>everything</div>';
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
async function adjust(styleId,size,delta){if(canEdit())await client.submit({type:'adjust',styleId,size,delta});}
async function voidSale(saleId){if(canEdit())await client.submit({type:'void',saleId});}
byId('unlockForm').onsubmit=async e=>{
  e.preventDefault();const input=byId('passphrase');const value=input.value;input.value='';
  await client.unlock(value);
};
byId('logoutBtn').onclick=()=>client.logout();
byId('syncNow').onclick=()=>client.refresh();
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
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')client.refresh();});
byId('pilotLabel').textContent=HP_CONFIG.label;
if(!HP_CONFIG.endpoint){byId('setupHint').textContent='Pilot setup is in progress. The owner needs to connect the new backend.';byId('unlockBtn').disabled=true;}
update();
if(!HP_CONFIG.endpoint)byId('unlockBtn').disabled=true;
