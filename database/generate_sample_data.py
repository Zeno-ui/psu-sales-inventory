"""Generates database/02_sample_data.sql (deterministic: same seed = same data).
Usage: python generate_sample_data.py     (needs: pip install bcrypt)"""
import random, math, datetime as dt, bcrypt
random.seed(2026)
def q(v):
    if v is None: return 'NULL'
    if isinstance(v, (int, float)): return f'{v:.2f}' if isinstance(v, float) else str(v)
    return "'" + str(v).replace("\\", "\\\\").replace("'", "''") + "'"
def insert(table, cols, rows):
    out = [f"INSERT INTO {table} ({', '.join(cols)}) VALUES"]
    out.append(",\n".join("  (" + ", ".join(q(x) for x in r) + ")" for r in rows) + ";")
    return "\n".join(out)
def h(pw): return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(10)).decode().replace('$2b$', '$2y$', 1)

# ---------------- USERS (40) ----------------
first = "Maria Juan Jose Ana Pedro Rosa Carlo Liza Mark Grace Paolo Jenny Ryan Kath Miguel Angel Joy Ben Cathy Dan Elena Fred Gina Hugo Ivy Jon Kim Leo Mia Noel Olga Pat Quin Rey Sara Tom Una Vic Wen Yna".split()
last = "Santos Reyes Cruz Bautista Garcia Mendoza Torres Flores Ramos Aquino Castro Rivera Navarro Domingo Salazar Soriano Valdez Pascual Villanueva Manalo Gutierrez Aguilar Dela-Cruz Lim Tan Sy Go Uy Ong Co Yap Chua Abad Bernal Cabrera Dizon Estrada Fajardo Galang Hidalgo".split()
pw_admin, pw_cash, pw_clerk, pw_other = h('admin123'), h('cashier123'), h('clerk123'), h('password123')
users = [(1,'Admin','admin',pw_admin,'admin',1,'2026-01-05 08:00:00'),
         (2,'Cashier','cashier',pw_cash,'cashier',1,'2026-01-05 08:01:00'),
         (3,'Clerk','clerk',pw_clerk,'clerk',1,'2026-01-05 08:02:00')]
used = {'admin','cashier','clerk'}
for i in range(4, 41):
    n = f"{first[i-4]} {last[i-4].replace('-', ' ')}"
    un = f"{first[i-4].lower()}.{last[i-4].lower().replace('-','')}"
    role = 'admin' if i in (4,5) else 'cashier' if i <= 22 else 'clerk'
    if i in (38,40): role = 'cashier'
    if i == 39: role = 'clerk'
    active = 0 if i >= 38 else 1
    users.append((i, n, un, pw_other, role, active, f"2026-0{random.randint(1,3)}-{random.randint(10,28)} 09:00:00"))
sellers = [u[0] for u in users if u[4] in ('admin','cashier') and u[5] == 1]
buyers  = [u[0] for u in users if u[4] in ('admin','clerk') and u[5] == 1]

# ---------------- SUPPLIERS (40) ----------------
pre = "Palawan Island Coral Manila Cebu Luzon Visayas Mindoro Davao Iloilo Bicol Tagbilaran Subic Clark Cavite Laguna Batangas Pampanga Zambales Bohol".split()
suf = ["Office Mart","School Depot","Paper Works","Gadget Hub","Trading Co.","Enterprises","Distributors","Wholesale","Supply Center","Stationers"]
towns = ["Puerto Princesa City","Narra","Quezon","Brooke's Point","El Nido","Coron","Taytay","Roxas","San Vicente","Aborlan","Sofronio Espanola","Rizal","Bataraza","Balabac","Culion","Dumaran"]
cont = [f"{a} {b}" for a, b in zip(random.sample(first, 30), random.sample(last, 30))]
suppliers = [(1,'Tech Supplies Inc.','John Doe','+63 917 123 4567','john@techsupplies.com','Puerto Princesa City, Palawan','2026-01-10 09:00:00')]
names = set(['Tech Supplies Inc.'])
sid = 2
while sid <= 40:
    nm = f"{random.choice(pre)} {random.choice(suf)}"
    if nm in names: continue
    names.add(nm); p = random.choice(cont).replace('-', ' ')
    slug = nm.lower().replace(' ', '').replace('.', '')
    suppliers.append((sid, nm, p, f"+63 9{random.randint(10,99)} {random.randint(100,999)} {random.randint(1000,9999)}",
                      f"{p.split()[0].lower()}@{slug}.com", f"{random.choice(towns)}, Palawan", f"2026-01-{random.randint(10,28)} 09:00:00"))
    sid += 1

# ---------------- PRODUCTS (45) ----------------
P = [("Ballpen (Blue)","Stationery",10,6),("Ballpen (Black)","Stationery",10,6),("Notebook A4","Stationery",45,30),("Pencil #2","Stationery",8,4),
("Eraser","Stationery",5,2.5),("Ruler 30cm","Stationery",15,8),("Highlighter","Stationery",25,14),("Correction Tape","Stationery",35,20),
("Sticky Notes","Stationery",40,22),("Scissors","Stationery",55,32),("Glue Stick","Stationery",25,13),("Marker Pen","Stationery",30,17),
("Computer Mouse","Electronics",350,250),("Keyboard","Electronics",650,450),("USB Flash Drive 16GB","Electronics",280,190),("USB Flash Drive 32GB","Electronics",380,260),
("Earphones","Electronics",220,140),("HDMI Cable 1.5m","Electronics",190,110),("Webcam","Electronics",1200,850),("Power Bank 10000mAh","Electronics",850,600),
("Scientific Calculator","Electronics",520,380),("Extension Cord 4-Gang","Electronics",320,210),("Universal Laptop Charger","Electronics",900,640),("Bluetooth Speaker","Electronics",780,540),
("Bond Paper A4 (500 sheets)","Office Supplies",260,210),("Bond Paper Long (500 sheets)","Office Supplies",290,235),("Folder Long (10 pcs)","Office Supplies",90,60),("Stapler","Office Supplies",120,75),
("Staple Wire #35","Office Supplies",25,14),("Paper Clips Box","Office Supplies",30,16),("2-Hole Puncher","Office Supplies",150,95),("Envelope Long (50 pcs)","Office Supplies",110,70),
("Packing Tape","Office Supplies",45,25),("Whiteboard Marker Set","Office Supplies",140,90),("Ink Cartridge Black","Office Supplies",650,470),("Clipboard","Office Supplies",60,35),
("Backpack","School Supplies",780,520),("Lunch Box","School Supplies",180,110),("Water Bottle","School Supplies",250,150),("Crayons 24 Colors","School Supplies",85,52),
("Colored Pencils 12 pcs","School Supplies",95,60),("Watercolor Set","School Supplies",150,95),("Pad Paper","School Supplies",50,30),("Index Cards","School Supplies",35,20),("Ring Binder","School Supplies",120,75)]
sup_of = {i: random.randint(1, 15) for i in range(1, 46)}   # products are supplied by suppliers 1..15
sup_of[1] = sup_of[3] = sup_of[13] = 1
reserved = {2: 0, 14: 0, 20: 3, 28: 5, 36: 2, 41: 7}           # product id -> intended final stock (low / out of stock)
reorder = {i: (5 if P[i-1][1] == 'Electronics' else random.choice([10, 15, 20, 30])) for i in range(1, 46)}
prod = {i: dict(name=P[i-1][0], cat=P[i-1][1], price=float(P[i-1][2]), cost=float(P[i-1][3])) for i in range(1, 46)}

# ---------------- PURCHASES (40) / ITEMS (45) ----------------
def when(day0, day1, ordered_i, n):
    d0 = dt.datetime.fromisoformat(day0); span = (dt.datetime.fromisoformat(day1) - d0).total_seconds()
    base = d0 + dt.timedelta(seconds=span * ordered_i / n)
    return base.replace(hour=random.randint(8, 16), minute=random.randint(0, 59), second=random.randint(0, 59))
buyable = [i for i in prod if i not in reserved]
purchases, pitems, bought = [], [], {i: 0 for i in prod}
two_item = set(random.sample(range(1, 41), 5)); iid = 1
for n in range(1, 41):
    p1 = random.choice(buyable); sup = sup_of[p1]; lines = [p1]
    if n in two_item:
        mates = [x for x in buyable if sup_of[x] == sup and x != p1]
        lines += [random.choice(mates)] if mates else [random.choice([x for x in buyable if x != p1])]
    ts = when('2026-09-01', '2026-11-20', n, 40); tot = 0
    for p in lines:
        qty = random.choice([20, 50, 100, 150, 200]) if prod[p]['cat'] != 'Electronics' else random.choice([5, 10, 15, 20, 30])
        uc = prod[p]['cost']; tot += qty * uc; bought[p] += qty
        pitems.append((iid, n, p, prod[p]['name'], qty, uc)); iid += 1
    purchases.append((n, f"PO-{ts:%Y%m%d}-{n:04d}", sup if n not in two_item else sup_of[lines[0]], random.choice(buyers), tot, ts.strftime('%Y-%m-%d %H:%M:%S')))
assert len(pitems) == 45

# ---------------- SALES (40) / ITEMS (45) ----------------
weights = [6 if prod[i]['cat'] in ('Stationery', 'School Supplies') else 2 for i in prod]
sales, sitems, sold = [], [], {i: 0 for i in prod}
two_item = set(random.sample(range(1, 41), 5)); iid = 1
pm_pool = ['Cash'] * 20 + ['GCash'] * 10 + ['Card'] * 6 + ['PayMaya'] * 4; random.shuffle(pm_pool)
for n in range(1, 41):
    ids = random.choices(list(prod), weights=weights, k=1)
    if n in two_item:
        x = ids[0]
        while x == ids[0]: x = random.choices(list(prod), weights=weights, k=1)[0]
        ids.append(x)
    ts = when('2026-10-01', '2026-11-24', n, 40) if n <= 36 else dt.datetime(2026, 11, 25, random.randint(8, 15), random.randint(0, 59), random.randint(0, 59))
    sub = 0; rows = []
    for p in ids:
        qty = random.randint(1, 6) if prod[p]['cat'] != 'Electronics' else random.randint(1, 2)
        sub += qty * prod[p]['price']; sold[p] += qty
        rows.append((iid, n, p, prod[p]['name'], qty, prod[p]['price'], prod[p]['cost'])); iid += 1
    sitems += rows
    pm = pm_pool[n-1]; recv = math.ceil(sub / 50) * 50 if pm == 'Cash' else sub
    sales.append((n, f"SALE-{ts:%Y%m%d}-{n:04d}", random.choice(sellers), sub, 0.0, sub, pm, float(recv), float(recv - sub), ts.strftime('%Y-%m-%d %H:%M:%S')))
sitems = [r for r in sitems]
assert len(sitems) == 45, len(sitems)
# opening stock so that (opening + purchased - sold) = intended final stock; triggers apply the movements
products = []
for i in prod:
    final = reserved[i] if i in reserved else random.randint(25, 180)
    opening = max(0, final + sold[i] - bought[i])
    products.append((i, f"PROD-{i:03d}", prod[i]['name'], prod[i]['cat'], prod[i]['price'], prod[i]['cost'], opening, reorder[i], sup_of[i], 1, '2026-01-15 10:00:00'))

hdr = "-- PSU Sales & Inventory - SAMPLE DATA (generated by generate_sample_data.py)\n-- Run AFTER 01_schema.sql. Stock changes are applied by the database triggers.\n-- Logins: admin/admin123, cashier/cashier123, clerk/clerk123 (all other users: password123)\nUSE psu_inventory;\n\n"
sql = hdr + "\n\n".join([
 insert('users', ['id','name','username','password','role','active','created_at'], users),
 insert('suppliers', ['id','name','contact_person','phone','email','address','created_at'], suppliers),
 insert('products', ['id','code','name','category','price','cost','stock','reorder_level','supplier_id','active','created_at'], products),
 insert('purchases', ['id','po_no','supplier_id','user_id','total','created_at'], purchases),
 insert('purchase_items', ['id','purchase_id','product_id','name','qty','unit_cost'], pitems),
 insert('sales', ['id','receipt_no','user_id','subtotal','tax','total','payment_method','amount_received','change_amount','created_at'], sales),
 insert('sale_items', ['id','sale_id','product_id','name','qty','price','cost'], sitems)]) + "\n"
open('02_sample_data.sql', 'w', encoding='utf-8').write(sql)
print({'users': len(users), 'suppliers': len(suppliers), 'products': len(products), 'purchases': len(purchases), 'purchase_items': len(pitems), 'sales': len(sales), 'sale_items': len(sitems)})
