import { Student, AttendanceData, SheetSyncInfo } from '../types';
import { CURRENT_YEAR, CURRENT_MONTH_INDEX, CURRENT_MONTH_NAME } from '../data/students';

export interface SpreadsheetFile {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

// Fetch user profile info using the token
export const fetchUserProfile = async (token: string) => {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch user profile');
    return await res.json();
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

// Fetch all spreadsheets owned or accessed by the user, with optional search query
export const fetchSpreadsheets = async (token: string, searchQuery?: string): Promise<SpreadsheetFile[]> => {
  try {
    let queryStr = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
    if (searchQuery && searchQuery.trim() !== '') {
      const escapedQuery = searchQuery.replace(/'/g, "\\'");
      queryStr += ` and name contains '${escapedQuery}'`;
    }
    const query = encodeURIComponent(queryStr);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink,modifiedTime)&orderBy=modifiedTime desc&pageSize=50`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch spreadsheets from Google Drive');
    }
    
    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error('Error listing spreadsheets:', error);
    throw error;
  }
};

// Get sheet names inside a spreadsheet
export const fetchSpreadsheetSheets = async (
  token: string,
  spreadsheetId: string
): Promise<{ id: number; name: string }[]> => {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch sheet properties');
    }
    
    const data = await res.json();
    return (data.sheets || []).map((s: any) => ({
      id: s.properties.sheetId,
      name: s.properties.title,
    }));
  } catch (error) {
    console.error('Error fetching spreadsheet details:', error);
    throw error;
  }
};

// Fetch and parse attendance data from a specific sheet
export const fetchAttendanceFromSheet = async (
  token: string,
  spreadsheetId: string,
  sheetName: string,
  students: Student[]
): Promise<{ attendanceData: AttendanceData; dates: string[]; originalRows: any[][] }> => {
  try {
    // Read the whole sheet (e.g. first 100 rows, columns A to AZ)
    const range = `${encodeURIComponent(sheetName)}!A1:AZ100`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch sheet values');
    }
    
    const data = await res.json();
    const rows = data.values || [];
    
    if (rows.length < 3) {
      throw new Error('Sheet structure is invalid. Expected at least 3 header rows.');
    }

    // Let's parse the header row (typically row 3, which is index 2)
    const headerRow = rows[2] || [];
    
    // Find columns
    const enrColIndex = headerRow.findIndex((cell: string) => cell?.toLowerCase().includes('enr') || cell?.toLowerCase().includes('enroll'));
    const nameColIndex = headerRow.findIndex((cell: string) => cell?.toLowerCase().includes('name'));
    
    // Find date columns (usually column E/index 4 to AJ/index 34)
    // Let's identify cells that represent dates (contains "August", "Saturday", "Monday", or matches date formats)
    const dateColumns: { index: number; label: string; key: string }[] = [];
    
    headerRow.forEach((cell: string, idx: number) => {
      // Date headers have comma and space e.g. "Saturday, August 1"
      if (cell && (cell.includes(',') || cell.includes('/') || /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(cell))) {
        // Formulate a clean YYYY-MM-DD key. Let's extract date.
        // If the header matches "Saturday, August 1" we can map to "2026-08-01"
        const cleanKey = parseDateHeaderToYMD(cell);
        if (cleanKey) {
          dateColumns.push({ index: idx, label: cell, key: cleanKey });
        }
      }
    });

    // If no date columns found dynamically, default to columns E to AI (August 1 to 31)
    if (dateColumns.length === 0) {
      for (let day = 1; day <= 31; day++) {
        const colIdx = 4 + (day - 1); // Column E starts at index 4
        const cellLabel = headerRow[colIdx] || `August ${day}`;
        const key = `2026-08-${day.toString().padStart(2, '0')}`;
        dateColumns.push({ index: colIdx, label: cellLabel, key });
      }
    }

    const attendanceData: AttendanceData = {};
    
    // Initialize date categories
    dateColumns.forEach((dc) => {
      attendanceData[dc.key] = {};
    });

    // Parse student rows (starting from row 4, which is index 3)
    for (let r = 3; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 2) continue;
      
      const enrNumber = String(row[enrColIndex !== -1 ? enrColIndex : 1] || '').trim();
      if (!enrNumber || enrNumber.toLowerCase().includes('total') || enrNumber.toLowerCase().includes('average')) {
        continue; // skip totals or empty lines
      }

      // Check if student exists in our registry
      const student = students.find((s) => s.enrNumber === enrNumber);
      if (student) {
        dateColumns.forEach((dc) => {
          let val = String(row[dc.index] || '').trim().toUpperCase();
          if (val === 'P' || val === 'A' || val === 'L') {
            attendanceData[dc.key][student.enrNumber] = val;
          } else {
            attendanceData[dc.key][student.enrNumber] = '';
          }
        });
      }
    }

    const dates = dateColumns.map((dc) => dc.key);
    return { attendanceData, dates, originalRows: rows };
  } catch (error) {
    console.error('Error parsing sheet attendance:', error);
    throw error;
  }
};

// Helper to convert header "Saturday, August 1" -> "2026-08-01"
export const parseDateHeaderToYMD = (header: string): string | null => {
  try {
    const clean = header.replace(/\s+/g, ' ').trim();
    // Example: "Saturday, August 1" or "August 1, 2026"
    const months: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
      jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };

    const lowercase = clean.toLowerCase();
    let foundMonth = '08'; // Default August
    let foundDay = '01';
    let foundYear = '2026'; // Default

    // Find month
    for (const [mName, mNum] of Object.entries(months)) {
      if (lowercase.includes(mName)) {
        foundMonth = mNum;
        // Find day number following or preceding the month
        const match = lowercase.match(new RegExp(`${mName}\\s+(\\d+)`)) || lowercase.match(new RegExp(`(\\d+)(?:st|nd|rd|th)?\\s+${mName}`));
        if (match && match[1]) {
          foundDay = match[1].padStart(2, '0');
        }
        break;
      }
    }

    // Check if header contains a 4-digit year, else default to 2026
    const yearMatch = clean.match(/\b(202\d)\b/);
    if (yearMatch && yearMatch[1]) {
      foundYear = yearMatch[1];
    }

    return `${foundYear}-${foundMonth}-${foundDay}`;
  } catch {
    return null;
  }
};

// Sync attendance changes back to Google Sheets (batch update)
export const syncAttendanceToGoogleSheets = async (
  token: string,
  spreadsheetId: string,
  sheetName: string,
  updates: { enrNumber: string; date: string; status: 'P' | 'A' | 'L' | '' }[],
  originalRows: any[][]
): Promise<boolean> => {
  try {
    if (updates.length === 0) return true;

    // We need to fetch sheet structure to locate cell ranges
    // Typically:
    // Header Row is at Index 2 (row 3)
    // Date columns are E to AI (index 4 to 34)
    // Student Rows start at Index 3 (row 4)
    
    const headerRow = originalRows[2] || [];
    const enrColIndex = headerRow.findIndex((cell: string) => cell?.toLowerCase().includes('enr') || cell?.toLowerCase().includes('enroll'));
    
    // Find column index for dates
    const dateToColIndex: Record<string, number> = {};
    for (let colIdx = 4; colIdx < headerRow.length; colIdx++) {
      const cell = headerRow[colIdx];
      if (cell) {
        const cleanKey = parseDateHeaderToYMD(cell);
        if (cleanKey) {
          dateToColIndex[cleanKey] = colIdx;
        }
      }
    }

    // If dates didn't parse dynamically, default standard column indexes for current month
    if (Object.keys(dateToColIndex).length === 0) {
      const daysInMonth = new Date(CURRENT_YEAR, CURRENT_MONTH_INDEX + 1, 0).getDate();
      const monthStr = String(CURRENT_MONTH_INDEX + 1).padStart(2, '0');
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${CURRENT_YEAR}-${monthStr}-${day.toString().padStart(2, '0')}`;
        dateToColIndex[dateKey] = 4 + (day - 1);
      }
    }

    // Find row index for students based on enrNumber
    const enrToRowIndex: Record<string, number> = {};
    for (let rIdx = 3; rIdx < originalRows.length; rIdx++) {
      const row = originalRows[rIdx];
      if (row) {
        const enr = String(row[enrColIndex !== -1 ? enrColIndex : 1] || '').trim();
        if (enr) {
          enrToRowIndex[enr] = rIdx;
        }
      }
    }

    // Create a list of ValueRanges for batch update
    const dataValueRanges = updates.map((upd) => {
      const rIdx = enrToRowIndex[upd.enrNumber];
      const cIdx = dateToColIndex[upd.date];
      
      if (rIdx === undefined || cIdx === undefined) {
        console.warn(`Could not find coordinate for student ${upd.enrNumber} and date ${upd.date}`);
        return null;
      }

      const colLetter = getColumnLetter(cIdx + 1);
      const rowNum = rIdx + 1;
      const range = `${sheetName}!${colLetter}${rowNum}`;

      return {
        range,
        values: [[upd.status]],
      };
    }).filter(Boolean);

    if (dataValueRanges.length === 0) {
      throw new Error('Could not find matches for students or dates in the Google Sheet structure.');
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: dataValueRanges,
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to update spreadsheet cells');
    }

    return true;
  } catch (error) {
    console.error('Error syncing to Google Sheets:', error);
    throw error;
  }
};

// Create a completely new attendance Google Sheet with formulas and formatting
export const createNewAttendanceSheet = async (
  token: string,
  title: string,
  students: Student[]
): Promise<string> => {
  try {
    const daysInMonth = new Date(CURRENT_YEAR, CURRENT_MONTH_INDEX + 1, 0).getDate();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const headers = [
      'S.No', 'Enr.Number', 'Name', 'Gender',
      // Current month headers
      ...Array.from({ length: daysInMonth }, (_, i) => {
        const date = new Date(CURRENT_YEAR, CURRENT_MONTH_INDEX, i + 1);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `${days[date.getDay()]}, ${months[date.getMonth()]} ${i + 1}`;
      }),
      'Total Present', 'Total Absent', 'Average'
    ];

    const lastAttendanceColLetter = getColumnLetter(4 + daysInMonth); // e.g. AH (for 30 days)
    const presentColLetter = getColumnLetter(4 + daysInMonth + 1); // e.g. AI
    const absentColLetter = getColumnLetter(4 + daysInMonth + 2); // e.g. AJ

    const values = [
      [`Student Attendance Sheet - Month of ${CURRENT_MONTH_NAME} ${CURRENT_YEAR}`, ...Array(headers.length - 1).fill('')],
      ['3rd Year- Section A', ...Array(headers.length - 1).fill('')],
      headers,
      // Students with formula
      ...students.map((student, idx) => {
        const row = idx + 4; // Excel row number (1-indexed, starting after 3 headers)
        return [
          student.id,
          student.enrNumber,
          student.name,
          student.gender,
          // empty columns for attendance
          ...Array(daysInMonth).fill(''),
          `=COUNTIF(E${row}:${lastAttendanceColLetter}${row}, "P")`,
          `=COUNTIF(E${row}:${lastAttendanceColLetter}${row}, "A")`,
          `=IF((${presentColLetter}${row}+${absentColLetter}${row})>0, ${presentColLetter}${row}/(${presentColLetter}${row}+${absentColLetter}${row}), 0)`
        ];
      })
    ];

    // Post to sheets create API
    const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    const res = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
        sheets: [
          {
            properties: {
              title: `${CURRENT_MONTH_NAME} ${CURRENT_YEAR}`,
              gridProperties: {
                frozenRowCount: 3,
                frozenColumnCount: 4,
              },
            },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: values.map((row) => ({
                  values: row.map((val) => {
                    if (typeof val === 'string' && val.startsWith('=')) {
                      return { userEnteredValue: { formulaValue: val } };
                    } else if (typeof val === 'number') {
                      return { userEnteredValue: { numberValue: val } };
                    } else {
                      return { userEnteredValue: { stringValue: String(val) } };
                    }
                  }),
                })),
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to create new spreadsheet');
    }

    const createdData = await res.json();
    const spreadsheetId = createdData.spreadsheetId;

    // Apply formatting to cells (like setting column width, alignments, colors)
    await formatAttendanceSheet(token, spreadsheetId, createdData.sheets[0].properties.sheetId, students.length);

    return spreadsheetId;
  } catch (error) {
    console.error('Error creating spreadsheet:', error);
    throw error;
  }
};

// Format a sheet beautifully (styling borders, background colors, alignments, averages as %)
const formatAttendanceSheet = async (
  token: string,
  spreadsheetId: string,
  sheetId: number,
  studentCount: number
) => {
  try {
    const daysInMonth = new Date(CURRENT_YEAR, CURRENT_MONTH_INDEX + 1, 0).getDate();
    const totalCols = 4 + daysInMonth + 3; // S.No, Enr, Name, Gender + days + 3 totals
    const avgColIndex = totalCols - 1;
    const totalsStartIndex = totalCols - 3;
    const totalsEndIndex = totalCols - 1;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const requests = [
      // 1. Format title rows (Merge columns A to last column)
      {
        mergeCells: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: totalCols },
          mergeType: 'MERGE_ALL',
        },
      },
      {
        mergeCells: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalCols },
          mergeType: 'MERGE_ALL',
        },
      },
      // 2. Format Title Text Styling (Row 1)
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: totalCols },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 16, bold: true, foregroundColor: { red: 0.1, green: 0.2, blue: 0.4 } },
              horizontalAlignment: 'CENTER',
              backgroundColor: { red: 0.92, green: 0.94, blue: 0.98 },
            },
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)',
        },
      },
      // 3. Format Subtitle Text Styling (Row 2)
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalCols },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 12, italic: true },
              horizontalAlignment: 'CENTER',
              backgroundColor: { red: 0.95, green: 0.97, blue: 0.99 },
            },
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)',
        },
      },
      // 4. Format Header Row Styling (Row 3 / index 2)
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: totalCols },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 10, bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
              backgroundColor: { red: 0.2, green: 0.3, blue: 0.5 },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)',
        },
      },
      // 5. Format Average Column as Percentage
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 3, endRowIndex: 3 + studentCount, startColumnIndex: avgColIndex, endColumnIndex: totalCols },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'PERCENT', pattern: '0.00%' },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
        },
      },
      // 6. Format Total Columns
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 3, endRowIndex: 3 + studentCount, startColumnIndex: totalsStartIndex, endColumnIndex: totalsEndIndex },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER',
              textFormat: { bold: true },
            },
          },
          fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
        },
      },
      // 7. Adjust Column Widths (S.No: 50, Enr: 80, Name: 200, Gender: 60, Dates: 45, Totals: 80)
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 50 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
          properties: { pixelSize: 85 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
          properties: { pixelSize: 200 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
          properties: { pixelSize: 60 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 4 + daysInMonth },
          properties: { pixelSize: 45 },
          fields: 'pixelSize',
        },
      },
    ];

    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });
  } catch (error) {
    console.warn('Formatting spreadsheet warning:', error);
  }
};

// Convert column number to letter (1 -> A, 28 -> AB)
const getColumnLetter = (colNum: number): string => {
  let letter = '';
  while (colNum > 0) {
    let temp = (colNum - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    colNum = Math.floor((colNum - temp) / 26);
  }
  return letter;
};

// Create a beautifully formatted Monthly Summary Attendance Report in Google Drive
export const createMonthlyReportSheet = async (
  token: string,
  title: string,
  students: Student[],
  attendance: AttendanceData
): Promise<{ spreadsheetId: string; webViewLink: string }> => {
  try {
    const dates = Object.keys(attendance);
    
    // Calculate individual student metrics
    const studentMetrics = students.map((s) => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let marked = 0;
      
      dates.forEach((date) => {
        const status = attendance[date]?.[s.enrNumber] || '';
        if (status === 'P') { present++; marked++; }
        else if (status === 'A') { absent++; marked++; }
        else if (status === 'L') { late++; marked++; }
      });
      
      const absentDueToLate = Math.floor(late / 3);
      const rate = marked > 0 ? (present + late - absentDueToLate) / marked : 1.0;
      let risk = 'Regular';
      if (marked > 0) {
        const ratePct = Math.round(rate * 100);
        if (ratePct >= 95) risk = 'Outstanding (≥95%)';
        else if (ratePct >= 85) risk = 'Regular (85-94%)';
        else if (ratePct >= 75) risk = 'Vulnerable (75-84%)';
        else risk = 'Critical (<75%)';
      }
      
      return {
        id: s.id,
        enrNumber: s.enrNumber,
        name: s.name,
        gender: s.gender,
        present,
        absent,
        late,
        rate,
        risk,
        remarks: s.notes || ''
      };
    });

    // Calculate overall metrics
    const totalEnrolled = students.length;
    const totalMarked = studentMetrics.reduce((sum, sm) => sum + (sm.present + sm.absent + sm.late), 0);
    const totalEffectivePresent = studentMetrics.reduce((sum, sm) => sum + (sm.present + sm.late - Math.floor(sm.late / 3)), 0);
    const overallRate = totalMarked > 0 ? totalEffectivePresent / totalMarked : 1.0;
    
    const outstandingCount = studentMetrics.filter(sm => sm.rate >= 0.95).length;
    const criticalCount = studentMetrics.filter(sm => sm.rate < 0.75).length;

    const headers = [
      'S.No', 'Enrollment Number', 'Student Name', 'Gender', 
      'Present Days', 'Absent Days', 'Late Days', 'Attendance Rate', 
      'Risk Category', 'Teacher Notes & Remarks'
    ];

    const values = [
      ['CLASSROOM MONTHLY ATTENDANCE REPORT SUMMARY', ...Array(headers.length - 1).fill('')],
      [`Class: 3rd Year • Section A  |  Month: ${CURRENT_MONTH_NAME} ${CURRENT_YEAR}  |  Report Generated: ${new Date().toLocaleDateString()}`, ...Array(headers.length - 1).fill('')],
      Array(headers.length).fill(''),
      ['KEY PERFORMANCE INDICATORS', ...Array(headers.length - 1).fill('')],
      ['Overall Monthly Attendance Rate', `${Math.round(overallRate * 100)}%`, 'Total Enrolled Students', totalEnrolled, ...Array(headers.length - 4).fill('')],
      ['Outstanding Students (≥95%)', outstandingCount, 'At-Risk Students (<75%)', criticalCount, ...Array(headers.length - 4).fill('')],
      Array(headers.length).fill(''),
      headers,
      ...studentMetrics.map((sm) => [
        sm.id,
        sm.enrNumber,
        sm.name,
        sm.gender,
        sm.present,
        sm.absent,
        sm.late,
        sm.rate,
        sm.risk,
        sm.remarks
      ])
    ];

    // Post to Sheets API
    const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    const res = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
        sheets: [
          {
            properties: {
              title: 'Monthly Summary',
              gridProperties: {
                frozenRowCount: 8,
                frozenColumnCount: 3,
              },
            },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: values.map((row) => ({
                  values: row.map((val) => {
                    if (typeof val === 'number') {
                      return { userEnteredValue: { numberValue: val } };
                    } else {
                      return { userEnteredValue: { stringValue: String(val) } };
                    }
                  }),
                })),
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to create monthly summary spreadsheet in Google Drive');
    }

    const createdData = await res.json();
    const spreadsheetId = createdData.spreadsheetId;
    const webViewLink = createdData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    const sheetId = createdData.sheets[0].properties.sheetId;

    // Format Monthly Summary Report
    await formatMonthlyReportSheet(token, spreadsheetId, sheetId, studentMetrics.length);

    return { spreadsheetId, webViewLink };
  } catch (error) {
    console.error('Error creating monthly report:', error);
    throw error;
  }
};

// Format the Monthly Summary spreadsheet beautifully
const formatMonthlyReportSheet = async (
  token: string,
  spreadsheetId: string,
  sheetId: number,
  studentCount: number
) => {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const requests = [
      // Merge Title Row
      {
        mergeCells: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 },
          mergeType: 'MERGE_ALL',
        },
      },
      // Merge Subtitle Row
      {
        mergeCells: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 10 },
          mergeType: 'MERGE_ALL',
        },
      },
      // Main Title Format (Slate Dark Blue Theme)
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 14, bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
              horizontalAlignment: 'CENTER',
              backgroundColor: { red: 0.1, green: 0.2, blue: 0.35 },
            },
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)',
        },
      },
      // Subtitle Format
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 10 },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 10, foregroundColor: { red: 0.4, green: 0.4, blue: 0.4 } },
              horizontalAlignment: 'CENTER',
              backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 },
            },
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)',
        },
      },
      // Merge KPI Header
      {
        mergeCells: {
          range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 10 },
          mergeType: 'MERGE_ALL',
        },
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 10 },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 10, bold: true, foregroundColor: { red: 0.2, green: 0.3, blue: 0.5 } },
              backgroundColor: { red: 0.92, green: 0.94, blue: 0.97 },
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      },
      // KPI values styling (Bold label columns)
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 4, endRowIndex: 6, startColumnIndex: 0, endColumnIndex: 4 },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 9, bold: true },
              backgroundColor: { red: 0.98, green: 0.98, blue: 0.99 },
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      },
      // Data table Header Row format (Row 8 / Index 7)
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 7, endRowIndex: 8, startColumnIndex: 0, endColumnIndex: 10 },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 10, bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
              backgroundColor: { red: 0.2, green: 0.3, blue: 0.45 },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)',
        },
      },
      // Format rate column (Col H / Index 7) as percentage
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 8, endRowIndex: 8 + studentCount, startColumnIndex: 7, endColumnIndex: 8 },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'PERCENT', pattern: '0%' },
              horizontalAlignment: 'CENTER',
              textFormat: { bold: true },
            },
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment,textFormat)',
        },
      },
      // Alignment requests for content
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 8, endRowIndex: 8 + studentCount, startColumnIndex: 0, endColumnIndex: 2 },
          cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
          fields: 'userEnteredFormat(horizontalAlignment)',
        },
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 8, endRowIndex: 8 + studentCount, startColumnIndex: 3, endColumnIndex: 7 },
          cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
          fields: 'userEnteredFormat(horizontalAlignment)',
        },
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 8, endRowIndex: 8 + studentCount, startColumnIndex: 8, endColumnIndex: 9 },
          cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
          fields: 'userEnteredFormat(horizontalAlignment)',
        },
      },
      // Set Column Sizes
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 45 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
          properties: { pixelSize: 95 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
          properties: { pixelSize: 180 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
          properties: { pixelSize: 60 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 7 },
          properties: { pixelSize: 90 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 7, endIndex: 8 },
          properties: { pixelSize: 105 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 8, endIndex: 9 },
          properties: { pixelSize: 130 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 9, endIndex: 10 },
          properties: { pixelSize: 220 },
          fields: 'pixelSize',
        },
      },
    ];

    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });
  } catch (error) {
    console.warn('Formatting monthly summary warning:', error);
  }
};

// Fetch and parse both students AND attendance data from an external sheet
export const importClassRosterFromSheet = async (
  token: string,
  spreadsheetId: string,
  sheetName: string
): Promise<{ students: Student[]; attendanceData: AttendanceData; originalRows: any[][] }> => {
  try {
    const range = `${encodeURIComponent(sheetName)}!A1:AZ100`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch sheet values');
    }
    
    const data = await res.json();
    const rows = data.values || [];
    
    if (rows.length < 3) {
      throw new Error('Sheet structure is invalid. Expected at least 3 header rows.');
    }

    const headerRow = rows[2] || [];
    
    // Find column indexes
    const enrColIndex = headerRow.findIndex((cell: string) => cell?.toLowerCase().includes('enr') || cell?.toLowerCase().includes('enroll'));
    const nameColIndex = headerRow.findIndex((cell: string) => cell?.toLowerCase().includes('name'));
    const genderColIndex = headerRow.findIndex((cell: string) => cell?.toLowerCase().includes('gender') || cell?.toLowerCase().includes('sex'));
    
    const useEnrCol = enrColIndex !== -1 ? enrColIndex : 1;
    const useNameCol = nameColIndex !== -1 ? nameColIndex : 2;
    const useGenderCol = genderColIndex !== -1 ? genderColIndex : 3;

    // Find date columns (usually column E/index 4 onwards)
    const dateColumns: { index: number; label: string; key: string }[] = [];
    headerRow.forEach((cell: string, idx: number) => {
      if (cell && (cell.includes(',') || cell.includes('/') || /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(cell))) {
        const cleanKey = parseDateHeaderToYMD(cell);
        if (cleanKey) {
          dateColumns.push({ index: idx, label: cell, key: cleanKey });
        }
      }
    });

    // If no date columns found, default to current month days
    if (dateColumns.length === 0) {
      const daysInMonth = new Date(CURRENT_YEAR, CURRENT_MONTH_INDEX + 1, 0).getDate();
      const monthStr = String(CURRENT_MONTH_INDEX + 1).padStart(2, '0');
      for (let day = 1; day <= daysInMonth; day++) {
        const colIdx = 4 + (day - 1);
        const cellLabel = headerRow[colIdx] || `${CURRENT_MONTH_NAME} ${day}`;
        const key = `${CURRENT_YEAR}-${monthStr}-${day.toString().padStart(2, '0')}`;
        dateColumns.push({ index: colIdx, label: cellLabel, key });
      }
    }

    const students: Student[] = [];
    const attendanceData: AttendanceData = {};
    
    // Initialize attendance keys
    dateColumns.forEach((dc) => {
      attendanceData[dc.key] = {};
    });

    // Parse students starting row 4 (index 3)
    let sIdCounter = 1;
    for (let r = 3; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 2) continue;
      
      const enrNumber = String(row[useEnrCol] || '').trim();
      const name = String(row[useNameCol] || '').trim();
      
      if (!enrNumber || enrNumber.toLowerCase().includes('total') || enrNumber.toLowerCase().includes('average') || !name) {
        continue; // skip totals or empty lines
      }

      const gender = String(row[useGenderCol] || 'M').trim().toUpperCase().startsWith('F') ? 'F' : 'M';
      
      const newStudent: Student = {
        id: sIdCounter++,
        enrNumber,
        name,
        gender,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@school.edu`,
        phone: '+975 17' + Math.floor(100000 + Math.random() * 900000),
        notes: `Imported from Google Sheet on ${new Date().toLocaleDateString()}`
      };

      students.push(newStudent);

      // Extract attendance for this student
      dateColumns.forEach((dc) => {
        let val = String(row[dc.index] || '').trim().toUpperCase();
        if (val === 'P' || val === 'A' || val === 'L') {
          attendanceData[dc.key][enrNumber] = val as 'P' | 'A' | 'L';
        } else {
          attendanceData[dc.key][enrNumber] = '';
        }
      });
    }

    return { students, attendanceData, originalRows: rows };
  } catch (error) {
    console.error('Error importing class roster:', error);
    throw error;
  }
};

// Create a beautifully formatted, multi-tab spreadsheet in Google Drive 
// containing every month's attendance report with each day's attendance
export const createDetailedMultiMonthReportSheet = async (
  token: string,
  title: string,
  students: Student[],
  attendance: AttendanceData
): Promise<{ spreadsheetId: string; webViewLink: string }> => {
  try {
    // 1. Group active dates by month
    const datesByMonth: Record<string, string[]> = {};
    const activeDates = Object.keys(attendance).sort();
    
    activeDates.forEach((dateStr) => {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const yearMonth = `${parts[0]}-${parts[1]}`; // YYYY-MM
        if (!datesByMonth[yearMonth]) {
          datesByMonth[yearMonth] = [];
        }
        datesByMonth[yearMonth].push(dateStr);
      }
    });

    // Default to current month if no dates are in attendance
    if (Object.keys(datesByMonth).length === 0) {
      const currentYM = `${CURRENT_YEAR}-${String(CURRENT_MONTH_INDEX + 1).padStart(2, '0')}`;
      datesByMonth[currentYM] = [];
      const daysInMonth = new Date(CURRENT_YEAR, CURRENT_MONTH_INDEX + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        datesByMonth[currentYM].push(`${CURRENT_YEAR}-${String(CURRENT_MONTH_INDEX + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    }

    const yearMonths = Object.keys(datesByMonth).sort();

    // 2. Prepare the list of sheet objects
    const sheetsPayload = yearMonths.map((ymStr) => {
      const sortedMonthDates = datesByMonth[ymStr].sort();
      const daysCount = sortedMonthDates.length;

      // Find Month Name & Year (e.g. "August 2026")
      const [yearStr, monthStr] = ymStr.split('-');
      const dateObj = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
      const tabTitle = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      // Build Headers
      const formattedDateHeaders = sortedMonthDates.map((dStr) => {
        try {
          const d = new Date(dStr);
          const dayNum = d.getDate();
          const wday = d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
          return `${dayNum} (${wday})`;
        } catch {
          return dStr.split('-')[2] || dStr;
        }
      });

      const headers = [
        'S.No', 'Enrollment ID', 'Student Name', 'Gender',
        ...formattedDateHeaders,
        'Present', 'Absent', 'Late', 'Attendance %'
      ];

      const lastDateColLetter = getColumnLetter(4 + daysCount);
      const presentColLetter = getColumnLetter(4 + daysCount + 1);
      const absentColLetter = getColumnLetter(4 + daysCount + 2);
      const lateColLetter = getColumnLetter(4 + daysCount + 3);
      const avgColLetter = getColumnLetter(4 + daysCount + 4);

      const titleRow = [`ROYAL THIMPHU COLLEGE - ${tabTitle.toUpperCase()} CLASS ATTENDANCE REPORT`, ...Array(headers.length - 1).fill('')];
      const subtitleRow = [`Course: 3rd Year • Section A  |  Roster Size: ${students.length} Students  |  Exported: ${new Date().toLocaleDateString()}`, ...Array(headers.length - 1).fill('')];
      const legendRow = [`Legend: P = Present (1.0) | L = Late (3 Lates = 1 Absent) | A = Absent (0.0)`, ...Array(headers.length - 1).fill('')];
      const headerRow = headers;

      const studentRows = students.map((student, idx) => {
        const xlRow = idx + 5; // row number (1-indexed, starting after row 4 headers)
        
        // Find individual daily statuses
        const dailyStatuses = sortedMonthDates.map((dateStr) => {
          return attendance[dateStr]?.[student.enrNumber] || '';
        });

        return [
          student.id,
          student.enrNumber,
          student.name,
          student.gender,
          ...dailyStatuses,
          `=COUNTIF(E${xlRow}:${lastDateColLetter}${xlRow}, "P")`,
          `=COUNTIF(E${xlRow}:${lastDateColLetter}${xlRow}, "A")`,
          `=COUNTIF(E${xlRow}:${lastDateColLetter}${xlRow}, "L")`,
          `=IF((${presentColLetter}${xlRow}+${absentColLetter}${xlRow}+${lateColLetter}${xlRow})>0, (${presentColLetter}${xlRow}+${lateColLetter}${xlRow}-INT(${lateColLetter}${xlRow}/3))/(${presentColLetter}${xlRow}+${absentColLetter}${xlRow}+${lateColLetter}${xlRow}), 1.0)`
        ];
      });

      // Bottom summary rows:
      const studentStartRow = 5;
      const studentEndRow = 4 + students.length;

      const totalPresentsRow = [
        'Total Presents', '', '', '',
        ...sortedMonthDates.map((_, dIdx) => {
          const colLetter = getColumnLetter(5 + dIdx);
          return `=COUNTIF(${colLetter}${studentStartRow}:${colLetter}${studentEndRow}, "P")`;
        }),
        `=SUM(${presentColLetter}${studentStartRow}:${presentColLetter}${studentEndRow})`,
        `=SUM(${absentColLetter}${studentStartRow}:${absentColLetter}${studentEndRow})`,
        `=SUM(${lateColLetter}${studentStartRow}:${lateColLetter}${studentEndRow})`,
        ''
      ];

      const totalAbsentsRow = [
        'Total Absents', '', '', '',
        ...sortedMonthDates.map((_, dIdx) => {
          const colLetter = getColumnLetter(5 + dIdx);
          return `=COUNTIF(${colLetter}${studentStartRow}:${colLetter}${studentEndRow}, "A")`;
        }),
        '', '', '', ''
      ];

      const totalLatesRow = [
        'Total Lates', '', '', '',
        ...sortedMonthDates.map((_, dIdx) => {
          const colLetter = getColumnLetter(5 + dIdx);
          return `=COUNTIF(${colLetter}${studentStartRow}:${colLetter}${studentEndRow}, "L")`;
        }),
        '', '', '', ''
      ];

      const dailyRateRow = [
        'Daily Attendance %', '', '', '',
        ...sortedMonthDates.map((_, dIdx) => {
          const colLetter = getColumnLetter(5 + dIdx);
          const presRow = studentEndRow + 1;
          const absRow = studentEndRow + 2;
          const lateRow = studentEndRow + 3;
          return `=IF((${colLetter}${presRow}+${colLetter}${absRow}+${colLetter}${lateRow})>0, (${colLetter}${presRow}+${colLetter}${lateRow}*(2/3))/(${colLetter}${presRow}+${colLetter}${absRow}+${colLetter}${lateRow}), 1.0)`;
        }),
        '', '', '', `=AVERAGE(${avgColLetter}${studentStartRow}:${avgColLetter}${studentEndRow})`
      ];

      const values = [
        titleRow,
        subtitleRow,
        legendRow,
        headerRow,
        ...studentRows,
        totalPresentsRow,
        totalAbsentsRow,
        totalLatesRow,
        dailyRateRow
      ];

      return {
        properties: {
          title: tabTitle,
          gridProperties: {
            frozenRowCount: 4,
            frozenColumnCount: 3
          }
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: values.map((row) => ({
              values: row.map((val) => {
                if (typeof val === 'string' && val.startsWith('=')) {
                  return { userEnteredValue: { formulaValue: val } };
                } else if (typeof val === 'number') {
                  return { userEnteredValue: { numberValue: val } };
                } else {
                  return { userEnteredValue: { stringValue: String(val) } };
                }
              })
            }))
          }
        ]
      };
    });

    // 3. Post to create the multi-sheet spreadsheet
    const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    const res = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
        sheets: sheetsPayload
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to create multi-month spreadsheet in Google Drive');
    }

    const createdData = await res.json();
    const spreadsheetId = createdData.spreadsheetId;
    const webViewLink = createdData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // 4. Format each sheet beautiful in a batchUpdate
    const formatRequests: any[] = [];
    createdData.sheets.forEach((sheet: any, index: number) => {
      const sheetId = sheet.properties.sheetId;
      const ymStr = yearMonths[index] || '';
      const sortedMonthDates = datesByMonth[ymStr] || [];
      const daysCount = sortedMonthDates.length;
      const totalCols = 4 + daysCount + 4; // S.No, Enr, Name, Gen + days + P, A, L, Rate
      const studentCount = students.length;

      const presentColIndex = 4 + daysCount;
      const avgColIndex = 4 + daysCount + 3;

      // 1. Merge title rows (Merge columns A to last column)
      formatRequests.push({
        mergeCells: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: totalCols },
          mergeType: 'MERGE_ALL'
        }
      });
      formatRequests.push({
        mergeCells: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalCols },
          mergeType: 'MERGE_ALL'
        }
      });
      formatRequests.push({
        mergeCells: {
          range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: totalCols },
          mergeType: 'MERGE_ALL'
        }
      });

      // 2. Format Title Row styling (Row 1)
      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: totalCols },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 13, bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
              horizontalAlignment: 'CENTER',
              backgroundColor: { red: 0.1, green: 0.2, blue: 0.35 }
            }
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)'
        }
      });

      // 3. Format Subtitle Row styling (Row 2)
      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalCols },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 10, foregroundColor: { red: 0.4, green: 0.4, blue: 0.4 } },
              horizontalAlignment: 'CENTER',
              backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 }
            }
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)'
        }
      });

      // 4. Format Legend Row styling (Row 3)
      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: totalCols },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 9, italic: true, foregroundColor: { red: 0.3, green: 0.3, blue: 0.3 } },
              horizontalAlignment: 'CENTER',
              backgroundColor: { red: 0.97, green: 0.98, blue: 0.99 }
            }
          },
          fields: 'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)'
        }
      });

      // 5. Format Header Row styling (Row 4 / index 3)
      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: totalCols },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 10, bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
              backgroundColor: { red: 0.18, green: 0.24, blue: 0.35 },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE'
            }
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)'
        }
      });

      // 6. Format Average Column (Last Column) as Percentage
      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 4, endRowIndex: 4 + studentCount, startColumnIndex: avgColIndex, endColumnIndex: totalCols },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'PERCENT', pattern: '0.0%' },
              horizontalAlignment: 'CENTER',
              textFormat: { bold: true }
            }
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment,textFormat)'
        }
      });

      // 7. Center-align Presents, Absents, Lates columns
      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 4, endRowIndex: 4 + studentCount, startColumnIndex: presentColIndex, endColumnIndex: avgColIndex },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER'
            }
          },
          fields: 'userEnteredFormat(horizontalAlignment)'
        }
      });

      // 8. Style Bottom Summary Rows (Present, Absent, Late, Rate totals)
      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 4 + studentCount, endRowIndex: 8 + studentCount, startColumnIndex: 0, endColumnIndex: totalCols },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.95, green: 0.95, blue: 0.97 },
              textFormat: { bold: true, fontSize: 9 }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)'
        }
      });

      // 9. Format Daily Attendance Rate Bottom Row as Percentage
      const rateRowIndex = 4 + studentCount + 3;
      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: rateRowIndex, endRowIndex: rateRowIndex + 1, startColumnIndex: 4, endColumnIndex: totalCols },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'PERCENT', pattern: '0.0%' },
              horizontalAlignment: 'CENTER'
            }
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)'
        }
      });

      // 10. Adjust Column Widths
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 40 },
          fields: 'pixelSize'
        }
      });
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
          properties: { pixelSize: 85 },
          fields: 'pixelSize'
        }
      });
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
          properties: { pixelSize: 180 },
          fields: 'pixelSize'
        }
      });
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
          properties: { pixelSize: 50 },
          fields: 'pixelSize'
        }
      });
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 4 + daysCount },
          properties: { pixelSize: 48 },
          fields: 'pixelSize'
        }
      });
      formatRequests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 4 + daysCount, endIndex: totalCols },
          properties: { pixelSize: 65 },
          fields: 'pixelSize'
        }
      });
    });

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    await fetch(updateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: formatRequests }),
    });

    return { spreadsheetId, webViewLink };
  } catch (error) {
    console.error('Error creating detailed multi-month report:', error);
    throw error;
  }
};


