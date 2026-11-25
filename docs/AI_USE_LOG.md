# AI-Use and Verification Log
> **Edit this file so it matches what YOUR group really did.** The entries below describe the AI work done while preparing this project (tool: Claude). Add your own prompts, changes and checks; keep it honest - every member must be able to explain each item.

| # | Task | Tool | What was accepted / changed | How it was checked | Problem found and corrected |
|---|---|---|---|---|---|
| 1 | Design schema: 7 tables, keys, CHECKs, triggers, 3 views | Claude | Accepted structure; kept `sale_items`/`purchase_items` as junction tables; added snapshot columns (name, price, cost) | Ran `01_schema.sql` on MariaDB 10.11; inspected `information_schema` for 7 triggers + 3 views | - |
| 2 | Generate 40-50 sample rows per table | Claude (Python script) | Accepted generator `generate_sample_data.py`; fixed seed so data is repeatable | Loaded data (triggers fire); `COUNT(*)` per table; checked no "insufficient stock" errors; low-stock view shows the 6 planted products | Script produced 44 sale items (duplicate product in a 2-item sale) -> added a loop to pick a different product |
| 3 | Write required queries (join, GROUP BY/HAVING, subquery, transaction, view) | Claude | Accepted; tuned HAVING thresholds so results are not empty | Ran every query, read results against raw tables | `INSERT ... SELECT FROM products` failed with error 1442 because a trigger updates `products` -> read values into variables first |
| 4 | Move stock adjustment from PHP into triggers | Claude | Removed manual `UPDATE products SET stock=...` from `api.php` | End-to-end test with curl: sale of 2 units changed stock 149 -> 147 (not 145) | Would have double-counted stock if both PHP and trigger updated it |
| 5 | Backup/restore must keep triggers and views | Claude | Added triggers + views to the dump, created after the data | Backup -> restore -> checked 7 triggers, 3 views, same row counts | First version lost the triggers after restore |
| 6 | ER diagram, business-rules image, sequence diagrams (Graphviz/matplotlib) | Claude | Accepted layout | Viewed the PNGs; compared with `01_schema.sql` | Crow's-foot ends were reversed and rule text was cut off -> fixed |

## Representative prompts
1. *"make a library system using html, javascript, php and mysql using xampp ... [feature list from our POS screenshots]"* (initial build)
2. *"do this and explain in step by step"* + the IT8 Final Drill requirements PDF (this database work)

## Our own checking (add yours)
- We re-ran every query in MySQL Workbench ourselves and compared totals with manual `SELECT SUM(...)`.
- We tried to break each rule in `04_constraint_tests.sql` and confirmed the data did not change.
