import React, { useMemo, useState } from 'react';
import { Student, AttendanceData } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { AlertTriangle, Users, TrendingUp, CalendarDays, Award, Check, Cloud, CloudOff, FileSpreadsheet, ExternalLink, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { createMonthlyReportSheet, createDetailedMultiMonthReportSheet } from '../lib/googleSheets';
import { CURRENT_MONTH_NAME, CURRENT_YEAR } from '../data/students';

interface AnalyticsDashboardProps {
  students: Student[];
  attendance: AttendanceData;
  accessToken: string | null;
  needsAuth: boolean;
  onLogin: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  students,
  attendance,
  accessToken,
  needsAuth,
  onLogin,
}) => {
  // 1. Calculate overall metrics
  const metrics = useMemo(() => {
    let totalPresents = 0;
    let totalAbsents = 0;
    let totalLates = 0;
    let totalMarkedCount = 0;

    const dates = Object.keys(attendance);
    
    dates.forEach((date) => {
      students.forEach((s) => {
        const status = attendance[date]?.[s.enrNumber] || '';
        if (status === 'P') {
          totalPresents++;
          totalMarkedCount++;
        } else if (status === 'A') {
          totalAbsents++;
          totalMarkedCount++;
        } else if (status === 'L') {
          totalLates++;
          totalMarkedCount++;
        }
      });
    });

    // Calculate per-student rates to find "At-Risk" and "Top Attendees"
    let totalEffectivePresentsSum = 0;
    const studentRates = students.map((s) => {
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
      const effectivePresent = present + late - absentDueToLate;
      totalEffectivePresentsSum += effectivePresent;

      const rate = marked > 0 ? Math.round((effectivePresent / marked) * 100) : 100;
      return { student: s, rate, present, absent, late, marked };
    });

    const overallRate = totalMarkedCount > 0 ? Math.round((totalEffectivePresentsSum / totalMarkedCount) * 100) : 100;

    const atRiskStudents = studentRates.filter((item) => item.marked > 0 && item.rate < 75);
    const topStudents = studentRates.filter((item) => item.marked > 3 && item.rate >= 95);

    return {
      overallRate,
      totalPresents,
      totalAbsents,
      totalLates,
      atRiskCount: atRiskStudents.length,
      atRiskStudents,
      topStudents,
      studentRates,
    };
  }, [students, attendance]);

  // 2. Prepare Trend Data (Day-by-Day percentage)
  const trendData = useMemo(() => {
    const dates = Object.keys(attendance).sort();
    return dates.map((date) => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let total = 0;

      students.forEach((s) => {
        const status = attendance[date]?.[s.enrNumber] || '';
        if (status === 'P') { present++; total++; }
        else if (status === 'A') { absent++; total++; }
        else if (status === 'L') { late++; total++; }
      });

      // 3 lates = 1 absent (penalty: late * (2/3) present, late * (1/3) absent)
      const rate = total > 0 ? Math.round(((present + late * (2/3)) / total) * 100) : 0;
      
      // Shorten date label for chart (e.g. "Aug 3" instead of "2026-08-03")
      let dateLabel = date;
      try {
        const d = new Date(date);
        dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch {}

      return {
        date,
        label: dateLabel,
        'Attendance Rate (%)': rate,
        Present: present,
        Absent: absent,
        Late: late,
      };
    });
  }, [students, attendance]);

  // 3. Prepare Pie Chart Data for status ratios
  const pieData = useMemo(() => {
    const total = metrics.totalPresents + metrics.totalAbsents + metrics.totalLates;
    if (total === 0) return [];
    return [
      { name: 'Present', value: metrics.totalPresents, color: '#10b981' },
      { name: 'Absent', value: metrics.totalAbsents, color: '#f43f5e' },
      { name: 'Late', value: metrics.totalLates, color: '#f59e0b' },
    ];
  }, [metrics]);

  // 4. Prepare Distribution Data
  const distributionData = useMemo(() => {
    let perfect = 0;     // 95% - 100%
    let regular = 0;     // 85% - 94%
    let vulnerable = 0;  // 75% - 84%
    let critical = 0;    // < 75%

    metrics.studentRates.forEach((item) => {
      if (item.marked === 0) return;
      if (item.rate >= 95) perfect++;
      else if (item.rate >= 85) regular++;
      else if (item.rate >= 75) vulnerable++;
      else critical++;
    });

    return [
      { name: 'Critical (<75%)', count: critical, color: '#f43f5e' },
      { name: 'Vulnerable (75-84%)', count: vulnerable, color: '#f59e0b' },
      { name: 'Regular (85-94%)', count: regular, color: '#3b82f6' },
      { name: 'Outstanding (≥95%)', count: perfect, color: '#10b981' },
    ];
  }, [metrics]);

  // 5. Gender-wise average attendance rates
  const genderStats = useMemo(() => {
    let malePresent = 0;
    let maleMarked = 0;
    let femalePresent = 0;
    let femaleMarked = 0;

    metrics.studentRates.forEach((item) => {
      const absentDueToLate = Math.floor(item.late / 3);
      const effectivePresent = item.present + item.late - absentDueToLate;
      if (item.student.gender === 'M') {
        malePresent += effectivePresent;
        maleMarked += item.marked;
      } else {
        femalePresent += effectivePresent;
        femaleMarked += item.marked;
      }
    });

    const maleRate = maleMarked > 0 ? Math.round((malePresent / maleMarked) * 100) : 100;
    const femaleRate = femaleMarked > 0 ? Math.round((femalePresent / femaleMarked) * 100) : 100;

    return [
      { name: 'Male Students', rate: maleRate, color: '#3b82f6' },
      { name: 'Female Students', rate: femaleRate, color: '#ec4899' },
    ];
  }, [metrics]);

  // --- MONTHLY REPORT STATES ---
  const [savingReport, setSavingReport] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  const [savingDetailedReport, setSavingDetailedReport] = useState(false);
  const [detailedReportUrl, setDetailedReportUrl] = useState<string | null>(null);

  const handleExportMonthlyReport = async () => {
    if (!accessToken) return;
    const defaultTitle = `Classroom Monthly Attendance Summary Report - ${CURRENT_MONTH_NAME} ${CURRENT_YEAR}`;
    const title = window.prompt('Enter a title for the Monthly Report Google Sheet:', defaultTitle);
    if (!title) return;

    setSavingReport(true);
    setReportError(null);
    setReportSuccess(null);
    try {
      const result = await createMonthlyReportSheet(accessToken, title, students, attendance);
      setReportUrl(result.webViewLink);
      setReportSuccess(`Successfully created and formatted "${title}" in your Google Drive!`);
    } catch (err: any) {
      setReportError(err.message || 'Failed to save monthly report to Google Drive.');
    } finally {
      setSavingReport(false);
    }
  };

  const handleExportDetailedReport = async () => {
    if (!accessToken) return;
    const defaultTitle = `Classroom Detailed Attendance Report - All Months`;
    const title = window.prompt('Enter a title for the Detailed Report Google Sheet:', defaultTitle);
    if (!title) return;

    setSavingDetailedReport(true);
    setReportError(null);
    setReportSuccess(null);
    try {
      const result = await createDetailedMultiMonthReportSheet(accessToken, title, students, attendance);
      setDetailedReportUrl(result.webViewLink);
      setReportSuccess(`Successfully created and formatted "${title}" with daily attendance tabs in your Google Drive!`);
    } catch (err: any) {
      setReportError(err.message || 'Failed to save detailed report to Google Drive.');
    } finally {
      setSavingDetailedReport(false);
    }
  };

  return (
    <div className="space-y-6" id="analytics-section">
      {/* Monthly Summary Export Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sparkles size={16} />
            </span>
            <h2 className="text-base font-extrabold text-gray-800">Attendance Intelligence & Summary Reports</h2>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed max-w-xl">
            Analyze monthly performance statistics and generate professional, executive attendance spreadsheets directly in your Google Drive or Google Sheets.
          </p>
        </div>

        <div className="w-full md:w-auto shrink-0">
          {needsAuth ? (
            <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2">
                <CloudOff className="text-gray-400 shrink-0" size={16} />
                <span className="text-xs font-semibold text-gray-500">Google Drive is offline (Sandbox Mode)</span>
              </div>
              <button
                onClick={onLogin}
                className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
              >
                <Cloud size={12} />
                Connect Account
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {reportUrl && (
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-3xs"
                  title="Open Summary Report"
                >
                  <ExternalLink size={13} />
                  Open Summary
                </a>
              )}
              <button
                onClick={handleExportMonthlyReport}
                disabled={savingReport || savingDetailedReport}
                className="px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 disabled:opacity-50 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
              >
                {savingReport ? (
                  <>
                    <RefreshCw className="animate-spin" size={13} />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={13} />
                    Export Summary
                  </>
                )}
              </button>

              {detailedReportUrl && (
                <a
                  href={detailedReportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-3xs"
                  title="Open Detailed Daily Report"
                >
                  <ExternalLink size={13} />
                  Open Detailed
                </a>
              )}
              <button
                onClick={handleExportDetailedReport}
                disabled={savingReport || savingDetailedReport}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                id="export-detailed-daily-dashboard-btn"
              >
                {savingDetailedReport ? (
                  <>
                    <RefreshCw className="animate-spin" size={13} />
                    Exporting Daily...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={13} />
                    Export Detailed (Daily)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Export Feedback Toasts */}
      {(reportSuccess || reportError) && (
        <div className={`p-4 rounded-xl border ${
          reportSuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        } text-xs flex justify-between items-center gap-4`}>
          <div className="flex items-center gap-2">
            {reportSuccess ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{reportSuccess || reportError}</span>
          </div>
          <button
            onClick={() => { setReportSuccess(null); setReportError(null); }}
            className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600"
          >
            Close
          </button>
        </div>
      )}
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-2xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-400 block uppercase">Overall Attendance</span>
            <span className="text-2xl font-bold text-gray-800">{metrics.overallRate}%</span>
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-2xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <Users size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-400 block uppercase">Outstanding Attendees</span>
            <span className="text-2xl font-bold text-emerald-600">{metrics.topStudents.length}</span>
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-2xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <AlertTriangle size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-400 block uppercase">At-Risk Students</span>
            <span className="text-2xl font-bold text-rose-600">{metrics.atRiskCount}</span>
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-2xs flex items-center gap-4">
          <div className="p-3 bg-gray-50 text-gray-600 rounded-lg">
            <CalendarDays size={24} />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-400 block uppercase">Tracked School Days</span>
            <span className="text-2xl font-bold text-gray-800">{trendData.length} days</span>
          </div>
        </div>
      </div>

      {/* Grid for Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Line Chart */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-2xs lg:col-span-2">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wider text-gray-400 mb-4">
            Attendance Rate Trend ({CURRENT_MONTH_NAME} {CURRENT_YEAR})
          </h3>
          <div className="h-72">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">No school day records found.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} stroke="#9ca3af" />
                  <YAxis domain={[50, 100]} fontSize={11} stroke="#9ca3af" />
                  <Tooltip />
                  <Legend iconSize={12} fontSize={11} />
                  <Line
                    type="monotone"
                    dataKey="Attendance Rate (%)"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Ratio Pie Chart */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-2xs">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wider text-gray-400 mb-4">
            Total Attendance Ratio
          </h3>
          <div className="h-72 flex flex-col justify-between">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400">No markings yet.</div>
            ) : (
              <>
                <div className="h-48 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Inside text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-extrabold text-gray-800">{metrics.overallRate}%</span>
                    <span className="text-xs text-gray-400 font-medium">Avg Attendance</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-gray-50">
                  {pieData.map((item) => {
                    const total = pieData.reduce((acc, curr) => acc + curr.value, 0);
                    const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                    return (
                      <div key={item.name} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 font-medium text-gray-600">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </div>
                        <span className="font-bold text-gray-800">
                          {item.value} times ({percentage}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Distribution */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-2xs">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wider text-gray-400 mb-4">
            Student Attendance Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} stroke="#9ca3af" />
                <YAxis allowDecimals={false} fontSize={11} stroke="#9ca3af" />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gender Breakdown bar */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-2xs">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wider text-gray-400 mb-4">
            Gender Attendance Comparison
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={genderStats} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} stroke="#9ca3af" />
                <YAxis domain={[50, 100]} fontSize={11} stroke="#9ca3af" />
                <Tooltip />
                <Bar dataKey="rate" name="Average Rate (%)" radius={[4, 4, 0, 0]}>
                  {genderStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Critical Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* At risk list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-2xs p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm text-rose-600">
              <AlertTriangle size={18} />
              At-Risk Students (&lt;75% Attendance)
            </h3>
            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded-full text-xs">
              {metrics.atRiskStudents.length} Students
            </span>
          </div>

          {metrics.atRiskStudents.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Outstanding! No students are currently under 75%.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {metrics.atRiskStudents.map((item) => (
                <div key={item.student.enrNumber} className="flex justify-between items-center p-2.5 bg-rose-50/50 border border-rose-100 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{item.student.name}</span>
                    <span className="text-xs text-gray-400 font-mono">({item.student.enrNumber})</span>
                  </div>
                  <span className="font-extrabold text-rose-600 bg-rose-100/60 px-2 py-0.5 rounded-md text-xs">
                    {item.rate}% ({item.absent} missed)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top attendees list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-2xs p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm text-emerald-600">
              <Award size={18} />
              Honor Attendance Roll (&ge;95% Attendance)
            </h3>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-full text-xs">
              {metrics.topStudents.length} Students
            </span>
          </div>

          {metrics.topStudents.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Attendance calculations will qualify candidates soon.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {metrics.topStudents.map((item) => (
                <div key={item.student.enrNumber} className="flex justify-between items-center p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{item.student.name}</span>
                    <span className="text-xs text-gray-400 font-mono">({item.student.enrNumber})</span>
                  </div>
                  <span className="font-extrabold text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-md text-xs">
                    {item.rate}% Attendance
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
