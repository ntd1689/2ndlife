import { prisma, withRetry } from "@/lib/prisma";

export type MarketplaceSettings = {
  freeAdDays: number;
  topAdPriceJmd: number;
  topAdDays: number;
  vipAdPriceJmd: number;
  vipAdDays: number;
};

// Reads the singleton settings row, creating it with defaults on first use.
export async function getSettings(): Promise<MarketplaceSettings> {
  const row = await withRetry(() =>
    prisma.adminSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
  );
  return {
    freeAdDays: row.freeAdDays,
    topAdPriceJmd: row.topAdPriceJmd,
    topAdDays: row.topAdDays,
    vipAdPriceJmd: row.vipAdPriceJmd,
    vipAdDays: row.vipAdDays,
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
  };
}
