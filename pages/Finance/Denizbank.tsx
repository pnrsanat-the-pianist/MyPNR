
import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronLeft, ChevronRight, Plus, CreditCard, TrendingUp, TrendingDown, Search,
    Save, X, Upload, CheckSquare, Square, Trash2,
    FileText, AlertCircle, RefreshCcw, Tag, Calendar, Clock, Layers, Landmark, EyeOff, Download, Pencil
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
    category_id?: string;
    category_name: string;
    amount: number;
    description: string;
    installment_info?: string;
    is_invoiced?: boolean;
    notes?: string;
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
    isDuplicate?: boolean;
}

interface PersonSplitRow {
    id: string;
    categoryId: string;
    subCategoryId: string;
    amount: string;
}

interface RecordMetadata {
    subCategoryId?: string | null;
    targetMonth?: number;
    targetYear?: number;
    isPersonSplitParent?: boolean;
    isPersonSplitChild?: boolean;
    parentRecordId?: string;
}

const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

interface DenizbankProps {
    canEdit?: boolean;
}

const Denizbank: React.FC<DenizbankProps> = ({ canEdit = true }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [records, setRecords] = useState<BankRecord[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
    const [openingBalance, setOpeningBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Modals
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [hideCategorized, setHideCategorized] = useState(false);
    const [showFutureInstallments, setShowFutureInstallments] = useState(false);

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
        description: '',
        targetMonth: new Date().getMonth(),
        targetYear: new Date().getFullYear(),
        installments: 1,
        bulkPayments: 1,
        installmentInfo: '',
        personSplitEnabled: false,
        personSplitCount: 2,
        personSplitRows: [] as PersonSplitRow[]
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    const resetManualForm = () => {
        const today = new Date();
        setFormData({
            date: today.toISOString().split('T')[0],
            type: 'income',
            categoryId: '',
            subCategoryId: '',
            amount: '',
            description: '',
            targetMonth: today.getMonth(),
            targetYear: today.getFullYear(),
            installments: 1,
            bulkPayments: 1,
            installmentInfo: '',
            personSplitEnabled: false,
            personSplitCount: 2,
            personSplitRows: []
        });
        setEditingId(null);
    };

    // --- Helpers ---
    const formatCurrency = (amount: number) => {
        // Use Turkish locale to ensure "." is thousands and "," is decimal, matching the requested image exactly
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

    const parsePeriodText = (period: string) => {
        const [monthText, yearText] = period.split(/\s+/);
        const monthIndex = MONTH_NAMES.findIndex(month => month.toLocaleLowerCase('tr-TR') === (monthText || '').toLocaleLowerCase('tr-TR'));
        const yearValue = parseInt(yearText || '', 10);

        return monthIndex !== -1 && !isNaN(yearValue) ? { month: monthIndex, year: yearValue } : null;
    };

    const getRecordPeriodFromDescription = (description?: string) => {
        const parts = description ? description.split(' - ').map(part => part.trim()).filter(Boolean) : [];
        return parsePeriodText(parts[parts.length - 1] || '');
    };

    const getRecordMetadata = (record: Pick<BankRecord, 'notes'>) => {
        try {
            const metadata = JSON.parse(record.notes || '');
            return metadata && typeof metadata === 'object'
                ? metadata as RecordMetadata
                : {};
        } catch {
            return {};
        }
    };

    const isPersonSplitParent = (record: Pick<BankRecord, 'notes'>) => getRecordMetadata(record).isPersonSplitParent === true;

    const isPersonSplitChild = (record: Pick<BankRecord, 'notes'>) => getRecordMetadata(record).isPersonSplitChild === true;

    const getPersonSplitParentId = (record: Pick<BankRecord, 'notes'>) => getRecordMetadata(record).parentRecordId || '';

    const signedAmount = (record: Pick<BankRecord, 'type' | 'amount'>) => record.type === 'income' ? record.amount : -record.amount;

    const getRecordPeriodFromMetadata = (record: Pick<BankRecord, 'notes'>) => {
        const metadata = getRecordMetadata(record);
        return typeof metadata.targetMonth === 'number' && typeof metadata.targetYear === 'number'
            ? { month: metadata.targetMonth, year: metadata.targetYear }
            : null;
    };

    const getEffectiveInstallmentDate = (record: BankRecord) => {
        const installmentIndex = getInstallmentIndex(record.installment_info);
        if (!record.installment_info || installmentIndex <= 1) return record.date;

        const recordDate = new Date(record.date);
        const period = getRecordPeriodFromMetadata(record) || getRecordPeriodFromDescription(record.description);
        if (period && recordDate.getMonth() === period.month && recordDate.getFullYear() === period.year) {
            return record.date;
        }

        return getShiftedDate(record.date, installmentIndex - 1);
    };

    const isFutureInstallment = (record: BankRecord) => {
        const today = new Date().toISOString().split('T')[0];
        return !isPersonSplitChild(record) && !!record.installment_info && getEffectiveInstallmentDate(record) > today;
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

    // --- Data Fetching ---
    const fetchData = async () => {
        setLoading(true);
        const startOfYear = new Date(currentDate.getFullYear(), 0, 1).toISOString();
        const endOfYear = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59).toISOString();

        try {
            // 1. Fetch Categories with Descriptions
            const formattedCategories = await fetchFinanceCategories();
            setCategories(formattedCategories);

            // 2. Fetch Automation Rules
            const { data: ruleData } = await supabase.from('category_automation_rules').select('*');
            setAutomationRules(ruleData || []);

            let calculatedOpening = 0;
            const { data: allPrevRecords } = await supabase
                .from('denizbank_book')
                .select('amount, type, date, installment_info, notes')
                .lt('date', startOfYear);

            if (allPrevRecords) {
                calculatedOpening = allPrevRecords.reduce((acc, curr) => {
                    if (isPersonSplitChild(curr)) return acc;
                    if (curr.installment_info && curr.date > new Date().toISOString().split('T')[0]) return acc;
                    return acc + signedAmount(curr);
                }, 0);
            }
            setOpeningBalance(calculatedOpening);

            // 3. Fetch Selected Year Transactions
            const { data: recordData, error } = await supabase
                .from('denizbank_book')
                .select('*')
                .gte('date', startOfYear)
                .lte('date', endOfYear)
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

    // Robust parser for Turkish currency strings like "-1.250,50 TL" or "1.250,50-"
    const parseTurkishAmount = (val: any): number => {
        if (val === undefined || val === null) return 0;
        if (typeof val === 'number') return val;
        if (typeof val !== 'string') return 0;

        let str = val.trim();
        if (!str) return 0;

        const isNegative = str.startsWith('-') || str.endsWith('-') || (str.startsWith('(') && str.endsWith(')'));

        // Handle symbols like "TL", spaces, etc.
        let clean = str.replace(/[^0-9,.]/g, '');

        if (clean.includes(',') && clean.includes('.')) {
            // Both exist. Assume the last one is decimal.
            if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
                // Turkish: 1.234,56
                clean = clean.replace(/\./g, '').replace(',', '.');
            } else {
                // English: 1,234.56
                clean = clean.replace(/,/g, '');
            }
        } else if (clean.includes(',')) {
            // Only comma -> Decimal
            clean = clean.replace(',', '.');
        } else if (clean.includes('.')) {
            // Only dot. Check if it looks like thousands or decimal
            const parts = clean.split('.');
            const lastPart = parts[parts.length - 1];
            if (lastPart.length === 3) {
                clean = clean.replace(/\./g, ''); // Treat as thousands
            } else {
                // Treat as decimal (Keep the dot)
            }
        }

        let num = parseFloat(clean);
        if (isNaN(num)) return 0;

        return isNegative ? -num : num;
    };

    const normalizeDuplicateText = (value: string) => value.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();

    const buildPersonSplitRows = (count: number, existingRows: PersonSplitRow[] = []) => {
        const safeCount = Math.max(1, count || 1);
        const totalAmount = Math.abs(parseTurkishAmount(formData.amount));
        const baseAmount = totalAmount > 0 ? Math.floor((totalAmount / safeCount) * 100) / 100 : 0;
        const remainder = totalAmount > 0 ? Number((totalAmount - (baseAmount * safeCount)).toFixed(2)) : 0;

        return Array.from({ length: safeCount }, (_, index) => {
            const existing = existingRows[index];
            const amount = index === safeCount - 1 ? baseAmount + remainder : baseAmount;

            return existing || {
                id: `${Date.now()}-${index}`,
                categoryId: '',
                subCategoryId: '',
                amount: amount > 0 ? Number(amount.toFixed(2)).toString() : ''
            };
        });
    };

    const updatePersonSplitRow = (rowId: string, updates: Partial<PersonSplitRow>) => {
        setFormData(prev => ({
            ...prev,
            personSplitRows: prev.personSplitRows.map(row => row.id === rowId ? { ...row, ...updates } : row)
        }));
    };

    const setPersonSplitCount = (count: number) => {
        const safeCount = Math.max(1, count || 1);
        setFormData(prev => ({
            ...prev,
            personSplitCount: safeCount,
            personSplitRows: buildPersonSplitRows(safeCount, prev.personSplitRows)
        }));
    };

    const togglePersonSplit = () => {
        setFormData(prev => {
            const enabled = !prev.personSplitEnabled;
            return {
                ...prev,
                personSplitEnabled: enabled,
                categoryId: enabled ? '' : prev.categoryId,
                subCategoryId: enabled ? '' : prev.subCategoryId,
                installments: enabled ? 1 : prev.installments,
                bulkPayments: enabled ? 1 : prev.bulkPayments,
                personSplitRows: enabled ? buildPersonSplitRows(prev.personSplitCount, prev.personSplitRows) : []
            };
        });
    };

    const getExpectedImportDate = (row: Pick<ImportedRow, 'date' | 'targetMonth' | 'targetYear'>) => {
        const transDay = new Date(row.date).getDate();
        const daysInMonth = new Date(row.targetYear, row.targetMonth + 1, 0).getDate();
        const finalDay = Math.min(transDay, daysInMonth);
        return new Date(Date.UTC(row.targetYear, row.targetMonth, finalDay)).toISOString().split('T')[0];
    };

    const isDuplicateImportRow = (row: ImportedRow, record: BankRecord) => {
        const rowDescription = normalizeDuplicateText(row.description);
        const recordDescription = normalizeDuplicateText(record.description || '');
        const descriptionsMatch = recordDescription === rowDescription
            || recordDescription.startsWith(`${rowDescription} - `)
            || rowDescription.startsWith(`${recordDescription} - `);

        return String(record.date).split('T')[0] === getExpectedImportDate(row)
            && record.type === row.type
            && Math.abs(Number(record.amount) - row.amount) < 0.01
            && descriptionsMatch;
    };

    const markDuplicateImportRows = async (rows: ImportedRow[]) => {
        const expectedDates = rows.map(getExpectedImportDate).sort();
        if (expectedDates.length === 0) return rows;

        const { data, error } = await supabase
            .from('denizbank_book')
            .select('id, date, type, amount, description, category_name')
            .gte('date', expectedDates[0])
            .lte('date', expectedDates[expectedDates.length - 1]);

        if (error) throw error;

        const existingRecords = (data || []) as BankRecord[];
        const rowsWithDuplicateStatus = rows.map(row => {
            const isDuplicate = existingRecords.some(record => isDuplicateImportRow(row, record));
            return { ...row, isDuplicate, isSelected: isDuplicate ? false : row.isSelected };
        });
        const duplicateCount = rowsWithDuplicateStatus.filter(row => row.isDuplicate).length;

        if (duplicateCount > 0) {
            alert(`${duplicateCount} satır daha önce kaydedilmiş görünüyor. Bu satırlar seçili gelmedi ve aktarılmayacak.`);
        }

        return rowsWithDuplicateStatus;
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
                    // Removed 'raw: false' to allow numeric cells to come through as actual numbers
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

                    // Heuristic search for headers in first 15 rows (increased range)
                    for (let i = 0; i < Math.min(data.length, 15); i++) {
                        const row = data[i];
                        row.forEach((cell: any, idx: number) => {
                            if (typeof cell !== 'string') return;
                            const normalized = cell.toLowerCase().trim();

                            // 1. Date Detection
                            if (normalized.includes('tarih')) dateIdx = idx;

                            // 2. Description Detection
                            if (normalized.includes('açıklama') || normalized.includes('aciklama')) descIdx = idx;
                            if (normalized === 'tip' || normalized === 'tür' || normalized === 'tur') typeIdx = idx;
                            if (normalized === 'kategori') categoryIdx = idx;
                            if (normalized.includes('alt kategori')) subCategoryIdx = idx;
                            if (normalized === 'dönem' || normalized === 'donem') periodIdx = idx;
                            if (normalized.includes('taksit')) installmentIdx = idx;

                            // 3. Amount Detection (Priority: Tutar/İşlem Tutarı, Excluding Bakiye/Güncel)
                            const isBakiye = normalized.includes('bakıye') || normalized.includes('bakiye') || normalized.includes('güncel') || normalized.includes('guncel');

                            if ((normalized.includes('tutar') || normalized.includes('borç') || normalized.includes('alacak')) && !isBakiye) {
                                // Prefer "tutar (tl)" or exact "tutar" if multiple found
                                if (amountIdx === -1 || normalized === 'tutar' || normalized.includes('(tl)')) {
                                    amountIdx = idx;
                                }
                            }

                            // 4. Bakiye Detection (to EXCLUDE it from fallback)
                            if (isBakiye) {
                                bakiyeIdx = idx;
                            }
                        });
                        // Stop if we have found the critical identifying columns
                        if (dateIdx !== -1 && amountIdx !== -1) break;
                    }

                    data.forEach((row, idx) => {
                        if (row.length === 0) return;

                        // 1. Find Date Cell
                        let dateCellIndex = dateIdx;
                        if (dateCellIndex === -1 || !row[dateCellIndex]) {
                            // Fallback: search for date-like value in row
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

                        // 2. Find Amount Cell
                        let amount = 0;
                        let amountFound = false;

                        // Check specific column first if identified
                        if (amountIdx !== -1 && row[amountIdx]) {
                            amount = parseTurkishAmount(row[amountIdx]);
                            if (amount !== 0) amountFound = true;
                        }

                        // Fallback: search row for numbers if column not identified or explicitly empty
                        if (!amountFound) {
                            // Iterate backwards, usually amount is towards end
                            for (let i = row.length - 1; i >= 0; i--) {
                                // Skip identified non-amount columns (date, description, and specifically bakiye)
                                if ([dateCellIndex, bakiyeIdx, descIdx, typeIdx, categoryIdx, subCategoryIdx, periodIdx, installmentIdx].includes(i)) continue;

                                const val = parseTurkishAmount(row[i]);
                                if (val !== 0) {
                                    amount = val;
                                    amountFound = true;
                                    break;
                                }
                            }
                        }

                        const desc = descIdx !== -1 && row[descIdx] ? String(row[descIdx]).trim() : '';

                        if (amountFound && amount !== 0) {
                            // Rules: 
                            // - Amount > 0 -> Income
                            // - Amount < 0 -> Expense
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
                                description: desc,
                                amount: Math.abs(amount), // Store absolute value
                                type: type, // Sign determines type
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
                        const checkedRows = await markDuplicateImportRows(parsedRows);
                        setImportedRows(checkedRows);
                        setIsUploadModalOpen(true);
                    } else {
                        alert("Dosyadan anlamlı veri okunamadı. Lütfen standart Denizbank Excel/CSV formatını kontrol edin.");
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
                // Reset subCategory if category changes
                if (field === 'categoryId') {
                    return { ...r, [field]: value, subCategoryId: '' };
                }
                // Reset category if type changes
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
        const bulkCat = categories.find(c => c.id === bulkCategory);
        if (bulkCat && bulkCat.descriptions.length > 0 && !bulkSubCategory) {
            alert('Lütfen alt kategori seçiniz.');
            return;
        }
        setImportedRows(prev => prev.map(r => r.isSelected ? { ...r, categoryId: bulkCategory, subCategoryId: bulkSubCategory } : r));
    };

    const toggleImportRowSelection = (id: string) => {
        setImportedRows(prev => prev.map(r => r.id === id && !r.isDuplicate ? { ...r, isSelected: !r.isSelected } : r));
    };

    const confirmImport = async () => {
        if (!canEdit) return;
        const selectedRows = importedRows.filter(r => r.isSelected && !r.isDuplicate);
        if (selectedRows.length === 0) return;

        const missingCategory = selectedRows.filter(r => !r.categoryId);
        if (missingCategory.length > 0) {
            alert(`Lütfen işaretli ${missingCategory.length} satırdaki kategoriyi seçiniz.`);
            return;
        }

        const missingSubCategory = selectedRows.filter(r => {
            const cat = categories.find(c => c.id === r.categoryId);
            return cat && cat.descriptions.length > 0 && !r.subCategoryId;
        });
        if (missingSubCategory.length > 0) {
            alert(`Lütfen işaretli ${missingSubCategory.length} satırdaki alt kategoriyi seçiniz.`);
            return;
        }

        setLoading(true);
        try {
            const dbRows: any[] = [];

            selectedRows.forEach(row => {
                const category = categories.find(c => c.id === row.categoryId);
                const catName = category?.title || 'Diğer';

                const totalAmount = row.amount;
                const installments = Math.max(1, row.installments);

                // Calculate precise split
                const baseAmount = Math.floor((totalAmount / installments) * 100) / 100;
                const remainder = Number((totalAmount - (baseAmount * installments)).toFixed(2));

                for (let i = 0; i < installments; i++) {
                    // Calculate Year and Month based on Target
                    let targetY = row.targetYear;
                    let targetM = row.targetMonth + i;

                    // Handle Year Overflow
                    targetY += Math.floor(targetM / 12);
                    targetM = targetM % 12;

                    const finalDesc = row.description.trim();

                    // Add remainder to the last installment
                    let installmentAmount = baseAmount;
                    if (i === installments - 1) {
                        installmentAmount += remainder;
                    }

                    dbRows.push({
                        date: getShiftedDate(row.date, i),
                        description: finalDesc,
                        amount: Number(installmentAmount.toFixed(2)),
                        type: row.type,
                        category_id: row.categoryId,
                        category_name: catName,
                        installment_info: row.installmentInfo || (installments > 1 ? `${i + 1}/${installments}` : null),
                        notes: JSON.stringify({ subCategoryId: row.subCategoryId || null, targetMonth: targetM, targetYear: targetY })
                    });
                }
            });

            const { error } = await supabase.from('denizbank_book').insert(dbRows);
            if (error) throw error;

            setIsUploadModalOpen(false);
            setImportedRows([]);
            fetchData();
            alert(`${dbRows.length} adet kayıt (taksitler dahil) başarıyla oluşturuldu.`);

        } catch (err: any) {
            alert("Hata: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Manual Add Handlers ---
    const handleManualSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit || !formData.amount || (!formData.personSplitEnabled && !formData.categoryId)) return;

        setLoading(true);
        try {
            const cat = categories.find(c => c.id === formData.categoryId);
            if (!formData.personSplitEnabled && cat && cat.descriptions.length > 0 && !formData.subCategoryId) {
                alert('Lütfen alt kategori seçiniz.');
                return;
            }

            if (formData.personSplitEnabled) {
                const invalidSplitRows = formData.personSplitRows.filter(row => {
                    const rowCategory = categories.find(c => c.id === row.categoryId);
                    return !row.categoryId
                        || !row.amount
                        || parseTurkishAmount(row.amount) <= 0
                        || (rowCategory && rowCategory.descriptions.length > 0 && !row.subCategoryId);
                });

                if (invalidSplitRows.length > 0) {
                    alert('Lütfen kişi satırlarında kategori, alt kategori ve tutar alanlarını doldurunuz.');
                    return;
                }

                const splitTotal = formData.personSplitRows.reduce((acc, row) => acc + Math.abs(parseTurkishAmount(row.amount)), 0);
                const expectedTotal = Math.abs(parseTurkishAmount(formData.amount));
                if (Math.abs(splitTotal - expectedTotal) > 0.01) {
                    alert(`Kişilere bölünen toplam (${formatCurrency(splitTotal)}) ana tutarla (${formatCurrency(expectedTotal)}) aynı olmalıdır.`);
                    return;
                }
            }

            const totalAmount = Math.abs(parseTurkishAmount(formData.amount));
            const installments = Math.max(1, formData.installments);
            const bulkPayments = Math.max(1, formData.bulkPayments);
            const splitCount = bulkPayments > 1 ? bulkPayments : installments;
            const isBulkPayment = bulkPayments > 1;
            const baseAmount = Math.floor((totalAmount / splitCount) * 100) / 100;
            const remainder = Number((totalAmount - (baseAmount * splitCount)).toFixed(2));

            const buildSplitRows = () => {
                const splitRows: any[] = [];

                for (let i = 0; i < splitCount; i++) {
                    let targetY = formData.targetYear;
                    let targetM = formData.targetMonth + i;

                    targetY += Math.floor(targetM / 12);
                    targetM = targetM % 12;

                    const description = formData.description;
                    const amount = i === splitCount - 1 ? baseAmount + remainder : baseAmount;

                    splitRows.push({
                        date: isBulkPayment ? formData.date : getShiftedDate(formData.date, i),
                        type: formData.type,
                        category_id: formData.categoryId,
                        category_name: cat?.title || '',
                        amount: Number(amount.toFixed(2)),
                        description,
                        installment_info: !isBulkPayment && splitCount > 1 ? `${i + 1}/${splitCount}` : null,
                        notes: JSON.stringify({ subCategoryId: formData.subCategoryId || null, targetMonth: targetM, targetYear: targetY })
                    });
                }

                return splitRows;
            };

            const buildPersonSplitChildRows = (parentRecordId: string) => formData.personSplitRows.map(row => {
                const rowCategory = categories.find(c => c.id === row.categoryId);

                return {
                    date: formData.date,
                    type: formData.type,
                    category_id: row.categoryId,
                    category_name: rowCategory?.title || '',
                    amount: Number(Math.abs(parseTurkishAmount(row.amount)).toFixed(2)),
                    description: formData.description,
                    installment_info: null,
                    notes: JSON.stringify({
                        subCategoryId: row.subCategoryId || null,
                        targetMonth: formData.targetMonth,
                        targetYear: formData.targetYear,
                        isPersonSplitChild: true,
                        parentRecordId
                    })
                };
            });

            const deletePersonSplitChildren = async (parentRecordId: string) => {
                const childIds = records.filter(record => getPersonSplitParentId(record) === parentRecordId).map(record => record.id);
                if (childIds.length === 0) return;

                const { error } = await supabase.from('denizbank_book').delete().in('id', childIds);
                if (error) throw error;
            };

            if (formData.personSplitEnabled) {
                const parentRow = {
                    date: formData.date,
                    type: formData.type,
                    category_id: null,
                    category_name: '',
                    amount: Number(totalAmount.toFixed(2)),
                    description: formData.description,
                    installment_info: null,
                    notes: JSON.stringify({
                        targetMonth: formData.targetMonth,
                        targetYear: formData.targetYear,
                        isPersonSplitParent: true
                    })
                };

                if (editingId) {
                    const { error: updateError } = await supabase
                        .from('denizbank_book')
                        .update(parentRow)
                        .eq('id', editingId);
                    if (updateError) throw updateError;

                    await deletePersonSplitChildren(editingId);
                    const { error: insertError } = await supabase.from('denizbank_book').insert(buildPersonSplitChildRows(editingId));
                    if (insertError) throw insertError;
                } else {
                    const { data: insertedParent, error: parentError } = await supabase
                        .from('denizbank_book')
                        .insert(parentRow)
                        .select('id')
                        .single();
                    if (parentError) throw parentError;

                    const { error: insertError } = await supabase.from('denizbank_book').insert(buildPersonSplitChildRows(insertedParent.id));
                    if (insertError) throw insertError;
                }
            } else if (editingId) {
                await deletePersonSplitChildren(editingId);

                const [firstRow, ...extraRows] = buildSplitRows();
                const { error: updateError } = await supabase
                    .from('denizbank_book')
                    .update(firstRow)
                    .eq('id', editingId);

                if (updateError) throw updateError;

                if (extraRows.length > 0) {
                    const { error: insertError } = await supabase.from('denizbank_book').insert(extraRows);
                    if (insertError) throw insertError;
                }
            } else {
                const { error } = await supabase.from('denizbank_book').insert(buildSplitRows());

                if (error) throw error;
            }

            setIsManualModalOpen(false);
            resetManualForm();
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
            const idsToDelete = [id, ...records.filter(record => getPersonSplitParentId(record) === id).map(record => record.id)];
            const { error } = await supabase.from('denizbank_book').delete().in('id', idsToDelete);
            if (error) throw error;
            setRecords(prev => prev.filter(r => !idsToDelete.includes(r.id)));
            setSelectedIds(prev => {
                const next = new Set(prev);
                idsToDelete.forEach(recordId => next.delete(recordId));
                return next;
            });
        } catch (err: any) {
            alert("Silinemedi: " + err.message);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === selectableRecords.length && selectableRecords.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(selectableRecords.map(r => r.id)));
        }
    };

    const toggleSelectRecord = (id: string) => {
        const record = records.find(item => item.id === id);
        if (record && isPersonSplitChild(record)) return;

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
            const ids = Array.from(new Set(Array.from(selectedIds).flatMap(id => [
                id,
                ...records.filter(record => getPersonSplitParentId(record) === id).map(record => record.id)
            ])));
            const { error } = await supabase.from('denizbank_book').delete().in('id', ids);
            if (error) throw error;
            setRecords(prev => prev.filter(r => !ids.includes(r.id)));
            setSelectedIds(new Set());
        } catch (err: any) {
            alert("Toplu silme hatası: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Stats
    const futureInstallmentRecords = records.filter(isFutureInstallment);
    const settledRecords = records.filter(record => !isFutureInstallment(record));
    const balanceRecords = settledRecords.filter(record => !isPersonSplitChild(record));
    const futureInstallmentTotal = futureInstallmentRecords.reduce((acc, record) => acc + signedAmount(record), 0);
    const totalIncome = balanceRecords.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
    const totalExpense = balanceRecords.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
    const balance = openingBalance + totalIncome - totalExpense;

    const filteredRecords = settledRecords.filter(r => {
        const normalizedSearch = searchTerm.toLowerCase();
        return r.description.toLowerCase().includes(normalizedSearch) ||
            r.category_name.toLowerCase().includes(normalizedSearch);
    }
    );

    const filteredRecordIds = new Set(filteredRecords.map(record => record.id));
    const matchedChildParentIds = new Set(filteredRecords.filter(isPersonSplitChild).map(getPersonSplitParentId));
    const splitChildrenByParentId = settledRecords
        .filter(isPersonSplitChild)
        .reduce((acc, child) => {
            const parentId = getPersonSplitParentId(child);
            if (!parentId) return acc;
            acc.set(parentId, [...(acc.get(parentId) || []), child]);
            return acc;
        }, new Map<string, BankRecord[]>());
    const topLevelFilteredRecords = settledRecords.filter(record =>
        !isPersonSplitChild(record) && (filteredRecordIds.has(record.id) || matchedChildParentIds.has(record.id))
    );
    const selectableRecords = topLevelFilteredRecords;

    const selectedCategory = categories.find(c => c.id === formData.categoryId);

    const getDescriptionParts = (description: string) => description
        ? description.split(' - ').map(part => part.trim()).filter(Boolean)
        : [];

    const getRecordCategory = (record: BankRecord) => categories.find(c => record.category_id && c.id === record.category_id)
        || categories.find(c => normalizeDottedIForCompare(c.title) === normalizeDottedIForCompare(record.category_name));

    const getRecordSubCategoryDisplay = (record: BankRecord) => {
        if (isPersonSplitParent(record)) return '';

        const descriptionParts = getDescriptionParts(record.description);
        const category = getRecordCategory(record);
        const metadata = getRecordMetadata(record);
        const metadataSubCategory = metadata.subCategoryId
            ? category?.descriptions.find(desc => desc.id === metadata.subCategoryId)
            : undefined;
        if (metadataSubCategory) return metadataSubCategory.description;

        const subCategory = category?.descriptions.find(desc =>
            descriptionParts.some(part => normalizeDottedIForCompare(part) === normalizeDottedIForCompare(desc.description))
        );

        return subCategory?.description || descriptionParts[0] || '';
    };

    const getRecordDescriptionDisplay = (record: BankRecord) => record.description || '';

    const getRecordPeriodDisplay = (record: BankRecord) => {
        const period = getRecordPeriodFromMetadata(record) || getRecordPeriodFromDescription(record.description);
        return period ? `${MONTH_NAMES[period.month]} ${period.year}` : '';
    };

    const getRecordTargetPeriod = (record: BankRecord) => {
        const metadataPeriod = getRecordPeriodFromMetadata(record);
        if (metadataPeriod) {
            return { targetMonth: metadataPeriod.month, targetYear: metadataPeriod.year };
        }

        const descriptionParts = getDescriptionParts(record.description);
        const periodText = descriptionParts[descriptionParts.length - 1] || '';
        const descriptionPeriod = parsePeriodText(periodText);

        if (descriptionPeriod) {
            return { targetMonth: descriptionPeriod.month, targetYear: descriptionPeriod.year };
        }

        const recordDate = new Date(record.date);
        return {
            targetMonth: isNaN(recordDate.getTime()) ? new Date().getMonth() : recordDate.getMonth(),
            targetYear: isNaN(recordDate.getTime()) ? new Date().getFullYear() : recordDate.getFullYear()
        };
    };

    const isInvoiceEligible = (record: BankRecord) =>
        !isPersonSplitParent(record)
        && !isPersonSplitChild(record)
        && record.type === 'income'
        && !!record.category_name
        && normalizeDottedIForCompare(record.category_name).toLocaleLowerCase('tr-TR') !== normalizeDottedIForCompare('Hesaplar Arası').toLocaleLowerCase('tr-TR')
        && normalizeDottedIForCompare(getRecordSubCategoryDisplay(record)).toLocaleLowerCase('tr-TR') !== normalizeDottedIForCompare('Hesaplar Arası').toLocaleLowerCase('tr-TR');

    const handleInvoiceToggle = async (record: BankRecord, isInvoiced: boolean) => {
        if (!canEdit || !isInvoiceEligible(record)) return;

        setRecords(prev => prev.map(item => item.id === record.id ? { ...item, is_invoiced: isInvoiced } : item));

        const { error } = await supabase
            .from('denizbank_book')
            .update({ is_invoiced: isInvoiced })
            .eq('id', record.id);

        if (error) {
            setRecords(prev => prev.map(item => item.id === record.id ? { ...item, is_invoiced: record.is_invoiced } : item));
            alert('Fatura durumu güncellenemedi: ' + error.message);
        }
    };

    const handleEdit = (record: BankRecord) => {
        if (!canEdit || isPersonSplitChild(record)) return;
        const category = getRecordCategory(record);
        const subCategoryDisplay = getRecordSubCategoryDisplay(record);
        const subCategory = category?.descriptions.find(desc => normalizeDottedIForCompare(desc.description) === normalizeDottedIForCompare(subCategoryDisplay));
        const { targetMonth, targetYear } = getRecordTargetPeriod(record);
        const personSplitRows = records
            .filter(item => getPersonSplitParentId(item) === record.id)
            .map(item => {
                const itemCategory = getRecordCategory(item);
                const itemSubCategoryDisplay = getRecordSubCategoryDisplay(item);
                const itemSubCategory = itemCategory?.descriptions.find(desc => normalizeDottedIForCompare(desc.description) === normalizeDottedIForCompare(itemSubCategoryDisplay));

                return {
                    id: item.id,
                    categoryId: item.category_id || itemCategory?.id || '',
                    subCategoryId: itemSubCategory?.id || '',
                    amount: item.amount.toString()
                };
            });

        setFormData({
            date: record.date,
            type: record.type,
            categoryId: record.category_id || category?.id || '',
            subCategoryId: subCategory?.id || '',
            amount: record.amount.toString(),
            description: record.description || '',
            targetMonth,
            targetYear,
            installments: 1,
            bulkPayments: 1,
            installmentInfo: record.installment_info || '',
            personSplitEnabled: isPersonSplitParent(record) || personSplitRows.length > 0,
            personSplitCount: Math.max(2, personSplitRows.length || 2),
            personSplitRows
        });
        setEditingId(record.id);
        setIsManualModalOpen(true);
    };

    const displayedRecords = [...topLevelFilteredRecords]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .flatMap(record => [record, ...(splitChildrenByParentId.get(record.id) || [])]);

    let runningBalance = openingBalance;
    const balanceByRecordId = new Map<string, number>();
    for (let i = displayedRecords.length - 1; i >= 0; i--) {
        const record = displayedRecords[i];
        if (isPersonSplitChild(record)) continue;
        runningBalance += signedAmount(record);
        balanceByRecordId.set(record.id, runningBalance);
    }

    const handleDownloadExcel = () => {
        const exportRows = displayedRecords.map(record => {
            const subCategoryDisplay = getRecordSubCategoryDisplay(record);
            const periodDisplay = getRecordPeriodDisplay(record);

            return {
                Fatura: isInvoiceEligible(record) ? (record.is_invoiced ? 'Evet' : 'Hayır') : '',
                Tarih: record.date,
                Açıklama: getRecordDescriptionDisplay(record),
                Kategori: record.category_name,
                'Alt Kategori': subCategoryDisplay,
                Dönem: periodDisplay,
                Taksit: record.installment_info || '',
                Tutar: record.type === 'income' ? record.amount : -record.amount,
                Bakiye: balanceByRecordId.get(record.id) ?? 0,
                İşlem: ''
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Denizbank');
        XLSX.writeFile(workbook, `denizbank-${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-pnr-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-800">
                        <Landmark size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Denizbank</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={handlePrevYear} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ChevronLeft size={22} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <div className="text-center min-w-24">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{currentDate.getFullYear()} Yılı</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Denizbank</p>
                    </div>
                    <button onClick={handleNextYear} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ChevronRight size={22} className="text-slate-600 dark:text-slate-300" />
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right hidden md:block">
                        <div className="text-xs text-slate-500 uppercase font-bold">Devreden Bakiye</div>
                        <div className={`font-mono font-bold ${openingBalance >= 0 ? 'text-slate-700 dark:text-slate-300' : 'text-red-600'}`}>
                            {formatCurrency(openingBalance)}
                        </div>
                    </div>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

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
                            onClick={() => { resetManualForm(); setIsManualModalOpen(true); }}
                            className="bg-pnr-purple hover:bg-pnr-indigo text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-pnr-purple/20 flex items-center gap-2 transition-transform active:scale-95"
                        >
                            <Plus size={20} /> Yeni Kayıt
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Toplam Bakiye</span>
                    <div className={`text-3xl font-bold font-mono ${balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                        {formatCurrency(balance)}
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
                <button
                    type="button"
                    onClick={() => setShowFutureInstallments(prev => !prev)}
                    className={`text-left border p-5 rounded-2xl flex flex-col transition-colors ${showFutureInstallments ? 'bg-amber-100 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/20'}`}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar size={16} className="text-amber-600" />
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Gelecek Taksit</span>
                    </div>
                    <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">{formatCurrency(futureInstallmentTotal)}</div>
                </button>
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
                                    <th className="p-3">Açıklama</th>
                                    <th className="p-3">Kategori</th>
                                    <th className="p-3 text-center">Taksit</th>
                                    <th className="p-3 text-right">Tutar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {futureInstallmentRecords.length === 0 ? (
                                    <tr><td colSpan={6} className="p-6 text-center text-slate-400">Gelecek taksit bulunmuyor.</td></tr>
                                ) : [...futureInstallmentRecords].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(record => (
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
                                        <td className="finance-description-cell p-3 text-slate-700 dark:text-slate-300 w-64 max-w-64" data-tooltip={getRecordDescriptionDisplay(record)} title={getRecordDescriptionDisplay(record)}>
                                            <span className="finance-description-text">{getRecordDescriptionDisplay(record)}</span>
                                        </td>
                                        <td className="p-3 text-slate-700 dark:text-slate-300">{record.category_name}</td>
                                        <td className="p-3 text-center font-mono text-slate-500">{record.installment_info}</td>
                                        <td className={`p-3 text-right font-bold ${record.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{record.type === 'income' ? '+' : '-'}{formatCurrency(record.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Main Table */}
            <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-500">Yükleniyor...</div>
                ) : (
                    <div className="overflow-x-auto sm:overflow-visible">
                        <table className="w-full text-left border-collapse table-fixed text-xs sm:text-sm">
                            <colgroup>
                                <col className="w-8 sm:w-12" />
                                <col className="w-[17%] sm:w-[11%]" />
                                <col className="hidden md:table-column md:w-[15%]" />
                                <col className="w-[20%] sm:w-[13%]" />
                                <col className="w-[20%] sm:w-[15%]" />
                                <col className="hidden md:table-column md:w-[10%]" />
                                <col className="hidden lg:table-column lg:w-[7%]" />
                                <col className="w-[19%] sm:w-[12%]" />
                                <col className="hidden md:table-column md:w-[10%]" />
                                <col className="w-10 sm:w-12" />
                                <col className="w-[10%] sm:w-[6%]" />
                            </colgroup>
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase">
                                    <th className="p-2 sm:p-4">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-pnr-purple focus:ring-pnr-purple"
                                            checked={selectedIds.size === selectableRecords.length && selectableRecords.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="p-2 sm:p-4 text-[10px] sm:text-xs">Tarih</th>
                                    <th className="hidden md:table-cell p-2 sm:p-4">Açıklama</th>
                                    <th className="p-2 sm:p-4 text-[10px] sm:text-xs">Kategori</th>
                                    <th className="p-2 sm:p-4 text-[10px] sm:text-xs">Alt Kategori</th>
                                    <th className="hidden md:table-cell p-2 sm:p-4">Dönem</th>
                                    <th className="hidden lg:table-cell p-2 sm:p-4 text-center">Taksit</th>
                                    <th className="p-2 sm:p-4 text-[10px] sm:text-xs text-right">Tutar</th>
                                    <th className="hidden md:table-cell p-2 sm:p-4 text-right">Bakiye</th>
                                    <th className="p-2 sm:p-4 text-[10px] sm:text-xs text-center">Fatura</th>
                                    <th className="p-2 sm:p-4 text-[10px] sm:text-xs text-center">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                <tr className="bg-slate-50/50 dark:bg-slate-900/30 italic text-slate-500">
                                    <td className="p-2 sm:p-4"></td>
                                    <td className="p-2 sm:p-4 text-xs" colSpan={6}>Devreden Bakiye</td>
                                    <td className="p-2 sm:p-4 text-xs sm:text-sm font-mono font-bold text-right">{formatCurrency(openingBalance)}</td>
                                    <td className="hidden md:table-cell p-2 sm:p-4"></td>
                                    <td className="p-2 sm:p-4"></td>
                                    <td className="p-2 sm:p-4"></td>
                                </tr>

                                {displayedRecords.length > 0 ? (
                                    displayedRecords.map((record, index) => {
                                        const isIncome = record.type === 'income';
                                        const isSplitParent = isPersonSplitParent(record);
                                        const isSplitChild = isPersonSplitChild(record);
                                        const subCategoryDisplay = getRecordSubCategoryDisplay(record) || '-';
                                        const periodDisplay = getRecordPeriodDisplay(record) || '-';
                                        const descriptionDisplay = getRecordDescriptionDisplay(record);
                                        const rowBalance = balanceByRecordId.get(record.id) ?? 0;
                                        const currentDateObj = new Date(record.date);
                                        const currentMonth = currentDateObj.getMonth();
                                        const previousRecord = displayedRecords[index - 1];
                                        const previousDateObj = previousRecord ? new Date(previousRecord.date) : null;
                                        const isLatestMonthRow = !searchTerm && (!previousDateObj || previousDateObj.getMonth() !== currentMonth || previousDateObj.getFullYear() !== currentDateObj.getFullYear());

                                        return (
                                            <React.Fragment key={record.id}>
                                                <tr className={`transition-colors ${isSplitChild ? 'bg-violet-50/70 dark:bg-violet-950/20 border-l-4 border-l-violet-300 dark:border-l-violet-700' : selectedIds.has(record.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : isLatestMonthRow ? 'bg-slate-100 dark:bg-slate-800/70 border-l-4 border-l-slate-400 dark:border-l-slate-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
                                                    <td className="p-2 sm:p-4">
                                                        {!isSplitChild && (
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-300 text-pnr-purple focus:ring-pnr-purple"
                                                                checked={selectedIds.has(record.id)}
                                                                onChange={() => toggleSelectRecord(record.id)}
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="p-2 sm:p-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-mono break-words">
                                                        {formatDate(record.date)}
                                                    </td>
                                                    <td className="finance-description-cell hidden md:table-cell p-2 sm:p-4 text-slate-700 dark:text-slate-300" data-tooltip={descriptionDisplay} title={descriptionDisplay}>
                                                        <span className="finance-description-text">{descriptionDisplay}</span>
                                                    </td>
                                                    <td className="p-2 sm:p-4">
                                                        <span className={`inline-block max-w-full break-words text-[10px] sm:text-xs px-1.5 sm:px-2 py-1 rounded border ${isIncome
                                                            ? 'bg-green-50 text-green-700 border-green-200'
                                                            : 'bg-red-50 text-red-700 border-red-200'
                                                            }`}>
                                                            {isSplitParent ? '-' : record.category_name}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 sm:p-4 text-xs sm:text-sm font-medium text-slate-900 dark:text-white break-words">
                                                        {isSplitParent ? '-' : subCategoryDisplay}
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
                                                    <td className="hidden md:table-cell p-2 sm:p-4 text-right font-mono text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                                                        {isSplitChild ? '-' : formatCurrency(rowBalance)}
                                                    </td>
                                                    <td className="p-2 sm:p-4 text-center">
                                                        {isInvoiceEligible(record) ? (
                                                            <input
                                                                type="checkbox"
                                                                checked={!!record.is_invoiced}
                                                                onChange={(e) => handleInvoiceToggle(record, e.target.checked)}
                                                                disabled={!canEdit}
                                                                className="h-4 w-4 appearance-none rounded border-2 border-red-600 bg-red-100 transition-colors checked:border-green-600 checked:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
                                                                title={record.is_invoiced ? 'Fatura işaretli' : 'Fatura işaretli değil'}
                                                            />
                                                        ) : null}
                                                    </td>
                                                    <td className="p-2 sm:p-4 text-center">
                                                        {canEdit && !isSplitChild && (
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
                                ) : (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center text-slate-400 text-sm">
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
                                <FileText size={20} className="text-pnr-purple" /> Dosya Önizleme ve Düzenleme (Denizbank)
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
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    Seçililere Alt Kategori Ata
                                    {(categories.find(c => c.id === bulkCategory)?.descriptions?.length || 0) > 0 && (
                                        <span className="text-red-500 ml-1">*</span>
                                    )}
                                </label>
                                <select
                                    className={`w-full bg-white dark:bg-slate-800 border rounded-lg p-2 text-xs dark:text-white ${(categories.find(c => c.id === bulkCategory)?.descriptions?.length || 0) > 0 && !bulkSubCategory
                                        ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                                        : 'border-slate-200 dark:border-slate-700'
                                        }`}
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
                                                    const selectableRows = importedRows.filter(r => !r.isDuplicate);
                                                    const allSelected = selectableRows.length > 0 && selectableRows.every(r => r.isSelected);
                                                    setImportedRows(importedRows.map(r => r.isDuplicate ? { ...r, isSelected: false } : { ...r, isSelected: !allSelected }));
                                                }}
                                            >
                                                {importedRows.filter(r => !r.isDuplicate).length > 0 && importedRows.filter(r => !r.isDuplicate).every(r => r.isSelected) ? <CheckSquare size={16} /> : <Square size={16} />}
                                            </button>
                                        </th>
                                        <th className="p-3 w-28">Tarih</th>
                                        <th className="p-3 w-64">Açıklama</th>
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
                                            // Check Validation Logic
                                            const isCategoryMissing = !row.categoryId;
                                            const hasSubOptions = rowCategory?.descriptions && rowCategory.descriptions.length > 0;
                                            const isSubCategoryMissing = hasSubOptions && !row.subCategoryId;

                                            return (
                                                <tr key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${row.isDuplicate ? 'bg-amber-50 dark:bg-amber-900/10' : ''} ${!row.isSelected ? 'opacity-50 grayscale' : ''}`}>
                                                    <td className="p-3 text-center align-middle">
                                                        <button onClick={() => toggleImportRowSelection(row.id)} className="text-pnr-purple disabled:cursor-not-allowed disabled:text-amber-500" disabled={row.isDuplicate} title={row.isDuplicate ? 'Daha önce kaydedilmiş' : undefined}>
                                                            {row.isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300" />}
                                                        </button>
                                                    </td>
                                                    <td className="p-3 font-mono text-slate-600 dark:text-slate-300 align-middle">{row.date}</td>
                                                    <td className="p-2 align-middle">
                                                        <input
                                                            type="text"
                                                            className="w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-slate-700 dark:text-slate-200"
                                                            value={row.description}
                                                            onChange={(e) => updateImportRow(row.id, 'description', e.target.value)}
                                                        />
                                                        {row.isDuplicate && (
                                                            <div className="mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                                                Daha önce kaydedilmiş, seçili değil.
                                                            </div>
                                                        )}
                                                    </td>
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
                    <div className="bg-white dark:bg-pnr-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                <Landmark size={20} className="text-pnr-purple" /> {editingId ? 'Denizbank Kaydını Düzenle' : 'Yeni Denizbank Kaydı'}
                            </h3>
                            <button onClick={() => { setIsManualModalOpen(false); resetManualForm(); }}><X size={20} className="text-slate-400 hover:text-slate-900" /></button>
                        </div>

                        <form onSubmit={handleManualSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'income', categoryId: '', subCategoryId: '', personSplitRows: formData.personSplitRows.map(row => ({ ...row, categoryId: '', subCategoryId: '' })) })}
                                    className={`py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${formData.type === 'income' ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    <TrendingUp size={16} /> Gelir
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'expense', categoryId: '', subCategoryId: '', personSplitRows: formData.personSplitRows.map(row => ({ ...row, categoryId: '', subCategoryId: '' })) })}
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

                            {!formData.personSplitEnabled && (
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
                                        {categories.filter(c => c.type === formData.type).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                    </select>
                                </div>
                            )}

                            {!formData.personSplitEnabled && selectedCategory && selectedCategory.descriptions.length > 0 && (
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
                                            disabled={formData.personSplitEnabled}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                                            value={formData.installments || ''}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                setFormData({ ...formData, installments: value, bulkPayments: value > 1 ? 1 : formData.bulkPayments, installmentInfo: '' });
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
                                            disabled={formData.personSplitEnabled}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                                            value={formData.bulkPayments || ''}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value) || 0;
                                                setFormData({ ...formData, bulkPayments: value, installments: value > 1 ? 1 : formData.installments, installmentInfo: '' });
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
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm font-bold outline-none focus:ring-2 ${formData.type === 'income' ? 'text-green-600 focus:ring-green-500' : 'text-red-600 focus:ring-red-500'}`}
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            {(formData.installments > 1 || formData.bulkPayments > 1) && formData.amount && (
                                <p className="text-xs text-slate-400 text-right font-mono">
                                    {formData.bulkPayments > 1 ? 'Dönem Payı' : 'Aylık Ödeme'}: {formatCurrency(parseTurkishAmount(formData.amount) / (formData.bulkPayments > 1 ? formData.bulkPayments : formData.installments))}
                                </p>
                            )}

                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 p-3 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Kişilere Böl</div>
                                        <div className="text-xs text-slate-500">Ana satır bakiyede kalır, kişi satırları sadece dağılım olarak görünür.</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={togglePersonSplit}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${formData.personSplitEnabled ? 'bg-pnr-purple text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
                                    >
                                        {formData.personSplitEnabled ? 'Bölme Açık' : 'Kişilere Böl'}
                                    </button>
                                </div>

                                {formData.personSplitEnabled && (
                                    <div className="space-y-3">
                                        <div className="w-32">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kişi Sayısı</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="20"
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm dark:text-white"
                                                value={formData.personSplitCount || ''}
                                                onChange={(e) => setPersonSplitCount(parseInt(e.target.value) || 1)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            {formData.personSplitRows.map((row, index) => {
                                                const rowCategory = categories.find(c => c.id === row.categoryId);

                                                return (
                                                    <div key={row.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px] gap-2 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/60 p-2">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-violet-500 uppercase mb-1">{index + 1}. Kategori</label>
                                                            <select
                                                                required
                                                                className="w-full bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-800 rounded p-2 text-xs dark:text-white"
                                                                value={row.categoryId}
                                                                onChange={(e) => updatePersonSplitRow(row.id, { categoryId: e.target.value, subCategoryId: '' })}
                                                            >
                                                                <option value="">Seçiniz</option>
                                                                {categories.filter(c => c.type === formData.type).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-violet-500 uppercase mb-1">Alt Kategori</label>
                                                            <select
                                                                required={!!rowCategory?.descriptions.length}
                                                                disabled={!row.categoryId || !rowCategory?.descriptions.length}
                                                                className="w-full bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-800 rounded p-2 text-xs dark:text-white disabled:opacity-60"
                                                                value={row.subCategoryId}
                                                                onChange={(e) => updatePersonSplitRow(row.id, { subCategoryId: e.target.value })}
                                                            >
                                                                <option value="">Alt Kategori</option>
                                                                {rowCategory?.descriptions.map(desc => <option key={desc.id} value={desc.id}>{desc.description}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-violet-500 uppercase mb-1">Ödeme</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                required
                                                                className="w-full bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-800 rounded p-2 text-xs font-bold text-right dark:text-white"
                                                                value={row.amount}
                                                                onChange={(e) => updatePersonSplitRow(row.id, { amount: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-70 ${formData.type === 'income' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}
                                >
                                    {loading ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Denizbank;
