import { prisma } from "./prisma";
import { getSessionUserId } from "./auth";
import { getAdminEmails } from "./env";

export async function getSessionAdmin(): Promise<{ id: string; email: string } | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const admins = getAdminEmails();
  if (admins.size === 0) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user || !admins.has(user.email.toLowerCase())) return null;
  return user;
}
