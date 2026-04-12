import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CRON_SECRET = process.env.CRON_SECRET;
const ATTACHMENT_BUCKET = 'email-attachments-private';
const BATCH_SIZE = 50;

function isAuthorized(request) {
  const authHeader = request.headers.get('authorization') || '';
  const expected = `Bearer ${CRON_SECRET}`;
  return !!CRON_SECRET && authHeader === expected;
}

export async function GET(request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const nowIso = new Date().toISOString();

    const { data: expiredMailboxes, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('id')
      .eq('is_active', true)
      .lte('expires_at', nowIso)
      .limit(BATCH_SIZE);

    if (mailboxError) {
      console.error('Expired mailbox fetch error:', mailboxError);
      return NextResponse.json({ error: 'Failed to fetch expired mailboxes' }, { status: 500 });
    }

    if (!expiredMailboxes || expiredMailboxes.length === 0) {
      return NextResponse.json({
        success: true,
        cleaned_mailboxes: 0,
        cleaned_emails: 0,
        cleaned_attachments: 0,
        deleted_storage_files: 0,
      });
    }

    const mailboxIds = expiredMailboxes.map((m) => m.id);

    const { data: emails, error: emailsError } = await supabase
      .from('emails')
      .select('id, mailbox_id')
      .in('mailbox_id', mailboxIds);

    if (emailsError) {
      console.error('Expired email fetch error:', emailsError);
      return NextResponse.json({ error: 'Failed to fetch expired emails' }, { status: 500 });
    }

    const emailIds = (emails || []).map((e) => e.id);

    let attachments = [];
    if (emailIds.length > 0) {
      const { data: attachmentRows, error: attachmentsError } = await supabase
        .from('attachments')
        .select('id, storage_path, email_id')
        .in('email_id', emailIds);

      if (attachmentsError) {
        console.error('Expired attachment fetch error:', attachmentsError);
        return NextResponse.json({ error: 'Failed to fetch expired attachments' }, { status: 500 });
      }

      attachments = attachmentRows || [];
    }

    const storagePaths = attachments
      .map((a) => a.storage_path)
      .filter(Boolean);

    let deletedStorageFiles = 0;

    if (storagePaths.length > 0) {
      const { data: removedFiles, error: removeError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove(storagePaths);

      if (removeError) {
        console.error('Storage delete error:', removeError);
        return NextResponse.json({ error: 'Failed to delete attachment files' }, { status: 500 });
      }

      deletedStorageFiles = removedFiles?.length || 0;
    }

    if (attachments.length > 0) {
      const attachmentIds = attachments.map((a) => a.id);

      const { error: deleteAttachmentsError } = await supabase
        .from('attachments')
        .delete()
        .in('id', attachmentIds);

      if (deleteAttachmentsError) {
        console.error('Attachment row delete error:', deleteAttachmentsError);
        return NextResponse.json({ error: 'Failed to delete attachment rows' }, { status: 500 });
      }
    }

    if (emailIds.length > 0) {
      const { error: deleteEmailsError } = await supabase
        .from('emails')
        .delete()
        .in('id', emailIds);

      if (deleteEmailsError) {
        console.error('Expired email delete error:', deleteEmailsError);
        return NextResponse.json({ error: 'Failed to delete expired emails' }, { status: 500 });
      }
    }

    const { error: deactivateMailboxError } = await supabase
      .from('mailboxes')
      .update({ is_active: false })
      .in('id', mailboxIds);

    if (deactivateMailboxError) {
      console.error('Mailbox deactivate error:', deactivateMailboxError);
      return NextResponse.json({ error: 'Failed to deactivate expired mailboxes' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      cleaned_mailboxes: mailboxIds.length,
      cleaned_emails: emailIds.length,
      cleaned_attachments: attachments.length,
      deleted_storage_files: deletedStorageFiles,
    });
  } catch (err) {
    console.error('Cleanup route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}