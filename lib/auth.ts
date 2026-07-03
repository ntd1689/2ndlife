import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSessionSecret } from "@/lib/env";

const SESSION_COOKIE = "2ndlife_session";
const JWT_ISSUER = "2ndlife";
const JWT_AUDIENCE = "2ndlife-web";
const secret = () => new TextEncoder().encode(getSessionSecret());

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return (payload.userId as string) ?? null;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
