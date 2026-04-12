'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function InboxPage() {
  const [emails, setEmails] = useState([]);
  const [selected, setSelected] = useState(null);
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
  }, []);

  const fetchAttachmentBlob = useCallback(
  async (file) => {
    try {
      if (!file?.id || !file?.storage_path) {
        throw new Error('Missing attachment path');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Missing session');
      }

      const response = await fetch(
        `/api/files/${encodeURIComponent(file.storage_path)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to fetch attachment');
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('Attachment fetch error:', err);
      throw err;
    }
  },
  []
);

  const openAttachment = async (file) => {
    try {
      const url = await fetchAttachmentBlob(file);
      window.open(url, '_blank');
    } catch {
      alert('Failed to open attachment');
    }
  };

  const downloadAttachment = async (file) => {
    try {
      const url = await fetchAttachmentBlob(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename || 'download';
      a.click();
    } catch {
      alert('Failed to download');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      {emails.map((email) => (
        <div key={email.id}>
          <h3>{email.subject}</h3>

          {email.attachments?.map((file) => (
            <div key={file.id} style={{ marginBottom: 10 }}>
              <div>{file.filename}</div>

              <button onClick={() => openAttachment(file)}>
                Open
              </button>

              <button onClick={() => downloadAttachment(file)}>
                Download
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}