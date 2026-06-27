import React, { useState, useMemo } from 'react';
import { Student, AttendanceData, AttendanceStatus } from '../types';
import { User, Phone, Mail, FileText, Sparkles, Award, AlertTriangle, CheckCircle, Save, TrendingUp, Calendar } from 'lucide-react';

interface StudentProfileProps {
  students: Student[];
  attendance: AttendanceData;
  onUpdateNotes: (studentId: string, notes: string) => void;
  onUpdateStudent?: (studentEnr: string, updatedFields: Partial<Student>) => void;
}

export const StudentProfile: React.FC<StudentProfileProps> = ({
  students,
  attendance,
  onUpdateNotes,
  onUpdateStudent,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<number>(students[0]?.id || 1);
  const [notesText, setNotesText] = useState('');
  const [opinionText, setOpinionText] = useState('');

  // States for general profile editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState<'M' | 'F'>('M');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Find currently selected student
  const student = useMemo(() => {
    return students.find((item) => item.id === selectedStudentId);
  }, [selectedStudentId, students]);

  // Synchronize input fields when the selected student changes
  React.useEffect(() => {
    if (student) {
      setNotesText(student.notes || '');
      setOpinionText(student.opinion || '');
      setEditName(student.name || '');
      setEditGender(student.gender || 'M');
      setEditEmail(student.email || '');
      setEditPhone(student.phone || '');
      setIsEditingProfile(false);
    }
  }, [selectedStudentId, student]);

  // Calculate detailed attendance statistics for the student
  const stats = useMemo(() => {
    if (!student) return null;
    
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let activeDays = 0;
    let currentStreak = 0;
    let maxStreak = 0;

    // Get sorted list of dates
    const sortedDates = Object.keys(attendance).sort();

    // Track streaks
    sortedDates.forEach((date) => {
      const status = attendance[date]?.[student.enrNumber] || '';
      if (status) {
        activeDays++;
        if (status === 'P') {
          totalPresent++;
          currentStreak++;
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
        } else if (status === 'L') {
          totalLate++;
          currentStreak++; // Late still counts as present for daily streak/presence mostly
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
        } else if (status === 'A') {
          totalAbsent++;
          currentStreak = 0;
        }
      }
    });

    const absentDueToLate = Math.floor(totalLate / 3);
    const attendanceRate = activeDays > 0 ? Math.round(((totalPresent + totalLate - absentDueToLate) / activeDays) * 100) : 100;

    return {
      totalPresent,
      totalAbsent,
      totalLate,
      absentDueToLate,
      activeDays,
      currentStreak,
      maxStreak,
      attendanceRate,
    };
  }, [student, attendance]);

  // AI/Smart Engagement Suggestions based on statistics
  const engagementInsight = useMemo(() => {
    if (!stats) return null;
    
    const rate = stats.attendanceRate;
    
    if (rate >= 95) {
      return {
        level: 'Outstanding Engagement',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        icon: <Award className="text-emerald-600" size={20} />,
        suggestion: `${student?.name} is showing near-perfect attendance (${rate}%). They are highly engaged in learning and would be excellent candidates for peer-tutoring, classroom leadership, or representing the class in team tasks. Keep up the encouragement!`,
      };
    } else if (rate >= 85) {
      return {
        level: 'Consistent Engagement',
        color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        icon: <CheckCircle className="text-indigo-600" size={20} />,
        suggestion: `${student?.name} is maintaining a healthy attendance record of ${rate}%. They are highly responsive and regular. Continue acknowledging their commitment during parent-teacher feedback sessions.`,
      };
    } else if (rate >= 75) {
      return {
        level: 'Slight Risk Warning',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        icon: <AlertTriangle className="text-amber-600" size={20} />,
        suggestion: `${student?.name}'s attendance is currently at ${rate}%. They have missed ${stats.totalAbsent} days. It would be helpful to check if they face commuting difficulties, morning fatigue, or require extra catch-up notes for the missed periods.`,
      };
    } else {
      return {
        level: 'High At-Risk Alert',
        color: 'text-rose-700 bg-rose-50 border-rose-200',
        icon: <AlertTriangle className="text-rose-600" size={20} />,
        suggestion: `CRITICAL: ${student?.name}'s attendance has dropped to ${rate}%, well below the required threshold. Immediate check-in is recommended. Coordinate with school counselors or schedule a parent conference to understand and remove learning blockades.`,
      };
    }
  }, [stats, student]);

  // Handle saving personal notes
  const handleSaveNotes = () => {
    if (student) {
      if (onUpdateStudent) {
        onUpdateStudent(student.enrNumber, { notes: notesText });
      } else {
        onUpdateNotes(student.enrNumber, notesText);
      }
      alert(`Notes saved successfully for ${student.name}!`);
    }
  };

  // Handle saving student self-opinion/feedback
  const handleSaveOpinion = () => {
    if (student) {
      if (onUpdateStudent) {
        onUpdateStudent(student.enrNumber, { opinion: opinionText });
        alert(`Student opinion saved successfully for ${student.name}!`);
      } else {
        alert("Action not supported in offline sandbox mode.");
      }
    }
  };

  // Handle saving modified basic profile details (Name, Email, Phone, Gender)
  const handleSaveProfileDetails = () => {
    if (student && onUpdateStudent) {
      onUpdateStudent(student.enrNumber, {
        name: editName,
        gender: editGender,
        email: editEmail,
        phone: editPhone,
      });
      setIsEditingProfile(false);
      alert(`Profile details updated successfully for ${editName}!`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="student-profiles-section">
      {/* Student List Sidebar */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-4 h-[calc(100vh-220px)] overflow-y-auto">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 px-2 text-sm uppercase tracking-wider text-gray-400">
          Student Profiles
        </h3>
        <div className="space-y-1.5">
          {students.map((s) => {
            const isSelected = s.id === selectedStudentId;
            return (
              <button
                key={s.enrNumber}
                onClick={() => setSelectedStudentId(s.id)}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
                id={`profile-sidebar-${s.enrNumber}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs ${
                  isSelected ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {s.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{s.name}</div>
                  <div className={`text-xs ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>
                    ID: {s.enrNumber}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Profile Detail Content */}
      {student && stats && (
        <div className="lg:col-span-2 space-y-6">
          {/* Cover Header Card */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-600" />
            <div className="p-6 relative">
              {/* Profile Pic overlap */}
              <div className="absolute -top-12 left-6 w-20 h-20 rounded-full border-4 border-white bg-indigo-50 flex items-center justify-center font-bold text-2xl text-indigo-700 shadow-sm">
                {student.name.split(' ').map((n) => n[0]).join('')}
              </div>

              {isEditingProfile ? (
                /* Edit Mode form */
                <div className="pt-6 space-y-4">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide">Edit Student Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Student Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Gender</label>
                      <select
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value as 'M' | 'F')}
                        className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={() => setIsEditingProfile(false)}
                      className="px-4 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfileDetails}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save size={13} />
                      Save Details
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
                  <div className="pl-24 pt-1 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        {student.name}
                        <button
                          onClick={() => {
                            setEditName(student.name);
                            setEditGender(student.gender);
                            setEditEmail(student.email || '');
                            setEditPhone(student.phone || '');
                            setIsEditingProfile(true);
                          }}
                          className="p-1 text-gray-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-gray-50 cursor-pointer"
                          title="Edit student profile details"
                          id={`edit-profile-btn-${student.enrNumber}`}
                        >
                          <User size={14} />
                        </button>
                      </h2>
                      <p className="text-sm font-mono text-gray-400">Enrollment ID: {student.enrNumber} • Gender: {student.gender}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        stats.attendanceRate >= 90 ? 'bg-emerald-100 text-emerald-800' :
                        stats.attendanceRate >= 75 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {stats.attendanceRate}% Attendance Rate
                      </span>
                    </div>
                  </div>

                  {/* Contact Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-6 border-t border-gray-100 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-gray-400" />
                      <span>{student.email || 'No email registered'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-gray-400" />
                      <span>{student.phone || 'No phone registered'}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 text-center shadow-2xs">
              <span className="text-xs font-semibold text-gray-400 block uppercase mb-1">Active Periods</span>
              <span className="text-2xl font-bold text-gray-800">{stats.activeDays} days</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 text-center shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-400 block uppercase mb-1">Days Present</span>
                <span className="text-2xl font-bold text-emerald-600">
                  {stats.totalPresent + stats.totalLate - stats.absentDueToLate} days
                </span>
              </div>
              <span className="text-[10px] text-gray-400 mt-1 block">
                {stats.totalPresent} raw + {stats.totalLate - stats.absentDueToLate} lates
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 text-center shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-400 block uppercase mb-1">Days Late</span>
                <span className="text-2xl font-bold text-amber-600">{stats.totalLate} days</span>
              </div>
              <span className="text-[10px] text-amber-700 font-medium mt-1 block">
                {stats.absentDueToLate > 0 ? `Penalty: -${stats.absentDueToLate} absent day${stats.absentDueToLate > 1 ? 's' : ''}` : 'No absence penalty yet'}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 text-center shadow-2xs">
              <span className="text-xs font-semibold text-gray-400 block uppercase mb-1">Max Streak</span>
              <span className="text-2xl font-bold text-indigo-600 flex items-center justify-center gap-1">
                <TrendingUp size={18} />
                {stats.maxStreak}
              </span>
            </div>
          </div>

          {/* AI/Smart Engagement Insight Card */}
          {engagementInsight && (
            <div className={`border p-5 rounded-xl flex items-start gap-4 ${engagementInsight.color}`}>
              <div className="p-2 bg-white rounded-lg shadow-2xs mt-0.5">
                {engagementInsight.icon}
              </div>
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-sm uppercase tracking-wide">
                  <Sparkles size={14} className="animate-pulse" />
                  Smart Insight: {engagementInsight.level}
                </div>
                <p className="text-sm leading-relaxed">{engagementInsight.suggestion}</p>
              </div>
            </div>
          )}

          {/* Notes & Teacher Remarks Editor */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 space-y-4 shadow-2xs">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider text-gray-400">
              <FileText size={16} />
              Teacher Remarks & Individual Accommodations
            </h3>
            
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Record specific attendance notes, accommodations, parent check-ins or excused period details here..."
              className="w-full h-24 border border-gray-200 rounded-lg p-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-all resize-none"
              id="notes-editor-textarea"
            />
            
            <div className="flex justify-end">
              <button
                onClick={handleSaveNotes}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                id="save-notes-btn"
              >
                <Save size={16} />
                Save Student Remarks
              </button>
            </div>
          </div>

          {/* Student Opinion & Self-Reflection Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 space-y-4 shadow-2xs" id="opinion-editor-card">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider text-gray-400">
              <Sparkles size={16} className="text-amber-500" />
              Student Opinion & Self-Reflection Feedback
            </h3>
            
            <textarea
              value={opinionText}
              onChange={(e) => setOpinionText(e.target.value)}
              placeholder="Add or edit student's custom opinions, feedback, class suggestions, or personal career/learning goals..."
              className="w-full h-24 border border-gray-200 rounded-lg p-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-all resize-none"
              id="opinion-editor-textarea"
            />
            
            <div className="flex justify-end">
              <button
                onClick={handleSaveOpinion}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-sm flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                id="save-opinion-btn"
              >
                <Save size={16} />
                Save Student Opinion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
