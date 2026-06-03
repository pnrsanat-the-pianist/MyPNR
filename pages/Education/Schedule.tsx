
import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Clock, MapPin, Layers, User, Users, RefreshCcw, Cake, Plus, X, Save, AlignLeft, GraduationCap
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// --- Types ---

type ViewMode = 'week' | 'month';

interface CalendarEvent {
  id: string;
  title: string;
  subTitle: string;
  type: 'group' | 'individual' | 'birthday' | 'custom';
  date: Date;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  colorClass: string;
  location?: string;
  teacherName?: string;
  description?: string;
}

interface RawClass {
  id: string;
  name: string;
  sub_branch: string;
  schedule_config: { day: string; startTime: string; endTime: string }[];
  classroom?: string;
  classroom_id?: string | null;
  classrooms?: { name?: string } | null;
  teachers?: { name: string };
}

interface RawInstrument {
  id: string;
  student: { full_name: string; sub_branch: string; teacher: string };
  schedule_config: { dayIndex: number; time: string }[];
}

interface RawStudentBirthday {
  id: string;
  full_name: string;
  dob: string;
}

interface RawCustomEvent {
  id: string;
  title: string;
  description: string;
  start_at: string; // ISO String
  end_at: string;   // ISO String
}

// --- Constants ---

const DAYS_OF_WEEK = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const HOURS = Array.from({ length: 13 }, (_, i) => 9 + i); // 09:00 to 21:00

interface ScheduleProps {
  canEdit?: boolean;
}

const Schedule: React.FC<ScheduleProps> = ({ canEdit = true }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Raw Data
  const [danceClasses, setDanceClasses] = useState<RawClass[]>([]);
  const [instrumentPeriods, setInstrumentPeriods] = useState<RawInstrument[]>([]);
  const [studentsWithBirthday, setStudentsWithBirthday] = useState<RawStudentBirthday[]>([]);
  const [customEvents, setCustomEvents] = useState<RawCustomEvent[]>([]);

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    try {
      let classData: any[] = [];
      const { data: classDataWithClassroom, error: classError } = await supabase
        .from('dance_classes')
        .select('id, name, sub_branch, schedule_config, classroom_id, classrooms(name), teachers(name)');

      if (classError) {
        const { data: fallbackClassData, error: fallbackClassError } = await supabase
          .from('dance_classes')
          .select('id, name, sub_branch, schedule_config, teachers(name)');

        if (fallbackClassError) throw fallbackClassError;
        classData = fallbackClassData || [];
      } else {
        classData = classDataWithClassroom || [];
      }

      const { data: periodData } = await supabase
        .from('instrument_periods')
        .select(`
          id, 
          schedule_config,
          students ( full_name, sub_branch, teacher )
        `)
        .eq('status', 'active');

      const { data: studentData } = await supabase
        .from('students')
        .select('id, full_name, dob')
        .eq('status', 'active')
        .not('dob', 'is', null);

      const { data: eventData } = await supabase
        .from('calendar_events')
        .select('*');

      setDanceClasses(classData || []);
      setInstrumentPeriods((periodData || []).map((p: any) => ({
        id: p.id,
        student: p.students,
        schedule_config: p.schedule_config
      })));
      setStudentsWithBirthday(studentData || []);
      setCustomEvents(eventData || []);

    } catch (err) {
      console.error("Schedule fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  function calculateEndTime(start: string) {
    if (!start) return '00:00';
    const [h, m] = start.split(':').map(Number);
    return `${(h + 1).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const events = useMemo(() => {
    const generatedEvents: CalendarEvent[] = [];

    let startDate: Date, endDate: Date;
    if (viewMode === 'week') {
      startDate = getStartOfWeek(currentDate);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    } else {
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    }

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDayIndex = d.getDay();
      const currentDayName = DAYS_OF_WEEK[currentDayIndex];
      const dateStr = d.toISOString().split('T')[0];

      // 1. Group Classes (Bale / Dans)
      danceClasses.forEach(cls => {
        if (cls.schedule_config) {
          cls.schedule_config.forEach(slot => {
            if (slot.day === currentDayName) {
              generatedEvents.push({
                id: `cls-${cls.id}-${dateStr}`,
                title: cls.name,
                subTitle: cls.sub_branch,
                type: 'group',
                date: new Date(d),
                startTime: slot.startTime,
                endTime: slot.endTime || calculateEndTime(slot.startTime),
                colorClass: 'bg-pnr-purple/10 border-pnr-purple text-pnr-purple',
                location: cls.classrooms?.name || cls.classroom || 'Derslik seçilmedi',
                teacherName: cls.teachers?.name || 'Bilinmiyor'
              });
            }
          });
        }
      });

      // 2. Instrument Lessons (Enstrüman)
      instrumentPeriods.forEach(period => {
        if (period.schedule_config) {
          period.schedule_config.forEach(slot => {
            if (slot.dayIndex === currentDayIndex) {
              generatedEvents.push({
                id: `inst-${period.id}-${dateStr}`,
                title: period.student?.full_name || 'Öğrenci',
                subTitle: period.student?.sub_branch || 'Enstrüman',
                type: 'individual',
                date: new Date(d),
                startTime: slot.time,
                endTime: calculateEndTime(slot.time),
                colorClass: 'bg-pnr-blue/10 border-pnr-blue text-pnr-blue',
                location: 'Bireysel Oda',
                teacherName: period.student?.teacher || 'Bilinmiyor'
              });
            }
          });
        }
      });

      // 3. Birthdays
      studentsWithBirthday.forEach(student => {
        const dob = new Date(student.dob);
        if (dob.getDate() === d.getDate() && dob.getMonth() === d.getMonth()) {
          generatedEvents.push({
            id: `bday-${student.id}-${dateStr}`,
            title: student.full_name,
            subTitle: 'Doğum Günü',
            type: 'birthday',
            date: new Date(d),
            startTime: '00:00',
            endTime: '23:59',
            colorClass: 'bg-pink-100 border-pink-300 text-pink-600'
          });
        }
      });
    }
    return generatedEvents;
  }, [danceClasses, instrumentPeriods, studentsWithBirthday, customEvents, viewMode, currentDate]);

  const WeekView = () => {
    const weekStart = getStartOfWeek(currentDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[1000px] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-pnr-card shadow-sm">
          <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="p-3 text-center text-xs font-bold text-slate-400 border-r border-slate-200 dark:border-slate-800">Saat</div>
            {weekDays.map((day, i) => (
              <div key={i} className={`p-3 text-center border-r border-slate-200 dark:border-slate-800 last:border-0 ${day.toDateString() === new Date().toDateString() ? 'bg-pnr-purple/5' : ''}`}>
                <div className={`text-xs uppercase font-bold mb-1 ${day.toDateString() === new Date().toDateString() ? 'text-pnr-purple' : 'text-slate-500'}`}>{DAYS_OF_WEEK[day.getDay()]}</div>
                <div className="text-lg font-bold">{day.getDate()}</div>
              </div>
            ))}
          </div>

          <div className="relative">
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-8 min-h-[5.5rem] border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div className="border-r border-slate-200 dark:border-slate-800 p-2 text-[11px] text-slate-400 font-mono flex items-center justify-center bg-slate-50/30 dark:bg-slate-900/20">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                {weekDays.map((day, dayIdx) => {
                  const dayEvents = events.filter(e =>
                    e.type !== 'birthday' &&
                    e.date.toDateString() === day.toDateString() &&
                    parseInt(e.startTime.split(':')[0]) === hour
                  );

                  return (
                    <div key={dayIdx} className={`border-r border-slate-100 dark:border-slate-800 p-1 relative ${day.toDateString() === new Date().toDateString() ? 'bg-pnr-purple/5' : ''}`}>
                      {dayEvents.map(evt => (
                        <div
                          key={evt.id}
                          className={`mb-1 p-2 rounded-lg border-l-4 text-[10px] shadow-sm transition-all hover:shadow-md ${evt.colorClass} bg-white dark:bg-slate-800`}
                        >
                          {/* LINE 1: Title (Ders Adı or Öğrenci Adı) */}
                          <div className="font-bold truncate text-[11px] mb-1">{evt.title}</div>

                          {/* LINE 2: Subtitle/Details */}
                          <div className="flex flex-col gap-0.5 opacity-90">
                            <div className="flex items-center gap-1">
                              <Layers size={10} className="shrink-0 text-slate-400" />
                              <span className="truncate">
                                {evt.type === 'group'
                                  ? `${evt.location} / ${evt.teacherName}`
                                  : `${evt.subTitle} / ${evt.teacherName}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 font-mono text-[9px] mt-1 text-slate-500">
                              <Clock size={9} />
                              {evt.startTime} - {evt.endTime}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  }

  const handleNext = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  }

  const getWeekLabel = () => {
    const start = getStartOfWeek(currentDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('tr-TR', { month: 'long' })}`;
  }

  const getMonthLabel = () => {
    return currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  }

  return (
    <div className="p-4 md:p-6 w-full max-w-full mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Ders Programı</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Haftalık ders planı, derslik dolulukları ve etkinlikler.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrev} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-colors"><ChevronLeft size={20} /></button>
          <div className="text-center min-w-[180px]">
            <h2 className="font-bold text-slate-800 dark:text-white">{viewMode === 'week' ? getWeekLabel() : getMonthLabel()}</h2>
          </div>
          <button onClick={handleNext} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-colors"><ChevronRight size={20} /></button>
          <button onClick={() => fetchData()} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-colors"><RefreshCcw size={20} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      <WeekView />
    </div>
  );
};

export default Schedule;
