export interface Student {
  id: number;
  enrNumber: string;
  name: string;
  gender: 'M' | 'F';
  email?: string;
  phone?: string;
  notes?: string;
  opinion?: string;
}

export type AttendanceStatus = 'P' | 'A' | 'L' | '';

// Map of Date String (YYYY-MM-DD) -> (Enrollment Number -> AttendanceStatus)
export type AttendanceData = Record<string, Record<string, AttendanceStatus>>;

export interface SheetSyncInfo {
  spreadsheetId: string;
  spreadsheetName: string;
  sheetId: number | null;
  sheetName: string;
  lastSynced: string | null;
}

export interface DayStats {
  date: string;
  present: number;
  absent: number;
  late: number;
  total: number;
}
