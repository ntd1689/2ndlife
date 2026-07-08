"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Heart toggle for saving a listing. Optimistically flips state, then calls the
// favorite API. A logged-out user is sent to /login. Used both as a small
// overlay on cards and inline on the ad detail page.
export default function FavoriteButton({
  listingId,
  initialFavorited,
  variant = "overlay",
  onChange,
}: {
  listingId: string;
  initialFavorited: boolean;
  variant?: "overlay" | "inline";
  onChange?: (favorited: boolean) => void;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    // Cards wrap the whole tile in a link — don't navigate when the heart is clicked.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const next = !favorited;
    setFavorited(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/favorite`, {
        method: next ? "POST" : "DELETE",
      });
      if (res.status === 401) {
        setFavorited(!next);
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setFavorited(!next); // revert on failure
        return;
      }
      onChange?.(next);
    } catch {
      setFavorited(!next); // revert on network error
    } finally {
      setBusy(false);
    }
  }

  const label = favorited ? "Remove from favorites" : "Save to favorites";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={favorited}
      aria-label={label}
      title={label}
      className={`fav-btn fav-${variant} ${favorited ? "is-fav" : ""}`}
    >
      <span aria-hidden="true">{favorited ? "♥" : "♡"}</span>
      {variant === "inline" && <span className="fav-text">{favorited ? "Saved" : "Save"}</span>}
    </button>
  );
}
