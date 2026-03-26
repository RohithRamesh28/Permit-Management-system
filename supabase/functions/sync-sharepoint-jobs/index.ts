import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getAppOnlyToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
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
    const errorText = await response.text();
    throw new Error(`Token request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

interface SharePointItem {
  id: string;
  title: string;
  allFields: Record<string, any>;
}

async function fetchAllSharePointItems(
  accessToken: string,
  siteUrl: string,
  listName: string
): Promise<SharePointItem[]> {
  const url = new URL(siteUrl);
  const hostname = url.hostname;
  const sitePath = url.pathname;

  const siteResponse = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!siteResponse.ok) {
    const errorText = await siteResponse.text();
    throw new Error(
      `Failed to get site: ${siteResponse.status} - ${errorText}`
    );
  }

  const siteData = await siteResponse.json();
  const siteId = siteData.id;

  const listResponse = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${encodeURIComponent(listName)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    throw new Error(
      `Failed to get list: ${listResponse.status} - ${errorText}`
    );
  }

  const listData = await listResponse.json();
  const listId = listData.id;

  const allItems: SharePointItem[] = [];
  let nextLink: string | null =
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=999`;

  while (nextLink) {
    const itemsResponse = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!itemsResponse.ok) {
      const errorText = await itemsResponse.text();
      throw new Error(
        `Failed to get items: ${itemsResponse.status} - ${errorText}`
      );
    }

    const itemsData = await itemsResponse.json();

    for (const item of itemsData.value || []) {
      if (item.fields?.Title && item.id) {
        allItems.push({
          id: item.id,
          title: item.fields.Title,
          allFields: item.fields || {},
        });
      }
    }

    nextLink = itemsData["@odata.nextLink"] || null;
  }

  return allItems;
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
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const tenantId = "3596b7c3-9b4b-4ef8-9dde-39825373af28";
    const clientId = "c01be167-54b5-4e66-a8a1-8c5303b3430b";
    const clientSecret = "x6k8Q~AEdheL6OYH43fbKGbqQTK9GunLtH.e5aw~";
    const siteUrl = "https://ontivity.sharepoint.com/sites/OntivityJobManagement";
    const listName = "All Divisions Job List";
    const MIN_EXPECTED_RECORDS = 3000;

    await supabase
      .from("sync_metadata")
      .upsert(
        {
          sync_type: "sharepoint_jobs",
          status: "in_progress",
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "sync_type" }
      );

    const accessToken = await getAppOnlyToken(
      tenantId,
      clientId,
      clientSecret
    );
    const items = await fetchAllSharePointItems(
      accessToken,
      siteUrl,
      listName
    );

    if (items.length === 0) {
      throw new Error("SharePoint returned zero items - possible API or connectivity issue");
    }

    if (items.length < MIN_EXPECTED_RECORDS) {
      console.warn(`Warning: Only ${items.length} items fetched, expected at least ${MIN_EXPECTED_RECORDS}`);
    }

    const uniqueItemsMap = new Map<string, SharePointItem>();
    for (const item of items) {
      if (!item.id || !item.title) {
        console.warn("Skipping item with missing id or title:", item);
        continue;
      }
      uniqueItemsMap.set(item.id, item);
    }

    if (uniqueItemsMap.size === 0) {
      throw new Error("No valid items to sync after validation");
    }

    const now = new Date().toISOString();
    const batchSize = 500;
    const entries = Array.from(uniqueItemsMap.values());

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize).map((item) => ({
        sharepoint_id: item.id,
        job_title: item.title,
        all_fields: item.allFields,
        last_synced_at: now,
        updated_at: now,
      }));

      const { error: upsertError } = await supabase
        .from("sharepoint_jobs_cache")
        .upsert(batch, { onConflict: "sharepoint_id" });

      if (upsertError) {
        throw new Error(`Upsert batch failed: ${upsertError.message}`);
      }
    }

    await supabase
      .from("sync_metadata")
      .upsert(
        {
          sync_type: "sharepoint_jobs",
          status: "completed",
          last_synced_at: now,
          item_count: uniqueItemsMap.size,
        },
        { onConflict: "sync_type" }
      );

    return new Response(
      JSON.stringify({
        success: true,
        itemCount: uniqueItemsMap.size,
        syncedAt: now,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = (error as Error).message;

    await supabase
      .from("sync_metadata")
      .upsert(
        {
          sync_type: "sharepoint_jobs",
          status: `failed: ${errorMessage}`,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "sync_type" }
      );

    await sendFailureEmail("SharePoint Jobs", errorMessage, supabaseUrl, supabaseServiceKey);

    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
