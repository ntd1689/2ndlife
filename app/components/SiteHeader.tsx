import Link from "next/link";
import { getSessionUserId } from "@/lib/auth";
import { prisma, withRetry } from "@/lib/prisma";

export default async function SiteHeader() {
  const userId = await getSessionUserId();
  const user = userId
    ? await withRetry(() =>
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        })
      )
    : null;

  return (
    <header className="site-header">
      <div className="hbar">
        <Link href="/">
          <img src="/logo.png" alt="2ndLife — Buy. Sell. Bid. Repeat." />
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/post">
            <button className="secondary">Post an ad — free for 7 days</button>
          </Link>
          {user ? (
            <>
              <Link href="/my-ads">
                <button>Manage ads</button>
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="secondary">Log out</button>
              </form>
            </>
          ) : (
            <Link href="/login">
              <button>Log in</button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
