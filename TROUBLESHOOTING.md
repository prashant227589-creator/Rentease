# RentEase - Tenant Name Not Displaying - Troubleshooting Guide

## Issue
Tenant names are not displaying on the dashboard.

## Changes Made

I've added debugging capabilities and fallback handling to help identify and fix the issue:

### 1. Frontend Changes (index.html)

#### Added Debug Logging
- The app now logs all fetched tenant data to the browser console
- Shows the property keys of the first tenant object
- Warns when TenantName is missing

#### Added Fallback Handling
- The TenantCard component now tries multiple possible field names:
  - `TenantName` (expected)
  - `Tenant Name` (with space)
  - `tenantName` (lowercase)
  - Falls back to "Unnamed Tenant" if none found

### 2. Backend Changes (backend.gs)

#### Added Server-Side Logging
- Logs all column headers from the Google Sheet
- Logs the first tenant object to verify data structure
- Logs the TenantName value specifically

## How to Diagnose the Issue

### Step 1: Check Browser Console
1. Open RentEase in your browser
2. Press `F12` to open Developer Tools
3. Go to the "Console" tab
4. Look for these messages:
   - `📊 Fetched tenant data:` - Shows all tenant data
   - `📋 First tenant object keys:` - Shows available property names
   - `⚠️ Missing TenantName for tenant:` - Indicates the problem

### Step 2: Check Google Apps Script Logs
1. Open your Google Sheet
2. Go to Extensions > Apps Script
3. Click on "Executions" (left sidebar)
4. Find the most recent execution
5. Look for these log entries:
   - `📋 Sheet Headers:` - Shows your column headers
   - `📊 First tenant object:` - Shows the data structure
   - `🏷️ TenantName value:` - Shows the actual name value

## Common Causes & Solutions

### Cause 1: Incorrect Column Header in Google Sheet
**Symptom:** Console shows property name different from "TenantName"

**Solution:**
1. Open your Google Sheet
2. Check Row 1 (headers)
3. The first column should be exactly: `Tenant Name` (with a space)
4. If it's different (e.g., "TenantName", "Tenant  Name", "Name"), change it to `Tenant Name`

### Cause 2: Empty Tenant Name Cells
**Symptom:** Console shows `TenantName: ""` or `TenantName: null`

**Solution:**
1. Open your Google Sheet
2. Check that all rows have values in the "Tenant Name" column (Column A)
3. Fill in any missing names

### Cause 3: Column Order Changed
**Symptom:** Wrong data appears in the name field

**Solution:**
Ensure your Google Sheet columns are in this exact order:
1. Tenant Name
2. Phone
3. Email
4. Property Address
5. Rent Amount
6. Security Deposit
7. Lease Start
8. Lease End
9. Payment Status
10. Emergency Contact
11. Maintenance Status
12. Visibility (should be "Active" for visible tenants)

### Cause 4: Google Apps Script Not Deployed
**Symptom:** No data loads at all, or old data shows

**Solution:**
1. Open Extensions > Apps Script
2. Click "Deploy" > "Manage deployments"
3. Click "New deployment"
4. Select "Web app"
5. Set "Execute as" to "Me"
6. Set "Who has access" to "Anyone"
7. Click "Deploy"
8. Copy the new Web App URL
9. Update the `API_URL` in index.html (line 231)

## Quick Fix Steps

1. **Update Google Apps Script:**
   - Copy the updated `backend.gs` code
   - Paste it into your Google Apps Script editor
   - Save and deploy a new version

2. **Check the Console:**
   - Open the app in browser
   - Press F12
   - Check what the console logs show

3. **Verify Google Sheet Structure:**
   - Ensure headers match exactly
   - Ensure data is in correct columns
   - Ensure "Visibility" column (L) is set to "Active"

## Testing

After making changes:
1. Refresh the RentEase page
2. Open browser console (F12)
3. You should see:
   - Tenant data being fetched
   - Property keys listed
   - Tenant names displaying on cards

## Need More Help?

If the issue persists:
1. Take a screenshot of the browser console
2. Take a screenshot of your Google Sheet headers (Row 1)
3. Share the console logs showing the fetched data
