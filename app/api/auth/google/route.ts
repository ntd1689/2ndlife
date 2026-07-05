import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getGoogleOAuth } from "@/lib/env";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// Starts the Google OAuth 2.0 flow: remembers where to send the user after
// login (?next=), sets a CSRF state cookie, and redirects to Google consent.
export async function GET(req: NextRequest) {
  const google = getGoogleOAuth();
  if (!google) {
    return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 501 });
  }

  const next = req.nextUrl.searchParams.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const state = randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: `${req.nextUrl.origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  const res = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  // lax (not strict) so the cookie is sent on Google's redirect back to us.
  res.cookies.set("google_oauth_state", `${state}:${safeNext}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
