import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendFeedbackEmail } from "@/lib/email";

// Feedback form submissions from the About page. Only logged-in users can send,
// and the message is emailed to the site's contact address (with reply-to set
// to the sender) — so the address is never exposed on the page.
const schema = z.object({
  topic: z.enum(["Feedback", "Question", "Bug report", "Partnership", "Other"]),
  message: z.string().trim().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Please log in to send us a message." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please choose a topic and enter a message (up to 4000 characters)." }, { status: 400 });
  }

  // Cap submissions so the inbox can't be flooded from one account.
  const limit = checkRateLimit(`feedback:${userId}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "You've sent a few messages recently. Please try again a bit later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const user = await withRetry(() => prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }));
  if (!user) return NextResponse.json({ error: "Please log in to send us a message." }, { status: 401 });

  try {
    await sendFeedbackEmail({
      fromEmail: user.email,
      fromName: user.name,
      topic: parsed.data.topic,
      message: parsed.data.message,
    });
  } catch (err) {
    console.error("Feedback email failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Sorry, we couldn't send your message right now. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
