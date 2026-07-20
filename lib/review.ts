import { prisma } from "./prisma";
import { getSessionUserId } from "./auth";
import { getAdminEmails } from "./env";

export type Reviewer = { id: string; email: string; isAdmin: boolean };

// A reviewer is either an ads_reviewer account or an administrator (admins
// keep full override of the review workflow). Returns null otherwise.
export async function getSessionReviewer(): Promise<Reviewer | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, userType: true },
  });
  if (!user) return null;

  const isAdmin = getAdminEmails().has(user.email.toLowerCase());
  if (user.userType === "ads_reviewer" || isAdmin) {
    return { id: user.id, email: user.email, isAdmin };
  }
  return null;
}
