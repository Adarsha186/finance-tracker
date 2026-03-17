// ─── Database row shapes ──────────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  is_transfer: 0 | 1; // 1 = transfer (e.g. CC Payment) — not counted as an expense
}

export interface PaymentMethod {
  id: number;
  name: string;
  type: 'credit' | 'debit';
}

export interface Income {
  id: number;
  amount: number;
  date: string; // YYYY-MM-DD
  week_number: number;
  year: number;
  notes: string | null;
}

export interface Expense {
  id: number;
  amount: number;
  category_id: number;
  payment_method_id: number | null;
  cc_payment_target_id: number | null; // which credit card is being paid off (CC Payment only)
  date: string; // YYYY-MM-DD
  week_number: number;
  year: number;
  notes: string | null;
}

// Expense joined with category + payment method — returned by GET /api/expenses
export interface ExpenseWithRefs extends Expense {
  category_name: string;
  is_transfer: 0 | 1;
  payment_method_name: string | null;
  payment_method_type: 'credit' | 'debit' | null;
  cc_payment_target_name: string | null; // name of the card being paid off
}

// Credit card balance — returned by GET /api/cc-balances
export interface CreditCardBalance {
  payment_method_id: number;
  name: string;
  balance: number;
  open_charges: number;  // total charged in non-rolled-up weeks
  open_payments: number; // total paid toward this card in non-rolled-up weeks
}

// ─── Aggregated / computed shapes ────────────────────────────────────────────

// One entry per pay week (Friday → Thursday).
// week_start is the YYYY-MM-DD of the opening Friday.
export interface WeekSummary {
  week_start: string;       // e.g. "2026-03-13"
  income: number;
  total_expenses: number;   // real spend, CC Payments excluded
  cc_payments: number;      // CC Payment transfers total
  net_savings: number;      // income - total_expenses
  is_closed: boolean;       // true = rolled up into week_summaries
}
