
import React, { useState, useEffect } from 'react';
import { Menu, Disc, Bell, ShieldAlert } from 'lucide-react';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Branches from './pages/Management/Branches';
import Teachers from './pages/Management/Teachers';
import Contracts from './pages/Management/Contracts';
import Todo from './pages/Management/Todo';
import CRM from './pages/Education/CRM';
import Leads from './pages/Education/Leads';
import Users from './pages/System/Users';
import Permissions from './pages/System/Permissions';
import DanceClasses from './pages/Education/DanceClasses';
import InstrumentLessons from './pages/Education/InstrumentLessons';
import Schedule from './pages/Education/Schedule';
import FinanceCategories from './pages/Finance/Categories';
import CashBook from './pages/Finance/CashBook';
import Denizbank from './pages/Finance/Denizbank';
import DenizbankPOS from './pages/Finance/DenizbankPOS';
import Vakifbank from './pages/Finance/Vakifbank';
import Profitability from './pages/Finance/Profitability';
import Salaries from './pages/Finance/Salaries';
import Banks from './pages/Finance/Banks';
import Settings from './pages/System/Settings';
import { UserRole } from './types';
import { supabase } from './lib/supabaseClient';

// Type for the permission map
type PermissionMap = Record<string, { view: boolean; edit: boolean }>;

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

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.ADMIN);
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [currentPath, setCurrentPath] = useState(window.location.hash.replace('#', '') || '/');
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);

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

  const handleLogin = (role: UserRole) => {
    setUserRole(role);
    fetchPermissions(role);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setPermissions({});
    window.location.hash = '/login';
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleTheme = () => setIsDarkMode(!isDarkMode);

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

  // Helper to render protected pages
  const renderProtectedPage = (resourceId: string, render: (canEdit: boolean) => React.ReactNode) => {
      if (!canView(resourceId)) return <AccessDenied />;
      return <>{render(getEditPermission(resourceId))}</>;
  };

  // Router Logic with Permission Check
  const renderPage = () => {
    const pathBase = currentPath.split('?')[0];

    switch (pathBase) {
      // Dashboard is usually open, but checked against 'dashboard' key
      case '/': 
        return renderProtectedPage('dashboard', () => <Dashboard />);
      
      // Management
      case '/management/branches': 
        return renderProtectedPage('branslar', (canEdit) => <Branches />); 
      case '/management/teachers': 
        return renderProtectedPage('ogretmenler', (canEdit) => <Teachers />);
      case '/management/contracts': 
        return renderProtectedPage('sozlesmeler', (canEdit) => <Contracts />);
      case '/management/todo': 
        return renderProtectedPage('todo', (canEdit) => <Todo />);
      
      // Education
      case '/education/crm': 
        return renderProtectedPage('crm', (canEdit) => <CRM canEdit={canEdit} />);
      case '/education/leads': 
        return renderProtectedPage('yeni-talep', (canEdit) => <Leads />);
      case '/education/dance-classes': 
        return renderProtectedPage('bale-siniflari', (canEdit) => <DanceClasses />);
      case '/education/instrument-lessons': 
        // Special case: Attendance passes currentUserRole inside, but we can also pass canEdit
        return renderProtectedPage('enstruman-dersleri', (canEdit) => <InstrumentLessons currentUserRole={userRole} canEdit={canEdit} />);
      case '/education/schedule': 
        return renderProtectedPage('ders-programi', (canEdit) => <Schedule />);
      
      // Finance
      case '/finance/categories': 
        return renderProtectedPage('gelir-gider', (canEdit) => <FinanceCategories />);
      case '/finance/cashbook': 
        return renderProtectedPage('kasa', (canEdit) => <CashBook />);
      case '/finance/denizbank': 
        return renderProtectedPage('denizbank', (canEdit) => <Denizbank />);
      case '/finance/denizbank-pos': 
        return renderProtectedPage('denizbank-pos', (canEdit) => <DenizbankPOS />);
      case '/finance/vakifbank': 
        return renderProtectedPage('vakifbank', (canEdit) => <Vakifbank />);
      case '/finance/profitability': 
        return renderProtectedPage('karlilik', (canEdit) => <Profitability />);
      case '/finance/salaries': 
        return renderProtectedPage('maas', (canEdit) => <Salaries />);
      case '/finance/banks': 
        return renderProtectedPage('denizbank', (canEdit) => <Banks />); // Reusing generic bank permission or specific
      
      // System
      case '/system/users': 
        return renderProtectedPage('kullanicilar', (canEdit) => <Users />);
      case '/system/permissions': 
        return renderProtectedPage('yetkiler', (canEdit) => <Permissions currentUserRole={userRole} />);
      case '/system/settings': 
        return renderProtectedPage('ayarlar', (canEdit) => <Settings />);
      
      default: 
        return <Dashboard />;
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
               <Disc className="text-pnr-purple" size={24} />
               <span className="font-display font-bold text-slate-900 dark:text-white">MyPNR</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="p-2.5 rounded-xl text-slate-400 hover:text-pnr-purple hover:bg-slate-100 dark:hover:bg-slate-800 relative transition-all">
              <Bell size={22} />
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-pnr-red border-2 border-white dark:border-pnr-dark rounded-full"></span>
            </button>
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:ring-2 hover:ring-pnr-purple transition-all hidden sm:block">
              <div className="w-full h-full flex items-center justify-center font-bold text-slate-500">
                {userRole.charAt(0)}
              </div>
            </div>
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
