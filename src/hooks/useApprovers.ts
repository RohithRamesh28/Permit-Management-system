import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ApproverInfo {
  fullName: string;
  businessEmail: string;
  managerEmail: string | null;
  divisionManagerEmail: string | null;
}

export function useApprovers() {
  const [approvers, setApprovers] = useState<ApproverInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApprovers = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('user_management')
          .select('employee_display_name, business_email_lookup, manager_email_lookup, division_manager_email_lookup')
          .order('employee_display_name', { ascending: true });

        if (queryError) {
          throw queryError;
        }

        if (data) {
          const approversList: ApproverInfo[] = data
            .filter((row) => row.employee_display_name && row.business_email_lookup)
            .map((row) => ({
              fullName: row.employee_display_name,
              businessEmail: row.business_email_lookup,
              managerEmail: row.manager_email_lookup || null,
              divisionManagerEmail: row.division_manager_email_lookup || null,
            }));

          setApprovers(approversList);
        }
      } catch (err) {
        console.error('Error fetching approvers:', err);
        setError('Failed to fetch approvers');
        setApprovers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovers();
  }, []);

  return { approvers, loading, error };
}
