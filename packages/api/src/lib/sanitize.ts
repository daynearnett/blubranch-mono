// Stripping control characters is the point of this regex.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const SCRIPT_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const HTML_TAGS = /<\/?[^>]+(>|$)/g;

export function sanitizeText(input: string): string {
  return input
    .replace(CONTROL_CHARS, '')
    .replace(SCRIPT_PATTERN, '')
    .replace(HTML_TAGS, '')
    .trim();
}

export function sanitizeUserContent(input: string, maxLength?: number): string {
  let cleaned = sanitizeText(input);
  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }
  return cleaned;
}
