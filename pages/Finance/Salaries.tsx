
import React, { useState, useEffect } from 'react';
import { CreditCard, Search, User, RefreshCcw, CheckCircle2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface TeacherSalary {
    id: string;
    name: string;
    salaryType: 'hourly' | 'monthly';
    salaryAmount: number;
    totalHours: number;
    payableAmount: number;
    status: 'paid' | 'pending'; // In a real app, this would come from a payments table
}

const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

interface SalariesProps {
    canEdit?: boolean;
}

const Salaries: React.FC<SalariesProps> = ({ canEdit = true }) => {
    const [teachers, setTeachers] = useState<TeacherSalary[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    const handlePrevMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() - 1);
        setCurrentDate(newDate);
    };

    const handleNextMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + 1);
        setCurrentDate(newDate);
    };

    const fetchSalaries = async () => {
        setLoading(true);

        // Calculate Date Range
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0];
        const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0];

        try {
            // 1. Fetch Active Teachers
            const { data: teacherData, error: teacherError } = await supabase
                .from('teachers')
                .select('id, name, salary_type, salary_amount')
                .eq('status', 'active')
                .order('name');

            if (teacherError) throw teacherError;

            // 2. Fetch Attendance Records for the selected month
            // We look for 'present' status records.
            // Joining: instrument_attendance -> instrument_periods -> students -> teacher (name)
            // Note: Since 'students' table stores teacher name as string, we match by name.
            const { data: attendanceData, error: attendanceError } = await supabase
                .from('instrument_attendance')
                .select(`
            id,
            status,
            instrument_periods (
                students (
                    teacher
                )
            )
        `)
                .eq('status', 'present') // Only count lessons where student/teacher was present
                .gte('date', startOfMonth)
                .lte('date', endOfMonth);

            if (attendanceError) throw attendanceError;

            // 3. Aggregate Hours Per Teacher
            const teacherHoursMap: Record<string, number> = {};

            if (attendanceData) {
                attendanceData.forEach((record: any) => {
                    const teacherName = record.instrument_periods?.students?.teacher;
                    if (teacherName) {
                        // Assuming 1 record = 1 hour (standard lesson)
                        teacherHoursMap[teacherName] = (teacherHoursMap[teacherName] || 0) + 1;
                    }
                });
            }

            // 4. Map Teachers to Salary Objects
            if (teacherData) {
                const mapped: TeacherSalary[] = teacherData.map((t: any) => {
                    const hours = teacherHoursMap[t.name] || 0;

                    let calculatedPay = 0;
                    if (t.salary_type === 'hourly') {
                        calculatedPay = (t.salary_amount || 0) * hours;
                    } else {
                        // Monthly fixed salary
                        calculatedPay = t.salary_amount || 0;
                    }

                    return {
                        id: t.id,
                        name: t.name,
                        salaryType: t.salary_type || 'hourly',
                        salaryAmount: t.salary_amount || 0,
                        totalHours: hours,
                        payableAmount: calculatedPay,
                        // TODO: Integrate with a 'payments' table to check real status. 
                        // For now, defaulting to pending.
                        status: 'pending'
                    };
                });
                setTeachers(mapped);
            }
        } catch (err) {
            console.error("Salary calculation error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSalaries();
    }, [currentDate]);

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">

            {/* Header & Date Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Maaş Takibi</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Öğretmen ders saatleri ve hakediş hesaplamaları.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 shadow-sm">
                        <button onClick={handlePrevMonth} className="p-2 text-slate-500 hover:text-pnr-purple transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="px-4 font-bold font-mono text-slate-700 dark:text-slate-200 min-w-[140px] text-center">
                            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </div>
                        <button onClick={handleNextMonth} className="p-2 text-slate-500 hover:text-pnr-purple transition-colors">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <button
                        onClick={fetchSalaries}
                        className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-pnr-purple transition-colors shadow-sm"
                        title="Yenile"
                    >
                        <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-500">Hesaplanıyor...</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase">
                                <th className="p-4">Öğretmen</th>
                                <th className="p-4">Anlaşma Tipi</th>
                                <th className="p-4">Birim Ücret</th>
                                <th className="p-4 text-center">
                                    <span className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-200">
                                        {MONTH_NAMES[currentDate.getMonth()]} Ders Saati
                                    </span>
                                </th>
                                <th className="p-4">Toplam Hakediş</th>
                                <th className="p-4 text-center">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {teachers.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Kayıt bulunamadı.</td></tr>
                            ) : (
                                teachers.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4 font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-sm font-bold shadow-sm">
                                                {t.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            {t.name}
                                        </td>
                                        <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                                            {t.salaryType === 'hourly' ? 'Saatlik Ücret' : 'Aylık Sabit Maaş'}
                                        </td>
                                        <td className="p-4 text-sm font-mono text-slate-700 dark:text-slate-300">
                                            ₺{t.salaryAmount.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="inline-flex items-center justify-center min-w-[3rem] py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold rounded-lg border border-blue-100 dark:border-blue-800">
                                                {t.totalHours}
                                            </div>
                                        </td>
                                        <td className="p-4 text-base font-bold text-pnr-green">
                                            ₺{t.payableAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 text-center">
                                            {t.status === 'paid' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-bold border border-green-100 dark:border-green-800">
                                                    <CheckCircle2 size={12} /> Ödendi
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-100 dark:border-amber-800">
                                                    <Clock size={12} /> Bekliyor
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Salaries;
