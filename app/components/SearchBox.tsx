export default function SearchBox({
  q,
  category,
  subcategory,
}: {
  q?: string;
  category?: string;
  subcategory?: string;
}) {
  return (
    <form className="searchrow" action="/">
      <input name="q" placeholder="Search listings…" defaultValue={q} />
      {category && <input type="hidden" name="category" value={category} />}
      {subcategory && <input type="hidden" name="subcategory" value={subcategory} />}
      <button type="submit">Search</button>
    </form>
  );
}
