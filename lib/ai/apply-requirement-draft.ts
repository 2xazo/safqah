import type { RequirementDraft } from "@/lib/ai/requirement-assistant";
import { OTHER_CITY, SAUDI_CITIES } from "@/lib/saudi-cities";

export type DraftLineItemFields = {
  productName: string;
  description: string;
  quantity: number | "";
  unitLabel: string;
  specificationNotes: string;
  acceptedAlternatives: string;
  brandPreference: string;
  minShelfLifeMonths: string;
};

export type MappedRequirementForm = {
  title: string;
  notes: string;
  deliveryCity: string;
  cityChoice: string;
  otherCity: string;
  requestedDeliveryText: string | null;
  items: DraftLineItemFields[];
  missingInformation: string[];
  clarificationQuestions: string[];
};

export function formHasUserEnteredData(input: {
  title: string;
  notes: string;
  deliveryCity: string;
  deliveryDistrict: string;
  deliveryAddressText: string;
  items: Array<{
    productName: string;
    unitLabel: string;
    specificationNotes: string;
    quantity: number | "";
  }>;
}) {
  if (input.title.trim() || input.notes.trim() || input.deliveryDistrict.trim()) {
    return true;
  }
  if (input.deliveryAddressText.trim()) return true;
  if (input.deliveryCity && input.deliveryCity !== SAUDI_CITIES[0]) return true;
  return input.items.some(
    (item) =>
      item.productName.trim() ||
      item.unitLabel.trim() ||
      item.specificationNotes.trim() ||
      (item.quantity !== "" && Number(item.quantity) > 0),
  );
}

/**
 * Maps an accepted AI draft onto existing form fields.
 * Does not publish or save. Does not invent neededByDate from ambiguous phrases.
 */
export function mapRequirementDraftToForm(
  draft: RequirementDraft,
): MappedRequirementForm {
  const city = draft.deliveryCity?.trim() || "";
  let cityChoice = "";
  let otherCity = "";
  if (city) {
    if ((SAUDI_CITIES as readonly string[]).includes(city)) {
      cityChoice = city;
    } else {
      cityChoice = OTHER_CITY;
      otherCity = city;
    }
  }

  const noteParts: string[] = [];
  if (draft.generalNotes?.trim()) noteParts.push(draft.generalNotes.trim());
  if (draft.requestedDeliveryText?.trim()) {
    noteParts.push(`موعد التوصيل المذكور: ${draft.requestedDeliveryText.trim()}`);
  }

  const items: DraftLineItemFields[] =
    draft.items.length > 0
      ? draft.items.map((item) => ({
          productName: item.name?.trim() || "",
          description: "",
          quantity:
            item.quantity != null && Number.isFinite(item.quantity) && item.quantity > 0
              ? Math.round(item.quantity)
              : "",
          unitLabel: item.unit?.trim() || "",
          specificationNotes: item.specifications?.trim() || "",
          acceptedAlternatives: item.acceptableAlternatives?.trim() || "",
          brandPreference: "",
          minShelfLifeMonths: "",
        }))
      : [
          {
            productName: "",
            description: "",
            quantity: "",
            unitLabel: "",
            specificationNotes: "",
            acceptedAlternatives: "",
            brandPreference: "",
            minShelfLifeMonths: "",
          },
        ];

  return {
    title: draft.requestTitle?.trim() || "",
    notes: noteParts.join("\n"),
    deliveryCity: city,
    cityChoice,
    otherCity,
    requestedDeliveryText: draft.requestedDeliveryText,
    items,
    missingInformation: draft.missingInformation ?? [],
    clarificationQuestions: draft.clarificationQuestions ?? [],
  };
}

/**
 * Merge AI-mapped values without silently overwriting non-empty user fields
 * unless `overwrite` is true.
 */
export function mergeMappedDraft(
  current: {
    title: string;
    notes: string;
    cityChoice: string;
    otherCity: string;
    items: DraftLineItemFields[];
  },
  mapped: MappedRequirementForm,
  overwrite: boolean,
) {
  const pick = (existing: string, next: string) => {
    if (overwrite) return next || existing;
    return existing.trim() ? existing : next;
  };

  const nextItems =
    overwrite || !current.items.some((i) => i.productName.trim())
      ? mapped.items
      : current.items;

  return {
    title: pick(current.title, mapped.title),
    notes: pick(current.notes, mapped.notes),
    cityChoice: overwrite
      ? mapped.cityChoice || current.cityChoice
      : current.cityChoice || mapped.cityChoice,
    otherCity: overwrite
      ? mapped.otherCity || current.otherCity
      : current.otherCity || mapped.otherCity,
    items: nextItems,
    missingInformation: mapped.missingInformation,
    clarificationQuestions: mapped.clarificationQuestions,
    requestedDeliveryText: mapped.requestedDeliveryText,
  };
}
