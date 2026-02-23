
import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, Save, CheckCircle2, AlertCircle,
  Eye, Edit3, Layout, CornerDownRight,
  CheckSquare, Square, Check, Lock
} from 'lucide-react';
import { UserRole, NavItem } from '../../types';
import { MENU_ITEMS } from '../../constants';
import { supabase } from '../../lib/supabaseClient';

interface PermissionsProps {
  currentUserRole: UserRole;
}

interface PermissionRecord {
  role: string;
  resource_key: string;
  can_view: boolean;
  can_edit: boolean;
}

// Flattened structure for UI rendering
interface FlatResource {
  id: string;
  title: string;
  level: number;
  hasSubItems: boolean;
  parentId?: string;
}

const Permissions: React.FC<PermissionsProps> = ({ currentUserRole }) => {
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.ADMIN);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [expandedResource, setExpandedResource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // --- ACCESS CONTROL CHECK ---
  if (currentUserRole !== UserRole.ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 animate-in fade-in zoom-in-95">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
          <Lock size={40} className="text-red-500 dark:text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Erişim Engellendi</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          Bu sayfayı görüntülemek ve yetki ayarlarını değiştirmek için <strong>Admin</strong> yetkisine sahip olmanız gerekmektedir.
        </p>
      </div>
    );
  }

  // --- Helpers to Flatten Menu ---
  const flattenMenu = (items: NavItem[], level = 0, parentId?: string): FlatResource[] => {
    let flat: FlatResource[] = [];
    items.forEach(item => {
      flat.push({
        id: item.id,
        title: item.title,
        level: level,
        hasSubItems: !!item.subItems,
        parentId: parentId
      });
      if (item.subItems) {
        flat = [...flat, ...flattenMenu(item.subItems, level + 1, item.id)];
      }
    });
    return flat;
  };

  const resources = useMemo(() => flattenMenu(MENU_ITEMS), []);

  useEffect(() => {
    // Set initial expanded resource (e.g. first one)
    if (resources.length > 0) {
      setExpandedResource(resources[0].id);
    }
  }, [resources]);

  // --- Data Fetching ---
  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('role, resource_key, can_view, can_edit');

      if (error) throw error;
      setPermissions(data || []);
    } catch (err: any) {
      console.error('Error fetching permissions:', err);
      setFeedback({ type: 'error', message: 'Yetkiler yüklenemedi: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  // --- Local Permission Handling ---

  // Get current permission state for a resource & active role
  const getPermission = (resourceId: string) => {
    return permissions.find(p => p.role === activeRole && p.resource_key === resourceId) || {
      role: activeRole,
      resource_key: resourceId,
      can_view: false,
      can_edit: false
    };
  };

  // Toggle Handler
  const handleToggle = (resourceId: string, field: 'can_view' | 'can_edit') => {
    setPermissions(prev => {
      const updatedList = [...prev];

      const updateOrAdd = (id: string, val: boolean) => {
        const idx = updatedList.findIndex(p => p.role === activeRole && p.resource_key === id);
        const record = idx > -1 ? { ...updatedList[idx] } : { role: activeRole, resource_key: id, can_view: false, can_edit: false };

        record[field] = val;

        // Logical constraints
        if (record.can_edit) record.can_view = true;
        if (!record.can_view) record.can_view = false; // Ensure can_view is false if can_edit is false
        if (!record.can_view) record.can_edit = false; // Ensure can_edit is false if can_view is false

        if (idx > -1) updatedList[idx] = record;
        else updatedList.push(record);

        return record;
      };

      // 1. Update the parent
      const parentPerm = updateOrAdd(resourceId, !getPermission(resourceId)[field]);

      // 2. Cascade down to all descendants
      const parentRes = resources.find(r => r.id === resourceId);
      if (parentRes) {
        // Find all descendants by checking levels in the flattened list
        const parentIdx = resources.findIndex(r => r.id === resourceId);
        for (let i = parentIdx + 1; i < resources.length; i++) {
          const child = resources[i];
          if (child.level <= parentRes.level) break; // End of branch

          updateOrAdd(child.id, parentPerm[field]);
        }
      }

      return updatedList;
    });
  };

  // Bulk Actions
  const toggleAll = (field: 'can_view' | 'can_edit', value: boolean) => {
    setPermissions(prev => {
      // Keep other roles as is
      const otherRoles = prev.filter(p => p.role !== activeRole);

      // Generate new permissions for current role for ALL resources
      const newActivePermissions = resources.map(res => {
        const existing = prev.find(p => p.role === activeRole && p.resource_key === res.id);

        const record = {
          role: activeRole,
          resource_key: res.id,
          can_view: existing?.can_view || false,
          can_edit: existing?.can_edit || false
        };

        // Apply bulk change
        if (field === 'can_view') record.can_view = value;
        if (field === 'can_edit') record.can_edit = value;

        // Apply logic rules
        if (record.can_edit) record.can_view = true;
        if (!record.can_view) record.can_edit = false;

        return record;
      });

      return [...otherRoles, ...newActivePermissions];
    });
  };

  // --- Save Changes ---
  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      // We only need to save records that have at least one permission or exist in DB.
      // However, upsert works fine with the whole array.
      // We explicitly map to the DB column structure to be safe.
      const payload = permissions.map(p => ({
        role: p.role,
        resource_key: p.resource_key,
        can_view: p.can_view,
        can_edit: p.can_edit
      }));

      const { error } = await supabase
        .from('role_permissions')
        .upsert(payload, { onConflict: 'role, resource_key' });

      if (error) throw error;

      setFeedback({ type: 'success', message: 'Tüm yetkiler başarıyla veritabanına kaydedildi.' });
      setTimeout(() => setFeedback(null), 3000);

      // Refresh to ensure sync
      fetchPermissions();
    } catch (err: any) {
      console.error('Save error:', err);
      setFeedback({ type: 'error', message: 'Kaydetme sırasında hata oluştu: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Yetki Yönetimi</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">
            Hangi rolün hangi sayfayı görebileceğini ve düzenleyebileceğini belirleyin.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-pnr-purple hover:bg-pnr-indigo text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-pnr-purple/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 ${feedback.type === 'success'
          ? 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
          : 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
          }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Role Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
        {Object.values(UserRole).map((role) => (
          <button
            key={role}
            onClick={() => setActiveRole(role)}
            className={`
              px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all flex items-center gap-2
              ${activeRole === role
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}
            `}
          >
            <Shield size={14} className={activeRole === role ? 'text-pnr-purple' : 'opacity-50'} />
            {role}
          </button>
        ))}
      </div>

      {/* Permissions Table Matrix */}
      <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-280px)]">

        {/* Table Header */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 shrink-0">
          <div className="flex-1 font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider pl-2">
            Sistem Sayfaları / Modüller
          </div>
          <div className="flex gap-8 pr-4">
            {/* View Column Header */}
            <div className="w-24 text-center">
              <div className="flex items-center justify-center gap-2 mb-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                <Eye size={14} /> Görüntüle
              </div>
              <div className="flex justify-center gap-1">
                <button onClick={() => toggleAll('can_view', true)} title="Hepsini Seç" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><CheckSquare size={14} className="text-green-600" /></button>
                <button onClick={() => toggleAll('can_view', false)} title="Hepsini Kaldır" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><Square size={14} className="text-red-500" /></button>
              </div>
            </div>

            {/* Edit Column Header */}
            <div className="w-24 text-center">
              <div className="flex items-center justify-center gap-2 mb-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                <Edit3 size={14} /> Düzenle
              </div>
              <div className="flex justify-center gap-1">
                <button onClick={() => toggleAll('can_edit', true)} title="Hepsini Seç" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><CheckSquare size={14} className="text-green-600" /></button>
                <button onClick={() => toggleAll('can_edit', false)} title="Hepsini Kaldır" className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><Square size={14} className="text-red-500" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-pnr-purple/30 border-t-pnr-purple rounded-full animate-spin"></div>
              <span className="text-slate-500 text-sm">Yetkiler yükleniyor...</span>
            </div>
          </div>
        )}

        {/* Table Body (Scrollable) */}
        {!loading && (
          <div className="flex-1 overflow-y-auto">
            {resources.map((resource) => {
              const perm = getPermission(resource.id);
              const isMainHeader = resource.level === 0;

              // Accordion Logic:
              // If level > 0 (child), only show if its parent is the expandedResource.
              // Note: This logic assumes simple 1-level nesting. If deeper, need recursion check or top-level parent check.
              // Based on constants.ts, depth is max 1 level deeper (level 1).
              if (resource.level > 0 && resource.parentId !== expandedResource) {
                return null;
              }

              return (
                <div
                  key={resource.id}
                  className={`
                                flex items-center p-3 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors select-none
                                ${isMainHeader ? 'cursor-pointer bg-slate-50/80 dark:bg-slate-800/40' : ''}
                            `}
                  onClick={() => {
                    if (isMainHeader) {
                      // Toggle Accordion
                      // If clicking same header, toggle off? Or keep open? User said "diğeri kapansın", implying one always open usually.
                      // But usually accordion allows closing. Let's allowing closing or switching.
                      setExpandedResource(prev => prev === resource.id ? null : resource.id);
                    }
                  }}
                >
                  {/* Page Name */}
                  <div className="flex-1 flex items-center gap-3">
                    <div style={{ paddingLeft: `${resource.level * 24}px` }} className="flex items-center gap-2">
                      {isMainHeader && (
                        <div className={`transition-transform duration-200 ${expandedResource === resource.id ? 'rotate-90' : ''}`}>
                          <CornerDownRight size={14} className="text-slate-400" />
                        </div>
                      )}

                      {!isMainHeader && <div className="w-6" />} {/* Spacer for children alignment */}

                      <div className={`
                                        flex items-center gap-2 
                                        ${isMainHeader ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}
                                    `}>
                        {isMainHeader ? <Layout size={16} className="text-pnr-purple" /> : <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600"></div>}
                        {resource.title}
                      </div>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div
                    className="flex gap-8 pr-6"
                    onClick={(e) => e.stopPropagation()} // Prevent accordion toggle when clicking buttons
                  >
                    {/* View Toggle */}
                    <div className="w-24 flex justify-center">
                      <button
                        onClick={() => handleToggle(resource.id, 'can_view')}
                        className={`
                                            w-10 h-6 rounded-full relative transition-colors duration-200 focus:outline-none
                                            ${perm.can_view ? 'bg-pnr-green' : 'bg-slate-300 dark:bg-slate-700'}
                                        `}
                      >
                        <div className={`
                                            w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 shadow-sm flex items-center justify-center
                                            ${perm.can_view ? 'left-5' : 'left-1'}
                                        `}>
                          {perm.can_view && <Check size={10} className="text-pnr-green" />}
                        </div>
                      </button>
                    </div>

                    {/* Edit Toggle */}
                    <div className="w-24 flex justify-center">
                      <button
                        onClick={() => handleToggle(resource.id, 'can_edit')}
                        className={`
                                            w-10 h-6 rounded-full relative transition-colors duration-200 focus:outline-none
                                            ${perm.can_edit ? 'bg-pnr-purple' : 'bg-slate-300 dark:bg-slate-700'}
                                        `}
                      >
                        <div className={`
                                            w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 shadow-sm flex items-center justify-center
                                            ${perm.can_edit ? 'left-5' : 'left-1'}
                                        `}>
                          {perm.can_edit && <Check size={10} className="text-pnr-purple" />}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Empty spacer at bottom for scrolling */}
            <div className="h-12"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Permissions;
