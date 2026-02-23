
import React, { useState, useRef, useEffect } from 'react';
import {
  Settings as SettingsIcon, ToggleLeft, Save,
  Image, Upload, Trash2, AlertCircle, CheckCircle2,
  Layout, Palette, FileText
} from 'lucide-react';

// --- Types ---
interface LogoConfig {
  id: 'main' | 'sidebar' | 'pdf';
  title: string;
  description: string;
  recommendation: string;
  currentUrl: string | null;
  previewUrl: string | null;
  file: File | null;
}

interface SettingsProps {
  canEdit?: boolean;
}

const Settings: React.FC<SettingsProps> = ({ canEdit = true }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'branding'>('general');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // --- Branding State ---
  // In a real app, initial state comes from DB/Storage
  const [logos, setLogos] = useState<LogoConfig[]>([
    {
      id: 'main',
      title: 'Ana Logo',
      description: 'Giriş ekranı ve yükleme ekranlarında kullanılır.',
      recommendation: 'Önerilen: 512x512px (Kare)',
      currentUrl: null,
      previewUrl: null,
      file: null
    },
    {
      id: 'sidebar',
      title: 'Menü Logosu',
      description: 'Yan menüde (Sidebar) görüntülenen logo.',
      recommendation: 'Önerilen: 200x50px (Yatay) veya İkon',
      currentUrl: null,
      previewUrl: null,
      file: null
    },
    {
      id: 'pdf',
      title: 'Resmi Evrak Logosu',
      description: 'Sözleşme, fatura ve rapor çıktılarında kullanılır.',
      recommendation: 'Önerilen: 300dpi Yüksek Çözünürlük',
      currentUrl: 'https://pnrsanatakademisi.com/wp-content/uploads/2020/09/logo.png', // Example existing
      previewUrl: 'https://pnrsanatakademisi.com/wp-content/uploads/2020/09/logo.png',
      file: null
    }
  ]);

  // Hidden File Inputs Refs
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // --- Handlers ---

  const handleFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Sadece PNG, JPG veya SVG formatları kabul edilir.' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB
      setMessage({ type: 'error', text: 'Dosya boyutu 2MB\'dan küçük olmalıdır.' });
      return;
    }

    // Create Preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogos(prev => prev.map(logo => {
        if (logo.id === id) {
          return {
            ...logo,
            file: file,
            previewUrl: event.target?.result as string
          };
        }
        return logo;
      }));
      setMessage(null); // Clear errors
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = (id: string) => {
    setLogos(prev => prev.map(logo => {
      if (logo.id === id) {
        return {
          ...logo,
          file: null,
          previewUrl: null // Clears the preview, effectively marking for removal on save
        };
      }
      return logo;
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    // Simulate API Call / Upload
    setTimeout(() => {
      setLoading(false);
      setMessage({ type: 'success', text: 'Ayarlar başarıyla kaydedildi.' });

      // Commit previews to "current" (Mock behavior)
      setLogos(prev => prev.map(l => ({
        ...l,
        currentUrl: l.previewUrl,
        file: null
      })));

      setTimeout(() => setMessage(null), 3000);
    }, 1500);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Sayfa Ayarları</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Sistem genel yapılandırma ve görsel tercihler.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-pnr-purple text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-pnr-indigo transition-all shadow-lg shadow-pnr-purple/20 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
          Değişiklikleri Kaydet
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'general'
              ? 'border-pnr-purple text-pnr-purple'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
        >
          <SettingsIcon size={18} /> Genel Ayarlar
        </button>
        <button
          onClick={() => setActiveTab('branding')}
          className={`px-6 py-3 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'branding'
              ? 'border-pnr-purple text-pnr-purple'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
        >
          <Palette size={18} /> Logo & Marka
        </button>
      </div>

      {/* Alert Banner */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 ${message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
            : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
          }`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium text-sm">{message.text}</span>
        </div>
      )}

      {/* --- CONTENT: GENERAL --- */}
      {activeTab === 'general' && (
        <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                <Layout size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Bakım Modu</h3>
                <p className="text-sm text-slate-500 max-w-md mt-1">
                  Aktif edildiğinde sadece Admin yetkisine sahip kullanıcılar sisteme giriş yapabilir. Veli ve Öğretmen panelleri kapatılır.
                </p>
              </div>
            </div>
            <button className="text-slate-300 hover:text-pnr-purple transition-colors">
              <ToggleLeft size={48} />
            </button>
          </div>

          <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl">
                <SettingsIcon size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Yeni Kayıt Alımı</h3>
                <p className="text-sm text-slate-500 max-w-md mt-1">
                  Online ön kayıt formlarını aktif/pasif yapar. Kapalıyken formlara erişim engellenir.
                </p>
              </div>
            </div>
            <button className="text-pnr-green hover:text-green-600 transition-colors">
              <ToggleLeft size={48} className="rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* --- CONTENT: BRANDING (LOGOS) --- */}
      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
          {logos.map((logo) => (
            <div key={logo.id} className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col overflow-hidden">

              {/* Card Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {logo.id === 'pdf' ? <FileText size={18} className="text-pnr-orange" /> : <Image size={18} className="text-pnr-purple" />}
                  {logo.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 min-h-[2.5em]">
                  {logo.description}
                </p>
              </div>

              {/* Preview Area */}
              <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-900/30 flex flex-col items-center justify-center min-h-[200px]">
                <div className="relative group">
                  {logo.previewUrl ? (
                    <div className="relative">
                      {/* Checkered background for transparency visualization */}
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 rounded-lg"></div>
                      <img
                        src={logo.previewUrl}
                        alt={logo.title}
                        className={`max-w-full h-auto max-h-32 object-contain rounded-lg shadow-sm ${logo.id === 'main' ? 'w-24' : ''}`}
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400">
                      <Image size={32} />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-4 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                  {logo.recommendation}
                </p>
              </div>

              {/* Actions Footer */}
              <div className="p-4 bg-white dark:bg-pnr-card border-t border-slate-100 dark:border-slate-800 flex justify-between items-center gap-2">
                <input
                  type="file"
                  ref={(el) => { fileInputRefs.current[logo.id] = el; }}
                  className="hidden"
                  accept=".png, .jpg, .jpeg, .svg"
                  onChange={(e) => handleFileChange(logo.id, e)}
                />

                <button
                  onClick={() => fileInputRefs.current[logo.id]?.click()}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Upload size={14} />
                  {logo.previewUrl ? 'Değiştir' : 'Yükle'}
                </button>

                {logo.previewUrl && (
                  <button
                    onClick={() => handleRemoveLogo(logo.id)}
                    className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors border border-transparent hover:border-red-200"
                    title="Logoyu Kaldır"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default Settings;
