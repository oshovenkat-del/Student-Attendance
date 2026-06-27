import { useState, useEffect, useMemo } from 'react';
import { Student, AttendanceData, AttendanceStatus, SheetSyncInfo } from './types';
import { INITIAL_STUDENTS, generateDefaultAttendance, CURRENT_DATE_STRING, CURRENT_MONTH_NAME, CURRENT_YEAR, CURRENT_MONTH_INDEX } from './data/students';
import { initAuth, googleSignIn, logout } from './lib/firebase';
import { fetchUserProfile, fetchSpreadsheetSheets, fetchAttendanceFromSheet, syncAttendanceToGoogleSheets, importClassRosterFromSheet } from './lib/googleSheets';
import { DailyRollCall } from './components/DailyRollCall';
import { SpreadsheetGrid } from './components/SpreadsheetGrid';
import { StudentProfile } from './components/StudentProfile';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SyncSettings } from './components/SyncSettings';
import { StudentCheckinPortal } from './components/StudentCheckinPortal';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle, Sparkles, FileSpreadsheet, LayoutDashboard, UserCheck, CalendarDays, BarChart3, Settings } from 'lucide-react';
import { User } from 'firebase/auth';
import { RtcLogo } from './components/RtcLogo';

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function App() {
  // --- NAVIGATION STATE ---
  const [activeTab, setActiveTab] = useState<'rollcall' | 'grid' | 'profiles' | 'analytics' | 'settings'>('rollcall');

  // --- AUTH STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showSandbox, setShowSandbox] = useState(() => {
    return localStorage.getItem('attendance_sandbox_active') === 'true';
  });

  // --- CORE ATTENDANCE DATA ---
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('attendance_students');
    return saved ? JSON.parse(saved) : INITIAL_STUDENTS;
  });

  const [attendance, setAttendance] = useState<AttendanceData>(() => {
    const saved = localStorage.getItem('attendance_records');
    return saved ? JSON.parse(saved) : generateDefaultAttendance();
  });

  const [selectedDate, setSelectedDate] = useState(CURRENT_DATE_STRING); // Current date default

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => {
    const monthPart = parseInt(CURRENT_DATE_STRING.split('-')[1]);
    return !isNaN(monthPart) ? monthPart - 1 : CURRENT_MONTH_INDEX;
  });

  // Keep selectedMonthIndex in sync when selectedDate is changed from other controls
  useEffect(() => {
    const monthPart = parseInt(selectedDate.split('-')[1]);
    if (!isNaN(monthPart)) {
      setSelectedMonthIndex(monthPart - 1);
    }
  }, [selectedDate]);

  const handleMonthChange = (monthIndex: number) => {
    setSelectedMonthIndex(monthIndex);
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const day = parts[2];
      const newMonthStr = String(monthIndex + 1).padStart(2, '0');
      // Verify valid day number for that month (e.g. leap years, 30 vs 31 days)
      const daysInNewMonth = new Date(parseInt(year), monthIndex + 1, 0).getDate();
      const targetDay = Math.min(parseInt(day), daysInNewMonth);
      const newDateStr = `${year}-${newMonthStr}-${String(targetDay).padStart(2, '0')}`;
      setSelectedDate(newDateStr);
    }
  };

  // --- SYNC CONFIG & QUEUE ---
  const [syncInfo, setSyncInfo] = useState<SheetSyncInfo | null>(() => {
    const saved = localStorage.getItem('attendance_sync_info');
    return saved ? JSON.parse(saved) : null;
  });

  const [originalRows, setOriginalRows] = useState<any[][]>(() => {
    const saved = localStorage.getItem('attendance_original_rows');
    return saved ? JSON.parse(saved) : [];
  });

  // Track pending offline changes that need to be synced to Google Sheet
  const [unsyncedChanges, setUnsyncedChanges] = useState<{ enrNumber: string; date: string; status: AttendanceStatus }[]>(() => {
    const saved = localStorage.getItem('attendance_unsynced_changes');
    return saved ? JSON.parse(saved) : [];
  });

  const [syncingNow, setSyncingNow] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);

  // --- INITIALIZE FIREBASE AUTH ---
  useEffect(() => {
    initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setNeedsAuth(false);
        setShowSandbox(false);
        localStorage.setItem('attendance_sandbox_active', 'false');
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
  }, []);

  // --- LOCAL PERSISTENCE BACKUP ---
  useEffect(() => {
    localStorage.setItem('attendance_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('attendance_records', JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem('attendance_sync_info', JSON.stringify(syncInfo));
  }, [syncInfo]);

  useEffect(() => {
    localStorage.setItem('attendance_original_rows', JSON.stringify(originalRows));
  }, [originalRows]);

  useEffect(() => {
    localStorage.setItem('attendance_unsynced_changes', JSON.stringify(unsyncedChanges));
  }, [unsyncedChanges]);

  // --- AUTH HANDLERS ---
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        setNeedsAuth(false);
        setShowSandbox(false);
        localStorage.setItem('attendance_sandbox_active', 'false');
        setSyncSuccessMsg('Successfully connected to Google Workspace!');
      }
    } catch (err: any) {
      setSyncErrorMsg(err.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setShowSandbox(false);
    localStorage.setItem('attendance_sandbox_active', 'false');
    setSyncInfo(null);
    setOriginalRows([]);
    setUnsyncedChanges([]);
    setSyncSuccessMsg('Disconnected Google account.');
  };

  const handleResetToSandbox = () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset all data and notes to default sandbox settings? This will clear any Google Sheets connection and locally stored progress.'
    );
    if (!confirmed) return;

    setStudents(INITIAL_STUDENTS);
    setAttendance(generateDefaultAttendance());
    setSyncInfo(null);
    setOriginalRows([]);
    setUnsyncedChanges([]);
    localStorage.clear();
    setSyncSuccessMsg('Successfully reset to local sandbox mode!');
    setActiveTab('rollcall');
  };

  // --- LOAD ATTENDANCE DATA FROM SHEET ---
  const handleSelectSpreadsheet = async (spreadsheetId: string, title: string) => {
    if (!accessToken) return;
    setSyncingNow(true);
    setSyncErrorMsg(null);
    setSyncSuccessMsg(null);
    try {
      // 1. Get sheets inside spreadsheet
      const sheets = await fetchSpreadsheetSheets(accessToken, spreadsheetId);
      if (sheets.length === 0) {
        throw new Error('Spreadsheet has no valid tabs/sheets.');
      }

      // Find first sheet tab or sheet named with CURRENT_MONTH_NAME or 'August' or fallback
      const targetSheet = sheets.find((s) => s.name.toLowerCase().includes(CURRENT_MONTH_NAME.toLowerCase())) || sheets.find((s) => s.name.includes('August')) || sheets[0];
      const sheetName = targetSheet.name;

      // 2. Fetch data from that sheet and parse
      const { attendanceData, dates, originalRows: fetchedRows } = await fetchAttendanceFromSheet(
        accessToken,
        spreadsheetId,
        sheetName,
        students
      );

      // 3. Update state
      setAttendance((prev) => ({
        ...prev,
        ...attendanceData,
      }));
      
      setOriginalRows(fetchedRows);
      
      const newSyncInfo: SheetSyncInfo = {
        spreadsheetId,
        spreadsheetName: title,
        sheetId: targetSheet.id,
        sheetName,
        lastSynced: new Date().toISOString(),
      };
      setSyncInfo(newSyncInfo);
      setSyncSuccessMsg(`Connected successfully! Loaded attendance data from "${title} > ${sheetName}"`);
      setUnsyncedChanges([]); // connected sheets resets unsynced
    } catch (err: any) {
      setSyncErrorMsg(err.message || 'Failed to sync with selected spreadsheet. Verify row headers.');
    } finally {
      setSyncingNow(false);
    }
  };

  // --- IMPORT ENTIRE CLASS ROSTER FROM A GOOGLE SHEET ---
  const handleImportClassFromSheet = async (spreadsheetId: string, title: string) => {
    if (!accessToken) return;
    setSyncingNow(true);
    setSyncErrorMsg(null);
    setSyncSuccessMsg(null);
    try {
      // 1. Get sheets inside spreadsheet
      const sheets = await fetchSpreadsheetSheets(accessToken, spreadsheetId);
      if (sheets.length === 0) {
        throw new Error('Spreadsheet has no valid tabs/sheets.');
      }

      // Find first sheet tab or sheet named with CURRENT_MONTH_NAME or fallback
      const targetSheet = sheets.find((s) => s.name.toLowerCase().includes(CURRENT_MONTH_NAME.toLowerCase())) || sheets.find((s) => s.name.includes('August')) || sheets[0];
      const sheetName = targetSheet.name;

      // 2. Import class roster and initial attendance data
      const { students: importedStudents, attendanceData, originalRows: fetchedRows } = await importClassRosterFromSheet(
        accessToken,
        spreadsheetId,
        sheetName
      );

      if (importedStudents.length === 0) {
        throw new Error('No students found in the spreadsheet rows (starting Row 4). Please verify formatting.');
      }

      // 3. Update state
      setStudents(importedStudents);
      setAttendance(attendanceData);
      setOriginalRows(fetchedRows);
      
      const newSyncInfo: SheetSyncInfo = {
        spreadsheetId,
        spreadsheetName: title,
        sheetId: targetSheet.id,
        sheetName,
        lastSynced: new Date().toISOString(),
      };
      setSyncInfo(newSyncInfo);
      setSyncSuccessMsg(`Successfully imported class of ${importedStudents.length} students from "${title} > ${sheetName}"!`);
      setUnsyncedChanges([]); // clear unsynced queue
      setActiveTab('rollcall'); // go to active roll call
    } catch (err: any) {
      setSyncErrorMsg(err.message || 'Failed to import class from selected spreadsheet. Verify row headers.');
    } finally {
      setSyncingNow(false);
    }
  };

  // --- PUSH/UPLOAD CHANGES TO GOOGLE SHEETS ---
  const handleSyncToSheets = async () => {
    if (!accessToken || !syncInfo || unsyncedChanges.length === 0) return;
    setSyncingNow(true);
    setSyncErrorMsg(null);
    setSyncSuccessMsg(null);
    try {
      await syncAttendanceToGoogleSheets(
        accessToken,
        syncInfo.spreadsheetId,
        syncInfo.sheetName,
        unsyncedChanges,
        originalRows
      );

      // Re-fetch sheet values to update original rows to keep coords fresh
      const { originalRows: refreshedRows } = await fetchAttendanceFromSheet(
        accessToken,
        syncInfo.spreadsheetId,
        syncInfo.sheetName,
        students
      );

      setOriginalRows(refreshedRows);
      setUnsyncedChanges([]); // Clear queue upon success
      setSyncInfo((prev) => prev ? { ...prev, lastSynced: new Date().toISOString() } : null);
      setSyncSuccessMsg(`Successfully uploaded and synced all ${unsyncedChanges.length} local attendance updates!`);
    } catch (err: any) {
      setSyncErrorMsg(err.message || 'Failed to sync changes. Try selecting the sheet again.');
    } finally {
      setSyncingNow(false);
    }
  };

  // --- UPDATE INDIVIDUAL ATTENDANCE CELL ---
  const handleUpdateStatus = (studentEnr: string, date: string, status: AttendanceStatus) => {
    // 1. Instantly update local attendance state for responsive feeling
    setAttendance((prev) => {
      const copy = { ...prev };
      if (!copy[date]) {
        copy[date] = {};
      }
      copy[date][studentEnr] = status;
      return copy;
    });

    // 2. If connected to Sheets, queue the cell change
    if (syncInfo) {
      setUnsyncedChanges((prev) => {
        // Remove existing queued change for this coordinate if present
        const filtered = prev.filter((item) => !(item.enrNumber === studentEnr && item.date === date));
        return [...filtered, { enrNumber: studentEnr, date, status }];
      });
    }
  };

  // Standard update wrapper for daily component (uses selectedDate)
  const handleUpdateStatusDaily = (studentEnr: string, status: AttendanceStatus) => {
    handleUpdateStatus(studentEnr, selectedDate, status);
  };

  // Update notes/remarks for a student profile
  const handleUpdateNotes = (studentEnr: string, notes: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.enrNumber === studentEnr ? { ...s, notes } : s))
    );
  };

  // Update complete student details (including name, email, phone, notes, opinion)
  const handleUpdateStudent = (studentEnr: string, updatedFields: Partial<Student>) => {
    setStudents((prev) =>
      prev.map((s) => (s.enrNumber === studentEnr ? { ...s, ...updatedFields } : s))
    );
  };

  // --- LIST OF ATTENDANCE DATES ---
  const activeDates = useMemo(() => {
    // Collect all dates from current state
    const datesSet = new Set(Object.keys(attendance));
    
    // Ensure at least all dates from the selected date's month are present (1 to daysInMonth)
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0]) || new Date().getFullYear();
      const month = parseInt(parts[1]) - 1; // 0-indexed
      const monthStr = parts[1];
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      for (let d = 1; d <= daysInMonth; d++) {
        datesSet.add(`${year}-${monthStr}-${d.toString().padStart(2, '0')}`);
      }
    }
    return Array.from(datesSet).sort();
  }, [attendance, selectedDate]);

  const isQrCheckin = useMemo(() => {
    return new URLSearchParams(window.location.search).get('qr_checkin') === 'true';
  }, []);

  if (isQrCheckin) {
    return <StudentCheckinPortal students={students} />;
  }

  if (needsAuth && !showSandbox) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden" id="welcome-login-page">
        {/* Subtle decorative grid/glow pattern in background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60"></div>
        
        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center space-y-4">
          <RtcLogo size="xl" layout="vertical" showText={true} />
          <p className="text-sm font-semibold text-indigo-600 tracking-wider uppercase">
            Attendance Sync & Analytics
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
          <div className="bg-white py-8 px-4 shadow-xl rounded-2xl border border-gray-100 sm:px-10 space-y-8">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-gray-800">Welcome to ClassRoll</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                Connect your Google Workspace to instantly auto-save daily student roll calls, view analytics, and export monthly attendance spreadsheets directly to your Google Drive.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100/60 rounded-xl space-y-1">
                <span className="text-xs font-bold text-indigo-700 flex items-center gap-1.5">
                  <Sparkles size={14} /> Cloud Integration
                </span>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Create, update, and manage official attendance rosters perfectly formatted in Google Sheets.
                </p>
              </div>

              <div className="p-3.5 bg-emerald-50/50 border border-emerald-100/60 rounded-xl space-y-1">
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  <BarChart3 size={14} /> Advanced Analytics
                </span>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Track individual student profiles, identify attendance risks, and monitor overall section percentages.
                </p>
              </div>
            </div>

            {/* Call To Actions */}
            <div className="space-y-4 pt-2">
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                id="login-google-btn"
              >
                <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.986 0-.745-.08-1.3-.173-1.859H12.24z" />
                </svg>
                {isLoggingIn ? 'Connecting to Google Workspace...' : 'Sign in with Google Account'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-gray-400 font-medium uppercase tracking-wider text-[10px]">Or try without Google</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowSandbox(true);
                  localStorage.setItem('attendance_sandbox_active', 'true');
                  setSyncSuccessMsg('Entered offline sandbox mode.');
                }}
                className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                id="sandbox-mode-btn"
              >
                <CloudOff size={14} className="text-gray-500" />
                Continue to Offline Sandbox Mode
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400 font-medium">
          Secure OAuth 2.0 • Real-time cloud synchronization • Designed for educators
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="app-container">
      {/* Upper Navigation Header Bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <RtcLogo size="md" layout="horizontal" showText={false} />
            <div>
              <h1 className="text-md font-extrabold text-gray-800 tracking-tight leading-tight flex items-center gap-1.5">
                Student Attendance
              </h1>
              <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5 flex-wrap">
                <span>Month of </span>
                <select
                  value={selectedMonthIndex}
                  onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded-md cursor-pointer transition-colors focus:ring-1 focus:ring-indigo-500 text-[11px] outline-hidden border-none"
                  id="month-picker-header"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>
                <span>{selectedDate.split('-')[0]}</span>
              </p>
            </div>
          </div>

          {/* Connection Pill and Upload Trigger */}
          <div className="flex items-center gap-3.5">
            {needsAuth ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-semibold border border-gray-200">
                <CloudOff size={14} /> Sandbox Mode
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100">
                  <Cloud size={14} /> Google Sheets Live
                </span>
                {syncInfo && (
                  <span className="text-xs font-semibold text-gray-500 truncate max-w-[140px] hidden md:inline">
                    • {syncInfo.spreadsheetName}
                  </span>
                )}
              </div>
            )}

            {/* Sync Upload Banner button */}
            {!needsAuth && syncInfo && unsyncedChanges.length > 0 && (
              <button
                onClick={handleSyncToSheets}
                disabled={syncingNow}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-extrabold rounded-lg text-xs transition-colors shadow-xs cursor-pointer animate-bounce"
                id="sync-now-floating-btn"
              >
                <RefreshCw size={12} className={syncingNow ? 'animate-spin' : ''} />
                Upload Updates ({unsyncedChanges.length})
              </button>
            )}
          </div>
        </div>

        {/* Global Success / Error Toast Banners */}
        {(syncSuccessMsg || syncErrorMsg) && (
          <div className="bg-slate-100 border-t border-b border-gray-100 px-4 py-2.5">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-medium">
                {syncSuccessMsg ? (
                  <>
                    <CheckCircle2 className="text-emerald-600 shrink-0" size={16} />
                    <span className="text-gray-700">{syncSuccessMsg}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="text-rose-600 shrink-0" size={16} />
                    <span className="text-rose-700">{syncErrorMsg}</span>
                  </>
                )}
              </div>
              <button
                onClick={() => { setSyncSuccessMsg(null); setSyncErrorMsg(null); }}
                className="text-[10px] uppercase font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs bar */}
        <div className="border-t border-gray-100 bg-white/95 backdrop-blur-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex justify-between sm:justify-start gap-1 sm:gap-6 -mb-px overflow-x-auto">
              <button
                onClick={() => setActiveTab('rollcall')}
                className={`py-3.5 px-1.5 sm:px-1 border-b-2 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'rollcall'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
                id="tab-rollcall"
              >
                <UserCheck size={16} />
                Roll-Call
              </button>

              <button
                onClick={() => setActiveTab('grid')}
                className={`py-3.5 px-1.5 sm:px-1 border-b-2 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'grid'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
                id="tab-grid"
              >
                <CalendarDays size={16} />
                Spreadsheet
              </button>

              <button
                onClick={() => setActiveTab('profiles')}
                className={`py-3.5 px-1.5 sm:px-1 border-b-2 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'profiles'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
                id="tab-profiles"
              >
                <Sparkles size={16} />
                Student Profiles
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`py-3.5 px-1.5 sm:px-1 border-b-2 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
                id="tab-analytics"
              >
                <BarChart3 size={16} />
                Analytics
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`py-3.5 px-1.5 sm:px-1 border-b-2 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
                id="tab-settings"
              >
                <Settings size={16} />
                Settings
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Page Area Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Sync pending warn bar */}
        {!needsAuth && syncInfo && unsyncedChanges.length > 0 && activeTab !== 'settings' && (
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-indigo-800">
              <AlertCircle size={18} className="shrink-0" />
              <span>
                You have <strong>{unsyncedChanges.length} local updates</strong> that have not been written to Google Sheets. Click "Sync and Upload" to write them now.
              </span>
            </div>
            <button
              onClick={handleSyncToSheets}
              disabled={syncingNow}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              id="sync-warn-bar-btn"
            >
              <RefreshCw size={12} className={syncingNow ? 'animate-spin' : ''} />
              Sync and Upload
            </button>
          </div>
        )}

        {/* Tab content switcher */}
        {activeTab === 'rollcall' && (
          <DailyRollCall
            students={students}
            attendance={attendance}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            updateStatus={handleUpdateStatusDaily}
            syncPendingUpdates={handleSyncToSheets}
            hasPendingChanges={unsyncedChanges.length > 0}
          />
        )}

        {activeTab === 'grid' && (
          <SpreadsheetGrid
            students={students}
            attendance={attendance}
            updateStatus={handleUpdateStatus}
            dates={activeDates}
            accessToken={accessToken}
            needsAuth={needsAuth}
            onLogin={handleLogin}
          />
        )}

        {activeTab === 'profiles' && (
          <StudentProfile
            students={students}
            attendance={attendance}
            onUpdateNotes={handleUpdateNotes}
            onUpdateStudent={handleUpdateStudent}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            students={students}
            attendance={attendance}
            accessToken={accessToken}
            needsAuth={needsAuth}
            onLogin={handleLogin}
          />
        )}

        {activeTab === 'settings' && (
          <SyncSettings
            user={user}
            accessToken={accessToken}
            syncInfo={syncInfo}
            needsAuth={needsAuth}
            isLoggingIn={isLoggingIn}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onSelectSpreadsheet={handleSelectSpreadsheet}
            onImportClassRoster={handleImportClassFromSheet}
            onResetToSandbox={handleResetToSandbox}
            students={students}
            onSyncSuccess={setSyncInfo}
          />
        )}
      </main>

      {/* Humble, Clean Footer */}
      <footer className="bg-white border-t border-gray-100 py-4 text-center text-xs text-gray-400 font-medium">
        Classroom Attendance Tracker • {CURRENT_MONTH_NAME} {CURRENT_YEAR} Monthly Sheet • Real-time Sync Engine
      </footer>
    </div>
  );
}
