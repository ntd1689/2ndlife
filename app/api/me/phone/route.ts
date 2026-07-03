import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

const schema = z.object({ phone: z.string().min(7) });

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });

  try {
    const user = await withRetry(() =>
      prisma.user.update({
        where: { id: userId },
        data: { phone: parsed.data.phone },
      })
    );
    return NextResponse.json({ user });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Phone number already belongs to another account" }, { status: 409 });
    }
    throw error;
  }
}
