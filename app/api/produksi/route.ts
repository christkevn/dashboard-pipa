export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";
import { NextRequest, NextResponse } from "next/server";
import { getProduksi, type Cabang, type Periode } from "@/lib/produksi";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const periode = (p.get("periode") ?? "daily") as Periode;
  const tanggal = p.get("tanggal") ?? "";
  const cabang = (p.get("cabang") ?? "%") as Cabang;

  if (!["daily", "weekly", "monthly", "yearly"].includes(periode) || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !["%", "IPW", "IPC"].includes(cabang))
    return NextResponse.json({ error: "Parameter tidak valid" }, { status: 400 });

  try {
    return NextResponse.json(await getProduksi(periode, tanggal, cabang));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
