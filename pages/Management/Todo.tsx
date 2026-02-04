
import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, Clock, Send, Inbox, Plus, X, 
  User, Calendar, MessageSquare, CheckCircle2, 
  AlertCircle, ChevronRight, Search, Trash2, Filter, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { UserRole } from '../../types';

interface TodoTask {
  id: string;
  title: string;
  description: string;
  assigner_id: string;
  assignee_id: string;
  status: 'pending' | 'completed';
  created_at: string;
  completed_at: string | null;
  // Joined data
  assigner_name?: string;
  assignee_name?: string;
  // Visual flag for system generated tasks
  is_system?: boolean;
}

interface Profile {
  id: string;
  name: string;
  role: UserRole;
}

const Todo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee_id: ''
  });

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);

      // 1. Fetch Manual Tasks
      const { data: taskData, error: taskError } = await supabase
        .from('todos')
        .select(`
          *,
          assigner:profiles!fk_assigner(name),
          assignee:profiles!fk_assignee(name)
        `)
        .or(`assignee_id.eq.${user.id},assigner_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (taskError) throw taskError;

      let allTasks: TodoTask[] = [];

      if (taskData) {
        allTasks = taskData.map((t: any) => ({
          ...t,
          assigner_name: t.assigner?.name,
          assignee_name: t.assignee?.name
        }));
      }

      // 2. Fetch Profiles for Assignment
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name, role')
        .neq('id', user.id) // Don't assign to self (optional)
        .eq('status', 'active');
      
      setProfiles(profileData || []);

      // 3. FETCH SYSTEM TASKS (Periods without scheduled lessons)
      // Only show these in 'incoming' for Admin/Managers, or if we want them visible to all relevant staff
      const { data: unscheduledPeriods, error: periodError } = await supabase
        .from('instrument_periods')
        .select(`
            id, 
            student_id,
            start_date,
            period_number,
            students ( full_name, teacher ),
            instrument_attendance ( id )
        `)
        .eq('status', 'active');

      if (!periodError && unscheduledPeriods) {
          const systemTasks: TodoTask[] = unscheduledPeriods
            .filter((p: any) => !p.instrument_attendance || p.instrument_attendance.length === 0)
            .map((p: any) => ({
                id: `system-${p.id}`,
                title: `Ders Programı Oluşturulmalı: ${p.students?.full_name}`,
                description: `${p.period_number}. Dönem (${new Date(p.start_date).toLocaleDateString('tr-TR')}) için ders kaydı bulunamadı. Lütfen "Enstrüman Dersleri" sayfasından planlama yapınız.`,
                assigner_id: 'system',
                assignee_id: user.id, // Assign to current user effectively so it shows in incoming
                status: 'pending',
                created_at: p.start_date, // Use period start as task date
                completed_at: null,
                assigner_name: 'Sistem Uyarısı',
                assignee_name: 'Yönetim',
                is_system: true
            }));
          
          // Combine: System tasks first
          allTasks = [...systemTasks, ...allTasks];
      }

      setTasks(allTasks);

    } catch (error: any) {
      console.error("Error fetching todos:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Handlers ---
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.assignee_id) return;

    try {
      const { error } = await supabase
        .from('todos')
        .insert({
          title: newTask.title,
          description: newTask.description,
          assigner_id: currentUser.id,
          assignee_id: newTask.assignee_id,
          status: 'pending'
        });

      if (error) throw error;
      
      setIsModalOpen(false);
      setNewTask({ title: '', description: '', assignee_id: '' });
      fetchData();
    } catch (err: any) {
      alert("Görev oluşturulamadı: " + err.message);
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string, isSystem = false) => {
    if (isSystem) {
        alert("Sistem görevleri manuel olarak kapatılamaz. İlgili öğrenciye ders programı atandığında bu görev otomatik olarak kalkacaktır.");
        return;
    }

    const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;

    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as any, completed_at: completedAt } : t));

    try {
      const { error } = await supabase
        .from('todos')
        .update({ status: newStatus, completed_at: completedAt })
        .eq('id', taskId);
      
      if (error) throw error;
    } catch (err: any) {
      console.error("Status update error:", err);
      fetchData(); // Revert
    }
  };

  const deleteTask = async (taskId: string, isSystem = false) => {
    if (isSystem) return; // Cannot delete system tasks directly
    if (!confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
    try {
      const { error } = await supabase.from('todos').delete().eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err: any) {
      alert("Silinemedi: " + err.message);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'incoming') return task.assignee_id === currentUser?.id;
    return task.assigner_id === currentUser?.id && !task.is_system; // Don't show system tasks in outgoing
  });

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">ToDo & Görev Takibi</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">
            Akademi içi iş paylaşımı ve takip merkezi.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-pnr-purple hover:bg-pnr-indigo text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-pnr-purple/20 flex items-center justify-center gap-2 transition-all"
        >
          <Plus size={20} /> Yeni Görev Aktar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full sm:w-fit">
        <button 
          onClick={() => setActiveTab('incoming')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'incoming' ? 'bg-white dark:bg-slate-700 text-pnr-purple shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
        >
          <Inbox size={18} /> Bana Aktarılanlar
          {tasks.filter(t => t.assignee_id === currentUser?.id && t.status === 'pending').length > 0 && (
            <span className="bg-pnr-red text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
              {tasks.filter(t => t.assignee_id === currentUser?.id && t.status === 'pending').length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('outgoing')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'outgoing' ? 'bg-white dark:bg-slate-700 text-pnr-purple shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
        >
          <Send size={18} /> Aktardıklarım
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-slate-500">Görevler yükleniyor...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
            <CheckCircle2 size={48} className="text-slate-200 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">Bu bölümde henüz bir görev bulunmuyor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredTasks.map(task => (
              <div 
                key={task.id} 
                className={`
                  bg-white dark:bg-pnr-card border transition-all rounded-2xl p-4 md:p-5 flex items-start gap-4 group
                  ${task.is_system ? 'border-l-4 border-l-red-500 border-t border-r border-b border-slate-200 dark:border-slate-800' : 
                    task.status === 'completed' ? 'border-green-100 dark:border-green-900/30 opacity-75' : 'border-slate-200 dark:border-slate-800 hover:border-pnr-purple dark:hover:border-pnr-purple shadow-sm'}
                `}
              >
                {/* Status Toggle (Only for the Assignee) */}
                <button 
                  onClick={() => activeTab === 'incoming' && toggleTaskStatus(task.id, task.status, task.is_system)}
                  disabled={activeTab === 'outgoing' || task.is_system}
                  className={`
                    w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all mt-1
                    ${task.is_system 
                        ? 'border-red-200 bg-red-50 text-red-500 cursor-not-allowed'
                        : task.status === 'completed' 
                            ? 'bg-pnr-green border-pnr-green text-white cursor-pointer' 
                            : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-pnr-purple cursor-pointer'
                    }
                    ${activeTab === 'outgoing' ? 'cursor-default' : ''}
                  `}
                  title={task.is_system ? "Sistem uyarısı (Otomatik kapanır)" : "Tamamla"}
                >
                  {task.is_system ? <AlertTriangle size={14} /> : <CheckCircle2 size={18} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className={`font-bold text-base md:text-lg leading-tight ${task.status === 'completed' ? 'text-slate-400 line-through' : task.is_system ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.is_system ? (
                          <span className="text-[10px] uppercase font-bold text-red-500 flex items-center gap-1 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md border border-red-100 dark:border-red-800">
                            <AlertCircle size={12}/> Sistem
                          </span>
                      ) : task.status === 'completed' ? (
                        <span className="text-[10px] uppercase font-bold text-pnr-green flex items-center gap-1 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md border border-green-100 dark:border-green-800">
                          <CheckCircle2 size={12}/> Tamamlandı
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-amber-500 flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md border border-amber-100 dark:border-amber-800">
                          <Clock size={12}/> Beklemede
                        </span>
                      )}
                      {activeTab === 'outgoing' && !task.is_system && (
                        <button onClick={() => deleteTask(task.id)} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <p className={`text-sm mt-1 mb-4 ${task.status === 'completed' ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    {task.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <User size={14} className={task.is_system ? "text-red-500" : "text-pnr-purple"} />
                      <span>{activeTab === 'incoming' ? 'Aktaran:' : 'Atanan:'}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {activeTab === 'incoming' ? task.assigner_name : task.assignee_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar size={14} />
                      <span>{activeTab === 'incoming' ? 'Aktarılma:' : 'Tarih:'}</span>
                      <span className="font-mono">{formatDate(task.created_at)}</span>
                    </div>
                    {task.status === 'completed' && task.completed_at && (
                      <div className="flex items-center gap-2 text-xs text-pnr-green">
                        <CheckCircle2 size={14} />
                        <span>Tamamlanma:</span>
                        <span className="font-mono">{formatDate(task.completed_at)}</span>
                      </div>
                    )}
                    {task.is_system && (
                        <button 
                            onClick={() => window.location.hash = '/education/instrument-lessons'}
                            className="ml-auto text-xs text-pnr-purple hover:underline font-bold"
                        >
                            Yönet
                        </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE TASK MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-pnr-card w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus size={24} className="text-pnr-purple" /> Görev Aktar
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Kime Aktarılsın? *</label>
                <select 
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                  value={newTask.assignee_id}
                  onChange={(e) => setNewTask({...newTask, assignee_id: e.target.value})}
                >
                  <option value="">Bir personel seçin...</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Görev Başlığı *</label>
                <input 
                  type="text" required
                  placeholder="Yapılacak işin başlığı..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Detaylar / Notlar</label>
                <textarea 
                  rows={4}
                  placeholder="İşin detaylarını buraya yazabilirsiniz..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none resize-none"
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                ></textarea>
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  className="w-full bg-gradient-to-r from-pnr-purple to-pnr-indigo text-white font-bold py-4 rounded-xl shadow-lg shadow-pnr-purple/25 flex items-center justify-center gap-2 hover:opacity-95 transition-all"
                >
                  <Send size={20} /> Görevi Aktar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Todo;
