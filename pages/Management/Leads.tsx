import React, { useState, useMemo, useEffect } from 'react';
import {
  UserPlus, Search, Filter, ChevronDown, ChevronRight,
  MessageSquare, Phone, Calendar, User, Send, X, Check,
  Globe, ArrowUpDown, ArrowUp, ArrowDown, Edit, RefreshCcw, Trash2,
  Instagram, Mail, MessageCircle, HelpCircle,
  Baby, UserCheck, Building2
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { UserRole } from '../../types';

// --- Types ---
type LeadStatus = 'Takip' | 'Görüşüldü' | 'Deneme' | 'Kayıt' | 'İptal';
type LeadSource = 'Instagram' | 'Verimor' | 'Whatsapp' | 'Referans / Tanıdık' | 'Gmail' | 'Diğer';
type LeadType = 'Öğrenci' | 'Öğretmen' | 'Kurum';

const SOURCE_OPTIONS: LeadSource[] = ['Instagram', 'Verimor', 'Whatsapp', 'Referans / Tanıdık', 'Gmail', 'Diğer'];

interface Note {
  id: string;
  user: string;
  date: string;
  content: string;
}

interface Lead {
  id: string;
  studentName: string;
  age: number;
  branch: string;
  parentName: string;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  notes: Note[];
  createdAt: string;
  rawDate: number; // For correct sorting
  type: LeadType;
  followUpDate: string;
}

const BRANCH_OPTIONS = ['Bale', 'Piyano', 'Gitar', 'Keman', 'Dans', 'Resim', 'Tiyatro'];

type SortKey = keyof Lead | 'parentName';
interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

interface LeadsProps {
  currentUserRole: UserRole;
  currentUserName?: string;
  canEdit?: boolean;
}

const Leads: React.FC<LeadsProps> = ({ currentUserRole, currentUserName = '', canEdit = true }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  // Filtering & Sorting States
  const [searchTerm, setSearchTerm] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [showFutureLeads, setShowFutureLeads] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  // New Lead Form State
  const [subBranches, setSubBranches] = useState<string[]>([]);
  const [newLead, setNewLead] = useState({
    studentName: '',
    parentName: '',
    age: '',
    branch: '', // Initialize as empty
    phone: '',
    source: 'Instagram' as LeadSource,
    initialNote: '',
    followUpDate: new Date().toISOString().split('T')[0]
  });

  // New Note Input State (mapped by lead ID)
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const noteAuthor = currentUserName.trim() || 'Kullanıcı';
  const branchOptions = subBranches.length > 0 ? subBranches : BRANCH_OPTIONS;
  const selectedBranches = newLead.branch.split(',').map(branch => branch.trim()).filter(Boolean);

  const handleBranchSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValues = Array.from(event.target.selectedOptions, option => option.value);
    setNewLead({ ...newLead, branch: selectedValues.join(', ') });
  };

  // --- FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch leads
      const { data, error } = await supabase
        .from('new_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedLeads: Lead[] = data.map((item: any) => ({
          id: item.id,
          studentName: item.student_name || '',
          age: item.age || 0,
          branch: item.branch || '',
          parentName: item.parent_name || '',
          phone: item.phone || '',
          source: item.source as LeadSource,
          status: item.status as LeadStatus,
          notes: item.notes || [], // JSONB column to array
          createdAt: new Date(item.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
          rawDate: new Date(item.created_at).getTime(),
          type: item.type as LeadType || 'Öğrenci',
          followUpDate: item.follow_up_date || new Date().toISOString().split('T')[0]
        }));
        setLeads(mappedLeads);
      }

      // 2. Fetch sub branches for dropdown
      const { data: bData, error: bError } = await supabase
        .from('sub_branches')
        .select('name')
        .eq('status', 'active');

      if (!bError && bData) {
        const branchNames = bData.map(b => b.name).sort((a, b) => a.localeCompare(b, 'tr'));
        setSubBranches(branchNames);
      }

    } catch (err: any) {
      console.error('Fetch Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Handlers ---

  const toggleRow = (id: string) => {
    setExpandedRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const handleStatusChange = async (id: string, newStatus: LeadStatus) => {
    if (!canEdit) return;
    // Optimistic Update
    setLeads(leads.map(lead =>
      lead.id === id ? { ...lead, status: newStatus } : lead
    ));

    try {
      const { data, error } = await supabase
        .from('new_leads')
        .update({ status: newStatus })
        .eq('id', id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('Hata: Güncelleme işlemi sunucu tarafından reddedildi (RLS Politikası). Lütfen aşağıdaki SQL komutunu Supabase panelinde çalıştırın.');
        console.error('Update succeeded but no rows returned. Likely RLS issue.');
      }
    } catch (err: any) {
      console.error('Status Update Error:', err);
      alert(`Hata: ${err.message || 'Bilinmeyen bir hata oluştu'}`);
      fetchData(); // Revert on error
    }
  };

  const handleFollowUpDateChange = async (id: string, newDate: string) => {
    if (!canEdit || !newDate) return;

    // Optimistic Update with Functional State
    setLeads(prev => prev.map(lead =>
      lead.id === id ? { ...lead, followUpDate: newDate } : lead
    ));

    try {
      const { error } = await supabase
        .from('new_leads')
        .update({ follow_up_date: newDate })
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Date Update Error:', err);
      fetchData(); // Revert on error
    }
  };

  const handleEditClick = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    if (!canEdit) return;
    setEditingLeadId(lead.id);
    setNewLead({
      studentName: lead.studentName,
      parentName: lead.parentName,
      age: lead.age.toString(),
      branch: lead.branch,
      phone: lead.phone,
      source: lead.source,
      initialNote: '',
      followUpDate: lead.followUpDate
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLeadId(null);
    setNewLead({
      studentName: '',
      parentName: '',
      age: '',
      branch: '',
      phone: '',
      source: 'Instagram',
      initialNote: '',
      followUpDate: new Date().toISOString().split('T')[0]
    });
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newLead.phone.trim() || !newLead.source) return;
    setLoading(true);

    try {
      // For teachers and institutions, we prefix the name to clarify in the list
      const commonData = {
        student_name: newLead.studentName.trim(),
        age: parseInt(newLead.age) || 0,
        branch: newLead.branch,
        parent_name: newLead.parentName.trim(),
        phone: newLead.phone.trim(),
        source: newLead.source,
        type: 'Öğrenci' as LeadType, // Default to Student as differentiation is removed from UI
        follow_up_date: newLead.followUpDate
      };

      if (editingLeadId) {
        // UPDATE Existing
        const { error } = await supabase
          .from('new_leads')
          .update(commonData)
          .eq('id', editingLeadId);

        if (error) throw error;

      } else {
        // CREATE New
        // Construct initial note if present
        let initialNotes: Note[] = [];
        if (newLead.initialNote.trim()) {
          initialNotes.push({
            id: Date.now().toString(),
            user: noteAuthor,
            date: new Date().toLocaleString('tr-TR'),
            content: newLead.initialNote
          });
        }

        const { error } = await supabase.from('new_leads').insert({
          ...commonData,
          status: 'Takip',
          notes: initialNotes
        });

        if (error) throw error;
      }

      await fetchData();
      handleCloseModal();

    } catch (err: any) {
      console.error('Save Error:', err.message);
      alert('Kaydetme başarısız: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLead = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!canEdit) return;
    if (window.confirm(`${name} isimli talebi silmek istediğinize emin misiniz?`)) {
      setLoading(true);
      try {
        const { error } = await supabase.from('new_leads').delete().eq('id', id);
        if (error) throw error;
        setLeads(prev => prev.filter(item => item.id !== id));
      } catch (err: any) {
        console.error('Delete Error:', err.message);
        alert('Silme hatası: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteNote = async (leadId: string, noteId: string) => {
    if (currentUserRole !== UserRole.ADMIN) return;
    if (!window.confirm('Bu notu silmek istediğinize emin misiniz?')) return;

    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      const updatedNotes = lead.notes.filter(n => n.id !== noteId);
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: updatedNotes } : l));

      const { error } = await supabase
        .from('new_leads')
        .update({ notes: updatedNotes })
        .eq('id', leadId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Note Delete Error:', err.message);
      alert('Not silinemedi.');
      fetchData();
    }
  };

  const handleAddNote = async (leadId: string) => {
    if (!canEdit) return;
    const content = noteInputs[leadId];
    if (!content?.trim()) return;

    try {
      // 1. Find current lead
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      // 2. Create new note object
      const newNote: Note = {
        id: Date.now().toString(),
        user: noteAuthor,
        date: new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        content: content
      };

      // 3. Update local state optimistic
      const updatedNotes = [...lead.notes, newNote];
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: updatedNotes } : l));
      setNoteInputs(prev => {
        const next = { ...prev };
        delete next[leadId];
        return next;
      });

      // 4. Update DB
      const { error } = await supabase
        .from('new_leads')
        .update({ notes: updatedNotes })
        .eq('id', leadId);

      if (error) throw error;

    } catch (err: any) {
      console.error('Note Error:', err.message);
      alert('Not eklenemedi.');
      fetchData(); // Revert
    }
  };

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Helper for Status Colors (Row Backgrounds)
  const getRowStatusColor = (status: LeadStatus) => {
    switch (status) {
      case 'Görüşüldü': return 'bg-red-50/80 dark:bg-red-950/20';
      case 'Deneme': return 'bg-blue-50/80 dark:bg-blue-950/20';
      case 'Kayıt': return 'bg-green-100/90 dark:bg-green-900/30';
      case 'İptal': return 'bg-slate-50/50 dark:bg-slate-900/10 opacity-60';
      default: return '';
    }
  };

  const getStatusBadgeColor = (status: LeadStatus) => {
    switch (status) {
      case 'Takip': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
      case 'Görüşüldü': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'Deneme': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      case 'Kayıt': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      case 'İptal': return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-500 dark:border-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Helper for Branch Styling - Grouped by typical upper branches
  const getBranchStyle = (branch: string) => {
    const b = branch.toLowerCase();
    // Müzik / Enstrüman (Blue/Indigo)
    if (b.includes('piyano') || b.includes('gitar') || b.includes('keman') || b.includes('şan') || b.includes('müzik')) {
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md';
    }
    // Sahne Sanatları / Bale / Dans (Purple/Pink)
    if (b.includes('bale') || b.includes('dans') || b.includes('modern')) {
      return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-md';
    }
    // Görsel Sanatlar / Resim (Orange/Yellow)
    if (b.includes('resim') || b.includes('atölye') || b.includes('sanat')) {
      return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-md';
    }
    // Tiyatro / Drama (Green/Teal)
    if (b.includes('tiyatro') || b.includes('drama')) {
      return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md';
    }
    return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md';
  };

  // Helper for Source Icons
  const getSourceIcon = (source: LeadSource) => {
    switch (source) {
      case 'Instagram': return <Instagram size={14} className="text-pink-500" />;
      case 'Gmail': return <Mail size={14} className="text-red-500" />;
      case 'Whatsapp': return <MessageCircle size={14} className="text-green-500" />;
      case 'Verimor': return (
        <div className="w-5 h-5 flex items-center justify-center bg-orange-500 text-white rounded-full text-[10px] font-black">V</div>
      );
      case 'Referans / Tanıdık': return <User size={14} className="text-blue-500" />;
      default: return <HelpCircle size={14} className="text-slate-400" />;
    }
  };

  // --- Filtering & Sorting Logic ---
  const filteredLeads = useMemo(() => {
    let result = leads.filter(lead => {
      // 1. Cancelled Filter
      if (!showCancelled && lead.status === 'İptal') return false;

      // 2. Search Filter
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        return (
          lead.studentName.toLowerCase().includes(lowerTerm) ||
          lead.parentName.toLowerCase().includes(lowerTerm) ||
          lead.branch.toLowerCase().includes(lowerTerm) ||
          lead.source.toLowerCase().includes(lowerTerm)
        );
      }
      // 3. Future Follow-up Filter
      if (!showFutureLeads) {
        const today = new Date().toISOString().split('T')[0];
        if (lead.followUpDate > today) return false;
      }
      return true;
    });

    // 3. Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'createdAt') {
          aValue = a.rawDate;
          bValue = b.rawDate;
        } else {
          aValue = a[sortConfig.key as keyof Lead];
          bValue = b[sortConfig.key as keyof Lead];

          if (typeof aValue === 'string') aValue = aValue.toLowerCase();
          if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [leads, showCancelled, searchTerm, sortConfig, showFutureLeads]);

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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Yeni Talepler</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">Potansiyel öğrenci görüşmeleri ve durum takibi.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Aday ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple placeholder:text-slate-400 dark:placeholder:text-slate-500 h-[42px]"
            />
          </div>

          <div className="flex gap-4">
            {/* Refresh */}
            <button
              onClick={fetchData}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Cancelled Toggle Switch */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 h-[42px] flex-1 sm:flex-none justify-between sm:justify-start">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">İptaller</span>
              <button
                onClick={() => setShowCancelled(!showCancelled)}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${showCancelled ? 'bg-pnr-purple' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
              >
                <span
                  className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform duration-200 ml-1 mt-0.5 shadow-sm ${showCancelled ? 'translate-x-3.5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {/* Future Dates Switch */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 h-[42px] flex-1 sm:flex-none justify-between sm:justify-start">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">İleri Tarihliler</span>
              <button
                onClick={() => setShowFutureLeads(!showFutureLeads)}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${showFutureLeads ? 'bg-pnr-purple' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
              >
                <span
                  className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform duration-200 ml-1 mt-0.5 shadow-sm ${showFutureLeads ? 'translate-x-3.5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {canEdit && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-pnr-purple hover:bg-pnr-indigo text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-pnr-purple/20 flex items-center justify-center gap-2 h-[42px] flex-1 sm:flex-none"
              >
                <UserPlus size={18} />
                <span className="whitespace-nowrap">Yeni Talep</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="p-4 w-10 text-center text-[10px] font-semibold text-slate-500 uppercase">Sil</th>
                <th className="p-4 w-10 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-tighter">İşlem</th>
                <th className="p-4 w-32 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center">Kayıt Tarihi <SortIcon columnKey="createdAt" /></div>
                </th>
                <th className="p-4 w-40 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('studentName')}>
                  <div className="flex items-center">Öğrenci Adı <SortIcon columnKey="studentName" /></div>
                </th>
                <th className="p-4 w-32 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('branch')}>
                  <div className="flex items-center">Branş <SortIcon columnKey="branch" /></div>
                </th>
                <th className="p-4 w-40 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('parentName')}>
                  <div className="flex items-center uppercase">İLETİŞİM <SortIcon columnKey="parentName" /></div>
                </th>
                <th className="p-4 w-32 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('followUpDate')}>
                  <div className="flex items-center">Takip Tarihi <SortIcon columnKey="followUpDate" /></div>
                </th>
                <th className="p-4 w-32 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('status')}>
                  <div className="flex items-center">Durum <SortIcon columnKey="status" /></div>
                </th>
                <th className="p-4 w-10 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-tighter">Düzen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={10} className="p-8 text-center text-slate-500">Yükleniyor...</td></tr>
              ) : filteredLeads.length > 0 ? (
                filteredLeads.map((lead) => (
                  <React.Fragment key={lead.id}>
                    {/* Main Row */}
                    <tr
                      onClick={() => toggleRow(lead.id)}
                      className={`group hover:brightness-95 dark:hover:brightness-110 transition-all cursor-pointer ${getRowStatusColor(lead.status)} ${expandedRows.includes(lead.id) ? 'brightness-95 dark:brightness-110' : ''}`}
                    >
                      <td className="p-4 text-center">
                        {canEdit && (
                          <button
                            onClick={(e) => handleDeleteLead(e, lead.id, lead.studentName)}
                            className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                      <td className="p-4 text-slate-400 text-center">
                        {expandedRows.includes(lead.id) ? <ChevronDown size={20} className="mx-auto" /> : <ChevronRight size={20} className="mx-auto" />}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 w-fit whitespace-nowrap">
                            {getSourceIcon(lead.source)}
                            {lead.source}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-tight">
                            {lead.createdAt}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{lead.studentName}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Yaşı: {lead.age}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-sm font-bold leading-none ${getBranchStyle(lead.branch)}`}>
                          {lead.branch}
                        </span>
                      </td>
                      <td className="p-4 w-60">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{lead.parentName}</span>
                          <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 mt-0.5 font-mono font-medium">
                            <Phone size={14} className="text-pnr-cyan" />
                            <span>{lead.phone}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={lead.followUpDate}
                            onChange={(e) => handleFollowUpDateChange(lead.id, e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-pnr-purple w-[110px]"
                          />
                        </div>
                      </td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-pnr-purple transition-colors ${getStatusBadgeColor(lead.status)}`}
                        >
                          <option value="Takip" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Takip</option>
                          <option value="Görüşüldü" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white text-orange-600">Görüşüldü</option>
                          <option value="Deneme" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Deneme</option>
                          <option value="Kayıt" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Kayıt</option>
                          <option value="İptal" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">İptal</option>
                        </select>
                      </td>
                      <td className="p-4 text-center">
                        {canEdit && (
                          <button
                            onClick={(e) => handleEditClick(e, lead)}
                            className="text-slate-400 hover:text-pnr-purple p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <Edit size={18} />
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Row (Notes) */}
                    {expandedRows.includes(lead.id) && (
                      <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                        <td colSpan={8} className="p-0 border-b border-slate-100 dark:border-slate-800">
                          <div className="p-4 md:p-6 pl-10 md:pl-16 animate-in slide-in-from-top-2 duration-200">
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                              <MessageSquare size={16} /> Görüşme Notları
                            </h4>

                            {/* Note History */}
                            <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                              {lead.notes.length > 0 ? (
                                lead.notes.map((note) => (
                                  <div key={note.id} className="flex gap-4 group">
                                    <div className="flex flex-col items-center">
                                      <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 mt-1.5"></div>
                                      <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-700 group-last:hidden mt-1"></div>
                                    </div>
                                    <div className="flex-1 pb-2">
                                      <div className="flex items-center gap-2 mb-1">
                                        {/* Modified: Increased User Name Font Size */}
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{note.user}</span>
                                        <span className="text-xs text-slate-400">{note.date}</span>
                                        {currentUserRole === UserRole.ADMIN && (
                                          <button
                                            onClick={() => handleDeleteNote(lead.id, note.id)}
                                            className="ml-auto opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </div>
                                      <p className="text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                        {note.content}
                                      </p>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-slate-400 italic pl-6">Henüz not eklenmemiş.</p>
                              )}
                            </div>

                            {/* Add Note Input */}
                            {canEdit && (
                              <div className="flex gap-3 md:pl-6">
                                <input
                                  type="text"
                                  value={noteInputs[lead.id] || ''}
                                  onChange={(e) => setNoteInputs({ ...noteInputs, [lead.id]: e.target.value })}
                                  placeholder="Yeni not ekle..."
                                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none placeholder:text-slate-400"
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote(lead.id)}
                                />
                                <button
                                  onClick={() => handleAddNote(lead.id)}
                                  className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-2.5 rounded-xl hover:opacity-90 transition-opacity"
                                >
                                  <Send size={18} />
                                </button>
                              </div>
                            )}

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 dark:text-slate-400">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEAD MODAL (Create / Edit) */}
      {
        isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-pnr-card w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">

              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus size={20} className="text-pnr-purple" />
                  {editingLeadId ? 'Talebi Düzenle' : 'Yeni Talep Oluştur'}
                </h2>
                <button onClick={handleCloseModal} className="text-slate-500 hover:text-slate-900 dark:hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <form onSubmit={handleSaveLead} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Öğrenci Adı
                      </label>
                      <input
                        type="text"
                        value={newLead.studentName}
                        onChange={(e) => setNewLead({ ...newLead, studentName: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                        placeholder="Öğrenci Ad Soyad"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Veli Adı
                      </label>
                      <input
                        type="text"
                        value={newLead.parentName}
                        onChange={(e) => setNewLead({ ...newLead, parentName: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                        placeholder="Veli Ad Soyad"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Telefon *</label>
                      <input
                        type="tel" required
                        placeholder="0532-"
                        value={newLead.phone}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '');
                          if (val && !val.startsWith('0')) val = '0' + val;
                          setNewLead({ ...newLead, phone: val.slice(0, 11) });
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Yaş (Opsiyonel)</label>
                      <input
                        type="number"
                        value={newLead.age}
                        onChange={(e) => setNewLead({ ...newLead, age: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                        placeholder="Yaş giriniz"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">İlgilendiği Branş</label>
                      <select
                        multiple
                        value={selectedBranches}
                        onChange={handleBranchSelectionChange}
                        className="w-full min-h-28 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                      >
                        {branchOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-slate-400">Birden çok seçim için Ctrl / Cmd tuşunu kullanın.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data Kaynağı *</label>
                      <select
                        required
                        value={newLead.source}
                        onChange={(e) => setNewLead({ ...newLead, source: e.target.value as LeadSource })}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                      >
                        {SOURCE_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Takip Tarihi</label>
                    <input
                      type="date"
                      value={newLead.followUpDate}
                      onChange={(e) => setNewLead({ ...newLead, followUpDate: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Not (Opsiyonel)</label>
                    <textarea
                      rows={3}
                      value={newLead.initialNote}
                      onChange={(e) => setNewLead({ ...newLead, initialNote: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none resize-none"
                      placeholder="Eklemek istediğiniz not..."
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-pnr-purple hover:bg-pnr-indigo text-white px-6 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-pnr-purple/20 disabled:opacity-50"
                    >
                      {loading ? 'İşleniyor...' : (editingLeadId ? 'Güncelle' : 'Kaydet')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )
      }

    </div >
  );
};

export default Leads;
