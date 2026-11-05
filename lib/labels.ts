export const PURCHASE_REQUEST_STATUS: Record<string, string> = {
  draft: "مسودة",
  submitted: "مُرسل",
  under_review: "قيد المراجعة",
  aggregated: "ضمن تجميع",
  rejected: "مرفوض",
  cancelled: "ملغى",
  published: "منشور",
  awarded: "تمت الترسية",
  closed: "مغلق",
};

export const OFFER_STATUS: Record<string, string> = {
  draft: "مسودة",
  submitted: "مُقدَّم",
  locked: "مقفول",
  selected: "مختار",
  not_selected: "غير مختار",
  withdrawn: "منسحب",
};

export const FULFILLMENT_STATUS: Record<string, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  ready_for_delivery: "جاهز للتسليم",
  out_for_delivery: "خرج للتوصيل",
  delivered: "تم التسليم",
};

export const RECEIPT_STATUS: Record<string, string> = {
  pending: "بانتظار التأكيد",
  received_full: "تم الاستلام بالكامل",
  received_with_issue: "استلام مع ملاحظة",
};

export const GROUP_DEAL_STATUS: Record<string, string> = {
  forming: "قيد التشكيل",
  ready: "جاهزة",
  in_competition: "ضمن منافسة",
  awarded: "مُرساة",
  closed: "مغلقة",
  cancelled: "ملغاة",
};

export const COMPETITION_STATUS: Record<string, string> = {
  draft: "مسودة",
  inviting: "دعوة الموردين",
  open: "استقبال العروض",
  closed: "مغلقة",
  revealed: "مفتوحة العروض",
  awarded: "مُرساة",
  cancelled: "ملغاة",
};

export const INVITATION_STATUS: Record<string, string> = {
  pending: "بانتظار الرد",
  accepted: "مقبولة",
  declined: "مرفوضة",
  expired: "منتهية",
};

export const BID_STATUS: Record<string, string> = {
  draft: "مسودة",
  submitted: "مُقدَّم",
  locked: "مقفول",
  withdrawn: "منسحب",
};

export const FINAL_OFFER_STATUS: Record<string, string> = {
  pending: "بانتظار الموافقة",
  accepted: "مقبول",
  rejected: "مرفوض",
  expired: "منتهٍ",
};

export const PURCHASE_ORDER_STATUS: Record<string, string> = {
  issued: "صادر",
  confirmed: "مؤكد",
  in_fulfillment: "قيد التنفيذ",
  delivered: "مُسلَّم",
  cancelled: "ملغى",
};

export const DELIVERY_STATUS: Record<string, string> = {
  preparing: "قيد التجهيز",
  scheduled: "مجدول",
  out_for_delivery: "خرج للتوصيل",
  delivered: "تم التسليم",
  failed: "فشل",
  new: "جديد",
  confirmed: "مؤكد",
  ready_for_delivery: "جاهز للتسليم",
};

export const COMPLAINT_STATUS: Record<string, string> = {
  open: "مفتوح",
  in_review: "قيد المراجعة",
  resolved: "محلول",
  rejected: "مرفوض",
};

export const AWARD_STATUS: Record<string, string> = {
  pending: "بانتظار الاعتماد",
  approved: "معتمد",
  rejected: "مرفوض",
};

export function statusTone(
  status: string,
): "blue" | "gold" | "green" | "purple" | "red" {
  if (
    [
      "accepted",
      "approved",
      "awarded",
      "delivered",
      "resolved",
      "locked",
      "selected",
      "published",
      "received_full",
    ].includes(status)
  ) {
    return "green";
  }
  if (
    [
      "pending",
      "under_review",
      "open",
      "inviting",
      "submitted",
      "in_review",
      "new",
      "preparing",
      "confirmed",
    ].includes(status)
  ) {
    return "gold";
  }
  if (
    [
      "rejected",
      "cancelled",
      "failed",
      "expired",
      "declined",
      "not_selected",
      "received_with_issue",
    ].includes(status)
  ) {
    return "red";
  }
  if (
    ["revealed", "aggregated", "in_competition", "out_for_delivery", "ready_for_delivery"].includes(
      status,
    )
  ) {
    return "purple";
  }
  return "blue";
}
