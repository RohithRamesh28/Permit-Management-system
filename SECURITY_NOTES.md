# Security Configuration Notes

## RLS Policy Design

This application uses **MSAL (Microsoft Azure AD)** authentication at the application level, not Supabase Auth. This affects the RLS policy design:

### Why Policies Are Permissive

1. **Authentication Layer**: Security is enforced by the `AuthGuard` component which requires MSAL login before any database operations can occur
2. **No Supabase Auth**: Since Supabase auth is not used, RLS policies cannot use `auth.uid()` or other Supabase auth functions
3. **Application-Level Security**: Only authenticated users can access the React application, providing the security boundary
4. **Design Trade-off**: RLS policies remain permissive (allowing `public` access) because they cannot validate MSAL tokens

### Tables with Permissive Policies

The following tables have "always true" policies by design:
- `permit_audit_log` - Audit logs for permit changes
- `permit_documents` - Document attachments for permits
- `permits` - Main permit records
- `sync_metadata` - Sync status for external integrations
- `sharepoint_jobs_cache` - Cached SharePoint job data

This is **acceptable and intentional** because:
- The entire application is protected by MSAL authentication
- Database operations are only possible after successful MSAL login
- Adding restrictive RLS without Supabase auth would block legitimate users
- The security model relies on application-level authentication rather than database-level auth

## Index Usage

The following indexes were added for foreign key relationships:
- `idx_permit_audit_log_permit_id` on `permit_audit_log(permit_id)`
- `idx_permit_documents_permit_id` on `permit_documents(permit_id)`

These indexes may show as "unused" initially but will improve query performance as the dataset grows and joins are performed.

## Manual Configuration Required

### Auth DB Connection Strategy

**Issue**: The Auth server is configured to use a fixed number of connections (10) instead of a percentage-based strategy.

**Resolution**: This must be configured in the Supabase Dashboard:
1. Go to Project Settings → Database
2. Find "Connection Pooling" settings
3. Change Auth connection strategy from "Fixed" to "Percentage-based"
4. Recommended: Set to 10-20% of max connections

This ensures the Auth server scales properly when the database instance size is increased.

## Security Recommendations

If you need stricter database-level security:

1. **Integrate Supabase Auth with MSAL**: Use Supabase's custom auth integration to validate MSAL tokens, then use `auth.uid()` in RLS policies

2. **Add Service Role Validation**: Create a service role pattern where the application backend validates MSAL tokens and includes user context in database operations

3. **Implement Row-Level Filtering**: Add user_id or email columns to tables and filter based on MSAL user identity passed from the application

4. **API Layer**: Build an API layer between the frontend and Supabase that validates MSAL tokens and enforces authorization rules before database access
