export interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

export const getFlagUrl = (countryCode: string): string => {
  return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
};

// SVG flag (crisp at any size)
export const getFlagSvgUrl = (countryCode: string): string => {
  return `https://flagcdn.com/${countryCode.toLowerCase()}.svg`;
};

// Resolve a country from its dial code (e.g. "+55" or "55")
export const findCountryByDial = (dialCode?: string | null): Country | undefined => {
  if (!dialCode) return undefined;
  const t = dialCode.toString().trim();
  const normalized = t.startsWith("+") ? t : `+${t.replace(/^\+/, "")}`;
  return countries.find((c) => c.dialCode === normalized);
};

export const countries: Country[] = [
  { code: "BR", name: "Brasil", dialCode: "+55", flag: "🇧🇷" },
  { code: "PT", name: "Portugal", dialCode: "+351", flag: "🇵🇹" },
  { code: "US", name: "Estados Unidos", dialCode: "+1", flag: "🇺🇸" },
  { code: "ES", name: "Espanha", dialCode: "+34", flag: "🇪🇸" },
  { code: "FR", name: "França", dialCode: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Alemanha", dialCode: "+49", flag: "🇩🇪" },
  { code: "IT", name: "Itália", dialCode: "+39", flag: "🇮🇹" },
  { code: "GB", name: "Reino Unido", dialCode: "+44", flag: "🇬🇧" },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷" },
  { code: "MX", name: "México", dialCode: "+52", flag: "🇲🇽" },
  { code: "CO", name: "Colômbia", dialCode: "+57", flag: "🇨🇴" },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱" },
  { code: "PE", name: "Peru", dialCode: "+51", flag: "🇵🇪" },
  { code: "UY", name: "Uruguai", dialCode: "+598", flag: "🇺🇾" },
  { code: "PY", name: "Paraguai", dialCode: "+595", flag: "🇵🇾" },
  { code: "EC", name: "Equador", dialCode: "+593", flag: "🇪🇨" },
  { code: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪" },
  { code: "BO", name: "Bolívia", dialCode: "+591", flag: "🇧🇴" },
];
