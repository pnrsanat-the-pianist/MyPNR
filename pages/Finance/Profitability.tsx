
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, ChevronDown, ChevronRight, TrendingUp, 
  TrendingDown, DollarSign, Filter, RefreshCcw, Printer,
  PieChart, BarChart3, ArrowUpRight, ArrowDownRight, Percent
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// --- TYPES ---

interface MonthInfo {
  name: string;
  year: number;
  monthIndex: number;
  key: string;
}

interface FinancialRow {
  id: string;
  title: string;
  isHeader?: boolean;
  type: 'income' | 'expense';
  monthlyValues: number[]; // Array of 12 months
  total: number;
  subRows?: FinancialRow[];
  isExpanded?: boolean;
}

// --- CONSTANTS ---

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Academic year starts in September (Index 8)
const ACADEMIC_START_MONTH = 8; 

const Profitability: React.FC = () => {
  // Default to 2025 as requested (Sep 2025 - Aug 2026)
  const [selectedYear, setSelectedYear] = useState(2025);
  const [loading, setLoading] = useState(true);
  const [incomeData, setIncomeData] = useState<FinancialRow[]>([]);
  const [expenseData, setExpenseData] = useState<FinancialRow[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // --- 1. GENERATE DATE COLUMNS ---
  const months = useMemo(() => {
    const list: MonthInfo[] = [];
    for (let i = 0; i < 12; i++) {
      // Logic: Sep (8) to Dec (11) are in selectedYear. Jan (0) to Aug (7) are in selectedYear + 1.
      const monthIndex = (ACADEMIC_START_MONTH + i) % 12;
      const year = monthIndex >= ACADEMIC_START_MONTH ? selectedYear : selectedYear + 1;
      
      list.push({
        name: MONTH_NAMES[monthIndex],
        year: year,
        monthIndex: monthIndex,
        key: `${year}-${monthIndex}`
      });
    }
    return list;
  }, [selectedYear]);

  // --- 2. FETCH AND PROCESS DATA ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = new Date(selectedYear, ACADEMIC_START_MONTH, 1).toISOString();
      const endDate = new Date(selectedYear + 1, ACADEMIC_START_MONTH, 0).toISOString(); // End of Aug next year

      // A. Fetch Structure (Categories & Descriptions)
      const { data: categories, error: catError } = await supabase
        .from('financial_categories')
        .select(`
          id, title, type,
          financial_category_descriptions (id, description)
        `)
        .order('title');
      
      if (catError) throw catError;

      // B. Fetch Transactions from ALL Sources
      const [cashRes, denizRes, posRes, vakifRes] = await Promise.all([
        supabase.from('cash_book').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('denizbank_book').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('denizbank_pos_book').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('vakifbank_book').select('*').gte('date', startDate).lte('date', endDate)
      ]);

      if (cashRes.error) throw cashRes.error;
      if (denizRes.error) throw denizRes.error;
      if (posRes.error) throw posRes.error;
      if (vakifRes.error) throw vakifRes.error;

      // Merge all transactions into a single array
      const allTransactions = [
        ...(cashRes.data || []),
        ...(denizRes.data || []),
        ...(posRes.data || []),
        ...(vakifRes.data || [])
      ];

      // C. Process Data
      const processCategoryType = (type: 'income' | 'expense'): FinancialRow[] => {
        return (categories || [])
          .filter((cat: any) => cat.type === type)
          .map((cat: any) => {
            
            // 1. Initialize Main Row
            const row: FinancialRow = {
              id: cat.id,
              title: cat.title,
              type: type,
              monthlyValues: new Array(12).fill(0),
              total: 0,
              subRows: []
            };

            // 2. Prepare Sub Rows based on DB descriptions (Definitions)
            const subRowsMap: Record<string, FinancialRow> = {};
            
            // Add defined sub-items from 'financial_category_descriptions'
            cat.financial_category_descriptions.forEach((desc: any) => {
                subRowsMap[desc.description] = {
                    id: desc.id,
                    title: desc.description,
                    type: type,
                    monthlyValues: new Array(12).fill(0),
                    total: 0
                };
            });

            // Add a dynamic "Diğer" (Other) bucket for unclassified transactions in this category
            const otherId = `other-${cat.id}`;
            const otherTitle = 'Diğer / Belirtilmemiş';
            subRowsMap[otherTitle] = {
                id: otherId,
                title: otherTitle,
                type: type,
                monthlyValues: new Array(12).fill(0),
                total: 0
            };

            // 3. Aggregate Transactions (Using merged allTransactions)
            const catTransactions = (allTransactions || []).filter((t: any) => t.category_id === cat.id);

            catTransactions.forEach((t: any) => {
                const tDate = new Date(t.date);
                const tYear = tDate.getFullYear();
                const tMonth = tDate.getMonth();
                
                // Find column index
                let colIndex = -1;
                if (tYear === selectedYear && tMonth >= ACADEMIC_START_MONTH) {
                    colIndex = tMonth - ACADEMIC_START_MONTH;
                } else if (tYear === selectedYear + 1 && tMonth < ACADEMIC_START_MONTH) {
                    colIndex = tMonth + (12 - ACADEMIC_START_MONTH);
                }

                if (colIndex >= 0 && colIndex < 12) {
                    // Add to Main Row
                    row.monthlyValues[colIndex] += t.amount;
                    row.total += t.amount;

                    // Add to Sub Row
                    let targetSubTitle = otherTitle;
                    
                    // Fuzzy match: Check if transaction description contains any defined sub-item description
                    for (const desc of cat.financial_category_descriptions) {
                        if (t.description && t.description.toLowerCase().includes(desc.description.toLowerCase())) {
                            targetSubTitle = desc.description;
                            break;
                        }
                    }

                    if (subRowsMap[targetSubTitle]) {
                        subRowsMap[targetSubTitle].monthlyValues[colIndex] += t.amount;
                        subRowsMap[targetSubTitle].total += t.amount;
                    } else {
                        // Fallback if map key missing (shouldn't happen)
                        subRowsMap[otherTitle].monthlyValues[colIndex] += t.amount;
                        subRowsMap[otherTitle].total += t.amount;
                    }
                }
            });

            // 4. Flatten & Sort Sub Rows
            // Filter out 'Diğer' if it's empty, but keep defined sub-items even if empty (to show structure)
            row.subRows = Object.values(subRowsMap)
                .filter(sr => {
                    if (sr.title === otherTitle && sr.total === 0) return false;
                    return true;
                })
                .sort((a, b) => {
                    // Always put 'Diğer' at the bottom
                    if (a.title === otherTitle) return 1;
                    if (b.title === otherTitle) return -1;
                    // Sort others alphabetically
                    return a.title.localeCompare(b.title);
                });

            return row;
          });
      };

      setIncomeData(processCategoryType('income'));
      setExpenseData(processCategoryType('expense'));

    } catch (err: any) {
      console.error(err);
      alert('Veri hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  // --- ACTIONS ---

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRows(newSet);
  };

  const formatMoney = (val: number) => {
    if (val === 0) return '-';
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  // --- CALCULATE TOTALS ---

  const calculateGrandTotals = (data: FinancialRow[]) => {
    const monthly = new Array(12).fill(0);
    let total = 0;
    data.forEach(row => {
      row.monthlyValues.forEach((val, idx) => monthly[idx] += val);
      total += row.total;
    });
    return { monthly, total };
  };

  const incomeTotals = calculateGrandTotals(incomeData);
  const expenseTotals = calculateGrandTotals(expenseData);
  
  const profitMonthly = incomeTotals.monthly.map((inc, i) => inc - expenseTotals.monthly[i]);
  const profitTotal = incomeTotals.total - expenseTotals.total;
  const margin = incomeTotals.total > 0 ? (profitTotal / incomeTotals.total) * 100 : 0;

  return (
    <div className="p-4 md:p-6 max-w-[1800px] mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Karlılık Tablosu</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">
            Akademik yıl bazında aylık gelir, gider ve net kar analizi (Tüm hesaplar dahil).
          </p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2">
                <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-2 text-slate-500 hover:text-pnr-purple">
                    <ChevronDown className="rotate-90" size={20} />
                </button>
                <div className="px-4 font-bold font-mono text-slate-700 dark:text-slate-200">
                    Eylül {selectedYear} - Ağustos {selectedYear + 1}
                </div>
                <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-2 text-slate-500 hover:text-pnr-purple">
                    <ChevronRight className="rotate-90" size={20} />
                </button>
            </div>

            <button 
                onClick={fetchData} 
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 transition-colors"
            >
                <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
                onClick={() => window.print()} 
                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-2.5 rounded-xl hover:opacity-90 transition-colors"
                title="Yazdır"
            >
                <Printer size={20} />
            </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-50 dark:bg-green-900/10 p-5 rounded-2xl border border-green-100 dark:border-green-800 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded-lg text-green-600 dark:text-green-400"><TrendingUp size={20} /></div>
                  <span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wider">Toplam Gelir</span>
              </div>
              <div className="text-2xl font-bold text-green-800 dark:text-green-200">{formatMoney(incomeTotals.total)} ₺</div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-2xl border border-red-100 dark:border-red-800 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-red-100 dark:bg-red-800/30 rounded-lg text-red-600 dark:text-red-400"><TrendingDown size={20} /></div>
                  <span className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">Toplam Gider</span>
              </div>
              <div className="text-2xl font-bold text-red-800 dark:text-red-200">{formatMoney(expenseTotals.total)} ₺</div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-800 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded-lg text-blue-600 dark:text-blue-400"><DollarSign size={20} /></div>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Net Kar</span>
              </div>
              <div className={`text-2xl font-bold ${profitTotal >= 0 ? 'text-blue-800 dark:text-blue-200' : 'text-red-600'}`}>
                  {formatMoney(profitTotal)} ₺
              </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-2xl border border-purple-100 dark:border-purple-800 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 dark:bg-purple-800/30 rounded-lg text-purple-600 dark:text-purple-400"><Percent size={20} /></div>
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Karlılık Oranı</span>
              </div>
              <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">%{margin.toFixed(1)}</div>
          </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[1200px]">
                <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs uppercase font-bold sticky top-0 z-10">
                        <th className="p-4 text-left w-64 bg-slate-100 dark:bg-slate-900 sticky left-0 z-20 border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Kategori / Kalem</th>
                        {months.map(m => (
                            <th key={m.key} className="p-3 min-w-[90px] border-r border-slate-200 dark:border-slate-800">
                                <div>{m.name}</div>
                                <div className="text-[9px] opacity-60">{m.year}</div>
                            </th>
                        ))}
                        <th className="p-3 min-w-[100px] bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white">TOPLAM</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    
                    {/* --- INCOME HEADER --- */}
                    <tr className="bg-green-100/50 dark:bg-green-900/20 border-y border-green-200 dark:border-green-800">
                        <td colSpan={14} className="p-4 text-left font-bold text-green-800 dark:text-green-300 flex items-center gap-2 sticky left-0 bg-green-100/50 dark:bg-green-900/20">
                            <TrendingUp size={20} /> GELİR TABLOSU
                        </td>
                    </tr>
                    
                    {incomeData.map(row => (
                        <React.Fragment key={row.id}>
                            <tr 
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-800 cursor-pointer"
                                onClick={() => toggleRow(row.id)}
                            >
                                <td className="p-3 text-left font-bold text-slate-800 dark:text-white border-r border-slate-200 dark:border-slate-700 sticky left-0 bg-white dark:bg-pnr-card z-10 flex items-center gap-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    <div className={`transition-transform duration-200 ${expandedRows.has(row.id) ? 'rotate-90' : ''}`}>
                                        <ChevronRight size={16} className="text-slate-400" />
                                    </div>
                                    {row.title}
                                </td>
                                {row.monthlyValues.map((val, idx) => (
                                    <td key={idx} className={`p-3 border-r border-slate-100 dark:border-slate-800 ${val > 0 ? 'text-green-600 font-medium' : 'text-slate-300'}`}>
                                        {formatMoney(val)}
                                    </td>
                                ))}
                                <td className="p-3 font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/50">
                                    {formatMoney(row.total)}
                                </td>
                            </tr>

                            {expandedRows.has(row.id) && row.subRows?.map(sub => (
                                <tr key={sub.id} className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-800 text-xs animate-in slide-in-from-top-1">
                                    <td className="p-2 pl-10 text-left text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] flex items-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mr-2"></div>
                                        {sub.title}
                                    </td>
                                    {sub.monthlyValues.map((val, idx) => (
                                        <td key={idx} className={`p-2 border-r border-slate-100 dark:border-slate-800 ${val > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-200 dark:text-slate-700'}`}>
                                            {formatMoney(val)}
                                        </td>
                                    ))}
                                    <td className="p-2 font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800">
                                        {formatMoney(sub.total)}
                                    </td>
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}

                    <tr className="bg-green-100 dark:bg-green-900/40 font-bold text-green-900 dark:text-green-200 border-y-2 border-green-200 dark:border-green-800">
                        <td className="p-3 text-left sticky left-0 bg-green-100 dark:bg-green-900 z-10 border-r border-green-200 dark:border-green-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">TOPLAM GELİR</td>
                        {incomeTotals.monthly.map((val, i) => (
                            <td key={i} className="p-3 border-r border-green-200 dark:border-green-800">{formatMoney(val)}</td>
                        ))}
                        <td className="p-3 bg-green-200 dark:bg-green-900 text-lg">{formatMoney(incomeTotals.total)}</td>
                    </tr>

                    <tr><td colSpan={14} className="h-8 bg-slate-50/30 dark:bg-slate-900/30"></td></tr>

                    {/* --- EXPENSE HEADER --- */}
                    <tr className="bg-red-100/50 dark:bg-red-900/20 border-y border-red-200 dark:border-red-800">
                        <td colSpan={14} className="p-4 text-left font-bold text-red-800 dark:text-red-300 flex items-center gap-2 sticky left-0 bg-red-100/50 dark:bg-red-900/20">
                            <TrendingDown size={20} /> GİDER TABLOSU
                        </td>
                    </tr>

                    {expenseData.map(row => (
                        <React.Fragment key={row.id}>
                            <tr 
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-800 cursor-pointer"
                                onClick={() => toggleRow(row.id)}
                            >
                                <td className="p-3 text-left font-bold text-slate-800 dark:text-white border-r border-slate-200 dark:border-slate-700 sticky left-0 bg-white dark:bg-pnr-card z-10 flex items-center gap-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    <div className={`transition-transform duration-200 ${expandedRows.has(row.id) ? 'rotate-90' : ''}`}>
                                        <ChevronRight size={16} className="text-slate-400" />
                                    </div>
                                    {row.title}
                                </td>
                                {row.monthlyValues.map((val, idx) => (
                                    <td key={idx} className={`p-3 border-r border-slate-100 dark:border-slate-800 ${val > 0 ? 'text-red-500 font-medium' : 'text-slate-300'}`}>
                                        {formatMoney(val)}
                                    </td>
                                ))}
                                <td className="p-3 font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/50">
                                    {formatMoney(row.total)}
                                </td>
                            </tr>
                            
                            {expandedRows.has(row.id) && row.subRows?.map(sub => (
                                <tr key={sub.id} className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-800 text-xs animate-in slide-in-from-top-1">
                                    <td className="p-2 pl-10 text-left text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 sticky left-0 bg-slate-50 dark:bg-slate-900 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] flex items-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mr-2"></div>
                                        {sub.title}
                                    </td>
                                    {sub.monthlyValues.map((val, idx) => (
                                        <td key={idx} className={`p-2 border-r border-slate-100 dark:border-slate-800 ${val > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-200 dark:text-slate-700'}`}>
                                            {formatMoney(val)}
                                        </td>
                                    ))}
                                    <td className="p-2 font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800">
                                        {formatMoney(sub.total)}
                                    </td>
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}

                    <tr className="bg-red-100 dark:bg-red-900/40 font-bold text-red-900 dark:text-red-200 border-y-2 border-red-200 dark:border-red-800">
                        <td className="p-3 text-left sticky left-0 bg-red-100 dark:bg-red-900 z-10 border-r border-red-200 dark:border-red-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">TOPLAM GİDER</td>
                        {expenseTotals.monthly.map((val, i) => (
                            <td key={i} className="p-3 border-r border-red-200 dark:border-red-800">{formatMoney(val)}</td>
                        ))}
                        <td className="p-3 bg-red-200 dark:bg-red-900 text-lg">{formatMoney(expenseTotals.total)}</td>
                    </tr>

                </tbody>
                
                {/* --- NET PROFIT FOOTER --- */}
                <tfoot className="sticky bottom-0 z-30">
                    <tr className="bg-slate-900 text-white shadow-[0_-4px_15px_rgba(0,0,0,0.3)] border-t-4 border-slate-700">
                        <td className="p-4 text-left font-bold text-base sticky left-0 bg-slate-900 z-30 shadow-[2px_0_5px_-2px_rgba(255,255,255,0.1)] flex items-center gap-2">
                            {profitTotal >= 0 ? <ArrowUpRight className="text-green-400" /> : <ArrowDownRight className="text-red-400" />}
                            AYLIK KAR / ZARAR
                        </td>
                        {profitMonthly.map((val, i) => (
                            <td key={i} className={`p-4 font-bold font-mono text-sm border-r border-slate-700 ${val >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatMoney(val)}
                            </td>
                        ))}
                        <td className={`p-4 font-bold text-xl font-mono bg-slate-950 ${profitTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatMoney(profitTotal)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
      </div>

    </div>
  );
};

export default Profitability;
