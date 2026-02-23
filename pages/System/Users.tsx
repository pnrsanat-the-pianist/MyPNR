import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus, Search, Shield, Mail, Lock, X, Check,
  Trash2, User as UserIcon, CheckCircle2, Clock,
  ArrowUpDown, ArrowUp, ArrowDown, RefreshCcw
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
  isVerified: boolean; // Derived or default
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassive, setShowPassive] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // New User Form State
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: UserRole.ADMIN
  });

  // --- Data Fetching ---
  const fetchUsers = async () => {
    setLoading(true);
    try {
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
          name: profile.name || 'İsimsiz Kullanıcı',
          email: profile.email || '',
          role: (profile.role as UserRole) || UserRole.OGRETMEN,
          status: profile.status || 'active',
          isVerified: true, // Supabase Auth public tablosuna join yapılamadığı için varsayılan true kabul ediyoruz veya auth flow'a güveniyoruz.
          createdAt: profile.created_at ? new Date(profile.created_at).toLocaleDateString('tr-TR') : '-'
        }));
        setUsers(mappedUsers);
      }
    } catch (error: any) {
      console.error('Error fetching users:', error.message);
      alert('Kullanıcı listesi çekilirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // --- Handlers ---

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) {
      alert("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          email: newUser.email,
          password: newUser.password,
          name: newUser.name,
          role: newUser.role
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      alert(`${newUser.name} başarıyla oluşturuldu!`);
      setIsModalOpen(false);

      // Listeyi yenile
      fetchUsers();

      // Formu temizle
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: UserRole.ADMIN
      });

    } catch (err: any) {
      console.error("Kullanıcı oluşturma hatası:", err);
      alert(`Hata: ${err.message || "Bilinmeyen bir hata oluştu."}`);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'passive' : 'active';

    // Optimistic Update
    setUsers(users.map(u => u.id === id ? { ...u, status: newStatus } : u));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Status update failed:', error);
      alert('Durum güncellenemedi.');
      // Revert logic could be added here
      fetchUsers();
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      try {
        // Optimize: Önce UI'dan kaldır
        const previousUsers = [...users];
        setUsers(users.filter(u => u.id !== id));

        const { data, error } = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'delete',
            userId: id
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

      } catch (error: any) {
        console.error('Delete failed:', error);
        alert(`Silme işlemi başarısız oldu: ${error.message}`);
        fetchUsers(); // Rollback / Refresh
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
      // 1. Passive Filter
      if (!showPassive && user.status === 'passive') return false;

      // 2. Search Filter
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

    // 3. Sorting
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
      case UserRole.OGRETMEN: return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case UserRole.VELI: return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // Helper Component for Sort Icon
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
              className="w-full sm:w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple placeholder:text-slate-400 dark:placeholder:text-slate-500 h-[42px]"
            />
          </div>

          <div className="flex gap-4">
            {/* Refresh Button */}
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Listeyi Yenile"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Passive Toggle Switch */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 h-[42px] flex-1 sm:flex-none justify-between sm:justify-start">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Pasifler</span>
              <button
                onClick={() => setShowPassive(!showPassive)}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${showPassive ? 'bg-pnr-purple' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
              >
                <span
                  className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform duration-200 ml-1 mt-0.5 shadow-sm ${showPassive ? 'translate-x-3.5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {canEdit && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-pnr-purple hover:bg-pnr-indigo text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-pnr-purple/20 flex items-center justify-center gap-2 h-[42px] flex-1 sm:flex-none"
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
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            Yükleniyor...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-4 w-16 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">#</th>

                  <th
                    className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">Kullanıcı <SortIcon columnKey="name" /></div>
                  </th>

                  <th
                    className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group select-none"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-1">E-Posta <SortIcon columnKey="email" /></div>
                  </th>

                  <th
                    className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group select-none"
                    onClick={() => handleSort('role')}
                  >
                    <div className="flex items-center gap-1">Yetki / Rol <SortIcon columnKey="role" /></div>
                  </th>

                  <th
                    className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group select-none"
                    onClick={() => handleSort('isVerified')}
                  >
                    <div className="flex items-center justify-center gap-1">Onay Durumu <SortIcon columnKey="isVerified" /></div>
                  </th>

                  <th
                    className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group select-none"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center justify-center gap-1">Durum <SortIcon columnKey="status" /></div>
                  </th>

                  <th className="p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {processedUsers.length > 0 ? (
                  processedUsers.map((user, index) => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-center">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold shrink-0">
                          {user.name.charAt(0)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-900 dark:text-white">{user.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Kayıt: {user.createdAt}</div>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-sm">
                        {user.email}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${getRoleBadgeStyle(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {user.isVerified ? (
                          <div className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full text-xs font-medium border border-green-100 dark:border-green-800">
                            <CheckCircle2 size={14} /> Doğrulandı
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full text-xs font-medium border border-amber-100 dark:border-amber-800">
                            <Clock size={14} /> Bekliyor
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => canEdit && toggleStatus(user.id, user.status)}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pnr-purple ${user.status === 'passive' ? 'bg-slate-300 dark:bg-slate-600' : 'bg-pnr-green'} ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!canEdit}
                          >
                            <span
                              className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 shadow-sm ${user.status === 'passive' ? 'translate-x-1' : 'translate-x-6'}`}
                            />
                          </button>
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            {user.status === 'active' ? 'Aktif' : 'Pasif'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {canEdit && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Kullanıcıyı Sil"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NEW USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-pnr-card w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">

            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield size={20} className="text-pnr-purple" />
                Yeni Kullanıcı Tanımla
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Ad Soyad *</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text" required
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                    placeholder="Örn: Ahmet Yılmaz"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">E-Posta *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email" required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                    placeholder="ornek@pnrsanat.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Geçici Şifre *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text" required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                    placeholder="Şifre belirleyiniz"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Kullanıcı Tipi (Rol)</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none cursor-pointer"
                >
                  {Object.values(UserRole).map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="bg-pnr-purple hover:bg-pnr-indigo text-white px-6 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-pnr-purple/20 flex items-center gap-2"
                >
                  <Check size={18} />
                  Kaydet ve Davet Et
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