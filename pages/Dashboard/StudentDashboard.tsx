
import React from 'react';
import { Calendar, CreditCard, Music } from 'lucide-react';

const StudentDashboard: React.FC = () => {
    return (
        <div className="w-full max-w-full space-y-6 animate-in fade-in">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">Veli / Öğrenci Paneli</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Quick Actions / Stats */}
                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
                    <h2 className="font-bold flex items-center gap-2 mb-4 dark:text-white"><Calendar className="text-pnr-orange" /> Ders Takvimi</h2>
                    <p className="text-slate-500 text-sm">Gelecek dersler ve etkinlikler.</p>
                </div>

                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
                    <h2 className="font-bold flex items-center gap-2 mb-4 dark:text-white"><CreditCard className="text-pnr-red" /> Ödemeler</h2>
                    <p className="text-slate-500 text-sm">Ödeme takibi ve faturalar.</p>
                </div>

                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
                    <h2 className="font-bold flex items-center gap-2 mb-4 dark:text-white"><Music className="text-pnr-purple" /> Gelişim Raporu</h2>
                    <p className="text-slate-500 text-sm">Ders notları ve öğretmen yorumları.</p>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
