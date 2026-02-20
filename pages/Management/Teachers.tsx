import React, { useState, useEffect } from 'react';
import {
  UserPlus, Search, ChevronDown, ChevronRight, Upload, X,
  FileText, Calendar, CreditCard, GraduationCap, Phone, User,
  Check, Download, Layers, RefreshCcw, Edit, Lock, Mail, Shield,
  LayoutGrid, List, MapPin, Briefcase, Users
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { UserRole } from '../../types';

// --- Types ---
interface TeacherBranch {
  mainBranchId: string;
  mainBranchName: string;
  subBranchIds: string[];
  subBranchNames: string[];
}

interface Teacher {
  id: string;
  photo?: string;
  name: string;
  tc: string;
  phone: string;
  email: string;
  sgkDate: string;
  schoolInfo: string;
  salaryType: 'hourly' | 'monthly' | 'per_student';
  salaryAmount: number;
  files: string[];
  branches: TeacherBranch[];
  status: 'active' | 'passive';
}

// Helper Type for DB Branch Data
interface BranchData {
  id: string;
  name: string;
  subBranches: { id: string; name: string }[];
}

const Teachers: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [availableBranches, setAvailableBranches] = useState<BranchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});

  // Filtering & View States
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassive, setShowPassive] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');

  // --- Form State ---
  const [formData, setFormData] = useState<Partial<Teacher>>({
    salaryType: 'hourly',
    branches: [],
    files: [],
    email: ''
  });

  // Local file tracking for upload on submit
  const [tempPhoto, setTempPhoto] = useState<File | null>(null);
  const [tempFiles, setTempFiles] = useState<File[]>([]);

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Branches Structure for the Form
      const { data: mainBranches, error: branchError } = await supabase
        .from('main_branches')
        .select(`
          id, 
          name, 
          sub_branches ( id, name )
        `);

      if (branchError) throw branchError;

      if (mainBranches) {
        const formattedBranches = mainBranches.map((mb: any) => ({
          id: mb.id,
          name: mb.name,
          subBranches: mb.sub_branches.map((sb: any) => ({ id: sb.id, name: sb.name }))
        }));
        setAvailableBranches(formattedBranches);
      }

      // 2. Fetch Teachers with joined branches
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select(`
          *,
          sub_branch_teachers (
            sub_branches (
              id,
              name,
              main_branches (
                id,
                name
              )
            )
          )
        `);

      if (teacherError) throw teacherError;

      // Transform DB response to UI State
      if (teacherData) {
        const mappedTeachers: Teacher[] = teacherData.map((t: any) => {
          // Process nested branches
          const rawBranches = t.sub_branch_teachers?.map((rel: any) => rel.sub_branches) || [];
          const groupedBranches: TeacherBranch[] = [];

          rawBranches.forEach((sb: any) => {
            if (!sb?.main_branches) return;
            const mainId = sb.main_branches.id;
            const existingGroup = groupedBranches.find(g => g.mainBranchId === mainId);

            if (existingGroup) {
              existingGroup.subBranchIds.push(sb.id);
              existingGroup.subBranchNames.push(sb.name);
            } else {
              groupedBranches.push({
                mainBranchId: mainId,
                mainBranchName: sb.main_branches.name,
                subBranchIds: [sb.id],
                subBranchNames: [sb.name]
              });
            }
          });

          return {
            id: t.id,
            name: t.name,
            tc: t.tc_no || '',
            phone: t.phone || '',
            email: t.email || '',
            photo: t.photo_url || '',
            sgkDate: t.sgk_entry_date || '',
            schoolInfo: t.education_info || '',
            salaryType: t.salary_type || 'hourly',
            salaryAmount: t.salary_amount || 0,
            files: t.files || [],
            status: t.status || 'active',
            branches: groupedBranches
          };
        });
        setTeachers(mappedTeachers);

        // 3. Fetch Student Counts per Teacher
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('teacher');

        if (studentError) throw studentError;

        if (studentData) {
          const counts: Record<string, number> = {};
          studentData.forEach((s: any) => {
            if (s.teacher) {
              counts[s.teacher] = (counts[s.teacher] || 0) + 1;
            }
          });
          setStudentCounts(counts);
        }
      }

    } catch (error: any) {
      console.error('Data fetch error:', error);
      alert('Veriler yüklenirken bir hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Helpers ---
  const toggleRow = (id: string) => {
    setExpandedRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const toggleStatus = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const teacher = teachers.find(t => t.id === id);
    if (!teacher) return;

    const newStatus = teacher.status === 'active' ? 'passive' : 'active';

    // Optimistic UI Update
    setTeachers(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));

    try {
      await supabase.from('teachers').update({ status: newStatus }).eq('id', id);
    } catch (err) {
      console.error('Status update failed', err);
      // Revert if needed
    }
  };

  const handleEdit = (teacher: Teacher) => {
    setFormData({
      id: teacher.id,
      name: teacher.name,
      tc: teacher.tc,
      phone: teacher.phone,
      email: teacher.email,
      sgkDate: teacher.sgkDate,
      schoolInfo: teacher.schoolInfo,
      salaryType: teacher.salaryType,
      salaryAmount: teacher.salaryAmount,
      files: teacher.files,
      photo: teacher.photo,
      branches: teacher.branches
    });
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setFormData({ salaryType: 'hourly', branches: [], files: [], email: '' });
    setTempPhoto(null);
    setTempFiles([]);
    setIsModalOpen(true);
  };

  // Branch Selection Logic for Form
  const handleBranchToggle = (mainBranchId: string, mainBranchName: string, subBranchId: string, subBranchName: string) => {
    setFormData(prev => {
      const currentBranches = prev.branches || [];
      const branchIndex = currentBranches.findIndex(b => b.mainBranchId === mainBranchId);

      let newBranches = [...currentBranches];

      if (branchIndex > -1) {
        // Main branch exists
        const existingGroup = newBranches[branchIndex];
        const subIndex = existingGroup.subBranchIds.indexOf(subBranchId);

        if (subIndex > -1) {
          // Remove sub branch
          const newSubBranchIds = existingGroup.subBranchIds.filter(id => id !== subBranchId);
          const newSubBranchNames = existingGroup.subBranchNames.filter(n => n !== subBranchName);

          if (newSubBranchIds.length === 0) {
            // Remove main branch container if no sub branches left
            newBranches = newBranches.filter(b => b.mainBranchId !== mainBranchId);
          } else {
            // Update existing container with new sub branch arrays
            newBranches[branchIndex] = {
              ...existingGroup,
              subBranchIds: newSubBranchIds,
              subBranchNames: newSubBranchNames
            };
          }
        } else {
          // Add sub branch to existing container
          newBranches[branchIndex] = {
            ...existingGroup,
            subBranchIds: [...existingGroup.subBranchIds, subBranchId],
            subBranchNames: [...existingGroup.subBranchNames, subBranchName]
          };
        }
      } else {
        // Add new main branch container
        newBranches.push({
          mainBranchId,
          mainBranchName,
          subBranchIds: [subBranchId],
          subBranchNames: [subBranchName]
        });
      }
      return { ...prev, branches: newBranches };
    });
  };

  const isBranchSelected = (subBranchId: string) => {
    return formData.branches?.some(b => b.subBranchIds.includes(subBranchId));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // Sadece rakamlar
    if (val.length > 0 && !val.startsWith('0')) {
      val = '0' + val;
    }
    if (val.length > 11) {
      val = val.substring(0, 11);
    }
    if (val === '') val = '0'; // Alan boş kalamasın, hep 0 ile başlasın (opsiyonel)
    setFormData({ ...formData, phone: val });
  };

  // --- Submit Handler (Create/Update Teacher) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.tc) {
      alert("Lütfen zorunlu alanları doldurunuz.");
      return;
    }

    try {
      setLoading(true);

      let photoUrl = formData.photo;
      let fileNames = formData.files || [];

      // 1. Upload Photo to Supabase if changed
      if (tempPhoto) {
        const fileExt = tempPhoto.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('teacher-files')
          .upload(filePath, tempPhoto);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('teacher-files')
          .getPublicUrl(filePath);

        photoUrl = publicUrl;
      }

      // 2. Upload Files to Supabase if any
      if (tempFiles.length > 0) {
        const uploadedFileNames = [...fileNames];
        for (const file of tempFiles) {
          const fileName = `${Date.now()}_${file.name}`;
          const filePath = `documents/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('teacher-files')
            .upload(filePath, file);

          if (uploadError) {
            console.error('File upload error:', uploadError);
            continue;
          }
          uploadedFileNames.push(fileName);
        }
        fileNames = uploadedFileNames;
      }

      // --- 2. TEACHER RECORD CREATION/UPDATE ---
      const commonData = {
        name: formData.name,
        tc_no: formData.tc,
        phone: formData.phone,
        email: formData.email,
        sgk_entry_date: formData.sgkDate || null,
        education_info: formData.schoolInfo,
        salary_type: formData.salaryType,
        salary_amount: formData.salaryAmount,
        files: fileNames, // JSONB
        photo_url: photoUrl
      };

      let teacherId = formData.id;

      if (teacherId) {
        // UPDATE
        const { error: updateError } = await supabase
          .from('teachers')
          .update(commonData)
          .eq('id', teacherId);

        if (updateError) throw updateError;
      } else {
        // CREATE
        const { data: newTeacher, error: insertError } = await supabase
          .from('teachers')
          .insert({ ...commonData, status: 'active' })
          .select()
          .single();

        if (insertError) throw insertError;
        teacherId = newTeacher.id;
      }

      // --- 3. BRANCH RELATIONSHIPS ---
      if (teacherId) {
        // Delete existing relationships
        const { error: deleteRelError } = await supabase
          .from('sub_branch_teachers')
          .delete()
          .eq('teacher_id', teacherId);
        if (deleteRelError) throw deleteRelError;

        // Insert new relationships
        if (formData.branches && formData.branches.length > 0) {
          const relationships: { sub_branch_id: string, teacher_id: string }[] = [];

          formData.branches.forEach(mb => {
            mb.subBranchIds.forEach(sbId => {
              relationships.push({
                sub_branch_id: sbId,
                teacher_id: teacherId!
              });
            });
          });

          if (relationships.length > 0) {
            const { error: relError } = await supabase
              .from('sub_branch_teachers')
              .insert(relationships);

            if (relError) throw relError;
          }
        }
      }

      // Success
      alert(formData.id
        ? "Öğretmen bilgileri güncellendi."
        : "Öğretmen başarıyla oluşturuldu.");

      await fetchData();
      setIsModalOpen(false);
      setFormData({ salaryType: 'hourly', branches: [], files: [], email: '' });
      setTempPhoto(null);
      setTempFiles([]);

    } catch (err: any) {
      console.error('Error saving teacher:', err);
      alert('İşlem sırasında hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setTempFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number, fromDB: boolean = false) => {
    if (fromDB) {
      setFormData(prev => ({
        ...prev,
        files: prev.files?.filter((_, i) => i !== index)
      }));
    } else {
      setTempFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Filter Logic
  const filteredTeachers = teachers.filter(t => {
    if (!showPassive && t.status === 'passive') return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesName = t.name.toLowerCase().includes(term);
      const matchesBranch = t.branches.some(b =>
        b.mainBranchName.toLowerCase().includes(term) ||
        b.subBranchNames.some(s => s.toLowerCase().includes(term))
      );
      return matchesName || matchesBranch;
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Öğretmen Listesi</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">Eğitmen kadrosu, maaş ve özlük bilgileri.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input
              type="text"
              placeholder="İsim veya Branş ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple placeholder:text-slate-400 dark:placeholder:text-slate-500 h-[42px]"
            />
          </div>

          {/* View Toggle */}
          <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 h-[42px]">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-3 rounded-lg transition-all ${viewMode === 'table' ? 'bg-pnr-purple text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <List size={18} />
              <span className="hidden sm:inline text-xs font-medium">Liste</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-3 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-pnr-purple text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <LayoutGrid size={18} />
              <span className="hidden sm:inline text-xs font-medium">Kart</span>
            </button>
          </div>

          <button
            onClick={fetchData}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500"
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Show Passive Switch */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 h-[42px]">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Pasifler</span>
            <button
              onClick={() => setShowPassive(!showPassive)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${showPassive ? 'bg-pnr-purple' : 'bg-slate-300 dark:bg-slate-600'
                }`}
            >
              <span
                className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform duration-200 ml-1 mt-0.5 shadow-sm ${showPassive ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          <button
            onClick={handleOpenNew}
            className="bg-pnr-purple hover:bg-pnr-indigo text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-pnr-purple/20 flex items-center justify-center gap-2 h-[42px]"
          >
            <UserPlus size={18} />
            Yeni Öğretmen
          </button>
        </div>
      </div>

      {/* Teachers Content */}
      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-4 w-12"></th>
                  <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ad Soyad</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Branşlar</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Durum</th>
                  <th className="p-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading && teachers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">Yükleniyor...</td>
                  </tr>
                ) : filteredTeachers.length > 0 ? (
                  filteredTeachers.map((teacher) => (
                    <React.Fragment key={teacher.id}>
                      {/* Main Row */}
                      <tr
                        className={`group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${expandedRows.includes(teacher.id) ? 'bg-slate-50 dark:bg-slate-800/30' : ''}`}
                        onClick={() => toggleRow(teacher.id)}
                      >
                        <td className="p-4 text-slate-400 dark:text-slate-500">
                          {expandedRows.includes(teacher.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold overflow-hidden shrink-0">
                              {teacher.photo ? (
                                <img src={teacher.photo} alt={teacher.name} className="w-full h-full object-cover" />
                              ) : (
                                teacher.name.charAt(0)
                              )}
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white">{teacher.name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {teacher.branches.map((b, idx) => (
                              <span key={idx} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-sm">
                                <span className={`${b.mainBranchName.includes('Bale') ? 'text-pnr-purple dark:text-purple-300' : 'text-pnr-blue dark:text-blue-300'} mr-1.5`}>
                                  {b.mainBranchName}:
                                </span>
                                {b.subBranchNames.join(', ')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => toggleStatus(e, teacher.id)}
                              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pnr-purple ${teacher.status === 'passive' ? 'bg-slate-300 dark:bg-slate-600' : 'bg-pnr-green'
                                }`}
                            >
                              <span
                                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 shadow-sm ${teacher.status === 'passive' ? 'translate-x-1' : 'translate-x-6'
                                  }`}
                              />
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1 block">
                            {teacher.status === 'passive' ? 'Pasif' : 'Aktif'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(teacher); }}
                            className="text-slate-400 hover:text-pnr-purple transition-colors p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Düzenle"
                          >
                            <Edit size={18} />
                          </button>
                        </td>
                      </tr>

                      {/* Detailed Expanded Row */}
                      {expandedRows.includes(teacher.id) && (
                        <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                          <td colSpan={5} className="p-0">
                            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 border-b border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">

                              {/* Personal Info */}
                              <div className="space-y-3">
                                <h4 className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-2">Kimlik & İletişim</h4>
                                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                  <User size={16} className="text-slate-400" />
                                  <span className="font-mono">{teacher.tc}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                  <Phone size={16} className="text-slate-400" />
                                  <span className="font-mono">{teacher.phone}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                  <Mail size={16} className="text-slate-400" />
                                  <span className="">{teacher.email || '-'}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                  <Calendar size={16} className="text-slate-400" />
                                  <span>SGK Giriş: {teacher.sgkDate || '-'}</span>
                                </div>
                              </div>

                              {/* Education */}
                              <div className="space-y-3">
                                <h4 className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-2">Eğitim Bilgisi</h4>
                                <div className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                                  <GraduationCap size={16} className="text-slate-400 mt-1" />
                                  <span>{teacher.schoolInfo || '-'}</span>
                                </div>
                              </div>

                              {/* Financial */}
                              <div className="space-y-3">
                                <h4 className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-2">Finansal Bilgiler</h4>
                                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                  <CreditCard size={16} className="text-slate-400" />
                                  <span>
                                    {teacher.salaryType === 'hourly' ? 'Saatlik Ücret' :
                                      teacher.salaryType === 'monthly' ? 'Aylık Maaş' : 'Öğrenci Başı'}:
                                    <span className="font-bold ml-1 text-pnr-purple">₺{teacher.salaryAmount?.toLocaleString() || 0}</span>
                                  </span>
                                </div>
                              </div>

                              {/* Files */}
                              <div className="space-y-3">
                                <h4 className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-2">Özlük Dosyası</h4>
                                <div className="space-y-2">
                                  {teacher.files && teacher.files.length > 0 ? teacher.files.map((file, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-pnr-cyan hover:underline cursor-pointer">
                                      <FileText size={14} />
                                      {file}
                                      <Download size={12} className="ml-auto opacity-50" />
                                    </div>
                                  )) : (
                                    <span className="text-xs text-slate-400 italic">Dosya yok</span>
                                  )}
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW (New Design with Large Photos) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {loading && teachers.length === 0 ? (
            <div className="col-span-full p-12 text-center text-slate-500">Yükleniyor...</div>
          ) : filteredTeachers.length > 0 ? (
            filteredTeachers.map((teacher) => (
              <div
                key={teacher.id}
                className="group relative bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* Photo Area */}
                <div className="relative aspect-[4/5] overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {teacher.photo ? (
                    <img
                      src={teacher.photo}
                      alt={teacher.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                      <User size={64} strokeWidth={1} />
                      <span className="text-4xl font-bold opacity-10 absolute">{teacher.name.charAt(0)}</span>
                    </div>
                  )}
                </div>

                {/* Content Area */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">{teacher.name}</h3>
                    <div className="flex items-start gap-1.5 mt-1 text-sm font-semibold text-pnr-purple dark:text-purple-400 min-h-[40px]">
                      <Briefcase size={14} className="mt-1 shrink-0" />
                      <span className="line-clamp-2">
                        {teacher.branches.map(b => b.subBranchNames.join(', ')).join(' • ') || 'Branş Belirtilmemiş'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <a
                        href={`#education/crm?teacher=${encodeURIComponent(teacher.name)}`}
                        className="flex items-center gap-2 text-sm font-bold text-pnr-cyan hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Users size={16} />
                        <span>{studentCounts[teacher.name] || 0} Öğrenci</span>
                      </a>

                      <button
                        onClick={() => toggleRow(teacher.id)}
                        className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${expandedRows.includes(teacher.id) ? 'text-pnr-purple bg-pnr-purple/10' : 'text-slate-400'}`}
                      >
                        <ChevronDown size={20} className={`transition-transform duration-300 ${expandedRows.includes(teacher.id) ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {expandedRows.includes(teacher.id) && (
                      <div className="mt-4 pt-4 border-t-2 border-slate-100 dark:border-slate-800 space-y-5 animate-in slide-in-from-top-2 duration-200">
                        <button
                          onClick={() => handleEdit(teacher)}
                          className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-bold text-base shadow-md flex items-center justify-center gap-2 hover:bg-pnr-purple dark:hover:bg-pnr-purple hover:text-white transition-all active:scale-95"
                        >
                          <Edit size={20} />
                          Profili Düzenle
                        </button>

                        <div className="grid grid-cols-1 gap-4 text-base">
                          <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                            <Phone size={18} className="text-slate-400 shrink-0" />
                            <span className="font-bold font-mono">{teacher.phone}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                            <User size={18} className="text-slate-400 shrink-0" />
                            <span className="font-mono">{teacher.tc}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                            <Mail size={18} className="text-slate-400 shrink-0" />
                            <span className="truncate">{teacher.email || '-'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                            <Calendar size={18} className="text-slate-400 shrink-0" />
                            <span>SGK Giriş: <span className="font-semibold">{teacher.sgkDate || '-'}</span></span>
                          </div>
                          <div className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                            <GraduationCap size={18} className="text-slate-400 mt-0.5 shrink-0" />
                            <span className="italic">{teacher.schoolInfo || '-'}</span>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                              <RefreshCcw size={18} className="text-slate-400 shrink-0" />
                              <span className="font-medium">Durum</span>
                            </div>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => toggleStatus(e, teacher.id)}
                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${teacher.status === 'passive' ? 'bg-slate-300 dark:bg-slate-600' : 'bg-pnr-green'
                                  }`}
                              >
                                <span
                                  className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 shadow-sm ${teacher.status === 'passive' ? 'translate-x-1' : 'translate-x-6'
                                    }`}
                                />
                              </button>
                              <span className={`text-[11px] font-bold uppercase transition-colors ${teacher.status === 'active' ? 'text-pnr-green' : 'text-slate-400'}`}>
                                {teacher.status === 'active' ? 'Aktif' : 'Pasif'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Files Minimal */}
                        <div className="space-y-2 mt-2">
                          <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">Dosyalar</h4>
                          {teacher.files && teacher.files.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {teacher.files.map((file, i) => (
                                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs text-pnr-cyan border border-slate-200 dark:border-slate-700">
                                  <FileText size={12} />
                                  <span className="max-w-[120px] truncate">{file}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Dosya yok</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full p-12 text-center text-slate-500">Kayıt bulunamadı.</div>
          )}
        </div>
      )}

      {/* ADD/EDIT TEACHER MODAL */}
      {
        isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-pnr-card w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">

              {/* Modal Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus size={20} className="text-pnr-purple" />
                  {formData.id ? 'Öğretmen Düzenle' : 'Yeni Öğretmen Ekle'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body - Scrollable Form */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <form onSubmit={handleSubmit} className="space-y-8">

                  {/* Section 1: Photo & Basic Info */}
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Photo Upload */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center relative overflow-hidden group shrink-0">
                        {formData.photo ? (
                          <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <Upload size={32} className="text-slate-400" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              const file = e.target.files[0];
                              setTempPhoto(file);
                              setFormData({ ...formData, photo: URL.createObjectURL(file) });
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="text-white text-xs">Değiştir</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Profil Fotoğrafı</span>
                    </div>

                    {/* Basic Inputs */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ad Soyad</label>
                        <input
                          type="text"
                          required
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">TC Kimlik No</label>
                        <input
                          type="text"
                          required
                          maxLength={11}
                          pattern="\d{11}"
                          placeholder="11 haneli"
                          value={formData.tc || ''}
                          onChange={(e) => setFormData({ ...formData, tc: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefon</label>
                        <input
                          type="tel"
                          placeholder="05XXXXXXXXX"
                          value={formData.phone || ''}
                          onChange={handlePhoneChange}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-Posta Adresi</label>
                        <input
                          type="email"
                          placeholder="ornek@pnrsanat.com"
                          value={formData.email || ''}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SGK Giriş Tarihi</label>
                        <input
                          type="date"
                          value={formData.sgkDate || ''}
                          onChange={(e) => setFormData({ ...formData, sgkDate: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mezun Olduğu Okul / Bölüm</label>
                        <input
                          type="text"
                          placeholder="Konservatuar..."
                          value={formData.schoolInfo || ''}
                          onChange={(e) => setFormData({ ...formData, schoolInfo: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>


                  <hr className="border-slate-200 dark:border-slate-700" />

                  {/* Section 2: Branch Selection */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Layers size={16} />
                      Branş Seçimi
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                      {availableBranches.map((main) => (
                        <div key={main.id}>
                          <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{main.name}</h4>
                          <div className="space-y-2 ml-1">
                            {main.subBranches.map((sub) => {
                              const isSelected = isBranchSelected(sub.id);
                              return (
                                <label key={sub.id} className="flex items-center gap-2 cursor-pointer group">
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-pnr-purple border-pnr-purple' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 group-hover:border-pnr-purple'}`}>
                                    {isSelected && <Check size={12} className="text-white" />}
                                  </div>
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={isSelected}
                                    onChange={() => handleBranchToggle(main.id, main.name, sub.id, sub.name)}
                                  />
                                  <span className={`text-sm ${isSelected ? 'text-pnr-purple font-medium' : 'text-slate-600 dark:text-slate-400'}`}>{sub.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <hr className="border-slate-200 dark:border-slate-700" />

                  {/* Section 3: Salary & Files */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Salary */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <CreditCard size={16} />
                        Maaş Bilgisi
                      </h3>
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="salaryType"
                              value="hourly"
                              checked={formData.salaryType === 'hourly'}
                              onChange={(e) => setFormData({ ...formData, salaryType: 'hourly' })}
                              className="text-pnr-purple focus:ring-pnr-purple"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Saatlik Ücret</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="salaryType"
                              value="monthly"
                              checked={formData.salaryType === 'monthly'}
                              onChange={(e) => setFormData({ ...formData, salaryType: 'monthly' })}
                              className="text-pnr-purple focus:ring-pnr-purple"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Aylık Maaş</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="salaryType"
                              value="per_student"
                              checked={formData.salaryType === 'per_student'}
                              onChange={(e) => setFormData({ ...formData, salaryType: 'per_student' })}
                              className="text-pnr-purple focus:ring-pnr-purple"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Öğrenci Başı</span>
                          </label>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tutar (TL)</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.salaryAmount || ''}
                            onChange={(e) => setFormData({ ...formData, salaryAmount: parseFloat(e.target.value) })}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Files */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <FileText size={16} />
                        Özlük Dosyası
                      </h3>
                      <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative">
                        <input
                          type="file"
                          multiple
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={handleFileUpload}
                        />
                        <Upload className="mx-auto text-slate-400 mb-2" size={24} />
                        <p className="text-xs text-slate-500">Dosyaları buraya sürükleyin veya tıklayın</p>
                      </div>

                      {/* Selected Files List */}
                      <div className="mt-3 space-y-2">
                        {tempFiles.map((file, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText size={14} className="text-pnr-purple shrink-0" />
                              <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{file.name}</span>
                            </div>
                            <button type="button" onClick={() => removeFile(i)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {formData.files?.map((name, i) => (
                          <div key={`db-${i}`} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/20">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Check size={14} className="text-green-500 shrink-0" />
                              <span className="text-xs text-green-700 dark:text-green-400 truncate">{name}</span>
                            </div>
                            <button type="button" onClick={() => removeFile(i, true)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </form>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium"
                >
                  İptal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-2 bg-pnr-purple hover:bg-pnr-indigo text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-pnr-purple/20 flex items-center gap-2 disabled:opacity-70"
                >
                  {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>

            </div>
          </div>
        )}

    </div>
  );
};

export default Teachers;