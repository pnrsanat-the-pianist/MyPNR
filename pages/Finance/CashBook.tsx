import React, { useState, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, Plus, Wallet, TrendingUp,
    TrendingDown, Calendar, Search, Filter, Save, X, Layers,
    List, ChevronDown, AlertCircle, Tag, Clock, Trash2, Pencil
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// --- Types ---
interface CashRecord {
    id: string;
    date: string;
    type: 'income' | 'expense';
    category_id: string; // Added missing field
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

interface CashBookProps {
    canEdit?: boolean;
}

const CashBook: React.FC<CashBookProps> = ({ canEdit = true }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [records, setRecords] = useState<CashRecord[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [openingBalance, setOpeningBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [highlightedInstallment, setHighlightedInstallment] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

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
    const [editingId, setEditingId] = useState<string | null>(null);

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
        // Fetch the entire year
        const startOfYear = new Date(currentDate.getFullYear(), 0, 1).toISOString();
        const endOfYear = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59).toISOString();

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

            // 2. Calculate Opening Balance (Sum of all records BEFORE this year)
            let calculatedOpening = 0;
            const { data: allPrevRecords } = await supabase
                .from('cash_book')
                .select('amount, type')
                .lt('date', startOfYear);

            if (allPrevRecords) {
                calculatedOpening = allPrevRecords.reduce((acc, curr) => {
                    return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
                }, 0);
            }
            setOpeningBalance(calculatedOpening);

            // 3. Fetch Current Year Records
            const { data: recordData, error } = await supabase
                .from('cash_book')
                .select('*')
                .gte('date', startOfYear)
                .lte('date', endOfYear)
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
    }, [currentDate.getFullYear()]); // Only re-fetch when year changes

    // --- Handlers ---
    const handlePrevYear = () => {
        const newDate = new Date(currentDate);
        newDate.setFullYear(newDate.getFullYear() - 1);
        setCurrentDate(newDate);
    };

    const handleNextYear = () => {
        const newDate = new Date(currentDate);
        newDate.setFullYear(newDate.getFullYear() + 1);
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

    const handleEdit = (record: CashRecord) => {
        if (!canEdit) return;

        // Find the matching category to populate sub-category options if needed
        const category = categories.find(c => c.title === record.category_name);

        // Parse description: "SubCategory - Month Year"
        let subCatId = '';
        const descParts = record.description.split(' - ');
        if (descParts.length > 1 && category) {
            const subCatDesc = descParts[0];
            const foundSub = category.descriptions.find(d => d.description === subCatDesc);
            if (foundSub) subCatId = foundSub.id;
        }

        setFormData({
            date: record.date,
            type: record.type,
            categoryId: record.category_id || (category?.id || ''),
            subCategoryId: subCatId,
            amount: record.amount.toString(),
            targetMonth: new Date(record.date).getMonth(),
            targetYear: new Date(record.date).getFullYear(),
            installments: 1 // Installment splitting is only for new records
        });
        setEditingId(record.id);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit) return;
        if (!formData.amount || !formData.categoryId) {
            alert("Lütfen tutar ve kategori seçiniz.");
            return;
        }

        setLoading(true);
        try {
            const category = categories.find(c => c.id === formData.categoryId);
            const subCategory = category?.descriptions.find(d => d.id === formData.subCategoryId);

            const totalAmount = parseFloat(formData.amount);
            const installments = Math.max(1, formData.installments);
            const monthlyAmount = totalAmount / installments;

            if (editingId) {
                // UPDATE
                const { error } = await supabase
                    .from('cash_book')
                    .update({
                        date: formData.date,
                        type: formData.type,
                        category_id: formData.categoryId,
                        category_name: category?.title || 'Diğer',
                        amount: totalAmount,
                        description: formData.subCategoryId
                            ? `${subCategory?.description} - ${MONTH_NAMES[formData.targetMonth]} ${formData.targetYear}`
                            : `Genel - ${MONTH_NAMES[formData.targetMonth]} ${formData.targetYear}`
                    })
                    .eq('id', editingId);

                if (error) throw error;
            } else {
                // INSERT
                const recordsToInsert = [];
                const transactionDate = formData.date; // Fixed payment date for all installments

                // Generate Installment Records
                for (let i = 0; i < installments; i++) {
                    // Calculate Target Period for the description (Month/Year)
                    // Force numeric conversion to be extra safe
                    const startM = Number(formData.targetMonth);
                    const startY = Number(formData.targetYear);

                    let targetM = (startM + i) % 12;
                    let yearOffset = Math.floor((startM + i) / 12);
                    let targetY = startY + yearOffset;

                    const currentPeriodString = `${MONTH_NAMES[targetM]} ${targetY}`;
                    let currentFinalDescription = currentPeriodString;

                    if (subCategory) {
                        currentFinalDescription = `${subCategory.description} - ${currentPeriodString}`;
                    } else {
                        currentFinalDescription = `Genel - ${currentPeriodString}`;
                    }

                    recordsToInsert.push({
                        date: transactionDate,
                        type: formData.type,
                        category_id: formData.categoryId,
                        category_name: category?.title || 'Diğer',
                        amount: monthlyAmount,
                        description: currentFinalDescription,
                        installment_info: installments > 1 ? `${i + 1}/${installments}` : null
                    });
                }

                const { error } = await supabase.from('cash_book').insert(recordsToInsert);
                if (error) throw error;
            }

            setIsModalOpen(false);
            setEditingId(null);
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

    const handleDelete = async (id: string) => {
        if (!canEdit) return;
        if (!window.confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;

        setLoading(true);
        try {
            const { error } = await supabase.from('cash_book').delete().eq('id', id);
            if (error) throw error;
            fetchData();
            // Remove from selection if deleted
            const newSelected = new Set(selectedIds);
            newSelected.delete(id);
            setSelectedIds(newSelected);
        } catch (err: any) {
            alert("Silme hatası: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredBySearch.length && filteredBySearch.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredBySearch.map(r => r.id)));
        }
    };

    const toggleSelectRecord = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBulkDelete = async () => {
        if (!canEdit || selectedIds.size === 0) return;
        if (!window.confirm(`${selectedIds.size} adet kaydı silmek istediğinize emin misiniz?`)) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('cash_book')
                .delete()
                .in('id', Array.from(selectedIds));

            if (error) throw error;

            setSelectedIds(new Set());
            fetchData();
        } catch (err: any) {
            alert("Toplu silme hatası: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Calculations ---
    const filteredBySearch = records.filter(r =>
        r.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.amount.toString().includes(searchTerm) ||
        r.date.includes(searchTerm)
    );

    let runningBalance = openingBalance;

    const summaryIncome = filteredBySearch.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
    const summaryExpense = filteredBySearch.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
    const summaryNet = summaryIncome - summaryExpense;

    // Selected Category Helper for Modal
    const selectedCategory = categories.find(c => c.id === formData.categoryId);

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-pnr-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={handlePrevYear} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ChevronLeft size={24} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">{currentDate.getFullYear()} Yılı</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kasa Defteri</p>
                    </div>
                    <button onClick={handleNextYear} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ChevronRight size={24} className="text-slate-600 dark:text-slate-300" />
                    </button>

                    {/* Filter Box */}
                    <div className="relative ml-4 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-pnr-purple transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Kayıtlarda ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm w-full md:w-64 focus:ring-2 focus:ring-pnr-purple outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                        <div className="text-xs text-slate-500 uppercase font-bold">Devreden Bakiye</div>
                        <div className={`font-mono font-bold ${openingBalance >= 0 ? 'text-slate-700 dark:text-slate-300' : 'text-red-600'}`}>
                            {formatCurrency(openingBalance)}
                        </div>
                    </div>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
                    {canEdit && (
                        <div className="flex items-center gap-3">
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={handleBulkDelete}
                                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-red-500/20 flex items-center gap-2 transition-transform active:scale-95 animate-in slide-in-from-right-2"
                                >
                                    <Trash2 size={18} /> {selectedIds.size} Kaydı Sil
                                </button>
                            )}
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-pnr-purple hover:bg-pnr-indigo text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-pnr-purple/20 flex items-center gap-2 transition-transform active:scale-95"
                            >
                                <Plus size={20} /> Yeni Kayıt
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-900/10 p-5 rounded-2xl border border-green-100 dark:border-green-800 flex items-center gap-4">
                    <div className="p-3 bg-green-100 dark:bg-green-800/30 rounded-xl text-green-600 dark:text-green-400">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-green-600/70 dark:text-green-400/70 uppercase">Toplam Gelir</p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(summaryIncome)}</p>
                    </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-2xl border border-red-100 dark:border-red-800 flex items-center gap-4">
                    <div className="p-3 bg-red-100 dark:bg-red-800/30 rounded-xl text-red-600 dark:text-red-400">
                        <TrendingDown size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-red-600/70 dark:text-red-400/70 uppercase">Toplam Gider</p>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-400 text-right">{formatCurrency(summaryExpense)}</p>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="p-3 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300">
                        <Wallet size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Güncel Bakiye</p>
                        <p className={`text-2xl font-bold ${(openingBalance + summaryNet) >= 0 ? 'text-slate-800 dark:text-white' : 'text-red-600'}`}>
                            {formatCurrency(openingBalance + summaryNet)}
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
                                <th className="p-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-pnr-purple focus:ring-pnr-purple"
                                        checked={selectedIds.size === filteredBySearch.length && filteredBySearch.length > 0}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase w-32">Tarih</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Alt Kategori</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Kategori</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Dönem</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center w-24">Taksit</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right w-32">Tutar</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right w-32">Bakiye</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center w-20">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {/* Opening Balance Row */}
                            <tr className="bg-slate-50/50 dark:bg-slate-900/30 italic text-slate-500">
                                <td className="p-4"></td>
                                <td className="p-4 text-xs" colSpan={6}>Devreden Bakiye</td>
                                <td className="p-4 text-sm font-mono font-bold text-right">{formatCurrency(openingBalance)}</td>
                                <td className="p-4"></td>
                            </tr>

                            {filteredBySearch.length === 0 ? (
                                <tr><td colSpan={9} className="p-8 text-center text-slate-400">Aranan kriterlere uygun kayıt bulunamadı.</td></tr>
                            ) : (
                                filteredBySearch.map((record, index) => {
                                    const isIncome = record.type === 'income';
                                    if (isIncome) runningBalance += record.amount;
                                    else runningBalance -= record.amount;

                                    const currentDateObj = new Date(record.date);
                                    const currentMonth = currentDateObj.getMonth();
                                    const nextRecord = filteredBySearch[index + 1];
                                    const nextMonth = nextRecord ? new Date(nextRecord.date).getMonth() : -1;

                                    // Month end logic: Only show if next record is a different month, or it's the very last record
                                    // AND only show if we are NOT searching (search breaks the chronological flow)
                                    const isMonthEnd = !searchTerm && (nextMonth === -1 || nextMonth !== currentMonth);

                                    // Extract Sub Category and Title for matching
                                    const subCategoryDisplay = record.description ? record.description.split(' - ')[0] : '-';

                                    // Logic for highlighting related installments:
                                    const coreDesc = record.description ? record.description.split(' - ').slice(0, -1).join(' - ') : '';
                                    const installmentId = record.installment_info ? `${record.category_id}-${coreDesc}-${record.installment_info.split('/')[1]}` : null;
                                    const isHighlighted = highlightedInstallment && installmentId === highlightedInstallment;

                                    return (
                                        <React.Fragment key={record.id}>
                                            <tr
                                                className={`transition-colors ${selectedIds.has(record.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''} ${isHighlighted
                                                    ? 'bg-pnr-purple/10 dark:bg-pnr-purple/20 border-l-4 border-l-pnr-purple'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                                            >
                                                <td className="p-4">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 text-pnr-purple focus:ring-pnr-purple"
                                                        checked={selectedIds.has(record.id)}
                                                        onChange={() => toggleSelectRecord(record.id)}
                                                    />
                                                </td>
                                                <td className="p-4 text-sm text-slate-600 dark:text-slate-300 font-mono">
                                                    {formatDate(record.date)}
                                                </td>
                                                <td className="p-4 text-sm font-medium text-slate-900 dark:text-white">
                                                    {subCategoryDisplay}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`text-xs px-2 py-1 rounded border ${isIncome
                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                        : 'bg-red-50 text-red-700 border-red-200'
                                                        }`}>
                                                        {record.category_name}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                                                    {record.description ? record.description.split(' - ').slice(-1)[0] : '-'}
                                                </td>
                                                <td className="p-4 text-center text-xs text-slate-500">
                                                    {record.installment_info ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setHighlightedInstallment(isHighlighted ? null : installmentId);
                                                            }}
                                                            className={`px-2 py-1 rounded font-mono transition-all hover:scale-110 active:scale-95 ${isHighlighted ? 'bg-pnr-purple text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800'}`}
                                                            title="Aynı taksit grubunu vurgula"
                                                        >
                                                            {record.installment_info}
                                                        </button>
                                                    ) : '-'}
                                                </td>
                                                <td className={`p-4 text-right font-bold text-sm ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isIncome ? '+' : '-'}{formatCurrency(record.amount)}
                                                </td>
                                                <td className="p-4 text-right font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    {formatCurrency(runningBalance)}
                                                </td>
                                                <td className="p-4 text-center">
                                                    {canEdit && (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => handleEdit(record)}
                                                                className="p-2 text-slate-400 hover:text-pnr-purple dark:hover:text-pnr-purple hover:bg-pnr-purple/10 rounded-lg transition-all"
                                                                title="Kaydı Düzenle"
                                                            >
                                                                <Pencil size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(record.id)}
                                                                className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                                                                title="Kaydı Sil"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                            {isMonthEnd && (
                                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-800 font-bold">
                                                    <td className="p-3"></td>
                                                    <td className="p-3 text-xs text-pnr-purple uppercase tracking-wider" colSpan={6}>
                                                        {MONTH_NAMES[currentMonth]} Ayı Sonu Bakiyesi
                                                    </td>
                                                    <td className="p-3 text-sm font-mono text-right text-pnr-purple">
                                                        {formatCurrency(runningBalance)}
                                                    </td>
                                                    <td className="p-3 border-l dark:border-slate-700"></td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* NEW RECORD MODAL */}
            {isModalOpen && canEdit && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-pnr-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                <Wallet size={20} className="text-pnr-purple" /> {editingId ? 'Kasa Kaydını Düzenle' : 'Yeni Kasa Kaydı'}
                            </h3>
                            <button onClick={() => { setIsModalOpen(false); setEditingId(null); }}><X size={20} className="text-slate-400 hover:text-slate-900" /></button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {/* Type Selector */}
                            <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'income', categoryId: '', subCategoryId: '' })}
                                    className={`py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${formData.type === 'income' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    <TrendingUp size={16} /> Gelir
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'expense', categoryId: '', subCategoryId: '' })}
                                    className={`py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${formData.type === 'expense' ? 'bg-white dark:bg-slate-700 text-red-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    <TrendingDown size={16} /> Gider
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
                                        onChange={(e) => setFormData({ ...formData, targetMonth: parseInt(e.target.value) })}
                                    >
                                        {MONTH_NAMES.map((m: string, i: number) => (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Yıl</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white"
                                        value={formData.targetYear}
                                        onChange={(e) => setFormData({ ...formData, targetYear: parseInt(e.target.value) })}
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
                                        <Tag size={12} /> Alt Kategori
                                    </label>
                                    <select
                                        required
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                                        value={formData.subCategoryId}
                                        onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}
                                    >
                                        <option value="">Alt Kategori Seçiniz...</option>
                                        {selectedCategory.descriptions.map(desc => (
                                            <option key={desc.id} value={desc.id}>{desc.description}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className={editingId ? "block" : "grid grid-cols-2 gap-4"}>
                                {!editingId && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Taksit Sayısı</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                                                value={formData.installments || ''}
                                                onChange={(e) => setFormData({ ...formData, installments: parseInt(e.target.value) || 0 })}
                                                placeholder="1"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                                                {(!formData.installments || formData.installments <= 1) ? 'Tek Çekim' : 'Adet'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tutar (TL)</label>
                                    <input
                                        type="number"
                                        required
                                        min="0" step="0.01"
                                        placeholder="0.00"
                                        className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm font-bold outline-none focus:ring-2 ${formData.type === 'income' ? 'text-green-600 focus:ring-green-500' : 'text-red-600 focus:ring-red-500'}`}
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
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