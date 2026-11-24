export const KATEGORI = ["PIPA", "FITTING", "SELANG"] as const;
export type Kategori = (typeof KATEGORI)[number];
export type Periode = "daily" | "weekly" | "monthly" | "yearly";
export type Cabang = "%" | "IPW" | "IPC";

export type Sum = { target: number; aktual: number };
export type Row = { key: string; label: string } & Record<Kategori, Sum>;
export type Result = {
  periode: Periode;
  rentang: string;
  ringkasan: Sum;
  kategori: Record<Kategori, Sum>;
  tabel: Row[];
};


type Raw = Record<string, string>;
const num = (v: unknown) => parseFloat(String(v ?? "0")) || 0;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

async function call(endpoint: string, body: object): Promise<Raw[]> {
  const BASE = process.env.API_BASE_URL;
  const KEY = process.env.API_KEY;
  if (!BASE || !KEY) throw new Error("Environment variable API_BASE_URL / API_KEY belum diisi di server (Vercel > Settings > Environment Variables)");
  let res: Response;
  try {
    res = await fetch(`${BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": KEY },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    const c = (e as { cause?: { code?: string; message?: string } }).cause;
    throw new Error(`Tidak bisa terhubung ke API (${c?.code || c?.message || (e as Error).message})`);
  }
  if (!res.ok) throw new Error(`API ${endpoint} gagal (HTTP ${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

const empty = (): Record<Kategori, Sum> => ({
  PIPA: { target: 0, aktual: 0 },
  FITTING: { target: 0, aktual: 0 },
  SELANG: { target: 0, aktual: 0 },
});

function group(rows: Record<Kategori, Raw[]>, keyOf: (r: Raw) => string, labelOf: (k: string) => string): Row[] {
  const map = new Map<string, Row>();
  for (const k of KATEGORI) {
    for (const r of rows[k]) {
      const key = keyOf(r);
      if (!map.has(key)) map.set(key, { key, label: labelOf(key), ...empty() });
      const s = map.get(key)![k];
      s.target += num(r.ProdPlan);
      s.aktual += num(r.ProdActual);
    }
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

const sumRows = (rows: Raw[]): Sum =>
  rows.reduce((a, r) => ({ target: a.target + num(r.ProdPlan), aktual: a.aktual + num(r.ProdActual) }), { target: 0, aktual: 0 });

const perKategori = async (fn: (k: Kategori) => Promise<Raw[]>) => {
  const out = await Promise.all(KATEGORI.map(fn));
  return Object.fromEntries(KATEGORI.map((k, i) => [k, out[i]])) as Record<Kategori, Raw[]>;
};

export async function getProduksi(periode: Periode, tanggal: string, cabang: Cabang): Promise<Result> {
  const [y, m] = tanggal.split("-").map(Number);
  let summary: Record<Kategori, Raw[]>;
  let tableRows: Record<Kategori, Raw[]>;
  let keyOf: (r: Raw) => string;
  let labelOf: (k: string) => string = (k) => k;
  let rentang: string;

  const daily = (a: string, b: string) => perKategori((kategori) => call("daily-production", { tanggal_awal: a, tanggal_akhir: b, cabang, kategori }));
  const monthly = (a: number, b: number) => perKategori((kategori) => call("monthly-production", { tahun: y, bulan_awal: a, bulan_akhir: b, cabang, kategori }));

  if (periode === "daily") {
    summary = tableRows = await daily(tanggal, tanggal);
    keyOf = (r) => r.dt;
    rentang = tanggal;
  } else if (periode === "weekly") {
    const awal = addDays(tanggal, -6);
    summary = tableRows = await perKategori((kategori) => call("weekly-production", { tanggal_awal: awal, tanggal_akhir: tanggal, cabang, kategori }));
    keyOf = (r) => r["Posting Date"];
    rentang = `${awal} s/d ${tanggal}`;
  } else if (periode === "monthly") {
    const akhir = iso(new Date(Date.UTC(y, m, 0)));
    [summary, tableRows] = await Promise.all([monthly(m, m), daily(`${y}-${String(m).padStart(2, "0")}-01`, akhir)]);
    keyOf = (r) => r.dt;
    rentang = `${String(m).padStart(2, "0")}/${y}`;
  } else {
    summary = tableRows = await monthly(1, 12);
    keyOf = (r) => String(r.mth).padStart(2, "0");
    labelOf = (k) => new Date(Date.UTC(y, Number(k) - 1, 1)).toLocaleDateString("id-ID", { month: "long", timeZone: "UTC" });
    rentang = `Januari - Desember ${y}`;
  }

  const kategori = Object.fromEntries(KATEGORI.map((k) => [k, sumRows(summary[k])])) as Record<Kategori, Sum>;
  const ringkasan = KATEGORI.reduce((a, k) => ({ target: a.target + kategori[k].target, aktual: a.aktual + kategori[k].aktual }), { target: 0, aktual: 0 });
  return { periode, rentang, ringkasan, kategori, tabel: group(tableRows, keyOf, labelOf) };
}
