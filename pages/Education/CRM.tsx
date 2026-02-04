
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  UserPlus, Search, Filter, MoreHorizontal, X, 
  User, Calendar, MapPin, Layers, GraduationCap, 
  Phone, Mail, Briefcase, Users, Plus, Trash2,
  ChevronDown, ChevronRight, Check, HeartPulse, Share2, FileText, Edit,
  ArrowUpDown, ArrowUp, ArrowDown, RefreshCcw, Upload
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// --- Types ---
interface BranchSelection {
  mainBranch: string;
  subBranch: string;
  teacher: string;
  startDate: string;
  mebCode: string;
  mebDate: string;
}

interface ParentInfo {
  name: string;
  relation: 'Anne' | 'Baba' | 'Diğer';
  otherRelation?: string;
  job: string;
  tc: string;
  phone: string;
  email: string;
}

interface Enrollment {
  id: string; 
  name: string;
  dob: string;
  tc: string;
  address: string;
  status: 'active' | 'trial' | 'passive';
  
  socialMediaApproval: 'Evet' | 'Hayır';
  healthCondition: 'Evet' | 'Hayır';
  healthConditionDetails?: string;

  mainBranch: string;
  subBranch: string;
  teacher: string;
  startDate: string;
  mebCode?: string;
  mebDate?: string;
  
  parents: ParentInfo[];
}

interface CRMProps {
  canEdit: boolean; // Received from App.tsx
}

const INITIAL_PARENT: ParentInfo = {
  name: '', relation: 'Anne', job: '', tc: '', phone: '', email: ''
};

const INITIAL_BRANCH: BranchSelection = {
  mainBranch: '', subBranch: '', teacher: '', startDate: new Date().toISOString().split('T')[0], mebCode: '', mebDate: ''
};

// Helper for Turkish Date Formatting
const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  const parts = dateString.split('-'); 
  if (parts.length !== 3) return dateString;
  const year = parts[0];
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parts[2];

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  return `${day} ${months[monthIndex]} ${year.slice(2)}`;
};

const getBranchColorClass = (mainBranch: string) => {
  if (mainBranch === 'Bale / Dans') return 'text-pnr-purple dark:text-purple-400';
  if (mainBranch === 'Enstrüman') return 'text-pnr-blue dark:text-blue-400';
  return 'text-slate-900 dark:text-white';
};

type SortKey = keyof Enrollment | 'teacher' | 'startDate' | 'status' | 'subBranch';
interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

const CRM: React.FC<CRMProps> = ({ canEdit }) => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters & Sort
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassive, setShowPassive] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Dynamic Metadata (Replaces Mock Data)
  const [metaLoading, setMetaLoading] = useState(true);
  const [mainBranchOptions, setMainBranchOptions] = useState<string[]>([]);
  const [subBranchMap, setSubBranchMap] = useState<Record<string, string[]>>({}); // Main -> Sub[]
  const [teacherMap, setTeacherMap] = useState<Record<string, string[]>>({}); // Sub -> Teacher[]

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [studentInfo, setStudentInfo] = useState({
    name: '', dob: '', tc: '', address: '',
    socialMediaApproval: 'Evet',
    healthCondition: 'Hayır',
    healthConditionDetails: ''
  });

  const [branchSelections, setBranchSelections] = useState<BranchSelection[]>([
    { ...INITIAL_BRANCH }, 
    { ...INITIAL_BRANCH }, 
    { ...INITIAL_BRANCH }
  ]);

  const [parents, setParents] = useState<ParentInfo[]>([{ ...INITIAL_PARENT }]);

  // ... (Fetch Data Logic remains same) ...
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedData: Enrollment[] = data.map((item: any) => ({
          id: item.id,
          name: item.full_name,
          dob: item.dob,
          tc: item.tc_no,
          address: item.address,
          status: item.status,
          socialMediaApproval: item.social_media_approval as 'Evet'|'Hayır',
          healthCondition: item.health_condition as 'Evet'|'Hayır',
          healthConditionDetails: item.health_condition_details,
          
          mainBranch: item.main_branch,
          subBranch: item.sub_branch,
          teacher: item.teacher,
          startDate: item.start_date,
          mebCode: item.meb_code,
          mebDate: item.meb_date,

          parents: [
            {
              name: item.parent1_name,
              relation: item.parent1_relation as any,
              job: item.parent1_job,
              tc: item.parent1_tc,
              phone: item.parent1_phone,
              email: item.parent1_email
            },
            ...(item.parent2_name ? [{
              name: item.parent2_name,
              relation: item.parent2_relation as any,
              job: item.parent2_job,
              tc: item.parent2_tc,
              phone: item.parent2_phone,
              email: item.parent2_email
            }] : [])
          ].filter(p => p.name) // Filter out empties
        }));
        setEnrollments(mappedData);
      }
    } catch (err: any) {
      console.error('Fetch Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    setMetaLoading(true);
    try {
      const { data, error } = await supabase
        .from('sub_branches')
        .select(`
          name,
          main_branches ( name ),
          sub_branch_teachers (
            teachers ( name, status )
          )
        `);

      if (error) throw error;

      if (data) {
        const tempMainSet = new Set<string>();
        const tempSubMap: Record<string, string[]> = {};
        const tempTeacherMap: Record<string, string[]> = {};

        data.forEach((row: any) => {
          if (!row.main_branches) return;
          const mainName = row.main_branches.name;
          const subName = row.name;
          tempMainSet.add(mainName);
          if (!tempSubMap[mainName]) tempSubMap[mainName] = [];
          if (!tempSubMap[mainName].includes(subName)) tempSubMap[mainName].push(subName);

          if (row.sub_branch_teachers && row.sub_branch_teachers.length > 0) {
             const activeTeachers = row.sub_branch_teachers
                .map((rel: any) => rel.teachers)
                .filter((t: any) => t && t.status === 'active')
                .map((t: any) => t.name);
             tempTeacherMap[subName] = activeTeachers.sort();
          } else {
             tempTeacherMap[subName] = [];
          }
        });

        setMainBranchOptions(Array.from(tempMainSet).sort());
        Object.keys(tempSubMap).forEach(key => tempSubMap[key].sort());
        setSubBranchMap(tempSubMap);
        setTeacherMap(tempTeacherMap);
      }
    } catch (err: any) {
      console.error('Metadata Fetch Error:', err.message);
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchMetadata();
  }, []);

  // ... (CSV Upload Logic remains same) ...
  const parseCSVLine = (line: string): string[] => {
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    return line.split(regex).map(val => val.replace(/^"|"$/g, '').trim());
  };
  const cleanValue = (val: string | undefined) => {
    if (!val) return null;
    const v = val.trim();
    if (v === '' || v === '#VALUE!' || v === '#REF!') return null;
    return v;
  };
  const parseDate = (val: string | null) => {
    if (!val) return null;
    if (val.includes('-')) return val.split('T')[0];
    if (val.includes('.')) {
       const parts = val.split('.');
       if (parts.length === 3) {
           let year = parts[2];
           if (year.length === 3) year = '2' + year;
           return `${year}-${parts[1]}-${parts[0]}`;
       }
    }
    return null;
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return; // Guard
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split('\n');
      const studentsToInsert: any[] = [];
      setLoading(true);
      try {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim() || line.toLowerCase().startsWith('create table')) continue;
          const cols = parseCSVLine(line);
          const fullName = cleanValue(cols[3]);
          const tcNo = cleanValue(cols[4]);
          if (fullName && tcNo) {
             const student = {
                full_name: fullName,
                tc_no: tcNo,
                dob: parseDate(cleanValue(cols[5])),
                address: cleanValue(cols[6]),
                social_media_approval: cleanValue(cols[7]) || 'Hayır',
                health_condition: cleanValue(cols[8]) || 'Hayır',
                health_condition_details: cleanValue(cols[9]),
                status: 'active',
                main_branch: cleanValue(cols[11]),
                sub_branch: cleanValue(cols[12]),
                teacher: cleanValue(cols[13]),
                start_date: parseDate(cleanValue(cols[14])) || new Date().toISOString().split('T')[0],
                parent1_name: cleanValue(cols[17]),
                parent1_relation: cleanValue(cols[18]),
                parent1_job: cleanValue(cols[19]),
                parent1_tc: cleanValue(cols[20]),
                parent1_phone: cleanValue(cols[21]),
                parent1_email: cleanValue(cols[22]),
                parent2_name: cleanValue(cols[23]),
                parent2_relation: cleanValue(cols[24]),
                parent2_job: cleanValue(cols[25]),
                parent2_tc: cleanValue(cols[26]),
                parent2_phone: cleanValue(cols[27]),
                parent2_email: cleanValue(cols[28]),
             };
             studentsToInsert.push(student);
          }
        }
        if (studentsToInsert.length > 0) {
            const { error } = await supabase.from('students').insert(studentsToInsert);
            if (error) throw error;
            alert(`${studentsToInsert.length} öğrenci başarıyla içe aktarıldı.`);
            fetchData();
        } else {
            alert("İçe aktarılacak geçerli veri bulunamadı.");
        }
      } catch (err: any) {
          console.error("Import Error:", err);
          alert("İçe aktarma sırasında hata: " + err.message);
      } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // --- Handlers ---
  const toggleRow = (id: string) => {
    setExpandedRows(prev => prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]);
  };

  const toggleStatus = async (e: React.MouseEvent, id: string, currentStatus: string) => {
    e.stopPropagation();
    if (!canEdit) return; // Prevent change if not editable
    
    const newStatus = currentStatus === 'active' ? 'passive' : 'active';
    setEnrollments(prev => prev.map(r => r.id === id ? { ...r, status: newStatus as any } : r));
    try {
      await supabase.from('students').update({ status: newStatus }).eq('id', id);
    } catch (err) {
      console.error('Status update failed', err);
      fetchData();
    }
  };

  // ... (Form State Handlers - Same as before) ...
  const handleStudentChange = (field: string, value: string) => setStudentInfo(prev => ({ ...prev, [field]: value }));
  const handleBranchChange = (index: number, field: keyof BranchSelection, value: string) => {
    const newBranches = [...branchSelections];
    newBranches[index] = { ...newBranches[index], [field]: value };
    if (field === 'mainBranch') { newBranches[index].subBranch = ''; newBranches[index].teacher = ''; }
    if (field === 'subBranch') { newBranches[index].teacher = ''; }
    setBranchSelections(newBranches);
  };
  const handleParentChange = (index: number, field: keyof ParentInfo, value: string) => {
    const newParents = [...parents];
    newParents[index] = { ...newParents[index], [field]: value };
    setParents(newParents);
  };
  const addParent = () => parents.length < 2 && setParents([...parents, { ...INITIAL_PARENT, relation: 'Baba' }]);
  const removeParent = (index: number) => setParents(parents.filter((_, i) => i !== index));

  const handleEditClick = (e: React.MouseEvent, enrollment: Enrollment) => {
    e.stopPropagation();
    if (!canEdit) return; // Prevent opening modal if not editable

    setEditingId(enrollment.id);
    setStudentInfo({
      name: enrollment.name,
      dob: enrollment.dob || '',
      tc: enrollment.tc || '',
      address: enrollment.address || '',
      socialMediaApproval: enrollment.socialMediaApproval,
      healthCondition: enrollment.healthCondition,
      healthConditionDetails: enrollment.healthConditionDetails || ''
    });
    setParents(enrollment.parents.length > 0 ? enrollment.parents : [{ ...INITIAL_PARENT }]);
    setBranchSelections([
      {
        mainBranch: enrollment.mainBranch,
        subBranch: enrollment.subBranch,
        teacher: enrollment.teacher,
        startDate: enrollment.startDate,
        mebCode: enrollment.mebCode || '',
        mebDate: enrollment.mebDate || ''
      },
      { ...INITIAL_BRANCH },
      { ...INITIAL_BRANCH }
    ]);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setStudentInfo({ name: '', dob: '', tc: '', address: '', socialMediaApproval: 'Evet', healthCondition: 'Hayır', healthConditionDetails: '' });
    setBranchSelections([{ ...INITIAL_BRANCH }, { ...INITIAL_BRANCH }, { ...INITIAL_BRANCH }]);
    setParents([{ ...INITIAL_PARENT }]);
  };

  // ... (Submit Logic - Same as before) ...
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!studentInfo.name || !studentInfo.tc) { alert("Ad Soyad ve TC zorunludur."); return; }

    setLoading(true);
    try {
      const parent1 = parents[0] || INITIAL_PARENT;
      const parent2 = parents[1];
      const commonData = {
        full_name: studentInfo.name,
        tc_no: studentInfo.tc,
        dob: studentInfo.dob,
        address: studentInfo.address,
        social_media_approval: studentInfo.socialMediaApproval,
        health_condition: studentInfo.healthCondition,
        health_condition_details: studentInfo.healthConditionDetails,
        parent1_name: parent1.name,
        parent1_relation: parent1.relation === 'Diğer' ? parent1.otherRelation : parent1.relation,
        parent1_job: parent1.job,
        parent1_tc: parent1.tc,
        parent1_phone: parent1.phone,
        parent1_email: parent1.email,
        parent2_name: parent2?.name ?? null,
        parent2_relation: parent2 ? (parent2.relation === 'Diğer' ? parent2.otherRelation : parent2.relation) : null,
        parent2_job: parent2?.job ?? null,
        parent2_tc: parent2?.tc ?? null,
        parent2_phone: parent2?.phone ?? null,
        parent2_email: parent2?.email ?? null,
      };

      if (editingId) {
        const branch = branchSelections[0];
        const { error } = await supabase
          .from('students')
          .update({
             ...commonData,
             main_branch: branch.mainBranch,
             sub_branch: branch.subBranch,
             teacher: branch.teacher,
             start_date: branch.startDate,
             meb_code: branch.mebCode,
             meb_date: branch.mebDate || null
          })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const validBranches = branchSelections.filter(b => b.mainBranch && b.subBranch);
        if (validBranches.length === 0) { alert("En az bir branş seçilmelidir."); setLoading(false); return; }
        const rowsToInsert = validBranches.map(branch => ({
          ...commonData,
          status: 'active',
          main_branch: branch.mainBranch,
          sub_branch: branch.subBranch,
          teacher: branch.teacher,
          start_date: branch.startDate,
          meb_code: branch.mebCode,
          meb_date: branch.mebDate || null
        }));
        const { error } = await supabase.from('students').insert(rowsToInsert);
        if (error) throw error;
      }
      await fetchData();
      handleCloseModal();
    } catch (err: any) {
      console.error('Save Error:', err.message);
      alert('Kaydetme hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const processedEnrollments = useMemo(() => {
    let data = [...enrollments];
    if (!showPassive) data = data.filter(item => item.status !== 'passive');
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      data = data.filter(item => 
        item.name.toLowerCase().includes(lowerTerm) ||
        item.subBranch?.toLowerCase().includes(lowerTerm) ||
        item.teacher?.toLowerCase().includes(lowerTerm)
      );
    }
    if (sortConfig) {
      data.sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [enrollments, searchTerm, sortConfig, showPassive]);

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown size={14} className="ml-1 opacity-40 group-hover:opacity-100" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="ml-1 text-pnr-purple" /> 
      : <ArrowDown size={14} className="ml-1 text-pnr-purple" />;
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Öğrenci Yönetimi (CRM)</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">Öğrenci kayıtları, veli bilgileri ve eğitim detayları.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap justify-end">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Öğrenci, branş veya öğretmen..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple placeholder:text-slate-400 dark:placeholder:text-slate-500 h-[42px]"
            />
          </div>
          
          {/* CSV Upload (Conditional) */}
          {canEdit && (
            <div className="relative">
                <input 
                    type="file" 
                    accept=".csv"
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 flex items-center gap-2 h-[42px]"
                  title="CSV İçe Aktar"
                >
                    <Upload size={18} />
                    <span className="hidden lg:inline text-sm font-medium">CSV Yükle</span>
                </button>
            </div>
          )}

          {/* Refresh */}
          <button 
             onClick={() => { fetchData(); fetchMetadata(); }}
             className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500"
          >
             <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 h-[42px]">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Pasifler</span>
            <button 
                onClick={() => setShowPassive(!showPassive)}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                    showPassive ? 'bg-pnr-purple' : 'bg-slate-300 dark:bg-slate-600'
                }`}
            >
                <span className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform duration-200 ml-1 mt-0.5 shadow-sm ${showPassive ? 'translate-x-3.5' : 'translate-x-0'}`} />
            </button>
          </div>

          {canEdit && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-pnr-purple hover:bg-pnr-indigo text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-pnr-purple/20 flex items-center justify-center gap-2 h-[42px] w-full sm:w-auto"
            >
              <UserPlus size={18} />
              Yeni Öğrenci
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="p-4 w-10"></th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('name')}>
                  <div className="flex items-center">Öğrenci <SortIcon columnKey="name" /></div>
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('subBranch')}>
                  <div className="flex items-center">Branş <SortIcon columnKey="subBranch" /></div>
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('teacher')}>
                   <div className="flex items-center">Öğretmen <SortIcon columnKey="teacher" /></div>
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('startDate')}>
                  <div className="flex items-center">İlk Ders <SortIcon columnKey="startDate" /></div>
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('status')}>
                  <div className="flex items-center justify-center">Durum <SortIcon columnKey="status" /></div>
                </th>
                {canEdit && <th className="p-4 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {processedEnrollments.length > 0 ? (
                processedEnrollments.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr 
                      onClick={() => toggleRow(item.id)}
                      className={`group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${expandedRows.includes(item.id) ? 'bg-slate-50 dark:bg-slate-800/30' : ''}`}
                    >
                      <td className="p-4 text-slate-400">
                        {expandedRows.includes(item.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pnr-purple to-pnr-blue text-white flex items-center justify-center font-bold text-sm shrink-0">
                            {item.name.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">
                                {item.name} <span className="text-slate-400 font-normal">- {item.subBranch}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-lg font-bold ${getBranchColorClass(item.mainBranch)}`}>
                            {item.subBranch}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 font-medium">{item.teacher}</td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 font-mono text-sm">{formatDate(item.startDate)}</td>
                      <td className="p-4 text-center">
                         <div onClick={(e) => toggleStatus(e, item.id, item.status)} className="inline-block">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${canEdit ? 'cursor-pointer' : ''} ${item.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-200 text-slate-600 border-slate-300'}`}>
                                {item.status === 'active' ? 'Aktif' : 'Pasif'}
                            </span>
                         </div>
                      </td>
                      {canEdit && (
                        <td className="p-4 text-center" onClick={(e) => handleEditClick(e, item)}>
                            <button className="text-slate-400 hover:text-pnr-purple p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                                <Edit size={18} />
                            </button>
                        </td>
                      )}
                    </tr>
    
                    {expandedRows.includes(item.id) && (
                      <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                        <td colSpan={canEdit ? 9 : 8} className="p-0">
                          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-2">
                             
                             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <h4 className="text-xs font-bold text-pnr-purple uppercase mb-2 flex items-center gap-2">
                                  <User size={14} /> Kimlik & Sağlık
                                </h4>
                                <div className="text-sm space-y-2">
                                   <div className="flex justify-between"><span className="text-slate-500">TC:</span> <span className="font-mono">{item.tc}</span></div>
                                   <div className="flex justify-between"><span className="text-slate-500">Doğum:</span> <span>{formatDate(item.dob)}</span></div>
                                   <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                                      <span className="text-slate-500 block text-xs mb-1">Adres:</span>
                                      <p className="text-slate-700 dark:text-slate-300">{item.address}</p>
                                   </div>
                                   <div className="pt-2 text-xs space-y-1">
                                      <div className="flex justify-between">
                                          <span className="text-slate-500">MEB No:</span>
                                          <span className="font-mono">{item.mebCode || '-'}</span>
                                      </div>
                                   </div>
                                   <div className="pt-2 grid grid-cols-2 gap-2 text-xs">
                                       <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded">
                                          <span className="block text-slate-500 mb-1">Sosyal Medya</span>
                                          <span className="font-bold">{item.socialMediaApproval}</span>
                                       </div>
                                       <div className={`p-2 rounded ${item.healthCondition === 'Evet' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                          <span className="block opacity-70 mb-1">Sağlık</span>
                                          <span className="font-bold">{item.healthCondition}</span>
                                       </div>
                                   </div>
                                   {item.healthCondition === 'Evet' && <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">{item.healthConditionDetails}</p>}
                                </div>
                             </div>

                             <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {item.parents.map((p, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${idx === 0 ? 'bg-pnr-orange' : 'bg-slate-300'}`}></div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 pl-2">{p.relation} ({p.name})</h4>
                                        <div className="space-y-2 text-sm pl-2">
                                            <div className="flex items-center gap-2"><Phone size={14} className="text-pnr-cyan"/> {p.phone}</div>
                                            <div className="flex items-center gap-2"><Mail size={14} className="text-pnr-purple"/> {p.email}</div>
                                            <div className="flex items-center gap-2"><Briefcase size={14} className="text-slate-400"/> {p.job}</div>
                                            <div className="flex items-center gap-2"><User size={14} className="text-slate-400"/> {p.tc}</div>
                                        </div>
                                    </div>
                                ))}
                             </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr><td colSpan={canEdit ? 9 : 8} className="p-8 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL (Only render if canEdit) */}
      {isModalOpen && canEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-pnr-card w-full max-w-5xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus size={24} className="text-pnr-purple" />
                {editingId ? 'Kaydı Düzenle' : 'Yeni Öğrenci Kaydı'}
              </h2>
              <button onClick={handleCloseModal}><X size={24} className="text-slate-400 hover:text-red-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
               <form id="studentForm" onSubmit={handleSubmit}>
               {/* 1. STUDENT */}
               <section>
                  <h3 className="text-sm font-bold text-pnr-purple uppercase mb-4 border-b pb-2">Öğrenci Bilgileri</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Ad Soyad *</label>
                      <input type="text" required className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={studentInfo.name} onChange={e => handleStudentChange('name', e.target.value)} /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">TC Kimlik *</label>
                      <input type="text" required maxLength={11} className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={studentInfo.tc} onChange={e => handleStudentChange('tc', e.target.value)} /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Doğum Tarihi</label>
                      <input type="date" className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={studentInfo.dob} onChange={e => handleStudentChange('dob', e.target.value)} /></div>
                      <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Adres</label>
                      <input type="text" className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={studentInfo.address} onChange={e => handleStudentChange('address', e.target.value)} /></div>
                      
                      {/* Permissions */}
                      <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Sosyal Medya İzni</label>
                      <select className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={studentInfo.socialMediaApproval} onChange={e => handleStudentChange('socialMediaApproval', e.target.value)}>
                          <option value="Evet">Evet</option><option value="Hayır">Hayır</option>
                      </select></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Sağlık Sorunu</label>
                      <select className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={studentInfo.healthCondition} onChange={e => handleStudentChange('healthCondition', e.target.value)}>
                          <option value="Hayır">Hayır</option><option value="Evet">Evet</option>
                      </select></div>
                      {studentInfo.healthCondition === 'Evet' && (
                          <div className="md:col-span-3"><label className="text-xs font-bold text-red-500 uppercase block mb-1">Detay</label>
                          <input type="text" className="w-full border border-red-300 bg-red-50 rounded-lg p-2" value={studentInfo.healthConditionDetails} onChange={e => handleStudentChange('healthConditionDetails', e.target.value)} /></div>
                      )}
                  </div>
               </section>

               {/* 2. BRANCHES */}
               <section className="mt-8">
                  <h3 className="text-sm font-bold text-pnr-blue uppercase mb-4 border-b pb-2">Kayıt & Branş</h3>
                  {metaLoading ? (
                      <div className="text-sm text-slate-500 py-4">Branş bilgileri yükleniyor...</div>
                  ) : (
                  <div className="space-y-4">
                     {(editingId ? [branchSelections[0]] : branchSelections).map((branch, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border ${idx === 0 ? 'bg-pnr-blue/5 border-pnr-blue/20' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200'}`}>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                                {editingId ? 'Düzenlenen Ders' : `${idx + 1}. Ders Seçimi`}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Üst Branş</label>
                                    <select 
                                        required={idx === 0}
                                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        value={branch.mainBranch}
                                        onChange={e => handleBranchChange(idx, 'mainBranch', e.target.value)}
                                    >
                                        <option value="">Seçiniz</option>
                                        {mainBranchOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Alt Branş</label>
                                    <select 
                                        required={idx === 0}
                                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        value={branch.subBranch}
                                        onChange={e => handleBranchChange(idx, 'subBranch', e.target.value)}
                                        disabled={!branch.mainBranch}
                                    >
                                        <option value="">Seçiniz</option>
                                        {branch.mainBranch && subBranchMap[branch.mainBranch]?.map((s: string) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Öğretmen</label>
                                    <select 
                                        required={idx === 0}
                                        className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        value={branch.teacher}
                                        onChange={e => handleBranchChange(idx, 'teacher', e.target.value)}
                                        disabled={!branch.subBranch}
                                    >
                                        <option value="">Seçiniz</option>
                                        {(
                                            branch.subBranch && teacherMap[branch.subBranch]
                                            ? teacherMap[branch.subBranch]
                                            : []
                                        ).map((t: string) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                {/* MEB Info */}
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">MEB Kod</label>
                                    <input type="text" className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800" value={branch.mebCode} onChange={e => handleBranchChange(idx, 'mebCode', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">MEB Tarih</label>
                                    <input type="date" className="w-full border rounded-lg p-2 text-sm dark:bg-slate-800" value={branch.mebDate} onChange={e => handleBranchChange(idx, 'mebDate', e.target.value)} />
                                </div>
                            </div>
                        </div>
                     ))}
                  </div>
                  )}
               </section>

               {/* 3. PARENTS */}
               <section className="mt-8">
                   <div className="flex justify-between items-center mb-4 border-b pb-2">
                       <h3 className="text-sm font-bold text-pnr-orange uppercase">Veli Bilgileri</h3>
                       {parents.length < 2 && (
                           <button type="button" onClick={addParent} className="text-xs bg-slate-200 px-2 py-1 rounded hover:bg-slate-300">2. Veli Ekle</button>
                       )}
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {parents.map((p, idx) => (
                           <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border relative">
                               {idx > 0 && <button onClick={() => removeParent(idx)} className="absolute top-2 right-2 text-red-400"><Trash2 size={16}/></button>}
                               <div className="space-y-3">
                                   <div><label className="text-xs font-bold text-slate-400">Ad Soyad *</label>
                                   <input type="text" required className="w-full border rounded p-1.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={p.name} onChange={e => handleParentChange(idx, 'name', e.target.value)} /></div>
                                   <div className="grid grid-cols-2 gap-2">
                                       <div><label className="text-xs font-bold text-slate-400">Telefon</label>
                                       <input type="tel" className="w-full border rounded p-1.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={p.phone} onChange={e => handleParentChange(idx, 'phone', e.target.value)} /></div>
                                       <div><label className="text-xs font-bold text-slate-400">Yakınlık</label>
                                       <select className="w-full border rounded p-1.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={p.relation} onChange={e => handleParentChange(idx, 'relation', e.target.value)}>
                                           <option>Anne</option><option>Baba</option><option>Diğer</option>
                                       </select></div>
                                   </div>
                                   <div><label className="text-xs font-bold text-slate-400">TC Kimlik</label>
                                   <input type="text" className="w-full border rounded p-1.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={p.tc} onChange={e => handleParentChange(idx, 'tc', e.target.value)} /></div>
                                   <div><label className="text-xs font-bold text-slate-400">E-Posta</label>
                                   <input type="email" className="w-full border rounded p-1.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={p.email} onChange={e => handleParentChange(idx, 'email', e.target.value)} /></div>
                                   <div><label className="text-xs font-bold text-slate-400">Meslek</label>
                                   <input type="text" className="w-full border rounded p-1.5 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={p.job} onChange={e => handleParentChange(idx, 'job', e.target.value)} /></div>
                               </div>
                           </div>
                       ))}
                   </div>
               </section>
               </form>
            </div>

            <div className="p-5 border-t bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <button onClick={handleCloseModal} className="px-6 py-2 rounded-xl border text-slate-600 dark:text-slate-300">İptal</button>
                <button form="studentForm" type="submit" disabled={loading} className="px-6 py-2 rounded-xl bg-pnr-purple text-white font-bold hover:bg-pnr-indigo disabled:opacity-50">
                    {loading ? 'Kaydediliyor...' : (editingId ? 'Güncelle' : 'Kaydet')}
                </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CRM;
