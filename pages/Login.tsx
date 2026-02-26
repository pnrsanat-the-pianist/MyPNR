import React, { useState } from 'react';
import {
  Disc, ArrowRight, AlertCircle, KeyRound, Mail, Lock, CheckCircle2
} from 'lucide-react';
import { UserRole } from '../types';
import { supabase } from '../lib/supabaseClient';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  // --- LOGIN FLOW ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      // 1. Supabase Auth ile giriş yap
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          throw new Error('E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.');
        }
        throw new Error(signInError.message);
      }

      const authUser = signInData.user;
      if (!authUser) {
        throw new Error('Kullanıcı doğrulanamadı.');
      }

      // 2. Profil tablosundan rol ve durum bilgisini çek
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        console.error("Profil Hatası:", profileError);

        // Sonsuz döngü hatası kontrolü
        if (profileError.message.includes("infinite recursion")) {
          throw new Error("Veritabanı politika hatası. Lütfen yönetici ile iletişime geçin.");
        }

        // Profil bulunamazsa otomatik oluştur
        if (profileError.code === 'PGRST116') {
          console.warn("Profil bulunamadı, otomatik oluşturuluyor...");

          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email,
              name: authUser.user_metadata?.name || email.split('@')[0],
              role: 'Veli',
              status: 'active'
            });

          if (insertError) {
            if (insertError.message.includes('relation "public.profiles" does not exist')) {
              throw new Error("Veritabanı tabloları bulunamadı. Lütfen yönetici ile iletişime geçin.");
            }
            console.error("Insert Error:", insertError);
            throw new Error('Profil oluşturulamadı. Lütfen yönetici ile iletişime geçin.');
          }

          onLogin(UserRole.VELI);
          window.location.hash = '/';
          return;
        }

        if (profileError.message.includes('relation "public.profiles" does not exist')) {
          throw new Error("Veritabanı kurulumu eksik. Lütfen yönetici ile iletişime geçin.");
        }

        throw new Error("Profil bilgileri alınamadı: " + profileError.message);
      }

      // 3. Durum kontrolü
      if (profileData.status === 'passive') {
        throw new Error('Hesabınız pasif durumdadır. Yönetici ile iletişime geçin.');
      }

      // 4. Giriş başarılı
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
      setLoading(false);
    }
  };

  // --- FORGOT PASSWORD FLOW ---
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!forgotEmail) {
      setError('Lütfen e-posta adresinizi girin.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setSuccessMessage('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.');
    } catch (err: any) {
      console.error("Password Reset Error:", err);
      setError(err.message || 'Şifre sıfırlama işlemi başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-pnr-dark flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">

      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pnr-purple/5 dark:bg-pnr-purple/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-pnr-indigo/5 dark:bg-pnr-indigo/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300 my-8">

        {/* Logo & Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-16 h-16 flex items-center justify-center mb-4">
            <Disc className="w-16 h-16 text-pnr-purple absolute" />
            <div className="w-10 h-10 rounded-full border-2 border-pnr-yellow absolute"></div>
            <div className="w-4 h-4 rounded-full bg-pnr-red absolute"></div>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">MyPNR</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {showForgotPassword ? 'Şifre Sıfırlama' : 'PNR Sanat Akademisi Yönetim Paneli'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3 animate-in slide-in-from-top-1 mb-4">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-600 dark:text-red-400 leading-snug">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-start gap-3 animate-in slide-in-from-top-1 mb-4">
            <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-green-600 dark:text-green-400 leading-snug">{successMessage}</p>
          </div>
        )}

        {/* FORGOT PASSWORD VIEW */}
        {showForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Kayıtlı e-posta adresinizi girin, size şifre sıfırlama bağlantısı göndereceğiz.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-Posta</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  placeholder="ornek@pnrsanat.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pnr-purple to-pnr-indigo text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-pnr-purple/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Gönderiliyor...' : (
                <>
                  Sıfırlama Bağlantısı Gönder
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-pnr-purple hover:text-pnr-indigo font-bold text-sm hover:underline"
              >
                ← Giriş Sayfasına Dön
              </button>
            </div>
          </form>
        ) : (
          /* LOGIN VIEW */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-Posta</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  placeholder="ornek@pnrsanat.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Şifre</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-pnr-purple transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-pnr-purple focus:ring-pnr-purple" />
                <span className="text-slate-600 dark:text-slate-400">Beni Hatırla</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setForgotEmail(email); // Varsa email'i geçir
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-pnr-cyan hover:underline font-medium"
              >
                Şifremi Unuttum
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pnr-purple to-pnr-indigo text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-pnr-purple/25 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Giriş Yapılıyor...' : (
                <>
                  Giriş Yap
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Info Notice */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
            <KeyRound size={16} className="text-pnr-purple shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Hesap oluşturma işlemi yalnızca sistem yöneticileri tarafından yapılabilir.
              Erişim talepleriniz için yöneticiniz ile iletişime geçin.
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          <p>&copy; 2026 PNR Sanat Akademisi. Tüm hakları saklıdır.</p>
        </div>
      </div >
    </div >
  );
};

export default Login;