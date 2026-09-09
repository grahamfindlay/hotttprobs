/* Shared, dependency-free inventory rules: browser, Node tests, and Apps Script. */
var Inventory = (function () {
"use strict";
const SIZES = ["S","M","L","XL","2XL","3XL","4XL"];


const STYLES = [
  {id:"pink",  name:"Pink Hottt Probs Shirt",    short:"Pink HP",   fit:"regular"},
  {id:"dinot", name:"Dino Regular Black",        short:"Dino tee",  fit:"regular"},
  {id:"blkhp", name:"Black Hottt Probs Regular", short:"Black HP",  fit:"regular"},
  {id:"dinoc", name:"Dino Crop Black",           short:"Dino crop", fit:"crop"},
  {id:"hpcrop",name:"HP Crop Black",             short:"HP crop",   fit:"crop"},
  {id:"redtk", name:"Red HP Tank",               short:"Red tank",  fit:"tank"},
  {id:"dinotk",name:"Dino Tank Black",           short:"Dino tank", fit:"tank"},
];

const OPENING = {
  //      S  M  L XL 2XL 3XL 4XL
  pink:  [5, 1, 9, 2, 0, 0, 0],
  dinot: [8, 7, 3, 6, 0, 0, 0],
  blkhp: [9, 8, 8,13,10, 0, 0],
  dinoc: [2, 7, 8, 6, 0, 0, 0],
  hpcrop:[0, 0, 1, 1, 0, 0, 0],
  redtk: [1, 3, 1, 3, 0, 0, 0],
  dinotk:[4, 3, 2, 1, 0, 0, 0],
};


function fail(code, message) { const e = new Error(message); e.code = code; throw e; }
function opening() {
  const stock = {};
  STYLES.forEach(s => { stock[s.id] = {}; SIZES.forEach((z,i) => stock[s.id][z] = OPENING[s.id][i]); });
  return stock;
}
function validateStock(stock) {
  if (!stock || typeof stock !== 'object') fail('INVALID', 'Missing inventory.');
  STYLES.forEach(s => SIZES.forEach(z => {
    const n = stock[s.id] && stock[s.id][z];
    if (!Number.isSafeInteger(n) || n < 0 || n > 1000000) fail('INVALID', 'Invalid inventory quantity.');
  }));
}
function operation(raw) {
  if (!raw || typeof raw !== 'object' || !/^[a-zA-Z0-9-]{16,80}$/.test(raw.id || '') || typeof raw.gigId !== 'string') fail('INVALID','Invalid action.');
  const op = {id:raw.id, type:raw.type, gigId:raw.gigId};
  if (op.type === 'sale' || op.type === 'adjust') {
    if (!STYLES.some(s=>s.id === raw.styleId) || !SIZES.includes(raw.size)) fail('INVALID','Unknown shirt or size.');
    op.styleId = raw.styleId; op.size = raw.size;
    if (op.type === 'adjust') {
      if (raw.delta !== 1 && raw.delta !== -1) fail('INVALID','Adjust by one item at a time.');
      op.delta = raw.delta;
    }
  } else if (op.type === 'adjustBatch') {
    if (!Array.isArray(raw.changes) || raw.changes.length < 1 || raw.changes.length > STYLES.length * SIZES.length) fail('INVALID','Invalid stock changes.');
    const seen = new Set();
    op.changes = raw.changes.map(change => {
      if (!change || !STYLES.some(s=>s.id === change.styleId) || !SIZES.includes(change.size)) fail('INVALID','Unknown shirt or size.');
      if (!Number.isSafeInteger(change.delta) || change.delta === 0 || Math.abs(change.delta) > 1000000) fail('INVALID','Invalid stock adjustment.');
      const key = change.styleId + ':' + change.size;
      if (seen.has(key)) fail('INVALID','Duplicate stock change.');
      seen.add(key);
      return {styleId:change.styleId, size:change.size, delta:change.delta};
    });
  } else if (op.type === 'void') {
    if (typeof raw.saleId !== 'string') fail('INVALID','Missing sale ID.');
    op.saleId = raw.saleId;
  } else if (op.type !== 'close') fail('INVALID','Unknown action.');
  return op;
}
function apply(state, op, t) {
  if (op.gigId !== state.gigId) fail('GIG_CHANGED','This gig was closed on another device. Review the refreshed inventory.');
  if (op.type === 'sale' || op.type === 'adjust') {
    const delta = op.type === 'sale' ? -1 : op.delta;
    const n = state.stock[op.styleId][op.size] + delta;
    if (n < 0) fail('OUT_OF_STOCK','No more of this shirt in stock. Refresh and recount if needed.');
    if (n > 1000000) fail('INVALID','Inventory limit reached.');
    state.stock[op.styleId][op.size] = n;
    if (op.type === 'sale') state.sales.push({id:op.id, t, styleId:op.styleId, size:op.size});
  } else if (op.type === 'adjustBatch') {
    // Validate every relative change before mutating anything. The whole recount
    // is accepted as one event or rejected without a partial stock update.
    const next = op.changes.map(change => {
      const n = state.stock[change.styleId][change.size] + change.delta;
      if (!Number.isSafeInteger(n) || n < 0) fail('OUT_OF_STOCK','One or more changes would make stock negative. Review the refreshed inventory.');
      if (n > 1000000) fail('INVALID','Inventory limit reached.');
      return {styleId:change.styleId, size:change.size, quantity:n};
    });
    next.forEach(change => state.stock[change.styleId][change.size] = change.quantity);
  } else if (op.type === 'void') {
    const i = state.sales.findIndex(s=>s.id === op.saleId);
    if (i < 0) fail('SALE_CHANGED','That sale was already voided or belongs to a closed gig.');
    const s = state.sales[i];
    if (state.stock[s.styleId][s.size] >= 1000000) fail('INVALID','Inventory limit reached.');
    state.stock[s.styleId][s.size]++; state.sales.splice(i,1);
  } else { state.sales = []; state.gigId = op.id; }
  state.version++; state.updatedAt = t;
  return state;
}
function replay(events) {
  const first = events[0];
  if (!first || first.type !== 'seed' || first.schema !== 1 || typeof first.id !== 'string' || !Number.isSafeInteger(first.t)) fail('INVALID','Invalid inventory log.');
  validateStock(first.stock);
  const state = {schema:1, version:1, updatedAt:first.t, gigId:first.id, stock:JSON.parse(JSON.stringify(first.stock)), sales:[]};
  const seen = new Set([first.id]);
  events.slice(1).forEach(e=>{
    if (seen.has(e.id) || !Number.isSafeInteger(e.t)) fail('INVALID','Invalid or duplicate log entry.');
    seen.add(e.id); apply(state,operation(e),e.t);
  });
  return state;
}
function plan(events, raw, t) {
  const op = operation(raw), state = replay(events);
  const existing = events.find(e=>e.id===op.id);
  if (existing) {
    if (JSON.stringify(operation(existing)) !== JSON.stringify(op)) fail('ID_CONFLICT','This action ID was already used for a different action.');
    return {state, event:null};
  }
  apply(state,op,t);
  return {state, event:Object.assign({},op,{t})};
}
function validateState(s) {
  if (!s || s.schema !== 1 || !Number.isSafeInteger(s.version) || s.version < 1 || !Number.isSafeInteger(s.updatedAt) || typeof s.gigId !== 'string' || !Array.isArray(s.sales)) fail('INVALID','Invalid server response.');
  validateStock(s.stock);
  const ids = new Set();
  s.sales.forEach(x=>{
    if (!x || typeof x.id !== 'string' || ids.has(x.id) || !Number.isSafeInteger(x.t) || !STYLES.some(y=>y.id===x.styleId) || !SIZES.includes(x.size)) fail('INVALID','Invalid sales response.');
    ids.add(x.id);
  });
  return s;
}
return {SIZES, STYLES, opening, operation, replay, plan, validateState};
})();
if (typeof module !== 'undefined') module.exports = Inventory;
