
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, CreditCard, TrendingUp, TrendingDown, Search, 
  Save, X, Upload, CheckSquare, Square, Trash2,
  FileText, Terminal, RefreshCcw
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';

// --- Types ---
interface BankRecord {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category_name: string;
  amount: number;
  description: string;
  installment_info?: string;
}

interface CategoryDescription {
  id: string;
  description: string;
}

interface CategoryOption {
  id: string;
  title: string;
  type: 'income' | 'expense';
  descriptions: CategoryDescription[];
}

interface ImportedRow {
  id: string; // temp id for UI
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  isSelected: boolean;
  
  // Extended Fields for Import
  categoryId: string;
  subCategoryId: string;
  targetMonth: number; // 0-11
  targetYear: number;
  installments: number;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const DenizbankPOS: React.FC = () => {
  const [records, setRecords] = useState<BankRecord[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedRows, setImportedRows] = useState<ImportedRow[]>([]);
  
  // Bulk Actions State
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [bulkSubCategory, setBulkSubCategory] = useState<string>('');

  // Manual Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'income' as 'income' | 'expense',
    categoryId: '',
    amount: '',
    description: ''
  });

  // --- Helpers ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getYearsList = () => {
      const currentYear = new Date().getFullYear();
      return [currentYear - 1, currentYear, currentYear + 1];
  };

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Categories with Descriptions
      const { data: catData, error: catError } = await supabase
        .from('financial_categories')
        .select(`
          id, 
          title, 
          type,
          financial_category_descriptions (
            id,
            description
          )
        `)
        .order('title');
      
      if (catError) throw catError;

      if (catData) {
        const formattedCategories: CategoryOption[] = catData.map((c: any) => ({
            id: c.id,
            title: c.title,
            type: c.type,
            descriptions: c.financial_category_descriptions || []
        }));
        setCategories(formattedCategories);
      }

      // 2. Fetch All Transactions from POS Book
      const { data: recordData, error } = await supabase
        .from('denizbank_pos_book')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setRecords(recordData || []);

    } catch (err: any) {
      console.error('Veri çekme hatası:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Excel Parsing Logic ---
  
  const parseTurkishAmount = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return 0;

    let str = val.trim();
    const isNegative = str.startsWith('-') || str.endsWith('-') || (str.startsWith('(') && str.endsWith(')'));
    
    let cleanStr = str.replace(/\./g, ''); 
    cleanStr = cleanStr.replace(/[^0-9,]/g, ''); 
    cleanStr = cleanStr.replace(',', '.'); 

    let num = parseFloat(cleanStr);
    if (isNaN(num)) return 0;

    return isNegative ? -num : num;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          const bstr = evt.target?.result;
          if (bstr) {
              try {
                  const wb = XLSX.read(bstr, { type: 'array' });
                  const wsname = wb.SheetNames[0];
                  const ws = wb.Sheets[wsname];
                  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
                  
                  const parsedRows: ImportedRow[] = [];
                  
                  let dateIdx = -1;
                  let descIdx = -1;
                  let amountIdx = -1;

                  // Header Detection
                  for(let i=0; i<Math.min(data.length, 10); i++) {
                      const row = data[i];
                      row.forEach((cell: any, idx: number) => {
                          if (typeof cell !== 'string') return;
                          const c = cell.toLowerCase();
                          if (c.includes('tarih')) dateIdx = idx;
                          if (c.includes('açıklama') || c.includes('aciklama')) descIdx = idx;
                          if (c.includes('tutar') || c.includes('bakıye') || c.includes('bakiye') || c.includes('net')) {
                              if (amountIdx === -1 || c.includes('tutar')) amountIdx = idx;
                          }
                      });
                      if (dateIdx !== -1 && amountIdx !== -1) break; 
                  }

                  data.forEach((row, idx) => {
                      if (row.length === 0) return;

                      let dateCellIndex = dateIdx;
                      if (dateCellIndex === -1 || !row[dateCellIndex]) {
                          dateCellIndex = row.findIndex(cell => 
                              typeof cell === 'string' && cell.match(/^\d{2}[./-]\d{2}[./-]\d{4}/)
                          );
                      }
                      if (dateCellIndex === -1) return; 

                      const dateStrRaw = row[dateCellIndex];
                      const dateMatch = dateStrRaw.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
                      if (!dateMatch) return;

                      const [_, d, m, y] = dateMatch;
                      const isoDate = `${y}-${m}-${d}`;
                      const dateObj = new Date(isoDate);

                      let amount = 0;
                      let amountFound = false;
                      
                      if (amountIdx !== -1 && row[amountIdx]) {
                          amount = parseTurkishAmount(row[amountIdx]);
                          if (amount !== 0) amountFound = true;
                      }

                      if (!amountFound) {
                          for (let i = row.length - 1; i >= 0; i--) {
                              if (i === dateCellIndex) continue;
                              const val = parseTurkishAmount(row[i]);
                              if (val !== 0) {
                                  amount = val;
                                  amountFound = true;
                                  break;
                              }
                          }
                      }

                      let desc = '';
                      if (descIdx !== -1 && row[descIdx]) {
                          desc = row[descIdx];
                      } else {
                          let maxLength = 0;
                          row.forEach((cell, i) => {
                              if (i !== dateCellIndex && typeof cell === 'string' && cell.length > maxLength) {
                                  if (!cell.match(/^[\d.,]+$/)) {
                                      desc = cell;
                                      maxLength = cell.length;
                                  }
                              }
                          });
                      }

                      if (amountFound && amount !== 0) {
                          const type = amount > 0 ? 'income' : 'expense';
                          
                          let detectedCategoryId = '';
                          
                          parsedRows.push({
                              id: Math.random().toString(36).substr(2, 9),
                              date: isoDate,
                              description: desc || 'İçe Aktarılan POS İşlemi',
                              amount: Math.abs(amount),
                              type: type,
                              isSelected: true,
                              categoryId: detectedCategoryId,
                              subCategoryId: '',
                              targetMonth: isNaN(dateObj.getTime()) ? new Date().getMonth() : dateObj.getMonth(),
                              targetYear: isNaN(dateObj.getTime()) ? new Date().getFullYear() : dateObj.getFullYear(),
                              installments: 1
                          });
                      }
                  });

                  if (parsedRows.length > 0) {
                      setImportedRows(parsedRows);
                      setIsUploadModalOpen(true);
                  } else {
                      alert("Dosyadan anlamlı veri okunamadı.");
                  }

              } catch (err: any) {
                  console.error("Excel Parse Error:", err);
                  alert("Dosya okunamadı: " + err.message);
              }
          }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
  };

  // --- Import Modal Handlers ---

  const updateImportRow = (id: string, field: keyof ImportedRow, value: any) => {
      setImportedRows(prev => prev.map(r => {
          if (r.id === id) {
              if (field === 'categoryId') {
                  return { ...r, [field]: value, subCategoryId: '' };
              }
              if (field === 'type') {
                  return { ...r, [field]: value, categoryId: '', subCategoryId: '' };
              }
              return { ...r, [field]: value };
          }
          return r;
      }));
  };

  const applyBulkCategory = () => {
      if (!bulkCategory) return;
      setImportedRows(prev => prev.map(r => r.isSelected ? { ...r, categoryId: bulkCategory, subCategoryId: bulkSubCategory } : r));
  };

  const toggleImportRowSelection = (id: string) => {
      setImportedRows(prev => prev.map(r => r.id === id ? { ...r, isSelected: !r.isSelected } : r));
  };

  const confirmImport = async () => {
      const selectedRows = importedRows.filter(r => r.isSelected);
      if (selectedRows.length === 0) return;

      const invalidRows = selectedRows.filter(r => {
          if (!r.categoryId) return true;
          const cat = categories.find(c => c.id === r.categoryId);
          if (cat && cat.descriptions.length > 0 && !r.subCategoryId) {
              return true;
          }
          return false;
      });

      if (invalidRows.length > 0) {
          alert(`Lütfen işaretli ${invalidRows.length} satırdaki eksik bilgileri doldurunuz.`);
          return;
      }

      setLoading(true);
      try {
          const dbRows: any[] = [];

          selectedRows.forEach(row => {
              const category = categories.find(c => c.id === row.categoryId);
              const subCategory = category?.descriptions.find(d => d.id === row.subCategoryId);
              const catName = category?.title || 'Diğer';
              
              const transDay = new Date(row.date).getDate();
              const totalAmount = row.amount;
              const installments = Math.max(1, row.installments);
              
              const baseAmount = Math.floor((totalAmount / installments) * 100) / 100;
              const remainder = Number((totalAmount - (baseAmount * installments)).toFixed(2));

              for (let i = 0; i < installments; i++) {
                  let targetY = row.targetYear;
                  let targetM = row.targetMonth + i;
                  
                  targetY += Math.floor(targetM / 12);
                  targetM = targetM % 12;

                  const daysInMonth = new Date(targetY, targetM + 1, 0).getDate();
                  const finalDay = Math.min(transDay, daysInMonth);
                  
                  const recordDate = new Date(Date.UTC(targetY, targetM, finalDay));
                  const isoDate = recordDate.toISOString().split('T')[0];

                  const periodString = `${MONTH_NAMES[targetM]} ${targetY}`;
                  
                  let finalDesc = `${row.description}`;
                  if (subCategory) finalDesc += ` - ${subCategory.description}`;
                  finalDesc += ` - ${periodString}`;

                  let installmentAmount = baseAmount;
                  if (i === installments - 1) {
                      installmentAmount += remainder;
                  }

                  dbRows.push({
                      date: isoDate,
                      description: finalDesc,
                      amount: Number(installmentAmount.toFixed(2)),
                      type: row.type,
                      category_id: row.categoryId,
                      category_name: catName,
                      installment_info: installments > 1 ? `${i+1}/${installments}` : null
                  });
              }
          });

          const { error } = await supabase.from('denizbank_pos_book').insert(dbRows);
          if (error) throw error;

          setIsUploadModalOpen(false);
          setImportedRows([]);
          fetchData();
          alert(`${dbRows.length} adet POS kaydı başarıyla oluşturuldu.`);

      } catch (err: any) {
          alert("Hata: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  // --- Manual Add Handlers ---
  const handleManualSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.amount || !formData.categoryId) return;

      setLoading(true);
      try {
          const cat = categories.find(c => c.id === formData.categoryId);
          const { error } = await supabase.from('denizbank_pos_book').insert({
              date: formData.date,
              type: formData.type,
              category_id: formData.categoryId,
              category_name: cat?.title || '',
              amount: parseFloat(formData.amount),
              description: formData.description
          });

          if (error) throw error;
          
          setIsManualModalOpen(false);
          setFormData({
            date: new Date().toISOString().split('T')[0],
            type: 'income',
            categoryId: '',
            amount: '',
            description: ''
          });
          fetchData();

      } catch (err: any) {
          alert("Hata: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async (id: string) => {
      if(!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
      try {
          const { error } = await supabase.from('denizbank_pos_book').delete().eq('id', id);
          if (error) throw error;
          setRecords(prev => prev.filter(r => r.id !== id));
      } catch (err: any) {
          alert("Silinemedi: " + err.message);
      }
  };

  // Stats
  const totalIncome = records.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
  const balance = totalIncome - totalExpense;

  const filteredRecords = records.filter(r => 
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.category_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700">
                <CreditCard size={32} />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Denizbank POS</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">POS cihazı hareketleri ve gün sonu raporları.</p>
            </div>
        </div>

        <div className="flex flex-wrap gap-3">
            {/* Hidden File Input */}
            <input 
                type="file" 
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx, .csv"
                onChange={handleFileUpload}
            />
            
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
                <Upload size={18} /> Excel / CSV Yükle
            </button>

            <button 
                onClick={() => setIsManualModalOpen(true)}
                className="bg-pnr-purple hover:bg-pnr-indigo text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-pnr-purple/20 flex items-center gap-2 transition-transform active:scale-95"
            >
                <Plus size={20} /> Manuel Ekle
            </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">POS Bakiyesi</span>
              <div className={`text-3xl font-bold font-mono ${balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                  {formatCurrency(balance)}
              </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 p-5 rounded-2xl flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-green-600"/>
                  <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Toplam Çekim</span>
              </div>
              <div className="text-2xl font-bold font-mono text-green-700 dark:text-green-400">{formatCurrency(totalIncome)}</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 p-5 rounded-2xl flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                  <TrendingDown size={16} className="text-red-600"/>
                  <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">İade / Kesinti</span>
              </div>
              <div className="text-2xl font-bold font-mono text-red-700 dark:text-red-400">{formatCurrency(totalExpense)}</div>
          </div>
      </div>

      {/* Filter Bar */}
      <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
              type="text" 
              placeholder="İşlem ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pnr-purple dark:text-white"
          />
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
              <div className="p-12 text-center text-slate-500">Yükleniyor...</div>
          ) : (
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase">
                              <th className="p-4 w-32">Tarih</th>
                              <th className="p-4">Açıklama</th>
                              <th className="p-4">Kategori</th>
                              <th className="p-4 text-center">Taksit</th>
                              <th className="p-4 text-right w-40">Tutar</th>
                              <th className="p-4 w-16"></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredRecords.length > 0 ? (
                              filteredRecords.map((record) => (
                                  <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                      <td className="p-4 text-sm text-slate-600 dark:text-slate-300 font-mono">
                                          {formatDate(record.date)}
                                      </td>
                                      <td className="p-4 text-sm font-medium text-slate-900 dark:text-white">
                                          {record.description}
                                      </td>
                                      <td className="p-4">
                                          <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                                              {record.category_name}
                                          </span>
                                      </td>
                                      <td className="p-4 text-center text-xs text-slate-500">
                                          {record.installment_info || '-'}
                                      </td>
                                      <td className={`p-4 text-right font-bold text-sm ${record.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                          {record.type === 'income' ? '+' : '-'}{formatCurrency(record.amount)}
                                      </td>
                                      <td className="p-4 text-center">
                                          <button 
                                              onClick={() => handleDelete(record.id)}
                                              className="text-slate-300 hover:text-red-500 transition-colors"
                                          >
                                              <Trash2 size={16} />
                                          </button>
                                      </td>
                                  </tr>
                              ))
                          ) : (
                              <tr>
                                  <td colSpan={6} className="p-8 text-center text-slate-400 text-sm">
                                      Kayıt bulunamadı.
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          )}
      </div>

      {/* --- MODALS --- */}

      {/* IMPORT MODAL */}
      {isUploadModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
             <div className="bg-white dark:bg-pnr-card w-full max-w-[95vw] h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                 <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText size={20} className="text-pnr-purple"/> Dosya Önizleme ve Düzenleme (POS)
                    </h3>
                    <button onClick={() => setIsUploadModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-900"/></button>
                 </div>

                 {/* Bulk Controls */}
                 <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-end">
                     <div className="w-64">
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Seçililere Kategori Ata</label>
                         <select 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs dark:text-white"
                            value={bulkCategory}
                            onChange={(e) => { setBulkCategory(e.target.value); setBulkSubCategory(''); }}
                         >
                             <option value="">Seçiniz...</option>
                             {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                         </select>
                     </div>
                     <div className="w-64">
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Seçililere Alt Kategori Ata</label>
                         <select 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs dark:text-white"
                            value={bulkSubCategory}
                            onChange={(e) => setBulkSubCategory(e.target.value)}
                            disabled={!bulkCategory}
                         >
                             <option value="">Seçiniz...</option>
                             {categories.find(c => c.id === bulkCategory)?.descriptions.map(d => (
                                 <option key={d.id} value={d.id}>{d.description}</option>
                             ))}
                         </select>
                     </div>
                     <button 
                        onClick={applyBulkCategory}
                        className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white px-4 py-2 rounded-lg text-xs font-bold h-[34px]"
                     >
                         Uygula
                     </button>
                     <div className="text-xs text-slate-500 ml-auto flex items-center">
                         {importedRows.filter(r => r.isSelected).length} satır seçildi.
                     </div>
                 </div>
                 
                 {/* Data Table */}
                 <div className="flex-1 overflow-auto p-0">
                     <table className="w-full text-left border-collapse text-xs">
                         <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 uppercase sticky top-0 z-10 shadow-sm">
                             <tr>
                                 <th className="p-3 w-10 text-center">
                                     <button 
                                        onClick={() => {
                                            const allSelected = importedRows.every(r => r.isSelected);
                                            setImportedRows(importedRows.map(r => ({ ...r, isSelected: !allSelected })));
                                        }}
                                     >
                                         {importedRows.every(r => r.isSelected) ? <CheckSquare size={16}/> : <Square size={16}/>}
                                     </button>
                                 </th>
                                 <th className="p-3 w-28">Tarih</th>
                                 <th className="p-3 min-w-[200px]">Açıklama</th>
                                 <th className="p-3 w-24 text-right">Tutar</th>
                                 <th className="p-3 w-24 text-center">Tür</th>
                                 <th className="p-3 w-40">Kategori</th>
                                 <th className="p-3 w-40">Alt Kategori</th>
                                 <th className="p-3 w-28">Ait Olduğu Ay</th>
                                 <th className="p-3 w-20">Yıl</th>
                                 <th className="p-3 w-16 text-center">Taksit</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                             {importedRows.map((row) => {
                                 const rowCategory = categories.find(c => c.id === row.categoryId);
                                 const isCategoryMissing = !row.categoryId;
                                 const hasSubOptions = rowCategory?.descriptions && rowCategory.descriptions.length > 0;
                                 const isSubCategoryMissing = hasSubOptions && !row.subCategoryId;

                                 return (
                                 <tr key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${!row.isSelected ? 'opacity-50 grayscale' : ''}`}>
                                     <td className="p-3 text-center align-middle">
                                         <button onClick={() => toggleImportRowSelection(row.id)} className="text-pnr-purple">
                                             {row.isSelected ? <CheckSquare size={16}/> : <Square size={16} className="text-slate-300"/>}
                                         </button>
                                     </td>
                                     <td className="p-3 font-mono text-slate-600 dark:text-slate-300 align-middle">{row.date}</td>
                                     <td className="p-3 text-slate-900 dark:text-white align-middle truncate max-w-[200px]" title={row.description}>
                                         {row.description}
                                     </td>
                                     <td className={`p-3 font-bold text-right align-middle ${row.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                                         {row.type === 'expense' ? '-' : ''}{formatCurrency(row.amount)}
                                     </td>
                                     <td className="p-2 align-middle">
                                         <select
                                            className={`w-full border rounded p-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-offset-1 ${
                                                row.type === 'income' 
                                                ? 'bg-green-50 text-green-700 border-green-200 focus:ring-green-500' 
                                                : 'bg-red-50 text-red-700 border-red-200 focus:ring-red-500'
                                            }`}
                                            value={row.type}
                                            onChange={(e) => updateImportRow(row.id, 'type', e.target.value as 'income' | 'expense')}
                                         >
                                             <option value="income">Gelir (+)</option>
                                             <option value="expense">Gider (-)</option>
                                         </select>
                                     </td>
                                     {/* Category Select */}
                                     <td className="p-2 align-middle">
                                         <select 
                                            className={`w-full bg-white dark:bg-slate-800 border rounded p-1.5 focus:ring-1 focus:ring-pnr-purple ${
                                                isCategoryMissing ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'
                                            }`}
                                            value={row.categoryId}
                                            onChange={(e) => updateImportRow(row.id, 'categoryId', e.target.value)}
                                         >
                                             <option value="">Seçiniz...</option>
                                             {categories.filter(c => c.type === row.type).map(c => (
                                                 <option key={c.id} value={c.id}>{c.title}</option>
                                             ))}
                                         </select>
                                     </td>
                                     {/* Sub Category Select */}
                                     <td className="p-2 align-middle">
                                         <select 
                                            className={`w-full bg-white dark:bg-slate-800 border rounded p-1.5 focus:ring-1 focus:ring-pnr-purple ${
                                                isSubCategoryMissing ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'
                                            }`}
                                            value={row.subCategoryId}
                                            onChange={(e) => updateImportRow(row.id, 'subCategoryId', e.target.value)}
                                            disabled={!row.categoryId}
                                         >
                                             <option value="">Seçiniz...</option>
                                             {rowCategory?.descriptions.map(d => (
                                                 <option key={d.id} value={d.id}>{d.description}</option>
                                             ))}
                                         </select>
                                     </td>
                                     {/* Month Select */}
                                     <td className="p-2 align-middle">
                                         <select 
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5"
                                            value={row.targetMonth}
                                            onChange={(e) => updateImportRow(row.id, 'targetMonth', parseInt(e.target.value))}
                                         >
                                             {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                         </select>
                                     </td>
                                     {/* Year Select */}
                                     <td className="p-2 align-middle">
                                         <select 
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5"
                                            value={row.targetYear}
                                            onChange={(e) => updateImportRow(row.id, 'targetYear', parseInt(e.target.value))}
                                         >
                                             {getYearsList().map(y => <option key={y} value={y}>{y}</option>)}
                                         </select>
                                     </td>
                                     {/* Installments */}
                                     <td className="p-2 align-middle text-center">
                                         <input 
                                            type="number" 
                                            min="1" max="24"
                                            className="w-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-center"
                                            value={row.installments}
                                            onChange={(e) => updateImportRow(row.id, 'installments', parseInt(e.target.value))}
                                         />
                                     </td>
                                 </tr>
                             )})}
                         </tbody>
                     </table>
                 </div>

                 <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                     <button onClick={() => setIsUploadModalOpen(false)} className="px-4 py-2 text-slate-500 hover:text-slate-800 font-medium">İptal</button>
                     <button 
                        onClick={confirmImport}
                        className="bg-pnr-purple hover:bg-pnr-indigo text-white px-6 py-2 rounded-xl font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                        disabled={loading || importedRows.filter(r => r.isSelected).length === 0}
                     >
                         {loading ? 'Aktarılıyor...' : `Seçilenleri Aktar (${importedRows.filter(r => r.isSelected).length})`}
                     </button>
                 </div>
             </div>
          </div>
      )}

      {/* MANUAL ADD MODAL */}
      {isManualModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
             <div className="bg-white dark:bg-pnr-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                 <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                        <Plus size={20} className="text-pnr-purple"/> Yeni Kayıt Ekle
                    </h3>
                    <button onClick={() => setIsManualModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-900"/></button>
                 </div>
                 
                 <form onSubmit={handleManualSave} className="p-6 space-y-4">
                     <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                         <button type="button" onClick={() => setFormData({...formData, type: 'income'})} className={`py-2 rounded-lg text-sm font-bold ${formData.type === 'income' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500'}`}>Gelir</button>
                         <button type="button" onClick={() => setFormData({...formData, type: 'expense'})} className={`py-2 rounded-lg text-sm font-bold ${formData.type === 'expense' ? 'bg-white dark:bg-slate-700 text-red-600 shadow-sm' : 'text-slate-500'}`}>Gider</button>
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tarih</label>
                         <input type="date" required className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg p-2.5 text-sm dark:text-white" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Açıklama</label>
                         <input type="text" className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg p-2.5 text-sm dark:text-white" placeholder="Örn: POS Çekimi" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kategori</label>
                         <select required className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg p-2.5 text-sm dark:text-white" value={formData.categoryId} onChange={(e) => setFormData({...formData, categoryId: e.target.value})}>
                             <option value="">Seçiniz</option>
                             {categories.filter(c => c.type === formData.type).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                         </select>
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tutar (TL)</label>
                         <input type="number" step="0.01" required className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg p-2.5 text-sm dark:text-white" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
                     </div>

                     <div className="pt-2">
                         <button type="submit" disabled={loading} className="w-full bg-pnr-purple hover:bg-pnr-indigo text-white py-3 rounded-xl font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-70">
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

export default DenizbankPOS;
