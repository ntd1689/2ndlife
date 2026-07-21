import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";

// Remove a browser's push subscription (user turned notifications off).
const schema = z.object({ endpoint: z.string().url() });

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  await withRetry(() =>
    prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId } })
  );

  return NextResponse.json({ ok: true });
}
