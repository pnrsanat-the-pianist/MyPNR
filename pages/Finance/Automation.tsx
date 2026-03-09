
import React, { useState, useEffect } from 'react';
import {
    Plus, Trash2, Save, X, RefreshCcw, Search,
    Layers, Tag, Type, AlertCircle, Check, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

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
    created_at: string;
}

const CategoryAutomation: React.FC<{ canEdit?: boolean }> = ({ canEdit = true }) => {
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // New Rule Form
    const [newRule, setNewRule] = useState({
        keyword: '',
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
                        description: d.description
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

        } catch (err: any) {
            console.error("Veri çekme hatası:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddRule = async () => {
        if (!canEdit || !newRule.keyword || !newRule.category_id) return;

        setIsAdding(true);
        try {
            const { data, error } = await supabase
                .from('category_automation_rules')
                .insert([{
                    keyword: newRule.keyword.trim(),
                    category_id: newRule.category_id,
                    sub_category_id: newRule.sub_category_id || null
                }])
                .select()
                .single();

            if (error) throw error;

            setRules([data, ...rules]);
            setNewRule({ keyword: '', category_id: '', sub_category_id: '' });
            alert("Kural başarıyla eklendi.");
        } catch (err: any) {
            alert("Kural eklenemedi: " + err.message);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!canEdit || !confirm("Bu kuralı silmek istediğinize emin misiniz?")) return;

        try {
            const { error } = await supabase
                .from('category_automation_rules')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setRules(rules.filter(r => r.id !== id));
        } catch (err: any) {
            alert("Silme hatası: " + err.message);
        }
    };

    const filteredRules = rules.filter(r =>
        r.keyword.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.title || 'Bilinmiyor';
    const getSubCategoryName = (catId: string, subId: string) => {
        const cat = categories.find(c => c.id === catId);
        return cat?.descriptions.find(d => d.id === subId)?.description || '-';
    };

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

            {/* Quick Add Form */}
            {canEdit && (
                <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Plus size={20} className="text-pnr-purple" /> Yeni Kural Ekle
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
                                <Tag size={14} /> Atanacak Kategori
                            </label>
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pnr-purple dark:text-white"
                                value={newRule.category_id}
                                onChange={(e) => setNewRule({ ...newRule, category_id: e.target.value, sub_category_id: '' })}
                            >
                                <option value="">Kategori Seçiniz...</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.title} ({c.type === 'income' ? 'Gelir' : 'Gider'})</option>)}
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
                                <th className="p-4">Aranacak Kelime</th>
                                <th className="p-4">Kategori</th>
                                <th className="p-4">Alt Kategori</th>
                                <th className="p-4 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-sm">Yükleniyor...</td></tr>
                            ) : filteredRules.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-400 text-sm">Kural bulunamadı.</td></tr>
                            ) : (
                                filteredRules.map((rule) => (
                                    <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded border border-blue-100 dark:border-blue-800 text-xs font-bold">
                                                    "{rule.keyword}"
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {getCategoryName(rule.category_id)}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                                {getSubCategoryName(rule.category_id, rule.sub_category_id)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            {canEdit && (
                                                <button
                                                    onClick={() => handleDeleteRule(rule.id)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                    title="Sil"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
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
                    <p>Excel veya CSV dosyası yüklediğinizde, sistem işlem açıklamasını buradaki anahtar kelimelerle karşılaştırır. Eşleşme bulursa, belirlenen kategori ve alt kategoriyi otomatik olarak seçer. Büyük/küçük harf duyarlılığı olmadan arama yapılır.</p>
                </div>
            </div>
        </div>
    );
};

export default CategoryAutomation;
