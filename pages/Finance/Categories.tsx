import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, X, Check, Search, AlertCircle,
  TrendingUp, TrendingDown, Layers, Tag, Save, Loader2,
  RefreshCcw, ArrowRight
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// --- Types ---
type CategoryType = 'income' | 'expense';

interface DescriptionItem {
  id: string;
  text: string;
}

interface CategoryItem {
  id: string;
  title: string;
  type: CategoryType;
  descriptions: DescriptionItem[]; // From DB table (sub-items)
}

// --- Extracted Component ---
// Defined outside to prevent re-creation on every render which causes input focus loss
interface CategoryTableProps {
  title: string;
  type: CategoryType;
  data: CategoryItem[];
  inputValue: string;
  onInputChange: (val: string) => void;
  isAdding: boolean;
  onAddCategory: (type: CategoryType) => void;
  onDeleteCategory: (id: string) => void;
  subItemInputs: Record<string, string>;
  onSubItemInputChange: (id: string, val: string) => void;
  onAddSubItem: (catId: string) => void;
  onDeleteSubItem: (catId: string, descId: string) => void;
  loadingAction: string | null;
  canEdit?: boolean;
}

const CategoryTable: React.FC<CategoryTableProps> = ({
  title, type, data,
  inputValue, onInputChange, isAdding, onAddCategory, onDeleteCategory,
  subItemInputs, onSubItemInputChange, onAddSubItem, onDeleteSubItem, loadingAction, canEdit = true
}) => {
  const isIncome = type === 'income';
  const headerColor = isIncome ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400';
  const bgColor = isIncome ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10';
  const borderColor = isIncome ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800';
  const btnColor = isIncome ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700';

  return (
    <div className={`rounded-2xl border ${borderColor} overflow-hidden flex flex-col h-full bg-white dark:bg-slate-800`}>
      {/* Header */}
      <div className={`p-4 ${bgColor} border-b ${borderColor} flex flex-col gap-3`}>
        <div className={`font-bold font-display flex items-center gap-2 ${headerColor}`}>
          {isIncome ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          {title}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Yeni Kategori Ekle..."
              className={`flex-1 bg-white dark:bg-slate-900 border ${borderColor} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-opacity-50 ${isIncome ? 'focus:ring-green-500' : 'focus:ring-red-500'} dark:text-white`}
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAddCategory(type)}
            />
            <button
              onClick={() => onAddCategory(type)}
              disabled={isAdding}
              className={`${btnColor} text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors disabled:opacity-50`}
            >
              Ekle
            </button>
          </div>
        )}
      </div>

      {/* Table List */}
      <div className="flex-1 overflow-auto">
        {data.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm italic">
            Henüz kayıt yok.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase sticky top-0 z-10">
              <tr>
                <th className="p-3 border-b border-slate-100 dark:border-slate-700 w-1/3">Kategori</th>
                <th className="p-3 border-b border-slate-100 dark:border-slate-700">Alt Kalemler</th>
                <th className="p-3 border-b border-slate-100 dark:border-slate-700 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {data.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="p-3 align-top">
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">{item.title}</div>
                  </td>
                  <td className="p-3 align-top">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {item.descriptions.map((desc) => (
                        <span key={desc.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-300">
                          {desc.text}
                          {canEdit && (
                            <button
                              onClick={() => onDeleteSubItem(item.id, desc.id)}
                              className="hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-0.5 transition-colors"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    {canEdit && (
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="+ Alt Kalem Ekle"
                          className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 text-xs py-1 focus:outline-none focus:border-pnr-purple dark:text-white placeholder:text-slate-400"
                          value={subItemInputs[item.id] || ''}
                          onChange={(e) => onSubItemInputChange(item.id, e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && onAddSubItem(item.id)}
                        />
                        {loadingAction === `add-sub-${item.id}` && (
                          <Loader2 size={12} className="absolute right-0 top-1 animate-spin text-slate-400" />
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 align-top text-right">
                    {canEdit && (
                      <button
                        onClick={() => onDeleteCategory(item.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

interface FinanceCategoriesProps {
  canEdit?: boolean;
}

const FinanceCategories: React.FC<FinanceCategoriesProps> = ({ canEdit = true }) => {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  // Inputs for new root categories
  const [newIncomeTitle, setNewIncomeTitle] = useState('');
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Input state for adding sub-items to specific rows
  const [subItemInputs, setSubItemInputs] = useState<Record<string, string>>({});
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // --- Fetch Data ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Categories from DB
      const { data: catData, error: catError } = await supabase
        .from('financial_categories')
        .select(`
          *,
          financial_category_descriptions (
            id,
            description
          )
        `)
        .order('created_at', { ascending: false });

      if (catError) throw catError;

      // 2. Transform Data
      const formattedCategories: CategoryItem[] = (catData || []).map((cat: any) => ({
        id: cat.id,
        title: cat.title,
        type: cat.type as CategoryType,
        descriptions: (cat.financial_category_descriptions || []).map((d: any) => ({
          id: d.id,
          text: d.description
        })).sort((a: any, b: any) => a.text.localeCompare(b.text))
      }));

      setCategories(formattedCategories);

    } catch (error: any) {
      console.error("Error fetching categories:", error);
      alert("Veri yüklenirken hata: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Handlers ---

  const handleAddCategory = async (type: CategoryType) => {
    const title = type === 'income' ? newIncomeTitle : newExpenseTitle;
    if (!canEdit || !title.trim()) return;

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from('financial_categories')
        .insert({
          title: title.trim(),
          type: type,
          is_automatic: false
        })
        .select()
        .single();

      if (error) throw error;

      const newCat: CategoryItem = {
        id: data.id,
        title: data.title,
        type: data.type,
        descriptions: []
      };
      setCategories(prev => [newCat, ...prev]);

      if (type === 'income') setNewIncomeTitle('');
      else setNewExpenseTitle('');

    } catch (err: any) {
      alert("Kategori eklenemedi: " + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!canEdit || !confirm('Bu kategoriyi ve altındaki tüm alt kalemleri silmek istediğinize emin misiniz?')) return;

    setCategories(prev => prev.filter(c => c.id !== id));

    try {
      const { error } = await supabase.from('financial_categories').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      alert("Silme hatası: " + err.message);
      fetchData();
    }
  };

  const handleSubItemInputChange = (id: string, val: string) => {
    setSubItemInputs(prev => ({ ...prev, [id]: val }));
  };

  const handleAddSubItem = async (catId: string) => {
    if (!canEdit) return;
    const text = subItemInputs[catId];
    if (!text?.trim()) return;

    setLoadingAction(`add-sub-${catId}`);
    try {
      const { data, error } = await supabase
        .from('financial_category_descriptions')
        .insert({
          category_id: catId,
          description: text.trim()
        })
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => prev.map(c => {
        if (c.id === catId) {
          return {
            ...c,
            descriptions: [...c.descriptions, { id: data.id, text: data.description }]
          };
        }
        return c;
      }));

      setSubItemInputs(prev => ({ ...prev, [catId]: '' }));

    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteSubItem = async (catId: string, descId: string) => {
    if (!canEdit) return;
    setCategories(prev => prev.map(c => {
      if (c.id === catId) {
        return { ...c, descriptions: c.descriptions.filter(d => d.id !== descId) };
      }
      return c;
    }));

    try {
      const { error } = await supabase.from('financial_category_descriptions').delete().eq('id', descId);
      if (error) throw error;
    } catch (err: any) {
      alert("Silinemedi: " + err.message);
      fetchData();
    }
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6 h-[calc(100vh-100px)] flex flex-col">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Gelir & Gider Tanımı</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">
            Finansal kategoriler ve alt kalemlerin (detayların) yönetimi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500"
            title="Yenile"
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">Veriler yükleniyor...</div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* INCOME TABLE */}
          <CategoryTable
            title="GELİR LİSTESİ"
            type="income"
            data={incomeCategories}
            inputValue={newIncomeTitle}
            onInputChange={setNewIncomeTitle}
            isAdding={isAdding}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            subItemInputs={subItemInputs}
            onSubItemInputChange={handleSubItemInputChange}
            onAddSubItem={handleAddSubItem}
            onDeleteSubItem={handleDeleteSubItem}
            loadingAction={loadingAction}
          />

          {/* EXPENSE TABLE */}
          <CategoryTable
            title="GİDER LİSTESİ"
            type="expense"
            data={expenseCategories}
            inputValue={newExpenseTitle}
            onInputChange={setNewExpenseTitle}
            isAdding={isAdding}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            subItemInputs={subItemInputs}
            onSubItemInputChange={handleSubItemInputChange}
            onAddSubItem={handleAddSubItem}
            onDeleteSubItem={handleDeleteSubItem}
            loadingAction={loadingAction}
            canEdit={canEdit}
          />
        </div>
      )}

    </div>
  );
};

export default FinanceCategories;