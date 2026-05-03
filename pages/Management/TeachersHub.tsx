import React from 'react';
import { GraduationCap, LayoutGrid, UserPlus } from 'lucide-react';
import Teachers from './Teachers';
import CandidateTeachers from './CandidateTeachers';

interface TeachersHubProps {
  canEdit?: boolean;
  currentPath?: string;
}

const tabs = [
  {
    key: 'staff',
    label: 'Öğretmen Kadromuz',
    path: '/management/teachers',
    icon: LayoutGrid
  },
  {
    key: 'candidates',
    label: 'Aday Öğretmen',
    path: '/management/teachers/candidates',
    icon: UserPlus
  }
];

const TeachersHub: React.FC<TeachersHubProps> = ({ canEdit = true, currentPath = '/management/teachers' }) => {
  const activeTab = currentPath === '/management/teachers/candidates' ? 'candidates' : 'staff';

  return (
    <div className="space-y-4">
      <div className="px-4 md:px-6 pt-4 md:pt-6 max-w-[1600px] mx-auto">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-4 md:p-5 border border-slate-700/60 shadow-xl shadow-slate-900/10 overflow-hidden relative">
          <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.18),transparent_65%)]" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-amber-300 shrink-0">
                <GraduationCap size={24} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight font-display">Öğretmen Alanı</h1>
                <p className="text-sm md:text-base text-slate-300 mt-1">Kadroyu kart görünümünde yönet, aday öğretmen başvurularını ayrı akışta takip et.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/5 p-1 border border-white/10 self-start lg:self-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <a
                    key={tab.key}
                    href={`#${tab.path}`}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-white text-slate-900 shadow-md' : 'text-slate-200 hover:bg-white/10 hover:text-white'}`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'candidates' ? <CandidateTeachers canEdit={canEdit} /> : <Teachers canEdit={canEdit} />}
    </div>
  );
};

export default TeachersHub;
