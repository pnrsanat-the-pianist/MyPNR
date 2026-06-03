
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, CheckCircle2, XCircle, AlertCircle, 
  ChevronDown, ChevronRight, Clock, ShieldCheck,
  X, MessageSquare, CalendarPlus,
  Layers, Calendar, Trash2, GraduationCap, RefreshCcw, AlertTriangle,
  History, Archive
} from 'lucide-react';
import { UserRole } from '../../types';
import { supabase } from '../../lib/supabaseClient';

// --- Types ---

type AttendanceStatus = 'present' | 'absent' | 'makeup_needed' | 'pending';

interface AttendanceRecord {
  id: string;
  lessonNumber: number;
  date: string;
  time: string;
  status: AttendanceStatus;
  note?: string;
  isMakeup?: boolean;
  isApproved: boolean; 
  originalDate?: string;
  originalTime?: string;
}

interface ScheduleSlot {
    dayIndex: number; // 0=Sunday, 1=Monday...
    time: string;
}

interface StudentPeriod {
  id: string; // instrument_periods.id
  studentId: string;
  studentName: string;
  subBranch: string;
  teacher: string;
  studentStatus: 'active' | 'inactive' | 'passive' | string;
  periodStatus: 'active' | 'completed' | 'cancelled' | string;
  periodNumber: number;
  startDate: string;
  isApproved: boolean; 
  weeklyLessonCount: number;
  scheduleConfig: ScheduleSlot[];
  records: AttendanceRecord[];
  isPlaceholder?: boolean;
  archivePeriods?: StudentPeriod[];
}

interface InstrumentLessonsProps {
  currentUserRole: UserRole;
  canEdit: boolean; // Received from App.tsx
}

// --- Constants ---
const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; icon: any }> = {
  present: { 
    label: 'Tamamlandı', 
    color: 'bg-green-100 text-green-700 border-green-200', 
    icon: CheckCircle2 
  },
  makeup_needed: { 
    label: 'Telafi', 
    color: 'bg-orange-100 text-orange-700 border-orange-200', 
    icon: AlertCircle 
  },
  absent: { 
    label: 'Gelmedi', 
    color: 'bg-red-100 text-red-700 border-red-200', 
    icon: XCircle 
  },
  pending: { 
    label: 'Bekliyor', 
    color: 'bg-white text-slate-400 border-slate-200 border-dashed', 
    icon: Clock 
  },
};

const MAKEUP_REASONS = [
  "1 Ders Telafi Hakkı",
  "Resmi Tatil",
  "Ders Yapılamadı"
];

const DAYS = [
    { label: 'Pazar', value: 0 },
    { label: 'Pazartesi', value: 1 },
    { label: 'Salı', value: 2 },
    { label: 'Çarşamba', value: 3 },
    { label: 'Perşembe', value: 4 },
    { label: 'Cuma', value: 5 },
    { label: 'Cumartesi', value: 6 },
];

const MAKEUP_TIMES = Array.from({ length: 13 }, (_, index) => `${String(index + 9).padStart(2, '0')}:00`);

const InstrumentLessons: React.FC<InstrumentLessonsProps> = ({ currentUserRole, canEdit }) => {
  const [periods, setPeriods] = useState<StudentPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [showPassive, setShowPassive] = useState(false);
  
  // Selection State
  const [selectedCell, setSelectedCell] = useState<{periodId: string, recordId: string} | null>(null);

  // Modals
  const [noteModal, setNoteModal] = useState<{periodId: string, recordId: string, reason: string} | null>(null);
  const [makeupModal, setMakeupModal] = useState<{periodId: string, sourceRecordId: string} | null>(null);
  
  // Schedule Modal State
  const [scheduleModal, setScheduleModal] = useState<{
    mode: 'current' | 'next';
    periodId: string;
    studentId: string;
    studentName: string;
    periodNumber: number;
    startDate: string;
  } | null>(null);
  const [scheduleForm, setScheduleForm] = useState<{count: number, slots: ScheduleSlot[]}>({ count: 1, slots: [{dayIndex: 1, time: '10:00'}] });

  const [newMakeup, setNewMakeup] = useState({ date: '', time: '' });

  // --- Logic ---

  const isManager = [UserRole.ADMIN, UserRole.KURUCU, UserRole.MUDUR].includes(currentUserRole);
  const canApprove = currentUserRole === UserRole.MUDUR;

  // --- 1. FETCH REAL DATA FROM DB ---
  const fetchData = async () => {
    setLoading(true);
    try {
        let periodQuery = supabase
            .from('instrument_periods')
            .select(`
                *,
                students (
                    id, full_name, sub_branch, teacher, status
                ),
                instrument_attendance (
                    id, week_number, lesson_date, status, notes
                )
            `)
            .order('start_date', { ascending: false });

        periodQuery = showArchive
            ? periodQuery.in('status', ['active', 'completed'])
            : periodQuery.eq('status', 'active');

        const { data, error } = await periodQuery;

        if (error) throw error;

        if (data) {
            const mappedPeriods: StudentPeriod[] = data
                .filter((p: any) => p.students)
                .map((p: any) => {
                    const sortedRecords = (p.instrument_attendance || []).sort((a: any, b: any) => a.week_number - b.week_number);
                    const scheduleConfig = p.schedule_config || [];
                    const defaultLessonTime = scheduleConfig[0]?.time || '00:00';
                    
                    return {
                        id: p.id,
                        studentId: p.students.id,
                        studentName: p.students.full_name,
                        subBranch: p.students.sub_branch || 'Genel',
                        teacher: p.students.teacher || 'Atanmamış',
                        studentStatus: p.students.status || 'active',
                        periodStatus: p.status || 'active',
                        periodNumber: p.period_number,
                        startDate: p.start_date,
                        isApproved: p.is_approved,
                        weeklyLessonCount: p.weekly_lesson_count || 1,
                        scheduleConfig, // array of slots
                        records: sortedRecords.map((r: any) => ({
                            id: r.id,
                            lessonNumber: r.week_number,
                            date: r.lesson_date,
                            time: defaultLessonTime,
                            status: r.status === 'excused' || r.status === 'makeup' ? 'makeup_needed' : (r.status as AttendanceStatus),
                            note: r.notes,
                            isMakeup: r.status === 'makeup' || (r.status === 'pending' && Boolean(r.notes)),
                            isApproved: false
                        }))
                    };
            });

            {
                const { data: studentData, error: studentError } = await supabase
                    .from('students')
                    .select('id, full_name, main_branch, sub_branch, teacher, status, start_date')
                    .in('status', ['active', 'inactive', 'passive'])
                    .order('sub_branch')
                    .order('full_name');

                if (studentError) throw studentError;

                const instrumentStudents = (studentData || []).filter((student: any) =>
                    String(student.main_branch || '').toLocaleLowerCase('tr-TR').includes('enstrüman')
                    || String(student.main_branch || '').toLocaleLowerCase('tr-TR').includes('enstruman')
                );

                const studentsById = new Map(instrumentStudents.map((student: any) => [student.id, student]));
                const periodsWithCurrentStudents = mappedPeriods.map(period => {
                    const student: any = studentsById.get(period.studentId);
                    if (!student) return period;

                    return {
                        ...period,
                        studentName: student.full_name,
                        subBranch: student.sub_branch || period.subBranch || 'Genel',
                        teacher: student.teacher || period.teacher || 'Atanmamış',
                        studentStatus: student.status || period.studentStatus || 'active'
                    };
                });

                const activePeriodsByStudentId = new Map(
                    periodsWithCurrentStudents
                        .filter(period => period.periodStatus === 'active')
                        .map(period => [period.studentId, period])
                );

                const activeOrPlaceholderPeriods: StudentPeriod[] = instrumentStudents.map((student: any) => {
                    const existingPeriod = activePeriodsByStudentId.get(student.id);
                    if (existingPeriod) {
                        return {
                            ...existingPeriod,
                            studentName: student.full_name,
                            subBranch: student.sub_branch || existingPeriod.subBranch || 'Genel',
                            teacher: student.teacher || existingPeriod.teacher || 'Atanmamış',
                            studentStatus: student.status || existingPeriod.studentStatus || 'active'
                        };
                    }

                    return {
                        id: `new-${student.id}`,
                        studentId: student.id,
                        studentName: student.full_name,
                        subBranch: student.sub_branch || 'Genel',
                        teacher: student.teacher || 'Atanmamış',
                        studentStatus: student.status || 'active',
                        periodStatus: 'active',
                        periodNumber: 1,
                        startDate: student.start_date || new Date().toISOString().split('T')[0],
                        isApproved: false,
                        weeklyLessonCount: 1,
                        scheduleConfig: [],
                        records: [],
                        isPlaceholder: true
                    };
                });

                if (showArchive) {
                    const placeholderPeriods = activeOrPlaceholderPeriods.filter(period => period.isPlaceholder);
                    setPeriods([...periodsWithCurrentStudents, ...placeholderPeriods]);
                } else {
                    setPeriods(activeOrPlaceholderPeriods);
                }
            }
        }
    } catch (err: any) {
        console.error("Attendance Fetch Error:", err);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [showArchive]);

  const groupedPeriods = useMemo(() => {
    const groups: Record<string, StudentPeriod[]> = {};
    const normalize = (value: string) => value.toLocaleLowerCase('tr-TR');
    const filtered = periods
      .filter(p => showPassive || !['inactive', 'passive'].includes(p.studentStatus))
      .filter(p => 
          normalize(p.studentName).includes(normalize(searchTerm)) ||
          normalize(p.teacher).includes(normalize(searchTerm)) ||
          normalize(p.subBranch).includes(normalize(searchTerm))
      )
      .sort((a, b) =>
          a.teacher.localeCompare(b.teacher, 'tr-TR') ||
          a.studentName.localeCompare(b.studentName, 'tr-TR') ||
          a.subBranch.localeCompare(b.subBranch, 'tr-TR')
      );

    const periodsByStudent = new Map<string, StudentPeriod[]>();
    filtered.forEach(p => {
        const studentPeriods = periodsByStudent.get(p.studentId) || [];
        studentPeriods.push(p);
        periodsByStudent.set(p.studentId, studentPeriods);
    });

    const collapsedPeriods = Array.from(periodsByStudent.values()).map((studentPeriods) => {
        const activePeriod = studentPeriods.find(p => p.periodStatus === 'active');
        const archivePeriods = studentPeriods
            .filter(p => p.periodStatus === 'completed')
            .sort((a, b) => b.periodNumber - a.periodNumber || new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

        if (activePeriod) return { ...activePeriod, archivePeriods };

        const fallbackPeriod = archivePeriods[0] || studentPeriods[0];
        return {
            ...fallbackPeriod,
            id: `archive-${fallbackPeriod.studentId}`,
            records: [],
            archivePeriods
        };
    }).sort((a, b) =>
        a.teacher.localeCompare(b.teacher, 'tr-TR') ||
        a.studentName.localeCompare(b.studentName, 'tr-TR') ||
        a.subBranch.localeCompare(b.subBranch, 'tr-TR')
    );

    collapsedPeriods.forEach(p => {
        const teacherKey = p.teacher || 'Atanmamış';
        if (!groups[teacherKey]) groups[teacherKey] = [];
        groups[teacherKey].push(p);
    });
    const sortedGroups: Record<string, StudentPeriod[]> = {};
    Object.keys(groups).sort((a, b) => a.localeCompare(b, 'tr-TR')).forEach(key => { sortedGroups[key] = groups[key]; });
    return sortedGroups;
  }, [periods, searchTerm, showPassive]);

  // --- ACTIONS ---

  const toggleRow = (id: string) => {
    setExpandedRows(prev => prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]);
  };

  // DB UPDATE: Update Status
  const handleStatusSelect = async (periodId: string, recordId: string, newStatus: AttendanceStatus) => {
    if (!canEdit) return; // Permission check

    if (newStatus === 'makeup_needed') {
        const record = periods.find(p => p.id === periodId)?.records.find(r => r.id === recordId);
        const existingNote = record?.note || '';
        const isPreset = MAKEUP_REASONS.includes(existingNote);
        setNoteModal({ 
            periodId, 
            recordId, 
            reason: isPreset ? existingNote : MAKEUP_REASONS[0]
        });
        setSelectedCell(null); 
    } else {
        await updateRecordDB(periodId, recordId, { status: newStatus, note: null });
        setSelectedCell(null);
    }
  };

  // Generic DB Update Helper
  const updateRecordDB = async (periodId: string, recordId: string, updates: Partial<AttendanceRecord> | any) => {
    if (!canEdit) return; // Permission check

    // 1. Optimistic Update
    setPeriods(prev => prev.map(p => {
      if (p.id === periodId) {
        const newRecords = p.records.map(r => {
          if (r.id === recordId) return { ...r, ...updates };
          return r;
        });
        return { ...p, records: newRecords };
      }
      return p;
    }));

    // 2. DB Update
    try {
        const dbUpdates: any = {};
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.note !== undefined) dbUpdates.notes = updates.note;
        if (updates.date) dbUpdates.lesson_date = updates.date;

        if (Object.keys(dbUpdates).length === 0) return;

        const { error } = await supabase
            .from('instrument_attendance')
            .update(dbUpdates)
            .eq('id', recordId);
        
        if (error) throw error;
    } catch (err: any) {
        console.error("Update Error:", err);
        fetchData(); // Revert on error
    }
  };

  const toggleRecordApproval = (periodId: string, recordId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canApprove || !canEdit) return;

    const period = periods.find(p => p.id === periodId);
    const record = period?.records.find(r => r.id === recordId);
    if (record) updateRecordDB(periodId, recordId, { isApproved: !record.isApproved });
  };

  const saveNote = async () => {
    if (noteModal && canEdit) {
        const finalNote = noteModal.reason;
        await updateRecordDB(noteModal.periodId, noteModal.recordId, { status: 'makeup_needed', note: finalNote });
        setMakeupModal({ periodId: noteModal.periodId, sourceRecordId: noteModal.recordId });
        setNoteModal(null);
    }
  };

  const saveMakeup = async () => {
    if (makeupModal && newMakeup.date && newMakeup.time && canEdit) {
        const period = periods.find(p => p.id === makeupModal.periodId);
        const record = period?.records.find(r => r.id === makeupModal.sourceRecordId);
        
        if (record) {
            const makeupReason = record.note || 'Belirtilmedi';
            await updateRecordDB(makeupModal.periodId, makeupModal.sourceRecordId, {
                status: 'pending',
                note: makeupReason,
                isMakeup: true,
                isApproved: false,
                originalDate: record.date,
                date: newMakeup.date,
                time: newMakeup.time
            });
        }
        setMakeupModal(null);
        setNewMakeup({ date: '', time: '' });
    } else {
        alert('Lütfen tarih ve saat seçiniz.');
    }
  };

  // --- SCHEDULE LOGIC ---
  // ... (Helper functions remain same) ...
  const addDays = (dateStr: string, days: number) => {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + days);
      return date.toISOString().split('T')[0];
  };

  const getCompletedLessonCount = (records: AttendanceRecord[]) =>
      records.filter(record => record.status === 'present' || record.status === 'absent').length;

  const isPeriodComplete = (records: AttendanceRecord[]) => getCompletedLessonCount(records) >= 10;
  const areAllLessonsApproved = (records: AttendanceRecord[]) => records.length >= 10 && records.every(record => record.isApproved);

  const getNextPeriodStartDate = (period: StudentPeriod) => {
      const sortedRecords = [...period.records].sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime() || a.lessonNumber - b.lessonNumber
      );
      const lastRecord = sortedRecords[sortedRecords.length - 1];
      return lastRecord ? addDays(lastRecord.date, 7) : addDays(period.startDate, 70);
  };

  const handleOpenScheduleModal = async (period: StudentPeriod) => {
      let periodId = period.id;
      const mode: 'current' | 'next' = period.records.length > 0 ? 'next' : 'current';

      if (mode === 'next' && !areAllLessonsApproved(period.records)) return;

      if (period.isPlaceholder) {
          const { data, error } = await supabase
              .from('instrument_periods')
              .insert({
                  name: `${period.studentName} - 1. Periyot`,
                  student_id: period.studentId,
                  period_number: 1,
                  start_date: period.startDate,
                  end_date: addDays(period.startDate, 63),
                  lesson_time: '10:00',
                  status: 'active',
                  weekly_lesson_count: 1,
                  schedule_config: []
              })
              .select('id')
              .single();

          if (error) {
              alert('Periyot oluşturulamadı: ' + error.message);
              return;
          }

          periodId = data.id;
          setPeriods(prev => prev.map(item => item.id === period.id ? { ...item, id: periodId, isPlaceholder: false } : item));
          setExpandedRows(prev => prev.map(id => id === period.id ? periodId : id));
      }

      const startDate = mode === 'next' ? getNextPeriodStartDate(period) : period.startDate;
      setScheduleModal({
          mode,
          periodId,
          studentId: period.studentId,
          studentName: period.studentName,
          periodNumber: period.periodNumber,
          startDate
      });
      const startDayIndex = new Date(startDate).getDay();
      if (period.scheduleConfig && period.scheduleConfig.length > 0) {
          setScheduleForm({ count: 1, slots: [{ ...period.scheduleConfig[0], dayIndex: startDayIndex }] });
      } else {
          setScheduleForm({ count: 1, slots: [{ dayIndex: startDayIndex, time: '10:00' }] });
      }
  };

  const updateSlotCount = (count: number) => {
      const currentSlots = [...scheduleForm.slots];
      if (count > currentSlots.length) {
          for(let i = currentSlots.length; i < count; i++) currentSlots.push({ dayIndex: 1, time: '10:00' });
      } else {
          currentSlots.length = count;
      }
      setScheduleForm({ count, slots: currentSlots });
  };

  const updateSlot = (index: number, field: keyof ScheduleSlot, value: any) => {
      const newSlots = [...scheduleForm.slots];
      newSlots[index] = { ...newSlots[index], [field]: value };
      setScheduleForm({ ...scheduleForm, slots: newSlots });
  };

  const calculateLessons = (startDateStr: string, slots: ScheduleSlot[], count = 10, startLessonNumber = 1) => {
      if (!startDateStr) return [];
      const generated: { date: string, time: string, lessonNo: number }[] = [];
      const firstSlot = slots[0] || { dayIndex: new Date(startDateStr).getDay(), time: '10:00' };

      for (let i = 0; i < count; i++) {
          const lessonDate = new Date(startDateStr);
          lessonDate.setDate(lessonDate.getDate() + (i * 7));
          generated.push({ date: lessonDate.toISOString().split('T')[0], time: firstSlot.time, lessonNo: startLessonNumber + i });
      }

      return generated;
  };

  const saveSchedule = async () => {
      if (!scheduleModal || !canEdit) return;

      const nextPeriodNumber = scheduleModal.mode === 'next' ? scheduleModal.periodNumber + 1 : scheduleModal.periodNumber;
      const newLessons = calculateLessons(scheduleModal.startDate, scheduleForm.slots, 10, 1);
       
      try {
          let targetPeriodId = scheduleModal.periodId;

          if (scheduleModal.mode === 'next') {
              const { data: newPeriod, error: insertPeriodError } = await supabase
                  .from('instrument_periods')
                  .insert({
                      name: `${scheduleModal.studentName} - ${nextPeriodNumber}. Periyot`,
                      student_id: scheduleModal.studentId,
                      period_number: nextPeriodNumber,
                      start_date: scheduleModal.startDate,
                      end_date: addDays(scheduleModal.startDate, 63),
                      lesson_time: scheduleForm.slots[0]?.time || '10:00',
                      status: 'active',
                      weekly_lesson_count: scheduleForm.count,
                      schedule_config: scheduleForm.slots
                  })
                  .select('id')
                  .single();

              if (insertPeriodError) throw insertPeriodError;

              targetPeriodId = newPeriod.id;

              const { error: closePeriodError } = await supabase
                  .from('instrument_periods')
                  .update({ status: 'completed', is_approved: true })
                  .eq('id', scheduleModal.periodId);

              if (closePeriodError) throw closePeriodError;
          } else {
              const { error: updatePeriodError } = await supabase.from('instrument_periods').update({
                  name: `${scheduleModal.studentName} - ${nextPeriodNumber}. Periyot`,
                  start_date: scheduleModal.startDate,
                  end_date: addDays(scheduleModal.startDate, 63),
                  lesson_time: scheduleForm.slots[0]?.time || '10:00',
                  weekly_lesson_count: scheduleForm.count,
                  schedule_config: scheduleForm.slots
              }).eq('id', scheduleModal.periodId);

              if (updatePeriodError) throw updatePeriodError;
          }

          await supabase.from('instrument_attendance').delete().eq('period_id', targetPeriodId);

          const recordsToInsert = newLessons.map(l => ({
              period_id: targetPeriodId,
              student_id: scheduleModal.studentId,
              week_number: l.lessonNo,
              lesson_date: l.date,
              status: 'pending'
          }));

          const { error } = await supabase.from('instrument_attendance').insert(recordsToInsert);
          if (error) throw error;

          setScheduleModal(null);
          fetchData();
      } catch (err: any) {
          alert("Planlama hatası: " + err.message);
      }
  };

  const handleEndLessons = async (periodId: string) => {
      if (!canEdit) return;
      if(!confirm("Dersleri sonlandırmaya emin misiniz?")) return;

      try {
          const { error: updateError } = await supabase.from('instrument_periods').update({ status: 'completed', is_approved: true }).eq('id', periodId);
          if (updateError) throw updateError;

          fetchData();
      } catch (err: any) {
          console.error("End Lessons Error:", err);
          alert("İşlem sırasında hata oluştu: " + err.message);
      }
  };

  const getStats = (records: AttendanceRecord[]) => {
    const present = getCompletedLessonCount(records);
    const absent = records.filter(r => r.status === 'absent').length;
    return { present, absent };
  };
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display flex items-center gap-2">
            Yoklama (Enstrüman)
            {showArchive && (
                <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md font-sans font-medium flex items-center gap-1">
                    <History size={12}/> Arşiv Dahil
                </span>
            )}
          </h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">
            Enstrüman öğretmenleri ve onlara kayıtlı öğrenciler alfabetik listelenir; her periyot 10 haftalık 10 dersten oluşur.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl h-[42px] shrink-0">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1"><Archive size={14} /> Arşivi Göster</span>
                <button
                  type="button"
                  onClick={() => setShowArchive(prev => !prev)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${showArchive ? 'bg-pnr-purple' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showArchive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl h-[42px] shrink-0">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Pasifleri Göster</span>
                <button
                  type="button"
                  onClick={() => setShowPassive(prev => !prev)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${showPassive ? 'bg-pnr-purple' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showPassive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <div className="relative w-full md:w-64 h-[42px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
              <input 
                type="text" 
               placeholder="Öğrenci, Öğretmen veya Branş..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-10 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple"
              />
           </div>
        </div>
      </div>

      {loading && <div className="text-center py-10 text-slate-500">Veriler yükleniyor...</div>}

      {!loading && Object.keys(groupedPeriods).length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-pnr-card rounded-2xl border border-slate-200 dark:border-slate-800">
             <Layers size={48} className="text-slate-300 mx-auto mb-3" />
             <p className="text-slate-500 font-medium">Bu kriterlere uygun kayıt bulunamadı.</p>
          </div>
      )}

      {/* Grouped Lists */}
      {!loading && Object.entries(groupedPeriods).map(([teacherName, teacherPeriods]) => (
        <div key={teacherName} className="space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-200 dark:border-slate-800 mt-6">
                  <div className="w-8 h-8 rounded-lg bg-pnr-purple/10 text-pnr-purple flex items-center justify-center">
                     <GraduationCap size={18} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-wider">
                      {teacherName} <span className="text-slate-400 text-sm ml-2 font-normal">({(teacherPeriods as StudentPeriod[]).length} Öğrenci)</span>
                  </h2>
            </div>

            {(teacherPeriods as StudentPeriod[]).map((period) => {
                const stats = getStats(period.records);
                const isExpanded = expandedRows.includes(period.id);
                const sortedRecords = [...period.records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.lessonNumber - b.lessonNumber);
                const isFullyApproved = period.isApproved;
                const archivePeriods = period.archivePeriods || [];
                const hasNoRecords = period.records.length === 0 && archivePeriods.length === 0;
                const isArchived = period.periodStatus === 'completed';
                const isActivePeriod = period.periodStatus === 'active';
                const canPlanNextPeriod = isActivePeriod && !hasNoRecords && areAllLessonsApproved(period.records) && !period.isApproved;

                return (
                    <div key={period.id} className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                    
                    <div onClick={() => toggleRow(period.id)} className={`p-4 flex flex-col md:flex-row md:items-center gap-4 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded-2xl'}`}>
                        <div className="flex items-center gap-4 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-lg ${isArchived ? 'bg-slate-400 text-white' : 'bg-gradient-to-br from-pnr-blue to-cyan-500 text-white shadow-pnr-blue/20'}`}>
                            {period.studentName.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <h3 className={`font-bold text-base flex items-center ${isArchived ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                {period.studentName}
                                {['inactive', 'passive'].includes(period.studentStatus) && <span className="ml-2 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">Pasif</span>}
                                {isArchived && <span className="ml-2 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">Arşiv</span>}
                                {hasNoRecords && isActivePeriod && <div className="ml-2 group relative" title="Ders programı oluşturulmamış"><AlertTriangle className="text-red-500 animate-pulse" size={18} /></div>}
                            </h3>
                             <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                 <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium">{period.subBranch}</span>
                             </div>
                        </div>
                        </div>

                        <div className="flex items-center gap-6 md:pr-8">
                        <div className="text-center hidden sm:block">
                            <div className="text-[10px] text-slate-400 uppercase font-bold">Periyot</div>
                            <div className="font-mono text-slate-700 dark:text-slate-300 font-bold">{period.periodNumber}. Dönem</div>
                        </div>
                        
                        <div className="flex gap-2 text-xs">
                            <div className="px-2 py-1 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800 font-mono font-bold">
                                {stats.present}/10
                            </div>
                        </div>

                        {isFullyApproved ? (
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full text-xs font-bold border border-green-100 dark:border-green-800">
                                <ShieldCheck size={14} /> <span className="hidden sm:inline">Onay Tamamlandı</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full text-xs font-bold border border-amber-100 dark:border-amber-800">
                                <Clock size={14} /> <span className="hidden sm:inline">Onay Bekleniyor</span>
                            </div>
                        )}

                        {isExpanded ? <ChevronDown className="text-slate-400" /> : <ChevronRight className="text-slate-400" />}
                        </div>
                    </div>

                    {isExpanded && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 animate-in slide-in-from-top-2 rounded-b-2xl">
                        {hasNoRecords ? (
                            <div className="text-center py-8">
                                <div className="text-red-500 flex flex-col items-center gap-2 mb-2"><AlertCircle size={32} /><p className="font-bold">Ders Programı Eksik!</p></div>
                                <p className="text-slate-500 mb-2">Bu öğrenci için henüz ders programı oluşturulmamış.</p>
                                {isActivePeriod && canEdit && (
                                    <button onClick={() => handleOpenScheduleModal(period)} className="bg-pnr-purple text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg hover:bg-pnr-indigo">Dersleri Oluştur</button>
                                )}
                            </div>
                        ) : (
                            <>
                            {period.records.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3 pb-8 items-start">
                                {sortedRecords.map((record, index) => {
                                    const config = STATUS_CONFIG[record.status];
                                    const Icon = config.icon;
                                    const isEditing = selectedCell?.periodId === period.id && selectedCell?.recordId === record.id;
                                    const isBottomRow = index > 4; 
                                    const hideLessonNumber = record.status === 'makeup_needed';
                                    const isRecordLocked = record.isApproved;
                                    const canInteract = isActivePeriod && !isRecordLocked && (isManager || !record.isApproved) && canEdit; 

                                    return (
                                    <div key={record.id} className="relative group flex flex-col gap-2">
                                        <div 
                                        onClick={() => canInteract && setSelectedCell(selectedCell?.recordId === record.id ? null : { periodId: period.id, recordId: record.id })}
                                        className={`
                                            flex flex-col items-center justify-center rounded-xl border transition-all min-h-[10rem] relative overflow-hidden
                                            ${config.color}
                                            ${!canInteract ? 'opacity-90 cursor-not-allowed ring-1 ring-slate-200 dark:ring-slate-700' : 'cursor-pointer hover:shadow-md hover:scale-[1.02]'}
                                            ${isEditing ? 'ring-2 ring-pnr-purple ring-offset-2 dark:ring-offset-pnr-dark z-10' : 'z-0'}
                                        `}
                                        > 
                                        <div 
                                            onClick={(e) => toggleRecordApproval(period.id, record.id, e)}
                                            className={`
                                                w-full py-1 text-[9px] font-bold text-center uppercase tracking-wider flex items-center justify-center gap-1 transition-colors
                                                ${record.isApproved ? 'bg-green-600 text-white' : 'bg-black/5 dark:bg-white/5 text-slate-500 hover:bg-black/10'}
                                                ${canApprove && isActivePeriod && canEdit ? 'cursor-pointer' : 'cursor-default'}
                                            `}
                                        >
                                            {record.isApproved ? (<><ShieldCheck size={10} /> Onaylı</>) : (<>Onay Bekliyor</>)}
                                        </div>

                                        <div className="flex-1 flex flex-col items-center justify-center p-3 w-full">
                                            <div className="flex items-center gap-1 mb-1 h-4">
                                                {record.isMakeup ? <span className="text-xs font-bold text-pnr-purple uppercase tracking-wider">Telafi</span> : !hideLessonNumber ? <span className="text-[10px] font-bold opacity-60 uppercase">{record.lessonNumber}. Ders</span> : null}
                                            </div>
                                            <div className="font-mono text-sm font-bold mb-2 flex gap-1.5 items-center">
                                                <span>{formatDate(record.date)}</span>
                                                <span className="opacity-70 text-xs font-normal">{record.time}</span>
                                            </div>
                                            <Icon size={24} className="mb-1" />
                                            <span className="text-[9px] font-bold text-center leading-tight px-1 line-clamp-3">{config.label}</span>
                                            {record.isMakeup && (record.originalDate || record.note) && (
                                                <div className="mt-2 w-full bg-orange-50 border border-orange-100 rounded-lg p-1.5 text-[9px] text-orange-800 leading-tight flex flex-col gap-0.5">
                                                    {record.originalDate && <div className="font-bold">{formatDate(record.originalDate)}</div>}
                                                    <div className="opacity-80">Nedeni: {record.note || 'Belirtilmedi'}</div>
                                                </div>
                                            )}
                                        </div>
                                        </div>

                                        {record.note && !record.isMakeup && (
                                            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-[10px] text-slate-600 dark:text-slate-300 leading-tight shadow-sm">
                                                <div className="flex items-center gap-1 mb-0.5 font-bold text-pnr-purple"><MessageSquare size={10} /> Telafi:</div>
                                                {record.note}
                                            </div>
                                        )}

                                        {record.status === 'makeup_needed' && !record.isMakeup && isActivePeriod && canEdit && isManager && (
                                            <div className="mt-1">
                                                <button onClick={() => setMakeupModal({ periodId: period.id, sourceRecordId: record.id })} className="w-full bg-white dark:bg-slate-800 border border-pnr-orange text-pnr-orange hover:bg-orange-50 dark:hover:bg-orange-900/20 text-[10px] font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm">
                                                    <CalendarPlus size={12} /> Yeni Ders Tanımla
                                                </button>
                                            </div>
                                        )}

                                        {isEditing && (
                                        <div className={`absolute left-0 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-1.5 flex flex-col gap-1 z-[60] animate-in zoom-in-95 ${isBottomRow ? 'bottom-full mb-2 origin-bottom-left' : 'top-full mt-2 origin-top-left'}`}>
                                            {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).filter(statusKey => statusKey !== 'pending').map((statusKey) => (
                                            <button key={statusKey} onClick={() => handleStatusSelect(period.id, record.id, statusKey)} className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium text-left transition-colors ${record.status === statusKey ? 'bg-pnr-purple text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                                                <div className={`w-2 h-2 rounded-full ${statusKey === record.status ? 'bg-white' : STATUS_CONFIG[statusKey].color.split(' ')[0].replace('bg-', 'bg-')}`}></div>
                                                {STATUS_CONFIG[statusKey].label}
                                            </button>
                                            ))}
                                            <button onClick={() => handleStatusSelect(period.id, record.id, 'pending')} className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium text-left transition-colors ${record.status === 'pending' ? 'bg-pnr-purple text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                                                <RefreshCcw size={12} /> Sıfırla
                                            </button>
                                        </div>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                            )}

                            {showArchive && archivePeriods.length > 0 && (
                                <div className="mt-2 mb-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/30 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold text-sm">
                                        <Archive size={16} /> Arşiv
                                    </div>
                                    <div className="p-4 space-y-5">
                                        {archivePeriods.map((archivePeriod) => (
                                            <div key={archivePeriod.id} className="space-y-3">
                                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{archivePeriod.periodNumber}. Periyot</div>
                                                    <div className="text-[10px] text-slate-400">Başlangıç: {formatDate(archivePeriod.startDate)}</div>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3 items-start">
                                                    {[...archivePeriod.records]
                                                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.lessonNumber - b.lessonNumber)
                                                        .map((record) => {
                                                            const config = STATUS_CONFIG[record.status];
                                                            const Icon = config.icon;
                                                            return (
                                                                <div key={record.id} className={`min-h-[7rem] rounded-xl border p-3 flex flex-col items-center justify-center text-center ${config.color} opacity-90`}>
                                                                    <span className="text-[10px] font-bold opacity-60 uppercase mb-1">{record.lessonNumber}. Ders</span>
                                                                    <div className="font-mono text-xs font-bold mb-2 flex gap-1.5 items-center">
                                                                        <span>{formatDate(record.date)}</span>
                                                                        <span className="opacity-70 font-normal">{record.time}</span>
                                                                    </div>
                                                                    <Icon size={20} className="mb-1" />
                                                                    <span className="text-[9px] font-bold leading-tight">{config.label}</span>
                                                                    {record.note && <span className="mt-1 text-[9px] opacity-80 leading-tight">{record.note}</span>}
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            </>
                        )}

                        <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-4 flex-wrap gap-4">
                            <div className="text-xs text-slate-500">
                                {isFullyApproved || isArchived ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={14}/> Periyot onaylandı</span> : <span className="flex items-center gap-1"><ShieldCheck size={14}/> 10 ders onaylandığında yeni periyot planlanabilir</span>}
                            </div>
                            <div className="flex gap-3">
                                {canPlanNextPeriod && canApprove && canEdit && (
                                    <button onClick={() => handleEndLessons(period.id)} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl font-bold text-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-colors">
                                        <Archive size={16} /> Dersleri Sonlandır
                                    </button>
                                )}
                                {canPlanNextPeriod && canApprove && canEdit && (
                                    <button onClick={() => handleOpenScheduleModal(period)} className="bg-pnr-purple hover:bg-pnr-indigo text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-pnr-purple/20 flex items-center gap-2 transition-colors">
                                        <CheckCircle2 size={16} /> Periyodu Onayla
                                    </button>
                                )}
                            </div>
                        </div>
                        </div>
                    )}
                    </div>
                );
            })}
        </div>
      ))}

      {/* SCHEDULE MODAL */}
      {scheduleModal && canEdit && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
             <div className="bg-white dark:bg-pnr-card w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                 {/* ... Modal Header ... */}
                 <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                    <div><h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Calendar className="text-pnr-purple" size={20} /> {scheduleModal.mode === 'next' ? `${scheduleModal.periodNumber + 1}. Periyot Planla` : 'Periyot Planla'}</h3><p className="text-xs text-slate-500">10 derslik periyot oluşturulacak.</p></div>
                    <button onClick={() => setScheduleModal(null)} className="text-slate-400 hover:text-slate-900"><X size={20}/></button>
                 </div>
                 
                 <div className="p-6 space-y-6">
                    <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">1. Ders Tarihi</label>
                    <input type="date" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white" value={scheduleModal.startDate} onChange={(e) => setScheduleModal({ ...scheduleModal, startDate: e.target.value })} /></div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        Seçilen ilk ders tarihi 1. ders olarak kaydedilir. Takip eden 9 haftada haftada 1 ders eklenerek toplam 10 derslik periyot oluşturulur.
                    </p>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {scheduleForm.slots.slice(0, 1).map((slot, index) => (
                            <div key={index} className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">1</div>
                                <div className="flex-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Ders Günü</label><div className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-sm dark:text-white">{DAYS[new Date(scheduleModal.startDate).getDay()]?.label || '-'}</div></div>
                                <div className="w-24"><label className="text-[10px] font-bold text-slate-400 uppercase">Saat</label><input type="time" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-sm" value={slot.time} onChange={(e) => updateSlot(index, 'time', e.target.value)} /></div>
                            </div>
                        ))}
                    </div>
                 </div>

                 <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <button onClick={() => setScheduleModal(null)} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium">İptal</button>
                    <button onClick={saveSchedule} className="px-6 py-2 bg-pnr-purple text-white rounded-lg font-bold hover:bg-pnr-indigo shadow-lg shadow-pnr-purple/20">Programı Kaydet</button>
                 </div>
             </div>
          </div>
      )}

      {/* REASON MODAL */}
      {noteModal && canEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-pnr-card w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><AlertCircle className="text-pnr-orange" size={20} /> Telafi Nedeni</h3>
                <div className="space-y-3 mb-4 mt-4">{MAKEUP_REASONS.map((reason) => (<label key={reason} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"><input type="radio" name="makeupReason" value={reason} checked={noteModal.reason === reason} onChange={(e) => setNoteModal({...noteModal, reason: e.target.value})} className="w-4 h-4 text-pnr-orange focus:ring-pnr-orange" /><span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{reason}</span></label>))}</div>
                <div className="flex justify-end gap-3"><button onClick={() => setNoteModal(null)} className="text-slate-500 text-sm font-medium">İptal</button><button onClick={saveNote} className="bg-pnr-orange text-white px-4 py-2 rounded-lg text-sm font-bold">Kaydet</button></div>
            </div>
        </div>
      )}

      {/* MAKEUP MODAL */}
      {makeupModal && canEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-pnr-card w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><CalendarPlus className="text-pnr-purple" size={20} /> Yeni Ders Tanımla</h3>
                <div className="space-y-4 mt-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tarih</label><input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border rounded-lg p-2.5 text-sm" value={newMakeup.date} onChange={(e) => setNewMakeup({...newMakeup, date: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Saat</label><select className="w-full bg-slate-50 dark:bg-slate-800 border rounded-lg p-2.5 text-sm" value={newMakeup.time} onChange={(e) => setNewMakeup({...newMakeup, time: e.target.value})}><option value="">Saat seçin</option>{MAKEUP_TIMES.map((time) => <option key={time} value={time}>{time}</option>)}</select></div>
                </div>
                <div className="flex justify-end gap-3 mt-6"><button onClick={() => setMakeupModal(null)} className="text-slate-500 text-sm font-medium">İptal</button><button onClick={saveMakeup} className="bg-pnr-purple text-white px-4 py-2 rounded-lg text-sm font-bold">Planla</button></div>
            </div>
        </div>
      )}

    </div>
  );
};

export default InstrumentLessons;
