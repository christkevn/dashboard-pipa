"use client";
import { Fragment, useEffect, useState } from "react";
import type { Cabang, Kategori, Periode, Result, Sum } from "@/lib/produksi";

const PERIODE: [Periode, string][] = [["daily", "Harian"], ["weekly", "Mingguan (H-7)"], ["monthly", "Bulanan"], ["yearly", "Tahunan"]];
const PABRIK: [Cabang, string, string][] = [["%", "Semua Pabrik", "Wotan & Cirebon"], ["IPW", "AAIP Wotan", "Pipa & Fitting"], ["IPC", "AAIP Cirebon", "Pipa, Fitting & Selang"]];
const KAT: [Kategori, string][] = [["PIPA", "Pipa"], ["FITTING", "Fitting"], ["SELANG", "Selang"]];

const fmt = (n: number) => Math.round(n).toLocaleString("id-ID");
const pct = (s: Sum) => (s.target > 0 ? (s.aktual / s.target) * 100 : null);
const pctTxt = (s: Sum) => (pct(s) === null ? "-" : pct(s)!.toFixed(1).replace(".", ",") + "%");
const ok = (s: Sum) => s.target > 0 ? s.aktual >= s.target : s.aktual > 0;

export default function Page() {
  const [periode, setPeriode] = useState<Periode>("daily");
  const [cabang, setCabang] = useState<Cabang>("%");
  const [tanggal, setTanggal] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [data, setData] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true); setErr("");
    fetch(`/api/produksi?${new URLSearchParams({ periode, tanggal, cabang })}`, { signal: ctrl.signal })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setData(j); })
      .catch((e) => { if (e.name !== "AbortError") setErr(e.message || "Gagal memuat data"); })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [periode, tanggal, cabang]);

  const btn = (on: boolean) => `px-3 py-1.5 rounded-lg text-xs font-bold transition ${on ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`;
  const color = (s: Sum) => (ok(s) ? "text-emerald-600" : "text-red-600");

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <header className="pb-3 border-b border-slate-200">
        <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Hasil Produksi Pabrik</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">Monitoring realisasi produksi dan target output pabrik{data && ` · ${data.rentang}`}</p>
      </header>

      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-sm p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODE.map(([k, l]) => <button key={k} className={btn(periode === k)} onClick={() => setPeriode(k)}>{l}</button>)}
          {periode === "monthly" ? (
            <input type="month" className="border border-slate-300 rounded-lg px-2 py-1 text-xs" value={tanggal.slice(0, 7)} onChange={(e) => e.target.value && setTanggal(e.target.value + "-01")} />
          ) : periode === "yearly" ? (
            <input type="number" min={2020} max={2100} className="border border-slate-300 rounded-lg px-2 py-1 text-xs w-24" value={tanggal.slice(0, 4)} onChange={(e) => e.target.value.length === 4 && setTanggal(e.target.value + "-01-01")} />
          ) : (
            <input type="date" className="border border-slate-300 rounded-lg px-2 py-1 text-xs" value={tanggal} onChange={(e) => e.target.value && setTanggal(e.target.value)} />
          )}
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {PABRIK.map(([k, l, s]) => (
            <button key={k} className={btn(cabang === k)} onClick={() => setCabang(k)}>
              <span className="block leading-tight">{l}</span><span className="block text-[9px] font-normal opacity-80">{s}</span>
            </button>
          ))}
        </div>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-bold">Gagal memuat data: {err}</div>}

      {data && (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-50" : ""}`}>
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Kpi label="Target Pabrik" value={`${fmt(data.ringkasan.target)} Ton`} />
            <Kpi label="Total Aktual Pabrik" value={`${fmt(data.ringkasan.aktual)} Ton`} />
            <Kpi label="Pencapaian Pabrik" value={pctTxt(data.ringkasan)} cls={color(data.ringkasan)} />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {KAT.map(([k, l]) => {
              const s = data.kategori[k]; const p = pct(s);
              return (
                <div key={k} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <h2 className="text-lg font-black">Hasil Produksi {l}</h2>
                    <span className={`px-2.5 py-1 rounded-lg text-sm font-bold font-mono border ${ok(s) ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-red-500/15 text-red-600 border-red-500/30"}`}>{pctTxt(s)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-slate-100 rounded-xl p-3"><p className="text-[11px] font-extrabold uppercase text-slate-500">Target</p><p className="text-xl font-black font-mono">{fmt(s.target)} Ton</p></div>
                    <div className="bg-slate-900/5 border border-slate-900/10 rounded-xl p-3"><p className="text-[11px] font-extrabold uppercase text-slate-900">Aktual</p><p className="text-xl font-black font-mono">{fmt(s.aktual)} Ton</p></div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="flex justify-between text-xs font-mono mb-2"><span className="font-bold text-slate-500">Realisasi Target</span><span className={`font-black ${color(s)}`}>Selisih: {fmt(s.aktual - s.target)} Ton</span></div>
                    <div className="w-full bg-slate-200 rounded-full h-3 p-0.5"><div className={`h-2 rounded-full transition-all duration-500 ${ok(s) ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(p ?? 0, 100)}%` }} /></div>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap justify-between gap-3">
              <h2 className="text-lg font-bold">Hasil Produksi {data.periode === "yearly" ? "Bulanan" : "Harian"} <span className="text-xs font-medium text-slate-500">(Ton)</span></h2>
              <div className="flex gap-2 text-xs font-extrabold">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">≥ Target</span>
                <span className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-600 border border-red-500/30">&lt; Target</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-max">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2" rowSpan={2}>{data.periode === "yearly" ? "Bulan" : "Tanggal"}</th>
                    {KAT.map(([k, l]) => <th key={k} className="px-4 py-2 text-center border-l border-slate-200" colSpan={2}>{l}</th>)}
                    <th className="px-4 py-2 text-center border-l border-slate-200" colSpan={3}>Total</th>
                  </tr>
                  <tr className="text-[10px]">
                    {[...KAT, ["T", "Total"]].map(([k]) => (<Fragment key={k}><th className="px-4 py-1 text-right border-l border-slate-200">Target</th><th className="px-4 py-1 text-right">Aktual</th></Fragment>))}
                    <th className="px-4 py-1 text-right">%</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {data.tabel.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-500">Tidak ada data (0 Ton)</td></tr>}
                  {data.tabel.map((r) => {
                    const tot: Sum = { target: r.PIPA.target + r.FITTING.target + r.SELANG.target, aktual: r.PIPA.aktual + r.FITTING.aktual + r.SELANG.aktual };
                    return (
                      <tr key={r.key} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2 font-bold font-sans capitalize">{r.label}</td>
                        {[...KAT.map(([k]) => r[k]), tot].map((s, i) => (<Fragment key={i}><td className="px-4 py-2 text-right border-l border-slate-100 text-slate-500">{fmt(s.target)}</td><td className={`px-4 py-2 text-right font-bold ${color(s)}`}>{fmt(s.aktual)}</td></Fragment>))}
                        <td className={`px-4 py-2 text-right font-black ${color(tot)}`}>{pctTxt(tot)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      {!data && !err && <p className="text-sm text-slate-500">Memuat data…</p>}
    </main>
  );
}

function Kpi({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs uppercase font-extrabold text-slate-500">{label}</p>
      <p className={`text-2xl font-black font-mono mt-1 ${cls}`}>{value}</p>
    </div>
  );
}
