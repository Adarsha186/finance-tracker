# Finance Tracker — Project Context

## What this app does
Personal weekly finance tracker. User gets paid weekly, tracks expenses by category and payment method, pays credit card bills, and views spending reports/dashboards.

## Tech stack
- Frontend: React + Tailwind CSS
- Backend: Node.js + Express (or Next.js fullstack)
- DB: SQLite (local) or PostgreSQL
- Charts: Recharts or Chart.js

## Core data models
- Income: amount, date, week_number
- Expense: amount, category, payment_method, date, notes
- Category: name (Rent, Groceries, Gas, CC Payment, etc.)
- PaymentMethod: type (credit/debit), name (Amex, Chase, etc.)

## Categories
Home, Rent, Groceries, Gas, Dining, Entertainment, 
Subscriptions, CC Payment, Medical, Misc

## Payment methods
- Credit: Amex (credit)
- Debit: Chase (debit)
- CC Payment is a transfer category, not an expense

## Business rules
- Pay cycle: weekly
- CC Payment category = paying off credit card bill (not a real expense, just a transfer)
- Net savings = weekly income - total expenses (excluding CC Payment)
- Track running balance per week

## Code style
- Functional React components only
- No class components
- Tailwind for all styling, no inline styles
- Always handle loading + error states
- Keep components small, one responsibility each

## File structure
src/
  components/
  pages/
  hooks/
  utils/
  data/ (or api/)
```