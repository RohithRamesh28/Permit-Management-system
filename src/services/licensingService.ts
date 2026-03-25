import { supabase } from '../lib/supabase';

const SUBSIDIARY_MAPPING: Record<string, string[]> = {
  'ETT': ['EasTex Tower LLC', 'EasTex Tower', 'ETT'],
  'CMS': ['CMS Wireless LLC', 'CMS Wireless', 'CMS'],
  'ETR': ['Enertech Resources LLC', 'Enertech', 'ETR'],
  'LEG': ['Legacy Telecommunications LLC', 'Legacy', 'LEG'],
  'MW': ['Mountain Wireless LLC', 'Mountain Wireless', 'MW'],
  'ONT': ['Ontivity LLC', 'Ontivity', 'ONT'],
};

export function selectSourceList(
  permitLevel: "State" | "CountyCity",
  permitType: "General" | "Electrical" | "Specialty"
): string {
  if (permitLevel === "State") {
    return permitType === "Electrical" ? "state_electrical" : "state_contractor";
  } else {
    return permitType === "Electrical" ? "county_electrical" : "county_contractor";
  }
}

export function validateLicenseType(
  licenseType: string | null,
  permitType: "General" | "Electrical" | "Specialty"
): boolean {
  if (!licenseType) return false;

  const licenseTypeLower = licenseType.toLowerCase();

  if (permitType === "Electrical") {
    return licenseTypeLower.includes("electric");
  } else if (permitType === "General") {
    return licenseTypeLower.includes("general");
  } else if (permitType === "Specialty") {
    return licenseTypeLower.includes("specialty");
  }

  return false;
}

export function normalizeSubsidiary(input: string): string[] {
  const normalized = input.trim();

  for (const [key, aliases] of Object.entries(SUBSIDIARY_MAPPING)) {
    for (const alias of aliases) {
      if (normalized.toLowerCase() === alias.toLowerCase() ||
          normalized.toLowerCase().includes(alias.toLowerCase()) ||
          alias.toLowerCase().includes(normalized.toLowerCase())) {
        return aliases;
      }
    }
  }

  return [normalized];
}

export function subsidiaryMatches(spValue = "", jobValue = ""): boolean {
  if (!spValue || !jobValue) return false;

  const spAliases = normalizeSubsidiary(spValue);
  const jobAliases = normalizeSubsidiary(jobValue);

  for (const spAlias of spAliases) {
    for (const jobAlias of jobAliases) {
      const a = spAlias.toLowerCase().trim();
      const b = jobAlias.toLowerCase().trim();
      if (a === b || a.includes(b) || b.includes(a)) {
        return true;
      }
    }
  }

  return false;
}

export async function getAvailableStates(
  permitLevel: "State" | "CountyCity",
  permitType: "General" | "Electrical" | "Specialty",
  subsidiary: string
): Promise<string[]> {
  const sourceList = selectSourceList(permitLevel, permitType);

  console.log('[getAvailableStates] Query params:', { permitLevel, permitType, subsidiary, sourceList });

  const { data, error } = await supabase
    .from("licensing_cache")
    .select("state, subsidiary, license_type")
    .eq("source_list", sourceList)
    .in("status", ["Active", "Pending"]);

  if (error || !data) {
    console.error("Error fetching states:", error);
    return [];
  }

  console.log('[getAvailableStates] Raw data count:', data.length);
  console.log('[getAvailableStates] Sample subsidiaries from DB:', [...new Set(data.map(r => r.subsidiary))].slice(0, 5));

  const filtered = data.filter(row => {
    const subsidiarMatch = subsidiaryMatches(row.subsidiary, subsidiary);
    const licenseTypeMatch = validateLicenseType(row.license_type, permitType);

    if (subsidiarMatch && licenseTypeMatch) {
      console.log('[getAvailableStates] Match found:', {
        dbSubsidiary: row.subsidiary,
        formSubsidiary: subsidiary,
        licenseType: row.license_type,
        permitType
      });
    }
    return subsidiarMatch && licenseTypeMatch;
  });

  console.log('[getAvailableStates] Filtered count:', filtered.length);

  const states = [...new Set(filtered.map(r => r.state?.trim()).filter(Boolean))].sort();
  console.log('[getAvailableStates] Final states:', states);

  return states;
}

export async function getCountyCityOptions(
  permitType: "General" | "Electrical" | "Specialty",
  subsidiary: string,
  state: string
): Promise<Array<{ title: string; qpName: string | null; qpEmail: string | null; spItemId: string | null }>> {
  const sourceList = selectSourceList("CountyCity", permitType);

  console.log('[getCountyCityOptions] Query params:', { permitType, subsidiary, state, sourceList });

  const { data, error } = await supabase
    .from("licensing_cache")
    .select("county_city_title, subsidiary, qp_name, qp_email, sp_item_id, state, license_type")
    .eq("source_list", sourceList)
    .in("status", ["Active", "Pending"]);

  if (error || !data) {
    console.error("Error fetching county/city options:", error);
    return [];
  }

  console.log('[getCountyCityOptions] Raw data count:', data.length);

  const stateMatches = data.filter(row => row.state?.trim().toLowerCase() === state.trim().toLowerCase());
  console.log('[getCountyCityOptions] After state match:', stateMatches.length);

  const filtered = stateMatches.filter(row => {
    const subsidiarMatch = subsidiaryMatches(row.subsidiary, subsidiary);
    const licenseTypeMatch = validateLicenseType(row.license_type, permitType);
    return subsidiarMatch && licenseTypeMatch;
  });
  console.log('[getCountyCityOptions] After subsidiary and license type match:', filtered.length);

  const uniqueMap = new Map<string, { title: string; qpName: string | null; qpEmail: string | null; spItemId: string | null }>();
  filtered.forEach(row => {
    if (row.county_city_title && !uniqueMap.has(row.county_city_title)) {
      uniqueMap.set(row.county_city_title, {
        title: row.county_city_title,
        qpName: row.qp_name,
        qpEmail: row.qp_email,
        spItemId: row.sp_item_id
      });
    }
  });

  const result = Array.from(uniqueMap.values()).sort((a, b) => a.title.localeCompare(b.title));
  console.log('[getCountyCityOptions] Final options:', result.length);

  return result;
}

export async function getQPForSelection(
  permitLevel: "State" | "CountyCity",
  permitType: "General" | "Electrical" | "Specialty",
  subsidiary: string,
  state: string,
  countyCityTitle?: string
): Promise<{ qpName: string | null; qpEmail: string | null; matchedItemId: string | null; sourceList: string }> {
  const sourceList = selectSourceList(permitLevel, permitType);

  console.log('[getQPForSelection] Query params:', { permitLevel, permitType, subsidiary, state, countyCityTitle, sourceList });

  let query = supabase
    .from("licensing_cache")
    .select("sp_item_id, qp_name, qp_email, subsidiary, state, county_city_title, license_type")
    .eq("source_list", sourceList)
    .in("status", ["Active", "Pending"]);

  if (permitLevel === "CountyCity" && countyCityTitle) {
    query = query.eq("county_city_title", countyCityTitle);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Error fetching QP:", error);
    return { qpName: null, qpEmail: null, matchedItemId: null, sourceList };
  }

  console.log('[getQPForSelection] Raw data count:', data.length);

  const stateMatches = data.filter(row => row.state?.trim().toLowerCase() === state.trim().toLowerCase());
  console.log('[getQPForSelection] After state match:', stateMatches.length);

  const filtered = stateMatches.filter(row => {
    const subsidiarMatch = subsidiaryMatches(row.subsidiary, subsidiary);
    const licenseTypeMatch = validateLicenseType(row.license_type, permitType);
    return subsidiarMatch && licenseTypeMatch;
  });
  console.log('[getQPForSelection] After subsidiary and license type match:', filtered.length);

  const match = filtered[0];
  console.log('[getQPForSelection] Match found:', match ? 'yes' : 'no');

  if (!match) {
    return { qpName: null, qpEmail: null, matchedItemId: null, sourceList };
  }

  return {
    qpName: match.qp_name,
    qpEmail: match.qp_email,
    matchedItemId: match.sp_item_id,
    sourceList,
  };
}
