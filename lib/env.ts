const isProd = process.env.NODE_ENV === "production";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !secret.trim()) {
    if (isProd) {
      throw new Error("SESSION_SECRET must be set in production");
    }
    return "dev-secret-change-me";
  }
  if (isProd && secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production");
  }
  return secret;
}

export function getCronSecret(): string {
  const value = process.env.CRON_SECRET;
  if (!value || !value.trim()) {
    throw new Error("CRON_SECRET must be set");
  }
  return value;
}

export function getPaypalWebhookId(): string {
  return requireEnv("PAYPAL_WEBHOOK_ID");
}

export const env = {
  isProd,
};
