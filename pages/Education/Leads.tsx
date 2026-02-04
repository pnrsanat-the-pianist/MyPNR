import React, { useState, useMemo, useEffect } from 'react';
import { 
  UserPlus, Search, Filter, ChevronDown, ChevronRight, 
  MessageSquare, Phone, Calendar, User, Send, X, Check,
  Globe, ArrowUpDown, ArrowUp, ArrowDown, Edit, RefreshCcw
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// --- Types ---
type LeadStatus = 'Takip' | 'Deneme' | 'Kayıt' | 'İptal';
type LeadSource = 'Instagram' | 'Verimor' | 'Whatsapp' | 'Referans / Tanıdık' | 'Google' | 'Diğer';

const SOURCE_OPTIONS: LeadSource[] = ['Instagram', 'Verimor', 'Whatsapp', 'Referans / Tanıdık', 'Google', 'Diğer'];

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
}

const BRANCH_OPTIONS = ['Bale', 'Piyano', 'Gitar', 'Keman', 'Dans', 'Resim', 'Tiyatro'];

type SortKey = keyof Lead | 'parentName';
interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

const Leads: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  
  // Filtering & Sorting States
  const [searchTerm, setSearchTerm] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  
  // New Lead Form State
  const [newLead, setNewLead] = useState({
    studentName: '',
    age: '',
    branch: 'Bale',
    parentName: '',
    phone: '',
    source: 'Instagram' as LeadSource,
    initialNote: ''
  });

  // New Note Input State (mapped by lead ID)
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  // --- FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('new_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedLeads: Lead[] = data.map((item: any) => ({
          id: item.id,
          studentName: item.student_name,
          age: item.age || 0,
          branch: item.branch || 'Bale',
          parentName: item.parent_name,
          phone: item.phone,
          source: item.source as LeadSource,
          status: item.status as LeadStatus,
          notes: item.notes || [], // JSONB column to array
          createdAt: new Date(item.created_at).toLocaleDateString('tr-TR'),
        }));
        setLeads(mappedLeads);
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
    // Optimistic Update
    setLeads(leads.map(lead => 
      lead.id === id ? { ...lead, status: newStatus } : lead
    ));

    try {
      await supabase.from('new_leads').update({ status: newStatus }).eq('id', id);
    } catch (err) {
      console.error('Status Update Error:', err);
      fetchData(); // Revert on error
    }
  };

  const handleEditClick = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation(); 
    setEditingLeadId(lead.id);
    setNewLead({
        studentName: lead.studentName,
        age: lead.age.toString(),
        branch: lead.branch,
        parentName: lead.parentName,
        phone: lead.phone,
        source: lead.source,
        initialNote: '' 
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLeadId(null);
    setNewLead({ studentName: '', age: '', branch: 'Bale', parentName: '', phone: '', source: 'Instagram', initialNote: '' });
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.studentName || !newLead.parentName || !newLead.phone) return;
    setLoading(true);

    try {
      const commonData = {
        student_name: newLead.studentName,
        age: parseInt(newLead.age) || 0,
        branch: newLead.branch,
        parent_name: newLead.parentName,
        phone: newLead.phone,
        source: newLead.source,
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
             user: 'Admin', // In real app use actual user
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

  const handleAddNote = async (leadId: string) => {
    const content = noteInputs[leadId];
    if (!content?.trim()) return;

    try {
      // 1. Find current lead
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;

      // 2. Create new note object
      const newNote: Note = {
        id: Date.now().toString(),
        user: 'Admin', // Replace with dynamic user if available
        date: new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        content: content
      };

      // 3. Update local state optimistic
      const updatedNotes = [...lead.notes, newNote];
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: updatedNotes } : l));
      setNoteInputs({ ...noteInputs, [leadId]: '' });

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

  // Helper for Status Colors
  const getStatusColor = (status: LeadStatus) => {
    switch (status) {
      case 'Takip': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
      case 'Deneme': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      case 'Kayıt': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      case 'İptal': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Helper for Branch Styling
  const getBranchStyle = (branch: string) => {
    const b = branch.toLowerCase();
    if (b.includes('bale') || b.includes('dans')) return 'text-pnr-purple dark:text-purple-400';
    if (b.includes('piyano') || b.includes('gitar') || b.includes('keman')) return 'text-pnr-blue dark:text-blue-400';
    if (b.includes('resim')) return 'text-pnr-orange dark:text-orange-400';
    if (b.includes('tiyatro')) return 'text-pnr-green dark:text-green-400';
    return 'text-slate-700 dark:text-slate-300';
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
      return true;
    });

    // 3. Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Lead];
        let bValue: any = b[sortConfig.key as keyof Lead];
        
        // Special case for strings to be case insensitive
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [leads, showCancelled, searchTerm, sortConfig]);

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
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                        showCancelled ? 'bg-pnr-purple' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                >
                    <span 
                        className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform duration-200 ml-1 mt-0.5 shadow-sm ${
                            showCancelled ? 'translate-x-3.5' : 'translate-x-0'
                        }`}
                    />
                </button>
              </div>

              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-pnr-purple hover:bg-pnr-indigo text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-pnr-purple/20 flex items-center justify-center gap-2 h-[42px] flex-1 sm:flex-none"
              >
                <UserPlus size={18} />
                <span className="whitespace-nowrap">Yeni Talep</span>
              </button>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="p-4 w-10"></th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('studentName')}>
                  <div className="flex items-center">Aday Öğrenci <SortIcon columnKey="studentName" /></div>
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('age')}>
                  <div className="flex items-center">Yaş <SortIcon columnKey="age" /></div>
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('branch')}>
                  <div className="flex items-center">Branş <SortIcon columnKey="branch" /></div>
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('source')}>
                  <div className="flex items-center">Kaynak <SortIcon columnKey="source" /></div>
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('parentName')}>
                  <div className="flex items-center">Veli İletişim <SortIcon columnKey="parentName" /></div>
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 group" onClick={() => handleSort('status')}>
                  <div className="flex items-center">Durum <SortIcon columnKey="status" /></div>
                </th>
                <th className="p-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                 <tr><td colSpan={8} className="p-8 text-center text-slate-500">Yükleniyor...</td></tr>
              ) : filteredLeads.length > 0 ? (
                filteredLeads.map((lead) => (
                  <React.Fragment key={lead.id}>
                    {/* Main Row */}
                    <tr 
                      onClick={() => toggleRow(lead.id)}
                      className={`group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${expandedRows.includes(lead.id) ? 'bg-slate-50 dark:bg-slate-800/30' : ''}`}
                    >
                      <td className="p-4 text-slate-400 dark:text-slate-500">
                        {expandedRows.includes(lead.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold shrink-0">
                            {lead.studentName.charAt(0)}
                          </div>
                          <div>
                            {/* Modified: Removed date from here */}
                            <div className="font-medium text-slate-900 dark:text-white">{lead.studentName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 font-mono">
                        {lead.age}
                      </td>
                      <td className="p-4">
                        {/* Modified: Increased Font Size & Added Color Logic */}
                        <span className={`text-lg font-bold ${getBranchStyle(lead.branch)}`}>
                            {lead.branch}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1">
                          <Globe size={12} className="opacity-50" />
                          {lead.source}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                            {/* Modified: Increased Parent Name Font Size to text-base */}
                            <span className="text-base font-medium text-slate-900 dark:text-white">{lead.parentName}</span>
                            {/* Modified: Increased Phone Font Size */}
                            <div className="flex items-center gap-1 text-base text-slate-600 dark:text-slate-300 mt-1 font-mono font-medium">
                                <Phone size={16} className="text-pnr-cyan" />
                                <span>{lead.phone}</span>
                            </div>
                        </div>
                      </td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <select
                            value={lead.status}
                            onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-pnr-purple transition-colors ${getStatusColor(lead.status)}`}
                        >
                            <option value="Takip" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Takip</option>
                            <option value="Deneme" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Deneme</option>
                            <option value="Kayıt" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Kayıt</option>
                            <option value="İptal" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">İptal</option>
                        </select>
                      </td>
                      <td className="p-4 text-center">
                         <button 
                            onClick={(e) => handleEditClick(e, lead)}
                            className="text-slate-400 hover:text-pnr-purple p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                         >
                            <Edit size={18} />
                         </button>
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
                                                    {/* Modified: Increased Date Font Size */}
                                                    <span className="text-xs text-slate-400">{note.date}</span>
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
                            <div className="flex gap-3 md:pl-6">
                                <input 
                                    type="text" 
                                    value={noteInputs[lead.id] || ''}
                                    onChange={(e) => setNoteInputs({...noteInputs, [lead.id]: e.target.value})}
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
  
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400">
                     Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEAD MODAL (Create / Edit) */}
      {isModalOpen && (
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
              <form onSubmit={handleSaveLead} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Öğrenci Ad Soyad *</label>
                          <input 
                              type="text" required
                              value={newLead.studentName}
                              onChange={(e) => setNewLead({...newLead, studentName: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Yaş</label>
                          <input 
                              type="number"
                              value={newLead.age}
                              onChange={(e) => setNewLead({...newLead, age: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                          />
                      </div>
                  </div>
  
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">İlgilendiği Branş</label>
                          <select 
                              value={newLead.branch}
                              onChange={(e) => setNewLead({...newLead, branch: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                          >
                              {BRANCH_OPTIONS.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data Kaynağı</label>
                          <select 
                              value={newLead.source}
                              onChange={(e) => setNewLead({...newLead, source: e.target.value as LeadSource})}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                          >
                              {SOURCE_OPTIONS.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                              ))}
                          </select>
                      </div>
                  </div>
  
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Veli Ad Soyad *</label>
                          <input 
                              type="text" required
                              value={newLead.parentName}
                              onChange={(e) => setNewLead({...newLead, parentName: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Telefon *</label>
                          <input 
                              type="tel" required
                              value={newLead.phone}
                              onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                          />
                      </div>
                  </div>
  
                  {!editingLeadId && (
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">İlk Not / Açıklama</label>
                          <textarea 
                              rows={3}
                              value={newLead.initialNote}
                              onChange={(e) => setNewLead({...newLead, initialNote: e.target.value})}
                              placeholder="Veli ile görüşülen detaylar..."
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none resize-none"
                          ></textarea>
                      </div>
                  )}
  
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
      )}

    </div>
  );
};

export default Leads;