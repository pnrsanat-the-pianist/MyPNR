import { supabase } from './supabaseClient';
import { makeDottedIReadable } from './readableText';

export interface FinanceCategoryDescription {
  id: string;
  description: string;
}

export interface FinanceCategoryOption {
  id: string;
  title: string;
  type: 'income' | 'expense';
  descriptions: FinanceCategoryDescription[];
}

export const fetchFinanceCategories = async (): Promise<FinanceCategoryOption[]> => {
  const [{ data: categories, error: categoriesError }, { data: descriptions, error: descriptionsError }] = await Promise.all([
    supabase
      .from('financial_categories')
      .select('id, title, type')
      .order('title'),
    supabase
      .from('financial_category_descriptions')
      .select('id, category_id, description')
  ]);

  if (categoriesError) throw categoriesError;
  if (descriptionsError) throw descriptionsError;

  return (categories || []).map((category: any) => ({
    id: category.id,
    title: category.title,
    type: category.type,
    descriptions: (descriptions || [])
      .filter((description: any) => description.category_id === category.id)
      .map((description: any) => ({
        id: description.id,
        description: makeDottedIReadable(description.description)
      }))
  }));
};
