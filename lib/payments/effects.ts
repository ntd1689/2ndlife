import { Prisma, PrismaClient, Payment } from "@prisma/client";
import { FREE_LISTING_DAYS } from "@/lib/data/categories";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function applyPaymentEffects(prisma: DbClient, payment: Payment): Promise<void> {
  if (!payment.listingId) return;

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
    await prisma.listing.update({
      where: { id: payment.listingId },
      data: {
        status: "active",
        plan: "free",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + FREE_LISTING_DAYS * 86400000),
        archivedAt: null,
      },
    });
  }
}
