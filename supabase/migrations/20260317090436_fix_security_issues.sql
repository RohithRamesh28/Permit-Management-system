/*
  # Fix Security Issues

  1. Remove Unused Indexes
    - Drop `idx_permit_audit_log_permit_id` (unused)
    - Drop `idx_permit_documents_permit_id` (unused)
    - Keep `idx_sharepoint_jobs_title` (used for search in the searchable dropdown)

  2. Move pg_trgm Extension
    - Move pg_trgm extension from public schema to extensions schema
    - This is a best practice for security and organization
*/

DROP INDEX IF EXISTS idx_permit_audit_log_permit_id;
DROP INDEX IF EXISTS idx_permit_documents_permit_id;

CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION pg_trgm SET SCHEMA extensions;
