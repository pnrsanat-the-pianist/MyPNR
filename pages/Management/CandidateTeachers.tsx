import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Phone,
  RefreshCcw,
  Search,
  Star,
  Trash2,
  UserPlus,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface CandidateNote {
  id: string;
  user: string;
  date: string;
  content: string;
}

interface CandidateTeacher {
  id: string;
  name: string;
  phone: string;
  branches: string[];
  graduation: string;
  notes: CandidateNote[];
  suitability: number;
  createdAt: string;
}

interface CandidateTeachersProps {
  canEdit?: boolean;
}

type SortKey = 'name' | 'phone' | 'branch' | 'graduation' | 'suitability' | 'createdAt';

interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

const OTHER_BRANCH_OPTION = 'Diğer';

const CandidateTeachers: React.FC<CandidateTeachersProps> = ({ canEdit = true }) => {
  const [candidates, setCandidates] = useState<CandidateTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<string[]>([]);
  const [branchOptions, setBranchOptions] = useState<string[]>([OTHER_BRANCH_OPTION]);
  const [pendingSuitability, setPendingSuitability] = useState<Record<string, number>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'createdAt', direction: 'desc' });
  const [supportsBranchesArray, setSupportsBranchesArray] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    branches: [] as string[],
    customBranches: [''],
    graduation: '',
    initialNote: ''
  });

  const formatDisplayDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isMissingBranchesColumnError = (error: any) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes("could not find the 'branches' column") || message.includes('branches column');
  };

  const getCurrentUserName = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Sistem';

    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    return profile?.name || user.user_metadata?.name || user.email || 'Sistem';
  };

  const normalizePhone = (value: string) => {
    let digits = value.replace(/\D/g, '');
    if (digits.length > 0 && !digits.startsWith('0')) {
      digits = `0${digits}`;
    }
    return digits.slice(0, 11);
  };

  const fetchBranchOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_branches')
        .select('name')
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (error) throw error;

      const names = Array.from(new Set((data || []).map((item: any) => item.name).filter(Boolean)));
      setBranchOptions([OTHER_BRANCH_OPTION, ...names]);
    } catch (error) {
      console.error('Branch options fetch error:', error);
      setBranchOptions([OTHER_BRANCH_OPTION]);
    }
  };

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const query = supportsBranchesArray
        ? supabase.from('candidate_teachers').select('*').order('created_at', { ascending: false })
        : supabase.from('candidate_teachers').select('id, full_name, phone, branch, graduation, notes, suitability, created_at').order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const mapped: CandidateTeacher[] = (data || []).map((item: any) => ({
        id: item.id,
        name: item.full_name || '',
        phone: item.phone || '',
        branches: Array.isArray(item.branches)
          ? item.branches.filter(Boolean)
          : item.branch
            ? [item.branch]
            : [],
        graduation: item.graduation || '',
        notes: Array.isArray(item.notes) ? item.notes : [],
        suitability: Math.max(0, Math.min(3, Number(item.suitability) || 0)),
        createdAt: item.created_at || ''
      }));

      setCandidates(mapped);
      setNoteInputs(Object.fromEntries(mapped.map((item) => [item.id, item.notes[0]?.content || ''])));
      setPendingSuitability({});
    } catch (error: any) {
      if (supportsBranchesArray && isMissingBranchesColumnError(error)) {
        setSupportsBranchesArray(false);
        return;
      }
      console.error('Candidate teachers fetch error:', error);
      alert('Aday öğretmen verileri yüklenemedi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranchOptions();
    fetchCandidates();
  }, [supportsBranchesArray]);

  const filteredCandidates = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const searched = !term
      ? candidates
      : candidates.filter((candidate) =>
          candidate.name.toLowerCase().includes(term) ||
          candidate.phone.toLowerCase().includes(term) ||
          candidate.branches.some((branch) => branch.toLowerCase().includes(term)) ||
          candidate.graduation.toLowerCase().includes(term)
        );

    return [...searched].sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;

      switch (sortConfig.key) {
        case 'suitability':
          return (a.suitability - b.suitability) * direction;
        case 'createdAt':
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
        default: {
          const left = sortConfig.key === 'branch' ? a.branches.join(', ').toLowerCase() : a[sortConfig.key].toLowerCase();
          const right = sortConfig.key === 'branch' ? b.branches.join(', ').toLowerCase() : b[sortConfig.key].toLowerCase();
          return left.localeCompare(right, 'tr') * direction;
        }
      }
    });
  }, [candidates, searchTerm, sortConfig]);

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      branches: [],
      customBranches: [''],
      graduation: '',
      initialNote: ''
    });
  };

  const getBranchValues = () => {
    const selectedBranches = formData.branches.filter((branch) => branch !== OTHER_BRANCH_OPTION);
    const manualBranches = formData.customBranches.map((branch) => branch.trim()).filter(Boolean);
    return Array.from(new Set([...selectedBranches, ...manualBranches]));
  };

  const toggleBranchSelection = (branch: string) => {
    setFormData((current) => {
      const exists = current.branches.includes(branch);
      const nextBranches = exists
        ? current.branches.filter((item) => item !== branch)
        : [...current.branches, branch];

      return {
        ...current,
        branches: nextBranches,
        customBranches: nextBranches.includes(OTHER_BRANCH_OPTION)
          ? current.customBranches.length > 0 ? current.customBranches : ['']
          : ['']
      };
    });
  };

  const updateCustomBranch = (index: number, value: string) => {
    setFormData((current) => ({
      ...current,
      customBranches: current.customBranches.map((item, itemIndex) => itemIndex === index ? value : item)
    }));
  };

  const addCustomBranchField = () => {
    setFormData((current) => ({
      ...current,
      customBranches: [...current.customBranches, '']
    }));
  };

  const removeCustomBranchField = (index: number) => {
    setFormData((current) => ({
      ...current,
      customBranches: current.customBranches.length === 1
        ? ['']
        : current.customBranches.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const requestSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-slate-400" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={14} className="text-pnr-purple" />
      : <ArrowDown size={14} className="text-pnr-purple" />;
  };

  const toggleNotes = (id: string) => {
    setExpandedNotes((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const branchValues = getBranchValues();

    if (!formData.name.trim()) {
      alert('Ad Soyad alanı zorunludur.');
      return;
    }

    if (branchValues.length === 0) {
      alert('En az bir branş seçilmelidir.');
      return;
    }

    try {
      setLoading(true);
      const author = await getCurrentUserName();
      const initialNotes = formData.initialNote.trim()
        ? [{
            id: crypto.randomUUID(),
            user: author,
            date: new Date().toLocaleString('tr-TR'),
            content: formData.initialNote.trim()
          }]
        : [];

      const { error } = await supabase
        .from('candidate_teachers')
        .insert(supportsBranchesArray
          ? {
              full_name: formData.name.trim(),
              branches: branchValues,
              graduation: formData.graduation.trim() || null,
              phone: normalizePhone(formData.phone),
              suitability: 0,
              notes: initialNotes
            }
          : {
              full_name: formData.name.trim(),
              branch: branchValues.join(', '),
              graduation: formData.graduation.trim() || null,
              phone: normalizePhone(formData.phone),
              suitability: 0,
              notes: initialNotes
            });

      if (error) throw error;

      setIsModalOpen(false);
      resetForm();
      await fetchCandidates();
    } catch (error: any) {
      console.error('Candidate teacher create error:', error);
      alert('Aday öğretmen kaydı oluşturulamadı: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const queueSuitabilityChange = (id: string, rating: number) => {
    const nextRating = Math.max(0, Math.min(3, rating));
    setPendingSuitability((current) => ({ ...current, [id]: nextRating }));
  };

  const confirmSuitabilityChange = async (id: string) => {
    const nextRating = pendingSuitability[id];
    if (nextRating === undefined) return;

    const previous = candidates;
    setCandidates((current) => current.map((item) => (
      item.id === id ? { ...item, suitability: nextRating } : item
    )));

    try {
      const { error } = await supabase
        .from('candidate_teachers')
        .update({ suitability: nextRating })
        .eq('id', id);

      if (error) throw error;

      setPendingSuitability((current) => {
        const updated = { ...current };
        delete updated[id];
        return updated;
      });
    } catch (error: any) {
      console.error('Suitability update error:', error);
      setCandidates(previous);
      alert('Uygunluk puanı güncellenemedi: ' + error.message);
    }
  };

  const cancelSuitabilityChange = (id: string) => {
    setPendingSuitability((current) => {
      const updated = { ...current };
      delete updated[id];
      return updated;
    });
  };

  const handleDeleteCandidate = async (id: string, name: string) => {
    const confirmed = window.confirm(`${name} adlı aday öğretmen kaydı silinsin mi?`);
    if (!confirmed) return;

    const previous = candidates;
    setCandidates((current) => current.filter((item) => item.id !== id));

    try {
      const { error } = await supabase
        .from('candidate_teachers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Candidate delete error:', error);
      setCandidates(previous);
      alert('Aday öğretmen silinemedi: ' + error.message);
    }
  };

  const handleSaveNote = async (id: string) => {
    const content = (noteInputs[id] || '').trim();
    const candidate = candidates.find((item) => item.id === id);
    if (!candidate) return;

    try {
      const author = await getCurrentUserName();
      const updatedNotes = content ? [{
        id: crypto.randomUUID(),
        user: author,
        date: new Date().toLocaleString('tr-TR'),
        content
      }] : [];

      setCandidates((current) => current.map((item) => (
        item.id === id ? { ...item, notes: updatedNotes } : item
      )));

      const { error } = await supabase
        .from('candidate_teachers')
        .update({ notes: updatedNotes })
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Candidate note update error:', error);
      alert('Not kaydedilemedi: ' + error.message);
      await fetchCandidates();
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Aday Öğretmen</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">Başvuruları listele, not alanını düzenle ve uygunsa yıldızla işaretle.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ad, telefon, branş veya mezuniyet ara"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple h-[42px]"
            />
          </div>

          <button
            onClick={() => {
              fetchBranchOptions();
              fetchCandidates();
            }}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500"
            title="Yenile"
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          {canEdit && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-pnr-purple hover:bg-pnr-indigo text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-pnr-purple/20 flex items-center justify-center gap-2 h-[42px]"
            >
              <UserPlus size={18} />
              Aday Öğretmen Girişi
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="p-4 w-12"></th>
                {[
                  { key: 'name', label: 'Ad Soyad' },
                  { key: 'phone', label: 'Telefon' },
                  { key: 'branch', label: 'Branş' },
                  { key: 'graduation', label: 'Mezuniyet' },
                  { key: 'suitability', label: 'Uygunluk' },
                  { key: 'createdAt', label: 'Kayıt' }
                ].map((column) => (
                  <th key={column.key} className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => requestSort(column.key as SortKey)}
                      className="inline-flex items-center gap-2 hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                      <span>{column.label}</span>
                      {renderSortIcon(column.key as SortKey)}
                    </button>
                  </th>
                ))}
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400">Yükleniyor...</td>
                </tr>
              ) : filteredCandidates.length > 0 ? (
                filteredCandidates.map((candidate) => {
                  const isExpanded = expandedNotes.includes(candidate.id);
                  const pendingRating = pendingSuitability[candidate.id];
                  const displayRating = pendingRating ?? candidate.suitability;
                  const latestNote = candidate.notes[0];

                  return (
                    <React.Fragment key={candidate.id}>
                      <tr className="align-top hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-slate-400 dark:text-slate-500">
                          <button
                            type="button"
                            onClick={() => toggleNotes(candidate.id)}
                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Not alanını aç/kapat"
                          >
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{candidate.name}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-mono">
                            <Phone size={14} className="text-slate-400" />
                            {candidate.phone || '-'}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-slate-600 dark:text-slate-300">{candidate.branches.length > 0 ? candidate.branches.join(', ') : '-'}</td>
                        <td className="p-4 text-sm text-slate-600 dark:text-slate-300">{candidate.graduation || '-'}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3].map((value) => {
                                const active = displayRating >= value;
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => queueSuitabilityChange(candidate.id, active && displayRating === value ? value - 1 : value)}
                                    className="p-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                                    title={`${value} yıldız`}
                                  >
                                    <Star size={18} className={active ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'} />
                                  </button>
                                );
                              })}
                            </div>

                            {pendingRating !== undefined && pendingRating !== candidate.suitability && (
                              <div className="flex items-center gap-1 rounded-xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() => confirmSuitabilityChange(candidate.id)}
                                  className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors"
                                  title="Değişikliği onayla"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cancelSuitabilityChange(candidate.id)}
                                  className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
                                  title="Vazgeç"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDisplayDate(candidate.createdAt)}</td>
                        <td className="p-4 text-right">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCandidate(candidate.id, candidate.name)}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                              title="Aday öğretmeni sil"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>

                      <tr className={`${isExpanded ? 'table-row' : 'hidden'} bg-slate-50/70 dark:bg-slate-900/20`}>
                        <td colSpan={8} className="p-4 md:p-5 border-t border-slate-100 dark:border-slate-800">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Not</h3>
                              <span className="text-xs text-slate-400">Tek girişli alan</span>
                            </div>

                            {latestNote ? (
                              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-3">
                                <div className="flex items-center justify-between gap-3 text-xs mb-1">
                                  <span className="font-semibold text-slate-700 dark:text-slate-200">{latestNote.user}</span>
                                  <span className="text-slate-400">{latestNote.date}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-slate-400 italic">Henüz not girilmedi.</div>
                            )}

                            {canEdit && (
                              <div className="flex items-start gap-2">
                                <textarea
                                  rows={3}
                                  value={noteInputs[candidate.id] || ''}
                                  onChange={(e) => setNoteInputs((current) => ({ ...current, [candidate.id]: e.target.value }))}
                                  placeholder="Not gir veya mevcut notu düzenle"
                                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none resize-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveNote(candidate.id)}
                                  className="shrink-0 h-[42px] px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-pnr-purple dark:hover:bg-pnr-purple hover:text-white transition-colors flex items-center gap-2"
                                >
                                  <Check size={16} />
                                  Kaydet
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400">Kayıt bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-pnr-card w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus size={20} className="text-pnr-purple" />
                Aday Öğretmen Girişi
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateCandidate} className="p-5 md:p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((current) => ({ ...current, name: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData((current) => ({ ...current, phone: normalizePhone(e.target.value) }))}
                    placeholder="05XXXXXXXXX"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Branş</label>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-hidden">
                    <div className="grid grid-cols-2 md:grid-cols-4 border-b border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <div className="px-3 py-2 border-r border-slate-200 dark:border-slate-700">Branş 1</div>
                      <div className="px-3 py-2 border-r border-slate-200 dark:border-slate-700">Branş 2</div>
                      <div className="px-3 py-2 border-r border-slate-200 dark:border-slate-700">Branş 3</div>
                      <div className="px-3 py-2">Branş 4</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 max-h-56 overflow-y-auto">
                    {branchOptions.map((option) => {
                      const selected = formData.branches.includes(option);
                      return (
                        <label key={option} className="flex items-center gap-3 cursor-pointer text-sm text-slate-700 dark:text-slate-200 px-3 py-3 border-b border-r border-slate-200 dark:border-slate-700 hover:bg-white/70 dark:hover:bg-slate-800/60 transition-colors">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleBranchSelection(option)}
                            className="w-4 h-4 rounded border-slate-300 text-pnr-purple focus:ring-pnr-purple"
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                    </div>
                  </div>
                </div>
              </div>

              {formData.branches.includes(OTHER_BRANCH_OPTION) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Manuel Branş Girişleri</label>
                    <button
                      type="button"
                      onClick={addCustomBranchField}
                      className="text-sm font-medium text-pnr-purple hover:text-pnr-indigo"
                    >
                      + Branş Ekle
                    </button>
                  </div>

                  {formData.customBranches.map((branch, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={branch}
                        onChange={(e) => updateCustomBranch(index, e.target.value)}
                        placeholder="Branş adını yazın"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                      />
                      {formData.customBranches.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCustomBranchField(index)}
                          className="shrink-0 w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:border-red-200 transition-colors"
                          title="Alanı kaldır"
                        >
                          <X size={16} className="mx-auto" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mezuniyet</label>
                <input
                  type="text"
                  value={formData.graduation}
                  onChange={(e) => setFormData((current) => ({ ...current, graduation: e.target.value }))}
                  placeholder="Okul / bölüm bilgisi"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Not</label>
                <textarea
                  rows={4}
                  value={formData.initialNote}
                  onChange={(e) => setFormData((current) => ({ ...current, initialNote: e.target.value }))}
                  placeholder="Başvuru ile ilgili ilk not"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-pnr-purple hover:bg-pnr-indigo text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-pnr-purple/20 disabled:opacity-70"
                >
                  {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateTeachers;
