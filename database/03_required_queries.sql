-- =====================================================================
-- PSU Sales & Inventory - REQUIRED QUERIES (run after 01 and 02)
-- Each block = one requirement. Run blocks one at a time during the demo.
-- =====================================================================
USE psu_inventory;

-- ---------------------------------------------------------------------
-- Q1. MULTI-TABLE JOIN (4 tables): every receipt line with cashier & product
-- ---------------------------------------------------------------------
SELECT s.receipt_no, s.created_at, u.name AS cashier, p.name AS product,
       si.qty, si.price, (si.qty * si.price) AS line_total, s.payment_method
FROM sales s
JOIN users u       ON u.id = s.user_id
JOIN sale_items si ON si.sale_id = s.id
JOIN products p    ON p.id = si.product_id
ORDER BY s.created_at DESC
LIMIT 15;

-- Q1b. JOIN (4 tables): purchase orders with supplier, clerk and items
SELECT po.po_no, po.created_at, sup.name AS supplier, u.name AS created_by,
       pi.name AS product, pi.qty, pi.unit_cost, (pi.qty * pi.unit_cost) AS line_total
FROM purchases po
JOIN suppliers sup     ON sup.id = po.supplier_id
JOIN users u           ON u.id = po.user_id
JOIN purchase_items pi ON pi.purchase_id = po.id
ORDER BY po.created_at DESC
LIMIT 15;

-- ---------------------------------------------------------------------
-- Q2. AGGREGATE with GROUP BY + HAVING
-- Cashiers who made at least 2 sales, with their total revenue (>= 500)
-- ---------------------------------------------------------------------
SELECT u.name AS cashier, COUNT(*) AS sales_count, SUM(s.total) AS total_revenue, ROUND(AVG(s.total), 2) AS avg_sale
FROM sales s
JOIN users u ON u.id = s.user_id
GROUP BY u.id, u.name
HAVING COUNT(*) >= 2 AND SUM(s.total) >= 500
ORDER BY total_revenue DESC;

-- Q2b. GROUP BY + HAVING: product categories with more than 5 units sold
SELECT p.category, SUM(si.qty) AS units_sold, SUM(si.qty * si.price) AS revenue
FROM sale_items si
JOIN products p ON p.id = si.product_id
GROUP BY p.category
HAVING SUM(si.qty) > 5
ORDER BY revenue DESC;

-- Q2c. Payment-method analytics (used by the Reports page)
SELECT payment_method, COUNT(*) AS transactions, SUM(total) AS total_amount
FROM sales
GROUP BY payment_method
HAVING COUNT(*) >= 1
ORDER BY total_amount DESC;

-- ---------------------------------------------------------------------
-- Q3. SUBQUERIES
-- ---------------------------------------------------------------------
-- Q3a. Scalar subquery: products priced above the average product price
SELECT code, name, price
FROM products
WHERE price > (SELECT AVG(price) FROM products)
ORDER BY price DESC;

-- Q3b. NOT EXISTS subquery: products that have never been sold (slow movers)
SELECT p.code, p.name, p.stock
FROM products p
WHERE p.active = 1
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.product_id = p.id)
ORDER BY p.stock DESC;

-- Q3c. Subquery in HAVING: suppliers whose total purchases exceed the average per-supplier total
SELECT s.name AS supplier, SUM(po.total) AS total_purchased
FROM purchases po
JOIN suppliers s ON s.id = po.supplier_id
GROUP BY s.id, s.name
HAVING SUM(po.total) > (SELECT AVG(t.total_per_supplier)
                        FROM (SELECT SUM(total) AS total_per_supplier FROM purchases GROUP BY supplier_id) t)
ORDER BY total_purchased DESC;

-- Q3d. IN subquery: suppliers that have never received a purchase order
SELECT id, name FROM suppliers
WHERE id NOT IN (SELECT DISTINCT supplier_id FROM purchases)
ORDER BY id;

-- ---------------------------------------------------------------------
-- Q4. TRANSACTION  (all-or-nothing sale; triggers adjust stock)
-- ---------------------------------------------------------------------
-- NOTE: values are read into variables first, because MySQL does not allow
-- "INSERT INTO sale_items ... SELECT FROM products" while a trigger updates products (error 1442).

-- Q4a. COMMIT: stock before
SELECT code, name, stock FROM products WHERE code IN ('PROD-001','PROD-003');

SELECT id, name, price, cost INTO @p1_id, @p1_name, @p1_price, @p1_cost FROM products WHERE code = 'PROD-001';
SELECT id, name, price, cost INTO @p3_id, @p3_name, @p3_price, @p3_cost FROM products WHERE code = 'PROD-003';

START TRANSACTION;
  INSERT INTO sales (receipt_no, user_id, subtotal, tax, total, payment_method, amount_received, change_amount)
  VALUES ('SALE-DEMO-0001', 2, 65.00, 0.00, 65.00, 'Cash', 100.00, 35.00);
  SET @sale_id = LAST_INSERT_ID();
  INSERT INTO sale_items (sale_id, product_id, name, qty, price, cost) VALUES (@sale_id, @p1_id, @p1_name, 2, @p1_price, @p1_cost);   -- 2 x 10.00
  INSERT INTO sale_items (sale_id, product_id, name, qty, price, cost) VALUES (@sale_id, @p3_id, @p3_name, 1, @p3_price, @p3_cost);   -- 1 x 45.00
COMMIT;

-- stock after (reduced by 2 and 1 automatically by trg_sale_items_ai)
SELECT code, name, stock FROM products WHERE code IN ('PROD-001','PROD-003');
SELECT * FROM v_sales_detail WHERE receipt_no = 'SALE-DEMO-0001';

-- Q4b. ROLLBACK: the item fails (not enough stock), so NOTHING is saved.
-- Run the lines one at a time; the 3rd statement raises "Insufficient stock for this sale".
SELECT id, name, price, cost INTO @w_id, @w_name, @w_price, @w_cost FROM products WHERE code = 'PROD-019';
START TRANSACTION;
  INSERT INTO sales (receipt_no, user_id, subtotal, tax, total, payment_method, amount_received, change_amount)
  VALUES ('SALE-DEMO-0002', 2, 1200.00, 0.00, 1200.00, 'Cash', 1200.00, 0.00);
  INSERT INTO sale_items (sale_id, product_id, name, qty, price, cost) VALUES (LAST_INSERT_ID(), @w_id, @w_name, 9999, @w_price, @w_cost);   -- fails
ROLLBACK;
SELECT COUNT(*) AS demo0002_rows_after_rollback FROM sales WHERE receipt_no = 'SALE-DEMO-0002';  -- 0

-- ---------------------------------------------------------------------
-- Q5. VIEWS
-- ---------------------------------------------------------------------
SELECT * FROM v_low_stock ORDER BY stock;                                   -- dashboard alerts
SELECT * FROM v_sales_detail ORDER BY created_at DESC LIMIT 10;             -- sales history header
SELECT * FROM v_product_performance ORDER BY revenue DESC LIMIT 10;         -- best sellers
SELECT category, SUM(profit) AS profit FROM v_product_performance GROUP BY category HAVING SUM(profit) > 0;

-- ---------------------------------------------------------------------
-- Q6. CRUD (as performed by the application)
-- ---------------------------------------------------------------------
-- CREATE
INSERT INTO products (code, name, category, price, cost, stock, reorder_level, supplier_id)
VALUES ('PROD-046', 'Sharpener', 'Stationery', 12.00, 6.00, 100, 20, 1);
-- READ
SELECT p.code, p.name, p.price, p.stock, s.name AS supplier
FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.code = 'PROD-046';
-- UPDATE
UPDATE products SET price = 14.00, stock = stock + 50 WHERE code = 'PROD-046';
-- DELETE (the app soft-deletes products that already have history; a never-used row can be hard-deleted)
DELETE FROM products WHERE code = 'PROD-046';
