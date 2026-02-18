import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus, Search, Shield, Mail, Lock, X, Check,
  Trash2, User as UserIcon, CheckCircle2, Clock,
  ArrowUpDown, ArrowUp, ArrowDown, RefreshCcw, Edit2, Loader2
} from 'lucide-react';
import { UserRole } from '../../types';
import { supabase } from '../../lib/supabaseClient';

// --- Types ---
interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'passive';
  isVerified: boolean;
  createdAt: string;
}

type SortKey = keyof SystemUser;
interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

interface UsersProps {
  canEdit?: boolean;
}

const Users: React.FC<UsersProps> = ({ canEdit = true }) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassive, setShowPassive] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // User Form State
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: UserRole.VELI
  });

  // --- Data Fetching ---
  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        const mappedUsers: SystemUser[] = data.map((profile: any) => ({
          id: profile.id,
          // Support both 'name' and 'full_name' column names for robustness
          name: profile.name || profile.full_name || 'İsimsiz Kullanıcı',
          email: profile.email || '',
          role: (profile.role as UserRole) || UserRole.OGRETMEN,
          status: profile.status || 'active',
          // If the DB has is_verified, use it, otherwise fallback to true for existing profiles
          isVerified: profile.is_verified ?? true,
          createdAt: profile.created_at ? new Date(profile.created_at).toLocaleDateString('tr-TR') : '-'
        }));
        setUsers(mappedUsers);
      }
    } catch (error: any) {
      console.error('Error fetching users:', error.message);
      alert('Kullanıcı listesi çekilirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // --- Handlers ---

  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setEditingUserId(null);
    setUserForm({
      name: '',
      email: '',
      password: '',
      role: UserRole.VELI
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: SystemUser) => {
    setIsEditMode(true);
    setEditingUserId(user.id);
    setUserForm({
      name: user.name,
      email: user.email,
      password: '', // Password stays empty in edit mode
      role: user.role
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (isEditMode && editingUserId) {
      // UPDATE EXISTING USER - doğrudan profiles tablosunu güncelle
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: userForm.name,
            role: userForm.role
          })
          .eq('id', editingUserId);

        if (error) throw error;

        alert('Kullanıcı başarıyla güncellendi.');
        setIsModalOpen(false);
        fetchUsers();
      } catch (err: any) {
        console.error("Güncelleme hatası:", err);
        alert(`Hata: ${err.message}`);
      } finally {
        setSubmitting(false);
      }
    } else {
      // ADD NEW USER - supabase.auth.signUp() kullanarak Authentication'a ekle
      if (!userForm.name || !userForm.email || !userForm.password) {
        alert("Lütfen tüm zorunlu alanları doldurun.");
        setSubmitting(false);
        return;
      }

      try {
        // 1. Mevcut admin oturumunu kaydet
        const { data: sessionData } = await supabase.auth.getSession();
        const currentSession = sessionData?.session;

        // 2. Yeni kullanıcıyı Supabase Auth'a kaydet
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: userForm.email,
          password: userForm.password,
          options: {
            data: {
              name: userForm.name,
              role: userForm.role
            }
          }
        });

        if (signUpError) throw signUpError;

        // 3. Yeni kullanıcının profil bilgilerini güncelle (handle_new_user trigger varsayılan 'Veli' atar)
        if (signUpData?.user) {
          // Profil tablosundaki rolü seçilen role göre güncelle
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: signUpData.user.id,
              email: userForm.email,
              name: userForm.name,
              role: userForm.role,
              status: 'active'
            }, { onConflict: 'id' });

          if (profileError) {
            console.warn('Profil güncelleme uyarısı:', profileError.message);
          }
        }

        // 4. Admin oturumunu geri yükle (signUp yeni kullanıcıya geçiş yapabilir)
        if (currentSession) {
          await supabase.auth.setSession({
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token
          });
        }

        alert(`${userForm.name} başarıyla oluşturuldu! (Varsayılan rol: ${userForm.role})`);
        setIsModalOpen(false);
        fetchUsers();
      } catch (err: any) {
        console.error("Kullanıcı oluşturma hatası:", err);
        alert(`Hata: ${err.message}`);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    if (!canEdit) return;
    const newStatus = currentStatus === 'active' ? 'passive' : 'active';

    // Optimistic Update
    setUsers(users.map(u => u.id === id ? { ...u, status: newStatus as any } : u));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Status update failed:', error);
      alert('Durum güncellenemedi.');
      fetchUsers();
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!canEdit) return;
    if (window.confirm('Bu kullanıcıyı pasif yapmak istediğinize emin misiniz?')) {
      try {
        // Kullanıcıyı silmek yerine pasif yap (Auth silme admin API gerektirir)
        const { error } = await supabase
          .from('profiles')
          .update({ status: 'passive' })
          .eq('id', id);

        if (error) throw error;

        alert('Kullanıcı pasif yapıldı.');
        fetchUsers();
      } catch (error: any) {
        console.error('Delete/Deactivate failed:', error);
        alert(`İşlem başarısız oldu: ${error.message}`);
        fetchUsers();
      }
    }
  };

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // --- Filtering & Sorting ---
  const processedUsers = useMemo(() => {
    let result = users.filter(user => {
      if (!showPassive && user.status === 'passive') return false;
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        return (
          user.name.toLowerCase().includes(lowerTerm) ||
          user.email.toLowerCase().includes(lowerTerm) ||
          user.role.toLowerCase().includes(lowerTerm)
        );
      }
      return true;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [users, showPassive, searchTerm, sortConfig]);

  // Helper for Role Badges
  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case UserRole.KURUCU: return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
      case UserRole.MUDUR: return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800';
      case UserRole.PERSONEL: return 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800';
      case UserRole.OGRETMEN: return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case UserRole.VELI: return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown size={14} className="ml-1 opacity-40 group-hover:opacity-100" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={14} className="ml-1 text-pnr-purple" />
      : <ArrowDown size={14} className="ml-1 text-pnr-purple" />;
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Kullanıcı Listesi</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">Sisteme erişimi olan tüm kullanıcıların yönetimi.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Kullanıcı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple h-[42px]"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Listeyi Yenile"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 h-[42px]">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Pasifler</span>
              <button
                onClick={() => setShowPassive(!showPassive)}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${showPassive ? 'bg-pnr-purple' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <span className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform duration-200 ml-1 mt-0.5 ${showPassive ? 'translate-x-3.5' : 'translate-x-0'}`} />
              </button>
            </div>

            {canEdit && (
              <button
                onClick={handleOpenAddModal}
                className="bg-pnr-purple hover:bg-pnr-indigo text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-pnr-purple/20 flex items-center justify-center gap-2 h-[42px]"
              >
                <UserPlus size={18} />
                <span className="whitespace-nowrap">Yeni Kullanıcı</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-3">
            <RefreshCcw className="animate-spin text-pnr-purple" size={20} />
            Veriler yükleniyor...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-4 w-16 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">#</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer group" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Kullanıcı <SortIcon columnKey="name" /></div>
                  </th>
                  <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer group" onClick={() => handleSort('email')}>
                    <div className="flex items-center gap-1">E-Posta <SortIcon columnKey="email" /></div>
                  </th>
                  <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer group" onClick={() => handleSort('role')}>
                    <div className="flex items-center gap-1">Yetki / Rol <SortIcon columnKey="role" /></div>
                  </th>
                  <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">Doğrulama</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">Durum</th>
                  <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center w-28">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {processedUsers.length > 0 ? (
                  processedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-center">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold shrink-0">
                          {user.name.charAt(0)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-900 dark:text-white uppercase text-sm">{user.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">KAYIT: {user.createdAt}</div>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 text-sm italic">
                        {user.email}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold border uppercase ${getRoleBadgeStyle(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {user.isVerified ? (
                          <div className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/10 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-100 dark:border-green-800/50 uppercase">
                            <CheckCircle2 size={12} /> Onaylı
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-100 dark:border-amber-800/50 uppercase">
                            <Clock size={12} /> Beklemede
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center text-xs font-bold">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            disabled={!canEdit}
                            onClick={() => toggleStatus(user.id, user.status)}
                            className={`relative w-10 h-5 rounded-full transition-all duration-200 ${user.status === 'passive' ? 'bg-slate-300 dark:bg-slate-700' : 'bg-pnr-green'} ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span className={`inline-block w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all duration-200 ${user.status === 'passive' ? 'left-0.5' : 'left-6'}`} />
                          </button>
                          <span className={`text-[9px] uppercase ${user.status === 'active' ? 'text-green-500' : 'text-slate-400'}`}>
                            {user.status === 'active' ? 'AKTİF' : 'PASİF'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            disabled={!canEdit}
                            onClick={() => handleOpenEditModal(user)}
                            className="p-2 text-slate-400 hover:text-pnr-purple hover:bg-pnr-purple/10 rounded-lg transition-colors disabled:opacity-30"
                            title="Düzenle"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            disabled={!canEdit}
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30"
                            title="Sil"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                      Kayıtlı kullanıcı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FORM MODAL (Add / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-pnr-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/40">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield size={20} className="text-pnr-purple" />
                {isEditMode ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Tanımla'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Ad Soyad *</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text" required
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple outline-none"
                    placeholder="Örn: Ahmet Yılmaz"
                  />
                </div>
              </div>

              {!isEditMode && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">E-Posta *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="email" required
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple outline-none"
                        placeholder="ornek@pnrsanat.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Şifre *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text" required
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple outline-none"
                        placeholder="Şifre belirleyiniz"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Kullanıcı Rolü</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple outline-none appearance-none cursor-pointer"
                >
                  {Object.values(UserRole).map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end pt-4 gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-pnr-purple hover:bg-pnr-indigo text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-pnr-purple/20 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : (isEditMode ? <Check size={18} /> : <UserPlus size={18} />)}
                  {submitting ? 'İşleniyor...' : (isEditMode ? 'Güncelle' : 'Kaydet')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;