
import React, { useEffect, useState } from 'react';
import { Users, UserPlus, RefreshCcw, Search, MessageSquare, CheckCircle2, XCircle, Clock, CheckSquare, ArrowRight, TrendingDown, Calendar, TrendingUp, Wallet, Landmark, CreditCard } from 'lucide-react';
import StudentDistributionChart from '../../components/Dashboard/StudentDistributionChart';
import TeacherPerformanceChart from '../../components/Dashboard/TeacherPerformanceChart';
import { PNR_PALETTE } from '../../constants';
import { supabase } from '../../lib/supabaseClient';
import { BranchStat, Student, TeacherStat, UserRole } from '../../types';

interface TodoItem {
    id: string;
    title: string;
    description?: string;
    status: 'pending' | 'completed';
    is_priority: boolean;
    created_at: string;
}

interface DailyLesson {
    id: string;
    time: string;
    title: string; // Class Name or Student Name
    subTitle: string; // Branch
    type: 'group' | 'individual';
}

interface AdminDashboardProps {
    currentUserRole: UserRole;
    permissions: Record<string, { view: boolean; edit: boolean }>;
}

const DASHBOARD_PERMISSION_KEYS = {
    studentDistribution: 'dashboard-student-distribution',
    todos: 'dashboard-todos',
    leads: 'dashboard-leads',
    finance: 'dashboard-finance',
    teacherDistribution: 'dashboard-teacher-distribution',
    dailySchedule: 'dashboard-daily-schedule',
    recentStudents: 'dashboard-recent-students',
};

const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUserRole, permissions }) => {
    const [loading, setLoading] = useState(true);

    // Charts & Lists
    const [chartData, setChartData] = useState<BranchStat[]>([]);
    const [teacherStats, setTeacherStats] = useState<TeacherStat[]>([]);
    const [recentStudents, setRecentStudents] = useState<Student[]>([]);
    const [todos, setTodos] = useState<TodoItem[]>([]);

    // Stats
    const [leadStats, setLeadStats] = useState({ takip: 0, deneme: 0, kayit: 0, gorusuldu: 0, iptal: 0 });
    const [passiveThisMonth, setPassiveThisMonth] = useState(0);

    // New: Daily Schedule & Finance
    const [todaysLessons, setTodaysLessons] = useState<DailyLesson[]>([]);
    const [financeBalances, setFinanceBalances] = useState({
        cash: 0,
        denizbank: 0,
        denizbankPos: 0,
        vakifbank: 0,
        total: 0
    });

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

    const getShiftedDate = (dateStr: string, monthOffset: number) => {
        const [year, month, day] = String(dateStr || '').split('-').map(Number);
        if (!year || !month || !day) return dateStr;

        const targetMonthIndex = month - 1 + monthOffset;
        const targetYear = year + Math.floor(targetMonthIndex / 12);
        const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
        const daysInMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
        const finalDay = Math.min(day, daysInMonth);

        return new Date(Date.UTC(targetYear, normalizedMonth, finalDay)).toISOString().split('T')[0];
    };

    const getInstallmentIndex = (installmentInfo?: string) => {
        const match = String(installmentInfo || '').match(/^(\d+)\s*\//);
        return match ? Math.max(1, parseInt(match[1], 10) || 1) : 1;
    };

    const getRecordPeriodFromDescription = (description?: string) => {
        const parts = String(description || '').split(' - ').map(part => part.trim()).filter(Boolean);
        const period = parts[parts.length - 1] || '';
        const [monthText, yearText] = period.split(/\s+/);
        const monthIndex = MONTH_NAMES.findIndex(month => month.toLocaleLowerCase('tr-TR') === (monthText || '').toLocaleLowerCase('tr-TR'));
        const yearValue = parseInt(yearText || '', 10);

        return monthIndex !== -1 && !isNaN(yearValue) ? { month: monthIndex, year: yearValue } : null;
    };

    const getEffectiveInstallmentDate = (record: any) => {
        const installmentIndex = getInstallmentIndex(record.installment_info);
        if (!record.installment_info || installmentIndex <= 1) return String(record.date || '');

        const recordDate = new Date(record.date);
        const period = getRecordPeriodFromDescription(record.description);
        if (period && recordDate.getMonth() === period.month && recordDate.getFullYear() === period.year) {
            return String(record.date || '');
        }

        return getShiftedDate(String(record.date || ''), installmentIndex - 1);
    };

    const isFutureInstallment = (record: any) => {
        const today = new Date().toISOString().split('T')[0];
        return !!record.installment_info && getEffectiveInstallmentDate(record) > today;
    };

    const signedFinanceAmount = (record: any) => {
        const amount = Number(record.amount || 0);
        return record.type === 'income' ? amount : -amount;
    };

    const isDevirRecord = (record: any) => {
        const text = `${record.category_name || ''} ${record.description || ''}`
            .toLocaleLowerCase('tr-TR')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        return text.includes('devir') || text.includes('devreden');
    };

    const navigateTo = (path: string) => {
        window.location.hash = path;
    };

    const hasDashboardPermission = (resourceId: string, field: 'view' | 'edit') => {
        if (currentUserRole === UserRole.ADMIN) return true;

        const resourcePermission = permissions[resourceId];
        if (resourcePermission) return resourcePermission[field];

        const dashboardPermission = permissions.dashboard;
        if (dashboardPermission) return dashboardPermission[field];

        return field === 'view' && Object.keys(permissions).length === 0;
    };

    const canViewDashboardCard = (resourceId: string) => hasDashboardPermission(resourceId, 'view');
    const canEditDashboardCard = (resourceId: string) => hasDashboardPermission(resourceId, 'edit');

    // --- Real Data Fetching ---
    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const startOfMonthISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

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
                    .order('is_priority', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(6); // Increased limit as it's now higher up
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

            // 5. Fetch FINANCE BALANCES (All time)
            const calculateBookBalance = (rows: any[] = []) => {
                return rows
                    .filter(row => !isFutureInstallment(row))
                    .reduce((acc, curr) => acc + signedFinanceAmount(curr), 0);
            };

            const calculateVakifbankBalance = (rows: any[] = []) => {
                const currentYear = now.getFullYear();
                const startOfYear = `${currentYear}-01-01`;
                const endOfYear = `${currentYear}-12-31`;
                const settledRows = rows.filter(row => !isFutureInstallment(row));
                const currentYearRows = settledRows.filter(row => String(row.date || '') >= startOfYear && String(row.date || '') <= endOfYear);
                const devirRows = currentYearRows
                    .filter(isDevirRecord)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const latestDevir = devirRows[devirRows.length - 1];
                const rowsToCalculate = latestDevir
                    ? currentYearRows.filter(row => row.id === latestDevir.id || new Date(row.date).getTime() >= new Date(latestDevir.date).getTime())
                    : currentYearRows;

                return rowsToCalculate.reduce((acc, curr) => acc + signedFinanceAmount(curr), 0);
            };

            const [cashBook, denizbankBook, denizbankPosBook, vakifbankBook] = await Promise.all([
                supabase.from('cash_book').select('id, date, description, category_name, amount, type, installment_info'),
                supabase.from('denizbank_book').select('id, date, description, category_name, amount, type, installment_info'),
                supabase.from('denizbank_pos_book').select('id, date, description, category_name, amount, type, installment_info'),
                supabase.from('vakifbank_book').select('id, date, description, category_name, amount, type, installment_info')
            ]);

            if (cashBook.error) throw cashBook.error;
            if (denizbankBook.error) throw denizbankBook.error;
            if (denizbankPosBook.error) throw denizbankPosBook.error;
            if (vakifbankBook.error) throw vakifbankBook.error;

            const cash = calculateBookBalance(cashBook.data || []);
            const denizbank = calculateBookBalance(denizbankBook.data || []);
            const denizbankPos = calculateBookBalance(denizbankPosBook.data || []);
            const vakifbank = calculateVakifbankBalance(vakifbankBook.data || []);

            setFinanceBalances({
                cash,
                denizbank,
                denizbankPos,
                vakifbank,
                total: cash + denizbank + denizbankPos + vakifbank
            });

            // --- PROCESS LEADS ---
            if (leadsData) {
                const stats = { takip: 0, deneme: 0, kayit: 0, gorusuldu: 0, iptal: 0 };
                leadsData.forEach((l: any) => {
                    const s = (l.status || '').toString().trim();
                    if (s === 'Takip') stats.takip++;
                    else if (s === 'Deneme') stats.deneme++;
                    else if (s === 'Kayıt') stats.kayit++;
                    else if (s === 'İptal') stats.iptal++;
                    else if (/^g[oö]r[uü][sş][uü]ld[uü]/i.test(s) || s.toLowerCase().includes('gorus') || s.toLowerCase().includes('görüş')) {
                        stats.gorusuldu++;
                    }
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

                const recent: Student[] = students.slice(0, 4).map(s => ({
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
                })).sort((a, b) => b.studentCount - a.studentCount).slice(0, 10);
                setTeacherStats(tStats);
            }

        } catch (err) {
            console.error("Dashboard error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteTodo = async (id: string) => {
        if (!canEditDashboardCard(DASHBOARD_PERMISSION_KEYS.todos)) return;
        setTodos(prev => prev.filter(t => t.id !== id));
        try {
            await supabase.from('todos').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
        } catch (err) { fetchDashboardData(); }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(amount);

    const financeItems = [
        { label: 'Kasa Defteri', value: financeBalances.cash, icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/10', path: '/finance/cashbook' },
        { label: 'Denizbank', value: financeBalances.denizbank, icon: Landmark, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10', path: '/finance/denizbank' },
        { label: 'Denizbank POS', value: financeBalances.denizbankPos, icon: CreditCard, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/10', path: '/finance/denizbank-pos' },
        { label: 'Vakıfbank', value: financeBalances.vakifbank, icon: Landmark, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/10', path: '/finance/vakifbank' }
    ];

    const visibleDashboardCardCount = Object.values(DASHBOARD_PERMISSION_KEYS)
        .filter(resourceId => canViewDashboardCard(resourceId)).length;

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
            {visibleDashboardCardCount === 0 ? (
                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center text-slate-500 dark:text-slate-400">
                    Dashboard üzerinde görüntüleme yetkiniz olan kutu bulunmuyor.
                </div>
            ) : <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* --- LEFT COLUMN: CHARTS (Span 4) --- */}
                <div className="lg:col-span-4 flex flex-col gap-6">

                    {/* 1. ÖĞRENCİ DAĞILIMI (Requested 1st) */}
                    {canViewDashboardCard(DASHBOARD_PERMISSION_KEYS.studentDistribution) && <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-sm dark:shadow-none flex flex-col min-h-[400px]">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-pnr-purple/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Öğrenci Dağılımı</h2>
                            {canEditDashboardCard(DASHBOARD_PERMISSION_KEYS.studentDistribution) && (
                                <button onClick={() => navigateTo('/education/crm')} className="text-slate-400 hover:text-pnr-purple p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer" title="CRM Sayfasına Git">
                                    <ArrowRight size={18} />
                                </button>
                            )}
                        </div>
                        <div className="flex-1 flex items-center justify-center relative z-10">
                            {loading ? (
                                <div className="text-slate-400">Yükleniyor...</div>
                            ) : chartData.length > 0 ? (
                                <div className="w-full h-full flex flex-col justify-center">
                                    <StudentDistributionChart data={chartData} />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                    <Users size={32} className="opacity-50" />
                                    <span>Veri yok</span>
                                </div>
                            )}
                        </div>
                    </div>}

                    {/* 5. ÖĞRETMEN DAĞILIMI (Requested 5th) */}
                    {canViewDashboardCard(DASHBOARD_PERMISSION_KEYS.teacherDistribution) && <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-sm dark:shadow-none flex flex-col h-[380px]">
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Öğretmen Dağılımı</h2>
                            {canEditDashboardCard(DASHBOARD_PERMISSION_KEYS.teacherDistribution) && (
                                <button onClick={() => navigateTo('/management/teachers')} className="text-slate-400 hover:text-pnr-purple p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer" title="Öğretmenler Sayfasına Git">
                                    <ArrowRight size={18} />
                                </button>
                            )}
                        </div>
                        <div className="flex-1 w-full overflow-hidden">
                            {loading ? (
                                <div className="text-center text-slate-400 py-8 italic">Yükleniyor...</div>
                            ) : teacherStats.length > 0 ? (
                                <TeacherPerformanceChart data={teacherStats} />
                            ) : (
                                <div className="text-center text-slate-400 py-8 italic">Veri yok</div>
                            )}
                        </div>
                    </div>}

                </div>

                {/* --- RIGHT COLUMN: LISTS & STATS (Span 8) --- */}
                <div className="lg:col-span-8 flex flex-col gap-6">

                    {/* 2. TO-DO LIST (Requested 2nd) */}
                    {canViewDashboardCard(DASHBOARD_PERMISSION_KEYS.todos) && <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-none">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                                <CheckSquare size={22} className="text-pnr-purple" />
                                Görevlerim (To-Do)
                            </h2>
                            {canEditDashboardCard(DASHBOARD_PERMISSION_KEYS.todos) && (
                                <button onClick={() => navigateTo('/management/todo')} className="flex items-center gap-1 text-sm font-bold text-pnr-purple hover:underline bg-pnr-purple/5 px-3 py-1.5 rounded-lg transition-all">
                                    Tümünü Gör <ArrowRight size={16} />
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {loading ? (
                                <div className="text-center text-slate-400 py-4 col-span-full italic">Yükleniyor...</div>
                            ) : todos.length > 0 ? (
                                todos.map((task) => (
                                    <div key={task.id} className="group flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-pnr-purple dark:hover:border-pnr-purple transition-all">
                                        {canEditDashboardCard(DASHBOARD_PERMISSION_KEYS.todos) && (
                                            <button
                                                onClick={() => handleCompleteTodo(task.id)}
                                                className="mt-0.5 w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-600 hover:border-pnr-purple hover:bg-pnr-purple text-transparent hover:text-white flex items-center justify-center transition-all shrink-0"
                                            >
                                                <CheckCircle2 size={14} />
                                            </button>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight mb-0.5 truncate">{task.title}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                <Clock size={10} />
                                                <span>{new Date(task.created_at).toLocaleDateString('tr-TR')}</span>
                                                {(task as any).is_priority && <span className="text-amber-500 font-bold uppercase">❗ Öncelikli</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 flex flex-col items-center gap-2 col-span-full">
                                    <CheckCircle2 size={24} className="text-green-500 opacity-50 mb-1" />
                                    <p className="text-sm font-medium text-slate-500 italic">Bekleyen görev yok.</p>
                                </div>
                            )}
                        </div>
                    </div>}

                    {/* --- 2x2 GRID FOR OTHER STATS --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* 3. YENİ TALEPLER (Requested 3rd) */}
                        {canViewDashboardCard(DASHBOARD_PERMISSION_KEYS.leads) && <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm dark:shadow-none flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                                    <UserPlus className="text-pnr-purple" size={20} /> Yeni Talepler
                                </h2>
                                {canEditDashboardCard(DASHBOARD_PERMISSION_KEYS.leads) && (
                                    <button
                                        onClick={() => navigateTo('/management/leads')}
                                        className="text-slate-400 hover:text-pnr-purple p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                        title="Yeni Talepler Sayfasına Git"
                                    >
                                        <ArrowRight size={18} />
                                    </button>
                                )}
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
                                <div className="bg-orange-50 dark:bg-orange-900/10 p-3 rounded-xl flex items-center justify-between border border-orange-100 dark:border-orange-900/30">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-500">Görüşüldü</div>
                                        <div className="text-xl font-bold text-orange-700 dark:text-orange-400">{leadStats.gorusuldu}</div>
                                    </div>
                                    <MessageSquare size={18} className="text-orange-400 opacity-60" />
                                </div>
                            </div>
                        </div>}

                        {/* 4. FİNANSAL DURUM (Requested 4th) */}
                        {canViewDashboardCard(DASHBOARD_PERMISSION_KEYS.finance) && <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm dark:shadow-none flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                                    <Wallet className="text-pnr-green" size={20} /> Finansal Durum
                                </h2>
                                {canEditDashboardCard(DASHBOARD_PERMISSION_KEYS.finance) && (
                                    <button onClick={() => navigateTo('/finance/profitability')} className="text-slate-400 hover:text-pnr-purple p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer" title="Finans Sayfasına Git">
                                        <ArrowRight size={18} />
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 space-y-2">
                                {financeItems.map(item => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.label}
                                            type="button"
                                            onClick={() => navigateTo(item.path)}
                                            disabled={!canEditDashboardCard(DASHBOARD_PERMISSION_KEYS.finance)}
                                            className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/20 hover:border-pnr-purple/40 hover:bg-white dark:hover:bg-slate-800/50 transition-all text-left group disabled:cursor-default disabled:hover:border-slate-100 disabled:hover:bg-slate-50/70 dark:disabled:hover:bg-slate-900/20"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.bg}`}>
                                                    <Icon size={16} className={item.color} />
                                                </div>
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{item.label}</span>
                                            </div>
                                            <span className={`text-base md:text-lg font-black font-mono whitespace-nowrap group-hover:scale-105 origin-right transition-transform ${item.value >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                                                {formatCurrency(item.value)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={() => navigateTo('/finance/profitability')}
                                disabled={!canEditDashboardCard(DASHBOARD_PERMISSION_KEYS.finance)}
                                className="w-full mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded-xl px-2 pb-2 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${financeBalances.total >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {financeBalances.total >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Toplam Bakiye</span>
                                        <span className={`block text-xl md:text-2xl font-black font-mono ${financeBalances.total >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                                            {formatCurrency(financeBalances.total)}
                                        </span>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${financeBalances.total >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                    {financeBalances.total >= 0 ? 'Pozitif' : 'Negatif'}
                                </span>
                            </button>
                        </div>}

                        {/* 6. GÜNLÜK PROGRAM (Requested 6th) */}
                        {canViewDashboardCard(DASHBOARD_PERMISSION_KEYS.dailySchedule) && <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm dark:shadow-none flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                                    <Calendar className="text-pnr-orange" size={20} /> Günlük Program
                                </h2>
                                {canEditDashboardCard(DASHBOARD_PERMISSION_KEYS.dailySchedule) && (
                                    <button onClick={() => navigateTo('/education/schedule')} className="text-slate-400 hover:text-pnr-purple p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer" title="Program Sayfasına Git">
                                        <ArrowRight size={18} />
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto max-h-[160px] custom-scrollbar pr-1 space-y-2">
                                {loading ? (
                                    <div className="text-center text-xs text-slate-400 py-4 italic">Yükleniyor...</div>
                                ) : todaysLessons.length > 0 ? (
                                    todaysLessons.map(lesson => (
                                        <div key={lesson.id} className="flex items-center gap-3 p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <div className="text-center w-10 shrink-0">
                                                <div className="text-xs font-black text-slate-800 dark:text-white">{lesson.time}</div>
                                            </div>
                                            <div className="w-1 h-6 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0"></div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-800 dark:text-white text-xs truncate leading-tight">{lesson.title}</div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${lesson.type === 'group' ? 'bg-pnr-purple' : 'bg-pnr-blue'}`}></div>
                                                    {lesson.subTitle}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 italic">
                                        Bugün için ders yok.
                                    </div>
                                )}
                            </div>
                        </div>}

                        {/* 7. SON KAYITLAR (Requested 7th) */}
                        {canViewDashboardCard(DASHBOARD_PERMISSION_KEYS.recentStudents) && <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm dark:shadow-none flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
                                    <Users className="text-pnr-cyan" size={20} /> Son Kayıtlar
                                </h2>
                                {canEditDashboardCard(DASHBOARD_PERMISSION_KEYS.recentStudents) && (
                                    <button onClick={() => navigateTo('/education/crm')} className="text-slate-400 hover:text-pnr-purple p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer" title="Öğrenci Listesine Git">
                                        <ArrowRight size={18} />
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                {loading ? (
                                    <div className="text-center text-xs text-slate-400 py-4 italic">Yükleniyor...</div>
                                ) : recentStudents.length > 0 ? (
                                    recentStudents.map(student => (
                                        <div key={student.id} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${getBranchAvatarStyle(student.branch)}`}>
                                                {student.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-900 dark:text-white text-[11px] truncate">{student.name}</div>
                                                <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{student.branch}</div>
                                            </div>
                                            <div className="text-[9px] text-slate-400 whitespace-nowrap">{student.nextLesson}</div>
                                        </div>
                                    ))
                                ) : <div className="text-center text-xs text-slate-400 italic">Kayıt yok.</div>}
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px]">
                                <span className="text-slate-500 font-bold uppercase tracking-wider">Pasifler (Bu Ay):</span>
                                <span className="font-black text-red-500 text-xs px-2 py-0.5 bg-red-50 dark:bg-red-900/20 rounded-full">{passiveThisMonth}</span>
                            </div>
                        </div>}

                    </div>

                </div>
            </div>}

            <div className="pb-10"></div>
        </div>
    );
};

export default AdminDashboard;
