import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

interface ColumnInfo {
  name: string;
  displayName: string;
  columnType: string;
  required: boolean;
  hidden: boolean;
  indexed: boolean;
  readOnly: boolean;
}

async function fetchSharePointColumns(
  accessToken: string,
  siteUrl: string,
  listName: string
): Promise<ColumnInfo[]> {
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

  const columnsResponse = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!columnsResponse.ok) {
    const errorText = await columnsResponse.text();
    throw new Error(`Failed to get columns: ${columnsResponse.status} - ${errorText}`);
  }

  const columnsData = await columnsResponse.json();
  const columns: ColumnInfo[] = [];

  for (const col of columnsData.value || []) {
    const columnType = col.text ? "text" :
                      col.number ? "number" :
                      col.dateTime ? "dateTime" :
                      col.choice ? "choice" :
                      col.lookup ? "lookup" :
                      col.boolean ? "boolean" :
                      col.personOrGroup ? "personOrGroup" :
                      col.calculated ? "calculated" :
                      "unknown";

    columns.push({
      name: col.name || "",
      displayName: col.displayName || "",
      columnType: columnType,
      required: col.required || false,
      hidden: col.hidden || false,
      indexed: col.indexed || false,
      readOnly: col.readOnly || false,
    });
  }

  return columns;
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

    const accessToken = await getAppOnlyToken(tenantId, clientId, clientSecret);
    const columns = await fetchSharePointColumns(accessToken, siteUrl, listName);

    return new Response(
      JSON.stringify({
        success: true,
        totalColumns: columns.length,
        columns: columns,
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
