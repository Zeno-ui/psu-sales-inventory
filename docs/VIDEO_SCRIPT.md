# Video Script (15-20 minutes, <= 480p, every member speaks)
Tip: zoom the SQL editor to 150%, use a name tag for the individual part, and show real windows - not only slides.

| Time | Part | Who | What to show / say |
|---|---|---|---|
| 0:00-2:30 | 1. Problem and users | M1 | University office sells supplies on paper -> stock errors. Users: cashier, clerk, admin. Show `Sequence_Sale.png` and walk through the flow. |
| 2:30-6:00 | 2. ER diagram and rules | M2 | `ER_Diagram.png`: 7 tables, PK/FK, junction tables `sale_items` / `purchase_items`, why snapshot columns. Then `Business_Rules.png`: CHECK vs trigger vs FK. |
| 6:00-8:30 | 3. Action in app -> database | M3 | Cashier sells 2 x Notebook A4. In Workbench show new `sales` + `sale_items` rows and the lowered `stock`. |
| 8:30-12:00 | 4. Required queries | M4 | Q1 join, Q2 GROUP BY/HAVING, Q3 subquery, Q4 transaction (COMMIT then ROLLBACK), Q5 view. Explain each result in one sentence. |
| 12:00-13:30 | 5. Test a rule | M5 | `04_constraint_tests.sql`: T1 negative stock, T7 oversell (trigger), T8 inactive user. Show error, then show data unchanged. |
| 13:30-18:00 | 6. Individual tasks | each | Say your NAME. Explain: what the task asks, what you did and why, expected vs actual result, how you checked. Use a COPY of the database (`CREATE DATABASE psu_copy` then load schema + data). No AI during this part. |
| 18:00-19:30 | 7. AI use and limitation | M1 | Summarise `AI_USE_LOG.md` (e.g. the error-1442 problem). One limitation: no returns/discounts, single global tax rate. |

Before recording: re-run `01_schema.sql` + `02_sample_data.sql` so the demo starts from clean data.
