
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

interface CategoryDescription {
    id: string;
    description: string;
}

interface FinanceCategory {
    id: string;
    title: string;
    type: 'income' | 'expense';
    financial_category_descriptions: CategoryDescription[];
}

interface FinanceTransaction {
    id?: string;
    source?: string;
    date: string;
    type: 'income' | 'expense';
    category_id?: string | null;
    category_name?: string | null;
    amount: number;
    description?: string | null;
    installment_info?: string | null;
    notes?: string | null;
}

interface RecordMetadata {
    subCategoryId?: string | null;
    targetMonth?: number;
    targetYear?: number;
    isPersonSplitParent?: boolean;
}

// --- CONSTANTS ---

const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Academic year starts in September (Index 8)
const ACADEMIC_START_MONTH = 8;

const normalizeText = (value: any) => String(value ?? '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR');

const normalizeKey = (value: any) => normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]/g, '');

const getDescriptionParts = (description?: string | null) => description
    ? description.split(' - ').map(part => part.trim()).filter(Boolean)
    : [];

const parsePeriodText = (period: string) => {
    const [monthText, yearText] = period.split(/\s+/);
    const monthIndex = MONTH_NAMES.findIndex(month => normalizeText(month) === normalizeText(monthText));
    const yearValue = parseInt(yearText || '', 10);

    return monthIndex !== -1 && !isNaN(yearValue) ? { month: monthIndex, year: yearValue } : null;
};

const getRecordMetadata = (transaction: Pick<FinanceTransaction, 'notes'>): RecordMetadata => {
    try {
        const metadata = JSON.parse(transaction.notes || '');
        return metadata && typeof metadata === 'object' ? metadata as RecordMetadata : {};
    } catch {
        return {};
    }
};

const getTransactionPeriod = (transaction: FinanceTransaction) => {
    const metadata = getRecordMetadata(transaction);
    if (typeof metadata.targetMonth === 'number' && typeof metadata.targetYear === 'number') {
        return { month: metadata.targetMonth, year: metadata.targetYear };
    }

    const descriptionParts = getDescriptionParts(transaction.description);
    const descriptionPeriod = parsePeriodText(descriptionParts[descriptionParts.length - 1] || '');
    if (descriptionPeriod) return descriptionPeriod;

    const date = new Date(transaction.date);
    return isNaN(date.getTime()) ? null : { month: date.getMonth(), year: date.getFullYear() };
};

const getAcademicColumnIndex = (period: { month: number; year: number } | null, selectedYear: number) => {
    if (!period) return -1;
    if (period.year === selectedYear && period.month >= ACADEMIC_START_MONTH) return period.month - ACADEMIC_START_MONTH;
    if (period.year === selectedYear + 1 && period.month < ACADEMIC_START_MONTH) return period.month + (12 - ACADEMIC_START_MONTH);
    return -1;
};

const matchesCategory = (transaction: FinanceTransaction, category: FinanceCategory) => {
    if (transaction.category_id && transaction.category_id === category.id) return true;
    return normalizeKey(transaction.category_name) === normalizeKey(category.title);
};

const getSubCategoryId = (transaction: FinanceTransaction, category: FinanceCategory) => {
    const metadata = getRecordMetadata(transaction);
    if (metadata.subCategoryId && category.financial_category_descriptions.some(desc => desc.id === metadata.subCategoryId)) {
        return metadata.subCategoryId;
    }

    const descriptionParts = getDescriptionParts(transaction.description);
    const nonPeriodParts = descriptionParts.filter(part => !parsePeriodText(part));
    const firstPart = nonPeriodParts[0] || '';
    const fullDescription = normalizeText(transaction.description);

    const exactMatch = category.financial_category_descriptions.find(desc => normalizeKey(desc.description) === normalizeKey(firstPart));
    if (exactMatch) return exactMatch.id;

    const containedMatch = category.financial_category_descriptions.find(desc => fullDescription.includes(normalizeText(desc.description)));
    return containedMatch?.id || null;
};

const getTransactionDedupeKey = (transaction: FinanceTransaction) => {
    const metadata = getRecordMetadata(transaction);
    const period = getTransactionPeriod(transaction);
    const descriptionParts = getDescriptionParts(transaction.description);
    const nonPeriodParts = descriptionParts.filter(part => !parsePeriodText(part));

    return [
        transaction.type,
        transaction.date,
        Number(transaction.amount || 0).toFixed(2),
        normalizeKey(transaction.category_id || transaction.category_name),
        normalizeKey(metadata.subCategoryId || nonPeriodParts[0]),
        period ? `${period.year}-${period.month}` : '',
        normalizeKey(transaction.description),
        normalizeKey(transaction.installment_info)
    ].join('|');
};

const dedupeTransactions = (transactions: FinanceTransaction[]) => {
    const seenSourcesByKey = new Map<string, Set<string>>();

    return transactions.filter(transaction => {
        const key = getTransactionDedupeKey(transaction);
        const source = transaction.source || 'unknown';
        const seenSources = seenSourcesByKey.get(key);

        if (seenSources && !seenSources.has(source)) return false;

        seenSourcesByKey.set(key, new Set([...(seenSources || []), source]));
        return true;
    });
};

interface ProfitabilityProps {
    canEdit?: boolean;
}

const Profitability: React.FC<ProfitabilityProps> = ({ canEdit = true }) => {
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
    const fetchData = async (shouldApplyResult: () => boolean = () => true) => {
        if (shouldApplyResult()) setLoading(true);
        try {
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
                supabase.from('cash_book').select('*'),
                supabase.from('denizbank_book').select('*'),
                supabase.from('denizbank_pos_book').select('*'),
                supabase.from('vakifbank_book').select('*')
            ]);

            if (cashRes.error) throw cashRes.error;
            if (denizRes.error) throw denizRes.error;
            if (posRes.error) throw posRes.error;
            if (vakifRes.error) throw vakifRes.error;

            // Merge all transactions into a single array
            const withSource = (source: string, rows: any[] = []) => rows.map(row => ({ ...row, source })) as FinanceTransaction[];
            const allTransactions = dedupeTransactions([
                ...withSource('cash_book', cashRes.data || []),
                ...withSource('denizbank_book', denizRes.data || []),
                ...withSource('denizbank_pos_book', posRes.data || []),
                ...withSource('vakifbank_book', vakifRes.data || [])
            ]);

            const financeCategories = (categories || []) as FinanceCategory[];

            // C. Process Data
            const processCategoryType = (type: 'income' | 'expense'): FinancialRow[] => {
                const categoriesForType = financeCategories.filter(cat => cat.type === type);
                const processedRows = categoriesForType
                    .map(cat => {

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
                        cat.financial_category_descriptions.forEach(desc => {
                            subRowsMap[desc.id] = {
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
                        subRowsMap[otherId] = {
                            id: otherId,
                            title: otherTitle,
                            type: type,
                            monthlyValues: new Array(12).fill(0),
                            total: 0
                        };

                        // 3. Aggregate Transactions (Using merged allTransactions)
                        const catTransactions = allTransactions.filter(transaction =>
                            transaction.type === type
                            && !getRecordMetadata(transaction).isPersonSplitParent
                            && matchesCategory(transaction, cat)
                        );

                        catTransactions.forEach(transaction => {
                            const colIndex = getAcademicColumnIndex(getTransactionPeriod(transaction), selectedYear);

                            if (colIndex >= 0 && colIndex < 12) {
                                // Add to Main Row
                                const amount = Number(transaction.amount) || 0;
                                row.monthlyValues[colIndex] += amount;
                                row.total += amount;

                                // Add to Sub Row
                                const targetSubId = getSubCategoryId(transaction, cat) || otherId;

                                if (subRowsMap[targetSubId]) {
                                    subRowsMap[targetSubId].monthlyValues[colIndex] += amount;
                                    subRowsMap[targetSubId].total += amount;
                                } else {
                                    // Fallback if map key missing (shouldn't happen)
                                    subRowsMap[otherId].monthlyValues[colIndex] += amount;
                                    subRowsMap[otherId].total += amount;
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

                const unmatchedRow: FinancialRow = {
                    id: `unmatched-${type}`,
                    title: 'Tanımsız',
                    type,
                    monthlyValues: new Array(12).fill(0),
                    total: 0,
                    subRows: [{
                        id: `unmatched-${type}-detail`,
                        title: 'Kategori eşleşmeyen',
                        type,
                        monthlyValues: new Array(12).fill(0),
                        total: 0
                    }]
                };

                allTransactions
                    .filter(transaction =>
                        transaction.type === type
                        && !getRecordMetadata(transaction).isPersonSplitParent
                        && !categoriesForType.some(cat => matchesCategory(transaction, cat))
                    )
                    .forEach(transaction => {
                        const colIndex = getAcademicColumnIndex(getTransactionPeriod(transaction), selectedYear);
                        if (colIndex < 0 || colIndex >= 12) return;

                        const amount = Number(transaction.amount) || 0;
                        unmatchedRow.monthlyValues[colIndex] += amount;
                        unmatchedRow.total += amount;
                        unmatchedRow.subRows![0].monthlyValues[colIndex] += amount;
                        unmatchedRow.subRows![0].total += amount;
                    });

                return unmatchedRow.total !== 0 ? [...processedRows, unmatchedRow] : processedRows;
            };

            if (!shouldApplyResult()) return;

            setIncomeData(processCategoryType('income'));
            setExpenseData(processCategoryType('expense'));

        } catch (err: any) {
            console.error(err);
            if (shouldApplyResult()) alert('Veri hatası: ' + err.message);
        } finally {
            if (shouldApplyResult()) setLoading(false);
        }
    };

    useEffect(() => {
        let isActive = true;
        const refreshData = () => fetchData(() => isActive);

        refreshData();

        const channel = supabase
            .channel(`profitability-live-${selectedYear}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_book' }, refreshData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'denizbank_book' }, refreshData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'denizbank_pos_book' }, refreshData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vakifbank_book' }, refreshData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_categories' }, refreshData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_category_descriptions' }, refreshData)
            .subscribe();

        return () => {
            isActive = false;
            supabase.removeChannel(channel);
        };
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
                        onClick={() => fetchData()}
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
