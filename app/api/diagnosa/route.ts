import { NextResponse } from "next/server";
import https from "node:https";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Endpoint diagnosa sementara: hapus setelah masalah koneksi selesai.
type Opt = { maxVersion?: "TLSv1.2" | "TLSv1.3"; minVersion?: "TLSv1.2" | "TLSv1.3"; ecdhCurve?: string; ua?: boolean };

function probe(url: string, method: "GET" | "POST", opt: Opt, headers: Record<string, string> = {}, body?: string) {
  return new Promise<Record<string, unknown>>((resolve) => {
    const t = Date.now();
    const u = new URL(url);
    const req = https.request(
      {
        host: u.hostname, path: u.pathname + u.search, method, timeout: 10000,
        maxVersion: opt.maxVersion, minVersion: opt.minVersion, ecdhCurve: opt.ecdhCurve,
        servername: u.hostname,
        headers: { ...(opt.ua ? { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" } : {}), ...headers },
      },
      (res) => {
        const s = res.socket as import("node:tls").TLSSocket;
        res.resume();
        resolve({ ok: true, status: res.statusCode, tls: s.getProtocol?.(), cipher: s.getCipher?.()?.name, ms: Date.now() - t });
      }
    );
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, error: "TIMEOUT", ms: Date.now() - t }); });
    req.on("error", (e: NodeJS.ErrnoException) => resolve({ ok: false, error: e.code ?? e.message, ms: Date.now() - t }));
    if (body) req.write(body);
    req.end();
  });
}

export async function GET() {
  const base = process.env.API_BASE_URL ?? "";
  const key = process.env.API_KEY ?? "";
  const host = base ? new URL(base).origin + "/" : "";
  const post = JSON.stringify({ tanggal_awal: "2026-03-11", tanggal_akhir: "2026-03-11", cabang: "%", kategori: "PIPA" });
  const H = { "Content-Type": "application/json", "x-api-key": key, "Content-Length": String(Buffer.byteLength(post)) };

  const info: Record<string, unknown> = {
    node: process.version, openssl: process.versions.openssl,
    region: process.env.VERCEL_REGION ?? "lokal",
    nodeOptions: process.env.NODE_OPTIONS ?? null, execArgv: process.execArgv,
    envTerisi: { API_BASE_URL: !!base, API_KEY: !!key },
  };
  if (!base) return NextResponse.json(info);

  info["1_GET_root_default"] = await probe(host, "GET", {});
  info["2_GET_root_TLS1.2"] = await probe(host, "GET", { maxVersion: "TLSv1.2" });
  info["3_GET_root_TLS1.2_UA_browser"] = await probe(host, "GET", { maxVersion: "TLSv1.2", ua: true });
  info["4_GET_root_curve_prime256v1"] = await probe(host, "GET", { ecdhCurve: "prime256v1", ua: true });
  info["5_POST_api_TLS1.2_UA_browser"] = await probe(`${base}/daily-production`, "POST", { maxVersion: "TLSv1.2", ua: true }, H, post);
  return NextResponse.json(info, { headers: { "Cache-Control": "no-store" } });
}
