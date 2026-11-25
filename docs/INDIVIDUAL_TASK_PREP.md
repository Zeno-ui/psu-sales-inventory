# Preparing for the Individual Task (60% of the grade)
You will get something like: *modify a query, test a constraint, explain a design decision, or handle a changed requirement.* Practise these on a COPY of the database.

**Method for every task (say it out loud in the video):** 1) restate the task, 2) what you expect to happen, 3) do it, 4) show the result, 5) verify with a second query.

## Likely tasks and how to approach them
| Task | Example solution |
|---|---|
| Change a query | Top 3 cashiers by revenue: add `ORDER BY total_revenue DESC LIMIT 3` to Q2. |
| Change HAVING | Categories with revenue > 2000: `HAVING SUM(si.qty*si.price) > 2000`. |
| New constraint | Max 100 units per sale line: `ALTER TABLE sale_items ADD CONSTRAINT ck_si_max CHECK (qty <= 100);` then test with qty 101 (must fail). |
| New rule via trigger | Block selling below cost: BEFORE INSERT on `sale_items`, `IF NEW.price < NEW.cost THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Price below cost'; END IF;` |
| New requirement: 12% VAT | Set `TAX_RATE` to `0.12` in `config.php`; show a sale where `tax = subtotal * 0.12` and `ck_sales_amounts` still passes. |
| New column | `ALTER TABLE products ADD COLUMN barcode VARCHAR(30) UNIQUE;` then update + select. |
| Add an index | `CREATE INDEX idx_sales_pm ON sales(payment_method);` then `EXPLAIN SELECT ... WHERE payment_method='Cash';` |
| New view | `CREATE VIEW v_daily_sales AS SELECT DATE(created_at) d, COUNT(*) n, SUM(total) revenue FROM sales GROUP BY DATE(created_at);` |
| Explain: why a trigger and not PHP? | The rule holds no matter which program (or person in Workbench) changes the data. |
| Explain: why `sale_items`? | One sale has many products, one product is in many sales: many-to-many resolved with a junction table (1NF/3NF). |
| Explain: why copy `name/price/cost` into `sale_items`? | Historical receipts must not change when the product price changes later. |
| Explain: why soft-delete products? | FK RESTRICT protects history; `active = 0` hides the product instead. |
| Explain: transaction | Sale header + items + stock change succeed together (COMMIT) or not at all (ROLLBACK). |

## Know these cold
Where each rule lives (`Business_Rules.png`), the ER relationships, what each query returns, and the trigger error text you get in T7/T8.
