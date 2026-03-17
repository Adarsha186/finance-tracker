'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Category, PaymentMethod, WeekSummary } from '@/types';

interface UseWeekDataReturn {
  weeks: WeekSummary[];
  categories: Category[];
  methods: PaymentMethod[];
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Fetches all data needed for the home page in parallel:
 * weekly summaries, expense categories, and payment methods.
 */
export function useWeekData(): UseWeekDataReturn {
  const [weeks, setWeeks]           = useState<WeekSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [methods, setMethods]       = useState<PaymentMethod[]>([]);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, catRes, pmRes] = await Promise.all([
        fetch('/api/summary'),
        fetch('/api/categories'),
        fetch('/api/payment-methods'),
      ]);
      if (!sumRes.ok || !catRes.ok || !pmRes.ok) throw new Error('Failed to load data');
      const [sum, cats, pms] = await Promise.all([
        sumRes.json(),
        catRes.json(),
        pmRes.json(),
      ]);
      setWeeks(Array.isArray(sum)  ? sum  : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setMethods(Array.isArray(pms)  ? pms  : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { weeks, categories, methods, loading, reload: load };
}
