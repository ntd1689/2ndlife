import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makePrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Managed Postgres providers (Supabase's pooler, previously Neon) can drop idle
// connections between requests. This helper retries once after reconnecting so
// a single stale connection doesn't fail the request.
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTerminated =
      msg.includes("terminating connection") ||
      msg.includes("E57P01") ||
      msg.includes("Connection closed") ||
      msg.includes("Can't reach database server");
    if (!isTerminated) throw err;
    // Reconnect and retry once
    await prisma.$disconnect();
    await prisma.$connect();
    return await fn();
  }
}
