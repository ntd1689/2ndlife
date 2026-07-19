import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/admin";
import { getSettings, updateSettings } from "@/lib/settings";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  return NextResponse.json({ settings: await getSettings() });
}

const updateSchema = z.object({
  freeAdDays: z.number().int().min(1).max(365),
  topAdPriceJmd: z.number().int().min(0),
  topAdDays: z.number().int().min(1).max(365),
  vipAdPriceJmd: z.number().int().min(0),
  vipAdDays: z.number().int().min(1).max(365),
  refundWindowDays: z.number().int().min(0).max(90),
  signupsEnabled: z.boolean(),
});

export async function PUT(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
  }
  return NextResponse.json({ settings: await updateSettings(parsed.data) });
}
