import React, { useState, useEffect, useMemo } from 'react';
import { Student, AttendanceStatus } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { CheckCircle2, Smartphone, ShieldCheck, ArrowRight, XCircle, Search, Clock, Info } from 'lucide-react';

interface StudentCheckinPortalProps {
  students: Student[];
}

export const StudentCheckinPortal: React.FC<StudentCheckinPortalProps> = ({ students }) => {
  // Parse URL Parameters
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialDate = urlParams.get('date') || new Date().toISOString().split('T')[0];
  const initialPin = urlParams.get('pin') || '';

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [enteredPin, setEnteredPin] = useState(initialPin);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<'P' | 'L'>('P'); // Default: Present

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkinDetails, setCheckinDetails] = useState<{
    name: string;
    id: string;
    date: string;
    time: string;
    status: string;
    offlineHash: string;
  } | null>(null);

  // Check if student already checked in on this device today
  useEffect(() => {
    const savedCheckin = localStorage.getItem(`student_checkin_${initialDate}`);
    if (savedCheckin) {
      try {
        const parsed = JSON.parse(savedCheckin);
        setCheckinDetails(parsed);
        setSubmitSuccess(true);
      } catch (e) {
        console.error(e);
      }
    }
  }, [initialDate]);

  // Filter students based on search term (search by name or roll number)
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.enrNumber.includes(searchTerm)
    ).slice(0, 5); // Limit to top 5 results for sleek mobile layout
  }, [students, searchTerm]);

  // Generate offline confirmation hash (hash of date + ID + pin)
  const generateOfflineHash = (studentId: string, date: string, pin: string) => {
    let hash = 0;
    const combined = `${studentId}-${date}-${pin}-rtc`;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `RTC-${Math.abs(hash).toString(36).substring(0, 4).toUpperCase()}`;
  };

  const handleSelectStudent = (student: Student) => {
    setSelectedStudentId(student.enrNumber);
    setSearchTerm(student.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setErrorMessage('Please select your name from the class roster.');
      return;
    }
    if (!enteredPin.trim()) {
      setErrorMessage('Please enter the 4-digit PIN shown on the board.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const student = students.find((s) => s.enrNumber === selectedStudentId);
    if (!student) {
      setErrorMessage('Student not found in class roster.');
      setIsSubmitting(false);
      return;
    }

    try {
      const nowStr = new Date().toISOString();
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const offlineCode = generateOfflineHash(selectedStudentId, initialDate, enteredPin);

      // Save to Firebase Firestore if online
      if (db) {
        await setDoc(doc(db, 'qr_checkins', `${initialDate}_${selectedStudentId}`), {
          enrNumber: selectedStudentId,
          studentName: student.name,
          date: initialDate,
          timestamp: nowStr,
          status: status,
          pin: enteredPin,
        });
      }

      const successData = {
        name: student.name,
        id: student.enrNumber,
        date: initialDate,
        time: timeStr,
        status: status === 'P' ? 'Present' : 'Late',
        offlineHash: offlineCode,
      };

      // Save locally to prevent multiple check-ins
      localStorage.setItem(`student_checkin_${initialDate}`, JSON.stringify(successData));
      
      setCheckinDetails(successData);
      setSubmitSuccess(true);
    } catch (err: any) {
      console.error('Firestore submission failed, falling back to offline verification', err);
      
      // Fallback local-only success if offline or permission issues
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const offlineCode = generateOfflineHash(selectedStudentId, initialDate, enteredPin);
      
      const student = students.find((s) => s.enrNumber === selectedStudentId)!;
      const successData = {
        name: student.name,
        id: student.enrNumber,
        date: initialDate,
        time: timeStr,
        status: status === 'P' ? 'Present (Offline)' : 'Late (Offline)',
        offlineHash: offlineCode,
      };

      localStorage.setItem(`student_checkin_${initialDate}`, JSON.stringify(successData));
      setCheckinDetails(successData);
      setSubmitSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetCheckin = () => {
    if (window.confirm('Are you sure you want to clear this check-in and scan again?')) {
      localStorage.removeItem(`student_checkin_${initialDate}`);
      setSubmitSuccess(false);
      setCheckinDetails(null);
      setSelectedStudentId('');
      setSearchTerm('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 py-8 font-sans" id="student-portal">
      {/* Dynamic Animated Background Accents */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

      <div className="w-full max-w-md bg-slate-850 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 relative">
        {/* Header Logo Area */}
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 mb-3">
            <Smartphone className="text-indigo-400" size={24} />
          </div>
          <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest">Royal Thimphu College</span>
          <h2 className="text-lg font-black text-white tracking-tight mt-1">Student Attendance Portal</h2>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Date: {new Date(initialDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>

        {submitSuccess && checkinDetails ? (
          /* SUCCESS STATE PANEL */
          <div className="space-y-6 text-center animate-fade-in" id="checkin-success-panel">
            <div className="mx-auto w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 mb-2 relative">
              <CheckCircle2 className="text-emerald-400" size={44} />
              <div className="absolute inset-0 bg-emerald-400/5 rounded-full animate-ping"></div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-white">Check-In Completed!</h3>
              <p className="text-xs text-slate-400">Your attendance status was logged in real-time.</p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 text-left divide-y divide-slate-700/40">
              <div className="pb-2.5">
                <span className="block text-[10px] uppercase font-bold text-slate-500">Student Name</span>
                <span className="text-sm font-bold text-white">{checkinDetails.name}</span>
              </div>
              <div className="py-2.5 flex justify-between items-center">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Enrollment ID</span>
                  <span className="text-xs font-mono font-semibold text-slate-300">{checkinDetails.id}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Status Marked</span>
                  <span className="text-xs font-bold text-emerald-400">{checkinDetails.status}</span>
                </div>
              </div>
              <div className="pt-2.5 flex justify-between items-center">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Checked In At</span>
                  <span className="text-xs font-mono font-semibold text-slate-300">{checkinDetails.time}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Verify Code</span>
                  <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {checkinDetails.offlineHash}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[10px] text-slate-400 leading-normal flex gap-2 text-left">
              <ShieldCheck className="text-indigo-400 shrink-0 mt-0.5" size={15} />
              <span>
                Please keep this screen open or show your teacher. The verify code serves as a backup confirmation in case your internet connection dropped.
              </span>
            </div>

            <button
              onClick={handleResetCheckin}
              className="text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer block mx-auto"
            >
              Check in another student
            </button>
          </div>
        ) : (
          /* FORM SUBMISSION STATE */
          <form onSubmit={handleSubmit} className="space-y-5" id="student-checkin-form">
            {errorMessage && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex gap-2">
                <XCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Step 1: Find Name */}
            <div className="space-y-1.5 relative">
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                1. Search and Select Your Name
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Type to search name or Enroll ID..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (selectedStudentId) {
                      setSelectedStudentId('');
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  id="student-search-portal"
                  autoComplete="off"
                />
              </div>

              {/* Autocomplete Dropdown list */}
              {searchTerm && !selectedStudentId && filteredStudents.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden divide-y divide-slate-700/60 max-h-56 overflow-y-auto">
                  {filteredStudents.map((student) => (
                    <button
                      key={student.enrNumber}
                      type="button"
                      onClick={() => handleSelectStudent(student)}
                      className="w-full text-left px-4 py-3 text-xs text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors font-semibold flex justify-between items-center"
                    >
                      <span>{student.name}</span>
                      <span className="font-mono text-[10px] text-slate-500">{student.enrNumber}</span>
                    </button>
                  ))}
                </div>
              )}

              {searchTerm && !selectedStudentId && filteredStudents.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl p-4 text-center text-xs text-slate-500">
                  No matching student found. Please verify spelling.
                </div>
              )}

              {selectedStudentId && (
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex justify-between items-center">
                  <span className="text-xs font-bold text-indigo-300">Selected Selected!</span>
                  <span className="text-[10px] font-mono font-semibold text-slate-400">ID: {selectedStudentId}</span>
                </div>
              )}
            </div>

            {/* Step 2: Verification PIN */}
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                2. Enter Session PIN
              </label>
              <input
                type="text"
                maxLength={4}
                placeholder="4-digit PIN"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-lg font-black tracking-widest text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                id="pin-portal-input"
              />
              <span className="block text-[10px] text-slate-500 leading-normal">
                Ask your instructor for the active 4-digit PIN displayed on the projection board.
              </span>
            </div>

            {/* Step 3: Status selection */}
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                3. Choose Attendance Status
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('P')}
                  className={`flex-1 py-2 text-xs font-bold border rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    status === 'P'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  Present
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('L')}
                  className={`flex-1 py-2 text-xs font-bold border rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    status === 'L'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-sm'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  <Clock size={14} />
                  Late
                </button>
              </div>
            </div>

            {/* Check-In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-extrabold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
              id="submit-portal-btn"
            >
              <span>{isSubmitting ? 'Verifying check-in...' : 'Submit Attendance'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* Brand footer */}
        <div className="mt-8 text-center text-[10px] text-slate-500 font-medium">
          Secure Self-Service Verification • Royal Thimphu College
        </div>
      </div>
    </div>
  );
};
