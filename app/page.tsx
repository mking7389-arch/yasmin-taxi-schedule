'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  User, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import {
  Timestamp, addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, where,
} from 'firebase/firestore';
import { auth, db, firebaseReady } from '@/lib/firebase';

type Employee = { id: string; name: string; email?: string; role: string };
type Shift = { id: string; employeeId: string; employeeName: string; startAt: Date; endAt: Date; note?: string };
const palette = ['#287d72', '#d27449', '#6574bd', '#b05270', '#9a7a22', '#477b9a', '#8063a8', '#43845c'];
const dayNames = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const colors = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
};
const startOfWeek = (date: Date) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
};
const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const time = (date: Date) => date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
const dateLabel = (date: Date) => date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!firebaseReady) { setLoading(false); return; }
    return onAuthStateChanged(auth, async (current) => {
      setUser(current);
      setRole(''); setName(''); setEmployees([]); setShifts([]);
      if (!current) { setLoading(false); return; }
      try {
        const profile = await getDoc(doc(db, 'users', current.uid));
        if (!profile.exists()) { setLoading(false); return; }
        const data = profile.data();
        setRole(data.role ?? ''); setName(data.name ?? current.email ?? '');
      } catch { setNotice('Kunde inte läsa din profil. Kontrollera Firebase-inställningarna.'); }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || (role !== 'admin' && role !== 'employee')) return;
    const shiftsRef = collection(db, 'schedules');
    const shiftsQuery = role === 'admin'
      ? query(shiftsRef, orderBy('startAt'))
      : query(shiftsRef, where('employeeId', '==', user.uid), orderBy('startAt'));
    const stopShifts = onSnapshot(shiftsQuery, (snapshot) => {
      setShifts(snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          employeeId: data.employeeId,
          employeeName: data.employeeName ?? 'Anställd',
          startAt: (data.startAt as Timestamp).toDate(),
          endAt: (data.endAt as Timestamp).toDate(),
          note: data.note ?? '',
        };
      }));
    }, () => setNotice('Kunde inte läsa schemat. Kontrollera Firestore-regler och index.'));
    if (role !== 'admin') return stopShifts;
    const stopEmployees = onSnapshot(query(collection(db, 'users'), where('role', '==', 'employee')),
      (snapshot) => setEmployees(snapshot.docs.map((item) => ({
        id: item.id, name: item.data().name ?? item.data().email ?? 'Anställd',
        email: item.data().email, role: item.data().role,
      })).sort((a, b) => a.name.localeCompare(b.name, 'sv'))),
      () => setNotice('Kunde inte läsa anställda. Kontrollera Firestore-reglerna.'));
    return () => { stopShifts(); stopEmployees(); };
  }, [user, role]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(week); date.setDate(week.getDate() + index); return date;
  }), [week]);
  const visibleShifts = useMemo(() => shifts.filter((shift) =>
    shift.startAt >= week && shift.startAt < new Date(week.getFullYear(), week.getMonth(), week.getDate() + 7)), [shifts, week]);
  const weekTitle = `${week.toLocaleDateString('sv-SE', { month: 'long' })} ${week.getFullYear()}`;

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setLoginError('');
    const form = new FormData(event.currentTarget);
    try { await signInWithEmailAndPassword(auth, String(form.get('email')).trim(), String(form.get('password'))); }
    catch { setLoginError('Inloggningen misslyckades. Kontrollera e-post och lösenord.'); }
    finally { setBusy(false); }
  }

  async function addShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) return;
    const form = new FormData(event.currentTarget);
    const employee = employees.find((item) => item.id === form.get('employeeId'));
    if (!employee) return;
    const startAt = new Date(String(form.get('startAt')));
    const endAt = new Date(String(form.get('endAt')));
    if (!(endAt > startAt)) { setNotice('Sluttiden måste vara efter starttiden.'); return; }
    setBusy(true);
    try {
      await addDoc(collection(db, 'schedules'), {
        employeeId: employee.id, employeeName: employee.name,
        startAt: Timestamp.fromDate(startAt), endAt: Timestamp.fromDate(endAt),
        note: String(form.get('note') ?? '').trim(), createdAt: Timestamp.now(), createdBy: user.uid,
      });
      setShowForm(false); setNotice('Passet har lagts till.');
    } catch { setNotice('Kunde inte spara passet. Kontrollera att du är administratör.'); }
    finally { setBusy(false); }
  }

  async function removeShift(id: string) {
    if (!window.confirm('Vill du ta bort det här arbetspasset?')) return;
    try { await deleteDoc(doc(db, 'schedules', id)); setNotice('Passet har tagits bort.'); }
    catch { setNotice('Kunde inte ta bort passet.'); }
  }

  if (!firebaseReady) return <main className="setup-page"><div className="setup-card"><div className="brand-mark">YT</div><p className="eyebrow">YASMIN TAXI</p><h1>Firebase behöver konfigureras</h1><p>Webbappen är skapad. Lägg till Firebase-projektets webbkonfiguration i miljövariabler enligt <a href="https://github.com/mking7389-arch/yasmin-taxi-schedule#publicera-webbappen">README-guiden</a> innan inloggningen kan användas.</p></div></main>;
  if (loading) return <main className="loading"><span className="spinner" />Laddar schemat…</main>;
  if (!user) return <main className="login-page"><div className="login-card"><div className="brand-mark">YT</div><p className="eyebrow">YASMIN TAXI</p><h1>Välkommen</h1><p className="muted">Logga in för att se arbetsschemat.</p><form onSubmit={login}><label>E-post<input required name="email" type="email" autoComplete="username" placeholder="namn@exempel.se" /></label><label>Lösenord<input required name="password" type="password" autoComplete="current-password" placeholder="Ditt lösenord" /></label>{loginError && <p className="error">{loginError}</p>}<button className="primary full" disabled={busy}>{busy ? 'Loggar in…' : 'Logga in'} <span>→</span></button></form><div className="login-foot"><span className="secure-dot" /> Säker inloggning</div></div><p className="login-caption">YASMIN TAXI <span>·</span> ARBETSSCHEMA</p></main>;
  if (!role) return <main className="login-page"><div className="login-card"><div className="brand-mark">YT</div><h1>Kontot är inte färdigt</h1><p className="muted">Kontakta administratören så att din profil och roll kan läggas till.</p><button className="secondary full" onClick={() => signOut(auth)}>Logga ut</button></div></main>;

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark small">YT</span><span>Yasmin Taxi<small>PERSONAL & SCHEMA</small></span></a><div className="account"><span className="avatar">{name.slice(0, 1).toUpperCase()}</span><span className="account-name">{name}<small>{role === 'admin' ? 'Administratör' : 'Anställd'}</small></span><button className="icon-button" title="Logga ut" onClick={() => signOut(auth)}>↗</button></div></header>
    <section className="content"><div className="page-heading"><div><p className="eyebrow">{role === 'admin' ? 'ADMINISTRATÖR' : 'PERSONALPORTAL'}</p><h1>{role === 'admin' ? 'Arbetsschema' : 'Mitt schema'}</h1><p className="muted">{role === 'admin' ? 'Överblick över teamets arbetspass.' : 'Här hittar du dina kommande arbetspass.'}</p></div>{role === 'admin' && <button className="primary" onClick={() => setShowForm(true)}><span className="plus">＋</span> Lägg till pass</button>}</div>
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Stäng">×</button></div>}
      <div className="board-card"><div className="board-toolbar"><div><h2>Veckoöversikt</h2><p>{visibleShifts.length} {visibleShifts.length === 1 ? 'arbetspass' : 'arbetspass'} denna vecka</p></div><div className="week-controls"><button className="arrow" onClick={() => setWeek(new Date(week.getFullYear(), week.getMonth(), week.getDate() - 7))} aria-label="Föregående vecka">‹</button><button className="today" onClick={() => setWeek(startOfWeek(new Date()))}>Idag</button><strong>{weekTitle}</strong><button className="arrow" onClick={() => setWeek(new Date(week.getFullYear(), week.getMonth(), week.getDate() + 7))} aria-label="Nästa vecka">›</button></div></div>
        {role === 'admin' && employees.length > 0 && <div className="legend">{employees.map((employee) => <span className="legend-item" key={employee.id}><i style={{ background: colors(employee.id) }} />{employee.name}</span>)}</div>}
        <div className="calendar-scroll"><div className="calendar-grid"><div className="calendar-label">VECKA</div>{weekDays.map((day, i) => <div className={`day-heading ${dateKey(day) === dateKey(new Date()) ? 'is-today' : ''}`} key={dateKey(day)}><span>{dayNames[i]}</span><strong>{day.getDate()}</strong></div>)}
          <div className="calendar-label all-day">PASS</div>{weekDays.map((day) => {const dayShifts = visibleShifts.filter((shift) => dateKey(shift.startAt) === dateKey(day)).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());return <div className="day-cell" key={dateKey(day)}>{dayShifts.map((shift) => {const color = colors(shift.employeeId);return <article className="shift" key={shift.id} style={{ '--shift-color': color } as React.CSSProperties}><strong>{role === 'admin' ? shift.employeeName : 'Arbetspass'}</strong><span>{time(shift.startAt)}–{time(shift.endAt)}</span>{shift.note && <small>{shift.note}</small>}{role === 'admin' && <button className="delete-shift" onClick={() => removeShift(shift.id)} aria-label="Ta bort pass">×</button>}</article>;})}</div>;})}
        </div></div>
        {visibleShifts.length === 0 && <div className="empty-state"><span>▦</span><strong>Inga pass den här veckan</strong><p>{role === 'admin' ? 'Lägg till ett arbetspass för att komma igång.' : 'Dina nya pass visas här när de har lagts in.'}</p></div>}
      </div>
      <p className="privacy-note"><span>✦</span> Ditt schema är endast tillgängligt efter säker inloggning.</p>
    </section>
    {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={() => setShowForm(false)} aria-label="Stäng">×</button><p className="eyebrow">NYTT SCHEMALAGT PASS</p><h2 id="modal-title">Lägg till arbetspass</h2>{employees.length === 0 ? <div className="empty-employees"><p>Det finns inga anställdkonton ännu.</p><small>Skapa ett konto i Firebase Authentication och en profil i Firestore enligt README.</small></div> : <form onSubmit={addShift} className="shift-form"><label>Anställd<select required name="employeeId" defaultValue=""><option value="" disabled>Välj anställd</option>{employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name}</option>)}</select></label><div className="form-row"><label>Starttid<input required type="datetime-local" name="startAt" defaultValue={new Date(Date.now() + 86400000).toISOString().slice(0, 16)} /></label><label>Sluttid<input required type="datetime-local" name="endAt" defaultValue={new Date(Date.now() + 86400000 + 8 * 3600000).toISOString().slice(0, 16)} /></label></div><label>Anteckning <span className="optional">(valfritt)</span><input name="note" placeholder="Till exempel område eller information" /></label><button className="primary full" disabled={busy}>{busy ? 'Sparar…' : 'Spara arbetspass'}</button></form>}</section></div>}
  </main>;
}
