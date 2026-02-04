import React, { useState } from 'react';
import { 
  Disc, ArrowRight, AlertCircle, LogIn, UserPlus, 
  Shield, Briefcase, GraduationCap, Users, User, Glasses 
} from 'lucide-react';
import { UserRole } from '../types';
import { supabase } from '../lib/supabaseClient';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // New state for registration
  const [isSignUp, setIsSignUp] = useState(false); // Toggle state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- CENTRALIZED AUTH LOGIC ---
  const handleAuthProcess = async (
    targetEmail: string, 
    targetPassword: string, 
    isSignUpMode: boolean, 
    targetName?: string
  ) => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      let authUser;

      if (isSignUpMode) {
        // --- REGISTER FLOW ---
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: targetEmail,
          password: targetPassword,
          options: {
            data: {
              name: targetName,
            },
          },
        });

        if (signUpError) throw new Error(signUpError.message);

        // Check if email confirmation is required
        if (signUpData.user && !signUpData.session) {
          setSuccessMessage('Kayıt başarılı! Lütfen e-posta adresinize gönderilen doğrulama linkine tıklayın.');
          setLoading(false);
          return;
        }

        authUser = signUpData.user;
      } else {
        // --- LOGIN FLOW ---
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: targetPassword,
        });

        if (signInError) {
          if (signInError.message.includes("Invalid login credentials")) {
             throw new Error('E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.');
          }
          throw new Error(signInError.message);
        }

        authUser = signInData.user;
      }

      if (!authUser) {
        throw new Error('Kullanıcı doğrulanamadı.');
      }

      // --- PROFILE CHECK & SELF-HEALING ---
      // 2. Fetch User Role from 'profiles' table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', authUser.id)
        .single();

      // Hata Yönetimi: Veritabanı tablosu yoksa veya erişim hatası varsa
      if (profileError) {
        console.error("Profil Hatası:", profileError);
        
        // RECURSION ERROR CHECK
        if (profileError.message.includes("infinite recursion")) {
             throw new Error("Veritabanı politika hatası (Infinite Recursion). Lütfen 'docs/fix_rls_recursion.sql' kodunu Supabase SQL Editöründe çalıştırın.");
        }

        // Eğer profil yoksa (Trigger çalışmadıysa veya tablo yeni oluşturulduysa)
        if (profileError.code === 'PGRST116') { // No rows found
             console.warn("Kullanıcı auth tablosunda var ama profiles tablosunda yok. Oluşturuluyor...");
             
             const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: authUser.id,
                  email: authUser.email,
                  name: authUser.user_metadata?.name || targetEmail.split('@')[0],
                  role: 'Admin', // Default to Admin for self-healing/demo purposes
                  status: 'active'
                });
                
             if (insertError) {
                 if (insertError.message.includes('relation "public.profiles" does not exist')) {
                    throw new Error("Veritabanı tabloları bulunamadı. Lütfen 'setup_database.sql' kodunu Supabase'de çalıştırın.");
                 }
                 console.error("Insert Error:", insertError);
                 throw new Error('Profil oluşturulamadı. Lütfen yönetici ile iletişime geçin.');
             }
             
             // Başarılı kurtarma sonrası giriş
             onLogin(UserRole.ADMIN);
             window.location.hash = '/';
             return;
        }
        
        if (profileError.message.includes('relation "public.profiles" does not exist')) {
            throw new Error("Veritabanı kurulumu eksik. Lütfen 'setup_database.sql' kodunu Supabase SQL Editöründe çalıştırın.");
        }

        throw new Error("Profil bilgileri alınamadı: " + profileError.message);
      }

      // 3. Durum Kontrolü
      if (profileData.status === 'passive') {
        throw new Error('Hesabınız pasif durumdadır. Yönetici ile iletişime geçin.');
      }

      // 4. Giriş Başarılı
      if (profileData && profileData.role) {
        onLogin(profileData.role as UserRole);
        window.location.hash = '/';
      } else {
        throw new Error('Kullanıcı rolü tanımlanmamış.');
      }

    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(err.message || 'İşlem sırasında bir hata oluştu.');
    } finally {
      if (!successMessage) setLoading(false);
    }
  };

  // Standard Form Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAuthProcess(email, password, isSignUp, name);
  };

  // Specific Admin Login Handler
  const handlePinarAdminLogin = () => {
    const adminEmail = 'pinar@pnrsanat.com';
    const adminPass = '22112211';
    
    // UI Feedback
    setEmail(adminEmail);
    setPassword(adminPass);
    setIsSignUp(false);
    
    // Trigger Real Auth
    handleAuthProcess(adminEmail, adminPass, false);
  };

  // Generic Demo Login (Bypass Auth for other roles)
  const handleDemoLogin = (role: UserRole) => {
    // Bypass authentication for demo/testing purposes
    onLogin(role);
    window.location.hash = '/';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-pnr-dark flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pnr-purple/5 dark:bg-pnr-purple/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-pnr-indigo/5 dark:bg-pnr-indigo/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300 my-8">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-16 h-16 flex items-center justify-center mb-4">
             <Disc className="w-16 h-16 text-pnr-purple absolute" />
             <div className="w-10 h-10 rounded-full border-2 border-pnr-yellow absolute"></div>
             <div className="w-4 h-4 rounded-full bg-pnr-red absolute"></div>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">MyPNR</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {isSignUp ? 'Yeni Hesap Oluştur' : 'PNR Sanat Akademisi Yönetim Paneli'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3 animate-in slide-in-from-top-1">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-600 dark:text-red-400 leading-snug">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-start gap-3 animate-in slide-in-from-top-1">
              <AlertCircle className="text-green-500 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-green-600 dark:text-green-400 leading-snug">{successMessage}</p>
            </div>
          )}

          {isSignUp && (
            <div className="animate-in slide-in-from-top-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ad Soyad</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                placeholder="Adınız Soyadınız"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-Posta</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
              placeholder="ornek@pnrsanat.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Şifre</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
              placeholder="••••••••"
            />
          </div>

          {!isSignUp && (
            <div className="flex items-center justify-between text-sm">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input type="checkbox" className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-pnr-purple focus:ring-pnr-purple" />
                 <span className="text-slate-600 dark:text-slate-400">Beni Hatırla</span>
               </label>
               <a href="#" className="text-pnr-cyan hover:underline">Şifremi Unuttum</a>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-pnr-purple to-pnr-indigo text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-pnr-purple/25 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'İşlem Yapılıyor...' : (
              <>
                {isSignUp ? 'Kayıt Ol' : 'Giriş Yap'} 
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
                {isSignUp ? 'Zaten bir hesabınız var mı?' : 'Hesabınız yok mu?'}
            </p>
            <button 
                onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                    setSuccessMessage(null);
                }}
                className="text-pnr-purple hover:text-pnr-indigo font-bold text-sm hover:underline"
            >
                {isSignUp ? 'Giriş Yap' : 'Yeni Hesap Oluştur'}
            </button>
        </div>

        {/* --- DEMO SHORTCUTS --- */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
           <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center mb-4">
             Hızlı Giriş
           </h3>
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* ADMIN BUTTON - UPDATED TO USE REAL CREDENTIALS */}
              <button 
                onClick={handlePinarAdminLogin}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group"
                title="Pınar Admin Girişi"
              >
                <Shield size={20} className="text-red-600 dark:text-red-400 mb-1" />
                <span className="text-[10px] font-bold text-red-800 dark:text-red-300">Admin</span>
              </button>

              <button 
                onClick={() => handleDemoLogin(UserRole.KURUCU)}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                <Glasses size={20} className="text-purple-600 dark:text-purple-400 mb-1" />
                <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300">Kurucu</span>
              </button>

              <button 
                onClick={() => handleDemoLogin(UserRole.MUDUR)}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <Briefcase size={20} className="text-indigo-600 dark:text-indigo-400 mb-1" />
                <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300">Müdür</span>
              </button>

              <button 
                onClick={() => handleDemoLogin(UserRole.OGRETMEN)}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <GraduationCap size={20} className="text-blue-600 dark:text-blue-400 mb-1" />
                <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300">Öğretmen</span>
              </button>

              <button 
                onClick={() => handleDemoLogin(UserRole.VELI)}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              >
                <Users size={20} className="text-green-600 dark:text-green-400 mb-1" />
                <span className="text-[10px] font-bold text-green-800 dark:text-green-300">Veli</span>
              </button>

              <button 
                onClick={() => handleDemoLogin(UserRole.PERSONEL)}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <User size={20} className="text-slate-600 dark:text-slate-400 mb-1" />
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Personel</span>
              </button>
           </div>
        </div>

        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          <p>&copy; 2024 PNR Sanat Akademisi. Tüm hakları saklıdır.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;