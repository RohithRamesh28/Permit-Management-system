import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { triggerJobSyncIfNeeded } from '../services/jobSync';

interface SharePointJob {
  job_title: string;
}

const BATCH_SIZE = 1000;

async function fetchAllJobs(): Promise<string[]> {
  const allJobs: string[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('sharepoint_jobs_cache')
      .select('job_title')
      .order('job_title', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      const titles = data.map((item: SharePointJob) => item.job_title);
      allJobs.push(...titles);
      offset += data.length;
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allJobs;
}

export function useSharePointJobs() {
  const [jobs, setJobs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchJobs() {
      try {
        console.log('Fetching SharePoint jobs from cache...');
        triggerJobSyncIfNeeded().catch(() => {});

        const jobTitles = await fetchAllJobs();

        if (!mounted) return;

        console.log(`Loaded ${jobTitles.length} job titles`);
        setJobs(jobTitles);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        console.error('Error fetching jobs:', err);
        setError('Failed to load jobs');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchJobs();

    return () => {
      mounted = false;
    };
  }, []);

  return { jobs, loading, error };
}
