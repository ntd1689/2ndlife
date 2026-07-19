import { Prisma, PrismaClient } from "@prisma/client";
import { prisma, withRetry } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type MarketplaceSettings = {
  freeAdDays: number;
  topAdPriceJmd: number;
  topAdDays: number;
  vipAdPriceJmd: number;
  vipAdDays: number;
  refundWindowDays: number;
};

// Reads the singleton settings row, creating it with defaults on first use.
// IMPORTANT: callers running inside prisma.$transaction must pass their tx
// client — production uses connection_limit=1, so a query on the global
// client while a transaction holds the only connection deadlocks until the
// transaction times out.
export async function getSettings(db?: DbClient): Promise<MarketplaceSettings> {
  const client = db ?? prisma;
  const query = () => client.adminSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  // withRetry reconnects the global client; that isn't valid mid-transaction.
  const row = db ? await query() : await withRetry(query);
  return {
    freeAdDays: row.freeAdDays,
    topAdPriceJmd: row.topAdPriceJmd,
    topAdDays: row.topAdDays,
    vipAdPriceJmd: row.vipAdPriceJmd,
    vipAdDays: row.vipAdDays,
    refundWindowDays: row.refundWindowDays,
  };
}

export async function updateSettings(data: Partial<MarketplaceSettings>): Promise<MarketplaceSettings> {
  const row = await withRetry(() =>
    prisma.adminSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } })
  );
  return {
    freeAdDays: row.freeAdDays,
    topAdPriceJmd: row.topAdPriceJmd,
    topAdDays: row.topAdDays,
    vipAdPriceJmd: row.vipAdPriceJmd,
    vipAdDays: row.vipAdDays,
    refundWindowDays: row.refundWindowDays,
  };
}
