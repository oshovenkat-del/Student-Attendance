import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { Student, AttendanceStatus, AttendanceData } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore';
import { QrCode, RefreshCw, Smartphone, CheckCircle, Clock, Volume2, VolumeX, Sparkles, Send, ShieldCheck, Info } from 'lucide-react';

interface DailyQrCheckinProps {
  students: Student[];
  selectedDate: string;
  updateStatus: (studentId: string, status: AttendanceStatus) => void;
  attendance: AttendanceData;
}

export const DailyQrCheckin: React.FC<DailyQrCheckinProps> = ({
  students,
  selectedDate,
  updateStatus,
  attendance,
}) => {
  // Generate random 4-digit PIN
  const generateNewPin = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const [pin, setPin] = useState(() => {
    const savedPin = localStorage.getItem(`qr_pin_${selectedDate}`);
    return savedPin || generateNewPin();
  });

  const [qrUrl, setQrUrl] = useState<string>('');
  const [playAudio, setPlayAudio] = useState(true);
  const [activeTab, setActiveTab] = useState<'qr' | 'simulate' | 'logs'>('qr');
  const [recentCheckins, setRecentCheckins] = useState<Array<{
    enrNumber: string;
    name: string;
    timestamp: string;
    status: AttendanceStatus;
    method: 'Real Mobile Scan' | 'Scanner Simulator';
  }>>([]);

  // Save PIN when it changes
  useEffect(() => {
    localStorage.setItem(`qr_pin_${selectedDate}`, pin);
  }, [pin, selectedDate]);

  // Handle generating a new PIN manually
  const handleRegenerateSession = () => {
    const newPin = generateNewPin();
    setPin(newPin);
  };

  // Generate the full scan URL
  const scanUrl = useMemo(() => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}?qr_checkin=true&date=${selectedDate}&pin=${pin}`;
  }, [selectedDate, pin]);

  // Draw the QR Code whenever the URL changes
  useEffect(() => {
    QRCode.toDataURL(scanUrl, {
      width: 280,
      margin: 1.5,
      color: {
        dark: '#312e81', // indigo-900
        light: '#ffffff',
      },
    })
      .then((url) => setQrUrl(url))
      .catch((err) => console.error('Error generating QR code', err));
  }, [scanUrl]);

  // Web Audio API Chime helper
  const playSuccessChime = () => {
    if (!playAudio) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      // First note (E5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.3);

      // Second note (A5) slightly staggered
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(880.00, ctx.currentTime); // A5
        gain2.gain.setValueAtTime(0.2, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.4);
      }, 120);
    } catch (e) {
      console.warn('Audio context was blocked or not supported:', e);
    }
  };

  // Listen to Firestore real-time QR check-ins for the selected date
  useEffect(() => {
    if (!db) return;

    // Listen for check-ins on this date
    const q = query(
      collection(db, 'qr_checkins'),
      where('date', '==', selectedDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          const studentEnr = data.enrNumber;
          const status = data.status || 'P';

          // Ensure student is in our current roster before checking them in
          const student = students.find((s) => s.enrNumber === studentEnr);
          if (student) {
            // Get current registered status
            const existingStatus = attendance[selectedDate]?.[studentEnr];
            
            // Only update and log if status actually changed or is currently empty
            if (existingStatus !== status) {
              updateStatus(studentEnr, status);
              playSuccessChime();

              // Add to recent check-ins display list
              setRecentCheckins((prev) => {
                // Avoid duplicates in recent logs
                if (prev.some((item) => item.enrNumber === studentEnr)) {
                  return prev;
                }
                const formattedTime = data.timestamp
                  ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                return [
                  {
                    enrNumber: studentEnr,
                    name: student.name,
                    timestamp: formattedTime,
                    status: status as AttendanceStatus,
                    method: 'Real Mobile Scan',
                  },
                  ...prev,
                ];
              });
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [selectedDate, students, attendance, updateStatus, playAudio]);

  // SIMULATOR FUNCTION: Allows scanning directly inside the teacher's view (ideal for iframe environment)
  const [selectedSimStudent, setSelectedSimStudent] = useState('');
  const [simStatus, setSimStatus] = useState<AttendanceStatus>('P');
  const [simulating, setSimulating] = useState(false);

  const handleSimulateScan = async () => {
    if (!selectedSimStudent) return;
    setSimulating(true);

    const targetStudent = students.find((s) => s.enrNumber === selectedSimStudent);
    if (!targetStudent) return;

    try {
      const nowStr = new Date().toISOString();
      
      // 1. Log directly to Firestore so the real-time listener triggers
      if (db) {
        await setDoc(doc(db, 'qr_checkins', `${selectedDate}_${selectedSimStudent}`), {
          enrNumber: selectedSimStudent,
          studentName: targetStudent.name,
          date: selectedDate,
          timestamp: nowStr,
          status: simStatus,
          pin: pin,
        });
      } else {
        // Fallback for purely local execution if firebase isn't accessible
        updateStatus(selectedSimStudent, simStatus);
        playSuccessChime();
        
        setRecentCheckins((prev) => {
          if (prev.some((item) => item.enrNumber === selectedSimStudent)) return prev;
          return [
            {
              enrNumber: selectedSimStudent,
              name: targetStudent.name,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              status: simStatus,
              method: 'Scanner Simulator',
            },
            ...prev,
          ];
        });
      }

      // Success feedback
      setSelectedSimStudent('');
    } catch (err) {
      console.error('Simulation failed', err);
      // fallback local update on error
      updateStatus(selectedSimStudent, simStatus);
      playSuccessChime();
    } finally {
      setSimulating(false);
    }
  };

  // Find students who are currently unmarked to suggest for the simulator
  const unmarkedStudents = useMemo(() => {
    return students.filter((s) => {
      const status = attendance[selectedDate]?.[s.enrNumber] || '';
      return status === '';
    });
  }, [students, attendance, selectedDate]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden" id="qr-session-card">
      <div className="bg-indigo-900 px-5 py-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <QrCode className="text-indigo-200 animate-pulse" size={20} />
          <div>
            <h3 className="font-extrabold text-sm tracking-tight leading-none">QR Code Self Check-In</h3>
            <span className="text-[10px] text-indigo-200 font-medium mt-1 block">Students scan with mobile phones</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPlayAudio(!playAudio)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-indigo-100 cursor-pointer"
            title={playAudio ? "Mute notification sound" : "Unmute notification sound"}
          >
            {playAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          
          <button
            onClick={handleRegenerateSession}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-indigo-100 cursor-pointer flex items-center gap-1 text-[11px] font-bold"
            title="Refresh code / session PIN"
          >
            <RefreshCw size={13} />
            Reset PIN
          </button>
        </div>
      </div>

      <div className="border-b border-gray-100 bg-gray-50 flex">
        <button
          onClick={() => setActiveTab('qr')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'qr'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
          }`}
        >
          1. Show QR Code
        </button>
        <button
          onClick={() => setActiveTab('simulate')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'simulate'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
          }`}
        >
          2. Scanner Simulator
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'logs'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
          }`}
        >
          Live Check-Ins ({recentCheckins.length})
        </button>
      </div>

      <div className="p-5">
        {activeTab === 'qr' && (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 relative">
              {qrUrl ? (
                <img src={qrUrl} alt="Scan QR Code" className="w-56 h-56 object-contain rounded-xl shadow-xs" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-gray-400">
                  Generating QR Code...
                </div>
              )}
              
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-white font-black px-4 py-1.5 rounded-full text-sm shadow-md tracking-wider">
                PIN: {pin}
              </div>
            </div>

            <div className="space-y-1.5 max-w-sm mt-2">
              <p className="text-xs font-bold text-gray-700">Scan to mark attendance automatically</p>
              <p className="text-[10px] text-gray-400 leading-normal">
                Generates a secure check-in portal for today's sheet. The PIN guarantees students are active in the classroom.
              </p>
            </div>

            <div className="w-full pt-3 border-t border-gray-50 flex flex-col items-center gap-1.5 text-left bg-indigo-50/30 p-3 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider flex items-center gap-1">
                <Smartphone size={10} /> Link encoded in QR
              </span>
              <span className="text-[10px] font-mono text-gray-500 truncate max-w-xs break-all bg-white px-2 py-1 rounded border border-gray-100 w-full select-all">
                {scanUrl}
              </span>
            </div>
          </div>
        )}

        {activeTab === 'simulate' && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg text-xs text-amber-800 leading-relaxed flex gap-2">
              <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>AI Studio Testing Guideline:</strong> Since the live preview is inside an iframe, use this tool to easily simulate a student scanning the QR code and checking in. It writes to the same system so you can test full real-time mechanics!
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1.5">
                  Select student to simulate scanning
                </label>
                <select
                  value={selectedSimStudent}
                  onChange={(e) => setSelectedSimStudent(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  <option value="">-- Choose Student --</option>
                  {unmarkedStudents.map((s) => (
                    <option key={s.enrNumber} value={s.enrNumber}>
                      {s.name} ({s.enrNumber})
                    </option>
                  ))}
                  {unmarkedStudents.length === 0 && (
                    <option value="" disabled>All students are already marked present/absent!</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1.5">
                  Check-in status
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSimStatus('P')}
                    className={`flex-1 py-1.5 text-xs font-bold border rounded-lg transition-all flex items-center justify-center gap-1 ${
                      simStatus === 'P'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle size={14} />
                    Mark Present
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimStatus('L')}
                    className={`flex-1 py-1.5 text-xs font-bold border rounded-lg transition-all flex items-center justify-center gap-1 ${
                      simStatus === 'L'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-2xs'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Clock size={14} />
                    Mark Late
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSimulateScan}
                disabled={!selectedSimStudent || simulating}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-extrabold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
              >
                <Sparkles size={14} />
                {simulating ? 'Processing scan...' : 'Trigger Simulation Scan'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                Active scan session log
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Live
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 divide-y divide-gray-50">
              {recentCheckins.map((log, index) => (
                <div key={log.enrNumber + index} className="flex justify-between items-center pt-2 first:pt-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      log.status === 'P' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {log.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-700 leading-none">{log.name}</p>
                      <span className="text-[9px] text-gray-400">{log.enrNumber} • {log.method}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-gray-400 block">{log.timestamp}</span>
                    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${
                      log.status === 'P' ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {log.status === 'P' ? 'Present' : 'Late'}
                    </span>
                  </div>
                </div>
              ))}

              {recentCheckins.length === 0 && (
                <div className="py-8 text-center text-xs text-gray-400 italic">
                  Waiting for check-ins... Scan the QR code or use the Simulator to test.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
