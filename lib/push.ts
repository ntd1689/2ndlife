import webpush from "web-push";
import { prisma } from "./prisma";
import { getAdminEmails } from "./env";

// Web Push sender. Notifications are best-effort and never throw to the caller —
// a failed push must not fail the action that triggered it (mirrors email).
// Configured lazily from the VAPID env vars; a no-op when they're unset (dev
// without keys), so nothing breaks before push is provisioned.

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:support@2ndlifejm.net",
    publicKey,
    privateKey
  );
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string; // where clicking the notification lands
  tag?: string; // collapse key so repeats replace rather than stack
};

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;

  try {
    const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: ids } } });
    if (subs.length === 0) return;
    const data = JSON.stringify(payload);

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            data
          );
        } catch (err) {
          // 404/410 mean the subscription is dead (unsubscribed/expired) — prune it.
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          }
        }
      })
    );
  } catch (err) {
    console.error("Push send failed:", err instanceof Error ? err.message : err);
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  return sendPushToUsers([userId], payload);
}

// Reviewers (ads_reviewer) plus administrators (by ADMIN_EMAILS) — the audience
// for "new ad to review". Admins-only is a subset used for refund alerts.
export async function getReviewerUserIds(): Promise<string[]> {
  const adminEmails = [...getAdminEmails()];
  const staff = await prisma.user.findMany({
    where: { OR: [{ userType: "ads_reviewer" }, { email: { in: adminEmails } }] },
    select: { id: true },
  });
  return staff.map((u) => u.id);
}

export async function getAdminUserIds(): Promise<string[]> {
  const adminEmails = [...getAdminEmails()];
  if (adminEmails.length === 0) return [];
  const admins = await prisma.user.findMany({
    where: { email: { in: adminEmails } },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}
