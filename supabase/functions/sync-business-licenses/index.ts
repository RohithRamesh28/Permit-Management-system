import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BUSINESS_LICENSE_LIST_ID = "5bd428ce-f95c-47c1-a946-9b956758e096";

interface QpInfo {
  name: string | null;
  email: string | null;
}

async function getGraphToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get Graph token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function resolveQP(token: string, siteId: string, lookupId: string, qpCache: Map<string, QpInfo>): Promise<QpInfo> {
  if (qpCache.has(lookupId)) {
    return qpCache.get(lookupId)!;
  }

  try {
    const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/User Information List/items/${lookupId}?expand=fields`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error(`Failed to resolve QP ${lookupId}: ${res.status}`);
      const result = { name: null, email: null };
      qpCache.set(lookupId, result);
      return result;
    }

    const data = await res.json();
    const result = {
      name: data.fields?.Title || data.fields?.Name || null,
      email: data.fields?.EMail || data.fields?.Email || null,
    };
    qpCache.set(lookupId, result);
    return result;
  } catch (error) {
    console.error(`Error resolving QP ${lookupId}:`, error);
    const result = { name: null, email: null };
    qpCache.set(lookupId, result);
    return result;
  }
}

async function fetchListItems(token: string, siteId: string, listId: string): Promise<any[]> {
  const allItems: any[] = [];
  let url: string | null = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=500`;

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch list items: ${response.status}`);
    }

    const data = await response.json();
    allItems.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }

  return allItems;
}

function mapBusinessLicenseFields(fields: any): any {
  return {
    status: fields.field_0 || null,
    county_city_title: fields.field_2 || null,
    state: fields.field_3 || null,
    license_type: fields.field_4 || null,
    classification: fields.field_5 || null,
    subsidiary: fields.field_6 || null,
    license_number: fields.field_8 || null,
    expiration_date: fields.field_10 || null,
    qp_lookup_id: fields.QualifyingPartyLookupId || null,
  };
}

async function sendFailureEmail(syncType: string, errorMessage: string, supabaseUrl: string, supabaseServiceKey: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-email-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        to: "Rohith@katprotech.com",
        subject: `Sync Failure: ${syncType}`,
        syncType,
        errorMessage,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (emailError) {
    console.error("Failed to send failure email:", emailError);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  try {
    const tenantId = "3596b7c3-9b4b-4ef8-9dde-39825373af28";
    const clientId = "c01be167-54b5-4e66-a8a1-8c5303b3430b";
    const clientSecret = "x6k8Q~AEdheL6OYH43fbKGbqQTK9GunLtH.e5aw~";
    const siteUrl = "https://ontivity.sharepoint.com/sites/OntivityLicensing";

    const siteUrlObj = new URL(siteUrl);
    const hostname = siteUrlObj.hostname;
    const sitePath = siteUrlObj.pathname;

    const siteApiUrl = `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`;
    const token = await getGraphToken(tenantId, clientId, clientSecret);

    const siteResponse = await fetch(siteApiUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!siteResponse.ok) {
      throw new Error(`Failed to get site ID: ${siteResponse.status}`);
    }

    const siteData = await siteResponse.json();
    const siteId = siteData.id;

    console.log("Fetching business license items...");
    const items = await fetchListItems(token, siteId, BUSINESS_LICENSE_LIST_ID);
    console.log(`Fetched ${items.length} business license items`);

    const qpCache = new Map<string, QpInfo>();
    const rows: any[] = [];

    for (const item of items) {
      const mapped = mapBusinessLicenseFields(item.fields);

      let qpName = null;
      let qpEmail = null;

      if (mapped.qp_lookup_id) {
        const qpInfo = await resolveQP(token, siteId, mapped.qp_lookup_id, qpCache);
        qpName = qpInfo.name;
        qpEmail = qpInfo.email;
      }

      rows.push({
        sp_item_id: item.id,
        status: mapped.status,
        subsidiary: mapped.subsidiary,
        state: mapped.state,
        county_city_title: mapped.county_city_title,
        license_type: mapped.license_type,
        classification: mapped.classification,
        license_number: mapped.license_number,
        expiration_date: mapped.expiration_date,
        qp_lookup_id: mapped.qp_lookup_id,
        qp_name: qpName,
        qp_email: qpEmail,
        raw_fields: item.fields,
        last_synced: new Date().toISOString(),
      });
    }

    if (rows.length === 0) {
      throw new Error("No business license data fetched - possible API or connectivity issue");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      const { error: upsertError } = await supabase
        .from("business_license_cache")
        .upsert(batch, {
          onConflict: "sp_item_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        throw new Error(`Failed to upsert batch: ${upsertError.message}`);
      }
    }

    console.log(`Successfully synced ${rows.length} business license records`);

    return new Response(
      JSON.stringify({
        synced: rows.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const errorMessage = (error as Error).message || "Failed to sync business license data";
    console.error("Error syncing business license data:", errorMessage);

    await sendFailureEmail("Business License Data", errorMessage, supabaseUrl!, supabaseServiceKey!);

    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
