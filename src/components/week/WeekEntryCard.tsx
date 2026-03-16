'use client';

import { useEffect, useState } from 'react';
import { fmt } from '@/utils/format';
import { weekLabel, todayISO } from '@/utils/week';
import { inputCls, selectCls } from '@/styles/inputs';
import type { Category, PaymentMethod, WeekSummary } from '@/types';

interface Props {
  week: WeekSummary;
  categories: Category[];
  methods: PaymentMethod[];
  isCurrentWeek?: boolean;
}

interface Totals {
  income: number;
  total_expenses: number;
  cc_payments: number;
}

const emptyForm = (date: string) => ({
  amount: '',
  category_id: '',
  payment_method_id: '',
  date,
  notes: '',
});

/**
 * Editable card for a pay week.
 * Lets the user set weekly income and add expenses one at a time.
 * Running totals update instantly after each save — no page refresh needed.
 */
export function WeekEntryCard({ week, categories, methods, isCurrentWeek = false }: Props) {
  // ── Income state ──────────────────────────────────────────────────────────
  const [income, setIncome]             = useState(String(week.income || ''));
  const [savingIncome, setSavingIncome] = useState(false);
  const [incomeFlash, setIncomeFlash]   = useState('');

  // ── Running totals (updated locally after each save) ──────────────────────
  const [totals, setTotals] = useState<Totals>({
    income:         week.income,
    total_expenses: week.total_expenses,
    cc_payments:    week.cc_payments,
  });

  // ── Expense form state ─────────────────────────────────────────────────────
  const [form, setForm] = useState(emptyForm(todayISO()));
  const [saving, setSaving] = useState(false);
  const [flash, setFlash]   = useState('');

  // Sync totals when parent data refreshes
  useEffect(() => {
    setTotals({
      income:         week.income,
      total_expenses: week.total_expenses,
      cc_payments:    week.cc_payments,
    });
    setIncome(String(week.income || ''));
  }, [week.income, week.total_expenses, week.cc_payments]);

  const setField = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSaveIncome() {
    const amount = parseFloat(income);
    if (!amount || amount <= 0) return;
    setSavingIncome(true);

    const res = await fetch('/api/income', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ amount, date: week.week_start, notes: 'Weekly pay' }),
    });

    if (res.ok) {
      setTotals((t) => ({ ...t, income: amount }));
      setIncomeFlash('Saved!');
    } else {
      setIncomeFlash('Error');
    }
    setSavingIncome(false);
    setTimeout(() => setIncomeFlash(''), 1500);
  }

  async function handleAddExpense() {
    const amount = parseFloat(form.amount);
    if (!amount || !form.category_id) {
      setFlash('Fill in category and amount');
      setTimeout(() => setFlash(''), 2000);
      return;
    }
    setSaving(true);

    const isTransfer =
      categories.find((c) => c.id === Number(form.category_id))?.is_transfer === 1;

    const res = await fetch('/api/expenses', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        amount,
        category_id:       Number(form.category_id),
        payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : null,
        date:              form.date,
        notes:             form.notes || null,
      }),
    });

    if (res.ok) {
      setTotals((t) => ({
        ...t,
        total_expenses: isTransfer ? t.total_expenses : t.total_expenses + amount,
        cc_payments:    isTransfer ? t.cc_payments + amount : t.cc_payments,
      }));
      // Keep date + method for quick repeat entry; clear the rest
      setForm((f) => ({ ...f, amount: '', category_id: '', notes: '' }));
      setFlash('Added ✓');
    } else {
      setFlash('Error saving');
    }
    setSaving(false);
    setTimeout(() => setFlash(''), 1500);
  }

  // ── Derived display values ─────────────────────────────────────────────────

  const netSavings   = totals.income - totals.total_expenses;
  const spentPct     = totals.income > 0
    ? Math.min((totals.total_expenses / totals.income) * 100, 100)
    : 0;
  const savingsColor = netSavings >= 0 ? 'text-emerald-500' : 'text-red-500';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={[
      'rounded-2xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden transition-colors',
      isCurrentWeek
        ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900'
        : 'border-gray-200 dark:border-gray-700',
    ].join(' ')}>

      {/* ── Card header ── */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {weekLabel(week.week_start)}
          </span>
          {isCurrentWeek && (
            <span className="rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
              Current
            </span>
          )}
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${savingsColor}`}>{fmt(netSavings)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">remaining</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* ── Income input ── */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
            Income this week
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 800"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveIncome()}
              className={inputCls}
            />
            <button
              onClick={handleSaveIncome}
              disabled={savingIncome || !income}
              className="shrink-0 rounded-lg bg-gray-800 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors"
            >
              {savingIncome ? '...' : 'Set'}
            </button>
            {incomeFlash && (
              <span className="self-center text-sm font-medium text-emerald-500">
                {incomeFlash}
              </span>
            )}
          </div>
        </div>

        {/* ── Expense form ── */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
            Add Expense
          </label>
          <div className="space-y-2">
            {/* Row 1: Category + Method */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.category_id}
                onChange={(e) => setField('category_id', e.target.value)}
                className={selectCls}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={form.payment_method_id}
                onChange={(e) => setField('payment_method_id', e.target.value)}
                className={selectCls}
              >
                <option value="">Payment method</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            {/* Row 2: Amount + Date */}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Amount ($)"
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddExpense()}
                className={inputCls}
              />
              <input
                type="date"
                value={form.date}
                onChange={(e) => setField('date', e.target.value)}
                className={inputCls}
              />
            </div>
            {/* Row 3: Notes + Add */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddExpense()}
                className={inputCls}
              />
              <button
                onClick={handleAddExpense}
                disabled={saving}
                className="shrink-0 rounded-lg bg-blue-600 dark:bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {saving ? '...' : 'Add'}
              </button>
            </div>
            {flash && (
              <p className={`text-sm font-medium ${
                flash.includes('Error') || flash.includes('Fill')
                  ? 'text-red-500'
                  : 'text-emerald-500'
              }`}>
                {flash}
              </p>
            )}
          </div>
        </div>

        {/* ── Running totals ── */}
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
          {/* Spend progress bar */}
          <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${spentPct}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Spent</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {fmt(totals.total_expenses)}
            </span>
          </div>
          {totals.cc_payments > 0 && (
            <div className="flex justify-between">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                CC Payment (transfer, not counted as expense)
              </span>
              <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                {fmt(totals.cc_payments)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t border-gray-200 dark:border-gray-700 pt-2">
            <span className="font-semibold text-gray-700 dark:text-gray-300">Remaining</span>
            <span className={`font-bold ${savingsColor}`}>{fmt(netSavings)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
