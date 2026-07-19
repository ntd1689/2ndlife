import { Prisma, PrismaClient, Payment } from "@prisma/client";
import { getSettings } from "@/lib/settings";
import { applyPremiumPurchase, DEFAULT_SORT_ORDER } from "@/lib/premium";

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
    const settings = await getSettings(prisma);
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
    const { freeAdDays } = await getSettings(prisma);
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

// Undo what a payment bought, applied when a refund is approved. Deliberately
// gentle where reversal would surprise (an unlimited/relist ad drops back to
// the free plan with a fresh free window rather than expiring on the spot).
export async function revertPaymentEffects(prisma: DbClient, payment: Payment): Promise<void> {
  if (!payment.listingId) return;

  if (payment.type === "top_ad" || payment.type === "vip_ad") {
    await prisma.listing.update({
      where: { id: payment.listingId },
      data: { premiumTier: "none", premiumUntil: null, sortOrder: DEFAULT_SORT_ORDER },
    });
    return;
  }

  if (payment.type === "featured") {
    await prisma.listing.update({
      where: { id: payment.listingId },
      data: { featured: false },
    });
    return;
  }

  if (payment.type === "unlimited_listing" || payment.type === "relist") {
    const { freeAdDays } = await getSettings(prisma);
    await prisma.listing.update({
      where: { id: payment.listingId },
      data: { plan: "free", expiresAt: new Date(Date.now() + freeAdDays * 86400000) },
    });
  }
}
