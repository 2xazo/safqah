/** Shared purchase-request validation helpers (client + server). */

export const PLACEHOLDER_PRODUCT_NAMES = new Set([
  "لا يوجد",
  "لايوجد",
  "غير موجود",
  "بدون",
  "n/a",
  "na",
  "none",
  "empty",
  "-",
  "—",
  ".",
  "منتج",
  "empty product",
]);

export type RequestItemInput = {
  productName: string;
  description?: string;
  quantity: number;
  unitLabel: string;
  specificationNotes?: string;
  acceptedAlternatives?: string;
  brandPreference?: string;
  minShelfLifeMonths?: number | null;
};

export type FieldErrors = Record<string, string>;

export function isPlaceholderProductName(name: string) {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, "");
  if (!normalized) return true;
  if (PLACEHOLDER_PRODUCT_NAMES.has(name.trim()) || PLACEHOLDER_PRODUCT_NAMES.has(normalized)) {
    return true;
  }
  return false;
}

export function validatePublishRequest(input: {
  title: string;
  deliveryCity: string;
  deliveryDistrict?: string;
  deliveryAddressText?: string;
  deliveryAddressId?: string;
  neededByDate?: string;
  submissionDeadline?: string;
  items: RequestItemInput[];
  now?: Date;
}): { ok: true } | { ok: false; message: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const now = input.now ?? new Date();

  if (!input.title.trim() || input.title.trim().length < 3) {
    fieldErrors.title = "أدخل عنوانًا واضحًا للطلب (٣ أحرف على الأقل).";
  }

  if (!input.deliveryCity.trim()) {
    fieldErrors.deliveryCity = "اختر مدينة التوصيل.";
  }

  const hasAddress =
    Boolean(input.deliveryAddressText?.trim()) ||
    Boolean(input.deliveryAddressId?.trim()) ||
    Boolean(input.deliveryDistrict?.trim());
  if (!hasAddress) {
    fieldErrors.deliveryAddressText =
      "أدخل الحي أو عنوان التوصيل أو اختر عنوانًا محفوظًا.";
  }

  if (!input.neededByDate?.trim()) {
    fieldErrors.neededByDate = "حدد تاريخ التوصيل المطلوب.";
  }

  if (!input.submissionDeadline?.trim()) {
    fieldErrors.submissionDeadline = "حدد آخر موعد لتقديم العروض.";
  } else {
    const deadline = new Date(input.submissionDeadline);
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= now.getTime()) {
      fieldErrors.submissionDeadline = "يجب أن يكون آخر موعد للعروض في المستقبل.";
    }
  }

  if (!input.items.length) {
    fieldErrors.items = "أضف بندًا واحدًا على الأقل صالحًا للنشر.";
  }

  input.items.forEach((item, index) => {
    const prefix = `items.${index}`;
    if (!item.productName.trim() || item.productName.trim().length < 2) {
      fieldErrors[`${prefix}.productName`] = "أدخل اسم المنتج.";
    } else if (isPlaceholderProductName(item.productName)) {
      fieldErrors[`${prefix}.productName`] =
        "اسم المنتج غير صالح. اكتب اسم المنتج الحقيقي المطلوب.";
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      fieldErrors[`${prefix}.quantity`] = "الكمية يجب أن تكون أكبر من صفر.";
    }
    if (!item.unitLabel.trim()) {
      fieldErrors[`${prefix}.unitLabel`] = "حدد وحدة القياس.";
    }
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "أكمل الحقول المطلوبة قبل نشر طلب الشراء.",
      fieldErrors,
    };
  }

  return { ok: true };
}

export function arabicPublishError(code: string): string {
  const map: Record<string, string> = {
    NEEDED_BY_REQUIRED: "حدد تاريخ التوصيل المطلوب.",
    DEADLINE_REQUIRED: "حدد آخر موعد لتقديم العروض.",
    DEADLINE_INVALID: "يجب أن يكون آخر موعد للعروض في المستقبل.",
    TITLE_REQUIRED: "أدخل عنوان الطلب.",
    CITY_REQUIRED: "اختر مدينة التوصيل.",
    ADDRESS_REQUIRED: "أدخل موقع التوصيل أو عنوانًا محفوظًا.",
    ITEMS_REQUIRED: "أضف بندًا واحدًا على الأقل صالحًا.",
    INVALID_ITEM: "تحقق من بنود الطلب: الاسم والكمية والوحدة.",
    VALIDATION_FAILED: "أكمل الحقول المطلوبة قبل نشر طلب الشراء.",
  };
  return map[code] ?? code;
}
