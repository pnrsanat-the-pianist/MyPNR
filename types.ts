
import { LucideIcon } from 'lucide-react';

export enum UserRole {
  ADMIN = 'Admin',
  KURUCU = 'Kurucu',
  MUDUR = 'Müdür',
  PERSONEL = 'Personel',
  OGRETMEN = 'Öğretmen',
  VELI = 'Veli',
}

export type PermissionAction = 'view' | 'edit' | 'delete';

export interface RolePermission {
  role: UserRole;
  resource: string; // Matches NavItem.id or generic resource name
  actions: PermissionAction[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface NavItem {
  id: string;
  title: string;
  path?: string;
  icon?: LucideIcon;
  subItems?: NavItem[];
  roles?: UserRole[]; // Roles allowed to see this
  isAction?: boolean; // If true, triggers an action/modal instead of navigation
}

export interface BranchStat {
  name: string;
  count: number;
  color: string;
}

export interface TeacherStat {
  id: string;
  name: string;
  studentCount: number;
  totalHours?: number;
}

// UI View Model for Dashboard
export interface Student {
  id: string;
  name: string;
  branch: string;
  status: 'active' | 'trial' | 'pending' | 'cancelled';
  teacher: string;
  nextLesson: string;
}

export interface DashboardMetric {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: LucideIcon;
  color: string;
}

// --- Core Data Models ---

export interface CoreStudent {
  id: string;
  name: string;
  parent_id?: string;
  branch_id: string;
  teacher_id: string;
  status: 'active' | 'trial' | 'pending' | 'cancelled';
  enrollment_type?: 'package' | 'monthly'; // 'package' for instruments (10-lesson), 'monthly' for dance
  remaining_package_lessons?: number; // For 'package' type students
}

export interface Teacher {
  id: string;
  name: string;
  branches: string[]; // branch_ids
  salary_info?: string;
  sgk_info?: string;
}

export interface Branch {
  id: string;
  upper_branch_id?: string;
  name: string;
  color_code?: string;
}

export interface Classroom {
  id: string;
  name: string;
  capacity?: number;
}

export interface Lesson {
  id: string;
  student_id: string;
  teacher_id: string;
  branch_id: string;
  classroom_id?: string; // e.g. 'room-1', 'room-2'
  date: string;
  duration: number; // minutes
}

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  parent_category_id?: string;
}

export interface FinancialRecord {
  id: string;
  type: 'income' | 'expense';
  category_id: string;
  amount: number;
  date: string;
  description?: string;
  payment_method?: 'cash' | 'credit_card' | 'bank_transfer';
}

export interface Bank {
  id: string;
  name: string;
  account_name?: string; // Added
  branch_name?: string;
  account_number?: string;
  iban?: string;
  currency?: string;
  balance?: number;
  logo_url?: string; // Added
}

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  bank_id: string;
}
