
import React, { useState, useEffect } from 'react';
import {
    Landmark, CreditCard, Plus, History, ArrowUpRight,
    ArrowDownLeft, Trash2, Edit2, Search, X, Check,
    Wallet, RefreshCcw, MoreHorizontal, ArrowLeft, Building2,
    AlertCircle, Upload
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { Bank, BankTransaction } from '../../types';

interface BanksProps {
    canEdit?: boolean;
}

const Banks: React.FC<BanksProps> = ({ canEdit = true }) => {
    const [banks, setBanks] = useState<Bank[]>([]);
    const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [transactions, setTransactions] = useState<BankTransaction[]>([]);
    const [transLoading, setTransLoading] = useState(false);

    // New Bank Form
    const [newBank, setNewBank] = useState({
        name: '',
        account_name: '', // Added Account Name
        branch_name: '',
        account_number: '',
        iban: '',
        currency: 'TRY', // Default to TRY, removed from UI
        logo_url: '' // For UI preview
    });

    // URL Query Params Check
    useEffect(() => {
        const handleHashChange = () => {
            const params = new URLSearchParams(window.location.hash.split('?')[1]);
            const id = params.get('id');
            setSelectedBankId(id || null);
        };

        handleHashChange(); // Run on mount
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const fetchBanks = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('banks')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setBanks(data || []);
        } catch (err: any) {
            console.error('Banks Fetch Error:', err);
            // Display friendly error or technical detail
            setError(err.message || 'Bankalar yüklenirken bir hata oluştu. Lütfen veritabanı kurulumunu kontrol edin (banks tablosu eksik olabilir).');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBanks();
    }, []);

    // Fetch Transactions when bank is selected
    useEffect(() => {
        if (selectedBankId) {
            const fetchTrans = async () => {
                setTransLoading(true);
                try {
                    const { data } = await supabase
                        .from('bank_transactions')
                        .select('*')
                        .eq('bank_id', selectedBankId)
                        .order('date', { ascending: false });

                    if (data) setTransactions(data);
                    else setTransactions([]);
                } catch (e) {
                    setTransactions([]);
                } finally {
                    setTransLoading(false);
                }
            };
            fetchTrans();
        }
    }, [selectedBankId]);

    const handleAddBank = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit || !newBank.name) return;

        try {
            const { error } = await supabase.from('banks').insert({
                name: newBank.name,
                account_name: newBank.account_name, // Mapped to DB column
                branch_name: newBank.branch_name,
                account_number: newBank.account_number,
                iban: newBank.iban,
                currency: newBank.currency,
                balance: 0
                // logo_url: omitted for now as it requires Storage implementation
            });

            if (error) throw error;

            setIsModalOpen(false);
            setNewBank({ name: '', account_name: '', branch_name: '', account_number: '', iban: '', currency: 'TRY', logo_url: '' });
            fetchBanks();
        } catch (err: any) {
            alert("Hata: " + err.message);
        }
    };

    const handleDeleteBank = async (id: string) => {
        if (!canEdit || !confirm("Bu banka hesabını silmek istediğinize emin misiniz?")) return;
        try {
            const { error } = await supabase.from('banks').delete().eq('id', id);
            if (error) throw error;
            fetchBanks();
            if (selectedBankId === id) {
                handleBack();
            }
        } catch (err: any) {
            alert("Silinemedi: " + err.message);
        }
    };

    const handleBack = () => {
        setSelectedBankId(null);
        window.location.hash = '/finance/banks';
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const url = URL.createObjectURL(e.target.files[0]);
            setNewBank({ ...newBank, logo_url: url });
        }
    };

    const selectedBank = banks.find(b => b.id === selectedBankId);

    // Helper: Get Brand Color based on Name
    const getBankStyle = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('garanti')) return 'bg-[#009639] text-white';
        if (n.includes('akbank')) return 'bg-[#FF0000] text-white';
        if (n.includes('yapı kredi') || n.includes('yapi')) return 'bg-[#003399] text-white';
        if (n.includes('iş bankası') || n.includes('is bankasi')) return 'bg-[#1E4396] text-white';
        if (n.includes('ziraat')) return 'bg-[#E30613] text-white';
        if (n.includes('vakıf') || n.includes('vakif')) return 'bg-[#FFC90E] text-slate-900';
        if (n.includes('finans') || n.includes('qnb')) return 'bg-[#85004B] text-white';
        if (n.includes('halk')) return 'bg-[#0099D8] text-white';
        if (n.includes('deniz')) return 'bg-[#003399] text-white';
        if (n.includes('teb')) return 'bg-[#009639] text-white';
        if (n.includes('kuveyt')) return 'bg-[#0F5E36] text-white';

        return 'bg-slate-800 text-white'; // Default
    };

    const formatCurrency = (amount: number, currency = 'TRY') => {
        return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(amount);
    };

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display">Banka Hesapları</h1>
                    <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">
                        Kurumsal banka hesapları, IBAN bilgileri ve hareketler.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div>
                        <h4 className="font-bold text-red-800 dark:text-red-200 text-sm">Veri Hatası</h4>
                        <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
                        <p className="text-xs text-red-500 mt-2">İpucu: 'docs/09_BANKS_SETUP.sql' dosyasındaki SQL kodunu Supabase üzerinde çalıştırın.</p>
                    </div>
                </div>
            )}

            {selectedBankId && selectedBank ? (
                /* --- DETAIL VIEW --- */
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} /> Banka Listesine Dön
                    </button>

                    <div className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col">
                        {/* Detail Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-4">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-lg ${getBankStyle(selectedBank.name)}`}>
                                    {selectedBank.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedBank.name}</h2>
                                    <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                        <Building2 size={14} /> {selectedBank.branch_name} Şubesi
                                    </p>
                                    <p className="text-sm font-mono text-slate-400 mt-1">{selectedBank.iban}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-slate-500 uppercase font-bold">Güncel Bakiye</p>
                                <p className="text-3xl font-bold font-mono text-slate-900 dark:text-white">
                                    {formatCurrency(selectedBank.balance || 0, selectedBank.currency)}
                                </p>
                            </div>
                        </div>

                        {/* Transactions List */}
                        <div className="flex-1 min-h-[400px]">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <h3 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <History size={18} className="text-pnr-purple" /> Hesap Hareketleri
                                </h3>
                                <button className="text-xs font-bold text-pnr-purple hover:underline">
                                    Ekstre İndir (PDF)
                                </button>
                            </div>

                            {transLoading ? (
                                <div className="p-12 text-center text-slate-400">Hareketler yükleniyor...</div>
                            ) : transactions.length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 uppercase sticky top-0">
                                        <tr>
                                            <th className="p-4 w-32">Tarih</th>
                                            <th className="p-4">Açıklama</th>
                                            <th className="p-4 text-right w-40">Tutar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {transactions.map(t => (
                                            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                <td className="p-4 text-sm text-slate-600 dark:text-slate-300 font-mono">
                                                    {new Date(t.date).toLocaleDateString('tr-TR')}
                                                </td>
                                                <td className="p-4 text-sm font-medium text-slate-800 dark:text-slate-200">
                                                    {t.description}
                                                </td>
                                                <td className={`p-4 text-right text-sm font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, selectedBank.currency)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                    <RefreshCcw size={32} className="mb-3 opacity-50" />
                                    <p>Bu hesaba ait işlem bulunamadı.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* --- GRID VIEW (DEFAULT) --- */
                <div>
                    {loading ? (
                        <div className="text-center py-12 text-slate-500">Bankalar yükleniyor...</div>
                    ) : banks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <Landmark size={32} className="text-slate-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Henüz Banka Eklenmemiş</h3>
                            <p className="text-slate-500 mb-6 max-w-sm">
                                Sisteme henüz bir banka hesabı tanımlanmamış. Aşağıdaki butonu kullanarak ilk banka hesabını ekleyebilirsiniz.
                            </p>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-pnr-purple hover:bg-pnr-indigo text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                            >
                                <Plus size={20} /> İlk Bankayı Ekle
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">

                            {/* Bank Cards */}
                            {banks.map(bank => (
                                <div
                                    key={bank.id}
                                    onClick={() => {
                                        setSelectedBankId(bank.id);
                                        window.location.hash = `/finance/banks?id=${bank.id}`;
                                    }}
                                    className="bg-white dark:bg-pnr-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 cursor-pointer hover:shadow-xl hover:border-pnr-purple transition-all group relative overflow-hidden flex flex-col justify-between min-h-[220px]"
                                >
                                    {/* Top */}
                                    <div className="flex justify-between items-start z-10">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-md group-hover:scale-110 transition-transform ${getBankStyle(bank.name)}`}>
                                            {bank.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        {canEdit && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteBank(bank.id); }}
                                                className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="z-10 mt-4">
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight mb-1">{bank.name}</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-4">{bank.iban}</p>

                                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Bakiye</p>
                                            <p className="text-2xl font-bold font-mono text-slate-800 dark:text-white">
                                                {formatCurrency(bank.balance || 0, bank.currency)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Decorative Circle */}
                                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-slate-50 dark:bg-slate-800 rounded-full z-0 group-hover:scale-150 transition-transform duration-500 pointer-events-none"></div>
                                </div>
                            ))}

                            {/* Add New Bank Button Card */}
                            {canEdit && (
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-slate-400 hover:text-pnr-purple hover:border-pnr-purple hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all min-h-[220px] group"
                                >
                                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-white group-hover:shadow-md transition-all">
                                        <Plus size={32} />
                                    </div>
                                    <span className="font-bold text-lg">Yeni Banka Ekle</span>
                                </button>
                            )}

                        </div>
                    )}
                </div>
            )}

            {/* Add Bank Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-pnr-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                <Landmark size={20} className="text-pnr-purple" /> Yeni Banka Tanımla
                            </h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-900 dark:hover:text-white" /></button>
                        </div>

                        <form onSubmit={handleAddBank} className="p-6 space-y-4">

                            {/* Logo Upload UI */}
                            <div className="flex flex-col items-center mb-2">
                                <div className="w-24 h-24 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center relative overflow-hidden group cursor-pointer hover:border-pnr-purple transition-colors">
                                    {newBank.logo_url ? (
                                        <img src={newBank.logo_url} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-400">
                                            <Upload size={24} />
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleLogoUpload}
                                    />
                                </div>
                                <span className="text-xs text-slate-500 mt-2 font-medium">Banka Logosu</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Banka Adı</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Örn: Garanti"
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                                        value={newBank.name}
                                        onChange={(e) => setNewBank({ ...newBank, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hesap Adı</label>
                                    <input
                                        type="text"
                                        placeholder="Örn: Maaş Hesabı"
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                                        value={newBank.account_name}
                                        onChange={(e) => setNewBank({ ...newBank, account_name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Şube Adı</label>
                                    <input
                                        type="text"
                                        placeholder="Örn: Kadıköy"
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                                        value={newBank.branch_name}
                                        onChange={(e) => setNewBank({ ...newBank, branch_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hesap No</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none"
                                        value={newBank.account_number}
                                        onChange={(e) => setNewBank({ ...newBank, account_number: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">IBAN</label>
                                <input
                                    type="text"
                                    placeholder="TR..."
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-pnr-purple focus:outline-none font-mono"
                                    value={newBank.iban}
                                    onChange={(e) => setNewBank({ ...newBank, iban: e.target.value })}
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-pnr-purple hover:bg-pnr-indigo text-white py-3 rounded-xl font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-70"
                                >
                                    {loading ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Banks;
