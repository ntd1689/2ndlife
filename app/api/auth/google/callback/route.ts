import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { getGoogleOAuth } from "@/lib/env";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function loginRedirect(origin: string, message: string) {
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
}

// Completes the Google OAuth flow. First-time Google users get a profile
// created from their Google name, email, and picture; returning users are
// matched by Google id (or linked by email) and logged in.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const google = getGoogleOAuth();
  if (!google) return loginRedirect(origin, "Google sign-in is not configured");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const stateCookie = req.cookies.get("google_oauth_state")?.value || "";
  const [expectedState, ...nextParts] = stateCookie.split(":");
  const next = nextParts.join(":") || "/";

  if (!code || !state || !expectedState || state !== expectedState) {
    return loginRedirect(origin, "Google sign-in was interrupted — please try again");
  }

  let profile: { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) {
      return loginRedirect(origin, "Google sign-in failed — please try again");
    }

    const userRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    profile = await userRes.json();
    if (!userRes.ok) return loginRedirect(origin, "Could not read your Google profile");
  } catch {
    return loginRedirect(origin, "Network issue during Google sign-in — please try again");
  }

  if (!profile.sub || !profile.email || profile.email_verified === false) {
    return loginRedirect(origin, "Your Google account has no verified email address");
  }
  const email = profile.email.toLowerCase();

  const user = await withRetry(async () => {
    const byGoogleId = await prisma.user.findUnique({ where: { googleId: profile.sub } });
    if (byGoogleId) {
      // Refresh profile details on each login.
      return prisma.user.update({
        where: { id: byGoogleId.id },
        data: { name: profile.name ?? byGoogleId.name, image: profile.picture ?? byGoogleId.image },
      });
    }
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      // Existing OTP account — link it to this Google account.
      return prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId: profile.sub,
          emailVerified: true,
          name: byEmail.name ?? profile.name,
          image: byEmail.image ?? profile.picture,
        },
      });
    }
    return prisma.user.create({
      data: {
        email,
        emailVerified: true,
        googleId: profile.sub,
        name: profile.name,
        image: profile.picture,
      },
    });
  });

  await createSession(user.id);
  const res = NextResponse.redirect(`${origin}${next}`);
  res.cookies.delete("google_oauth_state");
  return res;
}
