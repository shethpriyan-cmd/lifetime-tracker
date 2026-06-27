import { useState, useMemo, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, AreaChart, Area, Legend, ReferenceLine
} from "recharts";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

// ── FIREBASE SETUP ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyALWmICBwxfn3ojliDCwvZy2MjBK5z85tU",
  authDomain: "lifetime-tracker-dacff.firebaseapp.com",
  projectId: "lifetime-tracker-dacff",
  storageBucket: "lifetime-tracker-dacff.firebasestorage.app",
  messagingSenderId: "909825898368",
  appId: "1:909825898368:web:6a10b9b7d06e763d077365"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ── CLOUD SYNC HELPERS ────────────────────────────────────────────────────────
const saveToCloud = async (key, data) => {
  try {
    await setDoc(doc(db, "tracker", key), { data: JSON.stringify(data), updatedAt: new Date().toISOString() });
  } catch (e) { console.log("Cloud save failed:", e); }
};
const loadFromCloud = async (key) => {
  try {
    const snap = await getDoc(doc(db, "tracker", key));
    if (snap.exists()) return JSON.parse(snap.data().data);
  } catch (e) { console.log("Cloud load failed:", e); }
  return null;
};

// ── LOCAL STORAGE ─────────────────────────────────────────────────────────────
const load = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const persist = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
};

// ── THEME ─────────────────────────────────────────────────────────────────────
const T = {
  bg: "#080C18", surface: "#0F1629", card: "#151E35", border: "#1E2D4A",
  accent: "#00C896", accentDim: "#00C89622", blue: "#4B8BFF", gold: "#FFB830",
  red: "#FF4D6D", purple: "#A78BFA", text: "#E8EEF7", sub: "#8899BB", muted: "#4A5878",
};

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const CATS = ["Fixed Deposit","Life Insurance","PPF","ELSS","NPS","Bonds","Gold","Real Estate","Other"];
const PROPOSERS = ["Priyan Sheth","Suhani Sheth","Kepin Sheth","Bhagvatiben Sheth","Punjilal Sheth"];


// ── HELPERS ───────────────────────────────────────────────────────────────────
const inr = (n, short = false) => {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (short) {
    if (abs >= 1e7) return sign + "₹" + (abs / 1e7).toFixed(2) + " Cr";
    if (abs >= 1e5) return sign + "₹" + (abs / 1e5).toFixed(1) + "L";
  }
  return sign + "₹" + abs.toLocaleString("en-IN");
};
const pct = n => (n >= 0 ? "+" : "") + Number(n).toFixed(2) + "%";
const yrs = (d1, d2) => {
  if (!d1 || !d2) return 0;
  return Math.max(0, (new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24 * 365.25));
};
const compound = (p, r, y) => p && r && y ? Math.round(p * Math.pow(1 + r / 100, y)) : 0;
const fyLabel = d => {
  if (!d) return "—";
  const dt = new Date(d), y = dt.getFullYear(), m = dt.getMonth();
  return m >= 3 ? `FY ${y}-${String(y+1).slice(2)}` : `FY ${y-1}-${String(y).slice(2)}`;
};

// ── SHARED UI ─────────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, ...style }}>
    {children}
  </div>
);
const Lbl = ({ children }) => (
  <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>{children}</div>
);
const Stat = ({ label, value, color = T.text, sub }) => (
  <div>
    <Lbl>{label}</Lbl>
    <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: T.sub, marginTop: 2 }}>{sub}</div>}
  </div>
);
const Field = ({ label, type = "text", value, onChange, opts }) => (
  <div style={{ marginBottom: 10 }}>
    {label && <Lbl>{label}</Lbl>}
    {opts
      ? <select value={value} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.text, fontSize: 13, boxSizing: "border-box" }}>
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
      : <input type={type} value={value}
          onChange={e => onChange(type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
          style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 10px", color: T.text, fontSize: 13, boxSizing: "border-box" }} />
    }
  </div>
);
const Btn = ({ children, onClick, v = "primary", style = {} }) => {
  const s = { primary: { background: T.accent, color: "#000" }, ghost: { background: T.border, color: T.text }, danger: { background: T.red + "22", color: T.red } };
  return <button onClick={onClick} style={{ border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", ...s[v], ...style }}>{children}</button>;
};
const TT = (p) => <Tooltip {...p} contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 12 }} />;
const Modal = ({ title, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
    <div style={{ background: T.card, borderRadius: "18px 18px 0 0", padding: 20, width: "100%", maxHeight: "85vh", overflowY: "auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

// ── SYNC STATUS BADGE ─────────────────────────────────────────────────────────
const SyncBadge = ({ status }) => {
  const map = {
    syncing: { color: T.gold, text: "⟳ Syncing..." },
    synced:  { color: T.accent, text: "✓ Synced" },
    error:   { color: T.red, text: "✕ Offline" },
    idle:    { color: T.muted, text: "● Local" },
  };
  const s = map[status] || map.idle;
  return <span style={{ fontSize: 10, color: s.color, fontWeight: 700 }}>{s.text}</span>;
};

// ── PIN LOCK SCREEN ───────────────────────────────────────────────────────────
function PinLock({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [storedPin, setStoredPin] = useState(load("app_pin", "1234"));
  const [pinReady, setPinReady] = useState(false);

  // Always load PIN from Firebase first — ensures PIN change syncs across all devices
  useEffect(() => {
    setPinReady(false);
    loadFromCloud("app_pin").then(cloudPin => {
      if (cloudPin && typeof cloudPin === "string" && cloudPin.length === 4) {
        setStoredPin(cloudPin);
        persist("app_pin", cloudPin);
      }
      setPinReady(true);
    }).catch(() => {
      // If Firebase fails, fall back to local PIN
      setPinReady(true);
    });
  }, []); // eslint-disable-line

  const handleKey = (digit) => {
    if (!pinReady || pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      setTimeout(() => {
        if (newPin === storedPin) {
          onUnlock();
        } else {
          setShake(true);
          setError("Wrong PIN. Try again.");
          setPin("");
          setTimeout(() => { setShake(false); setError(""); }, 1000);
        }
      }, 200);
    }
  };

  const handleDelete = () => setPin(pin.slice(0, -1));

  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏦</div>
        <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, textTransform: "uppercase" }}>Sheth Family</div>
        <div style={{ fontSize: 22, fontWeight: 900, background: `linear-gradient(90deg,${T.accent},${T.blue})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Investment Tracker
        </div>
      </div>

      {!pinReady && (
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Loading secure PIN...
        </div>
      )}
      <div style={{ fontSize: 14, color: T.sub, marginBottom: 24, fontWeight: 600 }}>
        {pinReady ? "Enter PIN to continue" : "Please wait..."}
      </div>

      {/* PIN dots */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, animation: shake ? "shake 0.3s" : "none" }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 18, height: 18, borderRadius: "50%",
            background: i < pin.length ? T.accent : "transparent",
            border: `2px solid ${i < pin.length ? T.accent : T.border}`,
            transition: "all 0.15s"
          }} />
        ))}
      </div>

      {error && <div style={{ color: T.red, fontSize: 12, marginBottom: 16, fontWeight: 600 }}>{error}</div>}

      {/* Keypad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 72px)", gap: 12, marginTop: 8 }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k, i) => (
          <button key={i} onClick={() => k === "⌫" ? handleDelete() : k !== "" ? handleKey(String(k)) : null}
            style={{
              width: 72, height: 72, borderRadius: "50%",
              background: k === "" ? "transparent" : k === "⌫" ? T.border : T.card,
              border: k === "" ? "none" : `1px solid ${T.border}`,
              color: T.text, fontSize: k === "⌫" ? 20 : 24, fontWeight: 700,
              cursor: k === "" ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.1s"
            }}>
            {k}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 40, fontSize: 11, color: T.muted, textAlign: "center" }}>
        Default PIN is <span style={{ color: T.accent, fontWeight: 700 }}>1234</span><br/>
        Change it in Settings after login
      </div>

      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

// ── useCloudData HOOK ─────────────────────────────────────────────────────────
function useCloudData(key, defaultVal) {
  const [data, setDataRaw] = useState(() => load(key, defaultVal));
  const [syncStatus, setSyncStatus] = useState("idle");

  // Load from cloud on mount
  useEffect(() => {
    setSyncStatus("syncing");
    loadFromCloud(key).then(cloudData => {
      if (cloudData !== null) {
        setDataRaw(cloudData);
        persist(key, cloudData);
        setSyncStatus("synced");
      } else {
        setSyncStatus("idle");
      }
    });
  }, [key]);

  // Listen for real-time changes
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "tracker", key), (snap) => {
      if (snap.exists()) {
        try {
          const cloudData = JSON.parse(snap.data().data);
          setDataRaw(cloudData);
          persist(key, cloudData);
          setSyncStatus("synced");
        } catch {}
      }
    }, () => setSyncStatus("error"));
    return () => unsub();
  }, [key]);

  const setData = useCallback((val) => {
    const next = typeof val === "function" ? val(data) : val;
    setDataRaw(next);
    persist(key, next);
    setSyncStatus("syncing");
    saveToCloud(key, next).then(() => setSyncStatus("synced")).catch(() => setSyncStatus("error"));
  }, [data, key]);

  return [data, setData, syncStatus];
}

// ─────────────────────────────────────────────────────────────────────────────
// SHEET 1 — INVESTMENTS
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_INV = { name: "", accountNo: "", date: "", rate: "", maturityDate: "", invested: "", maturityAmt: "", proposer: PROPOSERS[0], nominee: "", category: CATS[0] };

function InvestmentsSheet() {
  const [list, setList, syncStatus] = useCloudData("inv2", []);
  const [form, setForm] = useState(EMPTY_INV);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [fp, setFp] = useState("All");
  const [fc, setFc] = useState("All");
  const [view, setView] = useState("table");

  const enriched = useMemo(() => list.map(i => ({
    ...i,
    projected: i.maturityAmt > 0 ? i.maturityAmt : compound(i.invested, i.rate, yrs(i.date, i.maturityDate)),
    matured: i.maturityDate && new Date(i.maturityDate) < new Date(),
    fy: fyLabel(i.date),
  })), [list]);

  const filtered = useMemo(() =>
    enriched.filter(i => (fp === "All" || i.proposer === fp) && (fc === "All" || i.category === fc)),
    [enriched, fp, fc]);

  const totals = useMemo(() => ({
    invested: filtered.reduce((s, i) => s + (+i.invested || 0), 0),
    projected: filtered.reduce((s, i) => s + (+i.projected || 0), 0),
  }), [filtered]);

  const yearlyData = useMemo(() => {
    const m = {};
    enriched.forEach(i => {
      const y = i.date ? new Date(i.date).getFullYear() : "?";
      if (!m[y]) m[y] = { year: String(y), invested: 0, projected: 0 };
      m[y].invested += +i.invested || 0;
      m[y].projected += +i.projected || 0;
    });
    return Object.values(m).sort((a, b) => a.year - b.year);
  }, [enriched]);

  const byProposer = useMemo(() => {
    const m = {};
    enriched.forEach(i => {
      if (!m[i.proposer]) m[i.proposer] = { invested: 0, projected: 0, items: [] };
      m[i.proposer].invested += +i.invested || 0;
      m[i.proposer].projected += +i.projected || 0;
      m[i.proposer].items.push(i);
    });
    return m;
  }, [enriched]);

  const byCat = useMemo(() => {
    const m = {};
    enriched.forEach(i => {
      if (!m[i.category]) m[i.category] = { invested: 0, projected: 0, count: 0 };
      m[i.category].invested += +i.invested || 0;
      m[i.category].projected += +i.projected || 0;
      m[i.category].count++;
    });
    return m;
  }, [enriched]);

  const openAdd = () => { setEditId(null); setForm(EMPTY_INV); setShowForm(true); };
  const openEdit = i => { setEditId(i.id); setForm({ ...i }); setShowForm(true); };
  const save = () => {
    const e = { ...form, id: editId || Date.now(), rate: +form.rate, invested: +form.invested, maturityAmt: +form.maturityAmt };
    setList(editId ? list.map(x => x.id === editId ? e : x) : [...list, e]);
    setShowForm(false);
  };
  const preview = form.invested && form.rate && form.date && form.maturityDate
    ? (form.maturityAmt > 0 ? +form.maturityAmt : compound(+form.invested, +form.rate, yrs(form.date, form.maturityDate)))
    : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <SyncBadge status={syncStatus} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <Card><Stat label="Invested" value={inr(totals.invested, true)} color={T.blue} /></Card>
        <Card><Stat label="Projected" value={inr(totals.projected, true)} color={T.accent} /></Card>
        <Card><Stat label="Gain" value={inr(totals.projected - totals.invested, true)} color={T.gold}
          sub={totals.invested ? pct(((totals.projected - totals.invested) / totals.invested) * 100) : ""} /></Card>
      </div>

      {yearlyData.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Year-wise Investment vs Projected</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={yearlyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="year" tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => inr(v, true)} tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
              <TT formatter={(v, n) => [inr(v), n === "invested" ? "Invested" : "Projected"]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="invested" name="Invested" fill={T.blue} radius={[4,4,0,0]} />
              <Bar dataKey="projected" name="Projected" fill={T.accent} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <select value={fp} onChange={e => setFp(e.target.value)} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", color: T.text, fontSize: 12 }}>
          <option value="All">All Proposers</option>
          {PROPOSERS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={fc} onChange={e => setFc(e.target.value)} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", color: T.text, fontSize: 12 }}>
          <option value="All">All Categories</option>
          {CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        <Btn onClick={openAdd}>+ Add</Btn>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {["table","proposer","category"].map(v => (
          <button key={v} onClick={() => setView(v)} style={{ background: view === v ? T.accent : T.border, color: view === v ? "#000" : T.sub, border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>{v}</button>
        ))}
      </div>

      {view === "table" && (
        list.length === 0
          ? <div style={{ textAlign: "center", color: T.muted, padding: 50, fontSize: 13 }}>No investments yet — tap + Add to start</div>
          : <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["Name","A/C No","Proposer","Category","Invested","Rate","Maturity","Projected","Nominee",""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 6px", color: T.muted, fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(i => (
                    <tr key={i.id} style={{ borderBottom: `1px solid ${T.border}22`, background: i.matured ? T.red+"08" : "transparent" }}>
                      <td style={{ padding: "9px 6px" }}>
                        <div style={{ color: T.text, fontWeight: 600 }}>{i.name}</div>
                        <div style={{ color: T.muted, fontSize: 10 }}>{i.fy}{i.matured ? " · MATURED" : ""}</div>
                      </td>
                      <td style={{ padding: "9px 6px", color: T.sub, fontSize: 11 }}>{i.accountNo || "—"}</td>
                      <td style={{ padding: "9px 6px", color: T.sub, whiteSpace: "nowrap" }}>{(i.proposer||"").split(" ")[0]}</td>
                      <td style={{ padding: "9px 6px" }}><span style={{ background: T.accentDim, color: T.accent, borderRadius: 6, padding: "2px 7px", fontSize: 10 }}>{i.category}</span></td>
                      <td style={{ padding: "9px 6px", color: T.blue, fontWeight: 700 }}>{inr(i.invested, true)}</td>
                      <td style={{ padding: "9px 6px", color: T.sub }}>{i.rate}%</td>
                      <td style={{ padding: "9px 6px", color: i.matured ? T.red : T.sub, whiteSpace: "nowrap" }}>{i.maturityDate || "—"}</td>
                      <td style={{ padding: "9px 6px", color: T.accent, fontWeight: 700 }}>{inr(i.projected, true)}</td>
                      <td style={{ padding: "9px 6px", color: T.sub }}>{i.nominee || "—"}</td>
                      <td style={{ padding: "9px 6px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Btn onClick={() => openEdit(i)} v="ghost" style={{ padding: "3px 8px" }}>✎</Btn>
                          <Btn onClick={() => setList(list.filter(x => x.id !== i.id))} v="danger" style={{ padding: "3px 8px" }}>✕</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      )}

      {view === "proposer" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(byProposer).map(([name, d]) => (
            <Card key={name}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>{name}</div>
                <span style={{ background: T.border, borderRadius: 20, padding: "2px 10px", fontSize: 10, color: T.sub }}>{d.items.length} investments</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div><Lbl>Invested</Lbl><div style={{ color: T.blue, fontWeight: 700 }}>{inr(d.invested, true)}</div></div>
                <div><Lbl>Projected</Lbl><div style={{ color: T.accent, fontWeight: 700 }}>{inr(d.projected, true)}</div></div>
                <div><Lbl>Gain</Lbl><div style={{ color: T.gold, fontWeight: 700 }}>{inr(d.projected - d.invested, true)}</div></div>
              </div>
              {d.items.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${T.border}`, paddingTop: 6, marginTop: 6, fontSize: 12 }}>
                  <span style={{ color: T.sub }}>{i.name}</span>
                  <span style={{ color: T.accent }}>{inr(i.projected, true)}</span>
                </div>
              ))}
            </Card>
          ))}
          {Object.keys(byProposer).length === 0 && <div style={{ textAlign: "center", color: T.muted, padding: 40 }}>No investments yet</div>}
        </div>
      )}

      {view === "category" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(byCat).map(([cat, d]) => (
            <Card key={cat}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{cat}</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{d.count} investments</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.accent }}>{inr(d.projected, true)}</div>
                  <div style={{ fontSize: 10, color: T.blue }}>from {inr(d.invested, true)}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, height: 4, background: T.border, borderRadius: 4 }}>
                <div style={{ width: `${totals.invested > 0 ? Math.min(100,(d.invested/totals.invested)*100) : 0}%`, height: "100%", background: T.accent, borderRadius: 4 }} />
              </div>
            </Card>
          ))}
          {Object.keys(byCat).length === 0 && <div style={{ textAlign: "center", color: T.muted, padding: 40 }}>No investments yet</div>}
        </div>
      )}

      {showForm && (
        <Modal title={editId ? "Edit Investment" : "New Investment"} onClose={() => setShowForm(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Investment Name" value={form.name} onChange={v => setForm({...form, name: v})} />
            <Field label="Account Number" value={form.accountNo} onChange={v => setForm({...form, accountNo: v})} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Date of Investment" type="date" value={form.date} onChange={v => setForm({...form, date: v})} />
            <Field label="Maturity Date" type="date" value={form.maturityDate} onChange={v => setForm({...form, maturityDate: v})} />
            <Field label="Amount Invested (₹)" type="number" value={form.invested} onChange={v => setForm({...form, invested: v})} />
            <Field label="Interest Rate (%)" type="number" value={form.rate} onChange={v => setForm({...form, rate: v})} />
            <Field label="Maturity Amount (0=auto)" type="number" value={form.maturityAmt} onChange={v => setForm({...form, maturityAmt: v})} />
            <Field label="Nominee Name" value={form.nominee} onChange={v => setForm({...form, nominee: v})} />
          </div>
          <Field label="Proposer" value={form.proposer} onChange={v => setForm({...form, proposer: v})} opts={PROPOSERS} />
          <Field label="Category" value={form.category} onChange={v => setForm({...form, category: v})} opts={CATS} />
          {preview && (
            <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.accent }}>Projected Maturity</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.accent }}>{inr(preview)}</div>
            </div>
          )}
          <Btn onClick={save} style={{ width: "100%", padding: 13, fontSize: 14 }}>{editId ? "Save Changes" : "Add Investment"}</Btn>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHEET 2 — EQUITY & MF
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_EQ = { month: "", name: "", type: "Share", invested: "", units: "", latestValue: "" };

function EquitySheet() {
  const [list, setList, syncStatus] = useCloudData("eq2", []);
  const [form, setForm] = useState(EMPTY_EQ);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterName, setFilterName] = useState("All");

  const names = useMemo(() => ["All", ...new Set(list.map(e => e.name))], [list]);
  const filtered = useMemo(() => filterName === "All" ? list : list.filter(e => e.name === filterName), [list, filterName]);

  const monthlyChart = useMemo(() => {
    const m = {};
    list.forEach(e => {
      if (!m[e.month]) m[e.month] = { month: e.month, invested: 0, value: 0 };
      m[e.month].invested += +e.invested || 0;
      m[e.month].value += +e.latestValue || 0;
    });
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month)).map(r => ({
      ...r, returnPct: r.invested > 0 ? ((r.value - r.invested) / r.invested) * 100 : 0,
    }));
  }, [list]);

  const totals = useMemo(() => ({
    invested: filtered.reduce((s, e) => s + (+e.invested || 0), 0),
    value: filtered.reduce((s, e) => s + (+e.latestValue || 0), 0),
  }), [filtered]);

  const openAdd = () => { setEditId(null); setForm(EMPTY_EQ); setShowForm(true); };
  const openEdit = e => { setEditId(e.id); setForm({ ...e }); setShowForm(true); };
  const save = () => {
    const e = { ...form, id: editId || Date.now(), invested: +form.invested, units: +form.units, latestValue: +form.latestValue };
    setList(editId ? list.map(x => x.id === editId ? e : x) : [...list, e]);
    setShowForm(false);
  };
  const ret = totals.value - totals.invested;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <SyncBadge status={syncStatus} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <Card><Stat label="Invested" value={inr(totals.invested, true)} color={T.blue} /></Card>
        <Card><Stat label="Current Value" value={inr(totals.value, true)} color={T.accent} /></Card>
        <Card><Stat label="Return" value={inr(ret, true)} color={ret >= 0 ? T.accent : T.red}
          sub={totals.invested ? pct((ret / totals.invested) * 100) : ""} /></Card>
      </div>

      {monthlyChart.length > 0 && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Monthly Value vs Cost</div>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={monthlyChart}>
                <defs>
                  <linearGradient id="ag1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T.accent} stopOpacity={0.3}/><stop offset="95%" stopColor={T.accent} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T.blue} stopOpacity={0.2}/><stop offset="95%" stopColor={T.blue} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => inr(v, true)} tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
                <TT formatter={(v, n) => [inr(v), n === "value" ? "Market Value" : "Cost"]} />
                <Area type="monotone" dataKey="value" name="value" stroke={T.accent} fill="url(#ag1)" strokeWidth={2} />
                <Area type="monotone" dataKey="invested" name="invested" stroke={T.blue} fill="url(#ag2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Return % by Month</div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => v.toFixed(1)+"%"} tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
                <TT formatter={v => [v.toFixed(2)+"%","Return"]} />
                <ReferenceLine y={0} stroke={T.border} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="returnPct" stroke={T.gold} strokeWidth={2.5} dot={{ fill: T.gold, r: 4 }} name="returnPct" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={filterName} onChange={e => setFilterName(e.target.value)} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", color: T.text, fontSize: 12 }}>
          {names.map(n => <option key={n}>{n}</option>)}
        </select>
        <Btn onClick={openAdd}>+ Add Entry</Btn>
      </div>

      {list.length === 0
        ? <div style={{ textAlign: "center", color: T.muted, padding: 50 }}>No entries yet — tap + Add Entry</div>
        : <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Month","Name","Type","Invested","Units","Latest Value","Return",""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 6px", color: T.muted, fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a,b) => b.month.localeCompare(a.month)).map(e => {
                  const r = (+e.latestValue||0) - (+e.invested||0);
                  const rp = e.invested ? (r / +e.invested) * 100 : 0;
                  return (
                    <tr key={e.id} style={{ borderBottom: `1px solid ${T.border}22` }}>
                      <td style={{ padding: "9px 6px", color: T.sub }}>{e.month}</td>
                      <td style={{ padding: "9px 6px", color: T.text, fontWeight: 600 }}>{e.name}</td>
                      <td style={{ padding: "9px 6px" }}><span style={{ background: e.type==="Share" ? T.blue+"22" : T.purple+"22", color: e.type==="Share" ? T.blue : T.purple, borderRadius: 6, padding: "2px 7px", fontSize: 10 }}>{e.type}</span></td>
                      <td style={{ padding: "9px 6px", color: T.blue }}>{inr(e.invested, true)}</td>
                      <td style={{ padding: "9px 6px", color: T.sub }}>{e.units}</td>
                      <td style={{ padding: "9px 6px", color: T.accent, fontWeight: 700 }}>{inr(e.latestValue, true)}</td>
                      <td style={{ padding: "9px 6px", color: r>=0 ? T.accent : T.red, fontWeight: 700 }}>{inr(r,true)} <span style={{ fontSize: 10 }}>({pct(rp)})</span></td>
                      <td style={{ padding: "9px 6px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Btn onClick={() => openEdit(e)} v="ghost" style={{ padding: "3px 8px" }}>✎</Btn>
                          <Btn onClick={() => setList(list.filter(x => x.id !== e.id))} v="danger" style={{ padding: "3px 8px" }}>✕</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      }

      {showForm && (
        <Modal title={editId ? "Edit Entry" : "Add Equity / MF"} onClose={() => setShowForm(false)}>
          <Field label="Month (YYYY-MM)" value={form.month} onChange={v => setForm({...form, month: v})} />
          <Field label="Investment Name" value={form.name} onChange={v => setForm({...form, name: v})} />
          <Field label="Type" value={form.type} onChange={v => setForm({...form, type: v})} opts={["Share","Mutual Fund"]} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Invested (₹)" type="number" value={form.invested} onChange={v => setForm({...form, invested: v})} />
            <Field label="Units / Qty" type="number" value={form.units} onChange={v => setForm({...form, units: v})} />
            <Field label="Latest Value (₹)" type="number" value={form.latestValue} onChange={v => setForm({...form, latestValue: v})} />
          </div>
          {form.invested > 0 && form.latestValue > 0 && (
            <div style={{ background: T.accentDim, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.accent }}>Return</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: form.latestValue >= form.invested ? T.accent : T.red }}>
                {inr(form.latestValue - form.invested)} ({pct(((form.latestValue - form.invested) / form.invested) * 100)})
              </div>
            </div>
          )}
          <Btn onClick={save} style={{ width: "100%", padding: 13, fontSize: 14 }}>{editId ? "Save" : "Add"}</Btn>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHEET 3 — SALARY & FX
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_SAL = { month: "", salarySAR: "", expensesSAR: "", transferredSAR: "", convRate: "", otherIncome: "", notes: "" };

function SalarySheet() {
  const [list, setList, syncStatus] = useCloudData("sal2", []);
  const [form, setForm] = useState(EMPTY_SAL);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const enriched = useMemo(() => [...list].sort((a,b) => a.month.localeCompare(b.month)).map(r => ({
    ...r,
    savingsSAR: (+r.salarySAR||0) + (+r.otherIncome||0) - (+r.expensesSAR||0) - (+r.transferredSAR||0),
    transferredINR: (+r.transferredSAR||0) * (+r.convRate||0),
  })), [list]);

  const n = enriched.length || 1;
  const avg = useMemo(() => ({
    salary: enriched.reduce((s,r) => s + (+r.salarySAR||0), 0) / n,
    expenses: enriched.reduce((s,r) => s + (+r.expensesSAR||0), 0) / n,
    transferred: enriched.reduce((s,r) => s + (+r.transferredSAR||0), 0) / n,
    transferredINR: enriched.reduce((s,r) => s + r.transferredINR, 0) / n,
    savings: enriched.reduce((s,r) => s + r.savingsSAR, 0) / n,
    convRate: enriched.reduce((s,r) => s + (+r.convRate||0), 0) / n,
  }), [enriched, n]);

  const openAdd = () => { setEditId(null); setForm(EMPTY_SAL); setShowForm(true); };
  const openEdit = r => { setEditId(r.id); setForm({ ...r }); setShowForm(true); };
  const save = () => {
    const e = { ...form, id: editId || Date.now(), salarySAR: +form.salarySAR, expensesSAR: +form.expensesSAR, transferredSAR: +form.transferredSAR, convRate: +form.convRate, otherIncome: +form.otherIncome };
    setList(editId ? list.map(x => x.id === editId ? e : x) : [...list, e]);
    setShowForm(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <SyncBadge status={syncStatus} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <Card><Stat label="Avg Salary/mo" value={`SAR ${Math.round(avg.salary).toLocaleString()}`} color={T.blue} /></Card>
        <Card><Stat label="Avg Transfer/mo" value={inr(Math.round(avg.transferredINR), true)} color={T.accent} /></Card>
        <Card><Stat label="Avg Expenses/mo" value={`SAR ${Math.round(avg.expenses).toLocaleString()}`} color={T.red} /></Card>
        <Card><Stat label="Avg Conv Rate" value={`₹${avg.convRate.toFixed(2)}`} color={T.gold} sub="per 1 SAR" /></Card>
      </div>

      {enriched.length > 0 && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Monthly SAR Flow</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={enriched} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.sub, fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
                <TT />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="salarySAR" name="Salary" fill={T.blue} radius={[3,3,0,0]} />
                <Bar dataKey="expensesSAR" name="Expenses" fill={T.red} radius={[3,3,0,0]} />
                <Bar dataKey="transferredSAR" name="Transferred" fill={T.accent} radius={[3,3,0,0]} />
                <Bar dataKey="savingsSAR" name="Saved" fill={T.gold} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>INR Transferred to India</div>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={enriched}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T.accent} stopOpacity={0.3}/><stop offset="95%" stopColor={T.accent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.sub, fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => inr(v,true)} tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
                <TT formatter={v => inr(v)} />
                <Area type="monotone" dataKey="transferredINR" name="INR Transferred" stroke={T.accent} fill="url(#sg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>SAR → INR Rate Trend</div>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={enriched}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.sub, fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis domain={["auto","auto"]} tickFormatter={v => "₹"+v} tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
                <TT formatter={v => ["₹"+Number(v).toFixed(2),"Rate"]} />
                <ReferenceLine y={avg.convRate} stroke={T.gold} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="convRate" stroke={T.gold} strokeWidth={2} dot={{ fill: T.gold, r: 3 }} name="Rate" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Btn onClick={openAdd}>+ Add Month</Btn>
      </div>

      {list.length === 0
        ? <div style={{ textAlign: "center", color: T.muted, padding: 50 }}>No salary data yet — tap + Add Month</div>
        : <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Month","Salary SAR","Other","Expenses","Transferred SAR","Rate","Transferred INR","Saved","Notes",""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 6px", color: T.muted, fontWeight: 600, fontSize: 9, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enriched.map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}22` }}>
                    <td style={{ padding: "9px 6px", color: T.text, fontWeight: 700 }}>{r.month}</td>
                    <td style={{ padding: "9px 6px", color: T.blue }}>{(+r.salarySAR||0).toLocaleString()}</td>
                    <td style={{ padding: "9px 6px", color: T.sub }}>{r.otherIncome || "—"}</td>
                    <td style={{ padding: "9px 6px", color: T.red }}>{(+r.expensesSAR||0).toLocaleString()}</td>
                    <td style={{ padding: "9px 6px", color: T.accent }}>{(+r.transferredSAR||0).toLocaleString()}</td>
                    <td style={{ padding: "9px 6px", color: T.gold }}>₹{r.convRate}</td>
                    <td style={{ padding: "9px 6px", color: T.accent, fontWeight: 700 }}>{inr(Math.round(r.transferredINR), true)}</td>
                    <td style={{ padding: "9px 6px", color: r.savingsSAR >= 0 ? T.accent : T.red, fontWeight: 700 }}>{r.savingsSAR.toLocaleString()}</td>
                    <td style={{ padding: "9px 6px", color: T.muted }}>{r.notes || "—"}</td>
                    <td style={{ padding: "9px 6px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Btn onClick={() => openEdit(r)} v="ghost" style={{ padding: "3px 8px" }}>✎</Btn>
                        <Btn onClick={() => setList(list.filter(x => x.id !== r.id))} v="danger" style={{ padding: "3px 8px" }}>✕</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${T.border}`, background: T.surface }}>
                  <td style={{ padding: "9px 6px", color: T.gold, fontWeight: 800, fontSize: 10 }}>AVG</td>
                  <td style={{ padding: "9px 6px", color: T.gold, fontWeight: 700 }}>{Math.round(avg.salary).toLocaleString()}</td>
                  <td />
                  <td style={{ padding: "9px 6px", color: T.red, fontWeight: 700 }}>{Math.round(avg.expenses).toLocaleString()}</td>
                  <td style={{ padding: "9px 6px", color: T.accent, fontWeight: 700 }}>{Math.round(avg.transferred).toLocaleString()}</td>
                  <td style={{ padding: "9px 6px", color: T.gold }}>₹{avg.convRate.toFixed(2)}</td>
                  <td style={{ padding: "9px 6px", color: T.accent, fontWeight: 700 }}>{inr(Math.round(avg.transferredINR), true)}</td>
                  <td style={{ padding: "9px 6px", color: avg.savings >= 0 ? T.accent : T.red, fontWeight: 700 }}>{Math.round(avg.savings).toLocaleString()}</td>
                  <td /><td />
                </tr>
              </tbody>
            </table>
          </div>
      }

      {showForm && (
        <Modal title={editId ? "Edit Month" : "Add Month"} onClose={() => setShowForm(false)}>
          <Field label="Month (YYYY-MM)" value={form.month} onChange={v => setForm({...form, month: v})} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Salary (SAR)" type="number" value={form.salarySAR} onChange={v => setForm({...form, salarySAR: v})} />
            <Field label="Other Income (SAR)" type="number" value={form.otherIncome} onChange={v => setForm({...form, otherIncome: v})} />
            <Field label="Expenses (SAR)" type="number" value={form.expensesSAR} onChange={v => setForm({...form, expensesSAR: v})} />
            <Field label="Transferred (SAR)" type="number" value={form.transferredSAR} onChange={v => setForm({...form, transferredSAR: v})} />
            <Field label="SAR → INR Rate" type="number" value={form.convRate} onChange={v => setForm({...form, convRate: v})} />
          </div>
          {form.transferredSAR > 0 && form.convRate > 0 && (
            <div style={{ background: T.accentDim, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.accent }}>INR Transferred</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.accent }}>{inr(Math.round(form.transferredSAR * form.convRate))}</div>
            </div>
          )}
          <Field label="Notes" value={form.notes} onChange={v => setForm({...form, notes: v})} />
          <Btn onClick={save} style={{ width: "100%", padding: 13, fontSize: 14 }}>{editId ? "Save" : "Add Month"}</Btn>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS SHEET
// ─────────────────────────────────────────────────────────────────────────────
function SettingsSheet({ onLock }) {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [msg, setMsg] = useState("");

  const changePin = async () => {
    // Check against both local and cloud PIN
    const localPin = load("app_pin", "1234");
    const cloudPin = await loadFromCloud("app_pin");
    const currentPin = (cloudPin && typeof cloudPin === "string" && cloudPin.length === 4) ? cloudPin : localPin;
    if (oldPin !== currentPin) { setMsg("❌ Current PIN is incorrect"); return; }
    if (!/^\d{4}$/.test(newPin)) { setMsg("❌ New PIN must be exactly 4 digits"); return; }
    if (newPin !== confirmPin) { setMsg("❌ PINs do not match"); return; }
    // Save to Firebase first, then localStorage
    await saveToCloud("app_pin", newPin);
    persist("app_pin", newPin);
    setMsg("✅ PIN changed on all devices!");
    setOldPin(""); setNewPin(""); setConfirmPin("");
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>🔐 Change PIN</div>
        <Field label="Current PIN" type="password" value={oldPin} onChange={setOldPin} />
        <Field label="New PIN (4 digits)" type="password" value={newPin} onChange={setNewPin} />
        <Field label="Confirm New PIN" type="password" value={confirmPin} onChange={setConfirmPin} />
        {msg && <div style={{ background: msg.startsWith("✅") ? T.accentDim : T.red+"22", border: `1px solid ${msg.startsWith("✅") ? T.accent : T.red}44`, borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 700, color: msg.startsWith("✅") ? T.accent : T.red, marginBottom: 12 }}>{msg}</div>}
        <Btn onClick={changePin} style={{ width: "100%", padding: 12 }}>Change PIN</Btn>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>☁️ Cloud Sync</div>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 4 }}>Your data syncs automatically to Firebase.</div>
        <div style={{ fontSize: 12, color: T.sub }}>Same data appears on all your devices instantly.</div>
        <div style={{ marginTop: 12, background: T.accentDim, borderRadius: 10, padding: 10, fontSize: 12, color: T.accent, fontWeight: 600 }}>✓ Connected to Firebase · Sheth Family Tracker</div>
      </Card>

      <Card>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>🔒 Lock App</div>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 12 }}>Lock the app and return to PIN screen.</div>
        <Btn onClick={onLock} v="danger" style={{ width: "100%", padding: 12 }}>Lock Now</Btn>
      </Card>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SHEET 4 — MONTHLY SIPs
// ─────────────────────────────────────────────────────────────────────────────
const SIP_INTERVALS = ["Monthly","Weekly","Quarterly","Yearly"];
const EMPTY_SIP = { name: "", sipAmt: "", lumpsumAmt: "", interval: "Monthly", date: "", sipWith: "", proposer: PROPOSERS[0], remarks: "" };

function SIPSheet() {
  const [list, setList, syncStatus] = useCloudData("sip2", []);
  const [form, setForm] = useState(EMPTY_SIP);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterProposer, setFilterProposer] = useState("All");

  const filtered = useMemo(() =>
    filterProposer === "All" ? list : list.filter(s => s.proposer === filterProposer),
    [list, filterProposer]);

  // Monthly chart data — aggregate SIP + lumpsum by month
  const monthlyChart = useMemo(() => {
    const m = {};
    list.forEach(s => {
      const mo = s.date ? s.date.slice(0, 7) : "Unknown";
      if (!m[mo]) m[mo] = { month: mo, sip: 0, lumpsum: 0, total: 0 };
      m[mo].sip += +s.sipAmt || 0;
      m[mo].lumpsum += +s.lumpsumAmt || 0;
      m[mo].total += (+s.sipAmt || 0) + (+s.lumpsumAmt || 0);
    });
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month));
  }, [list]);

  // By proposer summary
  const byProposer = useMemo(() => {
    const m = {};
    list.forEach(s => {
      if (!m[s.proposer]) m[s.proposer] = { sip: 0, lumpsum: 0, count: 0 };
      m[s.proposer].sip += +s.sipAmt || 0;
      m[s.proposer].lumpsum += +s.lumpsumAmt || 0;
      m[s.proposer].count++;
    });
    return m;
  }, [list]);

  const totals = useMemo(() => ({
    sip: filtered.reduce((s, x) => s + (+x.sipAmt || 0), 0),
    lumpsum: filtered.reduce((s, x) => s + (+x.lumpsumAmt || 0), 0),
  }), [filtered]);

  const openAdd = () => { setEditId(null); setForm(EMPTY_SIP); setShowForm(true); };
  const openEdit = s => { setEditId(s.id); setForm({ ...s }); setShowForm(true); };
  const save = () => {
    const e = { ...form, id: editId || Date.now(), sipAmt: +form.sipAmt, lumpsumAmt: +form.lumpsumAmt };
    setList(editId ? list.map(x => x.id === editId ? e : x) : [...list, e]);
    setShowForm(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <SyncBadge status={syncStatus} />
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <Card><Stat label="Total SIP/mo" value={inr(totals.sip, true)} color={T.accent} /></Card>
        <Card><Stat label="Total Lumpsum" value={inr(totals.lumpsum, true)} color={T.blue} /></Card>
        <Card><Stat label="Total Invested" value={inr(totals.sip + totals.lumpsum, true)} color={T.gold} sub={`${filtered.length} SIPs`} /></Card>
      </div>

      {/* Monthwise SIP Bar Chart */}
      {monthlyChart.length > 0 && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Monthwise SIP Investment</div>
            <div style={{ fontSize: 10, color: T.muted, marginBottom: 12 }}>SIP amount + Lumpsum per month</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyChart} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.sub, fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => inr(v, true)} tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
                <TT formatter={(v, n) => [inr(v), n === "sip" ? "SIP" : n === "lumpsum" ? "Lumpsum" : "Total"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="sip" name="SIP" fill={T.accent} radius={[3,3,0,0]} stackId="a" />
                <Bar dataKey="lumpsum" name="Lumpsum" fill={T.blue} radius={[3,3,0,0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Cumulative SIP Growth</div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={monthlyChart.reduce((acc, m, i) => {
                const prev = acc[i - 1]?.cumulative || 0;
                return [...acc, { ...m, cumulative: prev + m.total }];
              }, [])}>
                <defs>
                  <linearGradient id="sipg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={T.accent} stopOpacity={0.3}/><stop offset="95%" stopColor={T.accent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.sub, fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => inr(v, true)} tick={{ fill: T.sub, fontSize: 10 }} axisLine={false} tickLine={false} />
                <TT formatter={v => [inr(v), "Cumulative"]} />
                <Area type="monotone" dataKey="cumulative" stroke={T.accent} fill="url(#sipg)" strokeWidth={2} name="Cumulative" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {/* Proposer Summary */}
      {Object.keys(byProposer).length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>By Proposer</div>
          {Object.entries(byProposer).map(([name, d]) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{name}</div>
                <div style={{ fontSize: 10, color: T.muted }}>{d.count} SIPs</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>{inr(d.sip, true)} SIP</div>
                <div style={{ fontSize: 10, color: T.blue }}>{inr(d.lumpsum, true)} Lumpsum</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Filter + Add */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={filterProposer} onChange={e => setFilterProposer(e.target.value)}
          style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", color: T.text, fontSize: 12 }}>
          <option value="All">All Proposers</option>
          {PROPOSERS.map(p => <option key={p}>{p}</option>)}
        </select>
        <Btn onClick={openAdd}>+ Add SIP</Btn>
      </div>

      {/* Table */}
      {list.length === 0
        ? <div style={{ textAlign: "center", color: T.muted, padding: 50 }}>No SIPs yet — tap + Add SIP</div>
        : <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Name","SIP With","Proposer","SIP Amt","Lumpsum","Interval","Date","Remarks",""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 6px", color: T.muted, fontWeight: 600, fontSize: 9, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${T.border}22` }}>
                    <td style={{ padding: "9px 6px", color: T.text, fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: "9px 6px", color: T.sub }}>{s.sipWith || "—"}</td>
                    <td style={{ padding: "9px 6px", color: T.sub }}>{(s.proposer||"").split(" ")[0]}</td>
                    <td style={{ padding: "9px 6px", color: T.accent, fontWeight: 700 }}>{inr(s.sipAmt, true)}</td>
                    <td style={{ padding: "9px 6px", color: T.blue }}>{s.lumpsumAmt > 0 ? inr(s.lumpsumAmt, true) : "—"}</td>
                    <td style={{ padding: "9px 6px" }}>
                      <span style={{ background: T.accentDim, color: T.accent, borderRadius: 6, padding: "2px 7px", fontSize: 10 }}>{s.interval}</span>
                    </td>
                    <td style={{ padding: "9px 6px", color: T.sub, whiteSpace: "nowrap" }}>{s.date || "—"}</td>
                    <td style={{ padding: "9px 6px", color: T.muted, fontSize: 10 }}>{s.remarks || "—"}</td>
                    <td style={{ padding: "9px 6px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Btn onClick={() => openEdit(s)} v="ghost" style={{ padding: "3px 8px" }}>✎</Btn>
                        <Btn onClick={() => setList(list.filter(x => x.id !== s.id))} v="danger" style={{ padding: "3px 8px" }}>✕</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }

      {/* Modal */}
      {showForm && (
        <Modal title={editId ? "Edit SIP" : "Add SIP"} onClose={() => setShowForm(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="SIP / Fund Name" value={form.name} onChange={v => setForm({...form, name: v})} />
            <Field label="SIP With (Bank/AMC)" value={form.sipWith} onChange={v => setForm({...form, sipWith: v})} />
            <Field label="SIP Amount (₹)" type="number" value={form.sipAmt} onChange={v => setForm({...form, sipAmt: v})} />
            <Field label="Lumpsum Amount (₹)" type="number" value={form.lumpsumAmt} onChange={v => setForm({...form, lumpsumAmt: v})} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="SIP Interval" value={form.interval} onChange={v => setForm({...form, interval: v})} opts={SIP_INTERVALS} />
            <Field label="Date of SIP" type="date" value={form.date} onChange={v => setForm({...form, date: v})} />
          </div>
          <Field label="Proposer" value={form.proposer} onChange={v => setForm({...form, proposer: v})} opts={PROPOSERS} />
          <Field label="Remarks" value={form.remarks} onChange={v => setForm({...form, remarks: v})} />
          {(form.sipAmt > 0 || form.lumpsumAmt > 0) && (
            <div style={{ background: T.accentDim, border: `1px solid ${T.accent}33`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.accent }}>Total Investment</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.accent }}>{inr((+form.sipAmt || 0) + (+form.lumpsumAmt || 0))}</div>
            </div>
          )}
          <Btn onClick={save} style={{ width: "100%", padding: 13, fontSize: 14 }}>{editId ? "Save Changes" : "Add SIP"}</Btn>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [sheet, setSheet] = useState(0);

  const SHEETS = [
    { label: "Investments", icon: "🏦" },
    { label: "Equity & MF", icon: "📈" },
    { label: "SIPs", icon: "🔄" },
    { label: "Salary & FX", icon: "💱" },
    { label: "Settings", icon: "⚙️" },
  ];

  if (!unlocked) return <PinLock onUnlock={() => setUnlocked(true)} />;

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "14px 18px", position: "sticky", top: 0, zIndex: 200 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, textTransform: "uppercase" }}>Sheth Family</div>
            <div style={{ fontSize: 18, fontWeight: 900, background: `linear-gradient(90deg,${T.accent},${T.blue})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Investment Tracker
            </div>
          </div>
          <div style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>☁️ Cloud Sync ON</div>
        </div>
      </div>

      <div style={{ display: "flex", background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 8px" }}>
        {SHEETS.map((s, i) => (
          <button key={i} onClick={() => setSheet(i)} style={{
            flex: 1, padding: "10px 2px", background: "none", border: "none",
            borderBottom: sheet === i ? `2px solid ${T.accent}` : "2px solid transparent",
            color: sheet === i ? T.accent : T.muted, fontWeight: 700, fontSize: 10,
            cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2
          }}>
            <span style={{ fontSize: 14 }}>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 14px 80px" }}>
        {sheet === 0 && <InvestmentsSheet />}
        {sheet === 1 && <EquitySheet />}
        {sheet === 2 && <SIPSheet />}
        {sheet === 3 && <SalarySheet />}
        {sheet === 4 && <SettingsSheet onLock={() => setUnlocked(false)} />}
      </div>
    </div>
  );
}