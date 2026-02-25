
import React, { useState, useEffect } from 'react';
import {
  CheckSquare, Clock, Send, Inbox, Plus, X,
  User, Calendar, CheckCircle2,
  AlertCircle, ChevronRight, Trash2, AlertTriangle, AlertOctagon,
  MessageSquare, RefreshCcw, Loader2, ArrowRightLeft, StickyNote, Play
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { UserRole } from '../../types';

interface TodoTask {
  id: string;
  title: string;
  description: string;
  assignee_notes: string | null;
  assigner_id: string;
  assignee_id: string;
  assigner_name: string | null;
  assignee_name: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  is_priority: boolean;
  created_at: string;
  completed_at: string | null;
  is_system?: boolean;
}

interface Profile {
  id: string;
  name: string;
  role: UserRole;
}

interface TodoProps {
  canEdit?: boolean;
}

const STATUS_CONFIG = {
  pending: { label: 'Beklemede', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800' },
  in_progress: { label: 'Çalışma Aşamasında', icon: Play, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-800' },
  completed: { label: 'Tamamlandı', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-100 dark:border-green-800' },
};

const Todo: React.FC<TodoProps> = ({ canEdit = true }) => {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Detail / Edit Panel
  const [selectedTask, setSelectedTask] = useState<TodoTask | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<string>('');
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  // Form State
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee_id: '',
    is_priority: false
  });

  // --- Sorting helper ---
  const sortTasks = (list: TodoTask[]) => {
    return [...list].sort((a, b) => {
      if (a.is_system && !b.is_system) return -1;
      if (!a.is_system && b.is_system) return 1;
      if (a.is_priority && !b.is_priority) return -1;
      if (!a.is_priority && b.is_priority) return 1;
      // Status order: in_progress > pending > completed
      const statusOrder = { in_progress: 0, pending: 1, completed: 2 };
      const sa = statusOrder[a.status] ?? 1;
      const sb = statusOrder[b.status] ?? 1;
      if (sa !== sb) return sa - sb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);

      // 1. Fetch Tasks
      const { data: taskData, error: taskError } = await supabase
        .from('todos')
        .select('*')
        .or(`assignee_id.eq.${user.id},assigner_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (taskError) throw taskError;

      let allTasks: TodoTask[] = [];
      if (taskData) {
        allTasks = taskData.map((t: any) => ({
          ...t,
          assigner_name: t.assigner_name || 'Bilinmiyor',
          assignee_name: t.assignee_name || 'Bilinmiyor',
          is_priority: t.is_priority || false,
          assignee_notes: t.assignee_notes || '',
        }));
      }

      // 2. Fetch Profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, role')
        .order('name');

      if (profileError) console.error('Profil çekme hatası:', profileError);
      setProfiles(profileData || []);

      // 3. System Tasks
      const { data: unscheduledPeriods, error: periodError } = await supabase
        .from('instrument_periods')
        .select(`id, student_id, start_date, period_number, students ( full_name, teacher ), instrument_attendance ( id )`)
        .eq('status', 'active');

      if (!periodError && unscheduledPeriods) {
        const systemTasks: TodoTask[] = unscheduledPeriods
          .filter((p: any) => !p.instrument_attendance || p.instrument_attendance.length === 0)
          .map((p: any) => ({
            id: `system-${p.id}`,
            title: `Ders Programı Oluşturulmalı: ${p.students?.full_name}`,
            description: `${p.period_number}. Dönem (${new Date(p.start_date).toLocaleDateString('tr-TR')}) için ders kaydı bulunamadı.`,
            assignee_notes: null,
            assigner_id: 'system',
            assignee_id: user.id,
            assigner_name: 'Sistem Uyarısı',
            assignee_name: 'Yönetim',
            status: 'pending' as const,
            is_priority: false,
            created_at: p.start_date,
            completed_at: null,
            is_system: true,
          }));
        allTasks = [...systemTasks, ...allTasks];
      }

      setTasks(sortTasks(allTasks));
    } catch (error: any) {
      console.error("Error fetching todos:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

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
          status: 'pending',
          is_priority: newTask.is_priority
        });
      if (error) throw error;
      setIsModalOpen(false);
      setNewTask({ title: '', description: '', assignee_id: '', is_priority: false });
      fetchData();
    } catch (err: any) {
      alert("Görev oluşturulamadı: " + err.message);
    }
  };

  const togglePriority = async (taskId: string, currentPriority: boolean, isSystem = false) => {
    if (isSystem) return;
    const newPriority = !currentPriority;
    setTasks(prev => sortTasks(prev.map(t => t.id === taskId ? { ...t, is_priority: newPriority } : t)));
    try {
      const { error } = await supabase.from('todos').update({ is_priority: newPriority }).eq('id', taskId);
      if (error) throw error;
    } catch (err: any) {
      console.error("Priority update error:", err);
      fetchData();
    }
  };

  const deleteTask = async (taskId: string, isSystem = false) => {
    if (isSystem) return;
    if (!confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
    try {
      const { error } = await supabase.from('todos').delete().eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (selectedTask?.id === taskId) setSelectedTask(null);
    } catch (err: any) {
      alert("Silinemedi: " + err.message);
    }
  };

  // --- Detail Panel ---
  const openDetail = (task: TodoTask) => {
    setSelectedTask(task);
    setEditNotes(task.assignee_notes || '');
    setEditStatus(task.status);
    setEditAssigneeId(task.assignee_id);
  };

  // Check if current user is the assignee
  const isAssignee = selectedTask?.assignee_id === currentUser?.id;
  const isAssigner = selectedTask?.assigner_id === currentUser?.id;

  const saveDetail = async () => {
    if (!selectedTask || selectedTask.is_system) return;
    setSavingDetail(true);
    try {
      const updates: any = {};

      // Only assignee can change status and add notes
      if (isAssignee) {
        updates.assignee_notes = editNotes;
        updates.status = editStatus;
        updates.completed_at = editStatus === 'completed' ? new Date().toISOString() : null;
      }

      // Reassign (only assignee can reassign)
      if (isAssignee && editAssigneeId && editAssigneeId !== selectedTask.assignee_id) {
        const newAssigneeName = profiles.find(p => p.id === editAssigneeId)?.name || 'Bilinmiyor';
        const currentAssigneeName = selectedTask.assignee_name || 'Bilinmiyor';
        const now = new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const reassignNote = `[${now}] ${currentAssigneeName} → ${newAssigneeName}'e aktardı.`;

        // Append reassignment note to existing notes
        const existingNotes = editNotes ? editNotes.trim() : '';
        updates.assignee_notes = existingNotes ? `${existingNotes}\n${reassignNote}` : reassignNote;
        updates.assignee_id = editAssigneeId;
        // assignee_name will be set by the trigger automatically
      }

      const { error } = await supabase
        .from('todos')
        .update(updates)
        .eq('id', selectedTask.id);

      if (error) throw error;

      setSelectedTask(null);
      fetchData();
    } catch (err: any) {
      alert("Kaydetme hatası: " + err.message);
    } finally {
      setSavingDetail(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'incoming') return task.assignee_id === currentUser?.id;
    return task.assigner_id === currentUser?.id && !task.is_system;
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
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">Akademi içi iş paylaşımı ve takip merkezi.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} disabled={loading} className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-pnr-purple transition-colors" title="Yenile">
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {canEdit && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-pnr-purple hover:bg-pnr-indigo text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-pnr-purple/20 flex items-center justify-center gap-2 transition-all"
            >
              <Plus size={20} /> Yeni Görev Aktar
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full sm:w-fit">
        <button
          onClick={() => { setActiveTab('incoming'); setSelectedTask(null); }}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'incoming' ? 'bg-white dark:bg-slate-700 text-pnr-purple shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
        >
          <Inbox size={18} /> Bana Aktarılanlar
          {tasks.filter(t => t.assignee_id === currentUser?.id && t.status !== 'completed').length > 0 && (
            <span className="bg-pnr-red text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
              {tasks.filter(t => t.assignee_id === currentUser?.id && t.status !== 'completed').length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('outgoing'); setSelectedTask(null); }}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'outgoing' ? 'bg-white dark:bg-slate-700 text-pnr-purple shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
        >
          <Send size={18} /> Aktardıklarım
        </button>
      </div>

      {/* Main Content: Task List + Detail Panel */}
      <div className="flex gap-6 items-start">

        {/* Task List */}
        <div className={`space-y-3 transition-all ${selectedTask ? 'flex-1 min-w-0' : 'w-full'}`}>
          {loading ? (
            <div className="py-12 text-center text-slate-500">Görevler yükleniyor...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
              <CheckCircle2 size={48} className="text-slate-200 dark:text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">Bu bölümde henüz bir görev bulunmuyor.</p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
              const StatusIcon = sc.icon;
              const isSelected = selectedTask?.id === task.id;

              return (
                <div
                  key={task.id}
                  onClick={() => !task.is_system && openDetail(task)}
                  className={`
                    bg-white dark:bg-pnr-card border transition-all rounded-2xl p-4 md:p-5 flex items-start gap-4 group
                    ${task.is_system ? 'border-l-4 border-l-red-500 border-t border-r border-b border-slate-200 dark:border-slate-800' :
                      isSelected ? 'border-pnr-purple ring-2 ring-pnr-purple/20' :
                        task.is_priority ? 'border-l-4 border-l-amber-500 border-t border-r border-b border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10 cursor-pointer' :
                          task.status === 'completed' ? 'border-green-100 dark:border-green-900/30 opacity-75 cursor-pointer' :
                            'border-slate-200 dark:border-slate-800 hover:border-pnr-purple dark:hover:border-pnr-purple shadow-sm cursor-pointer'}
                  `}
                >
                  {/* Status Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${sc.bg} ${sc.border} border`}>
                    {task.is_system
                      ? <AlertTriangle size={16} className="text-red-500" />
                      : <StatusIcon size={16} className={sc.color} />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {task.is_priority && !task.is_system && (
                          <span className="text-amber-500 shrink-0" title="Öncelikli">
                            <AlertOctagon size={16} />
                          </span>
                        )}
                        <h3 className={`font-bold text-sm md:text-base leading-tight truncate ${task.status === 'completed' ? 'text-slate-400 line-through' : task.is_system ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                          {task.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Status Badge */}
                        <span className={`text-[10px] uppercase font-bold flex items-center gap-1 px-2 py-1 rounded-md border ${task.is_system ? 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : `${sc.color} ${sc.bg} ${sc.border}`}`}>
                          {task.is_system ? <><AlertCircle size={12} /> Sistem</> : <><StatusIcon size={12} /> {sc.label}</>}
                        </span>

                        {/* Notes indicator */}
                        {task.assignee_notes && !task.is_system && (
                          <span className="text-slate-400" title="Not var">
                            <StickyNote size={14} />
                          </span>
                        )}

                        {/* Priority Toggle */}
                        {canEdit && !task.is_system && task.status !== 'completed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); togglePriority(task.id, task.is_priority); }}
                            className={`p-1 rounded-lg transition-all ${task.is_priority ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100'}`}
                            title={task.is_priority ? "Önceliği Kaldır" : "Öncelikli Yap"}
                          >
                            <AlertOctagon size={14} />
                          </button>
                        )}

                        {/* Delete */}
                        {canEdit && activeTab === 'outgoing' && !task.is_system && (
                          <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className={task.is_system ? "text-red-500" : "text-pnr-purple"} />
                        <span>{activeTab === 'incoming' ? task.assigner_name : task.assignee_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} />
                        <span className="font-mono">{formatDate(task.created_at)}</span>
                      </div>
                      {task.is_system && (
                        <button
                          onClick={(e) => { e.stopPropagation(); window.location.hash = '/education/instrument-lessons'; }}
                          className="ml-auto text-xs text-pnr-purple hover:underline font-bold"
                        >
                          Yönet →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail / Edit Panel */}
        {selectedTask && !selectedTask.is_system && (
          <div className="w-full lg:w-[420px] shrink-0 bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden sticky top-6 animate-in slide-in-from-right-4 duration-300">

            {/* Panel Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-start">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">{selectedTask.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{selectedTask.description || 'Açıklama yok'}</p>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-red-500 p-1 shrink-0 ml-2">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">

              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  <div className="text-slate-400 uppercase font-bold mb-1">Aktaran</div>
                  <div className="font-bold text-slate-800 dark:text-white">{selectedTask.assigner_name}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                  <div className="text-slate-400 uppercase font-bold mb-1">Tarih</div>
                  <div className="font-mono text-slate-800 dark:text-white">{formatDate(selectedTask.created_at)}</div>
                </div>
              </div>

              {/* Status Selector — Only Assignee can change */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Durum</label>
                {isAssignee ? (
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG.pending][]).map(([key, conf]) => {
                      const Icon = conf.icon;
                      const isActive = editStatus === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setEditStatus(key)}
                          className={`
                            flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-bold
                            ${isActive
                              ? `${conf.bg} ${conf.color} border-current ring-2 ring-current/20`
                              : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
                            }
                          `}
                        >
                          <Icon size={18} />
                          <span className="leading-tight text-center">{conf.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`flex items-center gap-2 p-3 rounded-xl border ${STATUS_CONFIG[selectedTask.status]?.bg} ${STATUS_CONFIG[selectedTask.status]?.border}`}>
                    {(() => { const SC = STATUS_CONFIG[selectedTask.status]; const Icon = SC?.icon || Clock; return <Icon size={16} className={SC?.color} />; })()}
                    <span className={`text-sm font-bold ${STATUS_CONFIG[selectedTask.status]?.color}`}>
                      {STATUS_CONFIG[selectedTask.status]?.label || 'Beklemede'}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto">Sadece atanan kişi değiştirebilir</span>
                  </div>
                )}
              </div>

              {/* Assignee Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  <StickyNote size={12} className="inline mr-1" /> Ek Not
                </label>
                {isAssignee ? (
                  <textarea
                    rows={3}
                    placeholder="Bu görev hakkında not ekleyebilirsiniz..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none resize-none"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap min-h-[60px]">
                    {editNotes || <span className="text-slate-400 italic">Henüz not eklenmemiş</span>}
                  </div>
                )}
              </div>

              {/* Reassign — Only Assignee can reassign */}
              {isAssignee && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                    <ArrowRightLeft size={12} className="inline mr-1" /> Başka Kullanıcıya Aktar
                  </label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                    value={editAssigneeId}
                    onChange={(e) => setEditAssigneeId(e.target.value)}
                  >
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.id === selectedTask.assignee_id ? '(Mevcut)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">⚠ Aktarım yapıldığında otomatik not eklenir.</p>
                </div>
              )}

              {/* Save */}
              <button
                onClick={saveDetail}
                disabled={savingDetail}
                className="w-full bg-gradient-to-r from-pnr-purple to-pnr-indigo text-white font-bold py-3.5 rounded-xl shadow-lg shadow-pnr-purple/25 flex items-center justify-center gap-2 hover:opacity-95 transition-all disabled:opacity-60"
              >
                {savingDetail ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                {savingDetail ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE TASK MODAL */}
      {isModalOpen && canEdit && (
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
              {/* Assignee */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Kime Aktarılsın? *</label>
                <select
                  required
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                  value={newTask.assignee_id}
                  onChange={(e) => setNewTask({ ...newTask, assignee_id: e.target.value })}
                >
                  <option value="">Bir personel seçin...</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {profiles.length === 0 && !loading && (
                  <p className="text-xs text-red-500 mt-1">⚠ Profil listesi yüklenemedi. SQL scriptini çalıştırdığınızdan emin olun.</p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Görev Başlığı *</label>
                <input
                  type="text" required
                  placeholder="Yapılacak işin başlığı..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Detaylar / Notlar</label>
                <textarea
                  rows={4}
                  placeholder="İşin detaylarını buraya yazabilirsiniz..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none resize-none"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                ></textarea>
              </div>

              {/* Priority Toggle */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setNewTask({ ...newTask, is_priority: !newTask.is_priority })}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ${newTask.is_priority ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 shadow-sm ${newTask.is_priority ? 'translate-x-6' : 'translate-x-1'} mt-1`} />
                </button>
                <div className="flex items-center gap-2">
                  <AlertOctagon size={16} className={newTask.is_priority ? 'text-amber-500' : 'text-slate-400'} />
                  <span className={`text-sm font-medium ${newTask.is_priority ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    Öncelikli Görev
                  </span>
                </div>
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
