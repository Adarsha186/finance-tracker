'use client';

import { useEffect, useState } from 'react';

type Expense = {
  id: number;
  amount: number;
  category_name: string;
  payment_method_name: string | null;
  date: string;
  notes: string | null;
};

type Category = { id: number; name: string };
type PaymentMethod = { id: number; name: string };

export default function TestPage() {
  const [expenses, setExpenses]       = useState<Expense[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [methods, setMethods]         = useState<PaymentMethod[]>([]);
  const [status, setStatus]           = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);

  // Form state
  const [amount, setAmount]           = useState('');
  const [categoryId, setCategoryId]   = useState('');
  const [methodId, setMethodId]       = useState('');
  const [date, setDate]               = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes]             = useState('');

  async function fetchAll() {
    setLoading(true);
    try {
      const expRes = await fetch('/api/expenses');
      const expData = await expRes.json();
      setExpenses(Array.isArray(expData) ? expData.slice(0, 10) : []);
    } catch { setExpenses([]); }

    try {
      const catRes = await fetch('/api/categories');
      const catData = await catRes.json();
      setCategories(Array.isArray(catData) ? catData : []);
    } catch { setCategories([]); }

    try {
      const pmRes = await fetch('/api/payment-methods');
      const pmData = await pmRes.json();
      setMethods(Array.isArray(pmData) ? pmData : []);
    } catch { setMethods([]); }

    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Saving...');

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(amount),
        category_id: parseInt(categoryId),
        payment_method_id: methodId ? parseInt(methodId) : null,
        date,
        notes: notes || null,
      }),
    });

    if (res.ok) {
      setStatus('✓ Saved to Turso DB!');
      setAmount(''); setNotes('');
      fetchAll();
    } else {
      const err = await res.json();
      setStatus(`✗ Error: ${err.error}`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">DB Connection Test</h1>
          <p className="text-sm text-gray-500 mt-1">Add a record and confirm it appears below — verifying Turso is connected.</p>
        </div>

        {/* Add expense form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Add Test Expense</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Amount</label>
              <input
                type="number" step="0.01" required value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Date</label>
              <input
                type="date" required value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Category</label>
              <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Payment Method</label>
              <select value={methodId} onChange={(e) => setMethodId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None</option>
                {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Notes (optional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. test entry"
            />
          </div>

          <div className="flex items-center gap-4">
            <button type="submit"
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Save to DB
            </button>
            {status && (
              <span className={`text-sm font-medium ${status.startsWith('✓') ? 'text-green-600' : status === 'Saving...' ? 'text-gray-500' : 'text-red-600'}`}>
                {status}
              </span>
            )}
          </div>
        </form>

        {/* Latest records */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Latest 10 Expenses from DB</h2>
          {loading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-gray-400">No records found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {expenses.map((e) => (
                  <tr key={e.id} className="py-2">
                    <td className="py-2 text-gray-600">{e.date}</td>
                    <td className="py-2 text-gray-800">{e.category_name}</td>
                    <td className="py-2 text-gray-500">{e.payment_method_name ?? '—'}</td>
                    <td className="py-2 text-right font-medium text-gray-900">${Number(e.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
