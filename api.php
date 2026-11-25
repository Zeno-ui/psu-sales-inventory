<?php
require 'config.php';
session_start();

$action = $_GET['action'] ?? '';
$in = json_decode(file_get_contents('php://input'), true) ?: [];

function out($d, $c = 200) { http_response_code($c); header('Content-Type: application/json'); echo json_encode($d); exit; }
function need(...$roles) {
    if (empty($_SESSION['u'])) out(['error' => 'Not logged in'], 401);
    if ($roles && !in_array($_SESSION['u']['role'], $roles)) out(['error' => 'You do not have permission'], 403);
}
function periodCond($p, $col) {
    if ($p === 'today') return "DATE($col)=CURDATE()";
    if ($p === 'week')  return "YEARWEEK($col,1)=YEARWEEK(CURDATE(),1)";
    return "DATE_FORMAT($col,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')";
}
function getSale($id) {
    $s = db()->prepare("SELECT s.*, u.name AS cashier FROM sales s JOIN users u ON u.id=s.user_id WHERE s.id=?");
    $s->execute([$id]); $sale = $s->fetch();
    if (!$sale) return null;
    $i = db()->prepare("SELECT name,qty,price FROM sale_items WHERE sale_id=?");
    $i->execute([$id]); $sale['items'] = $i->fetchAll();
    return $sale;
}
function salesList($q = '', $limit = 200) {
    $like = "%$q%";
    $st = db()->prepare("SELECT s.id FROM sales s JOIN users u ON u.id=s.user_id
        WHERE s.receipt_no LIKE ? OR u.name LIKE ? OR s.payment_method LIKE ? ORDER BY s.id DESC LIMIT " . (int)$limit);
    $st->execute([$like, $like, $like]);
    return array_map('getSale', $st->fetchAll(PDO::FETCH_COLUMN));
}
function nextCode($prefix, $id, $dated = true) {
    return $prefix . '-' . ($dated ? date('Ymd') . '-' : '') . str_pad($id, 4, '0', STR_PAD_LEFT);
}
function oneLine($sql) { return str_replace(["\r", "\n"], ' ', preg_replace('/DEFINER=`[^`]*`@`[^`]*`\s*/', '', $sql)); }
function dumpSql() {
    $pdo = db(); $o = "-- PSU Sales & Inventory backup " . date('c') . "\nSET FOREIGN_KEY_CHECKS=0;\n";
    $tables = ['users','suppliers','products','sales','sale_items','purchases','purchase_items'];
    $views  = ['v_low_stock','v_sales_detail','v_product_performance'];
    foreach ($views as $v) $o .= "DROP VIEW IF EXISTS `$v`;\n";
    foreach (array_reverse($tables) as $t) $o .= "DROP TABLE IF EXISTS `$t`;\n";
    foreach ($tables as $t) {
        $create = $pdo->query("SHOW CREATE TABLE `$t`")->fetch(PDO::FETCH_NUM)[1];
        $o .= oneLine($create) . ";\n";
        foreach ($pdo->query("SELECT * FROM `$t`") as $r) {
            $vals = array_map(function ($v) use ($pdo) {
                if ($v === null) return 'NULL';
                return str_replace(["\r","\n"], ['\r','\n'], $pdo->quote($v));
            }, array_values($r));
            $o .= "INSERT INTO `$t` VALUES (" . implode(',', $vals) . ");\n";
        }
    }
    // views and triggers are created AFTER the data so triggers do not fire during restore
    foreach ($views as $v) $o .= oneLine($pdo->query("SHOW CREATE VIEW `$v`")->fetch(PDO::FETCH_NUM)[1]) . ";\n";
    foreach ($pdo->query("SHOW TRIGGERS")->fetchAll() as $tr) {
        $c = $pdo->query("SHOW CREATE TRIGGER `{$tr['Trigger']}`")->fetch();
        $o .= "DROP TRIGGER IF EXISTS `{$tr['Trigger']}`;\n" . oneLine($c['SQL Original Statement']) . ";\n";
    }
    return $o . "SET FOREIGN_KEY_CHECKS=1;\n";
}

try {
switch ($action) {

case 'login':
    $s = db()->prepare("SELECT * FROM users WHERE username=?"); $s->execute([trim($in['username'] ?? '')]);
    $u = $s->fetch();
    if (!$u || !password_verify($in['password'] ?? '', $u['password'])) out(['error' => 'Invalid username or password'], 401);
    if (!$u['active']) out(['error' => 'This account is deactivated'], 403);
    session_regenerate_id(true);
    $_SESSION['u'] = ['id' => (int)$u['id'], 'name' => $u['name'], 'username' => $u['username'], 'role' => $u['role']];
    out($_SESSION['u'] + ['tax' => TAX_RATE]);

case 'logout': session_destroy(); out(['ok' => true]);

case 'me': need(); out($_SESSION['u'] + ['tax' => TAX_RATE]);

case 'dashboard':
    need();
    $pdo = db();
    $low = $pdo->query("SELECT id,name,code,stock,reorder_level FROM v_low_stock ORDER BY stock")->fetchAll();   // VIEW
    $t = $pdo->query("SELECT COALESCE(SUM(total),0) rev, COUNT(*) n FROM sales WHERE DATE(created_at)=CURDATE()")->fetch();
    out([
        'products' => (int)$pdo->query("SELECT COUNT(*) FROM products WHERE active=1")->fetchColumn(),
        'low_stock' => count($low), 'low_list' => $low,
        'revenue' => (float)$t['rev'], 'sales' => (int)$t['n'],
        'recent' => salesList('', 8),
    ]);

// ---------- Products ----------
case 'products_list':
    need();
    $q = '%' . ($_GET['q'] ?? '') . '%'; $cat = $_GET['category'] ?? '';
    $sql = "SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON s.id=p.supplier_id
            WHERE p.active=1 AND (p.name LIKE ? OR p.code LIKE ? OR p.category LIKE ?)";
    $args = [$q, $q, $q];
    if ($cat !== '') { $sql .= " AND p.category=?"; $args[] = $cat; }
    $st = db()->prepare($sql . " ORDER BY p.name"); $st->execute($args);
    out(['products' => $st->fetchAll(),
         'categories' => db()->query("SELECT DISTINCT category FROM products WHERE active=1 ORDER BY category")->fetchAll(PDO::FETCH_COLUMN)]);

case 'product_save':
    need('admin', 'clerk');
    $name = trim($in['name'] ?? ''); if ($name === '') out(['error' => 'Product name is required'], 422);
    $f = [$name, trim($in['category'] ?? '') ?: 'General', (float)($in['price'] ?? 0), (float)($in['cost'] ?? 0),
          (int)($in['stock'] ?? 0), (int)($in['reorder_level'] ?? 10), ($in['supplier_id'] ?? '') ?: null];
    if ($f[2] < 0 || $f[3] < 0 || $f[4] < 0) out(['error' => 'Values cannot be negative'], 422);
    if (!empty($in['id'])) {
        $code = trim($in['code'] ?? '');
        db()->prepare("UPDATE products SET name=?,category=?,price=?,cost=?,stock=?,reorder_level=?,supplier_id=?,code=? WHERE id=?")
            ->execute(array_merge($f, [$code, $in['id']]));
    } else {
        $code = trim($in['code'] ?? '') ?: 'TMP' . uniqid();
        db()->prepare("INSERT INTO products (name,category,price,cost,stock,reorder_level,supplier_id,code) VALUES (?,?,?,?,?,?,?,?)")
            ->execute(array_merge($f, [$code]));
        if (trim($in['code'] ?? '') === '') {
            $id = db()->lastInsertId();
            db()->prepare("UPDATE products SET code=? WHERE id=?")->execute(['PROD-' . str_pad($id, 3, '0', STR_PAD_LEFT), $id]);
        }
    }
    out(['ok' => true]);

case 'product_delete':
    need('admin', 'clerk');
    db()->prepare("UPDATE products SET active=0 WHERE id=?")->execute([$in['id'] ?? 0]);
    out(['ok' => true]);

// ---------- Sales ----------
case 'sale_create':
    need('admin', 'cashier');
    $items = $in['items'] ?? []; $pm = $in['payment_method'] ?? 'Cash';
    if (!$items) out(['error' => 'Cart is empty'], 422);
    if (!in_array($pm, ['Cash', 'Card', 'GCash', 'PayMaya'])) out(['error' => 'Invalid payment method'], 422);
    $pdo = db(); $pdo->beginTransaction();
    $sub = 0; $lines = [];
    foreach ($items as $it) {
        $qty = (int)($it['qty'] ?? 0); if ($qty < 1) continue;
        $st = $pdo->prepare("SELECT * FROM products WHERE id=? AND active=1 FOR UPDATE"); $st->execute([$it['id'] ?? 0]);
        $p = $st->fetch();
        if (!$p) { $pdo->rollBack(); out(['error' => 'A product no longer exists'], 422); }
        if ($p['stock'] < $qty) { $pdo->rollBack(); out(['error' => "Not enough stock for {$p['name']} (available: {$p['stock']})"], 422); }
        $sub += $p['price'] * $qty; $lines[] = [$p, $qty];
    }
    if (!$lines) { $pdo->rollBack(); out(['error' => 'Cart is empty'], 422); }
    $tax = round($sub * TAX_RATE, 2); $total = $sub + $tax;
    $recv = (float)($in['amount_received'] ?? 0);
    if ($pm === 'Cash') {
        if ($recv < $total) { $pdo->rollBack(); out(['error' => 'Amount received is less than the total'], 422); }
        $chg = $recv - $total;
    } else { $recv = $total; $chg = 0; }
    $pdo->prepare("INSERT INTO sales (receipt_no,user_id,subtotal,tax,total,payment_method,amount_received,change_amount) VALUES (?,?,?,?,?,?,?,?)")
        ->execute(['TMP' . uniqid(), $_SESSION['u']['id'], $sub, $tax, $total, $pm, $recv, $chg]);
    $sid = $pdo->lastInsertId();
    $pdo->prepare("UPDATE sales SET receipt_no=? WHERE id=?")->execute([nextCode('SALE', $sid), $sid]);
    foreach ($lines as [$p, $qty]) {
        $pdo->prepare("INSERT INTO sale_items (sale_id,product_id,name,qty,price,cost) VALUES (?,?,?,?,?,?)")
            ->execute([$sid, $p['id'], $p['name'], $qty, $p['price'], $p['cost']]);
        // stock is reduced by DB trigger trg_sale_items_ai (business rule enforced in the database)
    }
    $pdo->commit();
    out(getSale($sid));

case 'sales_list': need('admin', 'cashier'); out(salesList($_GET['q'] ?? '')); 
case 'sale_get':   need('admin', 'cashier'); out(getSale((int)($_GET['id'] ?? 0)));

// ---------- Suppliers ----------
case 'suppliers_list':
    need('admin', 'clerk');
    $q = '%' . ($_GET['q'] ?? '') . '%';
    $st = db()->prepare("SELECT s.*, (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id=s.id) AS purchase_count,
        (SELECT COALESCE(SUM(total),0) FROM purchases p WHERE p.supplier_id=s.id) AS purchase_total
        FROM suppliers s WHERE s.name LIKE ? OR s.contact_person LIKE ? ORDER BY s.name");
    $st->execute([$q, $q]); out($st->fetchAll());

case 'supplier_save':
    need('admin', 'clerk');
    if (trim($in['name'] ?? '') === '') out(['error' => 'Supplier name is required'], 422);
    $f = [trim($in['name']), $in['contact_person'] ?? '', $in['phone'] ?? '', $in['email'] ?? '', $in['address'] ?? ''];
    if (!empty($in['id'])) db()->prepare("UPDATE suppliers SET name=?,contact_person=?,phone=?,email=?,address=? WHERE id=?")->execute(array_merge($f, [$in['id']]));
    else db()->prepare("INSERT INTO suppliers (name,contact_person,phone,email,address) VALUES (?,?,?,?,?)")->execute($f);
    out(['ok' => true]);

case 'supplier_delete':
    need('admin', 'clerk');
    $c = db()->prepare("SELECT COUNT(*) FROM purchases WHERE supplier_id=?"); $c->execute([$in['id'] ?? 0]);
    if ($c->fetchColumn()) out(['error' => 'This supplier has purchase history and cannot be deleted'], 422);
    db()->prepare("DELETE FROM suppliers WHERE id=?")->execute([$in['id'] ?? 0]); out(['ok' => true]);

case 'supplier_history':
    need('admin', 'clerk');
    $st = db()->prepare("SELECT id FROM purchases WHERE supplier_id=? ORDER BY id DESC"); $st->execute([$_GET['id'] ?? 0]);
    $res = []; foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $pid) $res[] = purchaseGet($pid);
    out($res);

// ---------- Purchases ----------
case 'purchases_list':
    need('admin', 'clerk');
    $res = []; foreach (db()->query("SELECT id FROM purchases ORDER BY id DESC LIMIT 200")->fetchAll(PDO::FETCH_COLUMN) as $pid) $res[] = purchaseGet($pid);
    out($res);

case 'purchase_create':
    need('admin', 'clerk');
    $items = $in['items'] ?? [];
    if (empty($in['supplier_id']) || !$items) out(['error' => 'Choose a supplier and add at least one item'], 422);
    $pdo = db(); $pdo->beginTransaction(); $total = 0; $lines = [];
    foreach ($items as $it) {
        $qty = (int)($it['qty'] ?? 0); $uc = (float)($it['unit_cost'] ?? 0);
        if ($qty < 1 || $uc < 0) continue;
        $st = $pdo->prepare("SELECT * FROM products WHERE id=?"); $st->execute([$it['product_id'] ?? 0]); $p = $st->fetch();
        if (!$p) continue;
        $total += $qty * $uc; $lines[] = [$p, $qty, $uc];
    }
    if (!$lines) { $pdo->rollBack(); out(['error' => 'No valid items'], 422); }
    $pdo->prepare("INSERT INTO purchases (po_no,supplier_id,user_id,total) VALUES (?,?,?,?)")->execute(['TMP' . uniqid(), $in['supplier_id'], $_SESSION['u']['id'], $total]);
    $pid = $pdo->lastInsertId();
    $pdo->prepare("UPDATE purchases SET po_no=? WHERE id=?")->execute([nextCode('PO', $pid), $pid]);
    foreach ($lines as [$p, $qty, $uc]) {
        $pdo->prepare("INSERT INTO purchase_items (purchase_id,product_id,name,qty,unit_cost) VALUES (?,?,?,?,?)")->execute([$pid, $p['id'], $p['name'], $qty, $uc]);
        $pdo->prepare("UPDATE products SET cost=?, supplier_id=? WHERE id=?")->execute([$uc, $in['supplier_id'], $p['id']]); // stock is increased by trigger trg_purchase_items_ai
    }
    $pdo->commit(); out(purchaseGet($pid));

// ---------- Reports ----------
case 'report':
    need('admin');
    $p = $_GET['period'] ?? 'today'; $type = $_GET['type'] ?? 'sales'; $pdo = db();
    if ($type === 'sales') {
        $c = periodCond($p, 's.created_at');
        $r = $pdo->query("SELECT COALESCE(SUM(total),0) revenue, COUNT(*) sales FROM sales s WHERE $c")->fetch();
        $items = $pdo->query("SELECT COALESCE(SUM(si.qty),0) FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE $c")->fetchColumn();
        out(['revenue' => (float)$r['revenue'], 'sales' => (int)$r['sales'], 'items' => (int)$items,
             'average' => $r['sales'] ? $r['revenue'] / $r['sales'] : 0]);
    }
    if ($type === 'pnl') {
        $c = periodCond($p, 's.created_at');
        $rev = (float)$pdo->query("SELECT COALESCE(SUM(total),0) FROM sales s WHERE $c")->fetchColumn();
        $cost = (float)$pdo->query("SELECT COALESCE(SUM(si.qty*si.cost),0) FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE $c")->fetchColumn();
        out(['revenue' => $rev, 'cost' => $cost, 'profit' => $rev - $cost, 'margin' => $rev ? ($rev - $cost) / $rev * 100 : 0]);
    }
    if ($type === 'inventory') {
        $rows = $pdo->query("SELECT code,name,category,stock,reorder_level,cost,price FROM products WHERE active=1 ORDER BY name")->fetchAll();
        $low = $out = 0; $val = 0;
        foreach ($rows as $r) { if ($r['stock'] == 0) $out++; elseif ($r['stock'] <= $r['reorder_level']) $low++; $val += $r['stock'] * ($r['cost'] > 0 ? $r['cost'] : $r['price']); }
        out(['total' => count($rows), 'low' => $low, 'out' => $out, 'value' => $val, 'rows' => $rows]);
    }
    if ($type === 'movers') {
        $c = periodCond($p, 's.created_at');
        $fast = $pdo->query("SELECT si.name, SUM(si.qty) qty, SUM(si.qty*si.price) revenue FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE $c GROUP BY si.product_id, si.name ORDER BY qty DESC LIMIT 5")->fetchAll();
        $slow = $pdo->query("SELECT p.name, p.stock, COALESCE(SUM(CASE WHEN $c THEN si.qty END),0) qty
                FROM products p LEFT JOIN sale_items si ON si.product_id=p.id LEFT JOIN sales s ON s.id=si.sale_id
                WHERE p.active=1 GROUP BY p.id, p.name, p.stock ORDER BY qty ASC, p.stock DESC LIMIT 5")->fetchAll();
        out(['fast' => $fast, 'slow' => $slow]);
    }
    if ($type === 'payments') {
        $c = periodCond($p, 'created_at');
        out($pdo->query("SELECT payment_method, COUNT(*) count, SUM(total) total FROM sales WHERE $c GROUP BY payment_method ORDER BY total DESC")->fetchAll());
    }
    out(['error' => 'Unknown report'], 422);

// ---------- Users ----------
case 'users_list':
    need('admin');
    $q = '%' . ($_GET['q'] ?? '') . '%';
    $st = db()->prepare("SELECT id,name,username,role,active FROM users WHERE name LIKE ? OR username LIKE ? OR role LIKE ? ORDER BY id DESC");
    $st->execute([$q, $q, $q]); out($st->fetchAll());

case 'user_save':
    need('admin');
    $name = trim($in['name'] ?? ''); $un = trim($in['username'] ?? ''); $role = $in['role'] ?? '';
    if ($name === '' || $un === '' || !in_array($role, ['admin', 'cashier', 'clerk'])) out(['error' => 'Name, username and role are required'], 422);
    $pw = $in['password'] ?? '';
    $dup = db()->prepare("SELECT id FROM users WHERE username=? AND id<>?"); $dup->execute([$un, $in['id'] ?? 0]);
    if ($dup->fetch()) out(['error' => 'Username already taken'], 422);
    if (!empty($in['id'])) {
        db()->prepare("UPDATE users SET name=?,username=?,role=? WHERE id=?")->execute([$name, $un, $role, $in['id']]);
        if ($pw !== '') db()->prepare("UPDATE users SET password=? WHERE id=?")->execute([password_hash($pw, PASSWORD_BCRYPT), $in['id']]);
    } else {
        if (strlen($pw) < 6) out(['error' => 'Password must be at least 6 characters'], 422);
        db()->prepare("INSERT INTO users (name,username,password,role) VALUES (?,?,?,?)")->execute([$name, $un, password_hash($pw, PASSWORD_BCRYPT), $role]);
    }
    out(['ok' => true]);

case 'user_toggle':
    need('admin');
    if ((int)$in['id'] === $_SESSION['u']['id']) out(['error' => 'You cannot deactivate your own account'], 422);
    db()->prepare("UPDATE users SET active=1-active WHERE id=?")->execute([$in['id']]); out(['ok' => true]);

case 'user_delete':
    need('admin');
    if ((int)$in['id'] === $_SESSION['u']['id']) out(['error' => 'You cannot delete your own account'], 422);
    $c = db()->prepare("SELECT (SELECT COUNT(*) FROM sales WHERE user_id=?)+(SELECT COUNT(*) FROM purchases WHERE user_id=?)"); $c->execute([$in['id'], $in['id']]);
    if ($c->fetchColumn()) out(['error' => 'This user has transactions. Deactivate the account instead.'], 422);
    db()->prepare("DELETE FROM users WHERE id=?")->execute([$in['id']]); out(['ok' => true]);

// ---------- Backup / Restore ----------
case 'backup':
    need('admin');
    header('Content-Type: application/sql');
    header('Content-Disposition: attachment; filename="psu_backup_' . date('Ymd_His') . '.sql"');
    echo dumpSql(); exit;

case 'restore':
    need('admin');
    $sql = $in['sql'] ?? '';
    if (strpos($sql, 'PSU Sales & Inventory backup') === false) out(['error' => 'This is not a valid backup file'], 422);
    $sql = preg_replace('/^--.*\n/', '', $sql);
    $pdo = db();
    foreach (explode(";\n", $sql) as $stmt) { $stmt = trim($stmt); if ($stmt !== '' && strpos($stmt, '--') !== 0) $pdo->exec($stmt); }
    session_destroy(); out(['ok' => true]);

default: out(['error' => 'Unknown action'], 404);
}
} catch (PDOException $e) {
    if (db()->inTransaction()) db()->rollBack();
    $m = $e->errorInfo[2] ?? $e->getMessage();
    if (preg_match('/CONSTRAINT `(\w+)` failed/', $m, $mm)) $m = 'Database rule violated (' . $mm[1] . ')';
    elseif (($e->errorInfo[1] ?? 0) == 1062) $m = 'Duplicate value: that record already exists';
    elseif (($e->errorInfo[1] ?? 0) == 1451) $m = 'Cannot delete: this record is used by other records';
    out(['error' => $m], 422);
} catch (Throwable $e) {
    if (db()->inTransaction()) db()->rollBack();
    out(['error' => 'Server error: ' . $e->getMessage()], 500);
}

function purchaseGet($id) {
    $s = db()->prepare("SELECT p.*, s.name AS supplier, u.name AS clerk FROM purchases p JOIN suppliers s ON s.id=p.supplier_id JOIN users u ON u.id=p.user_id WHERE p.id=?");
    $s->execute([$id]); $r = $s->fetch();
    $i = db()->prepare("SELECT name,qty,unit_cost FROM purchase_items WHERE purchase_id=?"); $i->execute([$id]);
    $r['items'] = $i->fetchAll(); return $r;
}
