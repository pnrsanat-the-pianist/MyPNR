
import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronLeft, ChevronRight, Plus, CreditCard, TrendingUp, TrendingDown, Search,
    Save, X, Upload, CheckSquare, Square, Trash2,
    FileText, AlertCircle, RefreshCcw, Tag, Calendar, Clock, Layers, Landmark, EyeOff, Download
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';
import { normalizeDottedIForCompare } from '../../lib/readableText';
import { fetchFinanceCategories, FinanceCategoryOption } from '../../lib/financeCategories';

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

interface AutomationRule {
    id: string;
    keyword: string;
    category_id: string;
    sub_category_id: string;
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
    installmentInfo?: string;
}

const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

interface VakifbankProps {
    canEdit?: boolean;
}

const Vakifbank: React.FC<VakifbankProps> = ({ canEdit = true }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [records, setRecords] = useState<BankRecord[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Modals
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [hideCategorized, setHideCategorized] = useState(false);

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
        subCategoryId: '',
        amount: '',
        targetMonth: new Date().getMonth(),
        targetYear: new Date().getFullYear(),
        installments: 1
    });

    // --- Helpers ---
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const getYearsList = () => {
        const currentYear = new Date().getFullYear();
        return [currentYear - 1, currentYear, currentYear + 1];
    };

    const handleCategoryChange = (catId: string) => {
        setFormData(prev => ({ ...prev, categoryId: catId, subCategoryId: '' }));
    };

    const handleDateInput = (val: string) => {
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

    const findCategoryByTitle = (title: string, preferredType?: 'income' | 'expense', source: CategoryOption[] | FinanceCategoryOption[] = categories) => {
        const normalizedTitle = normalizeDottedIForCompare(title);
        return source.find(c => c.type === preferredType && normalizeDottedIForCompare(c.title) === normalizedTitle)
            || source.find(c => normalizeDottedIForCompare(c.title) === normalizedTitle);
    };

    const signedAmount = (record: Pick<BankRecord, 'type' | 'amount'>) => record.type === 'income' ? record.amount : -record.amount;
    const normalizeSearchText = (value: any) => String(value ?? '')
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const isDevirRecord = (record: Pick<BankRecord, 'date' | 'category_name' | 'description'>) => {
        const text = normalizeSearchText(`${record.category_name} ${record.description}`);
        return text.includes('devir') || text.includes('devreden');
    };
    const isAnnualDevirRecord = (record: Pick<BankRecord, 'date' | 'category_name' | 'description'>, year: number) => {
        const [recordYear, month, day] = record.date.split('-').map(Number);
        return recordYear === year && month === 1 && day === 1 && isDevirRecord(record);
    };
    const sortRecordsForBalance = (sourceRecords: BankRecord[]) => {
        return [...sourceRecords].sort((a, b) => {
            const aIsDevir = isDevirRecord(a);
            const bIsDevir = isDevirRecord(b);
            if (aIsDevir !== bIsDevir) return aIsDevir ? 1 : -1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    };
    const buildBalanceMap = (sourceRecords: BankRecord[]) => {
        const sortedRecords = sortRecordsForBalance(sourceRecords);
        const balanceMap = new Map<string, number>();
        let runningBalance = 0;

        for (let i = sortedRecords.length - 1; i >= 0; i--) {
            const record = sortedRecords[i];
            runningBalance = isDevirRecord(record) ? signedAmount(record) : runningBalance + signedAmount(record);
            balanceMap.set(record.id, runningBalance);
        }

        return { sortedRecords, balanceMap };
    };
    const calculateClosingBalance = (sourceRecords: BankRecord[]) => {
        if (sourceRecords.length === 0) return 0;
        const devirRecords = sourceRecords
            .filter(isDevirRecord)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const latestDevir = devirRecords[devirRecords.length - 1];
        const recordsToCalculate = latestDevir
            ? sourceRecords.filter(record => record.id === latestDevir.id || new Date(record.date).getTime() >= new Date(latestDevir.date).getTime())
            : sourceRecords;
        const { sortedRecords, balanceMap } = buildBalanceMap(recordsToCalculate);
        return sortedRecords.length > 0 ? balanceMap.get(sortedRecords[0].id) ?? 0 : 0;
    };
    // --- Data Fetching ---
    const fetchData = async () => {
        setLoading(true);
        const year = currentDate.getFullYear();
        const previousYear = currentDate.getFullYear() - 1;
        const startOfPreviousYear = `${previousYear}-01-01`;
        const endOfPreviousYear = `${previousYear}-12-31`;
        const startOfYear = `${year}-01-01`;
        const endOfYear = `${year}-12-31`;

        try {
            // 1. Fetch Categories with Descriptions
            const formattedCategories = await fetchFinanceCategories();
            setCategories(formattedCategories);

            // 2. Fetch Automation Rules
            const { data: ruleData } = await supabase.from('category_automation_rules').select('*');
            setAutomationRules(ruleData || []);

            const { data: previousRecordData, error: previousError } = await supabase
                .from('vakifbank_book')
                .select('*')
                .gte('date', startOfPreviousYear)
                .lte('date', endOfPreviousYear);

            if (previousError) throw previousError;

            // 3. Fetch Selected Year Transactions
            const { data: recordData, error } = await supabase
                .from('vakifbank_book')
                .select('*')
                .gte('date', startOfYear)
                .lte('date', endOfYear)
                .order('date', { ascending: false });

            if (error) throw error;
            let currentRecords = (recordData || []) as BankRecord[];
            const previousRecords = (previousRecordData || []) as BankRecord[];

            if (canEdit && previousRecords.length > 0) {
                const previousClosingBalance = Number(calculateClosingBalance(previousRecords).toFixed(2));
                const devirType: 'income' | 'expense' = previousClosingBalance >= 0 ? 'income' : 'expense';
                const devirAmount = Math.abs(previousClosingBalance);
                const existingAnnualDevir = currentRecords.find(record => isAnnualDevirRecord(record, year));
                const devirPayload = {
                    date: `${year}-01-01`,
                    description: `${year} Devir`,
                    amount: devirAmount,
                    type: devirType,
                    category_id: null,
                    category_name: 'Devir',
                    installment_info: null
                };

                if (existingAnnualDevir) {
                    const currentSigned = Number(signedAmount(existingAnnualDevir).toFixed(2));
                    if (Math.abs(currentSigned - previousClosingBalance) >= 0.01) {
                        const { data: updatedDevir, error: updateDevirError } = await supabase
                            .from('vakifbank_book')
                            .update(devirPayload)
                            .eq('id', existingAnnualDevir.id)
                            .select('*')
                            .single();

                        if (updateDevirError) throw updateDevirError;
                        currentRecords = currentRecords.map(record => record.id === existingAnnualDevir.id ? updatedDevir as BankRecord : record);
                    }
                } else {
                    const { data: insertedDevir, error: insertDevirError } = await supabase
                        .from('vakifbank_book')
                        .insert(devirPayload)
                        .select('*')
                        .single();

                    if (insertDevirError) throw insertDevirError;
                    currentRecords = [insertedDevir as BankRecord, ...currentRecords];
                }
            }

            setRecords(currentRecords);

        } catch (err: any) {
            console.error('Veri çekme hatası:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentDate.getFullYear()]);

    const handlePrevYear = () => {
        const newDate = new Date(currentDate);
        newDate.setFullYear(newDate.getFullYear() - 1);
        setCurrentDate(newDate);
        setSelectedIds(new Set());
    };

    const handleNextYear = () => {
        const newDate = new Date(currentDate);
        newDate.setFullYear(newDate.getFullYear() + 1);
        setCurrentDate(newDate);
        setSelectedIds(new Set());
    };

    // --- Excel Parsing Logic ---
    const parseTurkishAmount = (val: any): number => {
        if (val === undefined || val === null) return 0;
        if (typeof val === 'number') return val;
        if (typeof val !== 'string') return 0;

        let str = val.trim();
        if (!str) return 0;

        const isNegative = str.startsWith('-') || str.endsWith('-') || (str.startsWith('(') && str.endsWith(')'));

        let clean = str.replace(/[^0-9,.]/g, '');

        if (clean.includes(',') && clean.includes('.')) {
            if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
                clean = clean.replace(/\./g, '').replace(',', '.');
            } else {
                clean = clean.replace(/,/g, '');
            }
        } else if (clean.includes(',')) {
            clean = clean.replace(',', '.');
        } else if (clean.includes('.')) {
            const parts = clean.split('.');
            const lastPart = parts[parts.length - 1];
            if (lastPart.length === 3) {
                clean = clean.replace(/\./g, '');
            }
        }

        let num = parseFloat(clean);
        if (isNaN(num)) return 0;

        return isNegative ? -num : num;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            if (bstr) {
                try {
                    const uploadCategories = await fetchFinanceCategories();
                    setCategories(uploadCategories);

                    const wb = XLSX.read(bstr, { type: 'array' });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

                    const parsedRows: ImportedRow[] = [];

                    let dateIdx = -1;
                    let descIdx = -1;
                    let amountIdx = -1;
                    let bakiyeIdx = -1;
                    let typeIdx = -1;
                    let categoryIdx = -1;
                    let subCategoryIdx = -1;
                    let periodIdx = -1;
                    let installmentIdx = -1;

                    // Header Detection
                    for (let i = 0; i < Math.min(data.length, 15); i++) {
                        const row = data[i];
                        row.forEach((cell: any, idx: number) => {
                            if (typeof cell !== 'string') return;
                            const normalized = cell.toLowerCase().trim();
                            if (normalized.includes('tarih')) dateIdx = idx;
                            if (normalized.includes('açıklama') || normalized.includes('aciklama')) descIdx = idx;
                            if (normalized === 'tip' || normalized === 'tür' || normalized === 'tur') typeIdx = idx;
                            if (normalized === 'kategori') categoryIdx = idx;
                            if (normalized.includes('alt kategori')) subCategoryIdx = idx;
                            if (normalized === 'dönem' || normalized === 'donem') periodIdx = idx;
                            if (normalized.includes('taksit')) installmentIdx = idx;

                            const isBakiye = normalized.includes('bakıye') || normalized.includes('bakiye') || normalized.includes('güncel') || normalized.includes('guncel');

                            if ((normalized.includes('tutar') || normalized.includes('borç') || normalized.includes('alacak') || normalized.includes('net')) && !isBakiye) {
                                if (amountIdx === -1 || normalized === 'tutar' || normalized.includes('(tl)')) {
                                    amountIdx = idx;
                                }
                            }
                            if (isBakiye) bakiyeIdx = idx;
                        });
                        if (dateIdx !== -1 && amountIdx !== -1) break;
                    }

                    data.forEach((row, idx) => {
                        if (row.length === 0) return;

                        let dateCellIndex = dateIdx;
                        if (dateCellIndex === -1 || !row[dateCellIndex]) {
                            dateCellIndex = row.findIndex(cell =>
                                (cell instanceof Date) || (typeof cell === 'string' && cell.match(/^\d{2}[./-]\d{2}[./-]\d{4}/))
                            );
                        }
                        if (dateCellIndex === -1) return;

                        let isoDate = '';
                        let dateObj: Date | null = null;
                        const rawDate = row[dateCellIndex];

                        if (rawDate instanceof Date) {
                            dateObj = rawDate;
                            isoDate = rawDate.toISOString().split('T')[0];
                        } else if (typeof rawDate === 'number') {
                            const parsedDate = XLSX.SSF.parse_date_code(rawDate);
                            if (parsedDate) {
                                dateObj = new Date(Date.UTC(parsedDate.y, parsedDate.m - 1, parsedDate.d));
                                isoDate = dateObj.toISOString().split('T')[0];
                            }
                        } else if (typeof rawDate === 'string') {
                            const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
                            if (isoMatch) {
                                isoDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
                                dateObj = new Date(isoDate);
                            }
                            const dateMatch = rawDate.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
                            if (!isoDate && dateMatch) {
                                const [_, d, m, y] = dateMatch;
                                isoDate = `${y}-${m}-${d}`;
                                dateObj = new Date(isoDate);
                            }
                        }
                        if (!isoDate || !dateObj) return;

                        let amount = 0;
                        let amountFound = false;

                        if (amountIdx !== -1 && row[amountIdx]) {
                            amount = parseTurkishAmount(row[amountIdx]);
                            if (amount !== 0) amountFound = true;
                        }

                        if (!amountFound) {
                            for (let i = row.length - 1; i >= 0; i--) {
                                if ([dateCellIndex, bakiyeIdx, descIdx, typeIdx, categoryIdx, subCategoryIdx, periodIdx, installmentIdx].includes(i)) continue;
                                const val = parseTurkishAmount(row[i]);
                                if (val !== 0) {
                                    amount = val;
                                    amountFound = true;
                                    break;
                                }
                            }
                        }

                        let desc = '';
                        if (subCategoryIdx !== -1 && row[subCategoryIdx]) {
                            const periodText = periodIdx !== -1 && row[periodIdx] ? String(row[periodIdx]).trim() : '';
                            desc = [String(row[subCategoryIdx]).trim(), periodText].filter(Boolean).join(' - ');
                        } else if (descIdx !== -1 && row[descIdx]) {
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
                            const typeText = typeIdx !== -1 && row[typeIdx] ? String(row[typeIdx]).toLocaleLowerCase('tr-TR') : '';
                            let type: 'income' | 'expense' = typeText.includes('gider') || typeText.includes('expense')
                                ? 'expense'
                                : typeText.includes('gelir') || typeText.includes('income')
                                    ? 'income'
                                    : amount > 0 ? 'income' : 'expense';

                            // POS Auto-detection logic
                            let detectedCategoryId = '';
                            let detectedSubCategoryId = '';

                            const categoryTitle = categoryIdx !== -1 && row[categoryIdx] ? String(row[categoryIdx]).trim() : '';
                            const matchedCategory = categoryTitle ? findCategoryByTitle(categoryTitle, type, uploadCategories) : undefined;
                            if (matchedCategory) {
                                type = matchedCategory.type;
                                detectedCategoryId = matchedCategory.id;
                                const subCategoryTitle = subCategoryIdx !== -1 && row[subCategoryIdx] ? String(row[subCategoryIdx]).trim() : '';
                                detectedSubCategoryId = matchedCategory.descriptions.find(d => normalizeDottedIForCompare(d.description) === normalizeDottedIForCompare(subCategoryTitle))?.id || '';
                            }

                            const normDesc = desc.toLocaleUpperCase('tr-TR');

                            // 1. DYNAMIC CATEGORY AUTOMATION (Priority)
                            const matchedRule = automationRules.find(rule =>
                                normDesc.includes(rule.keyword.toLocaleUpperCase('tr-TR'))
                            );

                            if (!detectedCategoryId && matchedRule) {
                                detectedCategoryId = matchedRule.category_id;
                                detectedSubCategoryId = matchedRule.sub_category_id || '';
                                console.log(`[Automation Match] Keyword: "${matchedRule.keyword}" -> Desc: "${desc}"`);
                            }

                            let targetMonth = isNaN(dateObj.getTime()) ? new Date().getMonth() : dateObj.getMonth();
                            let targetYear = isNaN(dateObj.getTime()) ? new Date().getFullYear() : dateObj.getFullYear();
                            const periodText = periodIdx !== -1 && row[periodIdx] ? String(row[periodIdx]).trim() : '';
                            if (periodText) {
                                const periodParts = periodText.split(/\s+/);
                                const monthIndex = MONTH_NAMES.findIndex(m => m.toLocaleLowerCase('tr-TR') === (periodParts[0] || '').toLocaleLowerCase('tr-TR'));
                                const yearValue = parseInt(periodParts[1]);
                                if (monthIndex !== -1) targetMonth = monthIndex;
                                if (!isNaN(yearValue)) targetYear = yearValue;
                            }

                            parsedRows.push({
                                id: Math.random().toString(36).substr(2, 9),
                                date: isoDate,
                                description: desc || 'İçe Aktarılan İşlem',
                                amount: Math.abs(amount),
                                type: type,
                                isSelected: true,
                                categoryId: detectedCategoryId,
                                subCategoryId: detectedSubCategoryId,
                                targetMonth,
                                targetYear,
                                installments: 1,
                                installmentInfo: installmentIdx !== -1 && row[installmentIdx] ? String(row[installmentIdx]).trim() : undefined
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
        if (!canEdit) return;
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

                    let finalDesc = row.description || '';
                    if (subCategory && !finalDesc.includes(subCategory.description)) {
                        finalDesc += `${finalDesc ? ' - ' : ''}${subCategory.description}`;
                    }
                    if (!finalDesc.includes(periodString)) {
                        finalDesc += `${finalDesc ? ' - ' : ''}${periodString}`;
                    }

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
                        installment_info: row.installmentInfo || (installments > 1 ? `${i + 1}/${installments}` : null)
                    });
                }
            });

            const { error } = await supabase.from('vakifbank_book').insert(dbRows);
            if (error) throw error;

            setIsUploadModalOpen(false);
            setImportedRows([]);
            fetchData();
            alert(`${dbRows.length} adet kayıt başarıyla oluşturuldu.`);

        } catch (err: any) {
            alert("Hata: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Manual Add Handlers ---
    const handleManualSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit || !formData.amount || !formData.categoryId) return;

        setLoading(true);
        try {
            const cat = categories.find(c => c.id === formData.categoryId);
            const subCategory = cat?.descriptions.find(d => d.id === formData.subCategoryId);

            if (cat && cat.descriptions.length > 0 && !formData.subCategoryId) {
                alert('Lütfen alt kategori seçiniz.');
                return;
            }

            const dbRows: any[] = [];
            const transDay = new Date(formData.date).getDate();
            const totalAmount = Math.abs(parseTurkishAmount(formData.amount));
            const installments = Math.max(1, formData.installments);
            const baseAmount = Math.floor((totalAmount / installments) * 100) / 100;
            const remainder = Number((totalAmount - (baseAmount * installments)).toFixed(2));

            for (let i = 0; i < installments; i++) {
                let targetY = formData.targetYear;
                let targetM = formData.targetMonth + i;

                targetY += Math.floor(targetM / 12);
                targetM = targetM % 12;

                const daysInMonth = new Date(targetY, targetM + 1, 0).getDate();
                const finalDay = Math.min(transDay, daysInMonth);
                const recordDate = new Date(Date.UTC(targetY, targetM, finalDay));
                const periodString = `${MONTH_NAMES[targetM]} ${targetY}`;
                const description = `${subCategory?.description || 'Genel'} - ${periodString}`;
                const amount = i === installments - 1 ? baseAmount + remainder : baseAmount;

                dbRows.push({
                    date: recordDate.toISOString().split('T')[0],
                    type: formData.type,
                    category_id: formData.categoryId,
                    category_name: cat?.title || '',
                    amount: Number(amount.toFixed(2)),
                    description,
                    installment_info: installments > 1 ? `${i + 1}/${installments}` : null
                });
            }

            const { error } = await supabase.from('vakifbank_book').insert(dbRows);

            if (error) throw error;

            setIsManualModalOpen(false);
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
            alert("Hata: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!canEdit || !confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from('vakifbank_book').delete().eq('id', id);
            if (error) throw error;
            setRecords(prev => prev.filter(r => r.id !== id));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch (err: any) {
            alert("Silinemedi: " + err.message);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredRecords.length && filteredRecords.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredRecords.map(r => r.id)));
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
            const ids = Array.from(selectedIds);
            const { error } = await supabase.from('vakifbank_book').delete().in('id', ids);
            if (error) throw error;
            setRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
            setSelectedIds(new Set());
        } catch (err: any) {
            alert("Toplu silme hatası: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Stats
    const movementRecords = records.filter(record => !isDevirRecord(record));
    const totalIncome = movementRecords.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
    const totalExpense = movementRecords.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);

    const filteredRecords = records.filter(r =>
        r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.category_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedCategory = categories.find(c => c.id === formData.categoryId);

    const { sortedRecords: displayedRecords } = buildBalanceMap(filteredRecords);
    const { sortedRecords: allDisplayedRecords, balanceMap: balanceByRecordId } = buildBalanceMap(records);
    const totalBalance = allDisplayedRecords.length > 0 ? balanceByRecordId.get(allDisplayedRecords[0].id) ?? 0 : 0;

    const handleDownloadExcel = () => {
        const exportRows = displayedRecords.map(record => {
            const descriptionParts = record.description ? record.description.split(' - ') : [];
            const subCategoryDisplay = descriptionParts[0] || '';
            const periodDisplay = descriptionParts.length > 1 ? descriptionParts.slice(-1)[0] : '';

            return {
                Tarih: record.date,
                Kategori: record.category_name,
                'Alt Kategori': subCategoryDisplay,
                Dönem: periodDisplay,
                Taksit: record.installment_info || '',
                Tutar: signedAmount(record),
                Bakiye: balanceByRecordId.get(record.id) ?? 0,
                İşlem: ''
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Vakıfbank');
        XLSX.writeFile(workbook, `vakifbank-${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-pnr-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-xl border border-yellow-100 dark:border-yellow-800">
                        <Landmark size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Vakıfbank</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={handlePrevYear} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ChevronLeft size={22} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <div className="text-center min-w-24">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{currentDate.getFullYear()} Yılı</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Vakıfbank</p>
                    </div>
                    <button onClick={handleNextYear} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ChevronRight size={22} className="text-slate-600 dark:text-slate-300" />
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Hidden File Input */}
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
                        selectedIds.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-red-500/20 flex items-center gap-2 transition-transform active:scale-95"
                            >
                                <Trash2 size={18} /> {selectedIds.size} Kaydı Sil
                            </button>
                        )
                    )}

                    {canEdit && (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            <Upload size={18} /> Excel Yükle
                        </button>
                    )}

                    {canEdit && (
                        <button
                            onClick={() => setIsManualModalOpen(true)}
                            className="bg-pnr-purple hover:bg-pnr-indigo text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-pnr-purple/20 flex items-center gap-2 transition-transform active:scale-95"
                        >
                            <Plus size={20} /> Yeni Kayıt
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Toplam Bakiye</span>
                    <div className={`text-2xl font-bold font-mono ${totalBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                        {formatCurrency(totalBalance)}
                    </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 p-5 rounded-2xl flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={16} className="text-green-600" />
                        <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Toplam Gelir</span>
                    </div>
                    <div className="text-2xl font-bold font-mono text-green-700 dark:text-green-400">{formatCurrency(totalIncome)}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 p-5 rounded-2xl flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingDown size={16} className="text-red-600" />
                        <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">Toplam Gider</span>
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
                    <div className="overflow-x-auto sm:overflow-visible">
                        <table className="w-full text-left border-collapse table-fixed text-xs sm:text-sm">
                            <colgroup>
                                <col className="w-8 sm:w-12" />
                                <col className="w-[20%] sm:w-[14%]" />
                                <col className="w-[24%] sm:w-[17%]" />
                                <col className="hidden sm:table-column sm:w-[22%]" />
                                <col className="hidden md:table-column md:w-[14%]" />
                                <col className="hidden lg:table-column lg:w-[8%]" />
                                <col className="w-[24%] sm:w-[15%]" />
                                <col className="w-[24%] sm:w-[15%]" />
                                <col className="w-[10%] sm:w-[7%]" />
                            </colgroup>
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase">
                                    <th className="p-2 sm:p-4">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-pnr-purple focus:ring-pnr-purple"
                                            checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="p-2 sm:p-4 text-[10px] sm:text-xs">Tarih</th>
                                    <th className="p-2 sm:p-4 text-[10px] sm:text-xs">Kategori</th>
                                    <th className="hidden sm:table-cell p-2 sm:p-4 text-[10px] sm:text-xs">Alt Kategori</th>
                                    <th className="hidden md:table-cell p-2 sm:p-4">Dönem</th>
                                    <th className="hidden lg:table-cell p-2 sm:p-4 text-center">Taksit</th>
                                    <th className="p-2 sm:p-4 text-[10px] sm:text-xs text-right">Tutar</th>
                                    <th className="p-2 sm:p-4 text-[10px] sm:text-xs text-right">Bakiye</th>
                                    <th className="p-2 sm:p-4 text-[10px] sm:text-xs text-center">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredRecords.length > 0 ? (
                                    displayedRecords.map((record, index) => {
                                        const isIncome = record.type === 'income';
                                        const descriptionParts = record.description ? record.description.split(' - ') : [];
                                        const subCategoryDisplay = descriptionParts[0] || '-';
                                        const periodDisplay = descriptionParts.length > 1 ? descriptionParts.slice(-1)[0] : '-';
                                        const rowBalance = balanceByRecordId.get(record.id) ?? 0;
                                        const currentDateObj = new Date(record.date);
                                        const currentMonth = currentDateObj.getMonth();
                                        const previousRecord = displayedRecords[index - 1];
                                        const previousDateObj = previousRecord ? new Date(previousRecord.date) : null;
                                        const isLatestMonthRow = !searchTerm && (!previousDateObj || previousDateObj.getMonth() !== currentMonth || previousDateObj.getFullYear() !== currentDateObj.getFullYear());

                                        return (
                                            <React.Fragment key={record.id}>
                                                <tr className={`transition-colors ${selectedIds.has(record.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : isLatestMonthRow ? 'bg-slate-100 dark:bg-slate-800/70 border-l-4 border-l-slate-400 dark:border-l-slate-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
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
                                                    <td className="hidden sm:table-cell p-2 sm:p-4 text-xs sm:text-sm font-medium text-slate-900 dark:text-white break-words">
                                                        {subCategoryDisplay}
                                                    </td>
                                                    <td className="hidden md:table-cell p-2 sm:p-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
                                                        {periodDisplay}
                                                    </td>
                                                    <td className="hidden lg:table-cell p-2 sm:p-4 text-center text-xs text-slate-500">
                                                        {record.installment_info || '-'}
                                                    </td>
                                                    <td className={`p-2 sm:p-4 text-right font-bold text-xs sm:text-sm break-words ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                                                        {isIncome ? '+' : '-'}{formatCurrency(record.amount)}
                                                    </td>
                                                    <td className="p-2 sm:p-4 text-right font-mono text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white break-words">
                                                        {formatCurrency(rowBalance)}
                                                    </td>
                                                    <td className="p-2 sm:p-4 text-center">
                                                        {canEdit && (
                                                            <button
                                                                onClick={() => handleDelete(record.id)}
                                                                className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                                                                title="Kaydı Sil"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-slate-400 text-sm">
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
                                <FileText size={20} className="text-pnr-purple" /> Dosya Önizleme ve Düzenleme (Vakıfbank)
                            </h3>
                            <button onClick={() => setIsUploadModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-900" /></button>
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
                            <div className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl h-[34px]">
                                <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Sadece Alt Ktg Olmayanlar</span>
                                <button
                                    onClick={() => setHideCategorized(!hideCategorized)}
                                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${hideCategorized ? 'bg-pnr-purple' : 'bg-slate-200 dark:bg-slate-700'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${hideCategorized ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
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
                                                {importedRows.every(r => r.isSelected) ? <CheckSquare size={16} /> : <Square size={16} />}
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
                                        .filter(row => !hideCategorized || !row.subCategoryId)
                                        .map((row) => {
                                            const rowCategory = categories.find(c => c.id === row.categoryId);
                                            const isCategoryMissing = !row.categoryId;
                                            const hasSubOptions = rowCategory?.descriptions && rowCategory.descriptions.length > 0;
                                            const isSubCategoryMissing = hasSubOptions && !row.subCategoryId;

                                            return (
                                                <tr key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${!row.isSelected ? 'opacity-50 grayscale' : ''}`}>
                                                    <td className="p-3 text-center align-middle">
                                                        <button onClick={() => toggleImportRowSelection(row.id)} className="text-pnr-purple">
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
                                                    {/* Category Select */}
                                                    <td className="p-2 align-middle">
                                                        <select
                                                            className={`w-full bg-white dark:bg-slate-800 border rounded p-1.5 focus:ring-1 focus:ring-pnr-purple ${isCategoryMissing ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'
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
                                                            className={`w-full bg-white dark:bg-slate-800 border rounded p-1.5 focus:ring-1 focus:ring-pnr-purple ${isSubCategoryMissing ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'
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
                                            )
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

            {/* MANUAL ADD MODAL */}
            {isManualModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-pnr-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                <Landmark size={20} className="text-pnr-purple" /> Yeni Vakıfbank Kaydı
                            </h3>
                            <button onClick={() => setIsManualModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-900" /></button>
                        </div>
                        <form onSubmit={handleManualSave} className="p-6 space-y-4">
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

                            <div className="grid grid-cols-2 gap-4">
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
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tutar (TL)</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm font-bold outline-none focus:ring-2 ${formData.type === 'income' ? 'text-green-600 focus:ring-green-500' : 'text-red-600 focus:ring-red-500'}`}
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            {formData.installments > 1 && formData.amount && (
                                <p className="text-xs text-slate-400 text-right font-mono">
                                    Aylık Ödeme: {formatCurrency(parseTurkishAmount(formData.amount) / formData.installments)}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-70 ${formData.type === 'income' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}
                            >
                                {loading ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Vakifbank;
