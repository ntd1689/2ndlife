"use client";

// Reusable pager for admin tables: record range + total, prev/next,
// jump-to-page, and a page-size selector. Keyboard- and screen-reader-friendly.
export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  label = "records",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  label?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <nav className="pager" aria-label={`${label} pagination`}>
      <span className="pager-status" aria-live="polite">
        Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} {label}
      </span>

      <div className="pager-controls">
        <label className="pager-size">
          <span className="note">Per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Records per page"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="secondary pager-btn"
          onClick={() => onPageChange(current - 1)}
          disabled={current <= 1}
          aria-label="Previous page"
        >
          ‹ Prev
        </button>

        <label className="pager-jump">
          <span className="note">Page</span>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={current}
            onChange={(e) => {
              const p = Number(e.target.value);
              if (p >= 1 && p <= pageCount) onPageChange(p);
            }}
            aria-label={`Page number, ${pageCount} total pages`}
          />
          <span className="note">of {pageCount.toLocaleString()}</span>
        </label>

        <button
          type="button"
          className="secondary pager-btn"
          onClick={() => onPageChange(current + 1)}
          disabled={current >= pageCount}
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>
    </nav>
  );
}
