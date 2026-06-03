import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, DoorOpen, Edit, Plus, RefreshCcw, Save, Trash2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface Classroom {
  id: string;
  name: string;
  allowed_branches: string[];
  is_active: boolean;
  created_at?: string;
}

interface BranchOption {
  id: string;
  name: string;
  mainBranchName: string;
}

interface ClassroomsProps {
  canEdit?: boolean;
}

const Classrooms: React.FC<ClassroomsProps> = ({ canEdit = true }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', allowedBranches: [] as string[], isActive: true });

  const groupedBranchOptions = useMemo(() => {
    return branchOptions.reduce<Record<string, BranchOption[]>>((groups, branch) => {
      const groupName = branch.mainBranchName || 'Branşlar';
      groups[groupName] = [...(groups[groupName] || []), branch];
      return groups;
    }, {});
  }, [branchOptions]);

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', allowedBranches: [], isActive: true });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let classroomData: any[] = [];
      const { data, error } = await supabase
        .from('classrooms')
        .select('id, name, allowed_branches, is_active, created_at')
        .order('name');

      if (error) {
        if (error.message?.includes('allowed_branches')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('classrooms')
            .select('id, name, is_active, created_at')
            .order('name');

          if (fallbackError) throw fallbackError;
          classroomData = fallbackData || [];
        } else {
          throw error;
        }
      } else {
        classroomData = data || [];
      }

      setClassrooms(classroomData.map((item: any) => ({
        ...item,
        allowed_branches: Array.isArray(item.allowed_branches) ? item.allowed_branches : []
      })));

      const { data: branchData, error: branchError } = await supabase
        .from('main_branches')
        .select(`
          id,
          name,
          sub_branches (
            id,
            name
          )
        `)
        .order('created_at', { ascending: true });

      if (branchError) throw branchError;
      const formattedBranches = (branchData || []).flatMap((mainBranch: any) =>
        (mainBranch.sub_branches || [])
          .map((subBranch: any) => ({
            id: subBranch.id,
            name: subBranch.name,
            mainBranchName: mainBranch.name || 'Branşlar'
          }))
          .sort((a: BranchOption, b: BranchOption) => a.name.localeCompare(b.name, 'tr-TR'))
      );
      setBranchOptions(formattedBranches);
    } catch (error: any) {
      console.error('Classrooms fetch error:', error);
      alert('Derslikler yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || !formData.name.trim()) return;

    const payload = {
      name: formData.name.trim(),
      allowed_branches: formData.allowedBranches,
      is_active: formData.isActive
    };

    setLoading(true);
    try {
      const { error } = editingId
        ? await supabase.from('classrooms').update(payload).eq('id', editingId)
        : await supabase.from('classrooms').insert(payload);

      if (error) throw error;
      resetForm();
      await fetchData();
    } catch (error: any) {
      console.error('Classroom save error:', error);
      alert('Derslik kaydedilemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (classroom: Classroom) => {
    if (!canEdit) return;
    setEditingId(classroom.id);
    setFormData({
      name: classroom.name,
      allowedBranches: classroom.allowed_branches || [],
      isActive: classroom.is_active
    });
  };

  const toggleBranchSelection = (branchName: string) => {
    setFormData(prev => ({
      ...prev,
      allowedBranches: prev.allowedBranches.includes(branchName)
        ? prev.allowedBranches.filter(item => item !== branchName)
        : [...prev.allowedBranches, branchName]
    }));
  };

  const handleToggleStatus = async (classroom: Classroom) => {
    if (!canEdit) return;
    setClassrooms(prev => prev.map(item => item.id === classroom.id ? { ...item, is_active: !item.is_active } : item));

    const { error } = await supabase
      .from('classrooms')
      .update({ is_active: !classroom.is_active })
      .eq('id', classroom.id);

    if (error) {
      alert('Derslik durumu güncellenemedi: ' + error.message);
      fetchData();
    }
  };

  const handleDelete = async (classroom: Classroom) => {
    if (!canEdit) return;
    if (!confirm(`${classroom.name} dersliğini silmek istediğinize emin misiniz?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('classrooms').delete().eq('id', classroom.id);
      if (error) throw error;
      if (editingId === classroom.id) resetForm();
      await fetchData();
    } catch (error: any) {
      alert('Derslik silinemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Derslikler</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">Okul içindeki derslikleri ve uygun branşlarını tanımlayın.</p>
        </div>
        <button
          onClick={fetchData}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 w-fit"
        >
          <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <form onSubmit={handleSubmit} className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
            <DoorOpen size={20} className="text-pnr-purple" />
            {editingId ? 'Dersliği Düzenle' : 'Yeni Derslik'}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Derslik Adı</label>
            <input
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              disabled={!canEdit}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none disabled:opacity-60"
              placeholder="Örn: Bale Stüdyosu"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Uygun Branşlar</label>
            <div className="max-h-64 overflow-y-auto bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-3">
              {Object.keys(groupedBranchOptions).length === 0 ? (
                <div className="text-sm text-slate-400">Branş bulunamadı.</div>
              ) : Object.entries(groupedBranchOptions).map(([mainBranchName, branches]) => (
                <div key={mainBranchName} className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{mainBranchName}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {branches.map(branch => (
                      <label key={branch.id} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.allowedBranches.includes(branch.name)}
                          onChange={() => toggleBranchSelection(branch.name)}
                          disabled={!canEdit}
                          className="w-4 h-4 rounded text-pnr-purple focus:ring-pnr-purple"
                        />
                        <span>{branch.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 cursor-pointer">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Aktif</span>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(event) => setFormData({ ...formData, isActive: event.target.checked })}
              disabled={!canEdit}
              className="w-4 h-4 text-pnr-purple rounded focus:ring-pnr-purple"
            />
          </label>

          {canEdit && (
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={loading || !formData.name.trim()} className="flex-1 bg-pnr-purple hover:bg-pnr-indigo text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                <Save size={16} /> {editingId ? 'Güncelle' : 'Kaydet'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="px-4 py-2.5 rounded-xl font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  İptal
                </button>
              )}
            </div>
          )}
        </form>

        <div className="lg:col-span-2 bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white">Tanımlı Derslikler</div>
          {loading && classrooms.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Derslikler yükleniyor...</div>
          ) : classrooms.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Henüz derslik tanımlanmamış.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {classrooms.map(classroom => (
                <div key={classroom.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{classroom.name}</div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${classroom.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                        {classroom.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {classroom.allowed_branches.length > 0 ? classroom.allowed_branches.join(', ') : 'Uygun branş seçilmedi'}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleToggleStatus(classroom)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" title={classroom.is_active ? 'Pasife al' : 'Aktife al'}>
                        {classroom.is_active ? <XCircle size={16} className="text-slate-500" /> : <CheckCircle2 size={16} className="text-green-600" />}
                      </button>
                      <button onClick={() => handleEdit(classroom)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" title="Düzenle">
                        <Edit size={16} className="text-pnr-purple" />
                      </button>
                      <button onClick={() => handleDelete(classroom)} className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Sil">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Classrooms;
