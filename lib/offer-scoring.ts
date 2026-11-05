import { OFFER_SCORE_WEIGHTS } from "@/lib/constants";

export type OfferScoreInput = {
  offerId: string;
  totalAmount: number;
  proposedDeliveryDate: string | Date;
  meetsDeliveryDate: boolean;
  deliveryDaysDiff: number;
  supplierRating: number;
};

export type OfferScoreResult = {
  offerId: string;
  priceScore: number;
  deliveryScore: number;
  ratingScore: number;
  totalScore: number;
  isBestValue: boolean;
  isCheapest: boolean;
  isFastest: boolean;
  isHighestRated: boolean;
  explanation: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function dayKey(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  return d.getTime();
}

/**
 * Deterministic MVP recommendation model:
 * price 50% + delivery 30% + supplier rating 20%.
 */
export function scoreOffers(inputs: OfferScoreInput[]): OfferScoreResult[] {
  if (inputs.length === 0) return [];

  const amounts = inputs.map((o) => o.totalAmount);
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);
  const amountSpan = maxAmount - minAmount || 1;

  const diffs = inputs.map((o) => o.deliveryDaysDiff);
  const minDiff = Math.min(...diffs);
  const maxDiff = Math.max(...diffs);
  const diffSpan = maxDiff - minDiff || 1;

  const ratings = inputs.map((o) => o.supplierRating);
  const maxRating = Math.max(...ratings, 5);

  const scored = inputs.map((offer) => {
    const priceScore = round2(100 * (1 - (offer.totalAmount - minAmount) / amountSpan));
    const deliveryBase = round2(100 * (1 - (offer.deliveryDaysDiff - minDiff) / diffSpan));
    const deliveryScore = offer.meetsDeliveryDate
      ? Math.min(100, deliveryBase + 10)
      : Math.max(0, deliveryBase - 25);
    const ratingScore = round2((offer.supplierRating / maxRating) * 100);
    const totalScore = round2(
      priceScore * OFFER_SCORE_WEIGHTS.price +
        deliveryScore * OFFER_SCORE_WEIGHTS.delivery +
        ratingScore * OFFER_SCORE_WEIGHTS.rating,
    );

    return {
      offerId: offer.offerId,
      priceScore,
      deliveryScore: round2(Math.max(0, Math.min(100, deliveryScore))),
      ratingScore,
      totalScore,
      isBestValue: false,
      isCheapest: false,
      isFastest: false,
      isHighestRated: false,
      explanation: "",
      _amount: offer.totalAmount,
      _diff: offer.deliveryDaysDiff,
      _rating: offer.supplierRating,
      _meets: offer.meetsDeliveryDate,
      _deliveryTs: dayKey(offer.proposedDeliveryDate),
    };
  });

  const cheapestId = scored.reduce((best, cur) =>
    cur._amount < best._amount ? cur : best,
  ).offerId;
  const fastestId = scored.reduce((best, cur) =>
    cur._deliveryTs < best._deliveryTs ||
    (cur._deliveryTs === best._deliveryTs && cur._diff < best._diff)
      ? cur
      : best,
  ).offerId;
  const highestRatedId = scored.reduce((best, cur) =>
    cur._rating > best._rating ? cur : best,
  ).offerId;
  const bestValueId = scored.reduce((best, cur) =>
    cur.totalScore > best.totalScore ? cur : best,
  ).offerId;

  return scored
    .map((row) => {
      const isBestValue = row.offerId === bestValueId;
      const isCheapest = row.offerId === cheapestId;
      const isFastest = row.offerId === fastestId;
      const isHighestRated = row.offerId === highestRatedId;
      const priceGap = round2(row._amount - minAmount);
      const parts: string[] = [];
      if (isBestValue) parts.push("أفضل قيمة وفق الوزن المركّب (سعر 50%، توصيل 30%، تقييم 20%)");
      if (isCheapest) parts.push("الأقل سعرًا");
      else if (priceGap > 0) parts.push(`أعلى من الأرخص بـ ${priceGap} ريال`);
      if (isFastest) parts.push("الأسرع توصيلًا");
      if (isHighestRated) parts.push("الأعلى تقييمًا");
      if (row._meets) parts.push("يلتزم بموعد التوصيل المطلوب");
      else parts.push(`يتأخر عن الموعد المطلوب بـ ${row._diff} يوم`);

      return {
        offerId: row.offerId,
        priceScore: row.priceScore,
        deliveryScore: row.deliveryScore,
        ratingScore: row.ratingScore,
        totalScore: row.totalScore,
        isBestValue,
        isCheapest,
        isFastest,
        isHighestRated,
        explanation: parts.join(" · "),
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}
