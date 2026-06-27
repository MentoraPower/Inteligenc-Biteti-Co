// Detect a mobile PHONE by DEVICE — not by screen size/width.
// Uses UA Client Hints (navigator.userAgentData.mobile) when available, which is
// the most reliable signal and independent of window size, zoom or resizing.
// Falls back to the user-agent string (phones only — tablets like iPad are allowed).
export function isMobilePhone(): boolean {
  if (typeof navigator === "undefined") return false;

  const uaData = (navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  }).userAgentData;

  // 1) UA Client Hints — `mobile` is true for phones, false for desktop/tablets.
  if (uaData && typeof uaData.mobile === "boolean") {
    return uaData.mobile;
  }

  // 2) Fallback: user-agent string (phone patterns; excludes iPad/Android tablets).
  const ua = navigator.userAgent || "";
  return /iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|BlackBerry|BB10|Opera Mini|webOS|Mobile.*Firefox/i.test(
    ua
  );
}
