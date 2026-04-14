'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PLAN_LABELS = {
  free: 'Ghost',
  ghost: 'Ghost',
  phantom: 'Phantom',
  spectre: 'Spectre',
};

function getExpectedPlan() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const plan = String(params.get('plan') || '').toLowerCase();
  if (plan === 'phantom' || plan === 'spectre') return plan;
  return null;
}

export default function SuccessPage() {
  const [status, setStatus] = useState('checking');
  const [user, setUser] = useState(null);
  const [currentPlan, setCurrentPlan] = useState('ghost');
  const [expectedPlan, setExpectedPlan] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');

  const currentPlanLabel = useMemo(() => {
    return PLAN_LABELS[String(currentPlan || 'ghost').toLowerCase()] || 'Ghost';
  }, [currentPlan]);

  const expectedPlanLabel = useMemo(() => {
    return PLAN_LABELS[String(expectedPlan || '').toLowerCase()] || '';
  }, [expectedPlan]);

  useEffect(() => {
    let mounted = true;
    let pollInterval = null;
    let secondsInterval = null;

    async function syncPlanStatus() {
      try {
        setError('');

        const expected = getExpectedPlan();
        if (mounted) setExpectedPlan(expected);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session?.user) {
          setStatus('guest');
          return;
        }

        setUser(session.user);

        // 🔥 CALL FALLBACK SYNC (IMPORTANT)
        try {
          await fetch('/api/sync-plan', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + session.access_token,
            },
          });
        } catch (e) {
          console.warn('Fallback sync failed (non-critical)');
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const nextPlan = String(profile?.plan || 'ghost').toLowerCase();
        setCurrentPlan(nextPlan);

        if (expected && nextPlan === expected) {
          setStatus('upgraded');
          if (pollInterval) clearInterval(pollInterval);
          if (secondsInterval) clearInterval(secondsInterval);
          return;
        }

        if (!expected && (nextPlan === 'phantom' || nextPlan === 'spectre')) {
          setStatus('upgraded');
          if (pollInterval) clearInterval(pollInterval);
          if (secondsInterval) clearInterval(secondsInterval);
          return;
        }

        setStatus('waiting');
      } catch (err) {
        console.error('Success sync error:', err);
        if (!mounted) return;
        setError(err.message || 'Failed to sync your plan');
        setStatus('error');
      }
    }

    syncPlanStatus();

    pollInterval = setInterval(syncPlanStatus, 4000);
    secondsInterval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (secondsInterval) clearInterval(secondsInterval);
    };
  }, []);

  async function handleRefreshNow() {
    setStatus('checking');
    setError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setStatus('guest');
        return;
      }

      setUser(session.user);

      // 🔥 ALSO SYNC ON MANUAL REFRESH
      await fetch('/api/sync-plan', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.access_token,
        },
      });

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', session.user.id)
        .maybeSingle();

      const nextPlan = String(profile?.plan || 'ghost').toLowerCase();
      setCurrentPlan(nextPlan);

      const expected = getExpectedPlan();
      setExpectedPlan(expected);

      if (expected && nextPlan === expected) {
        setStatus('upgraded');
        return;
      }

      setStatus('waiting');
    } catch (err) {
      console.error(err);
      setError('Failed to refresh');
      setStatus('error');
    }
  }

  return (
    <main style={{ padding: 40, textAlign: 'center' }}>
      <h1>{status === 'upgraded' ? '✅ Upgrade successful' : '⏳ Syncing your plan...'}</h1>

      <p>Current: {currentPlanLabel}</p>
      <p>Expected: {expectedPlanLabel || 'Checking...'}</p>

      <p>Time: {seconds}s</p>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ marginTop: 20 }}>
        <button onClick={handleRefreshNow}>Refresh</button>
        <br /><br />
        <a href="/dashboard">Go to dashboard</a>
      </div>
    </main>
  );
}