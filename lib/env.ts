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

// Google SSO is optional: when the env vars are missing the buttons hide and
// email OTP remains the only login method.
export function getGoogleOAuth(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId?.trim() || !clientSecret?.trim()) return null;
  return { clientId, clientSecret };
}

export function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Where the About-page feedback form delivers messages. Uses FEEDBACK_EMAIL if
// set, otherwise the first configured admin address. Kept server-side so the
// contact address is never rendered publicly.
export function getContactEmail(): string {
  const explicit = process.env.FEEDBACK_EMAIL?.trim();
  if (explicit) return explicit;
  return [...getAdminEmails()][0] || "sifts.ja@gmail.com";
}

export const env = {
  isProd,
};
