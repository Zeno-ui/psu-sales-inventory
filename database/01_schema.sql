-- =====================================================================
-- PSU Sales & Inventory System - Schema (tables, constraints, triggers, views)
-- DBMS: MySQL 8 / MariaDB 10.4+ (XAMPP)         Run order: 01 -> 02 -> 03
-- WARNING: drops and recreates all tables (existing data is lost).
-- =====================================================================
CREATE DATABASE IF NOT EXISTS psu_inventory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE psu_inventory;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW  IF EXISTS v_low_stock, v_sales_detail, v_product_performance;
DROP TABLE IF EXISTS purchase_items, purchases, sale_items, sales, products, suppliers, users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. USERS
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  username    VARCHAR(50)  NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('admin','cashier','clerk') NOT NULL,
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT ck_users_username_len CHECK (CHAR_LENGTH(username) >= 3),
  -- BR: passwords must be stored as bcrypt hashes, never plain text
  CONSTRAINT ck_users_password_hashed CHECK (LEFT(password, 4) IN ('$2y$', '$2a$', '$2b$')),
  CONSTRAINT ck_users_active CHECK (active IN (0, 1))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. SUPPLIERS
-- ---------------------------------------------------------------------
CREATE TABLE suppliers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  contact_person  VARCHAR(100),
  phone           VARCHAR(50),
  email           VARCHAR(100),
  address         VARCHAR(255),
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_suppliers_name UNIQUE (name),
  CONSTRAINT ck_suppliers_email CHECK (email IS NULL OR email = '' OR email LIKE '_%@_%._%')
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. PRODUCTS
-- ---------------------------------------------------------------------
CREATE TABLE products (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(30)   NOT NULL,
  name           VARCHAR(150)  NOT NULL,
  category       VARCHAR(80)   NOT NULL DEFAULT 'General',
  price          DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost           DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock          INT           NOT NULL DEFAULT 0,
  reorder_level  INT           NOT NULL DEFAULT 10,
  supplier_id    INT NULL,
  active         TINYINT(1)    NOT NULL DEFAULT 1,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_products_code UNIQUE (code),
  CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  -- BR: money and stock values can never be negative
  CONSTRAINT ck_products_price   CHECK (price >= 0),
  CONSTRAINT ck_products_cost    CHECK (cost  >= 0),
  CONSTRAINT ck_products_stock   CHECK (stock >= 0),
  CONSTRAINT ck_products_reorder CHECK (reorder_level >= 0),
  CONSTRAINT ck_products_active  CHECK (active IN (0, 1)),
  INDEX idx_products_category (category),
  INDEX idx_products_name (name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. SALES (header)
-- ---------------------------------------------------------------------
CREATE TABLE sales (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  receipt_no       VARCHAR(40)   NOT NULL,
  user_id          INT           NOT NULL,
  subtotal         DECIMAL(12,2) NOT NULL,
  tax              DECIMAL(12,2) NOT NULL DEFAULT 0,
  total            DECIMAL(12,2) NOT NULL,
  payment_method   VARCHAR(20)   NOT NULL,
  amount_received  DECIMAL(12,2) NOT NULL DEFAULT 0,
  change_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_sales_receipt UNIQUE (receipt_no),
  CONSTRAINT fk_sales_user FOREIGN KEY (user_id) REFERENCES users(id),
  -- BR: only the four supported payment methods
  CONSTRAINT ck_sales_payment CHECK (payment_method IN ('Cash','Card','GCash','PayMaya')),
  -- BR: totals must be consistent
  CONSTRAINT ck_sales_amounts CHECK (subtotal > 0 AND tax >= 0 AND total = subtotal + tax),
  -- BR: cash payments must cover the total; change is never negative
  CONSTRAINT ck_sales_cash CHECK (payment_method <> 'Cash' OR amount_received >= total),
  CONSTRAINT ck_sales_change CHECK (change_amount >= 0),
  INDEX idx_sales_created (created_at),
  INDEX idx_sales_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. SALE_ITEMS (line items; resolves Sales <-> Products many-to-many)
-- ---------------------------------------------------------------------
CREATE TABLE sale_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sale_id     INT           NOT NULL,
  product_id  INT           NOT NULL,
  name        VARCHAR(150)  NOT NULL,           -- snapshot of product name at time of sale
  qty         INT           NOT NULL,
  price       DECIMAL(12,2) NOT NULL,           -- snapshot of selling price
  cost        DECIMAL(12,2) NOT NULL DEFAULT 0, -- snapshot of cost (for profit reports)
  CONSTRAINT fk_si_sale    FOREIGN KEY (sale_id)    REFERENCES sales(id)    ON DELETE CASCADE,
  CONSTRAINT fk_si_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT ck_si_qty   CHECK (qty > 0),
  CONSTRAINT ck_si_price CHECK (price >= 0 AND cost >= 0),
  INDEX idx_si_product (product_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. PURCHASES (purchase order header)
-- ---------------------------------------------------------------------
CREATE TABLE purchases (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  po_no        VARCHAR(40)   NOT NULL,
  supplier_id  INT           NOT NULL,
  user_id      INT           NOT NULL,
  total        DECIMAL(12,2) NOT NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchases_po UNIQUE (po_no),
  CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_po_user     FOREIGN KEY (user_id)     REFERENCES users(id),
  CONSTRAINT ck_po_total CHECK (total >= 0),
  INDEX idx_po_supplier (supplier_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. PURCHASE_ITEMS
-- ---------------------------------------------------------------------
CREATE TABLE purchase_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id  INT           NOT NULL,
  product_id   INT           NOT NULL,
  name         VARCHAR(150)  NOT NULL,
  qty          INT           NOT NULL,
  unit_cost    DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_pi_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_product  FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE RESTRICT,
  CONSTRAINT ck_pi_qty  CHECK (qty > 0),
  CONSTRAINT ck_pi_cost CHECK (unit_cost >= 0),
  INDEX idx_pi_product (product_id)
) ENGINE=InnoDB;

-- =====================================================================
-- TRIGGERS  (business rules that CHECK constraints cannot express)
-- =====================================================================
DELIMITER $$

-- BR: only ACTIVE admins/cashiers may record a sale
CREATE TRIGGER trg_sales_bi BEFORE INSERT ON sales FOR EACH ROW
BEGIN
  DECLARE v_role VARCHAR(10); DECLARE v_active TINYINT;
  SELECT role, active INTO v_role, v_active FROM users WHERE id = NEW.user_id;
  IF v_active = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inactive users cannot record sales';
  END IF;
  IF v_role NOT IN ('admin','cashier') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only admin or cashier accounts can record sales';
  END IF;
END$$

-- BR: only ACTIVE admins/inventory clerks may create purchase orders
CREATE TRIGGER trg_purchases_bi BEFORE INSERT ON purchases FOR EACH ROW
BEGIN
  DECLARE v_role VARCHAR(10); DECLARE v_active TINYINT;
  SELECT role, active INTO v_role, v_active FROM users WHERE id = NEW.user_id;
  IF v_active = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Inactive users cannot create purchase orders';
  END IF;
  IF v_role NOT IN ('admin','clerk') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only admin or inventory clerk accounts can create purchase orders';
  END IF;
END$$

-- BR: cannot sell more than the stock on hand, or sell an inactive product
CREATE TRIGGER trg_sale_items_bi BEFORE INSERT ON sale_items FOR EACH ROW
BEGIN
  DECLARE v_stock INT; DECLARE v_active TINYINT;
  SELECT stock, active INTO v_stock, v_active FROM products WHERE id = NEW.product_id;
  IF v_active = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot sell an inactive (deleted) product';
  END IF;
  IF v_stock < NEW.qty THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock for this sale';
  END IF;
END$$

-- BR: automatic inventory adjustment after a sale line is recorded
CREATE TRIGGER trg_sale_items_ai AFTER INSERT ON sale_items FOR EACH ROW
BEGIN
  UPDATE products SET stock = stock - NEW.qty WHERE id = NEW.product_id;
END$$

-- BR: automatic stock increase when a purchase line is recorded
CREATE TRIGGER trg_purchase_items_ai AFTER INSERT ON purchase_items FOR EACH ROW
BEGIN
  UPDATE products SET stock = stock + NEW.qty WHERE id = NEW.product_id;
END$$

-- BR: financial records are permanent - sales and purchase orders cannot be deleted
CREATE TRIGGER trg_sales_bd BEFORE DELETE ON sales FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sales records are permanent and cannot be deleted';
END$$

CREATE TRIGGER trg_purchases_bd BEFORE DELETE ON purchases FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Purchase orders are permanent and cannot be deleted';
END$$

DELIMITER ;

-- =====================================================================
-- VIEWS
-- =====================================================================
-- Used by the dashboard "Low Stock Alerts"
CREATE VIEW v_low_stock AS
SELECT id, code, name, category, stock, reorder_level
FROM products
WHERE active = 1 AND stock <= reorder_level;

-- One row per sale with cashier name and item totals
CREATE VIEW v_sales_detail AS
SELECT s.id AS sale_id, s.receipt_no, s.created_at, u.name AS cashier, s.payment_method, s.total,
       (SELECT COALESCE(SUM(si.qty), 0) FROM sale_items si WHERE si.sale_id = s.id) AS items_sold
FROM sales s
JOIN users u ON u.id = s.user_id;

-- Units sold, revenue and profit per product
CREATE VIEW v_product_performance AS
SELECT p.id, p.code, p.name, p.category, p.stock,
       COALESCE(SUM(si.qty), 0)                         AS units_sold,
       COALESCE(SUM(si.qty * si.price), 0)              AS revenue,
       COALESCE(SUM(si.qty * (si.price - si.cost)), 0)  AS profit
FROM products p
LEFT JOIN sale_items si ON si.product_id = p.id
GROUP BY p.id, p.code, p.name, p.category, p.stock;
