export function daysBetweenDates(a: string | Date, b: string | Date) {
  const start = new Date(a);
  const end = new Date(b);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function dateOnly(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isDeadlinePassed(deadline: string | Date | null | undefined, now = new Date()) {
  if (!deadline) return false;
  return new Date(deadline).getTime() < now.getTime();
}

export type OpportunityState =
  | "available"
  | "offer_submitted"
  | "deadline_passed"
  | "selected_you"
  | "selected_other"
  | "closed";

export function opportunityState(input: {
  requestStatus: string;
  submissionDeadline: string | Date | null | undefined;
  hasOffer: boolean;
  isWinner?: boolean;
  now?: Date;
}): OpportunityState {
  if (input.requestStatus === "closed" || input.requestStatus === "cancelled") {
    return "closed";
  }
  if (input.requestStatus === "awarded") {
    if (input.isWinner) return "selected_you";
    if (input.hasOffer) return "selected_other";
    return "selected_other";
  }
  if (isDeadlinePassed(input.submissionDeadline, input.now)) {
    return input.hasOffer ? "offer_submitted" : "deadline_passed";
  }
  return input.hasOffer ? "offer_submitted" : "available";
}

export const OPPORTUNITY_STATE_LABEL: Record<OpportunityState, string> = {
  available: "متاحة",
  offer_submitted: "تم تقديم عرض",
  deadline_passed: "انتهى الموعد",
  selected_you: "تم اختيارك",
  selected_other: "تم اختيار مورد آخر",
  closed: "مغلقة",
};

export function opportunityActionLabel(state: OpportunityState): string {
  switch (state) {
    case "available":
      return "تقديم عرض";
    case "offer_submitted":
      return "عرض عرضك";
    case "selected_you":
    case "selected_other":
      return "عرض النتيجة";
    case "deadline_passed":
      return "عرض الفرصة";
    default:
      return "عرض الفرصة";
  }
}
