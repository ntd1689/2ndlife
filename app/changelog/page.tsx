import {
  CHANGELOG,
  CURRENT_VERSION,
  changeAudience,
  changeText,
  visibleChanges,
} from "@/lib/changelog";
import { getSessionAdmin } from "@/lib/admin";
import { getSessionReviewer } from "@/lib/review";

export const metadata = {
  title: "What's New — 2ndLife",
  description: "Release notes and version history for the 2ndLife marketplace.",
};

// Rendered per-request so the production build identity (commit SHA, set by
// Vercel) reflects exactly what's deployed, and so changes can be filtered to
// the signed-in viewer's role.
export const dynamic = "force-dynamic";

export default async function ChangelogPage() {
  // Vercel sets these in production/preview builds; undefined in local dev.
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const env = process.env.VERCEL_ENV; // "production" | "preview" | undefined

  // A viewer sees public changes; ads reviewers additionally see reviewer
  // notes; admins see everything.
  const admin = await getSessionAdmin();
  const reviewer = admin ? null : await getSessionReviewer();
  const viewerLevel = admin ? 2 : reviewer ? 1 : 0;

  const releases = CHANGELOG.map((r) => ({ release: r, changes: visibleChanges(r, viewerLevel) })).filter(
    (r) => r.changes.length > 0,
  );

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <h1>What&apos;s New</h1>
      <div className="changelog-head">
        <span className="version-badge">v{CURRENT_VERSION}</span>
        <span className="note">
          {env === "production" ? "Live in production" : env === "preview" ? "Preview build" : "Local build"}
          {sha ? ` · build ${sha}` : ""}
        </span>
      </div>
      <p className="note-light" style={{ marginTop: 6 }}>
        The latest version above is what&apos;s currently running on the site.
        {viewerLevel > 0 ? " Items tagged Reviewer or Admin are internal and only shown to you." : ""}
      </p>

      <div className="changelog-list">
        {releases.map(({ release: r, changes }) => (
          <section key={r.version} className="panel changelog-entry" style={{ maxWidth: "none" }}>
            <div className="changelog-entry-head">
              <span className="version-badge sm">v{r.version}</span>
              <h3 style={{ margin: 0 }}>{r.title}</h3>
              <time className="note" dateTime={r.date}>
                {new Date(r.date + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </time>
            </div>
            <ul className="changelog-changes">
              {changes.map((c, i) => {
                const audience = changeAudience(c);
                return (
                  <li key={i}>
                    {audience !== "public" && (
                      <span className={`change-tag ${audience}`}>{audience === "admin" ? "Admin" : "Reviewer"}</span>
                    )}
                    {changeText(c)}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
