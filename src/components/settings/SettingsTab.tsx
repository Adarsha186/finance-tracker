'use client';

import { useState, useEffect } from 'react';
import { selectCls } from '@/styles/inputs';

const fieldCls =
  'min-w-0 flex-1 rounded-lg border border-gray-300 dark:border-gray-600 ' +
  'bg-white dark:bg-gray-800 px-3 py-2 text-sm ' +
  'text-gray-900 dark:text-gray-100 ' +
  'placeholder-gray-400 dark:placeholder-gray-500 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
import type { Category, PaymentMethod } from '@/types';

export function SettingsTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [methods, setMethods]       = useState<PaymentMethod[]>([]);

  async function load() {
    const [cats, pms] = await Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/payment-methods').then((r) => r.json()),
    ]);
    setCategories(cats);
    setMethods(pms);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="grid grid-cols-2 gap-6 items-start">
      <CategorySection categories={categories} reload={load} />
      <PaymentMethodSection methods={methods} reload={load} />
    </div>
  );
}

// ─── Categories ────────────────────────────────────────────────────────────────

function CategorySection({ categories, reload }: { categories: Category[]; reload: () => void }) {
  const [name, setName]           = useState('');
  const [isTransfer, setIsTransfer] = useState(false);
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, is_transfer: isTransfer }),
    });
    if (res.ok) {
      setName('');
      setIsTransfer(false);
      reload();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to add');
    }
    setSaving(false);
  }

  async function toggleTransfer(id: number, current: 0 | 1) {
    const res = await fetch('/api/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_transfer: !current }),
    });
    if (res.ok) reload();
    else setError('Failed to update category');
  }

  async function remove(id: number) {
    const res = await fetch('/api/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) reload();
    else {
      const data = await res.json();
      setError(data.error ?? 'Failed to delete');
    }
  }

  const real      = categories.filter((c) => !c.is_transfer);
  const transfers = categories.filter((c) =>  c.is_transfer);

  return (
    <Section title="Expense Categories" icon="🗂️">

      {/* Add form */}
      <div className="flex gap-2">
        <input
          className={fieldCls}
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button
          onClick={add}
          disabled={saving || !name.trim()}
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium transition-colors shrink-0"
        >
          Add
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isTransfer}
          onChange={(e) => setIsTransfer(e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-600"
        />
        Mark as transfer (e.g. Savings — excluded from expenses)
      </label>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {real.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Expense</p>
          {real.map((c) => (
            <ItemRow key={c.id} label={c.name} onDelete={() => remove(c.id)}
              onToggleTransfer={() => toggleTransfer(c.id, c.is_transfer)} transferLabel="Mark as transfer" />
          ))}
        </div>
      )}

      {transfers.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Transfer</p>
          {transfers.map((c) => (
            <ItemRow key={c.id} label={c.name} badge="transfer" onDelete={() => remove(c.id)}
              onToggleTransfer={() => toggleTransfer(c.id, c.is_transfer)} transferLabel="Mark as expense" />
          ))}
        </div>
      )}

    </Section>
  );
}

// ─── Payment Methods ───────────────────────────────────────────────────────────

function PaymentMethodSection({ methods, reload }: { methods: PaymentMethod[]; reload: () => void }) {
  const [name, setName]   = useState('');
  const [type, setType]   = useState<'credit' | 'debit'>('debit');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    const res = await fetch('/api/payment-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type }),
    });
    if (res.ok) {
      setName('');
      reload();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to add');
    }
    setSaving(false);
  }

  async function remove(id: number) {
    const res = await fetch('/api/payment-methods', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      reload();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to delete');
    }
  }

  const credits = methods.filter((m) => m.type === 'credit');
  const debits  = methods.filter((m) => m.type === 'debit');

  return (
    <Section title="Payment Methods" icon="💳">

      {/* Add form */}
      <div className="space-y-2">
        <input
          className={fieldCls + ' w-full'}
          placeholder="Card / account name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'credit' | 'debit')}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
          <button
            onClick={add}
            disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium transition-colors shrink-0"
          >
            Add
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {credits.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Credit</p>
          {credits.map((m) => (
            <ItemRow key={m.id} label={m.name} badge="credit" onDelete={() => remove(m.id)} />
          ))}
        </div>
      )}

      {debits.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Debit</p>
          {debits.map((m) => (
            <ItemRow key={m.id} label={m.name} badge="debit" onDelete={() => remove(m.id)} />
          ))}
        </div>
      )}

    </Section>
  );
}

// ─── Shared primitives ─────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <span>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  credit:   'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
  debit:    'bg-blue-100   dark:bg-blue-900/40   text-blue-600   dark:text-blue-400',
  transfer: 'bg-amber-100  dark:bg-amber-900/40  text-amber-600  dark:text-amber-400',
};

function ItemRow({ label, badge, onDelete, onToggleTransfer, transferLabel }: {
  label: string;
  badge?: string;
  onDelete: () => void;
  onToggleTransfer?: () => void;
  transferLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 group">
      <div className="flex items-center gap-2">
        {badge && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badgeStyles[badge] ?? ''}`}>
            {badge}
          </span>
        )}
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {onToggleTransfer && (
          <button
            onClick={onToggleTransfer}
            className="text-[10px] px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-amber-400 hover:text-amber-500 transition-colors"
          >
            {transferLabel}
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
          aria-label={`Delete ${label}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
