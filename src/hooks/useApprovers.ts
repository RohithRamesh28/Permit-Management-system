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
          .select('employee_first_name, employee_last_name, business_email, manager_electronic_address, division_manager_escalation')
          .order('employee_first_name', { ascending: true });

        if (queryError) {
          throw queryError;
        }

        if (data) {
          const approversList: ApproverInfo[] = data
            .filter((row) => row.employee_first_name && row.employee_last_name && row.business_email)
            .map((row) => ({
              fullName: `${row.employee_first_name} ${row.employee_last_name}`,
              businessEmail: row.business_email,
              managerEmail: row.manager_electronic_address || null,
              divisionManagerEmail: row.division_manager_escalation || null,
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
