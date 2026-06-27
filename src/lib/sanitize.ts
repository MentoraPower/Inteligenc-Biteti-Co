/**
 * HTML Sanitization Utility
 * Removes potentially dangerous scripts and event handlers from HTML
 * to prevent XSS (Cross-Site Scripting) attacks
 */

// List of dangerous HTML tags that should be removed
const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'meta',
  'link',
  'base',
];

// Regex to match on* event handlers (onclick, onerror, onload, etc.)
const EVENT_HANDLER_REGEX = /\s+on\w+\s*=\s*["'][^"']*["']/gi;

// Regex to match javascript: URLs
const JAVASCRIPT_URL_REGEX = /(href|src|action)\s*=\s*["']javascript:[^"']*["']/gi;

// Regex to match data: URLs (can be used for XSS)
const DATA_URL_REGEX = /(href|src)\s*=\s*["']data:[^"']*["']/gi;

// Regex to match vbscript: URLs
const VBSCRIPT_URL_REGEX = /(href|src|action)\s*=\s*["']vbscript:[^"']*["']/gi;

/**
 * Sanitizes HTML content by removing dangerous elements and attributes
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for use with dangerouslySetInnerHTML
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let sanitized = html;

  // Remove dangerous tags and their content
  DANGEROUS_TAGS.forEach((tag) => {
    // Remove opening and closing tags with content
    const tagRegex = new RegExp(
      `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
      'gi'
    );
    sanitized = sanitized.replace(tagRegex, '');

    // Remove self-closing tags
    const selfClosingRegex = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    sanitized = sanitized.replace(selfClosingRegex, '');
  });

  // Remove event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(EVENT_HANDLER_REGEX, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(JAVASCRIPT_URL_REGEX, '');

  // Remove data: URLs
  sanitized = sanitized.replace(DATA_URL_REGEX, '');

  // Remove vbscript: URLs
  sanitized = sanitized.replace(VBSCRIPT_URL_REGEX, '');

  // Remove any remaining javascript: in href/src without quotes
  sanitized = sanitized.replace(/javascript\s*:/gi, '');

  // Remove expression() CSS (IE-specific XSS vector)
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, '');

  // Remove -moz-binding CSS
  sanitized = sanitized.replace(/-moz-binding\s*:[^;]*/gi, '');

  return sanitized;
}

/**
 * Checks if HTML content appears to be safe
 * @param html - The HTML string to check
 * @returns boolean indicating if the HTML appears safe
 */
export function isHtmlSafe(html: string): boolean {
  if (!html || typeof html !== 'string') {
    return true;
  }

  const lowerHtml = html.toLowerCase();

  // Check for dangerous tags
  for (const tag of DANGEROUS_TAGS) {
    if (lowerHtml.includes(`<${tag}`)) {
      return false;
    }
  }

  // Check for event handlers
  if (EVENT_HANDLER_REGEX.test(html)) {
    return false;
  }

  // Check for javascript: URLs
  if (lowerHtml.includes('javascript:')) {
    return false;
  }

  return true;
}
