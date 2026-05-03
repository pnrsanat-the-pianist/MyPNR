
import React, { useState, useEffect } from 'react';
import { Menu, Disc, ShieldAlert, Maximize, Minimize } from 'lucide-react';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Branches from './pages/Management/Branches';
import TeachersHub from './pages/Management/TeachersHub';
import Contracts from './pages/Management/Contracts';
import Todo from './pages/Management/Todo';
import CRM from './pages/Education/CRM';
import Leads from './pages/Management/Leads';
import Users from './pages/System/Users';
import Permissions from './pages/System/Permissions';
import DanceClasses from './pages/Education/DanceClasses';
import InstrumentLessons from './pages/Education/InstrumentLessons';
import Schedule from './pages/Education/Schedule';
import Shows from './pages/Events/Shows';
import FinanceCategories from './pages/Finance/Categories';
import CashBook from './pages/Finance/CashBook';
import Denizbank from './pages/Finance/Denizbank';
import DenizbankPOS from './pages/Finance/DenizbankPOS';
import Vakifbank from './pages/Finance/Vakifbank';
import Profitability from './pages/Finance/Profitability';
import Salaries from './pages/Finance/Salaries';
import Banks from './pages/Finance/Banks';
import CategoryAutomation from './pages/Finance/Automation';
import Settings from './pages/System/Settings';
import { UserRole } from './types';
import { supabase } from './lib/supabaseClient';

// Type for the permission map
type PermissionMap = Record<string, { view: boolean; edit: boolean }>;

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.ADMIN);
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [currentPath, setCurrentPath] = useState(window.location.hash.replace('#', '') || '/');
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(window.location.hash.replace('#', '') || '/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Handle session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsLoggedIn(true);
        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, name')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setUserRole(profile.role as UserRole);
          setUserName(profile.name || session.user.user_metadata?.name || session.user.email || '');
          fetchPermissions(profile.role as UserRole);
        }
      }
    };
    checkSession();
  }, []);

  // Handle fullscreen change events (e.g. user presses Esc)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // --- Permission Logic ---
  const fetchPermissions = async (role: UserRole) => {
    // Admin always has full access, skip DB check to prevent lockout
    if (role === UserRole.ADMIN) {
      setPermissions({}); // Empty object implies "Check Admin Logic" in components
      return;
    }

    setIsLoadingPermissions(true);
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('resource_key, can_view, can_edit')
        .eq('role', role);

      if (error) throw error;

      const permMap: PermissionMap = {};
      if (data) {
        data.forEach((p: any) => {
          permMap[p.resource_key] = { view: p.can_view, edit: p.can_edit };
        });
      }
      setPermissions(permMap);
    } catch (err) {
      console.error("Yetki çekme hatası:", err);
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  const [userName, setUserName] = useState<string>('');

  const handleLogin = async (role: UserRole) => {
    setUserRole(role);
    fetchPermissions(role);
    setIsLoggedIn(true);

    // Fetch User Name
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('name').eq('id', user.id).single();
      if (data && data.name) {
        setUserName(data.name);
      } else if (user.user_metadata?.name) {
        setUserName(user.user_metadata.name);
      } else {
        setUserName(user.email || '');
      }
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setPermissions({});
    window.location.hash = '/login';
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable fullscreen: ${e.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // --- Access Control Helper ---
  // Returns true if User is Admin OR has explicit 'view' permission
  const canView = (resourceId: string) => {
    if (userRole === UserRole.ADMIN) return true;
    // Default dashboard is usually viewable by all logged in, unless explicitly restricted
    if (resourceId === 'dashboard') return permissions['dashboard']?.view ?? true;
    return permissions[resourceId]?.view ?? false;
  };

  // Returns true if User is Admin OR has explicit 'edit' permission
  const getEditPermission = (resourceId: string) => {
    if (userRole === UserRole.ADMIN) return true;
    return permissions[resourceId]?.edit ?? false;
  };

  // Router Logic with Permission Check
  const renderPage = () => {
    const pathBase = currentPath.split('?')[0];

    // Access Denied Component
    const AccessDenied = () => (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center p-6 animate-in fade-in">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert size={40} className="text-red-500 dark:text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Erişim Engellendi</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          Bu sayfayı görüntülemek için yetkiniz bulunmamaktadır.
        </p>
      </div>
    );

    // Helper to check View Permission and pass Edit Permission
    const renderProtectedPage = (resourceId: string, render: (canEdit: boolean) => React.ReactNode) => {
      if (!canView(resourceId)) return <AccessDenied />;
      return <>{render(getEditPermission(resourceId))}</>;
    };

    switch (pathBase) {
      // Dashboard is usually open, but checked against 'dashboard' key
      case '/':
        return renderProtectedPage('dashboard', () => <Dashboard currentUserRole={userRole} />);

      // Management
      case '/management/branches':
        return renderProtectedPage('branslar', (canEdit) => <Branches canEdit={canEdit} />);
      case '/management/teachers':
      case '/management/teachers/candidates':
        return renderProtectedPage('ogretmenler', (canEdit) => <TeachersHub canEdit={canEdit} currentPath={pathBase} />);
      case '/management/contracts':
        return renderProtectedPage('sozlesmeler', (canEdit) => <Contracts canEdit={canEdit} />);
      case '/management/todo':
        return renderProtectedPage('todo', (canEdit) => <Todo canEdit={canEdit} />);

      // Education
      case '/education/crm':
        return renderProtectedPage('crm', (canEdit) => <CRM canEdit={canEdit} />);
      case '/management/leads':
        return renderProtectedPage('yeni-talep', (canEdit) => <Leads currentUserRole={userRole} canEdit={canEdit} />);
      case '/education/dance-classes':
        return renderProtectedPage('bale-siniflari', (canEdit) => <DanceClasses canEdit={canEdit} />);
      case '/education/instrument-lessons':
        return renderProtectedPage('enstruman-dersleri', (canEdit) => <InstrumentLessons currentUserRole={userRole} canEdit={canEdit} />);
      case '/education/schedule':
        return renderProtectedPage('ders-programi', (canEdit) => <Schedule canEdit={canEdit} />);

      // Events
      case '/events/shows':
        return renderProtectedPage('gosteriler', (canEdit) => <Shows canEdit={canEdit} />);

      // Finance
      case '/finance/categories':
        return renderProtectedPage('gelir-gider', (canEdit) => <FinanceCategories canEdit={canEdit} />);
      case '/finance/cashbook':
        return renderProtectedPage('kasa', (canEdit) => <CashBook canEdit={canEdit} />);
      case '/finance/denizbank':
        return renderProtectedPage('denizbank', (canEdit) => <Denizbank canEdit={canEdit} />);
      case '/finance/denizbank-pos':
        return renderProtectedPage('denizbank-pos', (canEdit) => <DenizbankPOS canEdit={canEdit} />);
      case '/finance/vakifbank':
        return renderProtectedPage('vakifbank', (canEdit) => <Vakifbank canEdit={canEdit} />);
      case '/finance/profitability':
        return renderProtectedPage('karlilik', (canEdit) => <Profitability canEdit={canEdit} />);
      case '/finance/salaries':
        return renderProtectedPage('maas', (canEdit) => <Salaries canEdit={canEdit} />);
      case '/finance/banks':
        return renderProtectedPage('bankalar', (canEdit) => <Banks canEdit={canEdit} />);
      case '/finance/automation':
        return renderProtectedPage('category-automation', (canEdit) => <CategoryAutomation canEdit={canEdit} />);

      // System
      case '/system/users':
        return renderProtectedPage('kullanicilar', (canEdit) => <Users canEdit={canEdit} />);
      case '/system/permissions':
        return renderProtectedPage('yetkiler', (canEdit) => <Permissions currentUserRole={userRole} />);
      case '/system/settings':
        return renderProtectedPage('ayarlar', (canEdit) => <Settings canEdit={canEdit} />);

      default:
        return <Dashboard currentUserRole={userRole} />;
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-pnr-dark transition-colors duration-300">
      <Sidebar
        userRole={userRole}
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        onLogout={handleLogout}
        currentPath={currentPath}
        toggleTheme={toggleTheme}
        isDarkMode={isDarkMode}
        permissions={permissions} // Pass dynamic permissions
        userName={userName}
      />

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[65] md:hidden animate-in fade-in duration-300"
          onClick={toggleSidebar}
        />
      )}

      <div className={`transition-all duration-300 ${isSidebarOpen ? 'md:pl-64' : 'md:pl-20'}`}>

        {/* Top Header */}
        <header className="h-16 md:h-20 bg-white/80 dark:bg-pnr-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="md:hidden flex items-center gap-2">
              <img
                src="https://zzovahjrrjmpoztruezp.supabase.co/storage/v1/object/public/institution-assets/MyPNR%20Logo%20(Seffaf%20Fon)2.png"
                alt="MyPNR Logo"
                className="h-8 object-contain"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleFullScreen}
              className="p-2.5 rounded-xl text-slate-400 hover:text-pnr-purple hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hidden sm:block"
              title={isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran Yap"}
            >
              {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="min-h-[calc(100-5rem)]">
          {isLoadingPermissions ? (
            <div className="flex items-center justify-center h-[50vh]">
              <div className="w-10 h-10 border-4 border-pnr-purple/30 border-t-pnr-purple rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              {renderPage()}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
