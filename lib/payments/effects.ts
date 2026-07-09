import { Prisma, PrismaClient, Payment } from "@prisma/client";
import { getSettings } from "@/lib/settings";
import { applyPremiumPurchase } from "@/lib/premium";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function applyPaymentEffects(prisma: DbClient, payment: Payment): Promise<void> {
  if (!payment.listingId) return;

  if (payment.type === "top_ad" || payment.type === "vip_ad") {
    const tier = payment.type === "vip_ad" ? "vip" : "top";
    const listing = await prisma.listing.findUnique({
      where: { id: payment.listingId },
      select: { id: true, categoryId: true, sortOrder: true, premiumTier: true, premiumUntil: true },
    });
    if (!listing) return;
    const settings = await getSettings();
    const fallback = tier === "vip" ? settings.vipAdDays : settings.topAdDays;
    await applyPremiumPurchase(prisma, listing, tier, payment.premiumDays ?? fallback);
    return;
  }

  if (payment.type === "unlimited_listing") {
    await prisma.listing.update({
      where: { id: payment.listingId },
      data: { plan: "unlimited", expiresAt: null, status: "active" },
    });
    return;
  }

  if (payment.type === "featured") {
    await prisma.listing.update({
      where: { id: payment.listingId },
      data: { featured: true },
    });
    return;
  }

  if (payment.type === "relist") {
    const { freeAdDays } = await getSettings();
    await prisma.listing.update({
      where: { id: payment.listingId },
      data: {
        status: "active",
        plan: "free",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + freeAdDays * 86400000),
        archivedAt: null,
      },
    });
  }
}
