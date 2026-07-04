"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PARISHES } from "@/lib/data/parishes";

export type NavCategory = {
  name: string;
  count: number;
  subcategories: { name: string; count: number }[];
  spotlight: { id: string; title: string; askingPrice: number | null; image: string | null }[];
};

export type NavNotification = {
  id: string;
  amount: number;
  listingTitle: string;
  createdAt: string;
};

export type NavUser = { email: string; isAdmin: boolean };

const CATEGORY_ICONS: Record<string, string> = {
  "Electronics & Appliances": "📱",
  "Vehicles & Parts": "🚗",
  "Property & Rentals": "🏠",
  "Furniture & Home": "🛋️",
  "Fashion & Beauty": "👗",
  "Agriculture & Farming": "🌾",
  "Baby & Kids": "🧸",
  "Sports, Music & Hobbies": "🎸",
  "Tools & Building Materials": "🔨",
  Other: "📦",
};

const CATEGORY_BLURBS: Record<string, string> = {
  "Electronics & Appliances": "Phones, laptops, TVs, appliances and more from sellers across Jamaica.",
  "Vehicles & Parts": "Cars, bikes, boats, and the parts to keep them running.",
  "Property & Rentals": "Houses, apartments, land and commercial space to rent or buy.",
  "Furniture & Home": "Furnish every room — living, bedroom, kitchen and outdoors.",
  "Fashion & Beauty": "Clothing, shoes, jewelry and beauty finds at second-hand prices.",
  "Agriculture & Farming": "Livestock, crops, farm equipment and pet supplies.",
  "Baby & Kids": "Gear, toys, clothing and school supplies for growing families.",
  "Sports, Music & Hobbies": "Instruments, sound systems, sporting goods and collectibles.",
  "Tools & Building Materials": "Tools, lumber, zinc, plumbing and everything to build with.",
  Other: "Everything that doesn't fit anywhere else.",
};

const RECENT_KEY = "2ndlife:recent-searches";

function fmtCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(n);
}

function catHref(category: string, subcategory?: string): string {
  const params = new URLSearchParams({ category });
  if (subcategory) params.set("subcategory", subcategory);
  return `/?${params.toString()}`;
}

export default function MarketplaceNav({
  user,
  categories,
  notifications,
}: {
  user: NavUser | null;
  categories: NavCategory[];
  notifications: NavNotification[];
}) {
  const [scrolled, setScrolled] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCategory, setDrawerCategory] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [searchParish, setSearchParish] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      setRecents(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"));
    } catch {
      setRecents([]);
    }
  }, []);

  // Close any open surface when clicking outside the header or pressing Escape
  useEffect(() => {
    function closeAll() {
      setOpenCategory(null);
      setBellOpen(false);
      setAccountOpen(false);
      setSearchFocused(false);
    }
    function onPointerDown(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) closeAll();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeAll();
        setDrawerOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function scheduleMegaClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenCategory(null), 160);
  }

  function openMega(name: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenCategory(name);
    setBellOpen(false);
    setAccountOpen(false);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      suggestAbort.current?.abort();
      suggestAbort.current = new AbortController();
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(value.trim())}`, {
          signal: suggestAbort.current.signal,
        });
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        /* aborted or offline — keep whatever we had */
      }
    }, 200);
  }

  function rememberSearch(q: string) {
    if (!q.trim()) return;
    const next = [q.trim(), ...recents.filter((r) => r.toLowerCase() !== q.trim().toLowerCase())].slice(0, 5);
    setRecents(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* private mode etc. */
    }
  }

  const activeCategory = categories.find((c) => c.name === openCategory) ?? null;
  const showSearchPanel = searchFocused && (suggestions.length > 0 || (query.trim().length < 2 && recents.length > 0));

  return (
    <header ref={headerRef} className={`mk-header ${scrolled ? "scrolled" : ""}`}>
      {/* Row 1: logo · search · actions */}
      <div className="mk-bar">
        <button
          className="mk-burger"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          ☰
        </button>

        <Link href="/" className="mk-logo" aria-label="2ndLife home">
          <img src="/logo.png" alt="2ndLife — Buy. Sell. Bid. Repeat." />
        </Link>

        <form
          className="mk-search"
          action="/"
          role="search"
          onSubmit={() => rememberSearch(query)}
        >
          <span className="mk-search-icon" aria-hidden="true">🔍</span>
          <input
            ref={searchInputRef}
            name="q"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => {
              setSearchFocused(true);
              setBellOpen(false);
              setAccountOpen(false);
              setOpenCategory(null);
            }}
            placeholder="What are you looking for?"
            aria-label="Search listings"
            autoComplete="off"
          />
          <select
            name="category"
            value={searchCategory}
            onChange={(e) => setSearchCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
          <select
            name="parish"
            value={searchParish}
            onChange={(e) => setSearchParish(e.target.value)}
            aria-label="Filter by parish"
          >
            <option value="">All Jamaica</option>
            {PARISHES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button type="submit" className="mk-search-go" aria-label="Search">
            Search
          </button>

          {showSearchPanel && (
            <div className="mk-search-panel" role="listbox" aria-label="Search suggestions">
              {suggestions.length > 0 ? (
                <>
                  <p className="mk-panel-label">Suggestions</p>
                  {suggestions.map((s) => (
                    <Link key={s} href={`/?q=${encodeURIComponent(s)}`} className="mk-suggestion" role="option" aria-selected="false"
                      onClick={() => rememberSearch(s)}>
                      🔍 {s}
                    </Link>
                  ))}
                </>
              ) : (
                <>
                  <p className="mk-panel-label">Recent searches</p>
                  {recents.map((r) => (
                    <Link key={r} href={`/?q=${encodeURIComponent(r)}`} className="mk-suggestion" role="option" aria-selected="false"
                      onClick={() => rememberSearch(r)}>
                      🕘 {r}
                    </Link>
                  ))}
                </>
              )}
            </div>
          )}
        </form>

        <div className="mk-actions">
          {user && (
            <div className="mk-menu-anchor">
              <button
                className="mk-icon-btn"
                aria-label={`Notifications${notifications.length ? ` — ${notifications.length} new` : ""}`}
                aria-haspopup="menu"
                aria-expanded={bellOpen}
                onClick={() => {
                  setBellOpen(!bellOpen);
                  setAccountOpen(false);
                  setOpenCategory(null);
                }}
              >
                🔔
                {notifications.length > 0 && <span className="mk-badge">{notifications.length}</span>}
              </button>
              {bellOpen && (
                <div className="mk-dropdown mk-notifications" role="menu" aria-label="Notifications">
                  <p className="mk-panel-label">Offers on your ads</p>
                  {notifications.length === 0 && (
                    <p className="mk-empty">No new offers right now.</p>
                  )}
                  {notifications.map((n) => (
                    <Link key={n.id} href="/my-ads" className="mk-notification" role="menuitem">
                      <span className="mk-notif-amount">J${n.amount.toLocaleString()}</span>
                      <span className="mk-notif-body">
                        offer on <b>{n.listingTitle}</b>
                        <span className="mk-notif-date">{new Date(n.createdAt).toLocaleDateString()}</span>
                      </span>
                    </Link>
                  ))}
                  {notifications.length > 0 && (
                    <Link href="/my-ads" className="mk-dropdown-footer" role="menuitem">
                      Review offers in My Ads →
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mk-menu-anchor">
            {user ? (
              <button
                className="mk-avatar"
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => {
                  setAccountOpen(!accountOpen);
                  setBellOpen(false);
                  setOpenCategory(null);
                }}
              >
                {user.email[0].toUpperCase()}
              </button>
            ) : (
              <Link href="/login" className="mk-login">Log in</Link>
            )}
            {user && accountOpen && (
              <div className="mk-dropdown mk-account" role="menu" aria-label="Account">
                <p className="mk-account-email">{user.email}</p>
                <Link href="/my-ads" role="menuitem">📦 My listings</Link>
                <Link href="/post" role="menuitem">➕ Post an ad</Link>
                {user.isAdmin && <Link href="/admin" role="menuitem">🛡️ Admin</Link>}
                <form action="/api/auth/logout" method="post">
                  <button type="submit" role="menuitem">🚪 Log out</button>
                </form>
              </div>
            )}
          </div>

          <Link href="/post" className="mk-cta">+ Post Listing</Link>
        </div>
      </div>

      {/* Row 2: category bar + mega menu */}
      <nav className="mk-cats" aria-label="Browse categories" onMouseLeave={scheduleMegaClose}>
        <div className="mk-cats-row">
          {categories.map((c) => (
            <Link
              key={c.name}
              href={catHref(c.name)}
              className={`mk-cat ${openCategory === c.name ? "open" : ""}`}
              onMouseEnter={() => openMega(c.name)}
              onFocus={() => openMega(c.name)}
              aria-expanded={openCategory === c.name}
            >
              <span className="mk-cat-icon" aria-hidden="true">{CATEGORY_ICONS[c.name] ?? "🏷️"}</span>
              <span className="mk-cat-text">
                <span className="mk-cat-name">{c.name}</span>
                <span className="mk-cat-count">{fmtCount(c.count)} listing{c.count === 1 ? "" : "s"}</span>
              </span>
            </Link>
          ))}
        </div>

        {activeCategory && (
          <div className="mk-mega" onMouseEnter={() => openMega(activeCategory.name)} role="region" aria-label={`${activeCategory.name} menu`}>
            <div className="mk-mega-inner">
              <div className="mk-mega-left">
                <span className="mk-mega-icon" aria-hidden="true">{CATEGORY_ICONS[activeCategory.name]}</span>
                <h3>{activeCategory.name}</h3>
                <p>{CATEGORY_BLURBS[activeCategory.name]}</p>
                <p className="mk-mega-count">{fmtCount(activeCategory.count)} active listing{activeCategory.count === 1 ? "" : "s"}</p>
                <Link href={catHref(activeCategory.name)} className="mk-mega-browse">Browse all →</Link>
              </div>
              <div className="mk-mega-subs">
                <p className="mk-panel-label">Subcategories</p>
                <ul>
                  {activeCategory.subcategories.map((s) => (
                    <li key={s.name}>
                      <Link href={catHref(activeCategory.name, s.name)}>
                        {s.name}
                        <span className="mk-sub-count">{fmtCount(s.count)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mk-mega-spotlight">
                <p className="mk-panel-label">Fresh in {activeCategory.name.split(" ")[0]}</p>
                {activeCategory.spotlight.length === 0 && (
                  <p className="mk-empty">No active listings yet — post the first one.</p>
                )}
                {activeCategory.spotlight.map((l) => (
                  <Link key={l.id} href={`/listing/${l.id}`} className="mk-spot-card">
                    {l.image ? <img src={l.image} alt="" /> : <span className="mk-spot-placeholder" aria-hidden="true">{CATEGORY_ICONS[activeCategory.name]}</span>}
                    <span className="mk-spot-text">
                      <span className="mk-spot-title">{l.title}</span>
                      <span className="mk-spot-price">{l.askingPrice != null ? `Asking J$${l.askingPrice.toLocaleString()}` : "Open to offers"}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="mk-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="mk-drawer" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="mk-drawer-head">
              <img src="/logo.png" alt="2ndLife" />
              <button aria-label="Close menu" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>
            <p className="mk-panel-label">Categories</p>
            {categories.map((c) => (
              <div key={c.name} className="mk-drawer-cat">
                <button
                  aria-expanded={drawerCategory === c.name}
                  onClick={() => setDrawerCategory(drawerCategory === c.name ? null : c.name)}
                >
                  <span>{CATEGORY_ICONS[c.name]} {c.name}</span>
                  <span className="mk-cat-count">{fmtCount(c.count)}</span>
                </button>
                {drawerCategory === c.name && (
                  <ul>
                    <li>
                      <Link href={catHref(c.name)} onClick={() => setDrawerOpen(false)}>All {c.name}</Link>
                    </li>
                    {c.subcategories.map((s) => (
                      <li key={s.name}>
                        <Link href={catHref(c.name, s.name)} onClick={() => setDrawerOpen(false)}>
                          {s.name} <span className="mk-sub-count">{fmtCount(s.count)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <p className="mk-panel-label">Account</p>
            {user ? (
              <div className="mk-drawer-links">
                <Link href="/my-ads" onClick={() => setDrawerOpen(false)}>📦 My listings</Link>
                {user.isAdmin && <Link href="/admin" onClick={() => setDrawerOpen(false)}>🛡️ Admin</Link>}
                <form action="/api/auth/logout" method="post">
                  <button type="submit">🚪 Log out</button>
                </form>
              </div>
            ) : (
              <div className="mk-drawer-links">
                <Link href="/login" onClick={() => setDrawerOpen(false)}>Log in</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav className="mk-bottom" aria-label="Primary">
        <Link href="/" aria-label="Home"><span aria-hidden="true">🏠</span>Home</Link>
        <button
          aria-label="Search"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            searchInputRef.current?.focus();
          }}
        >
          <span aria-hidden="true">🔍</span>Search
        </button>
        <Link href="/post" className="mk-bottom-sell" aria-label="Post a listing"><span aria-hidden="true">➕</span>Sell</Link>
        <Link href="/my-ads" aria-label="My ads"><span aria-hidden="true">📦</span>My Ads</Link>
        {user ? (
          <button aria-label="Account" onClick={() => setDrawerOpen(true)}><span aria-hidden="true">👤</span>Account</button>
        ) : (
          <Link href="/login" aria-label="Log in"><span aria-hidden="true">👤</span>Log in</Link>
        )}
      </nav>
    </header>
  );
}
