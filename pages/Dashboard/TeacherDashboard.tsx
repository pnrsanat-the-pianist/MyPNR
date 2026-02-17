
import React from 'react';
import { BookOpen, Calendar, MessageSquare } from 'lucide-react';

const TeacherDashboard: React.FC = () => {
    return (
        <div className="w-full max-w-full space-y-6 animate-in fade-in">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">Öğretmen Paneli</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Quick Actions / Stats */}
                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
                    <h2 className="font-bold flex items-center gap-2 mb-4 dark:text-white"><Calendar className="text-pnr-purple" /> Ders Programı</h2>
                    <p className="text-slate-500 text-sm">Bugün için programlar burada listelenecek.</p>
                </div>

                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
                    <h2 className="font-bold flex items-center gap-2 mb-4 dark:text-white"><BookOpen className="text-pnr-blue" /> Öğrencilerim</h2>
                    <p className="text-slate-500 text-sm">Sınıf ve öğrenci listeleri.</p>
                </div>

                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
                    <h2 className="font-bold flex items-center gap-2 mb-4 dark:text-white"><MessageSquare className="text-pnr-green" /> Mesajlar</h2>
                    <p className="text-slate-500 text-sm">Veli ve idare mesajları.</p>
                </div>
            </div>
        </div>
    );
};

export default TeacherDashboard;
