/** Common Saudi delivery cities for buyer/supplier forms. */
export const SAUDI_CITIES = [
  "الرياض",
  "جدة",
  "مكة المكرمة",
  "المدينة المنورة",
  "الدمام",
  "الخبر",
  "حائل",
  "القصيم",
  "أبها",
  "تبوك",
] as const;

export const OTHER_CITY = "أخرى";

export const DEMO_SERVICE_CITIES = [...SAUDI_CITIES].join("، ");

export function isKnownSaudiCity(value: string) {
  return (SAUDI_CITIES as readonly string[]).includes(value.trim());
}

export function normalizeCitySelection(city: string, otherCity: string) {
  const trimmed = city.trim();
  if (trimmed === OTHER_CITY) {
    return otherCity.trim();
  }
  return trimmed;
}
