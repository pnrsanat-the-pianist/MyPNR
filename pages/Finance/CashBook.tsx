import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, Wallet, TrendingUp, 
  TrendingDown, Calendar, Search, Filter, Save, X, Layers,
  List, ChevronDown, AlertCircle, Tag, Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// --- Types ---
interface CashRecord {
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
  descriptions: CategoryDescription[]; // Added sub-items
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const CashBook: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [records, setRecords] = useState<CashRecord[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'income' as 'income' | 'expense',
    categoryId: '',
    subCategoryId: '', // New field for sub-category selection
    amount: '',
    targetMonth: new Date().getMonth(), // 0-11
    targetYear: new Date().getFullYear(),
    installments: 1
  });

  // --- Helpers ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  };

  const getYearsList = () => {
      const currentYear = new Date().getFullYear();
      return [currentYear - 1, currentYear, currentYear + 1];
  };

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();

    try {
      // 1. Fetch Categories AND their descriptions (sub-items)
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

      // Transform data to match interface
      if (catData) {
        const formattedCategories: CategoryOption[] = catData.map((c: any) => ({
            id: c.id,
            title: c.title,
            type: c.type,
            descriptions: c.financial_category_descriptions || []
        }));
        setCategories(formattedCategories);
      }

      // 2. Calculate Opening Balance (Sum of all records BEFORE this month)
      const { data: prevData, error: prevError } = await supabase.rpc('calculate_opening_balance', { 
         query_date: startOfMonth 
      }); 
      
      // Fallback: If RPC doesn't exist, calculate manually (slower but works without SQL function)
      let calculatedOpening = 0;
      if (prevError) {
          const { data: allPrevRecords } = await supabase
            .from('cash_book')
            .select('amount, type')
            .lt('date', startOfMonth);
          
          if (allPrevRecords) {
              calculatedOpening = allPrevRecords.reduce((acc, curr) => {
                  return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
              }, 0);
          }
      } else {
          calculatedOpening = prevData || 0;
      }
      setOpeningBalance(calculatedOpening);

      // 3. Fetch Current Month Records
      const { data: recordData, error } = await supabase
        .from('cash_book')
        .select('*')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
        .order('date', { ascending: true });

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
  }, [currentDate]);

  // --- Handlers ---
  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  // Reset sub-category when category changes
  const handleCategoryChange = (catId: string) => {
      setFormData(prev => ({ ...prev, categoryId: catId, subCategoryId: '' }));
  };

  const handleDateInput = (val: string) => {
      // Automatically update target Month/Year when date changes
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
          setFormData(prev => ({
              ...prev,
              date: val,
              targetMonth: d.getMonth(),
              targetYear: d.getFullYear()
          }));
      } else {
          setFormData(prev => ({ ...prev, date: val }));
      }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.categoryId) {
        alert("Lütfen tutar ve kategori seçiniz.");
        return;
    }

    setLoading(true);
    try {
        const category = categories.find(c => c.id === formData.categoryId);
        const subCategory = category?.descriptions.find(d => d.id === formData.subCategoryId);
        
        // Construct Description: "SubCategory - Month Year"
        // e.g., "Elektrik Faturası - Ocak 2025"
        const periodString = `${MONTH_NAMES[formData.targetMonth]} ${formData.targetYear}`;
        
        let finalDescription = periodString;
        if (subCategory) {
            finalDescription = `${subCategory.description} - ${periodString}`;
        } else {
            // If no subcategory, just use the period string or generic
            finalDescription = `Genel - ${periodString}`;
        }

        const totalAmount = parseFloat(formData.amount);
        const installments = Math.max(1, formData.installments);
        const monthlyAmount = totalAmount / installments;
        
        const recordsToInsert = [];
        const baseDate = new Date(formData.date);

        // Generate Installment Records
        for (let i = 0; i < installments; i++) {
            const recordDate = new Date(baseDate);
            recordDate.setMonth(baseDate.getMonth() + i); // Add months
            
            // Handle end of month edge cases (e.g. Jan 31 -> Feb 28)
            recordsToInsert.push({
                date: recordDate.toISOString().split('T')[0],
                type: formData.type,
                category_id: formData.categoryId,
                category_name: category?.title || 'Diğer',
                amount: monthlyAmount,
                description: finalDescription,
                installment_info: installments > 1 ? `${i + 1}/${installments}` : null
            });
        }

        const { error } = await supabase.from('cash_book').insert(recordsToInsert);
        if (error) throw error;

        setIsModalOpen(false);
        const today = new Date();
        setFormData({
            date: today.toISOString().split('T')[0],
            type: 'income',
            categoryId: '',
            subCategoryId: '',
            amount: '',
            targetMonth: today.getMonth(),
            targetYear: today.getFullYear(),
            installments: 1
        });
        fetchData();

    } catch (err: any) {
        alert("Kayıt hatası: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  // --- Calculations ---
  let runningBalance = openingBalance;
  
  const monthIncome = records.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
  const monthExpense = records.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
  const monthNet = monthIncome - monthExpense;

  // Selected Category Helper for Modal
  const selectedCategory = categories.find(c => c.id === formData.categoryId);

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-pnr-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <ChevronLeft size={24} className="text-slate-600 dark:text-slate-300"/>
            </button>
            <div className="text-center">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">{getMonthName(currentDate)}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kasa Defteri</p>
            </div>
            <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <ChevronRight size={24} className="text-slate-600 dark:text-slate-300"/>
            </button>
        </div>

        <div className="flex items-center gap-6">
            <div className="text-right hidden md:block">
                <div className="text-xs text-slate-500 uppercase font-bold">Devreden Bakiye</div>
                <div className={`font-mono font-bold ${openingBalance >= 0 ? 'text-slate-700 dark:text-slate-300' : 'text-red-600'}`}>
                    {formatCurrency(openingBalance)}
                </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-pnr-purple hover:bg-pnr-indigo text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-pnr-purple/20 flex items-center gap-2 transition-transform active:scale-95"
            >
                <Plus size={20} /> Yeni Kayıt
            </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-900/10 p-5 rounded-2xl border border-green-100 dark:border-green-800 flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-800/30 rounded-xl text-green-600 dark:text-green-400">
                  <TrendingUp size={24} />
              </div>
              <div>
                  <p className="text-xs font-bold text-green-600/70 dark:text-green-400/70 uppercase">Ayın Geliri</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(monthIncome)}</p>
              </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-2xl border border-red-100 dark:border-red-800 flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-800/30 rounded-xl text-red-600 dark:text-red-400">
                  <TrendingDown size={24} />
              </div>
              <div>
                  <p className="text-xs font-bold text-red-600/70 dark:text-red-400/70 uppercase">Ayın Gideri</p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{formatCurrency(monthExpense)}</p>
              </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
              <div className="p-3 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300">
                  <Wallet size={24} />
              </div>
              <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Güncel Bakiye</p>
                  <p className={`text-2xl font-bold ${(openingBalance + monthNet) >= 0 ? 'text-slate-800 dark:text-white' : 'text-red-600'}`}>
                      {formatCurrency(openingBalance + monthNet)}
                  </p>
              </div>
          </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase w-32">Tarih</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Alt Kategori</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase">Kategori</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Taksit</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right w-32">Tutar</th>
                          <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right w-32">Bakiye</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {/* Opening Balance Row */}
                      <tr className="bg-slate-50/50 dark:bg-slate-900/30 italic text-slate-500">
                          <td className="p-4 text-xs" colSpan={5}>Devreden Bakiye</td>
                          <td className="p-4 text-sm font-mono font-bold text-right">{formatCurrency(openingBalance)}</td>
                      </tr>

                      {records.length === 0 ? (
                          <tr><td colSpan={6} className="p-8 text-center text-slate-400">Bu ay kayıt bulunamadı.</td></tr>
                      ) : (
                          records.map((record) => {
                              const isIncome = record.type === 'income';
                              if (isIncome) runningBalance += record.amount;
                              else runningBalance -= record.amount;

                              // Extract Sub Category from combined description string (Format: "SubCategory - Detail" or just "SubCategory")
                              const subCategoryDisplay = record.description ? record.description.split(' - ')[0] : '-';

                              return (
                                  <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                      <td className="p-4 text-sm text-slate-600 dark:text-slate-300 font-mono">
                                          {formatDate(record.date)}
                                      </td>
                                      <td className="p-4 text-sm font-medium text-slate-900 dark:text-white">
                                          {subCategoryDisplay}
                                      </td>
                                      <td className="p-4">
                                          <span className={`text-xs px-2 py-1 rounded border ${
                                              isIncome 
                                              ? 'bg-green-50 text-green-700 border-green-200' 
                                              : 'bg-red-50 text-red-700 border-red-200'
                                          }`}>
                                              {record.category_name}
                                          </span>
                                      </td>
                                      <td className="p-4 text-center text-xs text-slate-500">
                                          {record.installment_info ? (
                                              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono">
                                                  {record.installment_info}
                                              </span>
                                          ) : '-'}
                                      </td>
                                      <td className={`p-4 text-right font-bold text-sm ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                                          {isIncome ? '+' : '-'}{formatCurrency(record.amount)}
                                      </td>
                                      <td className="p-4 text-right font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                                          {formatCurrency(runningBalance)}
                                      </td>
                                  </tr>
                              );
                          })
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* NEW RECORD MODAL */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
             <div className="bg-white dark:bg-pnr-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                 <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                        <Wallet size={20} className="text-pnr-purple"/> Yeni Kasa Kaydı
                    </h3>
                    <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-900"/></button>
                 </div>
                 
                 <form onSubmit={handleSave} className="p-6 space-y-4">
                     {/* Type Selector */}
                     <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                         <button
                            type="button"
                            onClick={() => setFormData({...formData, type: 'income', categoryId: '', subCategoryId: ''})}
                            className={`py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${formData.type === 'income' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500'}`}
                         >
                             <TrendingUp size={16}/> Gelir
                         </button>
                         <button
                            type="button"
                            onClick={() => setFormData({...formData, type: 'expense', categoryId: '', subCategoryId: ''})}
                            className={`py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${formData.type === 'expense' ? 'bg-white dark:bg-slate-700 text-red-600 shadow-sm' : 'text-slate-500'}`}
                         >
                             <TrendingDown size={16}/> Gider
                         </button>
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tarih</label>
                         <input 
                            type="date" 
                            required
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white"
                            value={formData.date}
                            onChange={(e) => handleDateInput(e.target.value)}
                         />
                     </div>

                     {/* Month & Year Selection */}
                     <div className="grid grid-cols-2 gap-3">
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                <Clock size={12} /> Ait Olduğu Ay
                             </label>
                             <select 
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white"
                                value={formData.targetMonth}
                                onChange={(e) => setFormData({...formData, targetMonth: parseInt(e.target.value)})}
                             >
                                 {MONTH_NAMES.map((m, i) => (
                                     <option key={i} value={i}>{m}</option>
                                 ))}
                             </select>
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Yıl</label>
                             <select 
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white"
                                value={formData.targetYear}
                                onChange={(e) => setFormData({...formData, targetYear: parseInt(e.target.value)})}
                             >
                                 {getYearsList().map(y => (
                                     <option key={y} value={y}>{y}</option>
                                 ))}
                             </select>
                         </div>
                     </div>

                     <div>
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            {formData.type === 'income' ? 'Gelir Kategorisi' : 'Gider Kategorisi'}
                         </label>
                         <select 
                            required
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white"
                            value={formData.categoryId}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                         >
                             <option value="">Seçiniz</option>
                             {categories.filter(c => c.type === formData.type).map(c => (
                                 <option key={c.id} value={c.id}>{c.title}</option>
                             ))}
                         </select>
                     </div>

                     {/* Sub Category Selection (Visible if category selected & has descriptions) */}
                     {selectedCategory && selectedCategory.descriptions.length > 0 && (
                         <div className="animate-in slide-in-from-top-1">
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                 <Tag size={12}/> Alt Kategori
                             </label>
                             <select 
                                required
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                                value={formData.subCategoryId}
                                onChange={(e) => setFormData({...formData, subCategoryId: e.target.value})}
                             >
                                 <option value="">Alt Kategori Seçiniz...</option>
                                 {selectedCategory.descriptions.map(desc => (
                                     <option key={desc.id} value={desc.id}>{desc.description}</option>
                                 ))}
                             </select>
                         </div>
                     )}

                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Taksit Sayısı</label>
                             <div className="relative">
                                 <input 
                                    type="number"
                                    min="1"
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                                    value={formData.installments || ''}
                                    onChange={(e) => setFormData({...formData, installments: parseInt(e.target.value) || 0})}
                                    placeholder="1"
                                 />
                                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                                     {(!formData.installments || formData.installments <= 1) ? 'Tek Çekim' : 'Adet'}
                                 </span>
                             </div>
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tutar (TL)</label>
                             <input 
                                type="number" 
                                required
                                min="0" step="0.01"
                                placeholder="0.00"
                                className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm font-bold outline-none focus:ring-2 ${formData.type === 'income' ? 'text-green-600 focus:ring-green-500' : 'text-red-600 focus:ring-red-500'}`}
                                value={formData.amount}
                                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                             />
                         </div>
                     </div>
                     
                     {formData.installments > 1 && formData.amount && (
                         <p className="text-xs text-slate-400 text-right font-mono">
                             Aylık Ödeme: {formatCurrency(parseFloat(formData.amount) / formData.installments)}
                         </p>
                     )}

                     <div className="pt-2">
                         <button 
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-70 ${formData.type === 'income' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}
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

export default CashBook;