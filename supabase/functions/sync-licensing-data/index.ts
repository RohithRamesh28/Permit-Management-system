import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SAMPLE_DATA_MODE = false;

const LICENSE_LISTS = {
  state_contractor: "35c9c84e-f043-4031-b8ef-b1090afef0a5",
  state_electrical: "53051bb5-36fa-4d0a-ba1f-a646f40f012c",
  county_contractor: "a751deca-2d97-469c-b209-1eb490b76229",
  county_electrical: "9cfdab67-93b0-472d-b436-5d7655c37f18",
};

function generateSampleData(): any[] {
  const subsidiaries = ["ETT", "CMS", "ETR", "LEG", "MW", "ONT"];
  const states = ["California", "Texas", "Florida", "New York", "Arizona", "Nevada"];
  const counties = ["Los Angeles County", "Orange County", "San Diego County", "Riverside County"];
  const cities = ["Los Angeles", "San Francisco", "San Diego", "Sacramento"];
  const qpNames = ["John Smith", "Jane Doe", "Mike Johnson", "Sarah Williams", "David Brown"];
  const qpEmails = ["jsmith@ontivity.com", "jdoe@ontivity.com", "mjohnson@ontivity.com", "swilliams@ontivity.com", "dbrown@ontivity.com"];

  const sampleRecords = [];

  for (const subsidiary of subsidiaries) {
    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      sampleRecords.push({
        source_list: "state_contractor",
        sp_item_id: `state_contractor_${subsidiary}_${state}_${Math.random()}`,
        status: "Active",
        subsidiary: subsidiary,
        state: state,
        county_city_title: null,
        license_type: "General Contractor",
        classification: "B - General Building",
        license_number: `${state.substring(0, 2).toUpperCase()}${Math.floor(Math.random() * 100000)}`,
        expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        qp_lookup_id: `${i}`,
        qp_name: qpNames[i % qpNames.length],
        qp_email: qpEmails[i % qpEmails.length],
        raw_fields: {},
        last_synced: new Date().toISOString(),
      });

      sampleRecords.push({
        source_list: "state_electrical",
        sp_item_id: `state_electrical_${subsidiary}_${state}_${Math.random()}`,
        status: "Active",
        subsidiary: subsidiary,
        state: state,
        county_city_title: null,
        license_type: "Electrical Contractor",
        classification: "C-10 - Electrical",
        license_number: `${state.substring(0, 2).toUpperCase()}${Math.floor(Math.random() * 100000)}`,
        expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        qp_lookup_id: `${i}`,
        qp_name: qpNames[(i + 1) % qpNames.length],
        qp_email: qpEmails[(i + 1) % qpEmails.length],
        raw_fields: {},
        last_synced: new Date().toISOString(),
      });
    }

    for (let i = 0; i < counties.length; i++) {
      const county = counties[i];
      sampleRecords.push({
        source_list: "county_contractor",
        sp_item_id: `county_contractor_${subsidiary}_${county}_${Math.random()}`,
        status: "Active",
        subsidiary: subsidiary,
        state: "California",
        county_city_title: county,
        license_type: "County Contractor",
        classification: "General",
        license_number: `CC${Math.floor(Math.random() * 100000)}`,
        expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        qp_lookup_id: `${i}`,
        qp_name: qpNames[i % qpNames.length],
        qp_email: qpEmails[i % qpEmails.length],
        raw_fields: {},
        last_synced: new Date().toISOString(),
      });
    }

    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      sampleRecords.push({
        source_list: "county_electrical",
        sp_item_id: `county_electrical_${subsidiary}_${city}_${Math.random()}`,
        status: "Active",
        subsidiary: subsidiary,
        state: "California",
        county_city_title: city,
        license_type: "City Electrical",
        classification: "Electrical",
        license_number: `CE${Math.floor(Math.random() * 100000)}`,
        expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        qp_lookup_id: `${i}`,
        qp_name: qpNames[(i + 2) % qpNames.length],
        qp_email: qpEmails[(i + 2) % qpEmails.length],
        raw_fields: {},
        last_synced: new Date().toISOString(),
      });
    }
  }

  return sampleRecords;
}

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
  let url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=500`;

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

function mapStateContractorFields(fields: any): any {
  return {
    state: fields.Title || null,
    status: fields.field_0 || null,
    license_type: fields.field_2 || null,
    subsidiary: fields.field_4 || null,
    classification: fields.field_3 || null,
    license_number: fields.field_6 || null,
    expiration_date: fields.field_8 || null,
    qp_lookup_id: fields.QualifyingPersonLookupId || null,
    county_city_title: null,
  };
}

function mapStateElectricalFields(fields: any): any {
  return {
    state: fields.Title || null,
    status: fields.field_0 || null,
    license_type: fields.field_2 || null,
    subsidiary: fields.field_5 || null,
    classification: fields.field_3 || null,
    license_number: fields.field_7 || null,
    expiration_date: fields.field_9 || null,
    qp_lookup_id: fields.QualifyingPartyLookupId || null,
    county_city_title: null,
  };
}

function mapCountyContractorFields(fields: any): any {
  return {
    state: fields.field_3 || null,
    county_city_title: fields.field_2 || null,
    status: fields.field_0 || null,
    license_type: fields.LicenseType || null,
    subsidiary: fields.field_6 || null,
    classification: fields.field_5 || null,
    license_number: fields.field_8 || null,
    expiration_date: fields.field_10 || null,
    qp_lookup_id: fields.QualifyingPartyLookupId || null,
  };
}

function mapCountyElectricalFields(fields: any): any {
  return {
    state: fields.field_3 || null,
    county_city_title: fields.field_2 || null,
    status: fields.field_0 || null,
    license_type: fields.field_4 || null,
    subsidiary: fields.field_6 || null,
    classification: fields.field_5 || null,
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
    const MIN_EXPECTED_RECORDS = 400;

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

    const syncResults: Record<string, number> = {};
    let totalSynced = 0;
    let allRows: any[] = [];

    if (SAMPLE_DATA_MODE) {
      console.log("Running in SAMPLE DATA MODE - generating test data");
      allRows = generateSampleData();

      syncResults["sample_data"] = allRows.length;
      totalSynced = allRows.length;
    } else {
      const qpCache = new Map<string, QpInfo>();

      for (const [listName, listId] of Object.entries(LICENSE_LISTS)) {
        console.log(`Syncing ${listName}...`);

        const items = await fetchListItems(token, siteId, listId);
        const rows: any[] = [];

        for (const item of items) {
          let mappedFields: any;

          switch (listName) {
            case "state_contractor":
              mappedFields = mapStateContractorFields(item.fields);
              break;
            case "state_electrical":
              mappedFields = mapStateElectricalFields(item.fields);
              break;
            case "county_contractor":
              mappedFields = mapCountyContractorFields(item.fields);
              break;
            case "county_electrical":
              mappedFields = mapCountyElectricalFields(item.fields);
              break;
            default:
              continue;
          }

          let qpName = null;
          let qpEmail = null;

          if (mappedFields.qp_lookup_id) {
            const qpInfo = await resolveQP(token, siteId, mappedFields.qp_lookup_id, qpCache);
            qpName = qpInfo.name;
            qpEmail = qpInfo.email;
          }

          rows.push({
            source_list: listName,
            sp_item_id: item.id,
            status: mappedFields.status,
            subsidiary: mappedFields.subsidiary,
            state: mappedFields.state,
            county_city_title: mappedFields.county_city_title,
            license_type: mappedFields.license_type,
            classification: mappedFields.classification,
            license_number: mappedFields.license_number,
            expiration_date: mappedFields.expiration_date,
            qp_lookup_id: mappedFields.qp_lookup_id,
            qp_name: qpName,
            qp_email: qpEmail,
            raw_fields: item.fields,
            last_synced: new Date().toISOString(),
          });
        }

        allRows.push(...rows);
        syncResults[listName] = rows.length;
        totalSynced += rows.length;
        console.log(`Synced ${rows.length} records from ${listName}`);
      }
    }

    if (allRows.length === 0) {
      throw new Error("No licensing data fetched - possible API or connectivity issue");
    }

    if (allRows.length < MIN_EXPECTED_RECORDS) {
      console.warn(`Warning: Only ${allRows.length} licensing records fetched, expected at least ${MIN_EXPECTED_RECORDS}`);
    }

    const batchSize = 500;
    for (let i = 0; i < allRows.length; i += batchSize) {
      const batch = allRows.slice(i, i + batchSize);
      const upsertResponse = await fetch(`${supabaseUrl}/rest/v1/licensing_cache`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify(batch),
      });

      if (!upsertResponse.ok) {
        const errorText = await upsertResponse.text();
        throw new Error(`Failed to upsert batch: ${errorText}`);
      }
    }

    return new Response(
      JSON.stringify({
        synced: totalSynced,
        lists: syncResults,
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
    const errorMessage = (error as Error).message || "Failed to sync licensing data";
    console.error("Error syncing licensing data:", errorMessage);

    await sendFailureEmail("Licensing Data", errorMessage, supabaseUrl, supabaseServiceKey);

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
