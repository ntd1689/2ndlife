import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

// Send the signed-in user a test push to every device they've subscribed, so
// they can confirm notifications work on their phone.
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const devices = await withRetry(() => prisma.pushSubscription.count({ where: { userId } }));
  if (devices === 0) {
    return NextResponse.json({ ok: true, devices: 0 });
  }

  await sendPushToUser(userId, {
    title: "2ndLife test 🔔",
    body: "Push notifications are working on this device.",
    url: "/",
    tag: "push-test",
  });

  return NextResponse.json({ ok: true, devices });
}
