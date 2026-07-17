// Browser-only helper: downscale a photo before upload so multi-MB camera
// originals don't get stored and served at full size. Anything already small
// (or that the browser can't decode, e.g. HEIC on some platforms) is uploaded
// unchanged.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export async function downscaleImage(file: File): Promise<File> {
  // GIFs would lose animation; non-images (and video) pass straight through.
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    // Only swap in the resized version when it actually saves space.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // undecodable format — upload the original rather than fail
  }
}
