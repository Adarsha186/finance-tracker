'use client';

import { useCallback, useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { fmt } from '@/utils/format';
import { inputCls } from '@/styles/inputs';
import type { CreditCardBalance, ExpenseWithRefs } from '@/types';

interface CardActivity { expenses: ExpenseWithRefs[] }
interface AdjustState  { cardId: number; value: string }

const COLORS = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#6d28d9', '#ddd6fe', '#4c1d95'];

export function CreditCardTab() {
  const [cards, setCards]       = useState<CreditCardBalance[]>([]);
  const [activity, setActivity] = useState<Record<number, CardActivity>>({});
  const [loading, setLoading]   = useState(true);
  const [showAll, setShowAll]   = useState<Record<number, boolean>>({});
  const [adjust, setAdjust]     = useState<AdjustState | null>(null);
  const [saving, setSaving]     = useState(false);
  const [flash, setFlash]       = useState<Record<number, string>>({});

  const loadCards = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/cc-balances');
    if (res.ok) {
      const data: CreditCardBalance[] = await res.json();
      setCards(data);
      const entries = await Promise.all(
        data.map(async (card) => {
          const r = await fetch(`/api/expenses?payment_method_id=${card.payment_method_id}`);
          const expenses: ExpenseWithRefs[] = r.ok ? await r.json() : [];
          return [card.payment_method_id, { expenses }] as [number, CardActivity];
        })
      );
      setActivity(Object.fromEntries(entries));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  async function handleAdjustSave() {
    if (!adjust) return;
    const balance = parseFloat(adjust.value);
    if (isNaN(balance)) return;
    setSaving(true);
    const res = await fetch('/api/cc-balances', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method_id: adjust.cardId, balance }),
    });
    if (res.ok) {
      setCards((prev) => prev.map((c) => c.payment_method_id === adjust.cardId ? { ...c, balance } : c));
      setFlash((f) => ({ ...f, [adjust.cardId]: 'Updated!' }));
      setTimeout(() => setFlash((f) => ({ ...f, [adjust.cardId]: '' })), 1500);
      setAdjust(null);
    } else {
      setFlash((f) => ({ ...f, [adjust.cardId]: 'Error' }));
      setTimeout(() => setFlash((f) => ({ ...f, [adjust.cardId]: '' })), 1500);
    }
    setSaving(false);
  }

  if (loading) return <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>;

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">No credit cards found. Add one in Settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Side-by-side summary cards ── */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div
            key={card.payment_method_id}
            className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-4 space-y-3"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{card.name}</span>
                <span className="rounded-full bg-purple-100 dark:bg-purple-900 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300">
                  Credit
                </span>
              </div>
            </div>

            {/* Balance */}
            <div className="text-center py-1">
              <p className={`text-2xl font-bold ${card.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {fmt(card.balance)}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">outstanding</p>
            </div>

            {/* Pie chart — category breakdown of charges */}
            <CardPieChart card={card} activity={activity[card.payment_method_id]} />

            {/* Progress bar */}
            {card.open_charges > 0 && (
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${Math.min((card.open_payments / card.open_charges) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                  <span>Paid {fmt(card.open_payments)}</span>
                  <span>{Math.round((card.open_payments / card.open_charges) * 100)}%</span>
                </div>
              </div>
            )}

            {/* Adjust balance */}
            {adjust?.cardId === card.payment_method_id ? (
              <div className="flex gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Set balance"
                  value={adjust.value}
                  onChange={(e) => setAdjust({ ...adjust, value: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdjustSave()}
                  autoFocus
                  className={inputCls}
                />
                <button
                  onClick={handleAdjustSave}
                  disabled={saving}
                  className="shrink-0 rounded-lg bg-gray-800 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {saving ? '...' : 'Save'}
                </button>
                <button
                  onClick={() => setAdjust(null)}
                  className="shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAdjust({ cardId: card.payment_method_id, value: String(card.balance) })}
                  className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Adjust balance
                </button>
                {flash[card.payment_method_id] && (
                  <span className="text-xs font-medium text-emerald-500">{flash[card.payment_method_id]}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Activity tables (one per card, full width) ── */}
      {cards.map((card) => {
        const cardActivity = activity[card.payment_method_id];
        const charges  = (cardActivity?.expenses ?? []).filter((e) => !e.cc_payment_target_id);
        const payments = (cardActivity?.expenses ?? []).filter((e) => e.cc_payment_target_id === card.payment_method_id);
        const expanded = showAll[card.payment_method_id] ?? false;
        const visibleCharges  = expanded ? charges  : charges.slice(0, 5);
        const visiblePayments = expanded ? payments : payments.slice(0, 5);
        const hasMore = charges.length > 5 || payments.length > 5;

        if (charges.length === 0 && payments.length === 0) return null;

        return (
          <div key={card.payment_method_id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {card.name} — Recent Activity
              </p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {visibleCharges.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Charges</p>
                  <div className="space-y-1">
                    {visibleCharges.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <div>
                          <span className="text-gray-800 dark:text-gray-200">{e.category_name}</span>
                          {e.notes && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{e.notes}</span>}
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{e.date}</span>
                        </div>
                        <span className="font-semibold text-red-500">+{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {visiblePayments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Payments</p>
                  <div className="space-y-1">
                    {visiblePayments.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <div>
                          <span className="text-gray-800 dark:text-gray-200">Payment</span>
                          {e.payment_method_name && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">via {e.payment_method_name}</span>}
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{e.date}</span>
                        </div>
                        <span className="font-semibold text-emerald-500">-{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hasMore && (
                <button
                  onClick={() => setShowAll((s) => ({ ...s, [card.payment_method_id]: !expanded }))}
                  className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  {expanded ? 'Show less' : `Show all (${charges.length + payments.length} transactions)`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Per-card pie chart ──────────────────────────────────────────────────────
// • Has charges  → category breakdown of spending on the card
// • No charges, but has payments or outstanding balance → paid vs outstanding donut
// • Nothing at all → empty state
function CardPieChart({ card, activity }: { card: CreditCardBalance; activity?: CardActivity }) {
  const charges  = (activity?.expenses ?? []).filter((e) => !e.cc_payment_target_id);
  const payments = (activity?.expenses ?? []).filter((e) => e.cc_payment_target_id === card.payment_method_id);

  // ── Category breakdown (preferred when purchases exist) ──
  if (charges.length > 0) {
    const byCategory: Record<string, number> = {};
    for (const e of charges) {
      byCategory[e.category_name] = (byCategory[e.category_name] ?? 0) + e.amount;
    }
    const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

    return (
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={2} dataKey="value">
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#f3f4f6' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Paid vs outstanding (when only payments exist) ──
  const totalPaid = payments.reduce((s, e) => s + e.amount, 0);
  const outstanding = Math.max(card.balance, 0);

  if (totalPaid > 0 || outstanding > 0) {
    const pieData = [
      ...(totalPaid    > 0 ? [{ name: 'Paid',        value: totalPaid    }] : []),
      ...(outstanding  > 0 ? [{ name: 'Outstanding', value: outstanding  }] : []),
    ];
    const segColor = (name: string) => name === 'Paid' ? '#10b981' : '#ef4444';

    return (
      <div className="h-28 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={2} dataKey="value">
              {pieData.map((entry, i) => <Cell key={i} fill={segColor(entry.name)} />)}
            </Pie>
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#f3f4f6' }} />
          </PieChart>
        </ResponsiveContainer>
        {outstanding === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs font-semibold text-emerald-500">Paid off</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-28 flex items-center justify-center">
      <p className="text-xs text-gray-400 dark:text-gray-500">No activity yet</p>
    </div>
  );
}
