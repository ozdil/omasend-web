/**
 * Mirrors sanitize_filename() in the desktop engine. The engine sanitizes the names in the
 * transfer request and the `filename` of each upload separately and then matches them, so the
 * browser sends names that are already in their sanitized form: sanitizing them again is a
 * no-op on the engine side and both always match. (An empty result would otherwise become a
 * time-stamped name that differs between the request and the upload.)
 */
export function sanitizeFilename(raw: string, fallbackIndex = 0): string {
  // Rust char::is_alphanumeric = Alphabetic || Numeric (Nd, Nl, No).
  const cleaned = Array.from(raw)
    .filter((c) => /[\p{Alphabetic}\p{N}]/u.test(c) || c === '.' || c === '-' || c === '_' || c === ' ')
    .join('');
  const trimmed = cleaned.trim();
  if (trimmed === '' || trimmed.startsWith('.') || trimmed.includes('..')) {
    // Keep a plain extension (e.g. "🙂.png" -> "file_1.png"); the result is stable under the
    // engine's sanitizer.
    const ext = /\.[\p{Alphabetic}\p{N}]{1,10}$/u.exec(raw)?.[0] ?? '';
    return `file_${fallbackIndex + 1}${ext}`;
  }
  return Array.from(trimmed).slice(0, 180).join('').trimEnd();
}
