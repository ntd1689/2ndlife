import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  const matches = await withRetry(() =>
    prisma.listing.findMany({
      where: { status: "active", title: { contains: q, mode: "insensitive" } },
      select: { title: true },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 6,
    })
  );

  // Dedupe titles case-insensitively so near-identical listings don't repeat
  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const m of matches) {
    const key = m.title.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      suggestions.push(m.title);
    }
  }

  return NextResponse.json({ suggestions: suggestions.slice(0, 5) });
}
