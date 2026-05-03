import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  GraduationCap,
  Landmark,
  Plus,
  RefreshCcw,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface ShowsProps {
  canEdit?: boolean;
}

interface StudentOption {
  id: string;
  name: string;
}

interface ShowParticipant {
  id: string;
  studentId?: string;
  studentName: string;
  costumeIncome: number;
  costumeExpense: number;
  ticketIncome: number;
  audienceCount: number;
  note: string;
}

interface VenueExpense {
  id: string;
  title: string;
  amount: number;
}

interface ShowTeacher {
  id: string;
  teacherName: string;
  jobDescription: string;
  feeExpense: number;
}

interface ProgramItem {
  id: string;
  time: string;
  title: string;
}

interface ShowEvent {
  id: string;
  name: string;
  date: string;
  participants: ShowParticipant[];
  venue: {
    hallName: string;
    rentExpense: number;
    additionalExpenses: VenueExpense[];
  };
  teachers: ShowTeacher[];
  program: ProgramItem[];
}

const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pnr-purple/30';
const numberInputClass = `${inputClass} text-right`;

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: string) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
};

const formatMoney = (value: number) => {
  if (!value) return '0 TL';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value);
};

const calculateTotals = (show: ShowEvent) => {
  const participantIncome = show.participants.reduce((sum, item) => sum + item.costumeIncome + item.ticketIncome, 0);
  const participantExpense = show.participants.reduce((sum, item) => sum + item.costumeExpense, 0);
  const venueExpense = show.venue.rentExpense + show.venue.additionalExpenses.reduce((sum, item) => sum + item.amount, 0);
  const teacherExpense = show.teachers.reduce((sum, item) => sum + item.feeExpense, 0);
  const totalExpense = participantExpense + venueExpense + teacherExpense;

  return {
    totalIncome: participantIncome,
    totalExpense,
    net: participantIncome - totalExpense,
    participantIncome,
    participantExpense,
    venueExpense,
    teacherExpense,
  };
};

const sanitizeArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const mapShowRow = (row: any): ShowEvent => ({
  id: row.id,
  name: row.name || '',
  date: row.show_date || '',
  participants: sanitizeArray<ShowParticipant>(row.participants),
  venue: {
    hallName: row.hall_name || '',
    rentExpense: Number(row.rent_expense || 0),
    additionalExpenses: sanitizeArray<VenueExpense>(row.venue_expenses),
  },
  teachers: sanitizeArray<ShowTeacher>(row.teachers),
  program: sanitizeArray<ProgramItem>(row.program),
});

const toShowPayload = (show: ShowEvent) => ({
  name: show.name.trim(),
  show_date: show.date,
  hall_name: show.venue.hallName,
  rent_expense: show.venue.rentExpense,
  participants: show.participants,
  venue_expenses: show.venue.additionalExpenses,
  teachers: show.teachers,
  program: show.program,
});

const Shows: React.FC<ShowsProps> = ({ canEdit = true }) => {
  const [shows, setShows] = useState<ShowEvent[]>([]);
  const [expandedShowId, setExpandedShowId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newShowName, setNewShowName] = useState('');
  const [newShowDate, setNewShowDate] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentFetchError, setStudentFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [savingShowId, setSavingShowId] = useState<string | null>(null);
  const [participantSelections, setParticipantSelections] = useState<Record<string, string>>({});

  const fetchShows = async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const { data, error } = await supabase
        .from('show_events')
        .select('*')
        .order('show_date', { ascending: false });

      if (error) throw error;

      const mappedShows = (data || []).map(mapShowRow);
      setShows(mappedShows);
      setExpandedShowId(prev => prev && mappedShows.some(show => show.id === prev) ? prev : mappedShows[0]?.id ?? null);
    } catch (error: any) {
      console.error('Gösteri listesi çekilemedi:', error.message);
      setFetchError('Gösteriler Supabase’den yüklenemedi. database/show_events_setup.sql dosyasındaki SQL kodunu Supabase SQL Editor içinde çalıştırın.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchStudents = async () => {
      setStudentsLoading(true);
      setStudentFetchError(null);

      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, full_name')
          .order('full_name');

        if (error) throw error;

        setStudents((data || []).map((student: any) => ({
          id: student.id,
          name: student.full_name || 'İsimsiz Öğrenci',
        })));
      } catch (error: any) {
        console.error('Gösteri öğrenci listesi çekilemedi:', error.message);
        setStudentFetchError('CRM öğrenci listesi yüklenemedi.');
      } finally {
        setStudentsLoading(false);
      }
    };

    fetchStudents();
    fetchShows();
  }, []);

  const sortedShows = useMemo(() => {
    return [...shows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [shows]);

  const updateShow = (showId: string, updater: (show: ShowEvent) => ShowEvent) => {
    setShows(prev => prev.map(show => (show.id === showId ? updater(show) : show)));
  };

  const handleCreateShow = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newShowName.trim()) return;

    const show: ShowEvent = {
      id: createId('show'),
      name: newShowName.trim(),
      date: newShowDate,
      participants: [],
      venue: {
        hallName: '',
        rentExpense: 0,
        additionalExpenses: [{ id: createId('venue-expense'), title: 'Kulis Gideri', amount: 0 }],
      },
      teachers: [],
      program: [],
    };

    setSavingShowId('new');
    try {
      const { data, error } = await supabase
        .from('show_events')
        .insert(toShowPayload(show))
        .select('*')
        .single();

      if (error) throw error;

      const createdShow = mapShowRow(data);
      setShows(prev => [createdShow, ...prev]);
      setExpandedShowId(createdShow.id);
      setNewShowName('');
      setNewShowDate(new Date().toISOString().split('T')[0]);
      setIsCreateOpen(false);
    } catch (error: any) {
      console.error('Gösteri oluşturulamadı:', error.message);
      alert('Gösteri Supabase’e kaydedilemedi: ' + error.message);
    } finally {
      setSavingShowId(null);
    }
  };

  const saveShow = async (show: ShowEvent) => {
    if (!show.name.trim()) {
      alert('Gösteri adı boş olamaz.');
      return;
    }

    setSavingShowId(show.id);
    try {
      const { data, error } = await supabase
        .from('show_events')
        .update(toShowPayload(show))
        .eq('id', show.id)
        .select('*')
        .single();

      if (error) throw error;

      const savedShow = mapShowRow(data);
      setShows(prev => prev.map(item => item.id === show.id ? savedShow : item));
    } catch (error: any) {
      console.error('Gösteri kaydedilemedi:', error.message);
      alert('Gösteri Supabase’e kaydedilemedi: ' + error.message);
    } finally {
      setSavingShowId(null);
    }
  };

  const deleteShow = async (show: ShowEvent) => {
    if (!confirm(`${show.name} adlı gösteriyi silmek istediğinize emin misiniz?`)) return;

    setSavingShowId(show.id);
    try {
      const { error } = await supabase
        .from('show_events')
        .delete()
        .eq('id', show.id);

      if (error) throw error;

      setShows(prev => prev.filter(item => item.id !== show.id));
      setExpandedShowId(prev => prev === show.id ? null : prev);
    } catch (error: any) {
      console.error('Gösteri silinemedi:', error.message);
      alert('Gösteri silinemedi: ' + error.message);
    } finally {
      setSavingShowId(null);
    }
  };

  const addParticipant = (showId: string) => {
    const selectedStudentId = participantSelections[showId];
    const student = students.find(item => item.id === selectedStudentId);
    if (!student) return;

    updateShow(showId, show => ({
      ...show,
      participants: [
        ...show.participants,
        {
          id: createId('participant'),
          studentId: student.id,
          studentName: student.name,
          costumeIncome: 0,
          costumeExpense: 0,
          ticketIncome: 0,
          audienceCount: 0,
          note: '',
        },
      ],
    }));
    setParticipantSelections(prev => ({ ...prev, [showId]: '' }));
  };

  const removeParticipant = (showId: string, participantId: string) => {
    updateShow(showId, show => ({ ...show, participants: show.participants.filter(item => item.id !== participantId) }));
  };

  const addVenueExpense = (showId: string) => {
    updateShow(showId, show => ({
      ...show,
      venue: {
        ...show.venue,
        additionalExpenses: [...show.venue.additionalExpenses, { id: createId('venue-expense'), title: 'Ek Gider', amount: 0 }],
      },
    }));
  };

  const addTeacher = (showId: string) => {
    updateShow(showId, show => ({
      ...show,
      teachers: [...show.teachers, { id: createId('teacher'), teacherName: '', jobDescription: '', feeExpense: 0 }],
    }));
  };

  const addProgramItem = (showId: string) => {
    updateShow(showId, show => ({
      ...show,
      program: [...show.program, { id: createId('program'), time: '', title: '' }],
    }));
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-pnr-purple dark:text-pnr-cyan font-semibold text-sm mb-2">
            <CalendarDays size={18} />
            Gösteri Planlama
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Yeni Gösteri Tanımla</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Gösterileri tarihe göre takip edin, katılımcı ve gelir-gider detaylarını tek ekranda yönetin.</p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(prev => !prev)}
          disabled={!canEdit}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-pnr-purple to-pnr-indigo text-white font-semibold shadow-lg shadow-pnr-purple/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={18} />
          Yeni Gösteri Tanımla
        </button>
      </div>

      {isCreateOpen && (
        <form onSubmit={handleCreateShow} className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <input
            value={newShowName}
            onChange={(event) => setNewShowName(event.target.value)}
            placeholder="Gösteri adı"
            className={inputClass}
          />
          <input
            type="date"
            value={newShowDate}
            onChange={(event) => setNewShowDate(event.target.value)}
            className={inputClass}
          />
          <button type="submit" className="px-5 py-2 rounded-lg bg-pnr-purple text-white font-semibold disabled:opacity-50" disabled={!newShowName.trim() || savingShowId === 'new'}>
            {savingShowId === 'new' ? 'Kaydediliyor...' : 'Oluştur'}
          </button>
        </form>
      )}

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <RefreshCcw size={16} />
          {fetchError}
        </div>
      )}

      {studentFetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <RefreshCcw size={16} />
          {studentFetchError}
        </div>
      )}

      <div className="space-y-4">
        {loading && shows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-slate-500 dark:text-slate-400">
            Gösteriler yükleniyor...
          </div>
        ) : sortedShows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center text-slate-500 dark:text-slate-400">
            Henüz gösteri tanımlanmadı. Yeni Gösteri Tanımla butonuyla ilk kaydı oluşturabilirsiniz.
          </div>
        ) : sortedShows.map((show) => {
          const isExpanded = expandedShowId === show.id;
          const totals = calculateTotals(show);

          return (
            <div key={show.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedShowId(isExpanded ? null : show.id)}
                className="w-full flex items-center justify-between gap-4 p-4 md:p-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-pnr-purple/10 text-pnr-purple dark:bg-pnr-cyan/10 dark:text-pnr-cyan flex items-center justify-center shrink-0">
                    {isExpanded ? <ChevronDown size={22} /> : <ChevronRight size={22} />}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-900 dark:text-white truncate">{show.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{formatDate(show.date)} · {show.participants.length} katılımcı</p>
                  </div>
                </div>
                <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${totals.net >= 0 ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300'}`}>
                  Net {formatMoney(totals.net)}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-800 p-4 md:p-5 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Gösteri Adı</span>
                      <input
                        value={show.name}
                        onChange={(event) => updateShow(show.id, current => ({ ...current, name: event.target.value }))}
                        disabled={!canEdit}
                        className={inputClass}
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Gösteri Tarihi</span>
                      <input
                        type="date"
                        value={show.date}
                        onChange={(event) => updateShow(show.id, current => ({ ...current, date: event.target.value }))}
                        disabled={!canEdit}
                        className={inputClass}
                      />
                    </label>
                  </div>

                  {canEdit && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => saveShow(show)}
                        disabled={savingShowId === show.id}
                        className="px-4 py-2 rounded-lg bg-pnr-purple text-white font-semibold disabled:opacity-50"
                      >
                        {savingShowId === show.id ? 'Kaydediliyor...' : 'Supabase’e Kaydet'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteShow(show)}
                        disabled={savingShowId === show.id}
                        className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/20 disabled:opacity-50"
                      >
                        Gösteriyi Sil
                      </button>
                    </div>
                  )}

                  <section className="space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Users size={20} className="text-pnr-purple dark:text-pnr-cyan" />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">1- Katılımcı Listesi</h3>
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">Toplam Katılımcı Sayısı: {show.participants.length}</span>
                      </div>

                      {canEdit && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={participantSelections[show.id] || ''}
                            onChange={(event) => setParticipantSelections(prev => ({ ...prev, [show.id]: event.target.value }))}
                            disabled={studentsLoading || students.length === 0}
                            className={inputClass}
                          >
                            <option value="">CRM'den öğrenci seç</option>
                            {students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
                          </select>
                          <button type="button" onClick={() => addParticipant(show.id)} className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold disabled:opacity-50" disabled={!participantSelections[show.id]}>
                            Ekle
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-300">
                          <tr>
                            <th className="px-3 py-3 text-left font-semibold">Öğrenci Adı</th>
                            <th className="px-3 py-3 text-right font-semibold">Kıyafet Geliri</th>
                            <th className="px-3 py-3 text-right font-semibold">Kıyafet Gideri</th>
                            <th className="px-3 py-3 text-right font-semibold">Bilet Geliri</th>
                            <th className="px-3 py-3 text-right font-semibold">Seyirci Sayısı</th>
                            <th className="px-3 py-3 text-left font-semibold">Not</th>
                            {canEdit && <th className="px-3 py-3 text-right font-semibold">İşlem</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {show.participants.map(participant => (
                            <tr key={participant.id}>
                              <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{participant.studentName}</td>
                              <td className="px-3 py-2"><input type="number" value={participant.costumeIncome} onChange={(event) => updateShow(show.id, current => ({ ...current, participants: current.participants.map(item => item.id === participant.id ? { ...item, costumeIncome: toNumber(event.target.value) } : item) }))} disabled={!canEdit} className={numberInputClass} /></td>
                              <td className="px-3 py-2"><input type="number" value={participant.costumeExpense} onChange={(event) => updateShow(show.id, current => ({ ...current, participants: current.participants.map(item => item.id === participant.id ? { ...item, costumeExpense: toNumber(event.target.value) } : item) }))} disabled={!canEdit} className={numberInputClass} /></td>
                              <td className="px-3 py-2"><input type="number" value={participant.ticketIncome} onChange={(event) => updateShow(show.id, current => ({ ...current, participants: current.participants.map(item => item.id === participant.id ? { ...item, ticketIncome: toNumber(event.target.value) } : item) }))} disabled={!canEdit} className={numberInputClass} /></td>
                              <td className="px-3 py-2"><input type="number" value={participant.audienceCount} onChange={(event) => updateShow(show.id, current => ({ ...current, participants: current.participants.map(item => item.id === participant.id ? { ...item, audienceCount: toNumber(event.target.value) } : item) }))} disabled={!canEdit} className={numberInputClass} /></td>
                              <td className="px-3 py-2"><input value={participant.note} onChange={(event) => updateShow(show.id, current => ({ ...current, participants: current.participants.map(item => item.id === participant.id ? { ...item, note: event.target.value } : item) }))} disabled={!canEdit} className={inputClass} /></td>
                              {canEdit && (
                                <td className="px-3 py-2 text-right">
                                  <button type="button" onClick={() => removeParticipant(show.id, participant.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Katılımcıyı sil">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                          {show.participants.length === 0 && (
                            <tr><td colSpan={canEdit ? 7 : 6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">Henüz katılımcı eklenmedi.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                      <div className="flex items-center gap-2">
                        <Landmark size={20} className="text-pnr-purple dark:text-pnr-cyan" />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">2- Salon Bilgileri</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Salon Adı</span>
                          <input value={show.venue.hallName} onChange={(event) => updateShow(show.id, current => ({ ...current, venue: { ...current.venue, hallName: event.target.value } }))} disabled={!canEdit} className={inputClass} />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Kira Gideri</span>
                          <input type="number" value={show.venue.rentExpense} onChange={(event) => updateShow(show.id, current => ({ ...current, venue: { ...current.venue, rentExpense: toNumber(event.target.value) } }))} disabled={!canEdit} className={numberInputClass} />
                        </label>
                      </div>
                      <div className="space-y-2">
                        {show.venue.additionalExpenses.map(expense => (
                          <div key={expense.id} className="grid grid-cols-[1fr_160px_auto] gap-2">
                            <input value={expense.title} onChange={(event) => updateShow(show.id, current => ({ ...current, venue: { ...current.venue, additionalExpenses: current.venue.additionalExpenses.map(item => item.id === expense.id ? { ...item, title: event.target.value } : item) } }))} disabled={!canEdit} className={inputClass} />
                            <input type="number" value={expense.amount} onChange={(event) => updateShow(show.id, current => ({ ...current, venue: { ...current.venue, additionalExpenses: current.venue.additionalExpenses.map(item => item.id === expense.id ? { ...item, amount: toNumber(event.target.value) } : item) } }))} disabled={!canEdit} className={numberInputClass} />
                            {canEdit && <button type="button" onClick={() => updateShow(show.id, current => ({ ...current, venue: { ...current.venue, additionalExpenses: current.venue.additionalExpenses.filter(item => item.id !== expense.id) } }))} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={16} /></button>}
                          </div>
                        ))}
                        {canEdit && <button type="button" onClick={() => addVenueExpense(show.id)} className="inline-flex items-center gap-2 text-sm font-semibold text-pnr-purple dark:text-pnr-cyan"><Plus size={16} />Kulis giderleri / ek gider maddesi ekle</button>}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <GraduationCap size={20} className="text-pnr-purple dark:text-pnr-cyan" />
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">3- Katılımcı Öğretmenler</h3>
                        </div>
                        {canEdit && <button type="button" onClick={() => addTeacher(show.id)} className="inline-flex items-center gap-1 text-sm font-semibold text-pnr-purple dark:text-pnr-cyan"><Plus size={16} />Ekle</button>}
                      </div>
                      <div className="space-y-2">
                        {show.teachers.map(teacher => (
                          <div key={teacher.id} className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_140px_auto] gap-2">
                            <input placeholder="Öğretmen Adı" value={teacher.teacherName} onChange={(event) => updateShow(show.id, current => ({ ...current, teachers: current.teachers.map(item => item.id === teacher.id ? { ...item, teacherName: event.target.value } : item) }))} disabled={!canEdit} className={inputClass} />
                            <input placeholder="İş Tanımı" value={teacher.jobDescription} onChange={(event) => updateShow(show.id, current => ({ ...current, teachers: current.teachers.map(item => item.id === teacher.id ? { ...item, jobDescription: event.target.value } : item) }))} disabled={!canEdit} className={inputClass} />
                            <input type="number" placeholder="Ücret" value={teacher.feeExpense} onChange={(event) => updateShow(show.id, current => ({ ...current, teachers: current.teachers.map(item => item.id === teacher.id ? { ...item, feeExpense: toNumber(event.target.value) } : item) }))} disabled={!canEdit} className={numberInputClass} />
                            {canEdit && <button type="button" onClick={() => updateShow(show.id, current => ({ ...current, teachers: current.teachers.filter(item => item.id !== teacher.id) }))} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={16} /></button>}
                          </div>
                        ))}
                        {show.teachers.length === 0 && <div className="text-sm text-slate-500 dark:text-slate-400">Henüz öğretmen eklenmedi.</div>}
                      </div>
                    </div>
                  </section>

                  <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Clock size={20} className="text-pnr-purple dark:text-pnr-cyan" />
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">4- Program</h3>
                        </div>
                        {canEdit && <button type="button" onClick={() => addProgramItem(show.id)} className="inline-flex items-center gap-1 text-sm font-semibold text-pnr-purple dark:text-pnr-cyan"><Plus size={16} />Ekle</button>}
                      </div>
                      <div className="space-y-2">
                        {show.program.map(item => (
                          <div key={item.id} className="grid grid-cols-[110px_1fr_auto] gap-2">
                            <input type="time" value={item.time} onChange={(event) => updateShow(show.id, current => ({ ...current, program: current.program.map(programItem => programItem.id === item.id ? { ...programItem, time: event.target.value } : programItem) }))} disabled={!canEdit} className={inputClass} />
                            <input placeholder="Program planlaması" value={item.title} onChange={(event) => updateShow(show.id, current => ({ ...current, program: current.program.map(programItem => programItem.id === item.id ? { ...programItem, title: event.target.value } : programItem) }))} disabled={!canEdit} className={inputClass} />
                            {canEdit && <button type="button" onClick={() => updateShow(show.id, current => ({ ...current, program: current.program.filter(programItem => programItem.id !== item.id) }))} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={16} /></button>}
                          </div>
                        ))}
                        {show.program.length === 0 && <div className="text-sm text-slate-500 dark:text-slate-400">Henüz program planı eklenmedi.</div>}
                      </div>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-800/30">
                      <div className="flex items-center gap-2">
                        <Wallet size={20} className="text-pnr-purple dark:text-pnr-cyan" />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">5- Toplam Gelir-Gider Hesabı</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
                          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Toplam Gelir</div>
                          <div className="text-xl font-black text-green-600 dark:text-green-300 mt-1">{formatMoney(totals.totalIncome)}</div>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
                          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Toplam Gider</div>
                          <div className="text-xl font-black text-red-600 dark:text-red-300 mt-1">{formatMoney(totals.totalExpense)}</div>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
                          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Net</div>
                          <div className={`text-xl font-black mt-1 ${totals.net >= 0 ? 'text-pnr-purple dark:text-pnr-cyan' : 'text-red-600 dark:text-red-300'}`}>{formatMoney(totals.net)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between gap-3"><span>Katılımcı Gelirleri</span><strong>{formatMoney(totals.participantIncome)}</strong></div>
                        <div className="flex justify-between gap-3"><span>Kıyafet Giderleri</span><strong>{formatMoney(totals.participantExpense)}</strong></div>
                        <div className="flex justify-between gap-3"><span>Salon ve Ek Giderler</span><strong>{formatMoney(totals.venueExpense)}</strong></div>
                        <div className="flex justify-between gap-3"><span>Öğretmen Ücretleri</span><strong>{formatMoney(totals.teacherExpense)}</strong></div>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Shows;
