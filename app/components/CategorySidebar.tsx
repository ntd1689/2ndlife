import Link from "next/link";
import { CATEGORIES } from "@/lib/data/categories";

export default function CategorySidebar({
  activeCategory,
  activeSubcategory,
}: {
  activeCategory?: string;
  activeSubcategory?: string;
}) {
  return (
    <nav className="cat-nav" aria-label="Browse by category">
      <Link href="/" className={`cat-nav-all ${!activeCategory ? "active" : ""}`}>
        All categories
      </Link>
      {Object.entries(CATEGORIES).map(([category, subs]) => {
        const isActiveCat = activeCategory === category;
        return (
          <div key={category} className="cat-group">
            <Link
              href={`/?category=${encodeURIComponent(category)}`}
              className={`cat-link ${isActiveCat && !activeSubcategory ? "active" : ""}`}
            >
              {category}
            </Link>
            {isActiveCat && (
              <ul className="subcat-list">
                {subs.map((sub) => (
                  <li key={sub}>
                    <Link
                      href={`/?category=${encodeURIComponent(category)}&subcategory=${encodeURIComponent(sub)}`}
                      className={activeSubcategory === sub ? "active" : ""}
                    >
                      {sub}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
