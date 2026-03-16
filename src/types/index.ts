// ─── Database row shapes ──────────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  is_transfer: 0 | 1; // 1 = CC Payment (transfer, excluded from net savings)
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
}
