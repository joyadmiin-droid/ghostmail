import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CRON_SECRET = process.env.CRON_SECRET;
const REPLAY_RETENTION_DAYS = 30;

function isAuthorized(request) {
  const authHeader = request.headers.get('authorization') || '';

  if (!CRON_SECRET) return false;

  return authHeader === `Bearer ${CRON_SECRET}`;
}

export async function GET(request) {
  try {
    if (!CRON_SECRET) {
      return NextResponse.json(
        { error: 'Missing CRON_SECRET' },
        { status: 500 }
      );
    }

    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const replayCutoff = new Date(
      now.getTime() - REPLAY_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const replayCutoffIso = replayCutoff.toISOString();
    const replayCutoffSec = Math.floor(replayCutoff.getTime() / 1000);

    // 1) Deactivate expired mailboxes
    const { data: expiredMailboxes, error: expiredMailboxesError } = await supabase
      .from('mailboxes')
      .update({ is_active: false })
      .eq('is_active', true)
      .lte('expires_at', nowIso)
      .select('id');

    if (expiredMailboxesError) {
      console.error('Failed to deactivate expired mailboxes:', expiredMailboxesError);
      return NextResponse.json(
        { error: 'Failed to deactivate expired mailboxes' },
        { status: 500 }
      );
    }

    // 2) Clean old Mailgun replay tokens
    const { error: replayGuardError } = await supabase
      .from('webhook_replay_guard')
      .delete()
      .lt('timestamp_sec', replayCutoffSec);

    if (replayGuardError) {
      console.error('Failed to clean webhook_replay_guard:', replayGuardError);
      return NextResponse.json(
        { error: 'Failed to clean webhook replay guard' },
        { status: 500 }
      );
    }

    // 3) Clean old Lemon replay rows
    const { error: processedWebhooksError } = await supabase
      .from('processed_webhooks')
      .delete()
      .lt('created_at', replayCutoffIso);

    if (processedWebhooksError) {
      console.error('Failed to clean processed_webhooks:', processedWebhooksError);
      return NextResponse.json(
        { error: 'Failed to clean processed webhooks' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deactivated_mailboxes: expiredMailboxes?.length || 0,
      replay_guard_deleted_before: replayCutoffSec,
      processed_webhooks_deleted_before: replayCutoffIso,
      ran_at: nowIso,
    });
  } catch (err) {
    console.error('Cleanup cron failed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}