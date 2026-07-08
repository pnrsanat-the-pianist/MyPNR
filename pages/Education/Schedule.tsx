import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, GraduationCap, RefreshCcw, Search } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const DAYS_OF_WEEK = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const CALENDAR_HEADER_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

interface ScheduleSlot {
  dayIndex?: number | string;
  day?: string;
  time?: string;
  startTime?: string;
}

interface RawAttendanceRecord {
  id: string;
  week_number?: number | null;
  lesson_date?: string | null;
  date?: string | null;
  time?: string | null;
  status?: string | null;
}

interface RawInstrumentPeriod {
  id: string;
  start_date?: string | null;
  lesson_time?: string | null;
  schedule_config?: ScheduleSlot[] | null;
  students?: {
    full_name?: string | null;
    sub_branch?: string | null;
    teacher?: string | null;
  } | null;
  instrument_attendance?: RawAttendanceRecord[] | null;
}

interface InstrumentScheduleLesson {
  id: string;
  dateKey: string;
  dayName: string;
  time: string;
  studentName: string;
  branch: string;
  teacher: string;
  lessonNumber?: number | null;
  status?: string | null;
}

interface ScheduleProps {
  canEdit?: boolean;
}

const parseDateKey = (dateValue: string) => {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateKey = (dateValue?: string | null) => String(dateValue || '').split('T')[0];

const normalizeTime = (timeValue?: string | null) => {
  if (!timeValue) return '';
  return String(timeValue).slice(0, 5);
};

const addDays = (dateKey: string, days: number) => {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
};

const getSlotTimeForDate = (dateKey: string, slots: ScheduleSlot[], fallbackTime?: string | null) => {
  const date = parseDateKey(dateKey);
  const dayName = DAYS_OF_WEEK[date.getDay()];
  const matchingSlot = slots.find(slot => Number(slot.dayIndex) === date.getDay() || slot.day === dayName);
  const fallbackSlot = slots[0];

  return normalizeTime(matchingSlot?.time || matchingSlot?.startTime)
    || normalizeTime(fallbackSlot?.time || fallbackSlot?.startTime)
    || normalizeTime(fallbackTime)
    || '10:00';
};

const getStatusLabel = (status?: string | null) => {
  switch (status) {
    case 'present':
      return 'Tamamlandı';
    case 'absent':
      return 'Gelmedi';
    case 'excused':
    case 'makeup':
    case 'makeup_needed':
      return 'Telafi';
    case 'pending':
      return 'Bekliyor';
    default:
      return 'Planlandı';
  }
};

const getStatusClass = (status?: string | null) => {
  switch (status) {
    case 'present':
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-900';
    case 'absent':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900';
    case 'excused':
    case 'makeup':
    case 'makeup_needed':
      return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900';
    case 'pending':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
};

const Schedule: React.FC<ScheduleProps> = () => {
  const [lessons, setLessons] = useState<InstrumentScheduleLesson[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const mapPeriodsToLessons = (periods: RawInstrumentPeriod[] = []) => periods.flatMap(period => {
    const slots = Array.isArray(period.schedule_config) ? period.schedule_config : [];
    const records = Array.isArray(period.instrument_attendance) ? period.instrument_attendance : [];
    const studentName = period.students?.full_name || 'Öğrenci';
    const branch = period.students?.sub_branch || 'Enstrüman';
    const teacher = period.students?.teacher || 'Atanmamış';

    if (records.length > 0) {
      return records.flatMap<InstrumentScheduleLesson>(record => {
          const dateKey = normalizeDateKey(record.lesson_date || record.date);
          if (!dateKey) return [];
          const date = parseDateKey(dateKey);
          const time = normalizeTime(record.time) || getSlotTimeForDate(dateKey, slots, period.lesson_time);

          return [{
            id: record.id,
            dateKey,
            dayName: DAYS_OF_WEEK[date.getDay()],
            time,
            studentName,
            branch,
            teacher,
            lessonNumber: record.week_number,
            status: record.status
          }];
        });
    }

    const startDate = normalizeDateKey(period.start_date);
    if (!startDate) return [];

    return Array.from({ length: 10 }, (_, index) => {
      const dateKey = addDays(startDate, index * 7);
      const date = parseDateKey(dateKey);

      return {
        id: `${period.id}-${index + 1}`,
        dateKey,
        dayName: DAYS_OF_WEEK[date.getDay()],
        time: getSlotTimeForDate(dateKey, slots, period.lesson_time),
        studentName,
        branch,
        teacher,
        lessonNumber: index + 1,
        status: 'planned'
      };
    });
  });

  const fetchLessons = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('instrument_periods')
        .select(`
          id,
          start_date,
          lesson_time,
          schedule_config,
          students ( full_name, sub_branch, teacher ),
          instrument_attendance ( id, week_number, lesson_date, status )
        `)
        .eq('status', 'active')
        .order('start_date', { ascending: true });

      if (error) throw error;

      const mappedLessons = mapPeriodsToLessons((data || []) as RawInstrumentPeriod[])
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.time.localeCompare(b.time) || a.studentName.localeCompare(b.studentName, 'tr'));

      setLessons(mappedLessons);
    } catch (error: any) {
      console.error('Schedule fetch error:', error);
      setErrorMessage(error?.message || 'Ders programı yüklenirken hata oluştu.');
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, []);

  const monthStartKey = formatDateKey(currentMonth);
  const monthEndKey = formatDateKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));

  const filteredLessons = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('tr-TR');

    return lessons.filter(lesson => {
      const isInMonth = lesson.dateKey >= monthStartKey && lesson.dateKey <= monthEndKey;
      if (!isInMonth) return false;

      if (!normalizedSearch) return true;

      return [lesson.studentName, lesson.branch, lesson.teacher, lesson.dayName, lesson.time]
        .some(value => value.toLocaleLowerCase('tr-TR').includes(normalizedSearch));
    });
  }, [lessons, monthEndKey, monthStartKey, searchTerm]);

  const lessonsByDate = useMemo(() => {
    return filteredLessons.reduce<Record<string, InstrumentScheduleLesson[]>>((groups, lesson) => {
      groups[lesson.dateKey] = groups[lesson.dateKey] || [];
      groups[lesson.dateKey].push(lesson);
      return groups;
    }, {});
  }, [filteredLessons]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const startDate = new Date(firstDayOfMonth);
    const startDay = startDate.getDay();
    const daysToMonday = startDay === 0 ? -6 : 1 - startDay;

    startDate.setDate(startDate.getDate() + daysToMonday);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const dateKey = formatDateKey(date);

      return {
        date,
        dateKey,
        isCurrentMonth: date.getMonth() === currentMonth.getMonth(),
        isToday: dateKey === formatDateKey(new Date()),
        lessons: lessonsByDate[dateKey] || []
      };
    });
  }, [currentMonth, lessonsByDate]);

  const changeMonth = (direction: -1 | 1) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const monthLabel = currentMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <div className="p-4 md:p-6 w-full max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Ders Programı</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enstrüman derslerinde seçilen tarih, gün ve saatte öğrenci, branş ve öğretmen bilgileri listelenir.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Öğrenci, branş, öğretmen ara"
              className="w-full sm:w-72 pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pnr-purple/30"
            />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" aria-label="Önceki ay">
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-[170px] px-4 py-2.5 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-white capitalize">
              {monthLabel}
            </div>
            <button onClick={() => changeMonth(1)} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" aria-label="Sonraki ay">
              <ChevronRight size={20} />
            </button>
            <button onClick={fetchLessons} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" aria-label="Yenile">
              <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Bu Ay Ders</div>
          <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{filteredLessons.length}</div>
        </div>
        <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Öğrenci</div>
          <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{new Set(filteredLessons.map(lesson => lesson.studentName)).size}</div>
        </div>
        <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Öğretmen</div>
          <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{new Set(filteredLessons.map(lesson => lesson.teacher)).size}</div>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-2xl p-4 text-sm font-medium">
          {errorMessage}
        </div>
      )}

      <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500 dark:text-slate-400">
            <RefreshCcw className="animate-spin mx-auto mb-3" size={24} />
            Ders programı yükleniyor...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1050px]">
              <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                {CALENDAR_HEADER_DAYS.map(day => (
                  <div key={day} className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-400 border-r border-slate-200 dark:border-slate-800 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map(day => (
                  <div
                    key={day.dateKey}
                    className={`min-h-[170px] p-2 border-r border-b border-slate-100 dark:border-slate-800 last:border-r-0 ${day.isCurrentMonth ? 'bg-white dark:bg-pnr-card' : 'bg-slate-50/70 dark:bg-slate-900/30'} ${day.isToday ? 'ring-2 ring-inset ring-pnr-purple/40' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${day.isToday ? 'bg-pnr-purple text-white' : day.isCurrentMonth ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                        {day.date.getDate()}
                      </div>
                      {day.lessons.length > 0 && (
                        <div className="text-[10px] font-bold text-slate-400">
                          {day.lessons.length} ders
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {day.lessons.length === 0 ? (
                        day.isCurrentMonth && <div className="text-[11px] text-slate-300 dark:text-slate-700 px-1">Ders yok</div>
                      ) : (
                        day.lessons.map(lesson => (
                          <div key={lesson.id} className="rounded-xl border border-pnr-purple/15 bg-pnr-purple/5 dark:bg-pnr-purple/10 p-2 shadow-sm">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-1.5 text-[11px] font-black text-pnr-purple font-mono">
                                <Clock size={12} />
                                {lesson.time}
                              </div>
                              <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusClass(lesson.status)}`}>
                                {getStatusLabel(lesson.status)}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                              {lesson.studentName} - {lesson.branch} - {lesson.teacher}
                            </div>
                            {lesson.lessonNumber && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                                <GraduationCap size={11} /> {lesson.lessonNumber}. ders
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {filteredLessons.length === 0 && (
                <div className="p-10 text-center text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                  <CalendarDays className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={36} />
                  Bu ay için enstrüman dersi bulunamadı.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Schedule;
