"use client";

// Money field that formats with thousands separators as you type
// (50000 -> 50,000). Keeps the OUTSIDE value as a plain digit string so
// existing Number(value) validation and API payloads work unchanged.
// J$ amounts are whole dollars site-wide, so no decimal entry.
export default function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (rawDigits: string) => void;
  placeholder?: string;
}) {
  const display = value && /^\d+$/.test(value) ? Number(value).toLocaleString("en-US") : value;

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={display}
      placeholder={placeholder}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, "");
        // Cap absurd lengths so toLocaleString stays safe.
        onChange(digits.slice(0, 12));
      }}
    />
  );
}
