import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface QualifiedPersonInfo {
  managerEmail: string | null;
}

export function useQualifiedPerson(userEmail: string | null) {
  const [qpInfo, setQpInfo] = useState<QualifiedPersonInfo>({
    managerEmail: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userEmail) {
      setQpInfo({ managerEmail: null });
      return;
    }

    const fetchQPInfo = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('user_management')
          .select('manager_email_lookup')
          .eq('business_email_lookup', userEmail)
          .maybeSingle();

        if (queryError) {
          throw queryError;
        }

        if (data) {
          setQpInfo({
            managerEmail: data.manager_email_lookup || null,
          });
        } else {
          setQpInfo({ managerEmail: null });
        }
      } catch (err) {
        console.error('Error fetching QP info:', err);
        setError('Failed to fetch manager information');
        setQpInfo({ managerEmail: null });
      } finally {
        setLoading(false);
      }
    };

    fetchQPInfo();
  }, [userEmail]);

  return { qpInfo, loading, error };
}
