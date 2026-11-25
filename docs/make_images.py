import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt, textwrap
from matplotlib.patches import FancyBboxPatch

# ---------------- Business rules table ----------------
rules = [
 ("BR1","Stock can never be negative","CHECK  ck_products_stock","products"),
 ("BR2","Price, cost and reorder level cannot be negative","CHECK  ck_products_price / cost / reorder","products"),
 ("BR3","Product code, supplier name and username are unique","UNIQUE  uq_products_code / uq_suppliers_name / uq_users_username","products, suppliers, users"),
 ("BR4","Passwords must be stored as bcrypt hashes (never plain text)","CHECK  ck_users_password_hashed","users"),
 ("BR5","Only 4 payment methods: Cash, Card, GCash, PayMaya","CHECK  ck_sales_payment","sales"),
 ("BR6","Total must equal subtotal + tax; subtotal must be > 0","CHECK  ck_sales_amounts","sales"),
 ("BR7","Cash payments must cover the total amount","CHECK  ck_sales_cash","sales"),
 ("BR8","Item quantities must be greater than zero","CHECK  ck_si_qty / ck_pi_qty","sale_items, purchase_items"),
 ("BR9","Cannot sell more than the stock on hand, or an inactive product","TRIGGER  trg_sale_items_bi","sale_items"),
 ("BR10","Stock is reduced automatically after a sale line is saved","TRIGGER  trg_sale_items_ai","sale_items -> products"),
 ("BR11","Stock is increased automatically after a purchase line is saved","TRIGGER  trg_purchase_items_ai","purchase_items -> products"),
 ("BR12","Only ACTIVE admin/cashier accounts can record sales","TRIGGER  trg_sales_bi","sales"),
 ("BR13","Only ACTIVE admin/clerk accounts can create purchase orders","TRIGGER  trg_purchases_bi","purchases"),
 ("BR14","Sales and purchase orders are permanent (cannot be deleted)","TRIGGER  trg_sales_bd / trg_purchases_bd","sales, purchases"),
 ("BR15","A product with sales/purchase history cannot be hard-deleted","FOREIGN KEY  fk_si_product / fk_pi_product (RESTRICT)","products"),
 ("BR16","Every sale needs a valid user; every PO a valid supplier and user","FOREIGN KEY  fk_sales_user / fk_po_supplier / fk_po_user","sales, purchases"),
]
fig, ax = plt.subplots(figsize=(16, 12)); ax.axis('off')
ax.set_title("PSU Sales & Inventory System - Business Rules Enforced in the Database", fontsize=17, fontweight='bold', pad=14)
cols = ["ID", "Business rule", "Enforced by (constraint / trigger)", "Table(s)"]
wrapped = [(a, textwrap.fill(b, 46), textwrap.fill(c, 50), textwrap.fill(d, 24)) for a, b, c, d in rules]
tbl = ax.table(cellText=wrapped, colLabels=cols, loc='center', cellLoc='left', colWidths=[0.05, 0.35, 0.38, 0.22])
tbl.auto_set_font_size(False); tbl.set_fontsize(10.5); tbl.scale(1, 3.1)
for (r, c), cell in tbl.get_celld().items():
    cell.set_edgecolor('#cbd5e1')
    if r == 0: cell.set_facecolor('#1e3a8a'); cell.set_text_props(color='white', fontweight='bold')
    else:
        kind = rules[r-1][2].split()[0]
        cell.set_facecolor({'CHECK':'#fef3c7','UNIQUE':'#e0e7ff','TRIGGER':'#dcfce7','FOREIGN':'#fce7f3'}[kind] if c == 2 else ('#f8fafc' if r % 2 else 'white'))
plt.savefig('Business_Rules.png', dpi=140, bbox_inches='tight', facecolor='white'); plt.close()

# ---------------- Sequence diagrams ----------------
def seq(fname, title, actors, msgs, note=None):
    n = len(actors); W = 3.3 * n; H = 0.72 * (len(msgs) + 3)
    fig, ax = plt.subplots(figsize=(W, H)); ax.set_xlim(0, n); ax.set_ylim(-len(msgs) - 1.3, 1.4); ax.axis('off')
    ax.set_title(title, fontsize=15, fontweight='bold', pad=8)
    xs = {a: i + 0.5 for i, a in enumerate(actors)}
    for a, x in xs.items():
        ax.add_patch(FancyBboxPatch((x - 0.38, 0.55), 0.76, 0.55, boxstyle="round,pad=0.02", fc='#1e3a8a', ec='none'))
        ax.text(x, 0.82, a, ha='center', va='center', color='white', fontsize=10.5, fontweight='bold')
        ax.plot([x, x], [0.55, -len(msgs) - 0.9], color='#94a3b8', lw=1, ls=(0, (4, 3)))
    y = 0
    for m in msgs:
        kind = m[0]
        if kind == 'sep':
            ax.plot([0.05, n - 0.05], [y - 0.45, y - 0.45], color='#dc2626', lw=1, ls=':'); ax.text(0.08, y - 0.28, m[1], color='#dc2626', fontsize=9.5, fontweight='bold', va='center')
            y -= 1; continue
        _, a, b, text = m[:4]; dashed = (kind == 'ret'); color = '#15803d' if dashed else '#0f172a'
        if a == b:
            x = xs[a]; ax.annotate('', xy=(x + 0.02, y - 0.38), xytext=(x + 0.02, y - 0.05), arrowprops=dict(arrowstyle='-|>', color=color, lw=1.2, connectionstyle='arc3,rad=-1.3'))
            ax.text(x + 0.2, y - 0.2, text, fontsize=9, va='center', ha='left', color=color)
        else:
            ax.annotate('', xy=(xs[b], y - 0.1), xytext=(xs[a], y - 0.1), arrowprops=dict(arrowstyle='-|>', color=color, lw=1.4, ls='--' if dashed else '-'))
            ax.text((xs[a] + xs[b]) / 2, y + 0.06, text, fontsize=9, ha='center', va='bottom', color=color)
        y -= 1
    if note: ax.text(0.02, -len(msgs) - 1.2, note, fontsize=9, color='#475569', style='italic')
    plt.savefig(fname, dpi=140, bbox_inches='tight', facecolor='white'); plt.close()

seq('Sequence_Sale.png', 'Sequence Diagram 1 - Process a Sale (POS)',
    ['Cashier', 'Browser (HTML/JS)', 'PHP API (api.php)', 'MySQL database'],
    [('msg','Cashier','Browser (HTML/JS)','add items, choose payment, click Complete Sale'),
     ('msg','Browser (HTML/JS)','PHP API (api.php)','POST sale_create {items, payment}'),
     ('self','PHP API (api.php)','PHP API (api.php)','check session + role (admin/cashier)'),
     ('msg','PHP API (api.php)','MySQL database','START TRANSACTION'),
     ('msg','PHP API (api.php)','MySQL database','SELECT product ... FOR UPDATE (lock rows)'),
     ('msg','PHP API (api.php)','MySQL database','INSERT sales   (trigger trg_sales_bi checks user)'),
     ('msg','PHP API (api.php)','MySQL database','INSERT sale_items (trg_sale_items_bi: stock OK?)'),
     ('self','MySQL database','MySQL database','trg_sale_items_ai: stock = stock - qty'),
     ('msg','PHP API (api.php)','MySQL database','COMMIT'),
     ('ret','MySQL database','PHP API (api.php)','OK'),
     ('ret','PHP API (api.php)','Browser (HTML/JS)','sale JSON (receipt no, total, change)'),
     ('ret','Browser (HTML/JS)','Cashier','show receipt + auto-print / PDF'),
     ('sep','If any rule fails (e.g. insufficient stock, CHECK violated):'),
     ('ret','MySQL database','PHP API (api.php)','ERROR (SIGNAL / CHECK failed)'),
     ('msg','PHP API (api.php)','MySQL database','ROLLBACK  (nothing is saved)'),
     ('ret','PHP API (api.php)','Browser (HTML/JS)','error message -> shown to cashier')])

seq('Sequence_Restock.png', 'Sequence Diagram 2 - Restock with a Purchase Order',
    ['Inventory Clerk', 'Browser (HTML/JS)', 'PHP API (api.php)', 'MySQL database'],
    [('msg','Inventory Clerk','Browser (HTML/JS)','New Purchase Order: supplier + items + unit cost'),
     ('msg','Browser (HTML/JS)','PHP API (api.php)','POST purchase_create'),
     ('self','PHP API (api.php)','PHP API (api.php)','check session + role (admin/clerk)'),
     ('msg','PHP API (api.php)','MySQL database','START TRANSACTION'),
     ('msg','PHP API (api.php)','MySQL database','INSERT purchases (trg_purchases_bi checks user role)'),
     ('msg','PHP API (api.php)','MySQL database','INSERT purchase_items (one per product)'),
     ('self','MySQL database','MySQL database','trg_purchase_items_ai: stock = stock + qty'),
     ('msg','PHP API (api.php)','MySQL database','UPDATE products SET cost, supplier_id'),
     ('msg','PHP API (api.php)','MySQL database','COMMIT'),
     ('ret','PHP API (api.php)','Browser (HTML/JS)','purchase JSON (PO number, total)'),
     ('ret','Browser (HTML/JS)','Inventory Clerk','PO saved, stock updated; low-stock alert clears')])

seq('Sequence_Login_Reports.png', 'Sequence Diagram 3 - Login and Role-Based Access / Reports',
    ['User', 'Browser (HTML/JS)', 'PHP API (api.php)', 'MySQL database'],
    [('msg','User','Browser (HTML/JS)','enter username + password'),
     ('msg','Browser (HTML/JS)','PHP API (api.php)','POST login'),
     ('msg','PHP API (api.php)','MySQL database','SELECT * FROM users WHERE username = ?'),
     ('ret','MySQL database','PHP API (api.php)','user row (bcrypt hash, role, active)'),
     ('self','PHP API (api.php)','PHP API (api.php)','password_verify() + active check; start session'),
     ('ret','PHP API (api.php)','Browser (HTML/JS)','user + role  ->  menu built for that role'),
     ('msg','Browser (HTML/JS)','PHP API (api.php)','GET dashboard / report (admin only)'),
     ('msg','PHP API (api.php)','MySQL database','SELECT ... FROM v_low_stock; JOIN / GROUP BY ... HAVING'),
     ('ret','MySQL database','PHP API (api.php)','result rows'),
     ('ret','PHP API (api.php)','Browser (HTML/JS)','JSON  ->  cards, tables, PDF / Excel export')])
print('images done')
