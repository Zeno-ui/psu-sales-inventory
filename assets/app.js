'use strict';
const S = { user: null, page: 'dashboard', cart: {}, products: [], rp: { sales: 'today', pnl: 'month', pay: 'month', mov: 'month' } };
const ROLES = {
  admin: ['dashboard','pos','sales','products','purchases','suppliers','reports','users','settings'],
  cashier: ['dashboard','pos','sales'],
  clerk: ['dashboard','products','purchases','suppliers']
};
const NAV = { dashboard:['Dashboard','▦'], pos:['POS (Sales)','🛒'], sales:['Sales History','🧾'], products:['Products','📦'],
  purchases:['Purchases','🚚'], suppliers:['Suppliers','👥'], reports:['Reports','📄'], users:['Users','⚙'], settings:['Settings','🛠'] };
const P = {};
const $ = s => document.querySelector(s);
const money = n => '₱' + Number(n || 0).toFixed(2);
const pdfMoney = n => 'PHP ' + Number(n || 0).toFixed(2);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = d => new Date(d.replace(' ', 'T')).toLocaleString('en-US');
const deb = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function toast(msg, err) {
  const d = document.createElement('div'); d.textContent = msg; if (err) d.className = 'e';
  $('#toast').appendChild(d); setTimeout(() => d.remove(), 3500);
}
async function api(action, data, params = '') {
  const r = await fetch('api.php?action=' + action + params, {
    method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({ error: 'Server error. Is Apache/MySQL running and install.php done?' }));
  if (!r.ok) { if (r.status === 401 && S.user && action !== 'login') { location.reload(); } throw new Error(j.error || 'Error'); }
  return j;
}
const safe = fn => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };

function modal(title, body, opts = {}) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}"><div class="mh"><h2>${title}</h2><button class="x">×</button></div>${body}</div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.x').onclick = close;
  ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
  ov.close = close; return ov;
}
const field = (id, label, val = '', type = 'text', extra = '') => `<label>${label}</label><input id="${id}" type="${type}" value="${esc(val)}" ${extra}>`;
const main = html => { $('#main').innerHTML = html; };
const head = (t, sub, btn = '') => `<div class="head"><div><h1>${t}</h1><p>${sub}</p></div>${btn}</div>`;

/* ================= LOGIN / SHELL ================= */
function loginView() {
  $('#app').innerHTML = `<div class="login-wrap"><div class="login">
    <h1>PSU Sales & Inventory</h1><p class="sub">Palawan State University</p>
    <label>Username</label><input id="lu" autocomplete="username">
    <label>Password</label><input id="lp" type="password" autocomplete="current-password">
    <button class="btn" id="lgo">Sign In</button><div class="err" id="lerr"></div>
    <div class="cred">Credential Account<div>
      <button class="btn out" data-u="admin">Admin</button><button class="btn out" data-u="cashier">Cashier</button><button class="btn out" data-u="clerk">Clerk</button>
    </div></div></div></div>`;
  document.querySelectorAll('.cred button').forEach(b => b.onclick = () => { $('#lu').value = b.dataset.u; $('#lp').value = b.dataset.u + '123'; });
  const go = async () => {
    try { S.user = await api('login', { username: $('#lu').value, password: $('#lp').value }); start(); }
    catch (e) { $('#lerr').textContent = e.message; }
  };
  $('#lgo').onclick = go; $('#lp').onkeydown = e => { if (e.key === 'Enter') go(); };
}
function shell() {
  const u = S.user;
  $('#app').innerHTML = `<div class="shell"><aside class="side">
    <div class="brand">Palawan State<br>University</div>
    <div class="me"><div class="av">👤</div><div><b>${esc(u.name)}</b><small>${u.role}</small></div></div>
    <nav class="nav">${ROLES[u.role].map(k => `<a data-p="${k}"><span>${NAV[k][1]}</span>${NAV[k][0]}</a>`).join('')}</nav>
    <div class="signout" id="so">⇦ &nbsp;Sign Out</div></aside><main class="main" id="main"></main></div>`;
  document.querySelectorAll('.nav a').forEach(a => a.onclick = () => go(a.dataset.p));
  $('#so').onclick = async () => { await api('logout', {}); location.reload(); };
}
function go(p) {
  S.page = p;
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('act', a.dataset.p === p));
  safe(P[p])();
}
async function start() {
  window.TAX_RATE = S.user.tax || 0;
  shell(); go('dashboard');
  if (S.user.role === 'admin') autoBackup();
}
async function init() {
  try { S.user = await api('me'); start(); } catch { loginView(); }
}

/* ================= DASHBOARD ================= */
P.dashboard = async () => {
  const d = await api('dashboard');
  main(`${head('Dashboard', 'Welcome to PSU Sales & Inventory System')}
  <div class="grid4">
    <div class="stat"><div class="t">Total Products<span>📦</span></div><div class="v">${d.products}</div><small>Active products in inventory</small></div>
    <div class="stat"><div class="t">Low Stock Alerts<span class="orange">⚠</span></div><div class="v orange">${d.low_stock}</div><small>Products need restocking</small></div>
    <div class="stat"><div class="t">Today's Revenue<span class="green">$</span></div><div class="v green">${money(d.revenue)}</div><small>${d.sales} sales today</small></div>
    <div class="stat"><div class="t">Today's Sales<span class="blue">🛒</span></div><div class="v blue">${d.sales}</div><small>Transactions completed</small></div>
  </div>
  ${d.low_list.length ? `<div class="card" style="border-left:4px solid #ea580c"><h2 class="orange">⚠ Low Stock Notifications</h2>
    ${d.low_list.map(p => `<div class="li"><div><b>${esc(p.name)}</b><p>${esc(p.code)} • Reorder level: ${p.reorder_level}</p></div>
    <div class="r"><span class="badge ${p.stock == 0 ? 'b-out' : 'b-low'}">${p.stock == 0 ? 'Out of stock' : p.stock + ' left'}</span></div></div>`).join('')}</div>` : ''}
  <div class="card"><h2>Recent Sales</h2>${d.recent.length ? d.recent.map(s => `<div class="li"><div><b>${esc(s.receipt_no)}</b><p>${esc(s.cashier)} • ${fmtDate(s.created_at)}</p></div>
    <div class="r"><b class="green">${money(s.total)}</b><p>${s.items.length} items</p></div></div>`).join('') : '<div class="empty">No sales yet</div>'}</div>`);
};

/* ================= POS ================= */
P.pos = async () => {
  S.cart = {};
  main(`${head('Point of Sale', 'Process sales transactions')}
  <div class="pos"><div class="card"><h2>Products</h2><input id="pq" placeholder="🔍  Search products by name, code or category..."><div class="plist" id="pl"></div></div>
  <div class="card" id="cart"></div></div>`);
  const load = safe(async () => { S.products = (await api('products_list', null, '&q=' + encodeURIComponent($('#pq').value))).products; drawPL(); });
  $('#pq').oninput = deb(load); await load(); drawCart();
};
function drawPL() {
  $('#pl').innerHTML = S.products.map(p => `<div class="pitem ${p.stock < 1 ? 'dis' : ''}" data-id="${p.id}"><div><b>${esc(p.name)}</b><br><small>${esc(p.code)} • Stock: ${p.stock}</small></div>
    <div><span class="pr">${money(p.price)}</span><span class="pl">＋</span></div></div>`).join('') || '<div class="empty">No products found</div>';
  document.querySelectorAll('.pitem').forEach(el => el.onclick = () => addCart(+el.dataset.id));
}
function addCart(id) {
  const p = S.products.find(x => x.id == id) || S.cart[id]?.p; if (!p) return;
  const c = S.cart[id] || (S.cart[id] = { p, qty: 0 });
  if (c.qty + 1 > p.stock) return toast('Only ' + p.stock + ' in stock', true);
  c.qty++; drawCart();
}
function drawCart() {
  const items = Object.values(S.cart), sub = items.reduce((a, c) => a + c.p.price * c.qty, 0), n = items.reduce((a, c) => a + c.qty, 0);
  const el = $('#cart');
  if (!items.length) { el.innerHTML = `<h2>🛒 Cart (0)</h2><div class="empty">Cart is empty</div>`; return; }
  const keepPm = $('#pm')?.value || 'Cash', keepRecv = $('#recv')?.value || '';
  el.innerHTML = `<h2>🛒 Cart (${n})</h2>${items.map(c => `<div class="citem"><div class="top"><b>${esc(c.p.name)}</b><span class="red" style="cursor:pointer" data-rm="${c.p.id}">🗑</span></div>
    <p>${money(c.p.price)} each</p><div class="q"><div class="qty"><button data-m="${c.p.id}">−</button><b>${c.qty}</b><button data-a="${c.p.id}">＋</button></div><b>${money(c.p.price * c.qty)}</b></div></div>`).join('')}
    <hr style="border:0;border-top:1px solid #eee;margin:18px 0">
    <div class="tot"><span>Subtotal:</span><span>${money(sub)}</span></div>
    <div class="tot"><span>Tax:</span><span id="tax"></span></div>
    <div class="tot big"><span>Total:</span><span class="green" id="tot"></span></div>
    <label>Payment Method</label><select id="pm">${['Cash','Card','GCash','PayMaya'].map(m => `<option ${m === keepPm ? 'selected' : ''}>${m}</option>`).join('')}</select>
    <div id="cashbox"><label>Amount Received</label><input id="recv" type="number" min="0" step="0.01" placeholder="0.00" value="${esc(keepRecv)}"><div class="tot" style="margin-top:10px"><span>Change:</span><b id="chg">₱0.00</b></div></div>
    <div style="display:flex;gap:10px;margin-top:16px"><button class="btn" id="done" style="flex:1">Complete Sale</button><button class="btn out" id="back">Back</button></div>`;
  const TAX = window.TAX_RATE || 0, tax = sub * TAX, total = sub + tax;
  $('#tax').textContent = money(tax); $('#tot').textContent = money(total);
  const upd = () => { $('#cashbox').style.display = $('#pm').value === 'Cash' ? '' : 'none'; $('#chg').textContent = money(Math.max(0, (+$('#recv').value || 0) - total)); };
  $('#pm').onchange = upd; $('#recv').oninput = upd; upd();
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => addCart(+b.dataset.a));
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const c = S.cart[b.dataset.m]; if (--c.qty < 1) delete S.cart[b.dataset.m]; drawCart(); });
  el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { delete S.cart[b.dataset.rm]; drawCart(); });
  $('#back').onclick = () => { S.cart = {}; drawCart(); };
  $('#done').onclick = safe(async () => {
    const sale = await api('sale_create', { items: items.map(c => ({ id: c.p.id, qty: c.qty })), payment_method: $('#pm').value, amount_received: +$('#recv').value || 0 });
    S.cart = {}; toast('Sale completed: ' + sale.receipt_no); showReceipt(sale, true); P.pos();
  });
}

/* ================= RECEIPTS ================= */
function receiptHTML(s) {
  return `<html><head><title>${esc(s.receipt_no)}</title><style>body{font-family:monospace;width:300px;margin:0 auto;padding:10px;font-size:13px}
  h3,p{text-align:center;margin:2px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}.r{text-align:right}hr{border:0;border-top:1px dashed #000}</style></head><body>
  <h3>${esc(window.STORE || 'Palawan State University')}</h3><p>Sales & Inventory System</p><hr>
  <p>Receipt: ${esc(s.receipt_no)}</p><p>${fmtDate(s.created_at)}</p><p>Cashier: ${esc(s.cashier)}</p><hr>
  <table>${s.items.map(i => `<tr><td colspan="2">${esc(i.name)}</td></tr><tr><td>${i.qty} x ${Number(i.price).toFixed(2)}</td><td class="r">${(i.qty * i.price).toFixed(2)}</td></tr>`).join('')}</table><hr>
  <table><tr><td>Subtotal</td><td class="r">${Number(s.subtotal).toFixed(2)}</td></tr><tr><td>Tax</td><td class="r">${Number(s.tax).toFixed(2)}</td></tr>
  <tr><td><b>TOTAL</b></td><td class="r"><b>${Number(s.total).toFixed(2)}</b></td></tr>
  <tr><td>Payment (${esc(s.payment_method)})</td><td class="r">${Number(s.amount_received).toFixed(2)}</td></tr>
  <tr><td>Change</td><td class="r">${Number(s.change_amount).toFixed(2)}</td></tr></table><hr><p>Thank you!</p></body></html>`;
}
function printReceipt(s) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(f); f.contentDocument.open(); f.contentDocument.write(receiptHTML(s)); f.contentDocument.close();
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 1500); }, 300);
}
function receiptPDF(s) {
  const { jsPDF } = window.jspdf; const h = 90 + s.items.length * 12;
  const d = new jsPDF({ unit: 'mm', format: [80, h] }); let y = 8; const L = (t, x = 5, al = 'left') => d.text(String(t), x, y, { align: al });
  d.setFont('courier', 'bold'); d.setFontSize(11); L('Palawan State University', 40, 'center'); y += 5;
  d.setFont('courier', 'normal'); d.setFontSize(8); L('Sales & Inventory System', 40, 'center'); y += 6;
  L('Receipt: ' + s.receipt_no); y += 4; L(fmtDate(s.created_at)); y += 4; L('Cashier: ' + s.cashier); y += 4; L('-'.repeat(38)); y += 5;
  s.items.forEach(i => { L(i.name); y += 4; L(i.qty + ' x ' + Number(i.price).toFixed(2)); L((i.qty * i.price).toFixed(2), 75, 'right'); y += 5; });
  L('-'.repeat(38)); y += 5;
  [['Subtotal', s.subtotal], ['Tax', s.tax]].forEach(([k, v]) => { L(k); L(Number(v).toFixed(2), 75, 'right'); y += 4; });
  d.setFont('courier', 'bold'); L('TOTAL'); L(Number(s.total).toFixed(2), 75, 'right'); y += 5; d.setFont('courier', 'normal');
  L('Payment method: ' + s.payment_method); y += 4;
  L('Amount received'); L(Number(s.amount_received).toFixed(2), 75, 'right'); y += 4;
  L('Change'); L(Number(s.change_amount).toFixed(2), 75, 'right'); y += 7; L('Thank you!', 40, 'center');
  d.save(s.receipt_no + '.pdf');
}
function showReceipt(s, auto) {
  const m = modal('Receipt', `<div style="border:1px dashed #9ca3af;padding:6px;border-radius:8px"><iframe style="width:100%;height:380px;border:0" id="rf"></iframe></div>
    <div class="mf"><button class="btn out" id="rpdf">⬇ Download PDF</button><button class="btn" id="rprint">🖨 Print Receipt</button></div>`);
  const fr = m.querySelector('#rf'); fr.contentDocument.open(); fr.contentDocument.write(receiptHTML(s)); fr.contentDocument.close();
  m.querySelector('#rpdf').onclick = () => receiptPDF(s); m.querySelector('#rprint').onclick = () => printReceipt(s);
  if (auto) printReceipt(s);   // auto-print
}

/* ================= SALES HISTORY ================= */
P.sales = async () => {
  main(`${head('Sales History', 'View and manage all sales transactions')}
  <div class="card"><input id="q" placeholder="🔍  Search by receipt number, cashier name, or payment method..."></div><div id="list"></div>`);
  const load = safe(async () => {
    const rows = await api('sales_list', null, '&q=' + encodeURIComponent($('#q').value));
    window._sales = rows;
    $('#list').innerHTML = rows.map((s, idx) => `<div class="card sale"><div class="hd"><div><h3 style="font-size:20px">${esc(s.receipt_no)}<span class="badge b-${s.payment_method.toLowerCase()}">${esc(s.payment_method)}</span></h3><p>${fmtDate(s.created_at)}</p></div>
      <div style="text-align:right"><b class="green" style="font-size:26px">${money(s.total)}</b><p>${s.items.length} items<br><small>by ${esc(s.cashier)}</small></p></div></div>
      <div class="items">${s.items.slice(0, 2).map(i => `${esc(i.name)} × ${i.qty}<br>`).join('')}${s.items.length > 2 ? `<a data-x="${idx}">+${s.items.length - 2} more items</a>` : ''}</div>
      <div class="foot"><div class="tot"><span>Subtotal:</span><span>${money(s.subtotal)}</span></div><div class="tot big"><span style="font-size:16px">Total:</span><span class="green">${money(s.total)}</span></div></div>
      <div class="btns"><button class="btn out" data-v="${idx}">👁 View</button><button class="btn out" data-p="${idx}">🖨 Print Receipt</button><button class="btn out" data-d="${idx}">⬇ Download PDF</button></div></div>`).join('') || '<div class="card empty">No sales found</div>';
    document.querySelectorAll('[data-x]').forEach(a => a.onclick = () => showReceipt(rows[a.dataset.x]));
    document.querySelectorAll('[data-v]').forEach(a => a.onclick = () => showReceipt(rows[a.dataset.v]));
    document.querySelectorAll('[data-p]').forEach(a => a.onclick = () => printReceipt(rows[a.dataset.p]));
    document.querySelectorAll('[data-d]').forEach(a => a.onclick = () => receiptPDF(rows[a.dataset.d]));
  });
  $('#q').oninput = deb(load); load();
};

/* ================= PRODUCTS ================= */
P.products = async () => {
  const can = ['admin', 'clerk'].includes(S.user.role);
  main(`${head('Products', 'Manage your inventory', can ? '<button class="btn" id="add">⊕ Add Item</button>' : '')}
  <div class="card row"><input id="q" placeholder="🔍  Search products by name, code or category..."><select id="cat" style="max-width:240px"><option value="">All categories</option></select></div><div class="grid3" id="grid"></div>`);
  const load = safe(async () => {
    const r = await api('products_list', null, '&q=' + encodeURIComponent($('#q').value) + '&category=' + encodeURIComponent($('#cat').value));
    const sel = $('#cat'), cur = sel.value;
    sel.innerHTML = '<option value="">All categories</option>' + r.categories.map(c => `<option ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join('');
    $('#grid').innerHTML = r.products.map(p => `<div class="pcard"><h3>${esc(p.name)}${p.stock == 0 ? '<span class="badge b-out">Out</span>' : p.stock <= p.reorder_level ? '<span class="badge b-low">Low</span>' : ''}</h3><div class="code">${esc(p.code)}</div>
      <div class="kv"><span>Category:</span><span>${esc(p.category)}</span></div><div class="kv"><span>Price:</span><span class="green">${money(p.price)}</span></div>
      <div class="kv"><span>Stock:</span><span>${p.stock} units</span></div><div class="kv"><span>Supplier:</span><span>${esc(p.supplier_name || '—')}</span></div>
      ${can ? `<div class="acts"><button class="btn out sm" data-e="${p.id}">✎ Edit</button><button class="btn out sm red" data-d="${p.id}">🗑 Delete</button></div>` : ''}</div>`).join('') || '<div class="card empty" style="grid-column:1/-1">No products found</div>';
    document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => productForm(r.products.find(x => x.id == b.dataset.e), r.categories));
    document.querySelectorAll('[data-d]').forEach(b => b.onclick = safe(async () => { if (confirm('Delete this product?')) { await api('product_delete', { id: b.dataset.d }); toast('Product deleted'); load(); } }));
    if (can) $('#add').onclick = () => productForm(null, r.categories);
  });
  window._reloadProducts = load;
  $('#q').oninput = deb(load); $('#cat').onchange = load; load();
};
async function productForm(p, cats) {
  const sup = await api('suppliers_list');
  const m = modal(p ? 'Edit Product' : 'Add Item', `${field('f_name', 'Product Name', p?.name)}
    <div class="two"><div>${field('f_code', 'Code (auto if blank)', p?.code)}</div><div><label>Category</label><input id="f_cat" list="cl" value="${esc(p?.category || '')}"><datalist id="cl">${cats.map(c => `<option>${esc(c)}</option>`).join('')}</datalist></div></div>
    <div class="two"><div>${field('f_price', 'Selling Price', p?.price ?? '', 'number', 'step="0.01" min="0"')}</div><div>${field('f_cost', 'Cost Price', p?.cost ?? '', 'number', 'step="0.01" min="0"')}</div></div>
    <div class="two"><div>${field('f_stock', 'Stock', p?.stock ?? 0, 'number', 'min="0"')}</div><div>${field('f_re', 'Reorder Level', p?.reorder_level ?? 10, 'number', 'min="0"')}</div></div>
    <label>Supplier</label><select id="f_sup"><option value="">— None —</option>${sup.map(s => `<option value="${s.id}" ${p?.supplier_id == s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
    <div class="mf"><button class="btn out" id="c">Cancel</button><button class="btn" id="s">Save</button></div>`);
  m.querySelector('#c').onclick = m.close;
  m.querySelector('#s').onclick = safe(async () => {
    const g = id => m.querySelector('#' + id).value;
    await api('product_save', { id: p?.id, name: g('f_name'), code: g('f_code'), category: g('f_cat'), price: g('f_price'), cost: g('f_cost'), stock: g('f_stock'), reorder_level: g('f_re'), supplier_id: g('f_sup') });
    m.close(); toast('Product saved'); window._reloadProducts();
  });
}

/* ================= PURCHASES ================= */
P.purchases = async () => {
  main(`${head('Purchase Orders', 'Manage restocking and purchase orders', '<button class="btn" id="new">＋ New Purchase Order</button>')}<div class="card"><h2>🛍 Purchase History</h2><div id="list"></div></div>`);
  const rows = await api('purchases_list');
  $('#list').innerHTML = rows.map(p => `<div style="border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:14px"><div class="hd" style="display:flex;justify-content:space-between">
    <div><b style="font-size:19px">${esc(p.po_no)}</b><p>${esc(p.supplier)} • ${esc(p.clerk)}</p><p style="font-size:12px">${fmtDate(p.created_at)}</p></div>
    <div style="text-align:right"><b class="green" style="font-size:24px">${money(p.total)}</b><p>${p.items.length} items</p></div></div>
    <hr style="border:0;border-top:1px solid #eee"><b>Items:</b>${p.items.map(i => `<div class="li" style="border:0;padding:6px 0"><span style="color:#6b7280">${esc(i.name)} × ${i.qty}</span><span>${money(i.qty * i.unit_cost)}</span></div>`).join('')}</div>`).join('') || '<div class="empty">No purchase orders yet</div>';
  $('#new').onclick = poForm;
};
async function poForm() {
  const [sup, pr] = await Promise.all([api('suppliers_list'), api('products_list')]);
  if (!sup.length) return toast('Add a supplier first', true);
  const m = modal('New Purchase Order', `<label>Supplier</label><select id="sup">${sup.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
    <label>Items</label><div id="rows"></div><button class="btn out sm" id="addr" style="margin-top:10px">＋ Add item</button>
    <div class="tot big" style="margin-top:18px"><span>Total:</span><span class="green" id="pt">₱0.00</span></div>
    <div class="mf"><button class="btn out" id="c">Cancel</button><button class="btn" id="s">Create Order</button></div>`, { wide: true });
  const opts = pr.products.map(p => `<option value="${p.id}" data-c="${p.cost}">${esc(p.name)} (${esc(p.code)})</option>`).join('');
  const calc = () => { let t = 0; m.querySelectorAll('.pr').forEach(r => t += (+r.querySelector('.q').value || 0) * (+r.querySelector('.c').value || 0)); m.querySelector('#pt').textContent = money(t); };
  const addRow = () => {
    const r = document.createElement('div'); r.className = 'pr two'; r.style.cssText = 'grid-template-columns:2fr 1fr 1fr auto;margin-bottom:8px;align-items:center';
    r.innerHTML = `<select class="p">${opts}</select><input class="q" type="number" min="1" value="1" placeholder="Qty"><input class="c" type="number" min="0" step="0.01" placeholder="Unit cost"><span class="red" style="cursor:pointer">🗑</span>`;
    const sel = r.querySelector('.p'), cost = r.querySelector('.c');
    const setC = () => { cost.value = sel.selectedOptions[0]?.dataset.c || 0; calc(); }; sel.onchange = setC; setC();
    r.querySelector('span').onclick = () => { r.remove(); calc(); }; r.oninput = calc; m.querySelector('#rows').appendChild(r);
  };
  addRow(); m.querySelector('#addr').onclick = addRow; m.querySelector('#c').onclick = m.close;
  m.querySelector('#s').onclick = safe(async () => {
    const items = [...m.querySelectorAll('.pr')].map(r => ({ product_id: r.querySelector('.p').value, qty: r.querySelector('.q').value, unit_cost: r.querySelector('.c').value }));
    await api('purchase_create', { supplier_id: m.querySelector('#sup').value, items }); m.close(); toast('Purchase order created, stock updated'); P.purchases();
  });
}

/* ================= SUPPLIERS ================= */
P.suppliers = async () => {
  main(`${head('Suppliers', 'Manage your suppliers and vendors', '<button class="btn" id="add">＋ Add Supplier</button>')}
  <div class="card"><input id="q" placeholder="🔍  Search suppliers by name or contact person..."></div><div id="list"></div>`);
  const load = safe(async () => {
    const rows = await api('suppliers_list', null, '&q=' + encodeURIComponent($('#q').value));
    $('#list').innerHTML = rows.map(s => `<div class="card"><div style="display:flex;justify-content:space-between"><div style="flex:1"><h2 class="" style="margin-bottom:10px">🏢 ${esc(s.name)}</h2>
      <div class="two" style="grid-template-columns:1fr 1fr 1fr"><div><p>Contact Person:</p><b>${esc(s.contact_person)}</b></div><div><p>Phone:</p><b>${esc(s.phone)}</b></div><div><p>Email:</p><b class="blue">${esc(s.email)}</b></div></div>
      <p style="margin-top:14px">Address:</p><b>${esc(s.address)}</b></div>
      <div style="text-align:right"><p>Total Purchases</p><b class="blue" style="font-size:30px">${s.purchase_count}</b><p>${money(s.purchase_total)}</p></div></div>
      <div class="sale"><div class="btns"><button class="btn out" data-h="${s.id}">🕘 View Transaction History</button><button class="btn out" data-e="${s.id}">✎ Edit</button><button class="btn out red" data-d="${s.id}">🗑 Delete</button></div></div></div>`).join('') || '<div class="card empty">No suppliers found</div>';
    document.querySelectorAll('[data-h]').forEach(b => b.onclick = safe(async () => {
      const s = rows.find(x => x.id == b.dataset.h), h = await api('supplier_history', null, '&id=' + s.id);
      modal('Transactions — ' + esc(s.name), `<div class="srow" style="grid-template-columns:1fr 1fr"><div><small>Purchase count</small><b>${s.purchase_count}</b></div><div><small>Total amount</small><b class="green">${money(s.purchase_total)}</b></div></div>
        ${h.map(p => `<div class="li"><div><b>${esc(p.po_no)}</b><p>${fmtDate(p.created_at)}<br>${p.items.map(i => esc(i.name) + ' × ' + i.qty).join(', ')}</p></div><b class="green">${money(p.total)}</b></div>`).join('') || '<div class="empty">No transactions yet</div>'}`, { wide: true });
    }));
    document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => supForm(rows.find(x => x.id == b.dataset.e)));
    document.querySelectorAll('[data-d]').forEach(b => b.onclick = safe(async () => { if (confirm('Delete this supplier?')) { await api('supplier_delete', { id: b.dataset.d }); load(); } }));
  });
  const supForm = s => {
    const m = modal(s ? 'Edit Supplier' : 'Add Supplier', `${field('n', 'Supplier Name', s?.name)}${field('c', 'Contact Person', s?.contact_person)}<div class="two"><div>${field('p', 'Phone', s?.phone)}</div><div>${field('e', 'Email', s?.email, 'email')}</div></div>${field('a', 'Address', s?.address)}
      <div class="mf"><button class="btn out" id="x">Cancel</button><button class="btn" id="s">Save</button></div>`);
    m.querySelector('#x').onclick = m.close;
    m.querySelector('#s').onclick = safe(async () => { const g = i => m.querySelector('#' + i).value;
      await api('supplier_save', { id: s?.id, name: g('n'), contact_person: g('c'), phone: g('p'), email: g('e'), address: g('a') }); m.close(); toast('Supplier saved'); load(); });
  };
  $('#add').onclick = () => supForm(null); $('#q').oninput = deb(load); load();
};

/* ================= REPORTS ================= */
function exportRows(title, rows, fmt) {
  const name = title.replace(/\W+/g, '_') + '_' + new Date().toISOString().slice(0, 10);
  if (fmt === 'pdf') {
    const { jsPDF } = window.jspdf, d = new jsPDF(); d.setFontSize(15); d.text('Palawan State University', 14, 15); d.setFontSize(11); d.text(title + ' — ' + new Date().toLocaleString(), 14, 22);
    d.autoTable({ startY: 28, head: [rows[0]], body: rows.slice(1) }); d.save(name + '.pdf');
  } else {
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Report'); XLSX.writeFile(wb, name + '.xlsx');
  }
}
const periodBtns = (key, opts) => opts.map(o => `<button class="btn out ${S.rp[key] === o ? 'on' : ''}" data-k="${key}" data-v="${o}">${o[0].toUpperCase() + o.slice(1)}</button>`).join(' ');
const expBtns = id => `<button class="btn out" data-ex="${id}" data-f="pdf">📄 Export as PDF</button> <button class="btn out" data-ex="${id}" data-f="xlsx">⬇ Export as Excel</button>`;
P.reports = async () => {
  const [sa, pl, inv, mv, pay] = await Promise.all([api('report', null, '&type=sales&period=' + S.rp.sales), api('report', null, '&type=pnl&period=' + S.rp.pnl),
    api('report', null, '&type=inventory'), api('report', null, '&type=movers&period=' + S.rp.mov), api('report', null, '&type=payments&period=' + S.rp.pay)]);
  const stat = (l, v, c = '') => `<div><small>${l}</small><b class="${c}">${v}</b></div>`;
  main(`${head('Reports & Analytics', 'View business insights and performance metrics')}
  <div class="card"><div style="display:flex;justify-content:space-between"><h2>📊 Sales Summary</h2><div>${periodBtns('sales', ['today', 'week', 'month'])}</div></div>
    <div class="srow">${stat('Total Revenue', money(sa.revenue), 'green')}${stat('Total Sales', sa.sales)}${stat('Items Sold', sa.items)}${stat('Average Sale', money(sa.average))}</div>${expBtns('sales')}</div>
  <div class="card"><div style="display:flex;justify-content:space-between"><h2>$ Profit & Loss Summary</h2><div>${periodBtns('pnl', ['week', 'month'])}</div></div>
    <div class="srow">${stat('Revenue', money(pl.revenue), 'green')}${stat('Cost', money(pl.cost), 'red')}${stat('Gross Profit', money(pl.profit), 'green')}${stat('Profit Margin', pl.margin.toFixed(2) + '%', 'green')}</div>${expBtns('pnl')}</div>
  <div class="card"><div style="display:flex;justify-content:space-between"><h2>📦 Inventory Status</h2><div>${expBtns('inv').replace('Export as ', 'Export ')}</div></div>
    <div class="srow">${stat('Total Products', inv.total)}${stat('Low Stock', inv.low, 'orange')}${stat('Out of Stock', inv.out, 'red')}${stat('Inventory Value', money(inv.value))}</div></div>
  <div class="card"><div style="display:flex;justify-content:space-between"><h2>🚀 Fast & Slow-Moving Products</h2><div>${periodBtns('mov', ['week', 'month'])}</div></div>
    <div class="two" style="gap:30px"><div><h3 class="green">Fast-moving (top 5)</h3><table class="tbl"><tr><th>Product</th><th>Qty</th><th>Revenue</th></tr>${mv.fast.map(r => `<tr><td>${esc(r.name)}</td><td>${r.qty}</td><td>${money(r.revenue)}</td></tr>`).join('') || '<tr><td colspan=3>No sales in period</td></tr>'}</table></div>
    <div><h3 class="orange">Slow-moving (bottom 5)</h3><table class="tbl"><tr><th>Product</th><th>Sold</th><th>Stock</th></tr>${mv.slow.map(r => `<tr><td>${esc(r.name)}</td><td>${r.qty}</td><td>${r.stock}</td></tr>`).join('')}</table></div></div><div style="margin-top:14px">${expBtns('mov')}</div></div>
  <div class="card"><div style="display:flex;justify-content:space-between"><h2>💳 Payment Method Analytics</h2><div>${periodBtns('pay', ['today', 'week', 'month'])}</div></div>
    <table class="tbl"><tr><th>Method</th><th>Transactions</th><th>Total</th></tr>${pay.map(r => `<tr><td><span class="badge b-${r.payment_method.toLowerCase()}" style="margin:0">${esc(r.payment_method)}</span></td><td>${r.count}</td><td>${money(r.total)}</td></tr>`).join('') || '<tr><td colspan=3>No transactions in period</td></tr>'}</table><div style="margin-top:14px">${expBtns('pay')}</div></div>`);
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { S.rp[b.dataset.k] = b.dataset.v; P.reports(); });
  const data = {
    sales: ['Sales Summary (' + S.rp.sales + ')', [['Metric', 'Value'], ['Total Revenue', pdfMoney(sa.revenue)], ['Total Sales', sa.sales], ['Items Sold', sa.items], ['Average Sale', pdfMoney(sa.average)]]],
    pnl: ['Profit and Loss (' + S.rp.pnl + ')', [['Metric', 'Value'], ['Revenue', pdfMoney(pl.revenue)], ['Cost', pdfMoney(pl.cost)], ['Gross Profit', pdfMoney(pl.profit)], ['Profit Margin', pl.margin.toFixed(2) + '%']]],
    inv: ['Inventory Status', [['Code', 'Product', 'Category', 'Stock', 'Reorder', 'Status'], ...inv.rows.map(r => [r.code, r.name, r.category, r.stock, r.reorder_level, r.stock == 0 ? 'Out' : r.stock <= r.reorder_level ? 'Low' : 'OK'])]],
    mov: ['Fast and Slow Moving (' + S.rp.mov + ')', [['Type', 'Product', 'Qty sold'], ...mv.fast.map(r => ['Fast', r.name, r.qty]), ...mv.slow.map(r => ['Slow', r.name, r.qty])]],
    pay: ['Payment Methods (' + S.rp.pay + ')', [['Method', 'Transactions', 'Total'], ...pay.map(r => [r.payment_method, r.count, pdfMoney(r.total)])]],
  };
  document.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => exportRows(data[b.dataset.ex][0], data[b.dataset.ex][1], b.dataset.f));
};

/* ================= USERS ================= */
P.users = async () => {
  main(`${head('User Management', 'Manage system users and their roles', '<button class="btn" id="add">＋ Add User</button>')}
  <div class="card"><input id="q" placeholder="🔍  Search by name, username, or role..."></div><div class="card"><h2 id="cnt"></h2><div id="list"></div></div>`);
  const roleLbl = { admin: 'Admin', cashier: 'Cashier', clerk: 'Inventory Clerk' };
  const load = safe(async () => {
    const rows = await api('users_list', null, '&q=' + encodeURIComponent($('#q').value));
    $('#cnt').textContent = '👥 Users (' + rows.length + ')';
    $('#list').innerHTML = rows.map(u => `<div class="urow ${u.active == 1 ? '' : 'off'}"><div class="av2">👤</div><div class="grow"><b style="font-size:17px">${esc(u.name)}</b><p>@${esc(u.username)}</p></div>
      <span class="badge b-${u.role}">${roleLbl[u.role]}</span><button class="btn out" data-t="${u.id}">${u.active == 1 ? 'Deactivate' : 'Activate'}</button><button class="btn out" data-e="${u.id}">✎</button><button class="btn out red" data-d="${u.id}">🗑</button></div>`).join('');
    document.querySelectorAll('[data-t]').forEach(b => b.onclick = safe(async () => { await api('user_toggle', { id: b.dataset.t }); load(); }));
    document.querySelectorAll('[data-d]').forEach(b => b.onclick = safe(async () => { if (confirm('Delete this user?')) { await api('user_delete', { id: b.dataset.d }); load(); } }));
    document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => form(rows.find(x => x.id == b.dataset.e)));
  });
  const form = u => {
    const m = modal(u ? 'Edit User' : 'Add User', `${field('n', 'Full Name', u?.name)}${field('un', 'Username', u?.username)}${field('pw', u ? 'New Password (leave blank to keep)' : 'Password (min 6 chars)', '', 'password')}
      <label>Role</label><select id="r">${[['admin', 'Admin'], ['cashier', 'Cashier'], ['clerk', 'Inventory Clerk']].map(([v, l]) => `<option value="${v}" ${u?.role === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="mf"><button class="btn out" id="x">Cancel</button><button class="btn" id="s">Save</button></div>`);
    m.querySelector('#x').onclick = m.close;
    m.querySelector('#s').onclick = safe(async () => { const g = i => m.querySelector('#' + i).value;
      await api('user_save', { id: u?.id, name: g('n'), username: g('un'), password: g('pw'), role: g('r') }); m.close(); toast('User saved'); load(); });
  };
  $('#add').onclick = () => form(null); $('#q').oninput = deb(load); load();
};

/* ================= SETTINGS / BACKUP ================= */
const today = () => new Date().toISOString().slice(0, 10);
function downloadBackup() { const a = document.createElement('a'); a.href = 'api.php?action=backup'; a.click(); localStorage.setItem('psu_last_backup', new Date().toLocaleString('en-US')); localStorage.setItem('psu_last_backup_day', today()); }
function autoBackup() { if (localStorage.getItem('psu_last_backup_day') !== today()) setTimeout(downloadBackup, 1500); }
P.settings = async () => {
  main(`${head('System Settings', 'Manage database backups and system security')}
  <div class="card"><h2>🗄 Backup Status</h2><div class="okbox"><div><b>Last backup: ${esc(localStorage.getItem('psu_last_backup') || 'Never')}</b><br><small>Automated daily backups: Enabled</small></div><span class="btn out" style="color:#16a34a;border-color:#16a34a">Enabled</span></div>
    <div class="info"><b>📅 Automated Daily Backups Active</b><br>The system automatically creates a backup once per day (when an admin signs in). Backups are downloaded to your default download folder.</div></div>
  <div class="card"><h2>🗄 Manual Backup & Restore</h2><b>Create Backup Now</b><p>Download a complete backup of your database. This includes all sales, products, purchases, suppliers, and users. Store this file in a safe location.</p>
    <button class="btn" id="bk" style="margin:10px 0 24px">⬇ Download Database Backup</button><hr style="border:0;border-top:1px solid #eee">
    <h3 class="orange" style="margin:20px 0 10px">⬆ Restore Backup</h3><div class="warn"><b>⚠ Warning: Destructive Action</b><br>Restoring a backup will <b>permanently replace</b> all current data in the system. This action cannot be undone. Make sure you have a recent backup before proceeding.</div>
    <input type="file" id="rf" accept=".sql" style="margin-top:14px"><button class="btn" id="rs" style="margin-top:12px;background:#ea580c">Restore from File</button></div>`);
  $('#bk').onclick = () => { downloadBackup(); setTimeout(P.settings, 300); };
  $('#rs').onclick = safe(async () => {
    const f = $('#rf').files[0]; if (!f) return toast('Choose a .sql backup file first', true);
    if (!confirm('This will REPLACE all current data. Continue?')) return;
    await api('restore', { sql: await f.text() }); alert('Restore complete. Please sign in again.'); location.reload();
  });
};

init();
