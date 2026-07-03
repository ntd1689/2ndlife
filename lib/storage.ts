import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

function createS3Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials are not configured (missing R2_ENDPOINT, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY)");
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

let s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3) {
    s3 = createS3Client();
  }
  return s3;
}

const BUCKET = process.env.R2_BUCKET;
const PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

export async function createPresignedUpload(contentType: string, ext: string) {
  if (!BUCKET) throw new Error("R2_BUCKET is not configured");
  if (!PUBLIC_BASE_URL) throw new Error("R2_PUBLIC_BASE_URL is not configured");

  const key = `listings/${randomUUID()}.${ext}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 60 * 5 });
  const publicUrl = `${PUBLIC_BASE_URL}/${key}`;
  return { uploadUrl, publicUrl, key };
}

export async function deleteObject(key: string) {
  if (!BUCKET) throw new Error("R2_BUCKET is not configured");
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await getS3Client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
