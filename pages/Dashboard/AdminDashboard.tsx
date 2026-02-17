
import React, { useEffect, useState } from 'react';
import { Users, UserPlus, RefreshCcw, Search, MessageSquare, CheckCircle2, XCircle, Clock, CheckSquare, ArrowRight, TrendingDown, Calendar, TrendingUp, Wallet } from 'lucide-react';
import StudentDistributionChart from '../../components/Dashboard/StudentDistributionChart';
import TeacherPerformanceChart from '../../components/Dashboard/TeacherPerformanceChart';
import { PNR_PALETTE } from '../../constants';
import { supabase } from '../../lib/supabaseClient';
import { BranchStat, Student, TeacherStat } from '../../types';

interface TodoItem {
    id: string;
    title: string;
    description?: string;
    status: 'pending' | 'completed';
    created_at: string;
}

interface DailyLesson {
    id: string;
    time: string;
    title: string; // Class Name or Student Name
    subTitle: string; // Branch
    type: 'group' | 'individual';
}

const AdminDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);

    // Charts & Lists
    const [chartData, setChartData] = useState<BranchStat[]>([]);
    const [teacherStats, setTeacherStats] = useState<TeacherStat[]>([]);
    const [recentStudents, setRecentStudents] = useState<Student[]>([]);
    const [todos, setTodos] = useState<TodoItem[]>([]);

    // Stats
    const [leadStats, setLeadStats] = useState({ takip: 0, deneme: 0, kayit: 0, iptal: 0 });
    const [passiveThisMonth, setPassiveThisMonth] = useState(0);

    // New: Daily Schedule & Finance
    const [todaysLessons, setTodaysLessons] = useState<DailyLesson[]>([]);
    const [monthlyFinance, setMonthlyFinance] = useState({ income: 0, expense: 0, balance: 0 });

    // --- Helper: Branch Color Mapping ---
    const getBranchAvatarStyle = (branchName: string) => {
        const b = branchName.toLowerCase();
        if (b.includes('bale') || b.includes('dans')) return 'bg-pnr-purple text-white';
        if (b.includes('piyano') || b.includes('org')) return 'bg-pnr-blue text-white';
        if (b.includes('gitar') || b.includes('ukulele')) return 'bg-pnr-orange text-white';
        if (b.includes('keman') || b.includes('çello')) return 'bg-pnr-green text-white';
        if (b.includes('bateri') || b.includes('davul')) return 'bg-pnr-red text-white';
        if (b.includes('şan') || b.includes('vokal')) return 'bg-pnr-cyan text-white';
        return 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
    };

    const getDayName = (date: Date) => {
        const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        return days[date.getDay()];
    };

    const navigateTo = (path: string) => {
        window.location.hash = path;
    };

    // --- Real Data Fetching ---
    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const startOfMonthISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const endOfMonthISO = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

            // 1. Fetch Students (For Charts & Recent List & Passive Count)
            const { data: students, error: studentsError } = await supabase
                .from('students')
                .select('*')
                .order('created_at', { ascending: false });

            if (studentsError) throw studentsError;

            // 2. Fetch Leads (Only This Month)
            const { data: leadsData } = await supabase
                .from('new_leads')
                .select('status')
                .gte('created_at', startOfMonthISO);

            // 3. Fetch Todos
            if (user) {
                const { data: tData } = await supabase
                    .from('todos')
                    .select('*')
                    .eq('assignee_id', user.id)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(5);
                if (tData) setTodos(tData);
            }

            // 4. Fetch TODAY'S LESSONS
            const currentDayName = getDayName(now);
            const lessons: DailyLesson[] = [];

            // 4a. Group Classes (Dance)
            const { data: danceClasses } = await supabase.from('dance_classes').select('id, name, sub_branch, schedule_config');
            if (danceClasses) {
                danceClasses.forEach((dc: any) => {
                    if (Array.isArray(dc.schedule_config)) {
                        dc.schedule_config.forEach((slot: any) => {
                            if (slot.day === currentDayName) {
                                lessons.push({
                                    id: `dance-${dc.id}`,
                                    time: slot.startTime,
                                    title: dc.name,
                                    subTitle: dc.sub_branch,
                                    type: 'group'
                                });
                            }
                        });
                    }
                });
            }

            // 4b. Individual Lessons (Instrument Attendance)
            const { data: instAttendance } = await supabase
                .from('instrument_attendance')
                .select(`
            id, time, 
            instrument_periods (
                students ( full_name, sub_branch )
            )
        `)
                .eq('date', todayStr)
                .neq('status', 'absent');

            if (instAttendance) {
                instAttendance.forEach((att: any) => {
                    if (att.instrument_periods?.students) {
                        lessons.push({
                            id: `inst-${att.id}`,
                            time: att.time ? att.time.slice(0, 5) : '00:00',
                            title: att.instrument_periods.students.full_name,
                            subTitle: att.instrument_periods.students.sub_branch || 'Enstrüman',
                            type: 'individual'
                        });
                    }
                });
            }

            // Sort Lessons by Time
            lessons.sort((a, b) => a.time.localeCompare(b.time));
            setTodaysLessons(lessons);

            // 5. Fetch MONTHLY FINANCE
            const { data: cashData } = await supabase
                .from('cash_book')
                .select('amount, type')
                .gte('date', startOfMonthISO)
                .lte('date', endOfMonthISO);

            if (cashData) {
                const inc = cashData.filter(x => x.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
                const exp = cashData.filter(x => x.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
                setMonthlyFinance({ income: inc, expense: exp, balance: inc - exp });
            }

            // --- PROCESS LEADS ---
            if (leadsData) {
                const stats = { takip: 0, deneme: 0, kayit: 0, iptal: 0 };
                leadsData.forEach((l: any) => {
                    if (l.status === 'Takip') stats.takip++;
                    else if (l.status === 'Deneme') stats.deneme++;
                    else if (l.status === 'Kayıt') stats.kayit++;
                    else if (l.status === 'İptal') stats.iptal++;
                });
                setLeadStats(stats);
            }

            // --- PROCESS STUDENTS ---
            if (students) {
                setPassiveThisMonth(students.filter(s => s.status === 'passive' && s.created_at >= startOfMonthISO).length);

                const subBranchMap: Record<string, number> = {};
                students.filter(s => s.status === 'active').forEach(s => {
                    const sub = s.sub_branch || 'Diğer';
                    subBranchMap[sub] = (subBranchMap[sub] || 0) + 1;
                });

                const colors = [PNR_PALETTE.purple, PNR_PALETTE.blue, PNR_PALETTE.orange, PNR_PALETTE.green, PNR_PALETTE.teal, PNR_PALETTE.yellow, PNR_PALETTE.red];
                const cData: BranchStat[] = Object.keys(subBranchMap).map((key, index) => ({
                    name: key,
                    count: subBranchMap[key],
                    color: colors[index % colors.length]
                })).sort((a, b) => b.count - a.count);
                setChartData(cData);

                const recent: Student[] = students.slice(0, 3).map(s => ({
                    id: s.id,
                    name: s.full_name,
                    branch: s.sub_branch || s.main_branch || 'Belirsiz',
                    status: s.status as any,
                    teacher: s.teacher || 'Atanmamış',
                    nextLesson: new Date(s.created_at).toLocaleDateString('tr-TR')
                }));
                setRecentStudents(recent);

                // --- TEACHER STATS ---
                const teacherMap: Record<string, number> = {};
                students.filter(s => s.status === 'active').forEach(s => {
                    const tName = s.teacher || 'Atanmamış';
                    teacherMap[tName] = (teacherMap[tName] || 0) + 1;
                });

                const tStats: TeacherStat[] = Object.keys(teacherMap).map((key, index) => ({
                    id: `teacher-${index}`,
                    name: key,
                    studentCount: teacherMap[key]
                }));
                setTeacherStats(tStats);
            }

        } catch (err) {
            console.error("Dashboard error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteTodo = async (id: string) => {
        setTodos(prev => prev.filter(t => t.id !== id));
        try {
            await supabase.from('todos').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
        } catch (err) { fetchDashboardData(); }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(amount);

    return (
        <div className="w-full max-w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Genel Bakış</h1>
                    <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">Akademi performans göstergeleri ve güncel durum.</p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button
                        onClick={fetchDashboardData}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-pnr-purple transition-colors"
                    >
                        <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="relative flex-1 md:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Hızlı ara..."
                            className="w-full md:w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                    </div>
                </div>
            </div>

            {/* --- MAIN GRID LAYOUT --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                {/* LEFT: BRANCH DISTRIBUTION & TEACHER PERFORMANCE (Span 4) */}
                <div className="lg:col-span-4 flex flex-col gap-6">

                    {/* 1. BRANCH DISTRIBUTION CHART */}
                    <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-sm dark:shadow-none flex flex-col min-h-[400px]">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-pnr-purple/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Öğrenci Dağılımı</h2>
                            <button onClick={() => navigateTo('/education/crm')} className="text-slate-400 hover:text-pnr-purple p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <ArrowRight size={18} />
                            </button>
                        </div>

                        <div className="flex-1 flex items-center justify-center relative z-10">
                            {loading ? (
                                <div className="text-slate-400">Yükleniyor...</div>
                            ) : chartData.length > 0 ? (
                                <div className="w-full h-full flex flex-col justify-center">
                                    <StudentDistributionChart data={chartData} />
                                    <div className="text-center text-xs text-slate-400 mt-4 px-4">
                                        En yoğun branş <span style={{ color: chartData[0]?.color }} className="font-bold">{chartData[0].name}</span>, toplamın %{((chartData[0].count / chartData.reduce((a, b) => a + b.count, 0)) * 100).toFixed(0)}'ini oluşturuyor.
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                    <Users size={32} className="opacity-50" />
                                    <span>Veri yok</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. TEACHER PERFORMANCE CHART (NEW) */}
                    <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-sm dark:shadow-none flex flex-col">
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Öğretmen Dağılımı</h2>
                            <button onClick={() => navigateTo('/management/teachers')} className="text-slate-400 hover:text-pnr-purple p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <ArrowRight size={18} />
                            </button>
                        </div>
                        <div className="w-full">
                            {loading ? (
                                <div className="text-center text-slate-400 py-8">Yükleniyor...</div>
                            ) : teacherStats.length > 0 ? (
                                <TeacherPerformanceChart data={teacherStats} />
                            ) : (
                                <div className="text-center text-slate-400 py-8">Veri yok</div>
                            )}
                        </div>
                    </div>

                </div>

                {/* RIGHT: 2x2 GRID (Span 8) */}
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* 1. YENİ TALEPLER */}
                    <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm dark:shadow-none flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                                <UserPlus className="text-pnr-purple" size={20} /> Yeni Talepler
                            </h2>
                            <button onClick={() => navigateTo('/education/leads')} className="text-slate-400 hover:text-pnr-purple p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <ArrowRight size={18} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 flex-1 content-center">
                            <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-xl flex items-center justify-between border border-yellow-100 dark:border-yellow-900/30">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-yellow-600 dark:text-yellow-500">Takip</div>
                                    <div className="text-xl font-bold text-yellow-700 dark:text-yellow-400">{leadStats.takip}</div>
                                </div>
                                <Clock size={18} className="text-yellow-400 opacity-60" />
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl flex items-center justify-between border border-blue-100 dark:border-blue-900/30">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-500">Deneme</div>
                                    <div className="text-xl font-bold text-blue-700 dark:text-blue-400">{leadStats.deneme}</div>
                                </div>
                                <MessageSquare size={18} className="text-blue-400 opacity-60" />
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-xl flex items-center justify-between border border-green-100 dark:border-green-900/30">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-green-600 dark:text-green-500">Kayıt</div>
                                    <div className="text-xl font-bold text-green-700 dark:text-green-400">{leadStats.kayit}</div>
                                </div>
                                <CheckCircle2 size={18} className="text-green-400 opacity-60" />
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-xl flex items-center justify-between border border-red-100 dark:border-red-900/30">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-red-600 dark:text-red-500">İptal</div>
                                    <div className="text-xl font-bold text-red-700 dark:text-red-400">{leadStats.iptal}</div>
                                </div>
                                <XCircle size={18} className="text-red-400 opacity-60" />
                            </div>
                        </div>
                    </div>

                    {/* 2. SON KAYITLAR */}
                    <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm dark:shadow-none flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                                <Users className="text-pnr-cyan" size={20} /> Son Kayıtlar
                            </h2>
                            <button onClick={() => navigateTo('/education/crm')} className="text-slate-400 hover:text-pnr-purple p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <ArrowRight size={18} />
                            </button>
                        </div>
                        <div className="flex-1 space-y-3">
                            {loading ? (
                                <div className="text-center text-xs text-slate-400 py-4">Yükleniyor...</div>
                            ) : recentStudents.length > 0 ? (
                                recentStudents.map(student => (
                                    <div key={student.id} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getBranchAvatarStyle(student.branch)}`}>
                                            {student.name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 dark:text-white text-xs truncate">{student.name}</div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{student.branch}</div>
                                        </div>
                                        <div className="text-[10px] text-slate-400 whitespace-nowrap">{student.nextLesson}</div>
                                    </div>
                                ))
                            ) : <div className="text-center text-xs text-slate-400">Kayıt yok.</div>}
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                            <span className="text-slate-500">Pasifler (Bu Ay):</span>
                            <span className="font-bold text-red-500">{passiveThisMonth}</span>
                        </div>
                    </div>

                    {/* 3. GÜNLÜK TAKVİM */}
                    <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm dark:shadow-none flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                                <Calendar className="text-pnr-orange" size={20} /> Günlük Program
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded">Bugün</span>
                                <button onClick={() => navigateTo('/education/schedule')} className="text-slate-400 hover:text-pnr-purple p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                    <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-[180px] custom-scrollbar pr-2 space-y-2">
                            {loading ? (
                                <div className="text-center text-xs text-slate-400 py-4">Yükleniyor...</div>
                            ) : todaysLessons.length > 0 ? (
                                todaysLessons.map(lesson => (
                                    <div key={lesson.id} className="flex items-center gap-3 p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="text-center w-10 shrink-0">
                                            <div className="text-xs font-bold text-slate-800 dark:text-white">{lesson.time}</div>
                                        </div>
                                        <div className="w-1 h-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0"></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 dark:text-white text-xs truncate">{lesson.title}</div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${lesson.type === 'group' ? 'bg-pnr-purple' : 'bg-pnr-blue'}`}></div>
                                                {lesson.subTitle}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                    Bugün için planlanmış ders yok.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 4. AYLIK GELİR DURUMU */}
                    <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm dark:shadow-none flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                                <Wallet className="text-pnr-green" size={20} /> Finansal Durum
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Bu Ay (Kasa)</span>
                                <button onClick={() => navigateTo('/finance/profitability')} className="text-slate-400 hover:text-pnr-purple p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                    <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 mt-2">
                            <div className="flex justify-between items-end">
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                    <TrendingUp size={16} />
                                    <span className="text-xs font-bold uppercase">Gelir</span>
                                </div>
                                <div className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                                    {formatCurrency(monthlyFinance.income)}
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-green-500 h-full rounded-full" style={{ width: '100%' }}></div>
                            </div>

                            <div className="flex justify-between items-end">
                                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                    <TrendingDown size={16} />
                                    <span className="text-xs font-bold uppercase">Gider</span>
                                </div>
                                <div className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                                    {formatCurrency(monthlyFinance.expense)}
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-red-500 h-full rounded-full" style={{ width: `${monthlyFinance.income > 0 ? (monthlyFinance.expense / monthlyFinance.income) * 100 : 0}%` }}></div>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Net Bakiye</span>
                            <span className={`text-lg font-bold font-mono ${monthlyFinance.balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                                {formatCurrency(monthlyFinance.balance)}
                            </span>
                        </div>
                    </div>

                </div>
            </div>

            {/* --- BOTTOM ROW: TO-DO LIST --- */}
            <div className="grid grid-cols-1 pb-10">
                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-none">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                            <CheckSquare size={20} className="text-pnr-purple" />
                            Görevlerim (To-Do)
                        </h2>
                        <button onClick={() => navigateTo('/management/todo')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-pnr-purple">
                            <ArrowRight size={18} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {loading ? (
                            <div className="text-center text-slate-400 py-4 col-span-full">Yükleniyor...</div>
                        ) : todos.length > 0 ? (
                            todos.map((task) => (
                                <div key={task.id} className="group flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-pnr-purple dark:hover:border-pnr-purple transition-all">
                                    <button
                                        onClick={() => handleCompleteTodo(task.id)}
                                        className="mt-0.5 w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-600 hover:border-pnr-purple hover:bg-pnr-purple text-transparent hover:text-white flex items-center justify-center transition-all shrink-0"
                                    >
                                        <CheckCircle2 size={14} />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight mb-1">{task.title}</p>
                                        {task.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{task.description}</p>
                                        )}
                                        <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                                            <Clock size={10} />
                                            {new Date(task.created_at).toLocaleDateString('tr-TR')}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 flex flex-col items-center gap-2 col-span-full">
                                <CheckCircle2 size={24} className="text-green-500 mb-2" />
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Bekleyen görev yok.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
