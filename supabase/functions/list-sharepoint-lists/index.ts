import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const tenantId = "3596b7c3-9b4b-4ef8-9dde-39825373af28";
    const clientId = "c01be167-54b5-4e66-a8a1-8c5303b3430b";
    const clientSecret = "x6k8Q~AEdheL6OYH43fbKGbqQTK9GunLtH.e5aw~";
    const siteUrl = "https://ontivity.sharepoint.com/sites/OntivityJobManagement";

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

    const listsUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists`;
    const listsResponse = await fetch(listsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!listsResponse.ok) {
      throw new Error(`Failed to fetch lists: ${listsResponse.status}`);
    }

    const listsData = await listsResponse.json();

    const lists = listsData.value.map((list: any) => ({
      id: list.id,
      name: list.name,
      displayName: list.displayName,
      description: list.description,
      itemCount: list.list?.template || 0,
    }));

    const countsPromises = lists.map(async (list: any) => {
      try {
        const countUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${list.id}/items/$count`;
        const countResponse = await fetch(countUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (countResponse.ok) {
          const count = await countResponse.text();
          return { ...list, itemCount: parseInt(count) };
        }
      } catch (e) {
        console.error(`Failed to get count for ${list.name}:`, e);
      }
      return list;
    });

    const listsWithCounts = await Promise.all(countsPromises);

    return new Response(
      JSON.stringify({
        siteId: siteId,
        totalLists: listsWithCounts.length,
        lists: listsWithCounts,
      }, null, 2),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error listing SharePoint lists:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to list SharePoint lists",
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
