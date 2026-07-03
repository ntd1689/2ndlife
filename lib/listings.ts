import { prisma, withRetry } from "./prisma";
import { deleteObject } from "./storage";

export async function purgeListingMedia(listingId: string, media: { id: string; url: string }[]) {
  for (const item of media) {
    try {
      const key = item.url.split("/").slice(-2).join("/"); // matches "listings/<uuid>.ext"
      await deleteObject(key);
    } catch (e) {
      console.error("Failed to delete media", item.id, e);
    }
  }
  await withRetry(() => prisma.listingMedia.deleteMany({ where: { listingId } }));
}
