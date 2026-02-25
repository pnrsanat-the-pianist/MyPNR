
import React, { useState } from 'react';
import { ChevronDown, Disc, Sun, Moon, X, Plus } from 'lucide-react';
import { MENU_ITEMS } from '../../constants';
import { NavItem, UserRole } from '../../types';

interface SidebarProps {
  userRole: UserRole;
  userName?: string; // New Prop
  isOpen: boolean;
  toggleSidebar: () => void;
  onLogout: () => void;
  currentPath: string;
  toggleTheme: () => void;
  isDarkMode: boolean;
  permissions: Record<string, { view: boolean; edit: boolean }>;
}

const Sidebar: React.FC<SidebarProps> = ({ userRole, userName, isOpen, toggleSidebar, onLogout, currentPath, toggleTheme, isDarkMode, permissions }) => {
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [syncedPath, setSyncedPath] = useState<string>('');

  // Auto-expand based on active path
  React.useEffect(() => {
    // Only run if path changed
    const cleanPath = currentPath.split('?')[0];
    if (cleanPath === syncedPath) return;

    const findPathToItem = (items: NavItem[], targetPath: string, parentIds: string[] = []): string[] | null => {
      for (const item of items) {
        // Check direct match
        if (item.path === targetPath) {
          return parentIds;
        }
        // Check children
        if (item.subItems) {
          const found = findPathToItem(item.subItems, targetPath, [...parentIds, item.id]);
          if (found) return found;
        }
      }
      return null;
    };

    const expandedIds = findPathToItem(MENU_ITEMS, cleanPath);
    if (expandedIds) {
      setExpandedMenus(expandedIds);
      setSyncedPath(cleanPath);
    }
  }, [currentPath, syncedPath]);

  const toggleMenu = (id: string, level: number) => {
    if (!isOpen && window.innerWidth >= 768) {
      toggleSidebar();
    }

    if (level === 0) {
      // Main Header Logic: Exclusive Accordion
      setExpandedMenus(prev => {
        const isAlreadyOpen = prev.includes(id);
        if (isAlreadyOpen) {
          // If closing the main item, close everything
          return [];
        } else {
          // If opening, close other main items (by resetting list to just this one)
          return [id];
        }
      });
    } else {
      // Sub-menu Logic: Standard Toggle (can allow multiple sub-sections or not, usually standard toggle is fine inside a section)
      setExpandedMenus(prev =>
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      );
    }
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    const cleanCurrentPath = currentPath.split('?')[0];
    return cleanCurrentPath === path;
  };

  const hasPermission = (item: NavItem) => {
    // 1. Admin always has access
    if (userRole === UserRole.ADMIN) return true;

    // 2. Check dynamic permissions (if resource exists in DB map)
    if (permissions[item.id] !== undefined) {
      return permissions[item.id].view;
    }

    // 3. Fallback to hardcoded roles (legacy support during transition)
    // If no DB record exists, we default to the hardcoded array in constants.ts
    // OR we could default to false. For safety in this hybrid state, we use hardcoded.
    // However, if the permissions object IS populated (meaning we fetched from DB), 
    // and the item is NOT in it, it implies no access (default allow for Dashboard usually).
    if (item.id === 'dashboard') return true;

    // If permissions are loaded but item not found -> hidden (Secure by default)
    if (Object.keys(permissions).length > 0) return false;

    // If permissions failed to load or are empty, fallback to static roles
    if (!item.roles) return true;
    return item.roles.includes(userRole);
  };

  const handleNavigation = (e: React.MouseEvent, path?: string) => {
    e.preventDefault();
    if (!path) return;
    window.location.hash = path;
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  // Recursive Menu Renderer
  const renderMenuItem = (item: NavItem, level: number = 0) => {
    if (!hasPermission(item)) return null;

    const hasSubItems = item.subItems && item.subItems.some(sub => hasPermission(sub)); // Only show parent if at least one child is visible
    // Update: hasSubItems check above ensures empty parents are hidden

    const Icon = item.icon || Disc;
    const showTitle = isOpen || window.innerWidth < 768;
    const active = isActive(item.path);
    const isExpanded = expandedMenus.includes(item.id);

    // Indentation based on level
    const paddingLeft = level === 0 ? 'px-3' : level === 1 ? 'pl-4 pr-3' : 'pl-8 pr-3';

    if (hasSubItems) {
      return (
        <div key={item.id} className="mb-1">
          <button
            onClick={() => toggleMenu(item.id, level)}
            className={`
              w-full flex items-center justify-between ${paddingLeft} py-3 rounded-xl transition-all duration-200 group
              ${isExpanded && showTitle && level === 0 ? 'bg-slate-50 dark:bg-slate-800/50 text-pnr-purple dark:text-pnr-cyan' : ''}
              ${level > 0 ? 'text-sm' : ''}
              ${!isExpanded && level === 0 ? 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}
              ${!isExpanded && level > 0 ? 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white' : ''}
            `}
          >
            <div className={`flex items-center gap-3 ${level > 0 ? 'gap-2' : ''}`}>
              {level === 0 && <Icon size={22} className={`shrink-0 transition-colors duration-200 ${isExpanded ? '' : 'text-slate-500 dark:text-slate-400 group-hover:text-pnr-purple dark:group-hover:text-pnr-cyan'}`} />}
              {showTitle && <span className={`font-semibold ${level > 0 ? 'font-medium' : ''} whitespace-nowrap`}>{item.title}</span>}
            </div>
            {showTitle && (
              <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? '' : '-rotate-90 opacity-40'}`} />
            )}
          </button>

          {showTitle && isExpanded && (
            <div className={`
               mt-1 space-y-0.5 
               ${level === 0 ? 'border-l-2 border-slate-100 dark:border-slate-700 ml-4 pl-0 py-1' : ''} 
               animate-in fade-in slide-in-from-left-2 duration-200
            `}>
              {item.subItems!.map(sub => renderMenuItem(sub, level + 1))}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <a
          key={item.id}
          href={`#${item.path || ''}`}
          onClick={(e) => handleNavigation(e, item.path)}
          className={`
            flex items-center gap-3 ${paddingLeft} py-3 rounded-xl transition-all duration-200 group mb-1
            ${active
              ? 'bg-gradient-to-r from-pnr-purple to-pnr-indigo text-white shadow-lg shadow-pnr-purple/20'
              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'}
          `}
        >
          {level === 0 && <Icon size={22} className={`shrink-0 transition-colors duration-200 ${active ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-pnr-purple dark:group-hover:text-pnr-cyan'}`} />}

          {showTitle && (
            <span className={`
              whitespace-nowrap transition-colors duration-200
              ${level === 0 ? 'font-semibold text-sm' : 'text-sm'}
              ${active ? 'text-white' : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'}
            `}>
              {item.title}
            </span>
          )}
        </a>
      );
    }
  };

  return (
    <div
      className={`
        fixed inset-y-0 left-0 z-[70] 
        flex flex-col 
        bg-white dark:bg-pnr-dark 
        border-r border-slate-200 dark:border-slate-800 
        transition-all duration-300 ease-in-out font-display
        ${isOpen ? 'translate-x-0 w-[280px] md:w-64 shadow-2xl' : '-translate-x-full md:translate-x-0 w-64 md:w-20'}
      `}
    >
      {/* Logo Area */}
      <div className="h-24 md:h-28 flex items-center justify-center px-4 border-b border-slate-200 dark:border-slate-800 relative shrink-0">
        <div className="flex items-center justify-center w-full overflow-hidden">
          <img
            src="https://zzovahjrrjmpoztruezp.supabase.co/storage/v1/object/public/institution-assets/MyPNR%20Logo%20(Seffaf%20Fon)2.png"
            alt="MyPNR Logo"
            className={`transition-all duration-300 object-contain ${isOpen ? 'h-20 md:h-24' : 'h-10 w-10'}`}
          />
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={toggleSidebar}
          className="absolute right-4 md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 custom-scrollbar">
        {MENU_ITEMS.map((item) => renderMenuItem(item))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4 shrink-0 bg-slate-50/50 dark:bg-transparent">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={onLogout}
            className="flex items-center justify-center p-3 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-500 border border-red-100 dark:border-red-900/20 hover:bg-red-100 transition-colors shadow-sm"
          >
            <div className="flex gap-2 items-center">
              <span className="text-xs font-bold md:hidden lg:inline">Çıkış</span>
            </div>
          </button>
        </div>

        {(isOpen || window.innerWidth < 768) && (
          <div className="flex items-center gap-3 p-1">
            <div className="w-10 h-10 rounded-full bg-pnr-purple text-white flex items-center justify-center font-bold shrink-0 shadow-inner">
              {userName ? userName.charAt(0) : userRole.charAt(0)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{userName}</span>
              <span className="text-xs font-bold text-pnr-purple dark:text-pnr-cyan uppercase tracking-wide">{userRole}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
