import React, { useState, useEffect, useRef } from 'react';
import {
    BookOpen, ChevronLeft, ChevronRight, Plus, Wallet, TrendingUp,
    TrendingDown, Calendar, Search, Filter, Save, X, Layers,
    List, ChevronDown, AlertCircle, Tag, Clock, Trash2, Pencil, Upload, Download,
    CheckSquare, Square, FileText
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';
import { normalizeDottedIForCompare } from '../../lib/readableText';
import { fetchFinanceCategories } from '../../lib/financeCategories';

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
    created_at?: string;
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

interface ImportedRow {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    isSelected: boolean;
    categoryId: string;
    subCategoryId: string;
    subCategoryText?: string;
    targetMonth: number;
    targetYear: number;
    installments: number;
    installmentInfo?: string;
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
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [hideCategorized, setHideCategorized] = useState(false);
    const [highlightedInstallment, setHighlightedInstallment] = useState<string | null>(null);
    const [showFutureInstallments, setShowFutureInstallments] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importedRows, setImportedRows] = useState<ImportedRow[]>([]);
    const [bulkCategory, setBulkCategory] = useState<string>('');
    const [bulkSubCategory, setBulkSubCategory] = useState<string>('');

    // Form State
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        type: 'income' as 'income' | 'expense',
        categoryId: '',
        subCategoryId: '', // New field for sub-category selection
        amount: '',
        targetMonth: new Date().getMonth(), // 0-11
        targetYear: new Date().getFullYear(),
        installments: 1,
        bulkPayments: 1
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    // --- Helpers ---
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const parseDescriptionParts = (description?: string) => {
        const parts = description ? description.split(' - ').map(part => part.trim()).filter(Boolean) : [];
        if (parts.length === 0) return { subCategory: '-', period: '-' };

        const lastPart = parts[parts.length - 1];
        const [monthText, yearText] = lastPart.split(/\s+/);
        const isPeriod = MONTH_NAMES.some(month => month.toLocaleLowerCase('tr-TR') === (monthText || '').toLocaleLowerCase('tr-TR')) && /^\d{4}$/.test(yearText || '');

        return {
            subCategory: isPeriod ? (parts.slice(0, -1).join(' - ') || '-') : parts.join(' - '),
            period: isPeriod ? lastPart : '-'
        };
    };

    const normalizeLookupText = (value: any) => {
        return String(value ?? '')
            .replace(/\u00A0/g, ' ')
            .trim()
            .replace(/\s+/g, ' ')
            .toLocaleLowerCase('tr-TR');
    };

    const normalizeLookupKey = (value: any) => {
        return normalizeLookupText(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ı/g, 'i')
            .replace(/[^a-z0-9]/g, '');
    };

    const getExcelValue = (row: Record<string, any>, possibleKeys: string[]) => {
        const normalizedKeys = possibleKeys.map(normalizeLookupKey);
        const match = Object.entries(row).find(([key]) => normalizedKeys.includes(normalizeLookupKey(key)));
        return match ? match[1] : '';
    };

    const findSubCategoryByDescription = (category: CategoryOption | undefined, description: string) => {
        const normalizedDescription = normalizeDottedIForCompare(description);
        return category?.descriptions.find(d => normalizeDottedIForCompare(d.description) === normalizedDescription);
    };

    const getMonthName = (date: Date) => {
        return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    };

    const getYearsList = () => {
        const currentYear = new Date().getFullYear();
        return [currentYear - 1, currentYear, currentYear + 1];
    };

    const parseTurkishAmount = (val: any): number => {
        if (val === undefined || val === null) return 0;
        if (typeof val === 'number') return val;
        if (typeof val !== 'string') return 0;

        const isNegative = val.trim().startsWith('-') || val.trim().endsWith('-');
        let clean = val.replace(/[^0-9,.]/g, '');

        if (clean.includes(',') && clean.includes('.')) {
            clean = clean.lastIndexOf(',') > clean.lastIndexOf('.')
                ? clean.replace(/\./g, '').replace(',', '.')
                : clean.replace(/,/g, '');
        } else if (clean.includes(',')) {
            clean = clean.replace(',', '.');
        } else if (clean.includes('.') && clean.split('.').pop()?.length === 3) {
            clean = clean.replace(/\./g, '');
        }

        const parsed = parseFloat(clean);
        if (isNaN(parsed)) return 0;
        return isNegative ? -parsed : parsed;
    };

    const getShiftedDate = (dateStr: string, monthOffset: number) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        if (!year || !month || !day) return dateStr;

        const targetMonthIndex = month - 1 + monthOffset;
        const targetYear = year + Math.floor(targetMonthIndex / 12);
        const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
        const daysInMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
        const finalDay = Math.min(day, daysInMonth);

        return new Date(Date.UTC(targetYear, normalizedMonth, finalDay)).toISOString().split('T')[0];
    };

    const getInstallmentIndex = (installmentInfo?: string) => {
        const match = String(installmentInfo || '').match(/^(\d+)\s*\//);
        return match ? Math.max(1, parseInt(match[1], 10) || 1) : 1;
    };

    const getRecordPeriod = (record: CashRecord) => {
        const { period } = parseDescriptionParts(record.description);
        const [monthText, yearText] = period.split(/\s+/);
        const monthIndex = MONTH_NAMES.findIndex(month => month.toLocaleLowerCase('tr-TR') === (monthText || '').toLocaleLowerCase('tr-TR'));
        const yearValue = parseInt(yearText || '', 10);

        return monthIndex !== -1 && !isNaN(yearValue) ? { month: monthIndex, year: yearValue } : null;
    };

    const getEffectiveInstallmentDate = (record: CashRecord) => {
        const installmentIndex = getInstallmentIndex(record.installment_info);
        if (!record.installment_info || installmentIndex <= 1) return record.date;

        const recordDate = new Date(record.date);
        const period = getRecordPeriod(record);
        if (period && recordDate.getMonth() === period.month && recordDate.getFullYear() === period.year) {
            return record.date;
        }

        return getShiftedDate(record.date, installmentIndex - 1);
    };

    const isFutureInstallment = (record: CashRecord) => {
        const today = new Date().toISOString().split('T')[0];
        return !!record.installment_info && getEffectiveInstallmentDate(record) > today;
    };

    const normalizeExcelDate = (val: any): string => {
        if (!val) return '';
        if (val instanceof Date) return val.toISOString().split('T')[0];
        if (typeof val === 'number') {
            const parsed = XLSX.SSF.parse_date_code(val);
            if (parsed) {
                const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
                return date.toISOString().split('T')[0];
            }
        }

        const str = String(val).trim();
        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

        const trMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
        if (trMatch) {
            const day = trMatch[1].padStart(2, '0');
            const month = trMatch[2].padStart(2, '0');
            return `${trMatch[3]}-${month}-${day}`;
        }

        const parsedDate = new Date(str);
        return isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString().split('T')[0];
    };

    const parsePeriodText = (periodText: string, fallbackDate: string) => {
        const fallback = new Date(fallbackDate);
        let targetMonth = isNaN(fallback.getTime()) ? new Date().getMonth() : fallback.getMonth();
        let targetYear = isNaN(fallback.getTime()) ? new Date().getFullYear() : fallback.getFullYear();

        const [monthText, yearText] = periodText.trim().split(/\s+/);
        const monthIndex = MONTH_NAMES.findIndex(month => month.toLocaleLowerCase('tr-TR') === (monthText || '').toLocaleLowerCase('tr-TR'));
        const yearValue = parseInt(yearText || '', 10);

        if (monthIndex !== -1) targetMonth = monthIndex;
        if (!isNaN(yearValue)) targetYear = yearValue;

        return { targetMonth, targetYear };
    };

    // --- Data Fetching ---
    const fetchData = async () => {
        setLoading(true);
        // Fetch the entire year
        const year = currentDate.getFullYear();
        const startOfYear = `${year}-01-01`;
        const endOfYear = `${year}-12-31`;

        try {
            // 1. Fetch Categories AND their descriptions (sub-items)
            const formattedCategories = await fetchFinanceCategories();
            setCategories(formattedCategories);

            // 2. Calculate Opening Balance (Sum of all records BEFORE this year)
            let calculatedOpening = 0;
            const { data: allPrevRecords } = await supabase
                .from('cash_book')
                .select('amount, type, date, installment_info')
                .lt('date', startOfYear);

            if (allPrevRecords) {
                calculatedOpening = allPrevRecords.reduce((acc, curr) => {
                    if (curr.installment_info && curr.date > new Date().toISOString().split('T')[0]) return acc;
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
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

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

        let subCatId = '';
        const { subCategory: subCatDesc } = parseDescriptionParts(record.description);
        if (subCatDesc !== '-' && category) {
            const foundSub = findSubCategoryByDescription(category, subCatDesc);
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
            installments: 1,
            bulkPayments: 1
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
            const bulkPayments = Math.max(1, formData.bulkPayments);
            const splitCount = bulkPayments > 1 ? bulkPayments : installments;
            const isBulkPayment = bulkPayments > 1;
            const baseAmount = Math.floor((totalAmount / splitCount) * 100) / 100;
            const remainder = Number((totalAmount - (baseAmount * splitCount)).toFixed(2));

            const buildSplitRows = () => {
                const rows = [];

                for (let i = 0; i < splitCount; i++) {
                    const startM = Number(formData.targetMonth);
                    const startY = Number(formData.targetYear);
                    const targetM = (startM + i) % 12;
                    const targetY = startY + Math.floor((startM + i) / 12);
                    const currentPeriodString = `${MONTH_NAMES[targetM]} ${targetY}`;
                    const amount = i === splitCount - 1 ? baseAmount + remainder : baseAmount;

                    rows.push({
                        date: isBulkPayment ? formData.date : getShiftedDate(formData.date, i),
                        type: formData.type,
                        category_id: formData.categoryId,
                        category_name: category?.title || 'Diğer',
                        amount: Number(amount.toFixed(2)),
                        description: `${subCategory?.description || 'Genel'} - ${currentPeriodString}`,
                        installment_info: !isBulkPayment && splitCount > 1 ? `${i + 1}/${splitCount}` : null
                    });
                }

                return rows;
            };

            if (editingId) {
                const [firstRow, ...extraRows] = buildSplitRows();
                const { error: updateError } = await supabase
                    .from('cash_book')
                    .update(firstRow)
                    .eq('id', editingId);

                if (updateError) throw updateError;

                if (extraRows.length > 0) {
                    const { error: insertError } = await supabase.from('cash_book').insert(extraRows);
                    if (insertError) throw insertError;
                }
            } else {
                const recordsToInsert = buildSplitRows();
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
                installments: 1,
                bulkPayments: 1
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

    const handleDownloadExcel = () => {
        const exportRows = filteredBySearch.map(record => {
            const { subCategory, period } = parseDescriptionParts(record.description);

            return {
                Tarih: record.date,
                Tip: record.type === 'income' ? 'Gelir' : 'Gider',
                Kategori: record.category_name,
                'Alt Kategori': subCategory === '-' ? '' : subCategory,
                Dönem: period === '-' ? '' : period,
                Taksit: record.installment_info || '',
                Tutar: record.amount
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Kasa Defteri');
        XLSX.writeFile(workbook, `kasa-defteri-${currentDate.getFullYear()}-${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !canEdit) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                if (!bstr) return;

                const uploadCategories = await fetchFinanceCategories();
                setCategories(uploadCategories);
                const findUploadCategoryByTitle = (title: string, preferredType: 'income' | 'expense') => {
                    const normalizedTitle = normalizeDottedIForCompare(title);
                    return uploadCategories.find(c => c.type === preferredType && normalizeDottedIForCompare(c.title) === normalizedTitle)
                        || uploadCategories.find(c => normalizeDottedIForCompare(c.title) === normalizedTitle);
                };
                const findUploadSubCategoryByDescription = (category: CategoryOption | undefined, description: string) => {
                    const normalizedDescription = normalizeDottedIForCompare(description);
                    return category?.descriptions.find(d => normalizeDottedIForCompare(d.description) === normalizedDescription);
                };

                const wb = XLSX.read(bstr, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const data: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

                const parsedRows = data.map(row => {
                    const typeText = String(getExcelValue(row, ['Tip', 'Tür', 'Tur', 'Type'])).toLocaleLowerCase('tr-TR');
                    let type: 'income' | 'expense' = typeText.includes('gider') || typeText.includes('expense') ? 'expense' : 'income';
                    const categoryName = String(getExcelValue(row, ['Kategori', 'Category'])).trim();
                    let category = findUploadCategoryByTitle(categoryName, type);
                    if (category) type = category.type;
                    const amount = Math.abs(parseTurkishAmount(getExcelValue(row, ['Tutar', 'Amount'])));
                    const date = normalizeExcelDate(getExcelValue(row, ['Tarih', 'Date']));
                    const fullDescription = String(getExcelValue(row, ['Açıklama', 'Aciklama', 'Description'])).trim();
                    const subCategory = String(getExcelValue(row, ['Alt Kategori', 'AltKategori', 'Sub Category', 'SubCategory'])).trim();
                    const period = String(getExcelValue(row, ['Dönem', 'Donem', 'Period'])).trim();
                    const parsedDescription = parseDescriptionParts(fullDescription);
                    const effectiveSubCategory = subCategory || (parsedDescription.period !== '-' ? parsedDescription.subCategory : '');
                    const effectivePeriod = period || (parsedDescription.period !== '-' ? parsedDescription.period : '');
                    const { targetMonth, targetYear } = parsePeriodText(effectivePeriod, date);
                    const matchedSubCategory = findUploadSubCategoryByDescription(category, effectiveSubCategory);

                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        date,
                        type,
                        amount,
                        description: effectiveSubCategory || fullDescription || 'Genel',
                        isSelected: targetYear === currentDate.getFullYear(),
                        categoryId: category?.id || '',
                        subCategoryId: matchedSubCategory?.id || '',
                        subCategoryText: effectiveSubCategory || undefined,
                        targetMonth,
                        targetYear,
                        installments: Math.max(1, parseInt(String(getExcelValue(row, ['Taksit', 'Installment']) || '1').split('/')[1] || String(getExcelValue(row, ['Taksit', 'Installment']) || '1'), 10) || 1),
                        installmentInfo: String(getExcelValue(row, ['Taksit', 'Installment'])).trim() || undefined
                    };
                }).filter(row => row.date && row.amount > 0);

                if (parsedRows.length === 0) {
                    alert('Dosyadan içe aktarılacak geçerli kasa kaydı bulunamadı.');
                    return;
                }

                setImportedRows(parsedRows);
                setIsUploadModalOpen(true);
            } catch (err: any) {
                alert('Excel dosyası yüklenemedi: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const updateImportRow = (id: string, field: keyof ImportedRow, value: any) => {
        setImportedRows(prev => prev.map(row => {
            if (row.id !== id) return row;
            if (field === 'categoryId') return { ...row, categoryId: value, subCategoryId: '' };
            if (field === 'type') return { ...row, type: value, categoryId: '', subCategoryId: '' };
            return { ...row, [field]: value };
        }));
    };

    const applyBulkCategory = () => {
        if (!bulkCategory) return;
        setImportedRows(prev => prev.map(row => row.isSelected ? { ...row, categoryId: bulkCategory, subCategoryId: bulkSubCategory } : row));
    };

    const toggleImportRowSelection = (id: string) => {
        setImportedRows(prev => prev.map(row => row.id === id && row.targetYear === currentDate.getFullYear() ? { ...row, isSelected: !row.isSelected } : row));
    };

    const confirmImport = async () => {
        if (!canEdit) return;
        const selectedRows = importedRows.filter(row => row.isSelected);
        if (selectedRows.length === 0) return;

        const invalidRows = selectedRows.filter(row => {
            if (!row.categoryId) return true;
            const category = categories.find(c => c.id === row.categoryId);
            return !!(category && category.descriptions.length > 0 && !row.subCategoryId && !row.subCategoryText);
        });

        if (invalidRows.length > 0) {
            alert(`Lütfen işaretli ${invalidRows.length} satırdaki eksik bilgileri (Kategori veya Alt Kategori) doldurunuz.`);
            return;
        }

        setLoading(true);
        try {
            const rowsToInsert: any[] = [];

            selectedRows.forEach(row => {
                const category = categories.find(c => c.id === row.categoryId);
                const subCategory = category?.descriptions.find(d => d.id === row.subCategoryId);
                const installments = Math.max(1, row.installments || 1);
                const baseAmount = Math.floor((row.amount / installments) * 100) / 100;
                const remainder = Number((row.amount - (baseAmount * installments)).toFixed(2));

                for (let i = 0; i < installments; i++) {
                    const targetM = (Number(row.targetMonth) + i) % 12;
                    const targetY = Number(row.targetYear) + Math.floor((Number(row.targetMonth) + i) / 12);
                    const periodString = `${MONTH_NAMES[targetM]} ${targetY}`;

                    rowsToInsert.push({
                        date: getShiftedDate(row.date, i),
                        type: row.type,
                        category_id: row.categoryId,
                        category_name: category?.title || 'Diğer',
                        amount: Number((i === installments - 1 ? baseAmount + remainder : baseAmount).toFixed(2)),
                        description: `${subCategory?.description || row.subCategoryText || row.description || 'Genel'} - ${periodString}`,
                        installment_info: installments > 1 ? `${i + 1}/${installments}` : (row.installmentInfo || null)
                    });
                }
            });

            const { error } = await supabase.from('cash_book').insert(rowsToInsert);
            if (error) throw error;

            setIsUploadModalOpen(false);
            setImportedRows([]);
            setBulkCategory('');
            setBulkSubCategory('');
            fetchData();
            alert(`${rowsToInsert.length} adet kasa kaydı başarıyla içe aktarıldı.`);
        } catch (err: any) {
            alert('İçe aktarma hatası: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Calculations ---
    const futureInstallmentRecords = records.filter(isFutureInstallment);
    const settledRecords = records.filter(record => !isFutureInstallment(record));
    const futureInstallmentTotal = futureInstallmentRecords.reduce((acc, record) => acc + (record.type === 'income' ? record.amount : -record.amount), 0);

    const filteredBySearch = settledRecords.filter(r =>
        r.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.amount.toString().includes(searchTerm) ||
        r.date.includes(searchTerm)
    );

    const compareRecordsForBalance = (a: CashRecord, b: CashRecord) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;

        const createdAtDiff = new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
        if (!isNaN(createdAtDiff) && createdAtDiff !== 0) return createdAtDiff;

        return a.id.localeCompare(b.id);
    };

    const yearIncome = settledRecords.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
    const yearExpense = settledRecords.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
    const currentBalance = openingBalance + yearIncome - yearExpense;

    let runningBalance = openingBalance;
    const balanceByRecordId = new Map<string, number>();
    [...settledRecords]
        .sort(compareRecordsForBalance)
        .forEach(record => {
            runningBalance += record.type === 'income' ? record.amount : -record.amount;
            balanceByRecordId.set(record.id, runningBalance);
        });

    const displayedRecords = [...filteredBySearch]
        .sort((a, b) => compareRecordsForBalance(b, a));

    const summaryIncome = filteredBySearch.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
    const summaryExpense = filteredBySearch.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);

    // Selected Category Helper for Modal
    const selectedCategory = categories.find(c => c.id === formData.categoryId);

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-pnr-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-800">
                            <BookOpen size={32} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Kasa Defteri</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                    <button onClick={handlePrevYear} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ChevronLeft size={24} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">{currentDate.getFullYear()} Yılı</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Yıl Seçimi</p>
                    </div>
                    <button onClick={handleNextYear} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ChevronRight size={24} className="text-slate-600 dark:text-slate-300" />
                    </button>
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
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".xlsx, .csv"
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={handleDownloadExcel}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    >
                        <Download size={18} /> Excel İndir
                    </button>
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
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                            >
                                <Upload size={18} /> Excel Yükle
                            </button>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="p-3 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300">
                        <Wallet size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Güncel Bakiye</p>
                        <p className={`text-2xl font-bold ${currentBalance >= 0 ? 'text-slate-800 dark:text-white' : 'text-red-600'}`}>
                            {formatCurrency(currentBalance)}
                        </p>
                    </div>
                </div>

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
                <button
                    type="button"
                    onClick={() => setShowFutureInstallments(prev => !prev)}
                    className={`text-left p-5 rounded-2xl border flex items-center gap-4 transition-colors ${showFutureInstallments ? 'bg-amber-100 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/20'}`}
                >
                    <div className="p-3 bg-amber-100 dark:bg-amber-800/30 rounded-xl text-amber-600 dark:text-amber-400">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-amber-700/70 dark:text-amber-400/70 uppercase">Gelecek Taksit</p>
                        <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(futureInstallmentTotal)}</p>
                    </div>
                </button>
            </div>

            {/* Filter Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="Kayıtlarda ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pnr-purple dark:text-white"
                />
            </div>

            {showFutureInstallments && (
                <div className="bg-white dark:bg-pnr-card border border-amber-200 dark:border-amber-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800 flex justify-between items-center gap-3">
                        <h3 className="font-bold text-amber-800 dark:text-amber-300">Gelecek Taksitler</h3>
                        <div className="flex items-center gap-3">
                            {canEdit && futureInstallmentRecords.some(record => selectedIds.has(record.id)) && (
                                <button
                                    type="button"
                                    onClick={handleBulkDelete}
                                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"
                                >
                                    Seçilenleri Sil ({futureInstallmentRecords.filter(record => selectedIds.has(record.id)).length})
                                </button>
                            )}
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{formatCurrency(futureInstallmentTotal)}</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase">
                                <tr>
                                    <th className="p-3 w-10"></th>
                                    <th className="p-3">Tarih</th>
                                    <th className="p-3">Kategori</th>
                                    <th className="p-3">Alt Kategori</th>
                                    <th className="p-3">Açıklama</th>
                                    <th className="p-3 text-center">Taksit</th>
                                    <th className="p-3 text-right">Tutar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {futureInstallmentRecords.length === 0 ? (
                                    <tr><td colSpan={7} className="p-6 text-center text-slate-400">Gelecek taksit bulunmuyor.</td></tr>
                                ) : [...futureInstallmentRecords].sort(compareRecordsForBalance).map(record => (
                                    <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="p-3 text-center">
                                            {canEdit && (
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-slate-300 text-pnr-purple focus:ring-pnr-purple"
                                                    checked={selectedIds.has(record.id)}
                                                    onChange={() => toggleSelectRecord(record.id)}
                                                />
                                            )}
                                        </td>
                                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{formatDate(getEffectiveInstallmentDate(record))}</td>
                                        <td className="p-3 text-slate-700 dark:text-slate-300">{record.category_name}</td>
                                        <td className="p-3 text-slate-700 dark:text-slate-300">{parseDescriptionParts(record.description).subCategory === '-' ? '' : parseDescriptionParts(record.description).subCategory}</td>
                                        <td className="finance-description-cell p-3 text-slate-700 dark:text-slate-300 w-40 max-w-40" data-tooltip={record.description} title={record.description}>
                                            <span className="finance-description-text">{record.description}</span>
                                        </td>
                                        <td className="p-3 text-center font-mono text-slate-500">{record.installment_info}</td>
                                        <td className={`p-3 text-right font-bold ${record.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{record.type === 'income' ? '+' : '-'}{formatCurrency(record.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto sm:overflow-visible">
                    <table className="w-full text-left border-collapse table-fixed text-xs sm:text-sm">
                        <colgroup>
                            <col className="w-8 sm:w-12" />
                            <col className="w-[18%] sm:w-[13%]" />
                            <col className="w-[21%] sm:w-[15%]" />
                            <col className="w-[22%] sm:w-[19%]" />
                            <col className="hidden md:table-column md:w-[12%]" />
                            <col className="hidden lg:table-column lg:w-[8%]" />
                            <col className="w-[21%] sm:w-[13%]" />
                            <col className="hidden md:table-column md:w-[13%]" />
                            <col className="w-[10%] sm:w-[7%]" />
                        </colgroup>
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <th className="p-2 sm:p-4">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-pnr-purple focus:ring-pnr-purple"
                                        checked={selectedIds.size === filteredBySearch.length && filteredBySearch.length > 0}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-2 sm:p-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Tarih</th>
                                <th className="p-2 sm:p-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Kategori</th>
                                <th className="p-2 sm:p-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Alt Kategori</th>
                                <th className="hidden md:table-cell p-2 sm:p-4 text-xs font-bold text-slate-500 uppercase">Dönem</th>
                                <th className="hidden lg:table-cell p-2 sm:p-4 text-xs font-bold text-slate-500 uppercase text-center">Taksit</th>
                                <th className="p-2 sm:p-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase text-right">Tutar</th>
                                <th className="hidden md:table-cell p-2 sm:p-4 text-xs font-bold text-slate-500 uppercase text-right">Bakiye</th>
                                <th className="p-2 sm:p-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase text-center">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {/* Opening Balance Row */}
                            <tr className="bg-slate-50/50 dark:bg-slate-900/30 italic text-slate-500">
                                <td className="p-2 sm:p-4"></td>
                                <td className="p-2 sm:p-4 text-xs" colSpan={4}>Devreden Bakiye</td>
                                <td className="p-2 sm:p-4 text-xs sm:text-sm font-mono font-bold text-right">{formatCurrency(openingBalance)}</td>
                                <td className="hidden md:table-cell p-2 sm:p-4"></td>
                                <td className="p-2 sm:p-4"></td>
                            </tr>

                            {filteredBySearch.length === 0 ? (
                                <tr><td colSpan={9} className="p-8 text-center text-slate-400">Aranan kriterlere uygun kayıt bulunamadı.</td></tr>
                            ) : (
                                displayedRecords.map((record, index) => {
                                    const isIncome = record.type === 'income';
                                    const rowBalance = balanceByRecordId.get(record.id) ?? openingBalance;

                                    const currentDateObj = new Date(record.date);
                                    const currentMonth = currentDateObj.getMonth();
                                    const previousRecord = displayedRecords[index - 1];
                                    const previousDateObj = previousRecord ? new Date(previousRecord.date) : null;

                                    const isLatestMonthRow = !searchTerm && (!previousDateObj || previousDateObj.getMonth() !== currentMonth || previousDateObj.getFullYear() !== currentDateObj.getFullYear());

                                    const { subCategory: subCategoryDisplay, period: periodDisplay } = parseDescriptionParts(record.description);

                                    // Logic for highlighting related installments:
                                    const coreDesc = periodDisplay !== '-' ? subCategoryDisplay : (record.description || '');
                                    const installmentId = record.installment_info ? `${record.category_id}-${coreDesc}-${record.installment_info.split('/')[1]}` : null;
                                    const isHighlighted = highlightedInstallment && installmentId === highlightedInstallment;

                                    return (
                                        <React.Fragment key={record.id}>
                                            <tr
                                                className={`transition-colors ${selectedIds.has(record.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''} ${isHighlighted
                                                    ? 'bg-pnr-purple/10 dark:bg-pnr-purple/20 border-l-4 border-l-pnr-purple'
                                                    : isLatestMonthRow
                                                        ? 'bg-slate-100 dark:bg-slate-800/70 border-l-4 border-l-slate-400 dark:border-l-slate-500'
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                                            >
                                                <td className="p-2 sm:p-4">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 text-pnr-purple focus:ring-pnr-purple"
                                                        checked={selectedIds.has(record.id)}
                                                        onChange={() => toggleSelectRecord(record.id)}
                                                    />
                                                </td>
                                                <td className="p-2 sm:p-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-mono break-words">
                                                    {formatDate(record.date)}
                                                </td>
                                                <td className="p-2 sm:p-4">
                                                    <span className={`inline-block max-w-full break-words text-[10px] sm:text-xs px-1.5 sm:px-2 py-1 rounded border ${isIncome
                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                        : 'bg-red-50 text-red-700 border-red-200'
                                                        }`}>
                                                        {record.category_name}
                                                    </span>
                                                </td>
                                                <td className="p-2 sm:p-4 text-xs sm:text-sm font-medium text-slate-900 dark:text-white break-words">
                                                    {subCategoryDisplay === '-' ? '' : subCategoryDisplay}
                                                </td>
                                                <td className="hidden md:table-cell p-2 sm:p-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
                                                    {periodDisplay}
                                                </td>
                                                <td className="hidden lg:table-cell p-2 sm:p-4 text-center text-xs text-slate-500">
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
                                                <td className={`p-2 sm:p-4 text-right font-bold text-xs sm:text-sm break-words ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isIncome ? '+' : '-'}{formatCurrency(record.amount)}
                                                </td>
                                                <td className="hidden md:table-cell p-2 sm:p-4 text-right font-mono text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                                                    {formatCurrency(rowBalance)}
                                                </td>
                                                <td className="p-2 sm:p-4 text-center">
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
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* IMPORT MODAL */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-pnr-card w-full max-w-[95vw] h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                <FileText size={20} className="text-pnr-purple" /> Dosya Önizleme ve Düzenleme (Kasa Defteri)
                            </h3>
                            <button onClick={() => setIsUploadModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-900" /></button>
                        </div>

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
                            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl h-[34px]">
                                <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Sadece Alt Ktg Olmayanlar</span>
                                <button
                                    onClick={() => setHideCategorized(!hideCategorized)}
                                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${hideCategorized ? 'bg-pnr-purple' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${hideCategorized ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            <div className="text-xs text-slate-500 ml-auto flex items-center">
                                {importedRows.filter(r => r.isSelected).length} satır seçildi.
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 uppercase sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3 w-10 text-center">
                                            <button
                                                onClick={() => {
                                                    const selectableRows = importedRows.filter(r => r.targetYear === currentDate.getFullYear());
                                                    const allSelected = selectableRows.length > 0 && selectableRows.every(r => r.isSelected);
                                                    setImportedRows(importedRows.map(r => r.targetYear !== currentDate.getFullYear() ? { ...r, isSelected: false } : { ...r, isSelected: !allSelected }));
                                                }}
                                            >
                                                {importedRows.filter(r => r.targetYear === currentDate.getFullYear()).length > 0 && importedRows.filter(r => r.targetYear === currentDate.getFullYear()).every(r => r.isSelected) ? <CheckSquare size={16} /> : <Square size={16} />}
                                            </button>
                                        </th>
                                        <th className="p-3 w-28">Tarih</th>
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
                                    {importedRows
                                        .filter(row => !hideCategorized || (!row.subCategoryId && !row.subCategoryText))
                                        .map((row) => {
                                            const rowCategory = categories.find(c => c.id === row.categoryId);
                                            const isCategoryMissing = !row.categoryId;
                                            const hasSubOptions = rowCategory?.descriptions && rowCategory.descriptions.length > 0;
                                            const isSubCategoryMissing = hasSubOptions && !row.subCategoryId && !row.subCategoryText;

                                            return (
                                                <tr key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${!row.isSelected ? 'opacity-50 grayscale' : ''}`}>
                                                    <td className="p-3 text-center align-middle">
                                                        <button onClick={() => toggleImportRowSelection(row.id)} className="text-pnr-purple disabled:cursor-not-allowed disabled:text-amber-500" disabled={row.targetYear !== currentDate.getFullYear()} title={row.targetYear !== currentDate.getFullYear() ? 'Seçili yıl dışındaki satırlar aktarılmaz' : undefined}>
                                                            {row.isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300" />}
                                                        </button>
                                                    </td>
                                                    <td className="p-3 font-mono text-slate-600 dark:text-slate-300 align-middle">{row.date}</td>
                                                    <td className={`p-3 font-bold text-right align-middle ${row.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                                                        {row.type === 'expense' ? '-' : '+'}{formatCurrency(row.amount)}
                                                    </td>
                                                    <td className="p-2 align-middle">
                                                        <select
                                                            className={`w-full border rounded p-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-offset-1 ${row.type === 'income'
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
                                                    <td className="p-2 align-middle">
                                                        <select
                                                            className={`w-full bg-white dark:bg-slate-800 border rounded p-1.5 focus:ring-1 focus:ring-pnr-purple ${isCategoryMissing ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'}`}
                                                            value={row.categoryId}
                                                            onChange={(e) => updateImportRow(row.id, 'categoryId', e.target.value)}
                                                        >
                                                            <option value="">Seçiniz...</option>
                                                            {categories.filter(c => c.type === row.type).map(c => (
                                                                <option key={c.id} value={c.id}>{c.title}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="p-2 align-middle">
                                                        <select
                                                            className={`w-full bg-white dark:bg-slate-800 border rounded p-1.5 focus:ring-1 focus:ring-pnr-purple ${isSubCategoryMissing ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'}`}
                                                            value={row.subCategoryId}
                                                            onChange={(e) => updateImportRow(row.id, 'subCategoryId', e.target.value)}
                                                            disabled={!row.categoryId}
                                                        >
                                                            <option value="">{row.subCategoryText || 'Seçiniz...'}</option>
                                                            {rowCategory?.descriptions.map(d => (
                                                                <option key={d.id} value={d.id}>{d.description}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="p-2 align-middle">
                                                        <select
                                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5"
                                                            value={row.targetMonth}
                                                            onChange={(e) => updateImportRow(row.id, 'targetMonth', parseInt(e.target.value))}
                                                        >
                                                            {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="p-2 align-middle">
                                                        <select
                                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5"
                                                            value={row.targetYear}
                                                            onChange={(e) => updateImportRow(row.id, 'targetYear', parseInt(e.target.value))}
                                                        >
                                                            {getYearsList().map(y => <option key={y} value={y}>{y}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="p-2 align-middle text-center">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="24"
                                                            className="w-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-center"
                                                            value={row.installments}
                                                            onChange={(e) => updateImportRow(row.id, 'installments', parseInt(e.target.value) || 1)}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
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

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Taksit Sayısı</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                                            value={formData.installments || ''}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                setFormData({ ...formData, installments: value, bulkPayments: value > 1 ? 1 : formData.bulkPayments });
                                            }}
                                            placeholder="1"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                                            {(!formData.installments || formData.installments <= 1) ? 'Tek' : 'Adet'}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Toplu Ödeme</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                                            value={formData.bulkPayments || ''}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                setFormData({ ...formData, bulkPayments: value, installments: value > 1 ? 1 : formData.installments });
                                            }}
                                            placeholder="1"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                                            {(!formData.bulkPayments || formData.bulkPayments <= 1) ? 'Yok' : 'Ay'}
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
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            {(formData.installments > 1 || formData.bulkPayments > 1) && formData.amount && (
                                <p className="text-xs text-slate-400 text-right font-mono">
                                    {formData.bulkPayments > 1 ? 'Dönem Payı' : 'Aylık Ödeme'}: {formatCurrency(parseFloat(formData.amount) / (formData.bulkPayments > 1 ? formData.bulkPayments : formData.installments))}
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
