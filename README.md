# Permit Management System

A comprehensive web-based permit management system built with React, TypeScript, Vite, and Supabase. This application integrates with Microsoft SharePoint for job data synchronization and provides a complete workflow for creating, managing, and approving construction permits with digital signatures.

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Components](#components)
- [Services](#services)
- [Authentication](#authentication)
- [SharePoint Integration](#sharepoint-integration)
- [PDF Generation & Signing](#pdf-generation--signing)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
- [Deployment](#deployment)

---

## Overview

The Permit Management System is designed to streamline the process of creating, tracking, and approving construction permits. It provides:

- **Digital permit creation** with comprehensive form fields
- **SharePoint integration** for job data synchronization
- **PDF generation** with embedded signatures
- **Digital signature workflow** with drag-and-drop positioning
- **Document preview** and management
- **User authentication** via Microsoft Azure AD
- **Role-based access control** (Admin, Qualified Person, Standard User)
- **Automated job synchronization** from SharePoint

---

## Technology Stack

### Frontend
- **React 18.3.1** - UI framework
- **TypeScript 5.5.3** - Type-safe JavaScript
- **Vite 5.4.2** - Build tool and dev server
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **React Router DOM 7.13.1** - Client-side routing
- **Lucide React 0.344.0** - Icon library

### Backend & Database
- **Supabase 2.57.4** - Backend-as-a-Service (PostgreSQL database, authentication, storage)
- **Edge Functions** - Serverless functions for SharePoint integration

### Authentication
- **Azure MSAL Browser 5.5.0** - Microsoft Authentication Library
- **Microsoft Graph Client 3.0.7** - SharePoint API integration

### PDF & Signatures
- **jsPDF 4.2.0** - PDF generation
- **html2canvas** - HTML to canvas conversion
- **signature_pad 5.1.3** - Digital signature capture

---

## Architecture

### Application Flow

```
User Login (Azure AD)
    ↓
Dashboard (Permit List View)
    ↓
Create New Permit ← SharePoint Job Data
    ↓
Fill Form (Multiple Sections)
    ↓
Submit for Approval
    ↓
Qualified Person Reviews
    ↓
Sign PDF Document
    ↓
Approved & Stored in Supabase
```

### Key Architectural Patterns

1. **Context-based Authentication** - `AuthContext` manages user state and Microsoft authentication
2. **Custom Hooks** - Reusable logic for SharePoint jobs, qualified persons, etc.
3. **Service Layer** - Separated business logic from UI components
4. **Edge Functions** - Serverless functions for SharePoint API calls
5. **Row Level Security (RLS)** - Database-level security policies

---

## Database Schema

### Tables

#### 1. `permits`
Main table storing all permit information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key, auto-generated |
| `permit_number` | text | Unique permit identifier (e.g., "PERMIT-2024-001") |
| `status` | text | Current status: "draft", "pending_approval", "approved", "rejected" |
| `requester_type` | text | "contractor" or "company" |
| `requester_name` | text | Name of the person requesting the permit |
| `requester_email` | text | Email of requester |
| `requester_phone` | text | Phone number of requester |
| `company_name` | text | Company/contractor name |
| `job_name` | text | Associated job name from SharePoint |
| `job_number` | text | Job number from SharePoint |
| `job_address` | text | Physical address of the job site |
| `work_description` | text | Detailed description of work to be performed |
| `permit_type` | text | Type: "building", "electrical", "plumbing", "mechanical", "other" |
| `jurisdiction_type` | text | "city", "county", "state", or "other" |
| `permit_jurisdiction` | text | Name of the jurisdiction (e.g., "City of Austin") |
| `permit_cost` | numeric | Cost of the permit |
| `application_date` | date | Date permit application was submitted |
| `approval_date` | date | Date permit was approved |
| `expiration_date` | date | Date permit expires |
| `signature_data_url` | text | Base64-encoded signature image |
| `signature_name` | text | Name of person who signed |
| `signature_date` | timestamptz | Timestamp when signed |
| `signature_position_x` | numeric | X-coordinate of signature on PDF |
| `signature_position_y` | numeric | Y-coordinate of signature on PDF |
| `signed_pdf_url` | text | Storage URL of signed PDF document |
| `approved_by` | text | Name of approver (Qualified Person) |
| `user_id` | uuid | Foreign key to auth.users |
| `created_at` | timestamptz | Record creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |
| `notes` | text | Additional notes or comments |
| `document_preview_url` | text | URL for document preview |
| `original_document_url` | text | URL of original uploaded document |

**Indexes:**
- Primary key on `id`
- Unique constraint on `permit_number`
- Index on `user_id` for faster user-specific queries

**RLS Policies:**
- Users can view their own permits
- Users can create their own permits
- Users can update their own draft permits
- Qualified persons can view and update any permit

#### 2. `sharepoint_jobs_cache`
Caches job data from SharePoint to reduce API calls.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key, auto-generated |
| `job_number` | text | Unique job number from SharePoint |
| `job_name` | text | Job name/title |
| `address` | text | Job site address |
| `city` | text | City |
| `state` | text | State |
| `zip` | text | ZIP code |
| `customer_name` | text | Customer/client name |
| `pm_name` | text | Project manager name |
| `last_synced` | timestamptz | Last synchronization timestamp |
| `created_at` | timestamptz | Record creation timestamp |

**Indexes:**
- Primary key on `id`
- Unique constraint on `job_number`

**RLS Policies:**
- Public read access (all users can view jobs)
- System can insert/update for sync operations

#### 3. `user_management`
Stores user roles and permissions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key, auto-generated |
| `email` | text | User email (must be unique) |
| `full_name` | text | User's full name |
| `role` | text | User role: "admin", "qualified_person", "user" |
| `is_active` | boolean | Whether user account is active (default: true) |
| `created_at` | timestamptz | Record creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

**Indexes:**
- Primary key on `id`
- Unique constraint on `email`

**RLS Policies:**
- All authenticated users can read user management data
- Admins can insert/update/delete users

#### 4. Storage Bucket: `permit-pdfs`
Stores signed PDF documents.

**Configuration:**
- Public: No (authenticated access only)
- File size limit: 50MB
- Allowed MIME types: application/pdf

**RLS Policies:**
- Users can upload their own permit PDFs
- Users can view their own permit PDFs
- Qualified persons can view all permit PDFs

---

## Components

### 1. `App.tsx`
Root component managing routing and layout.

**Features:**
- Main application routing
- Sidebar navigation
- Authentication guard
- Responsive layout

**Routes:**
- `/` - Permit list view (dashboard)
- `/permit/new` - Create new permit
- `/permit/:id` - View/edit permit details

### 2. `AuthGuard.tsx`
Authentication wrapper component.

**Props:**
- `children: ReactNode` - Protected content

**Features:**
- Redirects unauthenticated users to login
- Shows loading state during auth check
- Integrates with `AuthContext`

### 3. `Sidebar.tsx`
Navigation sidebar component.

**Features:**
- Navigation links (Dashboard, New Permit)
- User profile display
- Logout button
- Responsive mobile menu
- Role-based visibility

### 4. `PermitListView.tsx`
Dashboard displaying all permits.

**Features:**
- Tabbed interface (All, Draft, Pending, Approved, Rejected)
- Search functionality (by permit number, job name, company)
- Status badges with color coding
- Click to view permit details
- Responsive grid layout
- Empty state handling

**State:**
- `permits: Permit[]` - List of all permits
- `filteredPermits: Permit[]` - Filtered by search/status
- `activeTab: string` - Current active status tab
- `searchQuery: string` - Search input value
- `loading: boolean` - Loading state

### 5. `NewPermitForm.tsx`
Multi-section form for creating permits.

**Sections:**
1. **Requester Information**
   - Type (Contractor/Company)
   - Name, Email, Phone
   - Company Name

2. **Job Details**
   - Job selection (from SharePoint)
   - Job Number (auto-filled)
   - Job Address (auto-filled)
   - Work Description

3. **Permit Information**
   - Permit Type (Building, Electrical, Plumbing, etc.)
   - Jurisdiction Type (City, County, State, Other)
   - Permit Jurisdiction
   - Permit Cost
   - Application Date
   - Approval Date (optional)
   - Expiration Date (optional)

4. **Additional Information**
   - Notes

**Features:**
- SharePoint job integration with searchable dropdown
- Auto-population of job details
- Real-time form validation
- Error handling and user feedback
- Draft saving capability
- Submit for approval

**State:**
- `formData: PermitFormData` - All form field values
- `selectedJob: SharePointJob | null` - Selected job from SharePoint
- `loading: boolean` - Submission state
- `error: string | null` - Error messages

### 6. `PermitDetailView.tsx`
Detailed view and approval interface for permits.

**Features:**
- Read-only display of all permit information
- Status indicator
- Edit capability (for draft status)
- Approval workflow (for qualified persons)
- PDF preview
- Document preview modal
- Signature modal integration
- Delete functionality

**State:**
- `permit: Permit | null` - Current permit data
- `showPdfModal: boolean` - PDF signing modal visibility
- `showDocumentModal: boolean` - Document preview modal visibility
- `loading: boolean` - Data loading state

**User Actions:**
- View permit details
- Edit (if draft and owned by user)
- Approve with signature (if qualified person)
- Reject (if qualified person)
- Delete (if owned by user)

### 7. `PermitForm.tsx`
Reusable form component for permit editing.

**Props:**
- `permit: Permit` - Existing permit data
- `onSave: (data: PermitFormData) => void` - Save callback
- `onCancel: () => void` - Cancel callback

**Features:**
- Pre-populated form fields
- Same validation as new permit form
- Update existing permits
- Cancel with confirmation

### 8. `PdfSigningModal.tsx`
Two-step signature workflow modal.

**Props:**
- `pdfUrl: string` - URL of PDF to sign
- `pdfName: string` - Display name of PDF
- `onClose: () => void` - Close callback
- `onApprove: (signatureData, signerName, position) => void` - Approval callback

**Features:**

**Step 1: Draw Signature**
- Name input field (required)
- Digital signature pad
- Clear button
- Canvas-based drawing

**Step 2: Place Signature**
- PDF preview with iframe
- Signature preview following cursor
- Click to place signature
- Drag to reposition signature
- Resize controls (zoom in/out)
- Size range: 90x30px to 300x100px
- Visual feedback (dashed border for preview, solid for placed)

**State:**
- `step: 'draw' | 'place'` - Current workflow step
- `signatureDataUrl: string` - Base64 signature image
- `signerName: string` - Name of signer
- `signaturePosition: {x, y} | null` - Position on PDF
- `cursorPosition: {x, y} | null` - Current mouse position
- `isDragging: boolean` - Drag state
- `dragOffset: {x, y}` - Offset for accurate dragging
- `signatureSize: {width, height}` - Current signature dimensions

**Keyboard Shortcuts:**
- `Escape` - Close modal

### 9. `SignaturePad.tsx`
Canvas-based signature drawing component.

**Features:**
- Touch and mouse support
- Responsive canvas sizing
- Export to data URL
- Clear functionality
- Smooth drawing with variable stroke width

**Methods (via ref):**
- `clear()` - Clear the signature
- `isEmpty()` - Check if signature is drawn
- `toDataURL()` - Export signature as base64 image

**Implementation:**
- Uses `signature_pad` library
- 2:1 aspect ratio canvas
- Black ink on white background
- Auto-resize on window change

### 10. `SearchableDropdown.tsx`
Custom dropdown with search functionality.

**Props:**
- `options: Array<{value: string, label: string}>` - Dropdown options
- `value: string` - Selected value
- `onChange: (value: string) => void` - Change callback
- `placeholder: string` - Input placeholder
- `loading: boolean` - Loading state

**Features:**
- Type-ahead search
- Keyboard navigation (up/down arrows, enter, escape)
- Click outside to close
- Empty state handling
- Loading indicator
- Accessible ARIA labels

**State:**
- `isOpen: boolean` - Dropdown visibility
- `searchQuery: string` - Search input
- `filteredOptions: Option[]` - Filtered results

### 11. `DateInput.tsx`
Custom date input component with validation.

**Props:**
- `value: string` - ISO date string
- `onChange: (value: string) => void` - Change callback
- `label: string` - Input label
- `required: boolean` - Required field indicator
- `min: string` - Minimum date (optional)
- `max: string` - Maximum date (optional)

**Features:**
- Native date picker
- Format validation
- Min/max constraints
- Accessible labels

### 12. `DocumentPreviewModal.tsx`
Modal for previewing documents and PDFs.

**Props:**
- `documentUrl: string` - URL of document
- `documentName: string` - Display name
- `onClose: () => void` - Close callback

**Features:**
- PDF preview via iframe
- Full-screen modal
- Close button and ESC key support
- Responsive sizing
- Error handling for failed loads

**Keyboard Shortcuts:**
- `Escape` - Close modal

---

## Services

### 1. `sharepoint.ts`
SharePoint integration service.

**Functions:**

#### `getSharePointJobs()`
Fetches all jobs from SharePoint list via Edge Function.

**Returns:** `Promise<SharePointJob[]>`

**Flow:**
1. Calls `/functions/v1/sync-sharepoint-jobs` edge function
2. Edge function authenticates with Microsoft Graph
3. Fetches items from "Job Overview" list
4. Transforms SharePoint data to app format
5. Caches results in `sharepoint_jobs_cache` table

**Error Handling:**
- Network errors
- Authentication failures
- API rate limits

#### `getSharePointJobDetails(jobNumber: string)`
Fetches detailed information for a specific job.

**Parameters:**
- `jobNumber: string` - Job number to fetch

**Returns:** `Promise<SharePointJobDetails>`

**Flow:**
1. Calls `/functions/v1/sync-sharepoint-jobs` with job number
2. Retrieves job-specific data
3. Returns formatted job details

### 2. `sharePointJobDetails.ts`
Service for retrieving job-specific details.

**Functions:**

#### `fetchJobDetails(jobNumber: string)`
Wrapper around SharePoint service for job details.

**Parameters:**
- `jobNumber: string` - Job number

**Returns:** `Promise<SharePointJobDetails>`

### 3. `jobSync.ts`
Background job synchronization service.

**Functions:**

#### `syncJobsFromSharePoint()`
Synchronizes jobs from SharePoint to local cache.

**Flow:**
1. Fetch all jobs from SharePoint API
2. For each job, upsert into `sharepoint_jobs_cache`
3. Update `last_synced` timestamp
4. Handle duplicates with job_number unique constraint

**Schedule:**
- Runs automatically every hour via pg_cron
- Can be triggered manually

**Benefits:**
- Reduces API calls
- Improves performance
- Offline capability

### 4. `pdfGenerator.ts`
PDF generation and signing service.

**Functions:**

#### `generatePermitPDF(permit: Permit)`
Generates a formatted PDF from permit data.

**Parameters:**
- `permit: Permit` - Permit data

**Returns:** `Blob` - PDF file blob

**Layout:**
- Header with company logo and permit number
- Requester Information section
- Job Details section
- Permit Information section
- Additional Information section
- Signature area (if signed)
- Footer with timestamp

**Styling:**
- Professional layout
- Blue header (#0072BC)
- Section dividers
- Responsive font sizes

#### `addSignatureToPDF(pdfBlob: Blob, signatureData: string, position: {x, y}, size: {width, height})`
Adds signature image to PDF at specified position.

**Parameters:**
- `pdfBlob: Blob` - Original PDF
- `signatureData: string` - Base64 signature image
- `position: {x: number, y: number}` - Position in pixels
- `size: {width: number, height: number}` - Signature dimensions

**Returns:** `Promise<Blob>` - PDF with embedded signature

**Flow:**
1. Load original PDF
2. Convert to images using html2canvas
3. Add signature image at specified coordinates
4. Generate new PDF with signature
5. Return as blob

#### `uploadSignedPDF(blob: Blob, permitId: string)`
Uploads signed PDF to Supabase storage.

**Parameters:**
- `blob: Blob` - PDF file
- `permitId: string` - Associated permit ID

**Returns:** `Promise<string>` - Public URL of uploaded PDF

**Storage Path:** `permits/{permitId}/signed-permit.pdf`

**Error Handling:**
- Upload failures
- Storage quota exceeded
- Permission errors

### 5. `powerAutomate.ts`
Power Automate workflow integration (placeholder for future use).

**Functions:**

#### `triggerPowerAutomateFlow(permit: Permit)`
Triggers Microsoft Power Automate workflow.

**Parameters:**
- `permit: Permit` - Permit data to send

**Use Cases:**
- Email notifications
- SharePoint updates
- Third-party integrations

---

## Authentication

### Microsoft Azure AD Integration

**Library:** `@azure/msal-browser`

**Configuration (`msalConfig.ts`):**

```typescript
{
  auth: {
    clientId: VITE_AZURE_CLIENT_ID,
    authority: "https://login.microsoftonline.com/common",
    redirectUri: window.location.origin
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false
  }
}
```

**Scopes:**
- `User.Read` - Read user profile
- `Sites.Read.All` - Read SharePoint sites
- `offline_access` - Refresh tokens

### AuthContext (`AuthContext.tsx`)

**State:**
- `user: User | null` - Current authenticated user
- `loading: boolean` - Authentication check in progress

**Methods:**
- `login()` - Initiate Azure AD login flow
- `logout()` - Sign out and clear session
- `getAccessToken()` - Get valid access token for API calls

**Flow:**
1. User clicks login button
2. Redirects to Microsoft login page
3. User authenticates
4. Redirects back with auth code
5. Exchange code for tokens
6. Store tokens in session storage
7. Fetch user profile
8. Update context state

### Protected Routes

All routes wrapped in `<AuthGuard>` component:
- Checks authentication state
- Redirects to login if not authenticated
- Shows loading spinner during check

---

## SharePoint Integration

### Edge Functions

#### 1. `sync-sharepoint-jobs`
**Purpose:** Fetch jobs from SharePoint and cache in database

**Endpoint:** `/functions/v1/sync-sharepoint-jobs`

**Method:** GET

**Authentication:** Uses `SHAREPOINT_*` environment variables

**Flow:**
1. Authenticate with Microsoft Graph using client credentials
2. Query "Job Overview" SharePoint list
3. Transform SharePoint fields to app schema
4. Upsert into `sharepoint_jobs_cache` table
5. Return jobs array

**SharePoint List Fields:**
- `Job_x0023_` → `job_number`
- `Job_x0020_Name` → `job_name`
- `Address` → `address`
- `City` → `city`
- `State` → `state`
- `Zip` → `zip`
- `Customer_x0020_Name` → `customer_name`
- `PM_x0020_Name` → `pm_name`

**Error Handling:**
- Authentication failures → Return 401
- API errors → Return 500 with message
- Invalid data → Log and skip record

**CORS:** Enabled for all origins

#### 2. `sync-user-management`
**Purpose:** Sync user roles from SharePoint

**Endpoint:** `/functions/v1/sync-user-management`

**Method:** GET

**Flow:**
1. Authenticate with Microsoft Graph
2. Query "User Management" SharePoint list
3. Transform to user records
4. Upsert into `user_management` table

**SharePoint List Fields:**
- `Email` → `email`
- `Full_x0020_Name` → `full_name`
- `Role` → `role` (admin/qualified_person/user)
- `Is_x0020_Active` → `is_active`

#### 3. `get-sharepoint-columns`
**Purpose:** Debug endpoint to inspect SharePoint list schema

**Endpoint:** `/functions/v1/get-sharepoint-columns`

**Method:** GET

**Returns:** Array of column definitions

#### 4. `get-user-management-columns`
**Purpose:** Debug endpoint to inspect User Management list schema

**Endpoint:** `/functions/v1/get-user-management-columns`

**Method:** GET

**Returns:** Array of column definitions

### Automatic Synchronization

**Scheduled Job (pg_cron):**
```sql
SELECT cron.schedule(
  'sync-sharepoint-jobs',
  '0 * * * *', -- Every hour
  $$ SELECT net.http_get(...) $$
);
```

**Manual Sync:**
Users can trigger sync via UI button (future feature).

---

## PDF Generation & Signing

### Workflow

#### 1. Generate Permit PDF
**Trigger:** User clicks "Approve" button

**Process:**
1. Call `generatePermitPDF(permit)`
2. Create jsPDF instance
3. Add header with logo and permit number
4. Add sections:
   - Requester Information
   - Job Details
   - Permit Information
   - Additional Information
5. Add signature area placeholder
6. Convert to Blob

#### 2. Sign PDF
**Trigger:** Qualified Person approves permit

**Process:**
1. Open `PdfSigningModal`
2. User draws signature on canvas
3. User enters name
4. Click "Next: Place Signature"
5. PDF preview loads in iframe
6. Signature image follows cursor
7. Click to place signature on PDF
8. Drag to adjust position
9. Use zoom buttons to resize
10. Click "Approve with Signature"

#### 3. Embed Signature
**Process:**
1. Call `addSignatureToPDF()`
2. Convert PDF pages to canvas images
3. Overlay signature image at position
4. Generate new PDF with signature
5. Return signed PDF blob

#### 4. Upload to Storage
**Process:**
1. Call `uploadSignedPDF()`
2. Upload to Supabase Storage bucket `permit-pdfs`
3. Path: `permits/{permitId}/signed-permit.pdf`
4. Get public URL
5. Update permit record with `signed_pdf_url`

#### 5. Update Database
**Process:**
1. Update permit status to "approved"
2. Store signature metadata:
   - `signature_data_url`
   - `signature_name`
   - `signature_date`
   - `signature_position_x`
   - `signature_position_y`
   - `signed_pdf_url`
   - `approved_by`

---

## Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Microsoft Azure AD app registration
- Microsoft SharePoint access

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd permit-management-system
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables

Create `.env` file:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Azure AD Configuration
VITE_AZURE_CLIENT_ID=your_azure_client_id
VITE_AZURE_TENANT_ID=your_azure_tenant_id

# SharePoint Configuration (for Edge Functions)
SHAREPOINT_SITE_ID=your_sharepoint_site_id
SHAREPOINT_CLIENT_ID=your_sharepoint_client_id
SHAREPOINT_CLIENT_SECRET=your_sharepoint_client_secret
SHAREPOINT_TENANT_ID=your_sharepoint_tenant_id
```

### Step 4: Database Setup

Run migrations:
```bash
# Migrations are in supabase/migrations/
# Apply via Supabase Dashboard or CLI
```

Create storage bucket:
1. Go to Supabase Dashboard → Storage
2. Create bucket named `permit-pdfs`
3. Set to private
4. Apply RLS policies from migration files

### Step 5: Deploy Edge Functions

```bash
# Deploy all edge functions
supabase functions deploy sync-sharepoint-jobs
supabase functions deploy sync-user-management
supabase functions deploy get-sharepoint-columns
supabase functions deploy get-user-management-columns
```

Set Edge Function secrets:
```bash
supabase secrets set SHAREPOINT_SITE_ID=your_site_id
supabase secrets set SHAREPOINT_CLIENT_ID=your_client_id
supabase secrets set SHAREPOINT_CLIENT_SECRET=your_secret
supabase secrets set SHAREPOINT_TENANT_ID=your_tenant_id
```

### Step 6: Azure AD Configuration

1. Go to Azure Portal → Azure Active Directory
2. Register new application
3. Add redirect URI: `http://localhost:5173` (dev) or your production URL
4. API Permissions:
   - Microsoft Graph → User.Read
   - Microsoft Graph → Sites.Read.All
5. Copy Client ID and Tenant ID to `.env`

### Step 7: SharePoint Configuration

1. Create SharePoint lists:
   - **Job Overview** with columns:
     - Job # (text)
     - Job Name (text)
     - Address (text)
     - City (text)
     - State (text)
     - Zip (text)
     - Customer Name (text)
     - PM Name (text)

   - **User Management** with columns:
     - Email (text)
     - Full Name (text)
     - Role (choice: admin, qualified_person, user)
     - Is Active (yes/no)

2. Grant API permissions to Azure AD app

### Step 8: Run Development Server
```bash
npm run dev
```

Application will be available at `http://localhost:5173`

### Step 9: Build for Production
```bash
npm run build
```

Output will be in `dist/` directory.

---

## Environment Variables

### Frontend Variables (VITE_*)

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes | `eyJhbGc...` |
| `VITE_AZURE_CLIENT_ID` | Azure AD application ID | Yes | `12345678-1234-...` |
| `VITE_AZURE_TENANT_ID` | Azure AD tenant ID | Yes | `87654321-4321-...` |

### Edge Function Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `SHAREPOINT_SITE_ID` | SharePoint site identifier | Yes | `contoso.sharepoint.com` |
| `SHAREPOINT_CLIENT_ID` | SharePoint app client ID | Yes | `12345678-1234-...` |
| `SHAREPOINT_CLIENT_SECRET` | SharePoint app secret | Yes | `abc123...` |
| `SHAREPOINT_TENANT_ID` | SharePoint tenant ID | Yes | `87654321-4321-...` |
| `SUPABASE_URL` | Auto-populated in edge functions | No | - |
| `SUPABASE_ANON_KEY` | Auto-populated in edge functions | No | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-populated in edge functions | No | - |

---

## Usage

### Creating a Permit

1. **Login** with Microsoft account
2. Click **"New Permit"** in sidebar
3. **Fill Requester Information:**
   - Select Contractor or Company
   - Enter name, email, phone
   - Enter company name
4. **Select Job:**
   - Use searchable dropdown
   - Search by job number or name
   - Address auto-fills from SharePoint
5. **Enter Work Description:**
   - Describe work to be performed
6. **Fill Permit Information:**
   - Select permit type
   - Choose jurisdiction type
   - Enter jurisdiction name
   - Enter permit cost
   - Select application date
   - Optional: approval/expiration dates
7. **Add Notes** (optional)
8. Click **"Submit for Approval"**

### Approving a Permit

1. **Login** as Qualified Person
2. Navigate to **Dashboard**
3. Click **"Pending"** tab
4. Click permit to view details
5. Review all information
6. Click **"Approve"** button
7. **Draw Signature:**
   - Enter your name
   - Draw signature on canvas
   - Click "Next: Place Signature"
8. **Position Signature:**
   - Click on PDF to place signature
   - Drag to reposition
   - Use zoom buttons to resize
   - Click "Approve with Signature"
9. Permit status updates to "Approved"
10. Signed PDF automatically saved

### Managing Permits

**View All Permits:**
- Dashboard shows all permits
- Tabs filter by status
- Search bar filters by permit number, job name, or company

**Edit Draft Permit:**
- Click permit in list
- Click "Edit" button
- Update fields
- Click "Save Changes"

**Delete Permit:**
- Click permit in list
- Click "Delete" button (if owner)
- Confirm deletion

**Download Signed PDF:**
- View approved permit
- Click "Download PDF" button
- PDF opens in new tab

---

## Deployment

### Azure Static Web Apps

1. **Create Static Web App** in Azure Portal
2. **Connect GitHub Repository**
3. **Build Configuration:**
   - App location: `/`
   - API location: `` (leave empty)
   - Output location: `dist`
4. **Add Environment Variables** in Azure Portal
5. **Deploy:** Push to main branch

Configuration file included: `.github/workflows/azure-static-web-apps-*.yml`

### Netlify

1. **Connect Repository** to Netlify
2. **Build Settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
3. **Add Environment Variables**
4. **Deploy**

Redirect configuration: `public/_redirects`

### Vercel

1. **Import Project** from GitHub
2. **Framework:** Vite
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. **Add Environment Variables**
6. **Deploy**

### Custom Server

1. **Build Project:**
   ```bash
   npm run build
   ```

2. **Serve Static Files:**
   ```bash
   npm install -g serve
   serve -s dist
   ```

3. **Configure Web Server** (nginx/apache):
   - Serve files from `dist/`
   - Redirect all routes to `index.html` (SPA)
   - Set appropriate headers

**Nginx Example:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Database Migrations

All database migrations are in `supabase/migrations/` directory:

1. **20260312130530_create_permitting_tables.sql** - Initial permits table
2. **20260312132629_add_signature_fields.sql** - Signature fields
3. **20260312135551_add_requester_type.sql** - Requester type field
4. **20260317050232_fix_security_issues.sql** - Security improvements
5. **20260317050417_fix_remaining_security_issues.sql** - Additional security
6. **20260317050419_comprehensive_security_fix.sql** - Comprehensive security
7. **20260317050507_final_security_cleanup.sql** - Final security fixes
8. **20260317085841_create_sharepoint_jobs_cache.sql** - Jobs cache table
9. **20260317090436_fix_security_issues.sql** - Security policies
10. **20260317104036_create_sharepoint_jobs_cache_table.sql** - Jobs cache refinement
11. **20260317112232_update_permit_fields_signature_toggle.sql** - Signature toggles
12. **20260317175300_allow_anon_sync_jobs.sql** - Anonymous job sync
13. **20260317180131_allow_public_job_reads.sql** - Public job reads
14. **20260317181104_allow_permit_operations.sql** - Permit operations
15. **20260317183302_add_signed_pdf_url.sql** - PDF URL field
16. **20260317183328_create_permit_pdfs_bucket.sql** - Storage bucket
17. **20260317184249_fix_storage_policies.sql** - Storage policies
18. **20260317184647_fix_security_and_performance_issues.sql** - Security & performance
19. **20260317184849_consolidate_policies_and_cleanup.sql** - Policy consolidation
20. **20260318060349_enable_pg_cron_and_schedule_sharepoint_sync.sql** - Scheduled sync
21. **20260318132000_update_rls_for_user_specific_permits.sql** - User-specific RLS
22. **20260320110514_add_signature_data_url.sql** - Signature data URL
23. **20260323114554_create_user_management_table.sql** - User management table
24. **20260323144345_add_approved_by_column.sql** - Approved by field
25. **20260324102116_add_permit_jurisdiction_type.sql** - Jurisdiction type
26. **20260324141507_add_document_tracking_fields.sql** - Document tracking

---

## Hooks

### `useSharePointJobs()`
Fetches and manages SharePoint jobs.

**Returns:**
```typescript
{
  jobs: SharePointJob[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}
```

**Usage:**
```typescript
const { jobs, loading, error } = useSharePointJobs();
```

### `useSharePointJobDetails(jobNumber: string)`
Fetches details for specific job.

**Parameters:**
- `jobNumber: string` - Job number to fetch

**Returns:**
```typescript
{
  jobDetails: SharePointJobDetails | null;
  loading: boolean;
  error: string | null;
}
```

**Usage:**
```typescript
const { jobDetails, loading } = useSharePointJobDetails('12345');
```

### `useQualifiedPerson()`
Checks if current user is a qualified person.

**Returns:**
```typescript
{
  isQualifiedPerson: boolean;
  loading: boolean;
}
```

**Usage:**
```typescript
const { isQualifiedPerson } = useQualifiedPerson();
```

---

## Security Features

### Row Level Security (RLS)

**Permits Table:**
- Users can only view their own permits
- Qualified persons can view all permits
- Users can only edit their own draft permits
- Qualified persons can update any permit status

**Jobs Cache Table:**
- All authenticated users can read
- Only system can write (via edge functions)

**User Management Table:**
- All authenticated users can read (for role checks)
- Only admins can write

**Storage Bucket:**
- Users can upload to their own permit folders
- Users can view their own permit PDFs
- Qualified persons can view all PDFs

### Input Validation

- Email format validation
- Phone number format validation
- Date range validation
- Required field checks
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitized inputs)

### Authentication

- Microsoft Azure AD OAuth 2.0
- Secure token storage (session storage)
- Token refresh handling
- Automatic logout on expiration

### API Security

- CORS configured for specific origins
- API rate limiting (Supabase)
- Edge function authentication
- Environment variable encryption

---

## Troubleshooting

### Common Issues

**1. SharePoint Jobs Not Loading**
- Check edge function logs
- Verify SharePoint credentials
- Ensure SharePoint list exists
- Check network connectivity

**2. Signature Not Appearing on PDF**
- Verify signature position is within PDF bounds
- Check browser console for errors
- Ensure PDF loaded completely before signing

**3. Authentication Errors**
- Verify Azure AD configuration
- Check redirect URI matches exactly
- Clear browser cache and cookies
- Verify API permissions granted

**4. Database Errors**
- Check RLS policies
- Verify user has correct role
- Check migration status
- Review Supabase logs

**5. Build Errors**
- Clear node_modules: `rm -rf node_modules && npm install`
- Update dependencies: `npm update`
- Check TypeScript errors: `npm run typecheck`

---

## Future Enhancements

### Planned Features

1. **Email Notifications**
   - Notify requester when permit approved/rejected
   - Notify qualified persons of new submissions
   - Digest emails for pending permits

2. **Advanced Search & Filters**
   - Date range filters
   - Multi-field search
   - Saved search presets
   - Export to CSV/Excel

3. **Document Attachments**
   - Upload supporting documents
   - Multiple file support
   - Preview images and PDFs
   - Version control

4. **Audit Trail**
   - Track all changes to permits
   - View history of edits
   - User action logs
   - Export audit reports

5. **Mobile App**
   - React Native mobile app
   - Push notifications
   - Offline support
   - Photo capture for documents

6. **Dashboard Analytics**
   - Permit statistics
   - Approval times
   - User activity metrics
   - Custom reports

7. **Bulk Operations**
   - Bulk approve/reject
   - Bulk status updates
   - Batch PDF generation

8. **Template System**
   - Permit templates
   - Pre-filled common permits
   - Template management

9. **Integration Enhancements**
   - Power Automate workflows
   - SharePoint document upload
   - Teams notifications
   - Calendar integration

10. **Advanced PDF Features**
    - Multiple signature fields
    - Form fields in PDF
    - QR code generation
    - Watermarks

---

## Support & Contact

For issues, questions, or contributions:

- **Email:** support@yourdomain.com
- **Documentation:** https://docs.yourdomain.com
- **Issue Tracker:** GitHub Issues
- **Community Forum:** https://community.yourdomain.com

---

## License

[Your License Here]

---

## Acknowledgments

- React Team for the excellent framework
- Supabase for backend infrastructure
- Microsoft for Azure AD and SharePoint APIs
- Open source contributors

---

**Last Updated:** March 25, 2026
**Version:** 1.0.0
