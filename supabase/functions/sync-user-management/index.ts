import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

async function fetchAllUserManagementItems(
  accessToken: string,
  siteUrl: string,
  listName: string
): Promise<any[]> {
  const url = new URL(siteUrl);
  const hostname = url.hostname;
  const sitePath = url.pathname;

  const siteResponse = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!siteResponse.ok) {
    const errorText = await siteResponse.text();
    throw new Error(`Failed to get site: ${siteResponse.status} - ${errorText}`);
  }

  const siteData = await siteResponse.json();
  const siteId = siteData.id;

  const listResponse = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${encodeURIComponent(listName)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    throw new Error(`Failed to get list: ${listResponse.status} - ${errorText}`);
  }

  const listData = await listResponse.json();
  const listId = listData.id;

  let allItems: any[] = [];
  let nextLink = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields`;

  while (nextLink) {
    const itemsResponse = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!itemsResponse.ok) {
      const errorText = await itemsResponse.text();
      throw new Error(`Failed to get items: ${itemsResponse.status} - ${errorText}`);
    }

    const itemsData = await itemsResponse.json();
    allItems = allItems.concat(itemsData.value || []);
    nextLink = itemsData["@odata.nextLink"] || null;
  }

  return allItems;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const tenantId = "3596b7c3-9b4b-4ef8-9dde-39825373af28";
    const clientId = "c01be167-54b5-4e66-a8a1-8c5303b3430b";
    const clientSecret = "x6k8Q~AEdheL6OYH43fbKGbqQTK9GunLtH.e5aw~";
    const siteUrl = "https://ontivity.sharepoint.com/sites/Permittingsolution";
    const listName = "User Management";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const accessToken = await getAppOnlyToken(tenantId, clientId, clientSecret);
    const items = await fetchAllUserManagementItems(accessToken, siteUrl, listName);

    const usersToInsert = items.map((item) => {
      const fields = item.fields || {};
      return {
        id: fields.ID || fields.id,
        title: fields.Title || null,
        employee_first_name: fields.EmployeeFirstName || null,
        employee_last_name: fields.EmployeeLastName || null,
        business_email: fields.BusinessEmail || null,
        manager_display_name: fields.ManagerDisplayName || null,
        manager_electronic_address: fields.ManagerElectronicAddress || null,
        location_description: fields.LocationDescription || null,
        job_assignment_name: fields.JobAssignmentName || null,
        division_manager_escalation: fields.DivisionManager_x002f_Escelation || null,
        created: fields.Created || null,
        modified: fields.Modified || null,
        synced_at: new Date().toISOString(),
      };
    });

    const { error: deleteError } = await supabase
      .from("user_management")
      .delete()
      .neq("id", 0);

    if (deleteError) {
      throw new Error(`Failed to clear existing data: ${deleteError.message}`);
    }

    const { error: insertError } = await supabase
      .from("user_management")
      .insert(usersToInsert);

    if (insertError) {
      throw new Error(`Failed to insert data: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        itemsSynced: usersToInsert.length,
        message: `Successfully synced ${usersToInsert.length} users from SharePoint`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
