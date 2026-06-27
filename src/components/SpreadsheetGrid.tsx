import React, { useMemo, useState } from 'react';
import { Student, AttendanceData, AttendanceStatus } from '../types';
import { Check, X, Clock, FileSpreadsheet, ExternalLink, RefreshCw, Cloud, CloudOff, AlertCircle } from 'lucide-react';
import { createDetailedMultiMonthReportSheet } from '../lib/googleSheets';

interface SpreadsheetGridProps {
  students: Student[];
  attendance: AttendanceData;
  updateStatus: (studentId: string, date: string, status: AttendanceStatus) => void;
  dates: string[];
  accessToken: string | null;
  needsAuth: boolean;
  onLogin: () => void;
}

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  students,
  attendance,
  updateStatus,
  dates,
  accessToken,
  needsAuth,
  onLogin,
}) => {
  // Sort dates so they appear in correct calendar order (e.g., Aug 1, 2, 3...)
  const sortedDates = useMemo(() => {
    return [...dates].sort();
  }, [dates]);

  // Helper to format date header (e.g., "Aug 1" or "01")
  const formatDateHeader = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = d.getDate();
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
      return { day, weekday };
    } catch {
      const parts = dateStr.split('-');
      return { day: parts[parts.length - 1] || dateStr, weekday: 'Day' };
    }
  };

  // Toggle status cycling: '' -> 'P' -> 'L' -> 'A' -> ''
  const cycleStatus = (enrNumber: string, dateStr: string) => {
    const current = attendance[dateStr]?.[enrNumber] || '';
    let next: AttendanceStatus = '';
    
    if (current === '') next = 'P';
    else if (current === 'P') next = 'L';
    else if (current === 'L') next = 'A';
    else next = '';

    updateStatus(enrNumber, dateStr, next);
  };

  // Calculate statistics per student row in real-time
  const studentStats = useMemo(() => {
    const statsMap: Record<string, { present: number; absent: number; late: number; rate: number }> = {};
    
    students.forEach((student) => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let totalMarked = 0;

      sortedDates.forEach((date) => {
        const status = attendance[date]?.[student.enrNumber] || '';
        if (status === 'P') {
          present++;
          totalMarked++;
        } else if (status === 'A') {
          absent++;
          totalMarked++;
        } else if (status === 'L') {
          late++;
          totalMarked++;
        }
      });

      const absentDueToLate = Math.floor(late / 3);
      const rate = totalMarked > 0 ? Math.round(((present + late - absentDueToLate) / totalMarked) * 100) : 0;
      
      statsMap[student.enrNumber] = { present, absent, late, rate };
    });

    return statsMap;
  }, [students, attendance, sortedDates]);

  // Export states
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportDetailedReport = async () => {
    if (!accessToken) return;
    const defaultTitle = `Classroom Detailed Attendance Report - All Months`;
    const title = window.prompt('Enter a title for the Detailed Report Google Sheet:', defaultTitle);
    if (!title) return;

    setExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const result = await createDetailedMultiMonthReportSheet(accessToken, title, students, attendance);
      setExportUrl(result.webViewLink);
      setExportSuccess(`Successfully created and formatted "${title}" with daily attendance tabs in your Google Drive!`);
    } catch (err: any) {
      setExportError(err.message || 'Failed to save detailed report to Google Drive.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4" id="spreadsheet-grid-section">
      {/* Top Controller & Export Banner */}
      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <FileSpreadsheet size={16} />
            </span>
            <h2 className="text-base font-extrabold text-gray-800">Detailed Daily Attendance Ledger</h2>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed max-w-xl">
            View and manage active student roll call records. Connected users can instantly export a fully formatted spreadsheet containing separate monthly tabs with day-by-day attendance details and automatic calculation formulas.
          </p>
        </div>

        <div className="w-full md:w-auto shrink-0 flex flex-wrap gap-2 items-center">
          {needsAuth ? (
            <div className="bg-gray-50 border border-gray-200 p-2 rounded-xl flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2">
                <CloudOff className="text-gray-400" size={14} />
                <span className="text-[11px] font-semibold text-gray-500">Offline Sandbox</span>
              </div>
              <button
                onClick={onLogin}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <Cloud size={12} />
                Connect Account
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {exportUrl && (
                <a
                  href={exportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-3xs"
                >
                  <ExternalLink size={13} />
                  Open Detailed Report
                </a>
              )}
              <button
                onClick={handleExportDetailedReport}
                disabled={exporting}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                id="export-detailed-sheets-btn"
              >
                {exporting ? (
                  <>
                    <RefreshCw className="animate-spin" size={13} />
                    Exporting Report...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={13} />
                    Export Multi-Month Report
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Export Feedback Toast */}
      {(exportSuccess || exportError) && (
        <div className={`p-4 rounded-xl border ${
          exportSuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        } text-xs flex justify-between items-center gap-4`}>
          <div className="flex items-center gap-2">
            {exportSuccess ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{exportSuccess || exportError}</span>
          </div>
          <button
            onClick={() => { setExportSuccess(null); setExportError(null); }}
            className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600"
          >
            Close
          </button>
        </div>
      )}

      {/* The main grid card */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden">
        {/* Legend & Instructions */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs text-gray-500">
        <div>
          <span className="font-bold text-gray-700">Spreadsheet Interactive Grid</span>
          <p className="mt-0.5">Click any cell directly inside the grid to cycle between statuses: <span className="text-emerald-600 font-bold">P (Present)</span> &rarr; <span className="text-amber-600 font-bold">L (Late)</span> &rarr; <span className="text-rose-600 font-bold">A (Absent)</span> &rarr; Clear.</p>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> P = Present
          </span>
          <span className="flex items-center gap-1 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> L = Late
          </span>
          <span className="flex items-center gap-1 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> A = Absent
          </span>
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="overflow-auto max-h-[calc(100vh-250px)]">
        <table className="w-full text-left border-collapse table-fixed select-none">
          {/* Header Row */}
          <thead>
            <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider sticky top-0 z-20">
              <th className="w-12 text-center p-2.5 sticky left-0 bg-slate-800 border-r border-slate-700 z-30">SNo</th>
              <th className="w-24 text-center p-2.5 sticky left-12 bg-slate-800 border-r border-slate-700 z-30">Enr ID</th>
              <th className="w-48 p-2.5 sticky left-36 bg-slate-800 border-r border-slate-700 z-30">Student Name</th>
              <th className="w-16 text-center p-2.5 border-r border-slate-700">Gen</th>
              
              {/* Daily date columns */}
              {sortedDates.map((dateStr) => {
                const headerInfo = formatDateHeader(dateStr);
                return (
                  <th
                    key={dateStr}
                    className="w-12 text-center p-1.5 border-r border-slate-700 min-w-[45px] hover:bg-slate-700 transition-colors"
                    title={dateStr}
                  >
                    <span className="block text-[9px] text-slate-400 font-medium leading-none">{headerInfo.weekday}</span>
                    <span className="block text-sm font-bold mt-0.5 leading-none">{headerInfo.day}</span>
                  </th>
                );
              })}

              <th className="w-20 text-center p-2.5 border-l border-slate-700 bg-slate-900 sticky right-24 z-10">Present</th>
              <th className="w-20 text-center p-2.5 border-l border-slate-700 bg-slate-900 sticky right-12 z-10">Absent</th>
              <th className="w-24 text-center p-2.5 bg-slate-900 sticky right-0 z-10">Average</th>
            </tr>
          </thead>

          {/* Student Rows */}
          <tbody>
            {students.map((student, sIdx) => {
              const stats = studentStats[student.enrNumber] || { present: 0, absent: 0, late: 0, rate: 100 };
              const rowBg = sIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';

              return (
                <tr
                  key={student.enrNumber}
                  className={`hover:bg-slate-50 transition-colors text-xs border-b border-gray-100 ${rowBg}`}
                  id={`spreadsheet-row-${student.enrNumber}`}
                >
                  {/* Sticky Columns */}
                  <td className={`p-2.5 text-center font-mono text-gray-400 font-medium border-r border-gray-100 sticky left-0 z-10 shadow-r ${rowBg}`}>
                    {student.id}
                  </td>
                  <td className={`p-2.5 text-center font-mono text-gray-700 font-bold border-r border-gray-100 sticky left-12 z-10 ${rowBg}`}>
                    {student.enrNumber}
                  </td>
                  <td className={`p-2.5 font-bold text-gray-800 border-r border-gray-100 sticky left-36 z-10 truncate ${rowBg}`}>
                    {student.name}
                  </td>
                  <td className="p-2.5 text-center text-gray-500 font-semibold border-r border-gray-100">
                    {student.gender}
                  </td>

                  {/* Daily status cells */}
                  {sortedDates.map((dateStr) => {
                    const status = attendance[dateStr]?.[student.enrNumber] || '';
                    
                    return (
                      <td
                        key={dateStr}
                        onClick={() => cycleStatus(student.enrNumber, dateStr)}
                        className={`text-center p-0 border-r border-gray-100 cursor-pointer select-none transition-colors duration-150 relative h-9 min-w-[45px] ${
                          status === 'P' ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700' :
                          status === 'A' ? 'bg-rose-50 hover:bg-rose-100 text-rose-700' :
                          status === 'L' ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' :
                          'hover:bg-slate-100'
                        }`}
                        title={`${student.name} - ${dateStr}`}
                        id={`cell-${student.enrNumber}-${dateStr}`}
                      >
                        <div className="absolute inset-0 flex items-center justify-center font-bold text-[11px]">
                          {status === 'P' && <span className="text-emerald-600">P</span>}
                          {status === 'L' && <span className="text-amber-600">L</span>}
                          {status === 'A' && <span className="text-rose-600">A</span>}
                          {status === '' && <span className="text-gray-200">-</span>}
                        </div>
                      </td>
                    );
                  })}

                  {/* Total Present */}
                  <td 
                    className={`p-2.5 text-center font-bold text-emerald-600 border-l border-gray-100 bg-slate-50 sticky right-24 z-10 shadow-l ${rowBg}`}
                    title={`${stats.present} Present, ${stats.late} Late. With 3 Lates = 1 Absent, ${stats.late - Math.floor(stats.late / 3)} of the late days are counted as present.`}
                  >
                    {stats.present + stats.late - Math.floor(stats.late / 3)}
                  </td>
                  
                  {/* Total Absent */}
                  <td 
                    className={`p-2.5 text-center font-bold text-rose-600 border-l border-gray-100 bg-slate-50 sticky right-12 z-10 shadow-l ${rowBg}`}
                    title={`${stats.absent} Absent. With 3 Lates = 1 Absent, ${Math.floor(stats.late / 3)} additional absent days are counted from lates.`}
                  >
                    {stats.absent + Math.floor(stats.late / 3)}
                  </td>

                  {/* Average Rate */}
                  <td className={`p-2.5 text-center font-extrabold sticky right-0 z-10 border-l border-gray-100 bg-slate-100 ${
                    stats.rate >= 90 ? 'text-emerald-700' :
                    stats.rate >= 75 ? 'text-amber-700' : 'text-rose-700'
                  } ${rowBg}`}>
                    {stats.rate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
};
