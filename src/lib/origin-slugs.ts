/**
 * Origin Slug System
 * Maps sub-origin UUIDs ↔ URL-friendly slugs (based on sub-origin names)
 * Keeps URLs clean: /crm?origin=prospeccao&view=quadro
 */

// Global maps for slug ↔ ID conversion
const slugToIdMap = new Map<string, string>();
const idToSlugMap = new Map<string, string>();

// UUID regex for backward compatibility
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Convert a name to a URL-friendly slug
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')         // Trim leading/trailing hyphens
    .replace(/-{2,}/g, '-');          // Collapse multiple hyphens
}

/**
 * Register sub-origins for slug mapping.
 * Call this whenever sub-origins are loaded/updated.
 */
export function registerSubOrigins(subOrigins: { id: string; nome: string }[]) {
  slugToIdMap.clear();
  idToSlugMap.clear();
  
  // Track slug collisions
  const slugCounts = new Map<string, number>();
  
  for (const so of subOrigins) {
    let slug = slugify(so.nome);
    
    // Handle collisions by appending a number
    const count = slugCounts.get(slug) || 0;
    slugCounts.set(slug, count + 1);
    if (count > 0) {
      slug = `${slug}-${count + 1}`;
    }
    
    slugToIdMap.set(slug, so.id);
    idToSlugMap.set(so.id, slug);
  }
}

/**
 * Resolve a URL param to a sub-origin ID.
 * Accepts both slugs and UUIDs (backward compatible).
 */
export function resolveOriginParam(param: string | null): string | null {
  if (!param) return null;
  
  // If it's a UUID, return directly
  if (UUID_REGEX.test(param)) return param;
  
  // Otherwise look up the slug
  return slugToIdMap.get(param) || null;
}

/**
 * Convert a sub-origin ID to its slug for URL use.
 * Falls back to the ID if no slug is registered.
 */
export function originIdToSlug(id: string): string {
  return idToSlugMap.get(id) || id;
}

/**
 * Check if the maps are populated
 */
export function hasRegisteredOrigins(): boolean {
  return slugToIdMap.size > 0;
}
