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

  const { data, error } = await supabase
    .from("licensing_cache")
    .select("state, subsidiary, license_type")
    .eq("source_list", sourceList)
    .in("status", ["Active", "Pending"]);

  if (error || !data) {
    console.error("Error fetching states:", error);
    return [];
  }

  const filtered = data.filter(row => {
    return subsidiaryMatches(row.subsidiary, subsidiary) && validateLicenseType(row.license_type, permitType);
  });

  return [...new Set(filtered.map(r => r.state?.trim()).filter(Boolean))].sort() as string[];
}

export interface QPOption {
  qpName: string;
  qpEmail: string | null;
  spItemId: string | null;
}

// Returns all unique QPs for a given state + permit level + permit type.
// Performing entity is NOT used as a filter here — the user picks the QP from the list.
export async function getQPOptions(
  permitLevel: "State" | "CountyCity",
  permitType: "General" | "Electrical" | "Specialty",
  state: string
): Promise<QPOption[]> {
  const sourceList = selectSourceList(permitLevel, permitType);

  const { data, error } = await supabase
    .from("licensing_cache")
    .select("sp_item_id, qp_name, qp_email, license_type, state")
    .eq("source_list", sourceList)
    .in("status", ["Active", "Pending"]);

  if (error || !data) {
    console.error("Error fetching QP options:", error);
    return [];
  }

  const stateFiltered = data.filter(row => row.state?.trim().toLowerCase() === state.trim().toLowerCase());
  const typeFiltered = stateFiltered.filter(row => validateLicenseType(row.license_type, permitType));

  // Deduplicate by qp_name — same person can appear on many rows
  const seen = new Set<string>();
  const result: QPOption[] = [];
  for (const row of typeFiltered) {
    if (!row.qp_name) continue;
    if (seen.has(row.qp_name)) continue;
    seen.add(row.qp_name);
    result.push({
      qpName: row.qp_name,
      qpEmail: row.qp_email,
      spItemId: row.sp_item_id,
    });
  }

  return result.sort((a, b) => a.qpName.localeCompare(b.qpName));
}

// Returns county/city title options for a given state + permit type (no performing entity filter).
export async function getCountyCityTitles(
  state: string,
  subsidiary: string,
  permitType: "General" | "Electrical" | "Specialty"
): Promise<string[]> {
  const sourceList = selectSourceList("CountyCity", permitType);

  const { data, error } = await supabase
    .from("licensing_cache")
    .select("county_city_title, subsidiary, license_type, state")
    .eq("source_list", sourceList)
    .in("status", ["Active", "Pending"]);

  if (error || !data) {
    console.error("Error fetching county/city titles:", error);
    return [];
  }

  const filtered = data.filter(row =>
    row.state?.trim().toLowerCase() === state.trim().toLowerCase() &&
    subsidiaryMatches(row.subsidiary, subsidiary) &&
    validateLicenseType(row.license_type, permitType)
  );

  const titles = [...new Set(filtered.map(r => r.county_city_title).filter(Boolean))] as string[];
  return titles.sort((a, b) => a.localeCompare(b));
}

// Kept for backwards compatibility but no longer used in the main form flow.
export async function getCountyCityOptions(
  permitType: "General" | "Electrical" | "Specialty",
  subsidiary: string,
  state: string
): Promise<Array<{ title: string; qpName: string | null; qpEmail: string | null; spItemId: string | null }>> {
  const sourceList = selectSourceList("CountyCity", permitType);

  const { data, error } = await supabase
    .from("licensing_cache")
    .select("county_city_title, subsidiary, qp_name, qp_email, sp_item_id, state, license_type")
    .eq("source_list", sourceList)
    .in("status", ["Active", "Pending"]);

  if (error || !data) return [];

  const filtered = data.filter(row =>
    row.state?.trim().toLowerCase() === state.trim().toLowerCase() &&
    subsidiaryMatches(row.subsidiary, subsidiary) &&
    validateLicenseType(row.license_type, permitType)
  );

  const uniqueMap = new Map<string, { title: string; qpName: string | null; qpEmail: string | null; spItemId: string | null }>();
  filtered.forEach(row => {
    if (row.county_city_title && !uniqueMap.has(row.county_city_title)) {
      uniqueMap.set(row.county_city_title, {
        title: row.county_city_title,
        qpName: row.qp_name,
        qpEmail: row.qp_email,
        spItemId: row.sp_item_id,
      });
    }
  });

  return Array.from(uniqueMap.values()).sort((a, b) => a.title.localeCompare(b.title));
}

// Kept for backwards compatibility.
export async function getQPForSelection(
  permitLevel: "State" | "CountyCity",
  permitType: "General" | "Electrical" | "Specialty",
  subsidiary: string,
  state: string,
  countyCityTitle?: string
): Promise<{ qpName: string | null; qpEmail: string | null; matchedItemId: string | null; sourceList: string }> {
  const sourceList = selectSourceList(permitLevel, permitType);

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
    return { qpName: null, qpEmail: null, matchedItemId: null, sourceList };
  }

  const filtered = data.filter(row =>
    row.state?.trim().toLowerCase() === state.trim().toLowerCase() &&
    subsidiaryMatches(row.subsidiary, subsidiary) &&
    validateLicenseType(row.license_type, permitType)
  );

  const match = filtered[0];
  if (!match) return { qpName: null, qpEmail: null, matchedItemId: null, sourceList };

  return {
    qpName: match.qp_name,
    qpEmail: match.qp_email,
    matchedItemId: match.sp_item_id,
    sourceList,
  };
}
