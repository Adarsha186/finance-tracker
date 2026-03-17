# Finance Tracker — Project Context

## What this app does
Personal weekly finance tracker. User gets paid weekly, tracks expenses by category and payment method, pays credit card bills, and views spending reports and credit card dashboards.

## Tech stack
- **Frontend**: React (Next.js App Router) + Tailwind CSS
- **Backend**: Next.js API routes (Node.js runtime)
- **DB**: Turso (LibSQL / SQLite-compatible), local file `finance.db`
- **Charts**: Recharts (PieChart in CreditCardTab, bar charts in AnalysisTab)

## Database schema

| Table | Key columns |
|---|---|
| `categories` | id, name, is_transfer (1 = transfer, excluded from expenses) |
| `payment_methods` | id, name, type ('credit' \| 'debit') |
| `income` | id, amount, date, week_number, year, notes |
| `expenses` | id, amount, category_id, payment_method_id, cc_payment_target_id, date, week_number, year, notes |
| `week_summaries` | week_start (PK), income, total_expenses, cc_payments, net_savings, category_breakdown (JSON), payment_method_breakdown (JSON) |
| `cc_balances` | payment_method_id (PK), balance |

## Key column: cc_payment_target_id
When an expense has category = "CC Payment", `cc_payment_target_id` stores which credit card is being paid off. This is how the CC balance decreases when a payment is made.

## Business rules
- **Pay cycle**: Friday → Thursday (weekly)
- **CC Payment** (`is_transfer = 1`): paying off a credit card bill — NOT counted as an expense. The real expense happened when the card was charged.
- **Net savings** = `income - total_expenses` (CC payments excluded — they are transfers)
- **CC balance** = running total updated atomically on every expense POST:
  - Expense on credit card (non-CC Payment) → `cc_balances[card] += amount`
  - CC Payment with target → `cc_balances[target] -= amount`
- Weeks are closed/archived via POST `/api/rollup` — individual expenses are deleted, summary stored in `week_summaries`

## Production categories
Rent, Subscriptions, Misc, CC Payment

## Production payment methods
- Amex (credit), Zolve (credit), Amazon Visa (credit)
- Chase (debit)

## API routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/summary` | GET | Weekly summaries (open + closed weeks) |
| `/api/expenses` | GET, POST | Expense CRUD; GET supports `?week_start`, `?payment_method_id`, `?category_id` filters |
| `/api/income` | POST | Upsert weekly income |
| `/api/categories` | GET, POST, PATCH, DELETE | Manage categories |
| `/api/payment-methods` | GET, POST, DELETE | Manage payment methods; POST auto-creates cc_balances row for credit cards |
| `/api/cc-balances` | GET, PATCH | Credit card balances; PATCH for manual adjustment |
| `/api/rollup` | POST | Close/archive a past week |
| `/api/analysis` | GET | Date-range analysis with category + payment method breakdowns |

## App tabs
1. **Weekly** — enter income + expenses for the current week; view past weeks
2. **Analysis** — date-range spending analysis with charts
3. **Cards** — credit card balances, pie charts, recent charges/payments
4. **Settings** — manage categories and payment methods

## Code style
- Functional React components only, no class components
- Tailwind for all styling, no inline styles
- Always handle loading + error states
- Keep components small, one responsibility each
- All SQL queries must use parameterized args (never string interpolation)
- Use `as unknown as Type` for LibSQL row casts

## File structure
```
src/
  app/
    page.tsx                     # Tab manager (Weekly / Analysis / Cards / Settings)
    api/
      expenses/route.ts
      income/route.ts
      categories/route.ts
      payment-methods/route.ts
      summary/route.ts
      rollup/route.ts
      analysis/route.ts
      cc-balances/route.ts
  components/
    week/
      WeekEntryCard.tsx          # Editable current-week card
      PastWeekCard.tsx           # Read-only past week with close modal
    analysis/
      AnalysisTab.tsx
    creditcards/
      CreditCardTab.tsx          # Pie charts + activity per credit card
    settings/
      SettingsTab.tsx
    ui/
      ThemeToggle.tsx
  hooks/
    useWeekData.ts               # Fetches weeks + categories + methods
  lib/
    db.ts                        # Turso client + schema init + migrations
    seed.ts                      # Production reset script
  types/
    index.ts
  utils/
    week.ts                      # Friday-based week math
    format.ts                    # Currency formatting
  styles/
    inputs.ts                    # Shared Tailwind input classes
```
