const SPREADSHEET_ID = '1W_dLyYZYJPuRAvRtcGLuabqkzKUoDuT3zsHYhSvC0aU';
const SHEET_NAME = 'Tenants';
const TRACKING_SHEET_NAME_PREFIX = 'RentTracking'; // Base name, actual sheet will be RentTracking or RentTracking-YYYY
const SCANNED_DOCS_SHEET_NAME = 'ScannedDocs';
const UPLOADS_FOLDER_NAME = 'RentEase_Uploads';

function getSs() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'PASTE_YOUR_SHEET_ID_HERE') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrSetupFolder() {
  const folders = DriveApp.getFoldersByName(UPLOADS_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(UPLOADS_FOLDER_NAME);
}

function getOrSetupScannedDocsSheet() {
  const ss = getSs();
  let sheet = ss.getSheetByName(SCANNED_DOCS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SCANNED_DOCS_SHEET_NAME);
    const headers = ['Date', 'File Name', 'File URL', 'Doc Type', 'Extracted Data', 'Status'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6');
  }
  return sheet;
}

function getOrSetupTrackingSheet(specificYear) {
  const ss = getSs();
  const year = specificYear || new Date().getFullYear();
  
  // Try to find the exact sheet first (e.g. RentTracking-2025)
  // Or the default "RentTracking" for the current active year if no suffix
  let sheetName = TRACKING_SHEET_NAME_PREFIX; 
  
  // Check if we have a versioned sheet for this year
  const versionedName = TRACKING_SHEET_NAME_PREFIX + '-' + year;
  let sheet = ss.getSheetByName(versionedName);
  
  // Logic: 
  // 1. Look for 'RentTracking-202X'.
  // 2. If not found, look for generic 'RentTracking'.
  // 3. If generic 'RentTracking' exists, check its metadata (cell A1 note or just assume it's current).
  //    Actually, we'll enforce the naming convention: 'RentTracking' is ALWAYS the CURRENT year's sheet.
  //    Old years get renamed to 'Ledger-YYYY'.
  
  sheet = ss.getSheetByName(TRACKING_SHEET_NAME_PREFIX);

  const expectedHeaders = ['Tenant Name', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Total Paid'];
  
  if (!sheet) {
    console.warn('Sheet not found: ' + TRACKING_SHEET_NAME_PREFIX + '. Attempting to create...');
    sheet = ss.insertSheet(TRACKING_SHEET_NAME_PREFIX);
    sheet.appendRow(expectedHeaders);
    sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight('bold').setBackground('#f3f4f6');
  }
  
  // Verify headers even if sheet exists
  const actualHeaders = sheet.getRange(1, 1, 1, expectedHeaders.length).getValues()[0];
  if (actualHeaders[0] !== 'Tenant Name') {
     console.error('Header mismatch on ' + TRACKING_SHEET_NAME_PREFIX + '. Resetting headers.');
     sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]).setFontWeight('bold').setBackground('#f3f4f6');
  }
  
  return sheet;
}

function ensureYearlySheet() {
  const ss = getSs();
  const currentYear = new Date().getFullYear();
  const trackingSheet = ss.getSheetByName(TRACKING_SHEET_NAME_PREFIX);

  if (!trackingSheet) return; // Should be created by getOrSetup if missing, but safety check

  // Check a metadata cell (e.g., cell Z1) to see what year this sheet belongs to.
  // If Z1 is empty, we assume it's the year it was created or we set it to current year if it's a new system.
  const yearCell = trackingSheet.getRange('Z1');
  let sheetYear = yearCell.getValue();

  if (!sheetYear) {
    // Initialize if missing
    yearCell.setValue(currentYear);
    return;
  }

  // If the sheet's year is less than the current year, it's time to rollover
  if (sheetYear < currentYear) {
    const oldSheetName = 'Ledger-' + sheetYear;
    
    // 1. Rename the old sheet
    trackingSheet.setName(oldSheetName);
    
    // 2. Create the new sheet for current year
    const newSheet = ss.insertSheet(TRACKING_SHEET_NAME_PREFIX);
    const expectedHeaders = ['Tenant Name', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Total Paid'];
    newSheet.appendRow(expectedHeaders);
    newSheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight('bold').setBackground('#f3f4f6');
    
    // 3. Set the new year metadata
    newSheet.getRange('Z1').setValue(currentYear);
    
    // 4. Pre-populate with active tenants
    const tenantsSheet = ss.getSheetByName(SHEET_NAME);
    const tenantsData = tenantsSheet.getDataRange().getValues();
    
    for (let j = 1; j < tenantsData.length; j++) {
      const tenantName = tenantsData[j][0];
      const visibility = tenantsData[j][11];
      if (visibility === 'Deleted' || visibility === 'Archived') continue;
      
      const newRow = [tenantName, 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 0];
      newSheet.appendRow(newRow);
    }
     const lastRow = newSheet.getLastRow();
     if(lastRow > 1) {
         newSheet.getRange(2, 14, lastRow - 1, 1).setFormulaR1C1('=COUNTIF(RC[-12]:RC[-1], "Paid")');
     }
  }
}

function doGet(e) {
  const ss = getSs();
  const tenantsSheet = ss.getSheetByName(SHEET_NAME);
  ensureYearlySheet(); // Check for rollover before fetching
  const trackingSheet = getOrSetupTrackingSheet();
  
  const type = e.parameter.type;
  
  if (type === 'ledger') {
    const data = trackingSheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().trim());
    const rows = [];
    
    // Calculate Overdue Status dynamically
    const today = new Date();
    const currentMonthIndex = today.getMonth(); // 0 = Jan, 1 = Feb...
    const currentDay = today.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // We need to write back overdue statuses if we find them
    let dataChanged = false;

    // Ensure all active tenants from Tenants sheet are in the ledger
    const tenantsData = tenantsSheet.getDataRange().getValues();
    const tenantNamesInLedger = data.slice(1).map(r => r[0]);
    
    for (let j = 1; j < tenantsData.length; j++) {
      const tenantName = tenantsData[j][0];
      const visibility = tenantsData[j][11];
      if (visibility === 'Deleted' || visibility === 'Archived') continue;
      
      if (tenantNamesInLedger.indexOf(tenantName) === -1) {
        // Add missing tenant to ledger
        const newRow = [tenantName, 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 'Unpaid', 0];
        trackingSheet.appendRow(newRow);
        const lastRow = trackingSheet.getLastRow();
        trackingSheet.getRange(lastRow, 14).setFormula('=COUNTIF(B' + lastRow + ':M' + lastRow + ', "Paid")');
      }
    }
    
    // Re-fetch data after potential additions
    const updatedData = trackingSheet.getDataRange().getValues();
    for (let i = 1; i < updatedData.length; i++) {
      const obj = {};
      let calculatedTotal = 0;
      
      // Check for Overdue
      for (let m = 0; m < 12; m++) {
         const monthName = months[m];
         const monthColIndex = headers.indexOf(monthName);
         if (monthColIndex === -1) continue;

         let status = updatedData[i][monthColIndex];
         
         // Logic:
         // 1. If month is in past (m < currentMonthIndex) AND status is 'Unpaid' -> Overdue
         // 2. If month is current (m === currentMonthIndex) AND day > 5 AND status is 'Unpaid' -> Overdue
         
         let newStatus = status;
         if (status === 'Unpaid') {
             if (m < currentMonthIndex) {
                 newStatus = 'Overdue';
             } else if (m === currentMonthIndex && currentDay > 5) {
                 newStatus = 'Overdue';
             }
         }
         
         if (newStatus !== status) {
             trackingSheet.getRange(i + 1, monthColIndex + 1).setValue(newStatus);
             updatedData[i][monthColIndex] = newStatus; // Update in memory for return

             // CRITICAL: If status became Overdue for CURRENT MONTH, sync to Tenants sheet
             if (newStatus === 'Overdue' && m === currentMonthIndex) {
                 const tenantName = updatedData[i][0];
                 // Find tenant row in tenantsData (cached above)
                 for (let k = 1; k < tenantsData.length; k++) {
                     if (tenantsData[k][0] === tenantName) {
                         // Column 9 is PaymentStatus (1-indexed, so 9)
                         tenantsSheet.getRange(k + 1, 9).setValue('Overdue'); 
                         break;
                     }
                 }
             }
         }
      }

      headers.forEach((header, index) => {
        const cleanHeader = header.replace(/\s+/g, '');
        let val = updatedData[i][index];
        if (typeof val === 'string') val = val.trim();
        obj[cleanHeader] = val;
        
        if (index >= 1 && index <= 12 && val === 'Paid') {
          calculatedTotal++;
        }
      });
      
      if (typeof obj.TotalPaid !== 'number') {
        obj.TotalPaid = calculatedTotal;
      }
      
      obj.id = i + 1;
      rows.push(obj);
    }
    return ContentService.createTextOutput(JSON.stringify(rows))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (type === 'schema') {
    const headers = trackingSheet.getRange(1, 1, 1, trackingSheet.getLastColumn()).getValues()[0];
    return ContentService.createTextOutput(JSON.stringify({ sheet: TRACKING_SHEET_NAME_PREFIX, headers: headers }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (type === 'tabs') {
    const sheets = ss.getSheets();
    const tabNames = sheets.map(s => s.getName());
    return ContentService.createTextOutput(JSON.stringify({ tabs: tabNames }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Default: Get Tenants
  const data = tenantsSheet.getDataRange().getValues();
  const headers = data[0];
  const rows = [];
  
  for (let i = 1; i < data.length; i++) {
    const visibility = data[i][11];
    if (visibility === 'Deleted' || visibility === 'Archived') continue;
    
    const obj = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.replace(/\s+/g, '');
      obj[cleanHeader] = data[i][index];
      
      // On-the-fly Overdue Calculation for Tenants List
      if (cleanHeader === 'PaymentStatus' && obj[cleanHeader] === 'Unpaid') {
         const today = new Date();
         // If today is past the 5th, mark as Overdue
         if (today.getDate() > 5) {
             obj[cleanHeader] = 'Overdue';
         }
      }
    });
    obj.id = i + 1;
    rows.push(obj);
  }
  
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = getSs();
  const tenantsSheet = ss.getSheetByName(SHEET_NAME);
  const trackingSheet = getOrSetupTrackingSheet();
  const payload = JSON.parse(e.postData.contents);
  const action = payload.action;

  if (action === 'addTenant') {
    try {
      // 1. Add to Tenants sheet
      tenantsSheet.appendRow([
        payload.TenantName,
        payload.Phone,
        payload.Email || '',
        payload.PropertyAddress,
        payload.RentAmount,
        payload.SecurityDeposit || '',
        payload.LeaseStart || '',
        payload.LeaseEnd,
        payload.PaymentStatus || 'Unpaid', // Default to Unpaid
        payload.EmergencyContact || '',
        payload.MaintenanceStatus || 'None',
        'Active' // Visibility Status
      ]);

      // 2. Add to RentTracking sheet
      const currentMonth = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date());
      const initialStatus = 'Unpaid';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const trackingRow = [payload.TenantName];
      months.forEach(m => {
        // If it's the current month, use the status from the payload, otherwise default to Unpaid
        if (m === currentMonth) {
          trackingRow.push(payload.PaymentStatus || 'Unpaid');
        } else {
          trackingRow.push(initialStatus);
        }
      });
      trackingRow.push(0); // Placeholder for Total Paid
      
      trackingSheet.appendRow(trackingRow);
      const lastRow = trackingSheet.getLastRow();
      trackingSheet.getRange(lastRow, 14).setFormula('=COUNTIF(B' + lastRow + ':M' + lastRow + ', "Paid")');

      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      console.error('Add Tenant Error:', err.toString());
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (action === 'updateLedger') {
    const tenantName = payload.TenantName;
    const month = payload.Month; // e.g., 'Jan'
    const status = payload.Status; // 'Paid', 'Unpaid', 'Overdue'
    
    const data = trackingSheet.getDataRange().getValues();
    const headers = data[0];
    const monthIndex = headers.indexOf(month);
    
    if (monthIndex !== -1) {
      let found = false;
      let updatedTotalPaid = 0;
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === tenantName) {
          trackingSheet.getRange(i + 1, monthIndex + 1).setValue(status);
          found = true;
          
          // Calculate updated Total Paid
          const updatedRow = trackingSheet.getRange(i + 1, 1, 1, 14).getValues()[0];
          updatedRow[monthIndex] = status; // Use the new status
          updatedTotalPaid = 0;
          for (let m = 1; m <= 12; m++) {
            if (updatedRow[m] === 'Paid') updatedTotalPaid++;
          }
          
          // Update main Tenants sheet if this is the current month
          const currentMonthName = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date());
          if (month === currentMonthName) {
            const tenantsData = tenantsSheet.getDataRange().getValues();
            for (let j = 1; j < tenantsData.length; j++) {
              if (tenantsData[j][0] === tenantName) {
                tenantsSheet.getRange(j + 1, 9).setValue(status); // Column 9 is Payment Status
                break;
              }
            }
          }
          break;
        }
      }
      
      // If tenant name not found in ledger, add them now
      if (!found) {
        const initialStatus = 'Unpaid';
        const newRow = new Array(14).fill(initialStatus);
        newRow[0] = tenantName;
        newRow[monthIndex] = status;
        newRow[13] = (status === 'Paid' ? 1 : 0);
        trackingSheet.appendRow(newRow);
        const lastRow = trackingSheet.getLastRow();
        trackingSheet.getRange(lastRow, 14).setFormula('=COUNTIF(B' + lastRow + ':M' + lastRow + ', "Paid")');
        updatedTotalPaid = (status === 'Paid' ? 1 : 0);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', TotalPaid: updatedTotalPaid }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } else if (action === 'setVisibility') {
    const tenantName = payload.TenantName;
    const visibility = payload.visibility; // 'Active' or 'Inactive'
    
    // 1. Update Tenants sheet
    const tenantsData = tenantsSheet.getDataRange().getValues();
    for (let i = 1; i < tenantsData.length; i++) {
      if (tenantsData[i][0] === tenantName) {
        tenantsSheet.getRange(i + 1, 12).setValue(visibility);
        break;
      }
    }
    
    // RentTracking sheet doesn't have a visibility column by default, but we can add logic to filter in doGet
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } else if (action === 'delete') {
    const tenantName = payload.TenantName;
    
    // 1. Delete from Tenants sheet
    const tenantsData = tenantsSheet.getDataRange().getValues();
    for (let i = tenantsData.length - 1; i >= 1; i--) {
      // Normalize comparison
      if (tenantsData[i][0].toString().trim() === tenantName.toString().trim()) {
        tenantsSheet.deleteRow(i + 1);
        console.log('🗑️ Deleted ' + tenantName + ' from Tenants');
      }
    }
    
    // 2. Delete from RentTracking sheet
    const trackingData = trackingSheet.getDataRange().getValues();
    for (let i = trackingData.length - 1; i >= 1; i--) {
      if (trackingData[i][0].toString().trim() === tenantName.toString().trim()) {
        trackingSheet.deleteRow(i + 1);
        console.log('🗑️ Deleted ' + tenantName + ' from RentTracking');
      }
    }
  } else if (action === 'update') {
    const rowId = payload.id;
    const oldName = payload.oldName;
    const newName = payload.TenantName;

    if (rowId) {
      // 1. Update Tenants sheet
      tenantsSheet.getRange(rowId, 1, 1, 11).setValues([[
        payload.TenantName, payload.Phone, payload.Email || '', 
        payload.PropertyAddress, payload.RentAmount, payload.SecurityDeposit || '',
        payload.LeaseStart || '', payload.LeaseEnd, payload.PaymentStatus || 'Paid',
        payload.EmergencyContact || '', payload.MaintenanceStatus || 'None'
      ]]);

      // 2. Cross-tab Rename Logic: If name changed, update RentTracking
      if (oldName && newName && oldName !== newName) {
        const trackingData = trackingSheet.getDataRange().getValues();
        for (let i = 1; i < trackingData.length; i++) {
          if (trackingData[i][0] === oldName) {
            trackingSheet.getRange(i + 1, 1).setValue(newName);
            console.log('🔄 Renamed ' + oldName + ' to ' + newName + ' in RentTracking');
            break;
          }
        }
      }
    }
  } else if (action === 'saveScannedDoc') {
    const docSheet = getOrSetupScannedDocsSheet();
    const folder = getOrSetupFolder();
    
    // Save file if base64 provided
    let fileUrl = '';
    if (payload.base64) {
      const blob = Utilities.newBlob(Utilities.base64Decode(payload.base64), payload.mimeType, payload.fileName);
      const file = folder.createFile(blob);
      fileUrl = file.getUrl();
    }

    docSheet.appendRow([
      new Date(),
      payload.fileName || 'Unknown',
      fileUrl || payload.fileUrl || '',
      payload.docType || 'Receipt',
      JSON.stringify(payload.extractedData),
      'Confirmed'
    ]);

    // Update maintenance status if it's a receipt
    if (payload.docType === 'Receipt' && payload.TenantName) {
      const tenantsData = tenantsSheet.getDataRange().getValues();
      for (let i = 1; i < tenantsData.length; i++) {
        if (tenantsData[i][0] === payload.TenantName) {
          tenantsSheet.getRange(i + 1, 11).setValue('Completed'); // Column 11 is Maintenance Status
          break;
        }
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}
