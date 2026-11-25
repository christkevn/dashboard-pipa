import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Endpoint diagnosa sementara: hapus setelah masalah koneksi selesai.
export async function GET() {
  const base = process.env.API_BASE_URL;
  const info: Record<string, unknown> = {
    node: process.version,
    openssl: process.versions.openssl,
    region: process.env.VERCEL_REGION ?? "lokal",
    envTerisi: { API_BASE_URL: !!base, API_KEY: !!process.env.API_KEY },
  };
  if (base && process.env.API_KEY) {
    const t = Date.now();
    try {
      const res = await fetch(`${base}/daily-production`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.API_KEY },
        body: JSON.stringify({ tanggal_awal: "2026-03-11", tanggal_akhir: "2026-03-11", cabang: "%", kategori: "PIPA" }),
        cache: "no-store",
      });
      info.hasil = { status: res.status, ms: Date.now() - t };
    } catch (e) {
      const c = (e as { cause?: { code?: string; message?: string } }).cause;
      info.hasil = { error: c?.code ?? (e as Error).message, detail: c?.message, ms: Date.now() - t };
    }
  }
  return NextResponse.json(info);
}
