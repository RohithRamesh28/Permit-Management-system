# SharePoint Integration Setup

## Step 1: Add Azure Client Secret to Supabase

You need to add the Azure Client Secret as an environment variable for your Edge Functions:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/jvsyugwllozxglydamgq
2. Navigate to **Edge Functions** → **Settings** (or **Project Settings** → **Edge Functions**)
3. Add a new secret:
   - **Name**: `AZURE_CLIENT_SECRET`
   - **Value**: `x6k8Q~AEdheL6OYH43fbKGbqQTK9GunLtH.e5aw~`

## Step 2: Trigger the Sync

After adding the secret, you can trigger the sync by calling the Edge Function:

```bash
curl -X POST \
  "https://jvsyugwllozxglydamgq.supabase.co/functions/v1/sync-sharepoint-jobs" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c3l1Z3dsbG96eGdseWRhbWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTQ1OTAsImV4cCI6MjA4ODg5MDU5MH0.me9ZyGuAGSB7jHwzjXMaGaQHsiHWgTwZ8haM-s_9_Qw"
```

## Configuration Details

- **SharePoint Site**: https://ontivity.sharepoint.com/sites/OntivityJobManagement
- **List Name**: All Divisions Job List
- **Tenant ID**: 3596b7c3-9b4b-4ef8-9dde-39825373af28
- **Client ID**: c01be167-54b5-4e66-a8a1-8c5303b3430b

## What This Does

1. The Edge Function authenticates to Microsoft Graph API using app-only authentication
2. Fetches all items from the SharePoint list "All Divisions Job List"
3. Extracts the "Title" field from each item
4. Stores the titles in the `sharepoint_jobs_cache` table
5. Updates sync status in `sync_metadata` table

## Verifying the Sync

After running the sync, you can verify the data:

```sql
-- Check sync status
SELECT * FROM sync_metadata WHERE sync_type = 'sharepoint_jobs';

-- Check cached jobs
SELECT COUNT(*) FROM sharepoint_jobs_cache;
SELECT * FROM sharepoint_jobs_cache LIMIT 10;
```
