import React, { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, X, Music, Drama, Mic, Drum, Piano, Guitar, Save, RefreshCcw, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// --- Types ---
interface Teacher {
  id: string;
  name: string;
}

interface SubBranch {
  id: string;
  name: string;
  teachers: Teacher[];
}

interface MainBranch {
  id: string;
  name: string;
  icon: 'dance' | 'music' | 'default';
  subBranches: SubBranch[];
}

const Branches: React.FC = () => {
  const [branches, setBranches] = useState<MainBranch[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]); // List for dropdown
  const [loading, setLoading] = useState(true);
  
  // Inputs
  const [newMainBranchName, setNewMainBranchName] = useState('');
  const [subBranchInputs, setSubBranchInputs] = useState<Record<string, string>>({});

  // Teacher Assignment Modal State
  const [assignModal, setAssignModal] = useState<{mainId: string, subId: string, subName: string} | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Teachers for Dropdown
      const { data: tData, error: tError } = await supabase
        .from('teachers')
        .select('id, name')
        .eq('status', 'active') // Only active teachers
        .order('name');
      
      if (tError) throw tError;
      setAllTeachers(tData || []);

      // 2. Fetch Hierarchy
      // We need: Main Branch -> Sub Branches -> Teachers
      const { data: bData, error: bError } = await supabase
        .from('main_branches')
        .select(`
          id, 
          name, 
          icon,
          sub_branches (
            id, 
            name,
            sub_branch_teachers (
              teachers (
                id, 
                name
              )
            )
          )
        `)
        .order('created_at', { ascending: true });

      if (bError) throw bError;

      // 3. Transform Data Structure
      if (bData) {
        const formatted: MainBranch[] = bData.map((main: any) => ({
          id: main.id,
          name: main.name,
          icon: main.icon || 'default',
          subBranches: (main.sub_branches || []).map((sub: any) => ({
            id: sub.id,
            name: sub.name,
            teachers: (sub.sub_branch_teachers || [])
              .map((rel: any) => rel.teachers)
              .filter((t: any) => t !== null) // Filter out nulls if join fails
              .sort((a: any, b: any) => a.name.localeCompare(b.name))
          })).sort((a: any, b: any) => a.name.localeCompare(b.name))
        }));
        setBranches(formatted);
      }

    } catch (error: any) {
      console.error('Error fetching branches:', error);
      alert('Veri yüklenirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Icons Helper ---
  const getBranchIcon = (type: string) => {
    switch(type) {
      case 'dance': return <Drama className="text-pnr-purple" size={24} />;
      case 'music': return <Music className="text-pnr-purple" size={24} />;
      default: return <Layers className="text-pnr-purple" size={24} />;
    }
  };

  const getSubBranchIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('bateri')) return <Drum size={18} className="text-slate-400" />;
    if (n.includes('piyano')) return <Piano size={18} className="text-slate-400" />;
    if (n.includes('gitar') || n.includes('ukulele')) return <Guitar size={18} className="text-slate-400" />;
    if (n.includes('şan') || n.includes('ses')) return <Mic size={18} className="text-slate-400" />;
    return <Layers size={18} className="text-slate-400" />;
  };

  // --- Handlers ---

  // 1. Add Main Branch
  const handleAddMainBranch = async () => {
    if (!newMainBranchName.trim()) return;

    // Auto-detect icon based on name
    let iconType = 'default';
    const lowerName = newMainBranchName.toLowerCase();
    if (lowerName.includes('müzik') || lowerName.includes('enstrüman') || lowerName.includes('piyano') || lowerName.includes('gitar')) {
        iconType = 'music';
    } else if (lowerName.includes('dans') || lowerName.includes('bale') || lowerName.includes('sahne')) {
        iconType = 'dance';
    }

    try {
      const { error } = await supabase
        .from('main_branches')
        .insert({ name: newMainBranchName, icon: iconType });
      
      if (error) throw error;
      setNewMainBranchName('');
      fetchData();
    } catch (err: any) {
      alert('Üst branş eklenemedi: ' + err.message);
    }
  };

  // 2. Delete Main Branch
  const handleDeleteMainBranch = async (id: string) => {
    if (confirm('Bu üst branşı ve altındaki tüm dersleri silmek istediğinize emin misiniz?')) {
      try {
        const { error } = await supabase
          .from('main_branches')
          .delete()
          .eq('id', id);
        if (error) throw error;
        fetchData();
      } catch (err: any) {
        alert('Silme işlemi başarısız: ' + err.message);
      }
    }
  };

  // 3. Add Sub Branch
  const handleAddSubBranch = async (mainBranchId: string) => {
    const name = subBranchInputs[mainBranchId];
    if (!name?.trim()) return;

    try {
      const { error } = await supabase
        .from('sub_branches')
        .insert({ main_branch_id: mainBranchId, name: name });
      
      if (error) throw error;
      setSubBranchInputs({ ...subBranchInputs, [mainBranchId]: '' });
      fetchData();
    } catch (err: any) {
      alert('Alt branş eklenemedi: ' + err.message);
    }
  };

  // 4. Delete Sub Branch
  const handleDeleteSubBranch = async (subBranchId: string) => {
    if(!confirm('Bu dersi silmek istiyor musunuz?')) return;
    try {
        const { error } = await supabase.from('sub_branches').delete().eq('id', subBranchId);
        if (error) throw error;
        fetchData();
    } catch (err: any) {
        alert('Silinemedi: ' + err.message);
    }
  };

  // 5. Open Teacher Modal
  const openTeacherModal = (mainId: string, subId: string, subName: string) => {
    setAssignModal({ mainId, subId, subName });
    setSelectedTeacherId(''); // Reset selection
  };

  // 6. Save Teacher Assignment
  const handleAssignTeacher = async () => {
    if (!assignModal || !selectedTeacherId) return;
    
    try {
       const { error } = await supabase
         .from('sub_branch_teachers')
         .insert({ 
            sub_branch_id: assignModal.subId, 
            teacher_id: selectedTeacherId 
         });
       
       if (error) {
         if (error.code === '23505') { // Unique violation
            alert("Bu öğretmen zaten bu branşa atanmış.");
         } else {
            throw error;
         }
       } else {
           fetchData();
           setAssignModal(null);
       }
    } catch (err: any) {
        alert('Öğretmen atanamadı: ' + err.message);
    }
  };

  // 7. Remove Teacher Assignment
  const handleRemoveTeacher = async (subBranchId: string, teacherId: string) => {
    if(!confirm('Öğretmeni bu branştan çıkarmak istiyor musunuz?')) return;
    try {
        const { error } = await supabase
            .from('sub_branch_teachers')
            .delete()
            .eq('sub_branch_id', subBranchId)
            .eq('teacher_id', teacherId);
        
        if (error) throw error;
        fetchData();
    } catch (err: any) {
        alert('İşlem başarısız: ' + err.message);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Branş Yönetimi</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Bölüm (Üst Branş), Ders (Alt Branş) ve Öğretmen hiyerarşisi.</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Refresh Button */}
            <button 
                onClick={fetchData} 
                className="p-2 bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:text-pnr-purple transition-colors"
                title="Yenile"
            >
                <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
            </button>

            {/* Add Main Branch Input */}
            <div className="flex items-center gap-2 bg-white dark:bg-pnr-card p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg flex-1 md:flex-none">
            <Layers className="text-pnr-purple ml-2 shrink-0" size={20} />
            <input 
                type="text"
                value={newMainBranchName}
                onChange={(e) => setNewMainBranchName(e.target.value)}
                placeholder="Yeni Üst Branş (Örn: Müzik)"
                className="flex-1 bg-transparent border-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-0 text-sm w-full md:w-64"
                onKeyDown={(e) => e.key === 'Enter' && handleAddMainBranch()}
            />
            <button 
                onClick={handleAddMainBranch}
                className="bg-pnr-purple hover:bg-pnr-indigo text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
            >
                Oluştur
            </button>
            </div>
        </div>
      </div>

      {loading && branches.length === 0 ? (
          <div className="text-center py-10 text-slate-500">Yükleniyor...</div>
      ) : (
        /* Main Branches Grid */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {branches.map((branch) => (
            <div key={branch.id} className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
                
                {/* Branch Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
                <div className="flex items-center gap-3">
                    {getBranchIcon(branch.icon)}
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">{branch.name}</h2>
                </div>
                <button 
                    onClick={() => handleDeleteMainBranch(branch.id)}
                    className="text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                >
                    <Trash2 size={18} />
                </button>
                </div>

                {/* Sub Branches List */}
                <div className="p-4 space-y-3 flex-1">
                {branch.subBranches.length === 0 && (
                    <div className="text-sm text-slate-400 text-center py-4 italic">Alt branş bulunamadı.</div>
                )}
                {branch.subBranches.map((sub) => (
                    <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 group hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                    
                    {/* Left: Icon & Name */}
                    <div className="flex items-center gap-3 w-full sm:w-40 shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-transparent flex items-center justify-center shrink-0">
                        {getSubBranchIcon(sub.name)}
                        </div>
                        <span className="font-medium text-slate-700 dark:text-slate-200 text-sm truncate">{sub.name}</span>
                        
                        {/* Mobile Delete Button */}
                        <button 
                        onClick={() => handleDeleteSubBranch(sub.id)}
                        className="ml-auto sm:hidden text-slate-400 hover:text-red-500 p-1"
                        >
                        <Trash2 size={16} />
                        </button>
                    </div>

                    {/* Right: Teachers */}
                    <div className="flex-1 flex flex-wrap items-center gap-2">
                        {sub.teachers.map((teacher) => (
                        <div key={teacher.id} className="flex items-center gap-1.5 bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 text-xs text-slate-600 dark:text-slate-300">
                            <span>{teacher.name}</span>
                            <button 
                            onClick={() => handleRemoveTeacher(sub.id, teacher.id)}
                            className="hover:text-red-400 text-slate-400 dark:text-slate-500"
                            title="Öğretmeni Çıkar"
                            >
                            <X size={12} />
                            </button>
                        </div>
                        ))}
                        
                        <button 
                        onClick={() => openTeacherModal(branch.id, sub.id, sub.name)}
                        className="flex items-center gap-1 text-xs text-pnr-purple hover:text-pnr-cyan font-medium px-2 py-1 rounded-md hover:bg-pnr-purple/10 transition-colors"
                        >
                        <Plus size={12} />
                        Öğretmen
                        </button>
                    </div>

                    {/* Desktop Delete Sub Branch Action */}
                    <div className="hidden sm:block sm:opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                        <button 
                        onClick={() => handleDeleteSubBranch(sub.id)}
                        className="text-slate-400 dark:text-slate-600 hover:text-red-500 p-1"
                        title="Branşı Sil"
                        >
                        <Trash2 size={16} />
                        </button>
                    </div>

                    </div>
                ))}
                </div>

                {/* Footer: Add Sub Branch */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20">
                <div className="flex items-center gap-2">
                    <input 
                    type="text" 
                    value={subBranchInputs[branch.id] || ''}
                    onChange={(e) => setSubBranchInputs({ ...subBranchInputs, [branch.id]: e.target.value })}
                    placeholder={`${branch.name} altına branş ekle...`}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-pnr-purple placeholder:text-slate-400 dark:placeholder:text-slate-600 w-full min-w-0"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubBranch(branch.id)}
                    />
                    <button 
                    onClick={() => handleAddSubBranch(branch.id)}
                    className="bg-slate-200 dark:bg-slate-700 hover:bg-pnr-purple hover:text-white text-slate-600 dark:text-white p-2 rounded-lg transition-colors shrink-0"
                    >
                    <Plus size={18} />
                    </button>
                </div>
                </div>

            </div>
            ))}
        </div>
      )}

      {/* TEACHER ASSIGNMENT MODAL */}
      {assignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-pnr-card w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Öğretmen Ata</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            <span className="font-bold text-pnr-purple">{assignModal.subName}</span> branşına öğretmen seçiniz.
                        </p>
                    </div>
                    <button onClick={() => setAssignModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <select 
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none appearance-none cursor-pointer"
                            value={selectedTeacherId}
                            onChange={(e) => setSelectedTeacherId(e.target.value)}
                        >
                            <option value="">Seçiniz...</option>
                            {allTeachers.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <UserPlus size={18} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            onClick={() => setAssignModal(null)} 
                            className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-sm font-medium px-3 py-2"
                        >
                            İptal
                        </button>
                        <button 
                            onClick={handleAssignTeacher} 
                            disabled={!selectedTeacherId}
                            className="bg-pnr-purple hover:bg-pnr-indigo text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-pnr-purple/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Save size={16} />
                            Kaydet
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default Branches;