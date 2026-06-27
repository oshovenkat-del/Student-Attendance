import React, { useState, useMemo } from 'react';
import { Student, AttendanceData, AttendanceStatus } from '../types';
import { Check, X, Clock, RefreshCw, Search, Users, CalendarDays, ChevronRight, ChevronLeft, Trash2, QrCode } from 'lucide-react';
import { DailyQrCheckin } from './DailyQrCheckin';

interface DailyRollCallProps {
  students: Student[];
  attendance: AttendanceData;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  updateStatus: (studentId: string, status: AttendanceStatus) => void;
  syncPendingUpdates: () => void;
  hasPendingChanges: boolean;
}

export const DailyRollCall: React.FC<DailyRollCallProps> = ({
  students,
  attendance,
  selectedDate,
  setSelectedDate,
  updateStatus,
  syncPendingUpdates,
  hasPendingChanges,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'M' | 'F'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MARKED' | 'UNMARKED' | 'P' | 'A' | 'L'>('ALL');
  const [showQrSession, setShowQrSession] = useState(false);

  // Format date helper (YYYY-MM-DD -> Human readable)
  const formattedDateString = useMemo(() => {
    try {
      const d = new Date(selectedDate);
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Adjust date by -1 or +1 day
  const adjustDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    // Format back to YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${day}`);
  };

  // Get status for each student on selectedDate
  const getStatus = (enrNumber: string): AttendanceStatus => {
    return attendance[selectedDate]?.[enrNumber] || '';
  };

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            student.enrNumber.includes(searchTerm);
      const matchesGender = genderFilter === 'ALL' || student.gender === genderFilter;
      
      const status = getStatus(student.enrNumber);
      let matchesStatus = true;
      if (statusFilter === 'MARKED') matchesStatus = status !== '';
      else if (statusFilter === 'UNMARKED') matchesStatus = status === '';
      else if (statusFilter !== 'ALL') matchesStatus = status === statusFilter;

      return matchesSearch && matchesGender && matchesStatus;
    });
  }, [students, attendance, selectedDate, searchTerm, genderFilter, statusFilter]);

  // Attendance stats for the day
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let unmarked = 0;

    students.forEach((s) => {
      const status = getStatus(s.enrNumber);
      if (status === 'P') present++;
      else if (status === 'A') absent++;
      else if (status === 'L') late++;
      else unmarked++;
    });

    const total = students.length;
    const marked = total - unmarked;
    const rate = marked > 0 ? Math.round(((present + late * (2/3)) / marked) * 100) : 0;

    return { present, absent, late, unmarked, total, marked, rate };
  }, [students, attendance, selectedDate]);

  // Quick Action: Mark all filtered students as Present
  const markAllFilteredAsPresent = () => {
    const confirmed = window.confirm(
      `Are you sure you want to mark all ${filteredStudents.length} filtered students as Present for ${selectedDate}?`
    );
    if (!confirmed) return;
    
    filteredStudents.forEach((student) => {
      updateStatus(student.enrNumber, 'P');
    });
  };

  // Quick Action: Remove/Clear all filtered students' attendance for the current date
  const clearAllFilteredAttendance = () => {
    const confirmed = window.confirm(
      `Are you sure you want to remove/clear attendance for all ${filteredStudents.length} filtered students for ${selectedDate}?`
    );
    if (!confirmed) return;
    
    filteredStudents.forEach((student) => {
      updateStatus(student.enrNumber, '');
    });
  };

  return (
    <div className="space-y-6" id="roll-call-section">
      {/* Date Navigation & Summary Card */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <button
            onClick={() => adjustDate(-1)}
            className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 transition-colors"
            title="Previous Day"
            id="prev-day-btn"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex flex-col items-center md:items-start">
            <span className="text-sm font-medium text-gray-400">Marking Attendance for</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="font-semibold text-gray-800 border-none bg-transparent hover:bg-gray-50 p-1 rounded-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-center md:text-left text-lg cursor-pointer"
              id="date-picker-input"
            />
            <span className="text-xs text-indigo-600 font-medium">{formattedDateString}</span>
          </div>

          <button
            onClick={() => adjustDate(1)}
            className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 transition-colors"
            title="Next Day"
            id="next-day-btn"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Real-time stats pills */}
        <div className="grid grid-cols-4 gap-2 w-full md:w-auto text-center">
          <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg">
            <span className="block text-xs font-medium text-emerald-600">Present</span>
            <span className="text-lg font-bold text-emerald-700">{stats.present}</span>
          </div>
          <div className="bg-amber-50 border border-amber-100 p-2 rounded-lg">
            <span className="block text-xs font-medium text-amber-600">Late</span>
            <span className="text-lg font-bold text-amber-700">{stats.late}</span>
          </div>
          <div className="bg-rose-50 border border-rose-100 p-2 rounded-lg">
            <span className="block text-xs font-medium text-rose-600">Absent</span>
            <span className="text-lg font-bold text-rose-700">{stats.absent}</span>
          </div>
          <div className="bg-gray-50 border border-gray-100 p-2 rounded-lg">
            <span className="block text-xs font-medium text-gray-500">Unmarked</span>
            <span className="text-lg font-bold text-gray-700">{stats.unmarked}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex-1 w-full">
          <div className="flex justify-between text-sm font-medium mb-2">
            <span className="text-gray-600 flex items-center gap-1.5">
              <Users size={16} className="text-gray-400" />
              Attendance Progress: {stats.marked} of {stats.total} students ({Math.round((stats.marked / stats.total) * 100)}% marked)
            </span>
            <span className="text-indigo-600">Avg Attendance: {stats.rate}%</span>
          </div>
          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${(stats.marked / stats.total) * 100}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => setShowQrSession(!showQrSession)}
          className={`w-full md:w-auto px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border shrink-0 ${
            showQrSession
              ? 'bg-indigo-600 text-white border-indigo-700 shadow-md'
              : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50/50 shadow-2xs'
          }`}
          id="toggle-qr-session-btn"
        >
          <QrCode size={15} className={showQrSession ? 'animate-pulse' : ''} />
          {showQrSession ? 'Hide QR Session' : 'Daily QR Check-In'}
        </button>
      </div>

      {/* Split grid for QR check-in session */}
      <div className={showQrSession ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : ""}>
        <div className={showQrSession ? "lg:col-span-2 space-y-6" : "space-y-6"}>
          {/* Control Actions & Filter Bar */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search student name or enroll ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                id="student-search-input"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Gender Filter */}
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value as any)}
                className="border border-gray-200 rounded-lg p-2 text-xs font-medium text-gray-600 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                id="gender-filter"
              >
                <option value="ALL">All Genders</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="border border-gray-200 rounded-lg p-2 text-xs font-medium text-gray-600 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                id="status-filter"
              >
                <option value="ALL">All Attendance</option>
                <option value="MARKED">Marked</option>
                <option value="UNMARKED">Unmarked</option>
                <option value="P">Present</option>
                <option value="L">Late</option>
                <option value="A">Absent</option>
              </select>

              {/* Mark Filtered as Present */}
              <button
                onClick={markAllFilteredAsPresent}
                disabled={filteredStudents.length === 0}
                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                title="Mark all current filtered students as present"
                id="bulk-present-btn"
              >
                Bulk Present ({filteredStudents.length})
              </button>

              {/* Clear Filtered Attendance */}
              <button
                onClick={clearAllFilteredAttendance}
                disabled={filteredStudents.length === 0}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                title="Remove/Clear attendance status for all current filtered students"
                id="bulk-clear-btn"
              >
                <Trash2 size={13} />
                Bulk Remove ({filteredStudents.length})
              </button>
            </div>
          </div>

          {/* Student Attendance Cards Grid */}
          {filteredStudents.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-500">
              No students found matching your filters. Try clearing search or filters.
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${showQrSession ? "xl:grid-cols-2" : "lg:grid-cols-3"}`}>
              {filteredStudents.map((student) => {
                const currentStatus = getStatus(student.enrNumber);
                return (
                  <div
                    key={student.enrNumber}
                    className={`bg-white border rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between ${
                      currentStatus === 'P' ? 'border-l-4 border-l-emerald-500' :
                      currentStatus === 'A' ? 'border-l-4 border-l-rose-500' :
                      currentStatus === 'L' ? 'border-l-4 border-l-amber-500' :
                      'border-l-4 border-l-gray-300'
                    }`}
                    id={`student-card-${student.enrNumber}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                          student.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {student.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 text-sm leading-tight">{student.name}</h4>
                          <span className="text-xs font-mono text-gray-400">ID: {student.enrNumber} • {student.gender}</span>
                        </div>
                      </div>
                    </div>

                    {/* Mark Options Buttons */}
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() => updateStatus(student.enrNumber, 'P')}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          currentStatus === 'P'
                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                            : 'bg-white hover:bg-emerald-50 text-emerald-600 border-gray-200'
                        }`}
                        id={`btn-present-${student.enrNumber}`}
                      >
                        <Check size={14} />
                        Present
                      </button>

                      <button
                        onClick={() => updateStatus(student.enrNumber, 'L')}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          currentStatus === 'L'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-white hover:bg-amber-50 text-amber-600 border-gray-200'
                        }`}
                        id={`btn-late-${student.enrNumber}`}
                      >
                        <Clock size={14} />
                        Late
                      </button>

                      <button
                        onClick={() => updateStatus(student.enrNumber, 'A')}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          currentStatus === 'A'
                            ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                            : 'bg-white hover:bg-rose-50 text-rose-600 border-gray-200'
                        }`}
                        id={`btn-absent-${student.enrNumber}`}
                      >
                        <X size={14} />
                        Absent
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* QR Code section on the right */}
        {showQrSession && (
          <div className="lg:col-span-1">
            <DailyQrCheckin
              students={students}
              selectedDate={selectedDate}
              updateStatus={updateStatus}
              attendance={attendance}
            />
          </div>
        )}
      </div>
    </div>
  );
};
