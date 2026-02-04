import React, { useState, useRef, useEffect } from 'react';
import {
  FileText, Settings, Printer, Save, PenTool,
  Calendar, User, Layers, CreditCard, ChevronDown, CheckCircle2,
  Search, X, RefreshCcw, Download
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// --- Types ---

interface ContractSettings {
  id?: string;
  generalRules: string;
  holidayDates: string;
  paymentPolicy: string;
  branchRules: {
    music: string; // Enstrüman
    dance: string; // Bale/Dans
  };
}

interface ContractFormData {
  studentName: string;
  studentTc: string;
  studentDob: string;
  branch: string; // Sub branch name (e.g. Piyano)
  mainBranch: string; // Main branch name (e.g. Enstrüman) used for rule logic
  startDate: string;
  parentName: string;
  parentTc: string;
  parentPhone: string;
}

// --- Default Templates ---
const DEFAULT_SETTINGS: ContractSettings = {
  generalRules: `1. Kurumumuzda eğitim öğretim faaliyetleri MEB standartlarına uygun olarak yürütülür.
2. Öğrenci, ders saatinden en az 10 dakika önce kurumda hazır bulunmalıdır.
3. Kurum demirbaşlarına verilen zararlar veli tarafından tazmin edilir.
4. Kayıt dondurma işlemleri en az 15 gün önceden yazılı olarak bildirilmelidir.`,

  holidayDates: `1. Resmi tatillerde ders yapılmaz, bu derslerin telafisi kurumun belirlediği tarihlerde yapılır.
2. Sömestr tatili MEB takvimine göre uygulanır.
3. Yaz dönemi (Temmuz-Ağustos) çalışma saatleri ayrıca duyurulur.`,

  paymentPolicy: `1. Ödemeler her ayın ilk 5 iş günü içerisinde yapılmalıdır.
2. 10 haftalık paket programlarda ücret peşin veya kredi kartına taksit ile tahsil edilir.
3. Mazeretsiz devamsızlıklar ücrete tabidir, iade yapılmaz.
4. Kayıt iptallerinde, işlenmemiş derslerin ücret iadesi %10 kesinti ile yapılır.`,

  branchRules: {
    music: `1. Enstrüman dersleri birebir (özel) ders olarak yapılır.
2. Öğrenci kendi enstrümanını (piyano ve bateri hariç) getirmekle yükümlüdür.
3. Her kur (10 hafta) sonunda öğrenci gelişim raporu verilir.
4. Bir dönem içerisinde mazeretli olarak en fazla 1 ders telafi hakkı bulunur.`,
    dance: `1. Bale ve Dans dersleri grup eğitimi olarak yapılır.
2. Kıyafet zorunluluğu vardır (May, çorap, pisi pisi vb.).
3. Grup derslerinde telafi imkanı bulunmamaktadır.
4. Yıl sonu gösterisine katılım zorunludur ve kostüm giderleri veliye aittir.`
  }
};

const INITIAL_FORM: ContractFormData = {
  studentName: '',
  studentTc: '',
  studentDob: '',
  branch: '',
  mainBranch: '',
  startDate: new Date().toISOString().split('T')[0],
  parentName: '',
  parentTc: '',
  parentPhone: ''
};

const Contracts: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generator' | 'settings'>('generator');
  const [settings, setSettings] = useState<ContractSettings>(DEFAULT_SETTINGS);
  const [formData, setFormData] = useState<ContractFormData>(INITIAL_FORM);

  // Student Search States
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const componentRef = useRef<HTMLDivElement>(null);

  // Native Print Function
  const handlePrint = () => {
    window.print();
  };

  // --- Data Fetching ---
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, tc_no, dob, main_branch, sub_branch, start_date, parent1_name, parent1_tc, parent1_phone')
        .eq('status', 'active')
        .order('full_name');

      if (error) throw error;
      setStudentsList(data || []);
      setFilteredStudents(data || []);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Ignore "no rows" error
          console.error("Error fetching contract settings:", error);
        }
        return;
      }

      if (data) {
        setSettings({
          id: data.id,
          generalRules: data.general_rules || DEFAULT_SETTINGS.generalRules,
          holidayDates: data.holiday_dates || DEFAULT_SETTINGS.holidayDates,
          paymentPolicy: data.payment_policy || DEFAULT_SETTINGS.paymentPolicy,
          branchRules: {
            music: data.branch_rules_music || DEFAULT_SETTINGS.branchRules.music,
            dance: data.branch_rules_dance || DEFAULT_SETTINGS.branchRules.dance
          }
        });
      }
    } catch (err) {
      console.error("Error in settings fetch:", err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchSettings();
  }, []);

  // Filter Logic
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStudents(studentsList);
    } else {
      const lowerTerm = searchTerm.toLowerCase();
      setFilteredStudents(studentsList.filter(s =>
        s.full_name.toLowerCase().includes(lowerTerm) ||
        (s.parent1_name && s.parent1_name.toLowerCase().includes(lowerTerm))
      ));
    }
  }, [searchTerm, studentsList]);

  const handleSelectStudent = (student: any) => {
    setSelectedStudentId(student.id);
    setFormData({
      studentName: student.full_name,
      studentTc: student.tc_no || '',
      studentDob: student.dob || '',
      branch: student.sub_branch || '',
      mainBranch: student.main_branch || '',
      startDate: student.start_date || new Date().toISOString().split('T')[0],
      parentName: student.parent1_name || '',
      parentTc: student.parent1_tc || '',
      parentPhone: student.parent1_phone || ''
    });
    setIsSearching(false);
  };

  const handleClearSelection = () => {
    setSelectedStudentId(null);
    setFormData(INITIAL_FORM);
  };

  const getBranchRuleText = () => {
    // Determine rules based on Main Branch logic
    const mb = formData.mainBranch;
    if (mb === 'Enstrüman') return settings.branchRules.music;
    if (mb === 'Bale / Dans') return settings.branchRules.dance;

    // Fallback based on text match if main branch is missing or custom
    if (formData.branch.includes('Bale') || formData.branch.includes('Dans')) return settings.branchRules.dance;

    return settings.branchRules.music; // Default fallback
  };

  const handleSettingChange = (field: keyof ContractSettings | 'music' | 'dance', value: string) => {
    if (field === 'music' || field === 'dance') {
      setSettings(prev => ({
        ...prev,
        branchRules: { ...prev.branchRules, [field]: value }
      }));
    } else {
      setSettings(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const payload = {
        general_rules: settings.generalRules,
        holiday_dates: settings.holidayDates,
        payment_policy: settings.paymentPolicy,
        branch_rules_music: settings.branchRules.music,
        branch_rules_dance: settings.branchRules.dance,
        updated_at: new Date().toISOString()
      };

      let result: { data: ContractSettings | null; error: any };

      if (settings.id) {
        // Update existing
        result = await supabase
          .from('contract_settings')
          .update(payload)
          .eq('id', settings.id)
          .select()
          .single();
      } else {
        // Insert new (should rarely happen if initialized correctly)
        result = await supabase
          .from('contract_settings')
          .insert(payload)
          .select()
          .single();

        // If inserted, update local ID
        if (result.data) {
          setSettings(prev => ({ ...prev, id: result.data!.id }));
        }
      }

      if (result.error) throw result.error;
      alert("Sözleşme ayarları başarıyla kaydedildi.");

    } catch (err: any) {
      console.error("Save Error:", err);
      alert("Ayarlar kaydedilirken hata oluştu: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // --- Contract Preview Component ---
  // Added id="contract-preview" for specific printing logic via index.html CSS
  const ContractDocument = React.forwardRef<HTMLDivElement>((props, ref) => (
    <div id="contract-preview" ref={ref} className="bg-white text-black p-8 md:p-12 shadow-2xl max-w-[210mm] min-h-[297mm] mx-auto text-sm leading-relaxed relative print:shadow-none print:w-full print:max-w-none print:h-auto">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8 border-b-2 border-slate-800 pb-4">
        {/* Updated Logo Section */}
        <div className="shrink-0">
          <img
            src="https://pnrsanatakademisi.com/wp-content/uploads/2020/09/logo.png"
            alt="PNR Sanat Akademisi"
            className="h-20 w-auto object-contain"
            onError={(e) => {
              // Fallback if image fails to load
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          {/* Fallback Icon */}
          <div className="w-20 h-20 bg-slate-900 rounded-full hidden flex items-center justify-center text-white font-bold text-3xl">P</div>
        </div>

        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-pnr-purple">PNR Sanat Akademisi</h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">MEB Kadıköy Özel Pınar Sanat Bale ve Müzik Okulu</p>
        </div>
        <div className="ml-auto text-right text-xs text-slate-500">
          <p>Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
          <p>No: {Date.now().toString().slice(-6)}</p>
        </div>
      </div>

      <h2 className="text-center font-bold text-lg mb-6 uppercase border-b border-slate-200 pb-2">Öğrenci Kayıt Sözleşmesi</h2>

      {/* Student Info Table */}
      <div className="mb-6 border border-slate-300 rounded-lg overflow-hidden">
        <div className="grid grid-cols-4 bg-slate-100 border-b border-slate-300 text-xs font-bold uppercase print:bg-slate-200">
          <div className="p-2 border-r border-slate-300">Öğrenci Adı</div>
          <div className="p-2 border-r border-slate-300">TC Kimlik</div>
          <div className="p-2 border-r border-slate-300">Doğum Tarihi</div>
          <div className="p-2">Branş</div>
        </div>
        <div className="grid grid-cols-4 text-sm">
          <div className="p-2 border-r border-slate-300 font-medium">{formData.studentName || '................................'}</div>
          <div className="p-2 border-r border-slate-300 font-mono">{formData.studentTc || '...................'}</div>
          <div className="p-2 border-r border-slate-300">{formData.studentDob ? new Date(formData.studentDob).toLocaleDateString('tr-TR') : '.../.../....'}</div>
          <div className="p-2 font-bold">{formData.branch || '...................'}</div>
        </div>
      </div>

      {/* Contract Body */}
      <div className="space-y-4 text-xs text-justify">

        <section>
          <h3 className="font-bold text-sm mb-1 uppercase text-slate-800">1. Genel Hükümler</h3>
          <p className="whitespace-pre-line">{settings.generalRules}</p>
        </section>

        <section>
          <h3 className="font-bold text-sm mb-1 uppercase text-slate-800">2. Tatil ve Çalışma Takvimi</h3>
          <p className="whitespace-pre-line">{settings.holidayDates}</p>
        </section>

        <section>
          <h3 className="font-bold text-sm mb-1 uppercase text-slate-800">3. {formData.branch || 'Branş'} Bölümü Özel Kuralları</h3>
          <p className="whitespace-pre-line">{getBranchRuleText()}</p>
        </section>

        <section>
          <h3 className="font-bold text-sm mb-1 uppercase text-slate-800">4. Ücretlendirme ve İade</h3>
          <p className="whitespace-pre-line">{settings.paymentPolicy}</p>
        </section>

        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 text-[10px] italic">
          * İşbu sözleşme, kurum ve veli arasında karşılıklı mutabakat ile imzalanmıştır. Veli, yukarıdaki maddeleri okuduğunu ve kabul ettiğini beyan eder.
          Eğitim başlangıç tarihi: <strong>{formData.startDate ? new Date(formData.startDate).toLocaleDateString('tr-TR') : '.../.../....'}</strong>
        </div>

      </div>

      {/* Signature Area */}
      <div className="mt-12 flex justify-between items-start">
        <div className="text-center w-1/3">
          <p className="font-bold mb-8">Kurum Yetkilisi</p>
          <div className="h-16"></div>
          <p className="text-xs">Kaşe / İmza</p>
        </div>

        <div className="w-1/3 border border-slate-300 rounded-lg p-4 bg-slate-50 print:bg-transparent">
          <p className="font-bold text-sm mb-2 uppercase border-b border-slate-200 pb-1">Veli Bilgileri & Onay</p>
          <div className="space-y-1 text-xs mb-8">
            <div className="flex justify-between">
              <span className="text-slate-500">Ad Soyad:</span>
              <span className="font-bold">{formData.parentName || '.......................'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">TC Kimlik:</span>
              <span className="font-mono">{formData.parentTc || '.......................'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Telefon:</span>
              <span className="font-mono">{formData.parentPhone || '.......................'}</span>
            </div>
          </div>
          <div className="text-center pt-4 border-t border-slate-200 border-dashed">
            <p className="text-xs font-bold text-slate-400">İmza</p>
          </div>
        </div>
      </div>

    </div>
  ));

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Sözleşme Yönetimi</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">
            Öğrenci kayıt sözleşmeleri oluşturma, düzenleme ve yazdırma.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('generator')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'generator' ? 'bg-white dark:bg-slate-700 shadow-sm text-pnr-purple' : 'text-slate-500 dark:text-slate-400'}`}
          >
            <PenTool size={16} /> Sözleşme Oluştur
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'bg-white dark:bg-slate-700 shadow-sm text-pnr-purple' : 'text-slate-500 dark:text-slate-400'}`}
          >
            <Settings size={16} /> Şablon Ayarları
          </button>
        </div>
      </div>

      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left: Input Form / Selector */}
          <div className="lg:col-span-4 space-y-6">

            {/* STUDENT SELECTOR CARD */}
            <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                <User size={20} className="text-pnr-purple" />
                Öğrenci Seçimi
              </h3>

              {!selectedStudentId ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">Sözleşme oluşturmak için listeden öğrenci seçiniz.</p>

                  <div className="relative z-20">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        placeholder="Öğrenci ara..."
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pnr-purple dark:text-white"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setIsSearching(true);
                        }}
                        onFocus={() => setIsSearching(true)}
                      />
                    </div>

                    {isSearching && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[300px] overflow-y-auto custom-scrollbar z-50">
                        {filteredStudents.length > 0 ? (
                          filteredStudents.map(student => (
                            <button
                              key={student.id}
                              onClick={() => handleSelectStudent(student)}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700/50 last:border-0 transition-colors"
                            >
                              <div className="font-bold text-slate-800 dark:text-white text-sm">{student.full_name}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between mt-1">
                                <span>{student.sub_branch || 'Branş Yok'}</span>
                                <span>Veli: {student.parent1_name || '-'}</span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-sm text-slate-500">
                            Öğrenci bulunamadı.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-slate-400">{filteredStudents.length} öğrenci listelendi</span>
                    <button onClick={fetchStudents} className="text-xs flex items-center gap-1 text-pnr-purple hover:underline">
                      <RefreshCcw size={12} /> Yenile
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 relative">
                  <button
                    onClick={handleClearSelection}
                    className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1"
                    title="Seçimi Kaldır"
                  >
                    <X size={16} />
                  </button>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-pnr-purple text-white flex items-center justify-center font-bold text-sm">
                      {formData.studentName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{formData.studentName}</div>
                      <div className="text-xs text-slate-500">{formData.branch}</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700 pt-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">TC Kimlik:</span>
                      <span className="font-mono">{formData.studentTc || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Veli:</span>
                      <span>{formData.parentName || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Telefon:</span>
                      <span className="font-mono">{formData.parentPhone || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Start Date Override */}
              {selectedStudentId && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Sözleşme Başlangıç Tarihi</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pnr-purple focus:outline-none dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 italic">
                    * Öğrencinin kayıt tarihinden farklı bir tarih kullanmak için değiştirin.
                  </p>
                </div>
              )}
            </div>

            <div>
              <button
                onClick={handlePrint}
                disabled={!selectedStudentId}
                className="w-full bg-gradient-to-r from-pnr-purple to-pnr-indigo hover:from-pnr-indigo hover:to-pnr-purple text-white font-bold py-3.5 rounded-xl shadow-lg shadow-pnr-purple/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={20} />
                PDF İndir / Yazdır
              </button>
              <p className="text-xs text-center text-slate-400 mt-2">
                PDF olarak kaydetmek için yazdır ekranında 'PDF olarak kaydet' seçeneğini kullanın.
              </p>
            </div>
          </div>

          {/* Right: Preview (A4 Paper Look) */}
          <div className="lg:col-span-8 overflow-x-auto bg-slate-200/50 dark:bg-black/20 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 flex justify-center">
            <div className="scale-[0.8] md:scale-100 origin-top">
              <ContractDocument ref={componentRef} />
            </div>
          </div>

        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sözleşme Maddeleri</h2>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="bg-pnr-green hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-70"
            >
              <Save size={18} />
              {savingSettings ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FileText size={16} className="text-pnr-purple" />
                Genel Kurallar (Madde 1)
              </label>
              <textarea
                rows={6}
                value={settings.generalRules}
                onChange={(e) => handleSettingChange('generalRules', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-pnr-purple focus:outline-none dark:text-white"
              ></textarea>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Calendar size={16} className="text-pnr-orange" />
                Tatil Tarihleri (Madde 2)
              </label>
              <textarea
                rows={6}
                value={settings.holidayDates}
                onChange={(e) => handleSettingChange('holidayDates', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-pnr-orange focus:outline-none dark:text-white"
              ></textarea>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Layers size={16} className="text-pnr-blue" />
                Bölüm Kuralları: Enstrüman
              </label>
              <textarea
                rows={6}
                value={settings.branchRules.music}
                onChange={(e) => handleSettingChange('music', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-pnr-blue focus:outline-none dark:text-white"
              ></textarea>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Layers size={16} className="text-pnr-purple" />
                Bölüm Kuralları: Bale / Dans
              </label>
              <textarea
                rows={6}
                value={settings.branchRules.dance}
                onChange={(e) => handleSettingChange('dance', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-pnr-purple focus:outline-none dark:text-white"
              ></textarea>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <CreditCard size={16} className="text-pnr-green" />
                Ücretlendirme ve İade (Madde 4)
              </label>
              <textarea
                rows={4}
                value={settings.paymentPolicy}
                onChange={(e) => handleSettingChange('paymentPolicy', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-pnr-green focus:outline-none dark:text-white"
              ></textarea>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Contracts;