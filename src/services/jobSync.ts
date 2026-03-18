import { supabase } from '../lib/supabase';

const SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000;

export async function triggerJobSyncIfNeeded(): Promise<void> {
  try {
    const { data } = await supabase
      .from('sync_metadata')
      .select('last_synced_at, status')
      .eq('sync_type', 'sharepoint_jobs')
      .maybeSingle();

    const now = Date.now();
    const lastSynced = data?.last_synced_at
      ? new Date(data.last_synced_at).getTime()
      : 0;
    const isStale = now - lastSynced > SYNC_INTERVAL_MS;
    const isRunning = data?.status === 'in_progress';

    if (!isStale || isRunning) return;

    const apiUrl = 'https://jvsyugwllozxglydamgq.supabase.co/functions/v1/sync-sharepoint-jobs';

    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c3l1Z3dsbG96eGdseWRhbWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTQ1OTAsImV4cCI6MjA4ODg5MDU5MH0.me9ZyGuAGSB7jHwzjXMaGaQHsiHWgTwZ8haM-s_9_Qw',
        'Content-Type': 'application/json',
      },
    }).catch((err) => console.error('Background sync failed:', err));
  } catch (error) {
    console.error('Error checking sync status:', error);
  }
}
