import { supabase } from '../lib/supabase';

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

export function subsidiaryMatches(spValue = "", jobValue = ""): boolean {
  const a = spValue.toLowerCase().trim();
  const b = jobValue.toLowerCase().trim();
  return a.includes(b) || b.includes(a);
}

export async function getAvailableStates(
  permitLevel: "State" | "CountyCity",
  permitType: "General" | "Electrical" | "Specialty",
  subsidiary: string
): Promise<string[]> {
  const sourceList = selectSourceList(permitLevel, permitType);

  const { data, error } = await supabase
    .from("licensing_cache")
    .select("state, subsidiary")
    .eq("source_list", sourceList)
    .in("status", ["Active", "Pending"]);

  if (error || !data) {
    console.error("Error fetching states:", error);
    return [];
  }

  const filtered = data.filter(row => subsidiaryMatches(row.subsidiary, subsidiary));
  return [...new Set(filtered.map(r => r.state).filter(Boolean))].sort();
}

export async function getCountyCityOptions(
  permitType: "General" | "Electrical" | "Specialty",
  subsidiary: string,
  state: string
): Promise<string[]> {
  const sourceList = selectSourceList("CountyCity", permitType);

  const { data, error } = await supabase
    .from("licensing_cache")
    .select("county_city_title, subsidiary")
    .eq("source_list", sourceList)
    .eq("state", state)
    .in("status", ["Active", "Pending"]);

  if (error || !data) {
    console.error("Error fetching county/city options:", error);
    return [];
  }

  const filtered = data.filter(row => subsidiaryMatches(row.subsidiary, subsidiary));
  return [...new Set(filtered.map(r => r.county_city_title).filter(Boolean))].sort();
}

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
    .select("sp_item_id, qp_name, qp_email, subsidiary")
    .eq("source_list", sourceList)
    .eq("state", state)
    .in("status", ["Active", "Pending"]);

  if (permitLevel === "CountyCity" && countyCityTitle) {
    query = query.eq("county_city_title", countyCityTitle);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Error fetching QP:", error);
    return { qpName: null, qpEmail: null, matchedItemId: null, sourceList };
  }

  const match = data.find(row => subsidiaryMatches(row.subsidiary, subsidiary));
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
