import Link from "next/link";

export default function CategoryBreadcrumb({
  category,
  subcategory,
}: {
  category: string;
  subcategory: string;
}) {
  return (
    <nav className="breadcrumb" aria-label="Category">
      <Link href="/">All categories</Link>
      <span className="sep">/</span>
      <Link href={`/?category=${encodeURIComponent(category)}`}>{category}</Link>
      <span className="sep">/</span>
      <Link href={`/?category=${encodeURIComponent(category)}&subcategory=${encodeURIComponent(subcategory)}`} className="current">
        {subcategory}
      </Link>
    </nav>
  );
}
