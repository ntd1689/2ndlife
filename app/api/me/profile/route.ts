import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma, withRetry } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

// Update the signed-in user's profile fields. Both are optional so the same
// endpoint can save a name during signup and a phone number later.
const schema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    phone: z.string().trim().min(7).max(30).optional(),
  })
  .refine((d) => d.name !== undefined || d.phone !== undefined, {
    message: "Nothing to update",
  });

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid profile" }, { status: 400 });
  }

  const data: { name?: string; phone?: string } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone;

  try {
    const user = await withRetry(() =>
      prisma.user.update({
        where: { id: userId },
        data,
        select: { id: true, email: true, name: true, phone: true },
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
