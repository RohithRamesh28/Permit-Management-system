import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TENANT_ID = "3596b7c3-9b4b-4ef8-9dde-39825373af28";
const CLIENT_ID = "c01be167-54b5-4e66-a8a1-8c5303b3430b";
const CLIENT_SECRET = "x6k8Q~AEdheL6OYH43fbKGbqQTK9GunLtH.e5aw~";

async function getAppOnlyToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
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

async function getSiteId(accessToken: string, siteUrl: string): Promise<string> {
  const url = new URL(siteUrl);
  const hostname = url.hostname;
  const sitePath = url.pathname.split("/").slice(0, 3).join("/");

  const siteResponse = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!siteResponse.ok) {
    const errorText = await siteResponse.text();
    throw new Error(`Failed to get site: ${siteResponse.status} - ${errorText}`);
  }

  const siteData = await siteResponse.json();
  return siteData.id;
}

async function getDriveId(accessToken: string, siteId: string): Promise<string> {
  const drivesResponse = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!drivesResponse.ok) {
    const errorText = await drivesResponse.text();
    throw new Error(`Failed to get drives: ${drivesResponse.status} - ${errorText}`);
  }

  const drivesData = await drivesResponse.json();
  const documentsDrive = drivesData.value.find(
    (d: { name: string }) => d.name === "Documents" || d.name === "Shared Documents"
  );

  if (!documentsDrive) {
    throw new Error("Could not find Documents drive");
  }

  return documentsDrive.id;
}

async function ensureFolderExists(
  accessToken: string,
  driveId: string,
  folderPath: string
): Promise<string> {
  const parts = folderPath.split("/").filter(Boolean);
  let currentPath = "";
  let currentFolderId = "root";

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;

    const checkUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${currentPath}`;
    const checkResponse = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (checkResponse.ok) {
      const folderData = await checkResponse.json();
      currentFolderId = folderData.id;
    } else if (checkResponse.status === 404) {
      const parentPath = currentPath.split("/").slice(0, -1).join("/");
      const createUrl = parentPath
        ? `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${parentPath}:/children`
        : `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`;

      const createResponse = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: part,
          folder: {},
          "@microsoft.graph.conflictBehavior": "fail",
        }),
      });

      if (!createResponse.ok && createResponse.status !== 409) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create folder ${part}: ${createResponse.status} - ${errorText}`);
      }

      if (createResponse.status === 409) {
        const recheckResponse = await fetch(checkUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (recheckResponse.ok) {
          const folderData = await recheckResponse.json();
          currentFolderId = folderData.id;
        }
      } else {
        const folderData = await createResponse.json();
        currentFolderId = folderData.id;
      }
    } else {
      const errorText = await checkResponse.text();
      throw new Error(`Failed to check folder ${part}: ${checkResponse.status} - ${errorText}`);
    }
  }

  return currentFolderId;
}

async function uploadFileToSharePoint(
  accessToken: string,
  driveId: string,
  folderPath: string,
  fileName: string,
  fileContent: ArrayBuffer
): Promise<void> {
  const encodedPath = folderPath
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
  const encodedFileName = encodeURIComponent(fileName);

  const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedPath}/${encodedFileName}:/content`;

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: fileContent,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload file ${fileName}: ${uploadResponse.status} - ${errorText}`);
  }
}

async function downloadFile(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file from ${url}: ${response.status}`);
  }
  return response.arrayBuffer();
}

interface RequestPayload {
  permit_id: string;
  ontivity_project_number: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { permit_id, ontivity_project_number }: RequestPayload = await req.json();

    if (!permit_id || !ontivity_project_number) {
      return new Response(
        JSON.stringify({ error: "Missing permit_id or ontivity_project_number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedProjectNumber = ontivity_project_number.trim();
    const { data: jobData, error: jobError } = await supabase
      .from("sharepoint_jobs_cache")
      .select("all_fields")
      .or(`job_title.eq.${trimmedProjectNumber},job_title.ilike.%${trimmedProjectNumber}%`)
      .limit(1)
      .maybeSingle();

    if (jobError) {
      throw new Error(`Failed to query jobs cache: ${jobError.message}`);
    }

    if (!jobData) {
      throw new Error(`No matching job found for project: ${ontivity_project_number}`);
    }

    const siteUrlField = jobData.all_fields?.Site_x0020_URL;
    let siteUrl: string;

    if (typeof siteUrlField === "object" && siteUrlField?.Url) {
      siteUrl = siteUrlField.Url;
    } else if (typeof siteUrlField === "string") {
      siteUrl = siteUrlField;
    } else {
      throw new Error("Could not extract SharePoint site URL from job data");
    }

    const accessToken = await getAppOnlyToken();
    const siteId = await getSiteId(accessToken, siteUrl);
    const driveId = await getDriveId(accessToken, siteId);

    const targetFolder = "2. Working/Permits";
    await ensureFolderExists(accessToken, driveId, targetFolder);

    const { data: documents, error: docsError } = await supabase
      .from("permit_documents")
      .select("file_url, file_name")
      .eq("permit_id", permit_id);

    if (docsError) {
      throw new Error(`Failed to fetch permit documents: ${docsError.message}`);
    }

    const { data: permitData, error: permitError } = await supabase
      .from("permits")
      .select("signed_pdf_url, permit_id")
      .eq("id", permit_id)
      .maybeSingle();

    if (permitError) {
      throw new Error(`Failed to fetch permit: ${permitError.message}`);
    }

    let uploadedCount = 0;

    if (documents && documents.length > 0) {
      for (const doc of documents) {
        if (doc.file_url) {
          const fileContent = await downloadFile(doc.file_url);
          await uploadFileToSharePoint(
            accessToken,
            driveId,
            targetFolder,
            doc.file_name || `document_${uploadedCount + 1}.pdf`,
            fileContent
          );
          uploadedCount++;
        }
      }
    }

    if (permitData?.signed_pdf_url) {
      const signedPdfContent = await downloadFile(permitData.signed_pdf_url);
      const signedFileName = `${permitData.permit_id || "permit"}_signed.pdf`;
      await uploadFileToSharePoint(
        accessToken,
        driveId,
        targetFolder,
        signedFileName,
        signedPdfContent
      );
      uploadedCount++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        uploadedCount,
        message: `Successfully uploaded ${uploadedCount} file(s) to SharePoint`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error("SharePoint upload error:", errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
