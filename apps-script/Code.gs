/**
 * BUSINESS MONITOR — Google Sheets API bridge
 * -------------------------------------------
 * This version splits data across FOUR spreadsheets:
 *   - One "Directory" spreadsheet holding just the Credentials tab, shared
 *     by every staff member across every region.
 *   - One spreadsheet PER REGION (Luzon / Visayas / Mindanao), each holding
 *     that region's PriceList / Ledger / Inventory / Collectibles tabs for
 *     all its stores.
 * This keeps each region's data sheet a manageable size as you add stores,
 * and lets you grant a regional manager direct Google Sheets access to just
 * their region if that's ever useful.
 *
 * SETUP:
 * 1. Create the Directory spreadsheet with one tab, "Credentials":
 *      Username | Password | Role | Region | Store
 *    "Role" is "staff" or "admin". "Region" must be one of the keys in
 *    REGION_SHEETS below (e.g. "Visayas"). "Store" must match exactly what
 *    you use in that region's data sheet (e.g. "Cebu").
 *
 * 2. Create one spreadsheet per region, each with these tabs (same shape
 *    in every region sheet):
 *      PriceList    : Store | Category | ItemName | SRP | Percentage | DistPrice
 *      Ledger       : Store | Location | Date | BegBalance | Reference | Delivery | Payment | Balance
 *      Inventory    : Store | Category | Date | ItemName | Beg | In | Out | Total | OutTo | Address | DeliveredBy | Remarks
 *      Collectibles : Store | Province | District | Municipality | Date | Name | Address | Balance
 *    ("Category" in Inventory should be "Old" or "New" per row.)
 *
 * 3. Open script.google.com/home, create a new project, paste this whole
 *    file in over Code.gs.
 * 4. Fill in DIRECTORY_SHEET_ID and all three REGION_SHEETS IDs below (the
 *    long string in each spreadsheet's URL, between /d/ and /edit).
 * 5. Deploy > New deployment > type "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web App URL it gives you into js/config.js on the site side.
 *
 * Adding a new store: just add rows for it in the right region's tabs, and
 * a Credentials row pointing staff at that Region + Store. No code changes.
 *
 * Adding a new region: add a tab-alike spreadsheet, then add one entry to
 * REGION_SHEETS below and redeploy.
 */

const DIRECTORY_SHEET_ID = 'PASTE_YOUR_DIRECTORY_SHEET_ID_HERE';

const REGION_SHEETS = {
  'Luzon': 'PASTE_LUZON_SHEET_ID_HERE',
  'Visayas': 'PASTE_VISAYAS_SHEET_ID_HERE',
  'Mindanao': 'PASTE_MINDANAO_SHEET_ID_HERE'
};

function doGet(e) {
  return handleRequest(e, false);
}

function doPost(e) {
  return handleRequest(e, true);
}

function handleRequest(e, isPost) {
  try {
    var params = isPost ? JSON.parse(e.postData.contents) : e.parameter;
    var action = params.action;
    var result;

    switch (action) {
      case 'login': {
        var directory = SpreadsheetApp.openById(DIRECTORY_SHEET_ID);
        result = login(directory, params.username, params.password);
        break;
      }
      case 'getData': {
        var ss = regionSheet(params.region);
        result = getSheetData(ss, params.sheet, params.store);
        break;
      }
      case 'getAllData': {
        result = getAllRegionsData(params.sheet);
        break;
      }
      case 'addRow': {
        var ss2 = regionSheet(params.region);
        result = addRow(ss2, params.sheet, params.data);
        break;
      }
      case 'updateRow': {
        var ss3 = regionSheet(params.region);
        result = updateRow(ss3, params.sheet, params.row, params.data);
        break;
      }
      case 'deleteRow': {
        var ss4 = regionSheet(params.region);
        result = deleteRow(ss4, params.sheet, params.row);
        break;
      }
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ success: false, error: err.message });
  }
}

function regionSheet(region) {
  var id = REGION_SHEETS[region];
  if (!id) throw new Error('Unknown or unconfigured region: ' + region);
  return SpreadsheetApp.openById(id);
}

// Used by the admin dashboard: pulls one sheet (e.g. "Ledger") from every
// region and merges the rows into one list, tagging each row with which
// region it came from. Lets the admin see everything in one place.
function getAllRegionsData(sheetName) {
  var allRows = [];
  var errors = [];
  Object.keys(REGION_SHEETS).forEach(function (region) {
    try {
      var ss = regionSheet(region);
      var res = getSheetData(ss, sheetName, null);
      if (res.success) {
        res.rows.forEach(function (r) { r.Region = region; });
        allRows = allRows.concat(res.rows);
      } else {
        errors.push(region + ': ' + res.error);
      }
    } catch (err) {
      errors.push(region + ': ' + err.message);
    }
  });
  return { success: true, rows: allRows, errors: errors };
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function login(ss, username, password) {
  var sheet = ss.getSheetByName('Credentials');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[0]).trim() === String(username).trim() &&
        String(row[1]).trim() === String(password).trim()) {
      return {
        success: true,
        role: row[2],
        region: row[3],
        store: row[4]
      };
    }
  }
  return { success: false, error: 'Invalid username or password' };
}

function getSheetData(ss, sheetName, store) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Sheet not found: ' + sheetName };
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var rowObj = {};
    for (var j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = data[i][j];
    }
    if (!store || String(rowObj.Store) === String(store)) {
      rowObj._row = i + 1;
      rows.push(rowObj);
    }
  }
  return { success: true, rows: rows };
}

function addRow(ss, sheetName, dataObj) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Sheet not found: ' + sheetName };
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newRow = headers.map(function (h) {
    return dataObj[h] !== undefined ? dataObj[h] : '';
  });
  sheet.appendRow(newRow);
  return { success: true };
}

// rowNumber is the actual sheet row (the _row value returned alongside each
// row from getData/getAllData — includes the header row offset already).
function updateRow(ss, sheetName, rowNumber, dataObj) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Sheet not found: ' + sheetName };
  if (!rowNumber || rowNumber < 2) return { success: false, error: 'Invalid row number' };
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newRow = headers.map(function (h) {
    return dataObj[h] !== undefined ? dataObj[h] : '';
  });
  sheet.getRange(rowNumber, 1, 1, newRow.length).setValues([newRow]);
  return { success: true };
}

function deleteRow(ss, sheetName, rowNumber) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Sheet not found: ' + sheetName };
  if (!rowNumber || rowNumber < 2) return { success: false, error: 'Invalid row number' };
  sheet.deleteRow(rowNumber);
  return { success: true };
}
