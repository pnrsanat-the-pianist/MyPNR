
import React, { useState } from 'react';
import { UserRole } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import AdminDashboard from './AdminDashboard';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';
import { Eye } from 'lucide-react';

interface DashboardProps {
    currentUserRole: UserRole;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUserRole }) => {
    const [viewRole, setViewRole] = useState<UserRole>(currentUserRole);

    // Update viewRole if prop changes (e.g. re-login)
    React.useEffect(() => {
        setViewRole(currentUserRole);
    }, [currentUserRole]);

    // Render Logic
    const renderContent = () => {
        switch (viewRole) {
            case UserRole.ADMIN:
            case UserRole.KURUCU:
            case UserRole.MUDUR:
                return <AdminDashboard />; // Managers also see Admin View for now
            case UserRole.OGRETMEN:
                return <TeacherDashboard />;
            case UserRole.VELI:
                return <StudentDashboard />;
            case UserRole.PERSONEL:
                return <AdminDashboard />; // Staff usually sees admin-like but restricted? Or new StaffDashboard if needed. Retaining Admin view for now as Staff usually works on leads etc.
            default:
                return <AdminDashboard />;
        }
    };

    return (
        <div className="w-full">
            {/* Admin Switcher Bar */}
            {currentUserRole === UserRole.ADMIN && (
                <div className="p-4 bg-slate-100 dark:bg-slate-800/50 mb-4 rounded-xl flex items-center gap-4 overflow-x-auto">
                    <span className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2 whitespace-nowrap">
                        <Eye size={14} /> Önizleme Modu:
                    </span>
                    <div className="flex gap-2">
                        {Object.values(UserRole).map(role => (
                            <button
                                key={role}
                                onClick={() => setViewRole(role)}
                                className={`
                                    px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                                    ${viewRole === role
                                        ? 'bg-pnr-purple text-white shadow-md'
                                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}
                                `}
                            >
                                {role}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {renderContent()}
        </div>
    );
};

export default Dashboard;
