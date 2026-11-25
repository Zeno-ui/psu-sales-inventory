-- =====================================================================
-- PSU Sales & Inventory - CONSTRAINT / BUSINESS-RULE TESTS
-- EVERY statement below is EXPECTED TO FAIL. Run them one at a time and
-- show the error message. After each, the data is unchanged.
-- =====================================================================
USE psu_inventory;

-- T1. CHECK: stock cannot be negative                          (ck_products_stock)
UPDATE products SET stock = -5 WHERE code = 'PROD-001';

-- T2. CHECK: price cannot be negative                          (ck_products_price)
UPDATE products SET price = -10 WHERE code = 'PROD-001';

-- T3. UNIQUE: duplicate product code                           (uq_products_code)
INSERT INTO products (code, name, category, price, cost, stock) VALUES ('PROD-001', 'Duplicate', 'Stationery', 5, 2, 10);

-- T4. CHECK: invalid payment method                            (ck_sales_payment)
INSERT INTO sales (receipt_no, user_id, subtotal, tax, total, payment_method, amount_received, change_amount)
VALUES ('SALE-TEST-0001', 2, 100, 0, 100, 'Bitcoin', 100, 0);

-- T5. CHECK: cash received is less than the total              (ck_sales_cash)
INSERT INTO sales (receipt_no, user_id, subtotal, tax, total, payment_method, amount_received, change_amount)
VALUES ('SALE-TEST-0002', 2, 100, 0, 100, 'Cash', 50, 0);

-- T6. CHECK: total must equal subtotal + tax                   (ck_sales_amounts)
INSERT INTO sales (receipt_no, user_id, subtotal, tax, total, payment_method, amount_received, change_amount)
VALUES ('SALE-TEST-0003', 2, 100, 12, 99, 'Card', 99, 0);

-- T7. TRIGGER: cannot sell more than the stock on hand         (trg_sale_items_bi)
START TRANSACTION;
INSERT INTO sales (receipt_no, user_id, subtotal, tax, total, payment_method, amount_received, change_amount)
VALUES ('SALE-TEST-0004', 2, 10, 0, 10, 'Card', 10, 0);
INSERT INTO sale_items (sale_id, product_id, name, qty, price, cost)
VALUES (LAST_INSERT_ID(), 2, 'Ballpen (Black)', 5, 10, 6);   -- product 2 has stock 0
ROLLBACK;

-- T8. TRIGGER: an inactive user cannot record a sale           (trg_sales_bi)   user 38 is inactive
INSERT INTO sales (receipt_no, user_id, subtotal, tax, total, payment_method, amount_received, change_amount)
VALUES ('SALE-TEST-0005', 38, 10, 0, 10, 'Card', 10, 0);

-- T9. TRIGGER: a clerk cannot record a sale (role rule)        (trg_sales_bi)   user 3 = clerk
INSERT INTO sales (receipt_no, user_id, subtotal, tax, total, payment_method, amount_received, change_amount)
VALUES ('SALE-TEST-0006', 3, 10, 0, 10, 'Card', 10, 0);

-- T10. TRIGGER: sales are permanent, cannot be deleted         (trg_sales_bd)
DELETE FROM sales WHERE id = 1;

-- T11. FOREIGN KEY: cannot delete a product that has sales     (fk_si_product, RESTRICT)
DELETE FROM products WHERE code = 'PROD-001';

-- T12. FOREIGN KEY: purchase order for a supplier that doesn't exist   (fk_po_supplier)
INSERT INTO purchases (po_no, supplier_id, user_id, total) VALUES ('PO-TEST-0001', 9999, 3, 100);

-- T13. CHECK: passwords must be bcrypt hashes, not plain text  (ck_users_password_hashed)
INSERT INTO users (name, username, password, role) VALUES ('Bad User', 'baduser', 'plaintext123', 'cashier');

-- T14. UNIQUE: duplicate username                              (uq_users_username)
INSERT INTO users (name, username, password, role)
VALUES ('Another Admin', 'admin', '$2y$10$5kAuGjfYpNdEh0YjEKWohea4r/iPHydQh388c6vKkP0pNX5BIb/E.', 'admin');
