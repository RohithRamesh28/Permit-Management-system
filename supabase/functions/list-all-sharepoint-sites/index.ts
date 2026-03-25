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

    const token = await getGraphToken(tenantId, clientId, clientSecret);

    const sitesUrl = `https://graph.microsoft.com/v1.0/sites?search=*`;
    const sitesResponse = await fetch(sitesUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!sitesResponse.ok) {
      throw new Error(`Failed to fetch sites: ${sitesResponse.status}`);
    }

    const sitesData = await sitesResponse.json();

    const sites = sitesData.value.map((site: any) => ({
      id: site.id,
      name: site.name,
      displayName: site.displayName,
      webUrl: site.webUrl,
      description: site.description,
    }));

    const sitesWithLists = await Promise.all(
      sites.map(async (site: any) => {
        try {
          const listsUrl = `https://graph.microsoft.com/v1.0/sites/${site.id}/lists?$select=id,displayName,name`;
          const listsResponse = await fetch(listsUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (listsResponse.ok) {
            const listsData = await listsResponse.json();
            const lists = listsData.value
              .filter((list: any) =>
                list.displayName?.toLowerCase().includes('licens') ||
                list.name?.toLowerCase().includes('licens') ||
                list.displayName?.toLowerCase().includes('contractor') ||
                list.displayName?.toLowerCase().includes('electrical')
              )
              .map((list: any) => ({
                id: list.id,
                name: list.name,
                displayName: list.displayName,
              }));

            if (lists.length > 0) {
              return {
                ...site,
                lists: lists,
              };
            }
          }
        } catch (e) {
          console.error(`Failed to get lists for site ${site.name}:`, e);
        }
        return null;
      })
    );

    const filteredSites = sitesWithLists.filter(site => site !== null);

    return new Response(
      JSON.stringify({
        totalSites: sites.length,
        sitesWithLicensingLists: filteredSites.length,
        sites: filteredSites,
        allSites: sites,
      }, null, 2),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error listing SharePoint sites:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to list SharePoint sites",
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
