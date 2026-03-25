# Licensing Integration Debug Guide

## What Was Fixed

### Problem Identified
The form was showing "No active licenses found for this combination" because:

1. **Subsidiary Name Mismatch**:
   - Form shows: "Mountain Wireless" (from job details)
   - Database has: "Mountain Wireless LLC"
   - Previous matching was too strict

2. **Data Quality Issues**:
   - Some states in the database have trailing spaces (e.g., "Utah ", "Colorado ")
   - State matching was doing exact equality checks

### Changes Made

#### 1. Enhanced Subsidiary Matching (`licensingService.ts`)
Added a comprehensive mapping system:
```typescript
const SUBSIDIARY_MAPPING = {
  'ETT': ['EasTex Tower LLC', 'EasTex Tower', 'ETT'],
  'CMS': ['CMS Wireless LLC', 'CMS Wireless', 'CMS'],
  'ETR': ['Enertech Resources LLC', 'Enertech', 'ETR'],
  'LEG': ['Legacy Telecommunications LLC', 'Legacy', 'LEG'],
  'MW': ['Mountain Wireless LLC', 'Mountain Wireless', 'MW'],
  'ONT': ['Ontivity LLC', 'Ontivity', 'ONT'],
};
```

Now "Mountain Wireless" will match "Mountain Wireless LLC" and "MW" automatically.

#### 2. Fixed State Matching
- Added `.trim()` to remove trailing spaces
- Changed to case-insensitive comparison
- All state queries now normalize the data before matching

#### 3. Added Comprehensive Logging
Console logs will now show:
- Query parameters being sent
- Raw data count from database
- How many records match after filtering
- Final results

## How to Test

### 1. Open Browser Console
Press `F12` or right-click → Inspect → Console tab

### 2. Fill Out the Form
1. Select **Ontivity Project Number**: "25-11-0054_Vogel Canyon"
2. **Performing Entity** should auto-fill: "Mountain Wireless"
3. Select **Permit Level**: "State" (already selected)
4. Select **Type of Permit**: "General Permit"

### 3. Check Console Logs
You should see:
```
[getAvailableStates] Query params: { permitLevel: "State", permitType: "General", subsidiary: "Mountain Wireless", sourceList: "state_contractor" }
[getAvailableStates] Raw data count: 120
[getAvailableStates] Sample subsidiaries from DB: ["Mountain Wireless LLC", "EasTex Tower LLC", ...]
[getAvailableStates] Match found: { dbSubsidiary: "Mountain Wireless LLC", formSubsidiary: "Mountain Wireless" }
[getAvailableStates] Filtered count: 2
[getAvailableStates] Final states: ["Idaho", "Utah"]
```

### 4. Expected Behavior

#### For Mountain Wireless + State + General:
- Should show: Idaho, Utah

#### For Mountain Wireless + State + Electrical:
- Should show: Colorado, Utah, Wisconsin, Wyoming

#### For Mountain Wireless + County/City + General:
- Select State: Colorado
- Should show: 68+ county/city options

## Database Statistics

Current licensing_cache data:
- **Total records**: 474
- **Subsidiaries**: 6 (CMS, EasTex, Enertech, Legacy, Mountain Wireless, Ontivity)
- **States**: 40
- **Lists**: 4 (state_contractor, state_electrical, county_contractor, county_electrical)

### Mountain Wireless LLC Data:
- **State Contractor**: Idaho (1), Utah (1)
- **State Electrical**: Colorado (1), Utah (1), Wyoming (1)
- **County Contractor**: Colorado (68), Montana (2), Wyoming (7)
- **County Electrical**: Colorado (25), Wyoming (1)

## Troubleshooting

### If states dropdown is still empty:

1. **Check Console Logs**: Look for any errors or unexpected values
2. **Verify Data**: Run this query in Supabase SQL Editor:
   ```sql
   SELECT * FROM licensing_cache
   WHERE subsidiary = 'Mountain Wireless LLC'
   AND source_list = 'state_contractor'
   AND status = 'Active';
   ```
3. **Check Performing Entity**: Make sure it says "Mountain Wireless" (not MW, not blank)

### If QP fields show "Loading..." forever:

1. Check console for `[getQPForSelection]` logs
2. Verify the selected state exists in the database
3. Check that the subsidiary matching is working

## Next Steps

Once you confirm this works:
1. We can remove the debug console.log statements
2. Add data cleanup migration to trim all state names
3. Consider adding data validation to the sync function
