import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface QualifiedPersonInfo {
  managerName: string | null;
  managerEmail: string | null;
}

export function useQualifiedPerson(userEmail: string | null) {
  const [qpInfo, setQpInfo] = useState<QualifiedPersonInfo>({
    managerName: null,
    managerEmail: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userEmail) {
      setQpInfo({ managerName: null, managerEmail: null });
      return;
    }

    const fetchQPInfo = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('user_management')
          .select('manager_display_name, manager_email_lookup')
          .eq('business_email_lookup', userEmail)
          .maybeSingle();

        if (queryError) {
          throw queryError;
        }

        if (data) {
          setQpInfo({
            managerName: data.manager_display_name || null,
            managerEmail: data.manager_email_lookup || null,
          });
        } else {
          setQpInfo({ managerName: null, managerEmail: null });
        }
      } catch (err) {
        console.error('Error fetching QP info:', err);
        setError('Failed to fetch manager information');
        setQpInfo({ managerName: null, managerEmail: null });
      } finally {
        setLoading(false);
      }
    };

    fetchQPInfo();
  }, [userEmail]);

  return { qpInfo, loading, error };
}
