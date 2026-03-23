import { useState, useEffect } from 'react';
import { fetchJobDetailsByTitle, JobDetails } from '../services/sharePointJobDetails';

export function useSharePointJobDetails(jobTitle: string | null) {
  const [details, setDetails] = useState<JobDetails>({ division: null, carrier: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobTitle) {
      setDetails({ division: null, carrier: null });
      setLoading(false);
      setError(null);
      return;
    }

    let mounted = true;

    async function fetchDetails() {
      setLoading(true);
      setError(null);

      try {
        const jobDetails = await fetchJobDetailsByTitle(jobTitle);

        if (!mounted) return;

        setDetails(jobDetails);
      } catch (err) {
        if (!mounted) return;
        console.error('Error fetching job details:', err);
        setError('Failed to load job details');
        setDetails({ division: null, carrier: null });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchDetails();

    return () => {
      mounted = false;
    };
  }, [jobTitle]);

  return { details, loading, error };
}
