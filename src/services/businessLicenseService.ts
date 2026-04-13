import { supabase } from '../lib/supabase';
import { subsidiaryMatches } from './licensingService';

export interface BusinessLicense {
  licenseNumber: string;
  spItemId: string;
  countyCityTitle: string | null;
}

export async function getBusinessLicenses(
  subsidiary: string,
  state: string,
  countyCityTitle?: string
): Promise<BusinessLicense[]> {
  const { data, error } = await supabase
    .from("business_license_cache")
    .select("license_number, sp_item_id, subsidiary, state, county_city_title")
    .in("status", ["Active", "Pending"]);

  if (error || !data) {
    console.error("Error fetching business licenses:", error);
    return [];
  }

  const filtered = data.filter(row => {
    if (!subsidiaryMatches(row.subsidiary, subsidiary)) return false;

    if (row.state?.trim().toLowerCase() !== state.trim().toLowerCase()) return false;

    if (countyCityTitle) {
      if (row.county_city_title?.trim().toLowerCase() !== countyCityTitle.trim().toLowerCase()) return false;
    }

    return true;
  });

  const licenses: BusinessLicense[] = [];
  const seen = new Set<string>();

  for (const row of filtered) {
    if (row.license_number && !seen.has(row.license_number)) {
      seen.add(row.license_number);
      licenses.push({
        licenseNumber: row.license_number,
        spItemId: row.sp_item_id,
        countyCityTitle: row.county_city_title,
      });
    }
  }

  return licenses.sort((a, b) => a.licenseNumber.localeCompare(b.licenseNumber));
}
