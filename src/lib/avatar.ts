// Pick a profile avatar based on the lead's name (gender heuristic for PT-BR names).
// Several variants per gender are picked deterministically so each lead keeps a
// stable avatar while the set looks varied across the board.
// Avatars live in /public so we reference them by absolute URL.
const MALE_AVATARS = ["/avatar-male.png", "/avatar-male-2.png"];
const FEMALE_AVATARS = [
  "/avatar-female.png",
  "/avatar-female-2.png",
  "/avatar-female-3.png",
  "/avatar-female-4.png",
];

// Female names that do NOT end in "a" (so the heuristic would miss them).
const FEMALE_NAMES = new Set([
  "beatriz", "ines", "raquel", "isabel", "carmen", "miriam", "ester", "rute",
  "liz", "agnes", "jasmin", "caroline", "jaqueline", "jacqueline", "eveline",
  "adriane", "daniele", "danielle", "gabriele", "gabrielle", "rafaele", "michele",
  "michelle", "marise", "denise", "elis", "heloise", "tais", "thais", "lais",
  "iris", "doris", "mercedes", "soraia", "kelly", "kelli", "nicole", "estefani",
  "kamily", "emilly", "evelyn", "marilyn", "carol", "ruth", "edith", "lilian",
  "gilian", "vivian", "cristian", "esther", "abigail", "isis", "yasmin",
]);

// Male names that DO end in "a" (so the heuristic would misclassify them).
const MALE_NAMES = new Set([
  "luca", "juca", "nicola", "joshua", "noa", "aha", "bira", "sabia",
  "garcia", "costa", "barbosa", "souza", "matias", "tobias", "elias", "dimas",
  "jonas", "lucas", "thomas", "dario",
]);

function firstNameKey(name?: string): string {
  return (name || "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "") // strip accents
    || "";
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function isFemaleName(first: string): boolean {
  if (!first) return false;
  if (FEMALE_NAMES.has(first)) return true;
  if (MALE_NAMES.has(first)) return false;
  // Heuristic: PT-BR names ending in "a" are predominantly female.
  return first.endsWith("a");
}

export function getAvatarForName(name?: string): string {
  const first = firstNameKey(name);
  const pool = isFemaleName(first) ? FEMALE_AVATARS : MALE_AVATARS;
  const idx = hashString(first || "x") % pool.length;
  return pool[idx];
}
