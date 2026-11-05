import type { AppRole } from "@/lib/auth";

export type CompetitionRevealFields = {
  status: string;
  revealAt: Date | string;
  sealedUntil: Date | string;
};

/** Commercial bid fields that stay sealed until reveal. */
export const BID_COMMERCIAL_FIELDS = [
  "unitPrice",
  "deliveryFee",
  "brandName",
  "originCountry",
  "availableQuantity",
  "deliveryDays",
  "shelfLifeMonths",
  "offerValidityHours",
  "notes",
] as const;

export function isCompetitionRevealed(competition: CompetitionRevealFields) {
  if (competition.status === "revealed" || competition.status === "awarded") {
    return true;
  }
  const now = Date.now();
  const revealAt = new Date(competition.revealAt).getTime();
  const sealedUntil = new Date(competition.sealedUntil).getTime();
  return now >= revealAt && now >= sealedUntil;
}

/**
 * Buyers/suppliers only see other suppliers' commercial bid fields after reveal.
 * Admins may see commercial fields after reveal (not while sealed).
 * A supplier always sees their own commercial fields.
 */
export function canViewBidCommercials(opts: {
  viewerRole: AppRole;
  competition: CompetitionRevealFields;
  isOwnBid?: boolean;
}) {
  if (opts.isOwnBid) return true;
  return isCompetitionRevealed(opts.competition);
}

export function redactBidCommercials<T extends Record<string, unknown>>(
  bid: T,
  allowed: boolean,
): T {
  if (allowed) return bid;
  const next = { ...bid };
  for (const key of BID_COMMERCIAL_FIELDS) {
    if (key in next) {
      (next as Record<string, unknown>)[key] = null;
    }
  }
  return next;
}
