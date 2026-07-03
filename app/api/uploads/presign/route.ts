import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { MAX_VIDEO_BYTES } from "@/lib/data/categories";

// Allowlists keep client-supplied contentType/ext from reaching the R2
// object key or PutObject call unsanitized.
const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const schema = z.object({
  contentType: z.string(),
  ext: z.string(),
  sizeBytes: z.number().int().positive(),
  type: z.enum(["photo", "video"]),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { contentType, sizeBytes, type } = parsed.data;

    const allowedTypes = type === "photo" ? ALLOWED_PHOTO_TYPES : ALLOWED_VIDEO_TYPES;
    const ext = allowedTypes[contentType];
    if (!ext) {
      return NextResponse.json(
        { error: `Unsupported ${type} file type` },
        { status: 400 }
      );
    }

    if (type === "video" && sizeBytes > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: `Video exceeds the 500MB limit (${(sizeBytes / 1024 / 1024).toFixed(0)}MB)` },
        { status: 400 }
      );
    }

    // Check for R2 credentials
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      console.error("R2 credentials not configured");
      return NextResponse.json(
        { error: "File uploads are not configured yet" },
        { status: 503 }
      );
    }

    const { createPresignedUpload } = await import("@/lib/storage");
    const { uploadUrl, publicUrl, key } = await createPresignedUpload(contentType, ext);
    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to create presigned upload:", message);
    return NextResponse.json(
      { error: "Could not prepare file upload" },
      { status: 500 }
    );
  }
}
