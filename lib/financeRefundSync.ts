import { supabase } from './supabaseClient';
import { makeDottedIReadable, normalizeDottedIForCompare } from './readableText';

const REFUND_CATEGORY_TITLE = 'Ödeme İadesi';
const REFUND_STUDENT_STATUSES = ['active', 'inactive', 'passive'];
const SHOW_STUDENT_CATEGORY_TITLES = ['Gösteri Bilet', 'Gösteri Kıyafet'];

const normalizeKey = (value: any) => normalizeDottedIForCompare(value)
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ı/g, 'i');

const fetchIncomeBranchCategories = async () => {
  const { data, error } = await supabase
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
    .eq('type', 'income');

  if (error) throw error;
  return data || [];
};

export const syncRefundStudentsToFinance = async () => {
  const { data: existingCategory, error: categoryLookupError } = await supabase
    .from('financial_categories')
    .select('id')
    .eq('title', REFUND_CATEGORY_TITLE)
    .eq('type', 'expense')
    .maybeSingle();

  if (categoryLookupError) throw categoryLookupError;

  let categoryId = existingCategory?.id;
  if (!categoryId) {
    const { data: createdCategory, error: categoryCreateError } = await supabase
      .from('financial_categories')
      .insert({ title: REFUND_CATEGORY_TITLE, type: 'expense', is_automatic: true })
      .select('id')
      .single();

    if (categoryCreateError) throw categoryCreateError;
    categoryId = createdCategory.id;
  }

  const [{ data: students, error: studentsError }, { data: existingDescriptions, error: descriptionsError }] = await Promise.all([
    supabase
      .from('students')
      .select('full_name, status')
      .in('status', REFUND_STUDENT_STATUSES),
    supabase
      .from('financial_category_descriptions')
      .select('description')
      .eq('category_id', categoryId)
  ]);

  if (studentsError) throw studentsError;
  if (descriptionsError) throw descriptionsError;

  const studentNames = Array.from(new Set((students || [])
    .map((student: any) => makeDottedIReadable(student.full_name).trim())
    .filter(Boolean)));
  const existingNames = new Set((existingDescriptions || []).map((item: any) => normalizeDottedIForCompare(item.description)));
  const missingRows = studentNames
    .filter(name => !existingNames.has(normalizeDottedIForCompare(name)))
    .map(name => ({ category_id: categoryId, description: name }));

  if (missingRows.length === 0) return;

  const { error: insertError } = await supabase
    .from('financial_category_descriptions')
    .insert(missingRows);

  if (insertError) throw insertError;
};

export const syncShowStudentsToFinance = async () => {
  const [{ data: students, error: studentsError }, { data: categories, error: categoriesError }] = await Promise.all([
    supabase
      .from('students')
      .select('full_name, status')
      .in('status', REFUND_STUDENT_STATUSES),
    supabase
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
      .eq('type', 'income')
  ]);

  if (studentsError) throw studentsError;
  if (categoriesError) throw categoriesError;

  const studentNames = Array.from(new Map((students || [])
    .map((student: any) => makeDottedIReadable(student.full_name).trim())
    .filter(Boolean)
    .map((name: string) => [normalizeKey(name), name])).values());

  const categoriesByKey = new Map((categories || []).map((category: any) => [normalizeKey(category.title), category]));
  const missingCategories = SHOW_STUDENT_CATEGORY_TITLES
    .filter(title => !categoriesByKey.has(normalizeKey(title)))
    .map(title => ({ title, type: 'income', is_automatic: true }));

  if (missingCategories.length > 0) {
    const { error: categoryInsertError } = await supabase
      .from('financial_categories')
      .upsert(missingCategories, { onConflict: 'title,type', ignoreDuplicates: true });

    if (categoryInsertError) throw categoryInsertError;
  }

  const { data: refreshedCategories, error: refreshedCategoriesError } = await supabase
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
    .eq('type', 'income');

  if (refreshedCategoriesError) throw refreshedCategoriesError;

  const refreshedCategoriesByKey = new Map((refreshedCategories || []).map((category: any) => [normalizeKey(category.title), category]));
  const rowsToInsert: Array<{ category_id: string; description: string }> = [];

  SHOW_STUDENT_CATEGORY_TITLES.forEach(title => {
    const category: any = refreshedCategoriesByKey.get(normalizeKey(title));
    if (!category) return;

    const existingNames = new Set((category.financial_category_descriptions || []).map((item: any) => normalizeKey(item.description)));
    studentNames.forEach(studentName => {
      if (!existingNames.has(normalizeKey(studentName))) {
        rowsToInsert.push({ category_id: category.id, description: studentName });
      }
    });
  });

  if (rowsToInsert.length === 0) return;

  const { error: insertError } = await supabase
    .from('financial_category_descriptions')
    .insert(rowsToInsert);

  if (insertError) throw insertError;
};

export const syncBranchStudentsToFinance = async () => {
  const [{ data: students, error: studentsError }, { data: subBranches, error: subBranchesError }] = await Promise.all([
    supabase
      .from('students')
      .select('full_name, status, sub_branch')
      .in('status', REFUND_STUDENT_STATUSES),
    supabase
      .from('sub_branches')
      .select('name')
  ]);

  if (studentsError) throw studentsError;
  if (subBranchesError) throw subBranchesError;

  const branchNamesByKey = new Map<string, string>();
  (subBranches || []).forEach((branch: any) => {
    const branchName = makeDottedIReadable(branch.name).trim();
    const branchKey = normalizeDottedIForCompare(branchName);
    if (branchKey && !branchNamesByKey.has(branchKey)) branchNamesByKey.set(branchKey, branchName);
  });

  const desiredStudentsByBranch = new Map<string, Map<string, string>>();
  (students || []).forEach((student: any) => {
    const branchName = makeDottedIReadable(student.sub_branch).trim();
    const branchKey = normalizeDottedIForCompare(branchName);
    const studentName = makeDottedIReadable(student.full_name).trim();
    const studentKey = normalizeDottedIForCompare(studentName);
    if (!branchKey || !studentKey) return;

    if (!branchNamesByKey.has(branchKey)) branchNamesByKey.set(branchKey, branchName);
    if (!desiredStudentsByBranch.has(branchKey)) desiredStudentsByBranch.set(branchKey, new Map());
    desiredStudentsByBranch.get(branchKey)!.set(studentKey, studentName);
  });

  let categories = await fetchIncomeBranchCategories();

  const existingCategoryKeys = new Set((categories || []).map((category: any) => normalizeDottedIForCompare(category.title)));
  const missingBranchCategories = Array.from(desiredStudentsByBranch.keys())
    .filter(branchKey => !existingCategoryKeys.has(branchKey))
    .map(branchKey => ({
      title: branchNamesByKey.get(branchKey) || branchKey,
      type: 'income',
      is_automatic: true
    }));

  if (missingBranchCategories.length > 0) {
    const { error: categoryInsertError } = await supabase
      .from('financial_categories')
      .upsert(missingBranchCategories, { onConflict: 'title,type', ignoreDuplicates: true });

    if (categoryInsertError) throw categoryInsertError;
    categories = await fetchIncomeBranchCategories();
  }

  const rowsToInsert: Array<{ category_id: string; description: string }> = [];
  const descriptionIdsToDelete: string[] = [];

  (categories || []).forEach((category: any) => {
    const branchKey = normalizeDottedIForCompare(category.title);
    if (!branchNamesByKey.has(branchKey)) return;

    const desiredStudents = desiredStudentsByBranch.get(branchKey) || new Map<string, string>();
    const existingStudentKeys = new Set<string>();

    (category.financial_category_descriptions || []).forEach((item: any) => {
      const descriptionKey = normalizeDottedIForCompare(item.description);
      if (!desiredStudents.has(descriptionKey) || existingStudentKeys.has(descriptionKey)) {
        descriptionIdsToDelete.push(item.id);
        return;
      }

      existingStudentKeys.add(descriptionKey);
    });

    desiredStudents.forEach((studentName, studentKey) => {
      if (!existingStudentKeys.has(studentKey)) {
        rowsToInsert.push({ category_id: category.id, description: studentName });
      }
    });
  });

  if (descriptionIdsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('financial_category_descriptions')
      .delete()
      .in('id', descriptionIdsToDelete);

    if (deleteError) throw deleteError;
  }

  if (rowsToInsert.length === 0) return;

  const { error: insertError } = await supabase
    .from('financial_category_descriptions')
    .insert(rowsToInsert);

  if (insertError) throw insertError;
};
