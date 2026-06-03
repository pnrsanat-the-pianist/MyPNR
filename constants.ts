
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  CheckSquare,
  GraduationCap,
  UserPlus,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  TrendingUp,
  Wallet,
  Landmark,
  Settings,
  Shield,
  Music,
  Layers,
  DoorOpen
} from 'lucide-react';
import { NavItem, UserRole } from './types';

// The PNR Spectrum Palette
export const PNR_PALETTE = {
  purple: '#6B21A8',  // PNR Text Color
  indigo: '#4F46E5',
  blue: '#3B82F6',
  cyan: '#06B6D4',
  teal: '#14B8A6',
  green: '#22C55E',
  yellow: '#EAB308',
  orange: '#F97316',
  red: '#EF4444',
  slate: '#64748b'
};

export const DASHBOARD_PERMISSION_ITEMS: NavItem[] = [
  { id: 'dashboard-student-distribution', title: 'Öğrenci Dağılımı' },
  { id: 'dashboard-todos', title: 'Görevlerim (To-Do)' },
  { id: 'dashboard-leads', title: 'Yeni Talepler' },
  { id: 'dashboard-finance', title: 'Finansal Durum' },
  { id: 'dashboard-teacher-distribution', title: 'Öğretmen Dağılımı' },
  { id: 'dashboard-daily-schedule', title: 'Günlük Program' },
  { id: 'dashboard-recent-students', title: 'Son Kayıtlar' },
];

export const MENU_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    roles: [UserRole.ADMIN, UserRole.KURUCU, UserRole.MUDUR, UserRole.PERSONEL, UserRole.OGRETMEN, UserRole.VELI],
  },
  {
    id: 'yonetim',
    title: 'Yönetim',
    icon: Briefcase,
    roles: [UserRole.ADMIN, UserRole.KURUCU, UserRole.MUDUR],
    subItems: [
      {
        id: 'yeni-talep',
        title: 'Yeni Talep',
        path: '/management/leads',
        icon: UserPlus,
        roles: [UserRole.ADMIN, UserRole.KURUCU, UserRole.MUDUR, UserRole.PERSONEL]
      },
      { id: 'branslar', title: 'Branşlar', path: '/management/branches' },
      { id: 'derslikler', title: 'Derslikler', path: '/management/classrooms', icon: DoorOpen },
      { id: 'ogretmenler', title: 'Öğretmenler', path: '/management/teachers', icon: Users },
      { id: 'sozlesmeler', title: 'Sözleşmeler', path: '/management/contracts' },
      { id: 'todo', title: 'To-Do', path: '/management/todo', icon: CheckSquare },
    ],
  },
  {
    id: 'egitim',
    title: 'Eğitim',
    icon: GraduationCap,
    roles: [UserRole.ADMIN, UserRole.KURUCU, UserRole.MUDUR, UserRole.PERSONEL, UserRole.OGRETMEN, UserRole.VELI],
    subItems: [
      {
        id: 'crm',
        title: 'CRM (Öğrenci)',
        path: '/education/crm',
        roles: [UserRole.ADMIN, UserRole.KURUCU, UserRole.MUDUR, UserRole.PERSONEL, UserRole.OGRETMEN, UserRole.VELI]
      },
      {
        id: 'enstruman-dersleri',
        title: 'Enstrüman Dersleri',
        path: '/education/instrument-lessons',
        icon: Music,
        roles: [UserRole.ADMIN, UserRole.KURUCU, UserRole.MUDUR, UserRole.PERSONEL, UserRole.OGRETMEN, UserRole.VELI]
      },
      {
        id: 'bale-siniflari',
        title: 'Bale / Dans Dersleri',
        path: '/education/dance-classes',
        icon: Users,
        roles: [UserRole.ADMIN, UserRole.KURUCU, UserRole.MUDUR, UserRole.PERSONEL, UserRole.OGRETMEN, UserRole.VELI]
      },
      {
        id: 'ders-programi',
        title: 'Ders Programı',
        path: '/education/schedule',
        icon: CalendarDays,
        roles: [UserRole.ADMIN, UserRole.KURUCU, UserRole.MUDUR, UserRole.PERSONEL, UserRole.OGRETMEN, UserRole.VELI]
      },
    ],
  },
  {
    id: 'gosteri',
    title: 'Gösteri',
    icon: CalendarCheck,
    roles: [UserRole.ADMIN, UserRole.KURUCU, UserRole.MUDUR, UserRole.PERSONEL],
    subItems: [
      {
        id: 'gosteriler',
        title: 'Yeni Gösteri Tanımla',
        path: '/events/shows',
        icon: CalendarDays,
        roles: [UserRole.ADMIN, UserRole.KURUCU, UserRole.MUDUR, UserRole.PERSONEL],
      },
    ],
  },
  {
    id: 'finans',
    title: 'Finans',
    icon: CreditCard,
    roles: [UserRole.ADMIN, UserRole.KURUCU, UserRole.MUDUR],
    subItems: [
      { id: 'gelir-gider', title: 'Gelir-Gider Tanımı', path: '/finance/categories' },
      { id: 'karlilik', title: 'Karlılık Tablosu', path: '/finance/profitability', icon: TrendingUp },
      { id: 'maas', title: 'Maaş Takibi', path: '/finance/salaries' },
      { id: 'kasa', title: 'Kasa Defteri', path: '/finance/cashbook', icon: Wallet },
      { id: 'denizbank', title: 'Denizbank', path: '/finance/denizbank', icon: CreditCard },
      { id: 'denizbank-pos', title: 'Denizbank POS', path: '/finance/denizbank-pos', icon: CreditCard },
      { id: 'vakifbank', title: 'Vakıfbank', path: '/finance/vakifbank', icon: Landmark },
      { id: 'category-automation', title: 'Kategori Otomasyon', path: '/finance/automation', icon: Layers },
    ],
  },
  {
    id: 'sistem',
    title: 'Sistem',
    icon: Settings,
    roles: [UserRole.ADMIN],
    subItems: [
      { id: 'kullanicilar', title: 'Kullanıcı Listesi', path: '/system/users', icon: Users },
      { id: 'yetkiler', title: 'Yetki Tablosu', path: '/system/permissions', icon: Shield },
      { id: 'ayarlar', title: 'Sayfa Ayarları', path: '/system/settings' },
    ],
  },
];
