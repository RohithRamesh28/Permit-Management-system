import { supabase } from '../lib/supabase';

export interface JobDetails {
  division: string | null;
  carrier: string | null;
}

export async function fetchJobDetailsByTitle(jobTitle: string): Promise<JobDetails> {
  try {
    const { data, error } = await supabase
      .from('sharepoint_jobs_cache')
      .select('all_fields')
      .eq('job_title', jobTitle)
      .maybeSingle();

    if (error) {
      console.error('Error fetching job details:', error);
      throw error;
    }

    if (!data || !data.all_fields) {
      return { division: null, carrier: null };
    }

    const allFields = data.all_fields as Record<string, any>;

    const division = allFields.Division || null;
    const carrier = allFields.Carrier || null;

    return { division, carrier };
  } catch (error) {
    console.error('Failed to fetch job details:', error);
    return { division: null, carrier: null };
  }
}
