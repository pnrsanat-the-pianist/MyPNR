
import React, { useState, useEffect } from 'react';
import {
    Plus, Trash2, Save, X, RefreshCcw, Search,
    Layers, Tag, Type, AlertCircle, Check, Loader2, Pencil
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { makeDottedIReadable } from '../../lib/readableText';

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
    account_scope?: string | null;
    created_at: string;
}

const ACCOUNT_SCOPE_OPTIONS = [
    { value: 'all', label: 'Tümü' },
    { value: 'denizbank', label: 'Denizbank' },
    { value: 'vakifbank', label: 'Vakıfbank' },
    { value: 'denizbank-pos', label: 'Denizbank POS' }
];

type SortKey = 'keyword' | 'account' | 'type' | 'category' | 'subCategory';
type SortDirection = 'asc' | 'desc';
type RuleFormState = {
    keyword: string;
    accountScopes: string[];
    type: 'income' | 'expense';
    category_id: string;
    sub_category_id: string;
};

const CategoryAutomation: React.FC<{ canEdit?: boolean }> = ({ canEdit = true }) => {
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [editRule, setEditRule] = useState<RuleFormState | null>(null);
    const [accountScopeColumnReady, setAccountScopeColumnReady] = useState(true);

    // New Rule Form
    const [newRule, setNewRule] = useState<RuleFormState>({
        keyword: '',
        accountScopes: ['all'],
        type: 'expense' as 'income' | 'expense',
        category_id: '',
        sub_category_id: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Categories
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

            if (catData) {
                const formatted: CategoryOption[] = (catData as any[]).map(c => ({
                    id: c.id,
                    title: c.title,
                    type: c.type,
                    descriptions: (c.financial_category_descriptions || []).map((d: any) => ({
                        id: d.id,
                        description: makeDottedIReadable(d.description)
                    }))
                }));
                setCategories(formatted);
            }

            // 2. Fetch Automation Rules
            const { data: ruleData, error: ruleError } = await supabase
                .from('category_automation_rules')
                .select('*')
                .order('created_at', { ascending: false });

            if (ruleError) {
                // If table doesn't exist, we might need to alert the user
                if (ruleError.code === '42P01') {
                    console.warn("category_automation_rules table does not exist yet.");
                } else {
                    throw ruleError;
                }
            }
            setRules(ruleData || []);

            const { error: accountScopeError } = await supabase
                .from('category_automation_rules')
                .select('account_scope')
                .limit(1);
            setAccountScopeColumnReady(!accountScopeError);

        } catch (err: any) {
            console.error("Veri çekme hatası:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getAccountScopeValues = (scope?: string | null) => {
        const values = String(scope || 'all')
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);

        return values.length > 0 ? values : ['all'];
    };

    const serializeAccountScopes = (values: string[]) => {
        const uniqueValues = Array.from(new Set(values.filter(Boolean)));
        if (uniqueValues.length === 0 || uniqueValues.includes('all')) return 'all';
        return uniqueValues.join(',');
    };

    const toggleAccountScope = (values: string[], value: string) => {
        if (value === 'all') return ['all'];

        const withoutAll = values.filter(item => item !== 'all');
        const nextValues = withoutAll.includes(value)
            ? withoutAll.filter(item => item !== value)
            : [...withoutAll, value];

        return nextValues.length > 0 ? nextValues : ['all'];
    };

    const getAccountScopeLabel = (scope?: string | null) => getAccountScopeValues(scope)
        .map(value => ACCOUNT_SCOPE_OPTIONS.find(option => option.value === value)?.label || value)
        .join(', ');

    const renderAccountScopePicker = (values: string[], onChange: (nextValues: string[]) => void, disabled = false) => (
        <div className="flex flex-wrap gap-1.5">
            {ACCOUNT_SCOPE_OPTIONS.map(option => {
                const isSelected = values.includes(option.value);

                return (
                    <button
                        key={option.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(toggleAccountScope(values, option.value))}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isSelected
                            ? 'bg-pnr-purple text-white border-pnr-purple'
                            : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-pnr-purple/60'
                            }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );

    const handleAddRule = async () => {
        if (!canEdit || !newRule.keyword || !newRule.category_id) return;
        if (!accountScopeColumnReady && serializeAccountScopes(newRule.accountScopes) !== 'all') {
            alert('Hesap seçimi kaydedilemez: önce database/add_account_scope_to_category_automation.sql dosyasındaki SQL Supabase üzerinde çalıştırılmalı.');
            return;
        }

        setIsAdding(true);
        try {
            const payload: any = {
                keyword: newRule.keyword.trim(),
                category_id: newRule.category_id,
                sub_category_id: newRule.sub_category_id || null
            };

            if (accountScopeColumnReady) {
                payload.account_scope = serializeAccountScopes(newRule.accountScopes);
            }

            const { data, error } = await supabase
                .from('category_automation_rules')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            setRules([data, ...rules]);
            setNewRule({ keyword: '', accountScopes: ['all'], type: 'expense', category_id: '', sub_category_id: '' });
            alert("Kural başarıyla eklendi.");
        } catch (err: any) {
            const message = String(err.message || '');
            alert("Kural eklenemedi: " + (message.includes('account_scope')
                ? 'Önce database/add_account_scope_to_category_automation.sql dosyasındaki SQL Supabase üzerinde çalıştırılmalı.'
                : message));
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!canEdit || !confirm("Bu kuralı silmek istediğinize emin misiniz?")) return;

        try {
            const { data, error } = await supabase
                .from('category_automation_rules')
                .delete()
                .eq('id', id)
                .select('id');

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('Supabase kaydı silmedi. category_automation_rules DELETE RLS politikasını kontrol edin.');
            }

            setRules(prev => prev.filter(r => r.id !== id));
        } catch (err: any) {
            alert("Silme hatası: " + err.message);
        }
    };

    const startEditRule = (rule: AutomationRule) => {
        const category = categories.find(c => c.id === rule.category_id);

        setEditingRuleId(rule.id);
        setEditRule({
            keyword: rule.keyword,
            accountScopes: getAccountScopeValues(rule.account_scope),
            type: category?.type || 'expense',
            category_id: rule.category_id,
            sub_category_id: rule.sub_category_id || ''
        });
    };

    const cancelEditRule = () => {
        setEditingRuleId(null);
        setEditRule(null);
    };

    const handleSaveRule = async (rule: AutomationRule) => {
        if (!canEdit || !editRule || !editRule.keyword.trim() || !editRule.category_id) return;
        if (!accountScopeColumnReady && serializeAccountScopes(editRule.accountScopes) !== serializeAccountScopes(getAccountScopeValues(rule.account_scope))) {
            alert('Hesap seçimi kaydedilemez: önce database/add_account_scope_to_category_automation.sql dosyasındaki SQL Supabase üzerinde çalıştırılmalı.');
            return;
        }

        try {
            const payload: any = {
                keyword: editRule.keyword.trim(),
                category_id: editRule.category_id,
                sub_category_id: editRule.sub_category_id || null
            };

            if (accountScopeColumnReady) {
                payload.account_scope = serializeAccountScopes(editRule.accountScopes);
            }

            const { data, error } = await supabase
                .from('category_automation_rules')
                .update(payload)
                .eq('id', rule.id)
                .select('*')
                .single();

            if (error) throw error;

            setRules(prev => prev.map(item => item.id === rule.id ? data : item));
            cancelEditRule();
        } catch (err: any) {
            const message = String(err.message || '');
            alert('Kural güncellenemedi: ' + (message.includes('account_scope')
                ? 'Önce database/add_account_scope_to_category_automation.sql dosyasındaki SQL Supabase üzerinde çalıştırılmalı.'
                : message));
        }
    };

    const getCategoryName = (id: string) => {
        const category = categories.find(c => c.id === id);
        return category ? category.title : 'Bilinmiyor';
    };

    const getCategoryTypeLabel = (id: string) => {
        const category = categories.find(c => c.id === id);
        return category ? (category.type === 'income' ? 'Gelir' : 'Gider') : 'Bilinmiyor';
    };

    const getSubCategoryName = (catId: string, subId: string) => {
        const cat = categories.find(c => c.id === catId);
        return cat?.descriptions.find(d => d.id === subId)?.description || '-';
    };

    const getSortValue = (rule: AutomationRule, key: SortKey) => {
        if (key === 'keyword') return rule.keyword;
        if (key === 'account') return getAccountScopeLabel(rule.account_scope);
        if (key === 'type') return getCategoryTypeLabel(rule.category_id);
        if (key === 'category') return getCategoryName(rule.category_id);
        return getSubCategoryName(rule.category_id, rule.sub_category_id);
    };

    const handleSort = (key: SortKey) => {
        setSortConfig(prev => prev?.key === key
            ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
            : { key, direction: 'asc' }
        );
    };

    const renderSortableHeader = (key: SortKey, label: string, className = 'p-4') => (
        <th className={className}>
            <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-pnr-purple transition-colors">
                {label}
                <span className="text-[10px]">{sortConfig?.key === key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
            </button>
        </th>
    );

    const filteredRules = rules.filter(r => {
        const accountLabel = getAccountScopeLabel(r.account_scope);
        const normalizedSearch = searchTerm.toLocaleLowerCase('tr-TR');
        return r.keyword.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
            || accountLabel.toLocaleLowerCase('tr-TR').includes(normalizedSearch);
    }).sort((a, b) => {
        if (!sortConfig) return 0;

        const aValue = getSortValue(a, sortConfig.key).toLocaleLowerCase('tr-TR');
        const bValue = getSortValue(b, sortConfig.key).toLocaleLowerCase('tr-TR');
        const result = aValue.localeCompare(bValue, 'tr', { numeric: true });

        return sortConfig.direction === 'asc' ? result : -result;
    });

    return (
        <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-pnr-purple/10 text-pnr-purple rounded-xl border border-pnr-purple/20">
                        <Layers size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Kategori Otomasyonu</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Excel yüklemelerinde otomatik kategori eşleme kuralları.</p>
                    </div>
                </div>
                <button
                    onClick={fetchData}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {!accountScopeColumnReady && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-2xl p-4 text-sm font-medium">
                    Hesap seçimini kaydetmek için Supabase SQL Editor'da <span className="font-mono">database/add_account_scope_to_category_automation.sql</span> dosyasındaki SQL çalıştırılmalı. Bu yapılana kadar mevcut kurallar Tümü gibi çalışır.
                </div>
            )}

            {/* Quick Add Form */}
            {canEdit && (
                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Plus size={20} className="text-pnr-purple" /> Yeni Kural Ekle
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                        <div className="space-y-1.5 font-display">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Type size={14} /> Kelime / Açıklama
                            </label>
                            <input
                                type="text"
                                placeholder="Örn: Fast Para Transferi"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pnr-purple dark:text-white"
                                value={newRule.keyword}
                                onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Tag size={14} /> Hesap
                            </label>
                            <div className="min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
                                {renderAccountScopePicker(newRule.accountScopes, (accountScopes) => setNewRule({ ...newRule, accountScopes }), !accountScopeColumnReady)}
                            </div>
                            {!accountScopeColumnReady && (
                                <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Hesap seçimi için SQL migration gerekli.</div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Tag size={14} /> İşlem Türü
                            </label>
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pnr-purple dark:text-white"
                                value={newRule.type}
                                onChange={(e) => setNewRule({ ...newRule, type: e.target.value as 'income' | 'expense', category_id: '', sub_category_id: '' })}
                            >
                                <option value="expense">Gider</option>
                                <option value="income">Gelir</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Tag size={14} /> Atanacak Kategori
                            </label>
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pnr-purple dark:text-white"
                                value={newRule.category_id}
                                onChange={(e) => setNewRule({ ...newRule, category_id: e.target.value, sub_category_id: '' })}
                            >
                                <option value="">Kategori Seçiniz...</option>
                                {categories.filter(c => c.type === newRule.type).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Layers size={14} /> Atanacak Alt Kategori
                            </label>
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pnr-purple dark:text-white"
                                value={newRule.sub_category_id}
                                onChange={(e) => setNewRule({ ...newRule, sub_category_id: e.target.value })}
                                disabled={!newRule.category_id}
                            >
                                <option value="">Alt Kategori Seçiniz...</option>
                                {categories.find(c => c.id === newRule.category_id)?.descriptions.map(d => (
                                    <option key={d.id} value={d.id}>{d.description}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={handleAddRule}
                            disabled={isAdding || !newRule.keyword || !newRule.category_id}
                            className="bg-pnr-purple hover:bg-pnr-indigo text-white p-3 rounded-xl font-bold shadow-lg shadow-pnr-purple/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isAdding ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Kuralı Kaydet
                        </button>
                    </div>
                </div>
            )}

            {/* Rules List */}
            <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="font-bold text-slate-900 dark:text-white">Tanımlı Kurallar ({rules.length})</h3>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Kural ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pnr-purple dark:text-white"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 uppercase">
                                {renderSortableHeader('keyword', 'Aranacak Kelime')}
                                {renderSortableHeader('account', 'Hesap')}
                                {renderSortableHeader('type', 'Tür')}
                                {renderSortableHeader('category', 'Kategori')}
                                {renderSortableHeader('subCategory', 'Alt Kategori')}
                                <th className="p-4 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-sm">Yükleniyor...</td></tr>
                            ) : filteredRules.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-sm">Kural bulunamadı.</td></tr>
                            ) : (
                                filteredRules.map((rule) => {
                                    const isEditing = editingRuleId === rule.id && editRule;
                                    const editCategory = isEditing ? categories.find(c => c.id === editRule.category_id) : undefined;

                                    return (
                                        <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors align-top">
                                            <td className="p-4">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editRule.keyword}
                                                        onChange={(e) => setEditRule({ ...editRule, keyword: e.target.value })}
                                                        className="w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs dark:text-white"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded border border-blue-100 dark:border-blue-800 text-xs font-bold">
                                                            "{rule.keyword}"
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 min-w-56">
                                                {isEditing ? (
                                                    <div className="space-y-1">
                                                        {renderAccountScopePicker(
                                                            editRule.accountScopes,
                                                            (accountScopes) => setEditRule({ ...editRule, accountScopes }),
                                                            !accountScopeColumnReady
                                                        )}
                                                        {!accountScopeColumnReady && (
                                                            <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">SQL migration gerekli.</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {getAccountScopeLabel(rule.account_scope)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {isEditing ? (
                                                    <select
                                                        value={editRule.type}
                                                        onChange={(e) => setEditRule({ ...editRule, type: e.target.value as 'income' | 'expense', category_id: '', sub_category_id: '' })}
                                                        className="w-28 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs dark:text-white"
                                                    >
                                                        <option value="expense">Gider</option>
                                                        <option value="income">Gelir</option>
                                                    </select>
                                                ) : (
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {getCategoryTypeLabel(rule.category_id)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {isEditing ? (
                                                    <select
                                                        value={editRule.category_id}
                                                        onChange={(e) => setEditRule({ ...editRule, category_id: e.target.value, sub_category_id: '' })}
                                                        className="w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs dark:text-white"
                                                    >
                                                        <option value="">Kategori Seçiniz...</option>
                                                        {categories.filter(c => c.type === editRule.type).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                                    </select>
                                                ) : (
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                        {getCategoryName(rule.category_id)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {isEditing ? (
                                                    <select
                                                        value={editRule.sub_category_id}
                                                        onChange={(e) => setEditRule({ ...editRule, sub_category_id: e.target.value })}
                                                        disabled={!editRule.category_id}
                                                        className="w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs dark:text-white disabled:opacity-60"
                                                    >
                                                        <option value="">Alt Kategori Seçiniz...</option>
                                                        {editCategory?.descriptions.map(d => <option key={d.id} value={d.id}>{d.description}</option>)}
                                                    </select>
                                                ) : (
                                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                                        {getSubCategoryName(rule.category_id, rule.sub_category_id)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                {canEdit && (isEditing ? (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => handleSaveRule(rule)}
                                                            disabled={!editRule.keyword.trim() || !editRule.category_id}
                                                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-40"
                                                            title="Kaydet"
                                                        >
                                                            <Save size={16} />
                                                        </button>
                                                        <button
                                                            onClick={cancelEditRule}
                                                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                                            title="İptal"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => startEditRule(rule)}
                                                            className="p-1.5 text-slate-400 hover:text-pnr-purple hover:bg-pnr-purple/10 rounded-lg transition-colors"
                                                            title="Düzenle"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRule(rule.id)}
                                                            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                            title="Sil"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Help / Info Card */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 p-4 rounded-2xl flex gap-3 items-start">
                <AlertCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                    <p className="font-bold mb-1">Kurallar Nasıl Çalışır?</p>
                    <p>Excel veya CSV dosyası yüklediğinizde, sistem işlem açıklamasını buradaki anahtar kelimelerle karşılaştırır. Hesap alanında birden fazla hesap seçilebilir; Tümü seçiliyse kural her hesapta çalışır. Tanımlı kurallardaki Hesap butonlarından kapsam sonradan değiştirilebilir.</p>
                </div>
            </div>
        </div>
    );
};

export default CategoryAutomation;
