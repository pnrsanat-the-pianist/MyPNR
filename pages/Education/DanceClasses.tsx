import React, { useState, useEffect } from 'react';
import {
    Search, Users, Calendar, Clock, Plus, X,
    CheckCircle2, AlertCircle, MapPin, ChevronRight,
    ChevronLeft, Trash2, Info, Edit, UserPlus, MinusCircle, RefreshCcw
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// --- TYPES ---

interface ScheduleItem {
    day: string;
    startTime: string;
    endTime: string;
}

interface ClassStudent {
    id: string;
    name: string;
    subBranch: string;
    assignedClassId?: string | null; // Database: dance_class_id
}

interface DanceClass {
    id: string;
    name: string;
    subBranch: string;
    teacherId: string;
    teacherName?: string; // For UI display
    weeklyHours: number;
    schedule: ScheduleItem[]; // Stored as jsonb 'schedule_config'
    classroom: string;
}

interface TeacherOption {
    id: string;
    name: string;
}

// --- CONSTANTS ---

const SUB_BRANCHES = ['Bale', 'Hip Hop', 'Modern Dans', 'Yetişkin Bale', 'Latin Dansları', 'Tiyatro', 'Resim'];
const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

interface DanceClassesProps {
    canEdit?: boolean;
}

const DanceClasses: React.FC<DanceClassesProps> = ({ canEdit = true }) => {
    // --- STATE ---
    const [classes, setClasses] = useState<DanceClass[]>([]);
    const [students, setStudents] = useState<ClassStudent[]>([]);
    const [teachersList, setTeachersList] = useState<TeacherOption[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal States
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState<{ classId: string, subBranch: string } | null>(null);

    const [step, setStep] = useState(1); // 1: Info, 2: Schedule
    const [searchTerm, setSearchTerm] = useState('');
    const [conflictError, setConflictError] = useState<string | null>(null);

    // Form State (for Create/Edit Class)
    const [editingClassId, setEditingClassId] = useState<string | null>(null);
    const [currentClassForm, setCurrentClassForm] = useState<{
        name: string;
        subBranch: string;
        teacherId: string;
        weeklyHours: number;
        schedule: ScheduleItem[];
    }>({
        name: '',
        subBranch: 'Bale',
        teacherId: '',
        weeklyHours: 1,
        schedule: [{ day: 'Cumartesi', startTime: '09:00', endTime: '10:00' }]
    });

    // --- DATA FETCHING ---

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Classes with Teacher info
            const { data: classData, error: classError } = await supabase
                .from('dance_classes')
                .select(`
                *,
                teachers ( id, name )
            `)
                .order('created_at', { ascending: false });

            if (classError) throw classError;

            if (classData) {
                const mappedClasses: DanceClass[] = classData.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    subBranch: c.sub_branch,
                    teacherId: c.teacher_id,
                    teacherName: c.teachers?.name || 'Bilinmiyor',
                    weeklyHours: c.weekly_hours,
                    schedule: c.schedule_config || [],
                    classroom: c.classroom
                }));
                setClasses(mappedClasses);
            }

            // 2. Fetch Active Teachers
            const { data: teacherData } = await supabase
                .from('teachers')
                .select('id, name')
                .eq('status', 'active')
                .order('name');

            setTeachersList(teacherData || []);

            // 3. Fetch Students (Only those relevant to dance/group classes or generic)
            // We fetch basic info + their assigned class
            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('id, full_name, sub_branch, dance_class_id')
                .eq('status', 'active'); // Only active students

            if (studentError) throw studentError;

            if (studentData) {
                const mappedStudents: ClassStudent[] = studentData.map((s: any) => ({
                    id: s.id,
                    name: s.full_name,
                    subBranch: s.sub_branch || 'Genel',
                    assignedClassId: s.dance_class_id
                }));
                setStudents(mappedStudents);
            }

        } catch (err: any) {
            console.error("Fetch Error:", err);
            alert("Veriler yüklenirken hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- LOGIC ---

    const calculateEndTime = (start: string) => {
        if (!start) return '';
        const [h, m] = start.split(':').map(Number);
        const endDate = new Date();
        endDate.setHours(h + 1); // Add 1 hour
        endDate.setMinutes(m);

        const endH = endDate.getHours().toString().padStart(2, '0');
        const endM = endDate.getMinutes().toString().padStart(2, '0');
        return `${endH}:${endM}`;
    };

    // Check overlap for a specific time slot against all existing classes
    const checkTimeConflict = (day: string, start: string, end: string, excludeClassId?: string): boolean => {
        const toMinutes = (time: string) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
        };

        const newStart = toMinutes(start);
        const newEnd = toMinutes(end);

        for (const cls of classes) {
            if (excludeClassId && cls.id === excludeClassId) continue; // Skip self when editing

            for (const item of cls.schedule) {
                if (item.day === day) {
                    const existingStart = toMinutes(item.startTime);
                    const existingEnd = toMinutes(item.endTime);

                    // Overlap Condition: (StartA < EndB) and (EndA > StartB)
                    if (newStart < existingEnd && newEnd > existingStart) {
                        return true; // Conflict found
                    }
                }
            }
        }
        return false;
    };

    // --- CLASS ACTIONS ---

    const handleOpenCreateModal = () => {
        setEditingClassId(null);
        setCurrentClassForm({
            name: '',
            subBranch: 'Bale',
            teacherId: '',
            weeklyHours: 1,
            schedule: [{ day: 'Cumartesi', startTime: '09:00', endTime: '10:00' }]
        });
        setStep(1);
        setConflictError(null);
        setIsClassModalOpen(true);
    };

    const handleOpenEditModal = (cls: DanceClass) => {
        setEditingClassId(cls.id);
        setCurrentClassForm({
            name: cls.name,
            subBranch: cls.subBranch,
            teacherId: cls.teacherId,
            weeklyHours: cls.weeklyHours,
            schedule: [...cls.schedule]
        });
        setStep(1);
        setConflictError(null);
        setIsClassModalOpen(true);
    };

    const handleSaveClass = async () => {
        // Basic validation
        if (!currentClassForm.name || !currentClassForm.teacherId) {
            alert("Lütfen sınıf adı ve öğretmen seçiniz.");
            return;
        }

        // Conflict Check (Again before save)
        for (const item of currentClassForm.schedule) {
            if (checkTimeConflict(item.day, item.startTime, item.endTime, editingClassId || undefined)) {
                alert(`Çakışma var: ${item.day} ${item.startTime}`);
                return;
            }
        }

        setLoading(true);
        try {
            const payload = {
                name: currentClassForm.name,
                sub_branch: currentClassForm.subBranch,
                teacher_id: currentClassForm.teacherId,
                weekly_hours: currentClassForm.weeklyHours,
                schedule_config: currentClassForm.schedule,
                classroom: 'Bale Stüdyosu'
            };

            if (editingClassId) {
                // UPDATE
                const { error } = await supabase
                    .from('dance_classes')
                    .update(payload)
                    .eq('id', editingClassId);
                if (error) throw error;
            } else {
                // CREATE
                const { error } = await supabase
                    .from('dance_classes')
                    .insert(payload);
                if (error) throw error;
            }

            await fetchData();
            setIsClassModalOpen(false);

        } catch (err: any) {
            console.error("Save Error:", err);
            alert("Kaydetme başarısız: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- STUDENT ACTIONS ---

    const handleRemoveStudent = async (studentId: string) => {
        if (!confirm("Öğrenciyi sınıftan çıkarmak istediğinize emin misiniz?")) return;

        // Optimistic Update
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, assignedClassId: null } : s));

        try {
            const { error } = await supabase
                .from('students')
                .update({ dance_class_id: null })
                .eq('id', studentId);

            if (error) throw error;
        } catch (err: any) {
            alert("Öğrenci çıkarılamadı.");
            fetchData(); // Revert
        }
    };

    const handleAddStudentToClass = async (studentId: string, classId: string) => {
        // Optimistic Update
        setStudents(prev => prev.map(s => s.id === studentId ? { ...s, assignedClassId: classId } : s));
        setIsAddStudentModalOpen(null);

        try {
            const { error } = await supabase
                .from('students')
                .update({ dance_class_id: classId })
                .eq('id', studentId);

            if (error) throw error;
        } catch (err: any) {
            alert("Öğrenci eklenemedi.");
            fetchData(); // Revert
        }
    };

    // --- WIZARD LOGIC ---

    const updateScheduleCount = (count: number) => {
        const current = [...currentClassForm.schedule];
        if (count > current.length) {
            for (let i = current.length; i < count; i++) {
                current.push({ day: 'Cumartesi', startTime: '09:00', endTime: '10:00' });
            }
        } else {
            current.length = count;
        }
        setCurrentClassForm({ ...currentClassForm, weeklyHours: count, schedule: current });
        setConflictError(null);
    };

    const updateScheduleItem = (index: number, field: keyof ScheduleItem, value: string) => {
        const updated = [...currentClassForm.schedule];

        if (field === 'startTime') {
            updated[index] = {
                ...updated[index],
                startTime: value,
                endTime: calculateEndTime(value) // Auto calc end time
            };
        } else {
            updated[index] = { ...updated[index], [field]: value };
        }

        setCurrentClassForm({ ...currentClassForm, schedule: updated });
        setConflictError(null);
    };

    const validateStep2 = () => {
        for (const item of currentClassForm.schedule) {
            if (checkTimeConflict(item.day, item.startTime, item.endTime, editingClassId || undefined)) {
                setConflictError(`Çakışma Tespit Edildi! ${item.day} ${item.startTime}-${item.endTime} saatlerinde Bale Stüdyosu dolu.`);
                return false;
            }
        }
        return true;
    };

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Bale / Dans Dersleri</h1>
                    <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">
                        Grup dersleri, stüdyo planlaması ve sınıf listeleri.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Sınıf veya öğretmen ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple"
                        />
                    </div>
                    <button
                        onClick={fetchData}
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                    >
                        <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {canEdit && (
                        <button
                            onClick={handleOpenCreateModal}
                            className="bg-pnr-orange hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-colors"
                        >
                            <Plus size={18} /> Yeni Sınıf
                        </button>
                    )}
                </div>
            </div>

            {/* Class List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loading && classes.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500">Sınıflar yükleniyor...</div>
                )}

                {!loading && classes.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl">
                        <Users size={48} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500">Henüz tanımlı bir sınıf yok.</p>
                    </div>
                )}

                {classes
                    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.teacherName && c.teacherName.toLowerCase().includes(searchTerm.toLowerCase())))
                    .map(cls => {
                        const classStudents = students.filter(s => s.assignedClassId === cls.id);
                        return (
                            <div key={cls.id} className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                                <div className="p-5 relative">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-pnr-orange"></div>

                                    {/* Card Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-xs font-bold text-pnr-orange uppercase tracking-wider">{cls.subBranch}</span>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">{cls.name}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{cls.teacherName}</p>
                                        </div>
                                        {canEdit && (
                                            <button
                                                onClick={() => handleOpenEditModal(cls)}
                                                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-pnr-purple hover:bg-purple-50 dark:hover:bg-slate-700 transition-colors"
                                                title="Sınıfı Düzenle"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Schedule List */}
                                    <div className="space-y-2 mb-4">
                                        {cls.schedule.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                <Calendar size={14} className="text-pnr-orange shrink-0" />
                                                <span className="font-medium text-xs">{item.day}</span>
                                                <div className="ml-auto flex items-center gap-1 font-mono text-[10px] bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                                    <Clock size={10} /> {item.startTime} - {item.endTime}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                                        <MapPin size={14} /> {cls.classroom}
                                    </div>
                                </div>

                                {/* Students Section (Bottom of Card) */}
                                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 border-t border-slate-200 dark:border-slate-800 flex-1 flex flex-col">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                            <Users size={14} /> Öğrenciler ({classStudents.length})
                                        </div>
                                        {canEdit && (
                                            <button
                                                onClick={() => setIsAddStudentModalOpen({ classId: cls.id, subBranch: cls.subBranch })}
                                                className="text-[10px] bg-pnr-purple hover:bg-pnr-indigo text-white px-2 py-1 rounded-md font-bold flex items-center gap-1 transition-colors"
                                            >
                                                <Plus size={12} /> Ekle
                                            </button>
                                        )}
                                    </div>

                                    {classStudents.length === 0 ? (
                                        <div className="text-center py-4 text-xs text-slate-400 italic bg-white dark:bg-slate-800 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                                            Henüz öğrenci eklenmemiş.
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                            {classStudents.map(student => (
                                                <div key={student.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 group">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500">
                                                            {student.name.charAt(0)}
                                                        </div>
                                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                                                            {student.name}
                                                        </span>
                                                    </div>
                                                    {canEdit && (
                                                        <button
                                                            onClick={() => handleRemoveStudent(student.id)}
                                                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title="Sınıftan Çıkar"
                                                        >
                                                            <MinusCircle size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
            </div>

            {/* CREATE / EDIT CLASS MODAL (WIZARD - 2 STEPS) */}
            {isClassModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-pnr-card w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                        {editingClassId ? 'Sınıfı Düzenle' : 'Yeni Sınıf Oluştur'}
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Bale / Dans grubu ve programı.</p>
                                </div>
                                <button onClick={() => setIsClassModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Step Indicators */}
                            <div className="flex items-center gap-2">
                                {[1, 2].map(i => (
                                    <div key={i} className="flex-1">
                                        <div className={`h-2 rounded-full transition-colors ${step >= i ? 'bg-pnr-orange' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                        <span className={`text-[10px] font-bold uppercase mt-1 block text-center ${step >= i ? 'text-pnr-orange' : 'text-slate-400'}`}>
                                            {i === 1 ? 'Bilgiler' : 'Program'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 min-h-[350px]">

                            {/* STEP 1: CLASS INFO */}
                            {step === 1 && (
                                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Alt Branş</label>
                                        <select
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-orange focus:outline-none"
                                            value={currentClassForm.subBranch}
                                            onChange={(e) => setCurrentClassForm({ ...currentClassForm, subBranch: e.target.value })}
                                        >
                                            {SUB_BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Sınıf Adı</label>
                                        <input
                                            type="text"
                                            placeholder="Örn: Minik Kuğular B Grubu"
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-orange focus:outline-none"
                                            value={currentClassForm.name}
                                            onChange={(e) => setCurrentClassForm({ ...currentClassForm, name: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Haftalık Ders Saati (Adet)</label>
                                            <input
                                                type="number"
                                                min={1} max={7}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-orange focus:outline-none"
                                                value={currentClassForm.weeklyHours}
                                                onChange={(e) => updateScheduleCount(parseInt(e.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Derslik</label>
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-500 dark:text-slate-400 flex items-center gap-2 cursor-not-allowed">
                                                <MapPin size={16} /> Bale Stüdyosu
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Öğretmen</label>
                                        <select
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-orange focus:outline-none"
                                            value={currentClassForm.teacherId}
                                            onChange={(e) => setCurrentClassForm({ ...currentClassForm, teacherId: e.target.value })}
                                        >
                                            <option value="">Seçiniz...</option>
                                            {teachersList.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: SCHEDULE */}
                            {step === 2 && (
                                <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex gap-3 text-sm text-blue-800 dark:text-blue-300">
                                        <Info size={20} className="shrink-0" />
                                        <p>
                                            <strong>{currentClassForm.weeklyHours}</strong> adet ders saati planlayın. Ders süresi standart olarak <strong>1 saattir</strong> ve otomatik ayarlanır.
                                        </p>
                                    </div>

                                    {conflictError && (
                                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl flex gap-3 text-sm text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 animate-pulse">
                                            <AlertCircle size={20} className="shrink-0" />
                                            <p className="font-bold">{conflictError}</p>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        {currentClassForm.schedule.map((item, idx) => (
                                            <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                                                <div className="text-xs font-bold text-slate-400 uppercase mb-2">{idx + 1}. Ders Saati</div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <select
                                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm focus:ring-2 focus:ring-pnr-orange focus:outline-none dark:text-white"
                                                        value={item.day}
                                                        onChange={(e) => updateScheduleItem(idx, 'day', e.target.value)}
                                                    >
                                                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                                    </select>
                                                    <div className="relative">
                                                        <input
                                                            type="time"
                                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm focus:ring-2 focus:ring-pnr-orange focus:outline-none dark:text-white"
                                                            value={item.startTime}
                                                            onChange={(e) => updateScheduleItem(idx, 'startTime', e.target.value)}
                                                        />
                                                        <span className="absolute -top-4 left-0 text-[10px] text-slate-400">Başlangıç</span>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="time"
                                                            disabled
                                                            className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-2 text-sm text-slate-500 cursor-not-allowed"
                                                            value={item.endTime}
                                                        />
                                                        <span className="absolute -top-4 left-0 text-[10px] text-slate-400">Bitiş (Oto)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer (Nav) */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between">
                            {step > 1 ? (
                                <button
                                    onClick={() => setStep(step - 1)}
                                    className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                >
                                    <ChevronLeft size={18} /> Geri
                                </button>
                            ) : (
                                <div></div>
                            )}

                            {step < 2 ? (
                                <button
                                    onClick={() => {
                                        if (step === 1) {
                                            if (!currentClassForm.name || !currentClassForm.teacherId) {
                                                alert('Lütfen sınıf adı ve öğretmen seçiniz.');
                                                return;
                                            }
                                            setStep(2);
                                        }
                                    }}
                                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
                                >
                                    İleri <ChevronRight size={18} />
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (validateStep2()) {
                                            handleSaveClass();
                                        }
                                    }}
                                    disabled={loading}
                                    className="bg-pnr-orange text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-70"
                                >
                                    {loading ? '...' : (
                                        <><CheckCircle2 size={18} /> {editingClassId ? 'Güncelle' : 'Oluştur'}</>
                                    )}
                                </button>
                            )}
                        </div>

                    </div>
                </div>
            )}

            {/* ADD STUDENT MODAL */}
            {isAddStudentModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-pnr-card w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <UserPlus className="text-pnr-purple" size={20} />
                                    Öğrenci Ekle
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Sadece <strong>{isAddStudentModalOpen.subBranch}</strong> branşında boşta olan öğrenciler listelenir.
                                </p>
                            </div>
                            <button onClick={() => setIsAddStudentModalOpen(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {/* Filter logic: Match subBranch, and ensure student has NO class assigned (null) */}
                            {students.filter(s =>
                                (s.subBranch === isAddStudentModalOpen.subBranch || s.subBranch === 'Genel') &&
                                !s.assignedClassId
                            ).length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    Uygun öğrenci bulunamadı.
                                </div>
                            ) : (
                                students
                                    .filter(s => (s.subBranch === isAddStudentModalOpen.subBranch || s.subBranch === 'Genel') && !s.assignedClassId)
                                    .map(student => (
                                        <button
                                            key={student.id}
                                            onClick={() => handleAddStudentToClass(student.id, isAddStudentModalOpen.classId)}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-pnr-purple hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors text-left group"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-500 group-hover:bg-pnr-purple group-hover:text-white transition-colors">
                                                {student.name.charAt(0)}
                                            </div>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-pnr-purple">
                                                {student.name}
                                            </span>
                                            <Plus size={16} className="ml-auto text-slate-300 group-hover:text-pnr-purple" />
                                        </button>
                                    ))
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default DanceClasses;