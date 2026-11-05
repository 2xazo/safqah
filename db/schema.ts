import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const orgTypeEnum = pgEnum("org_type", ["buyer", "supplier", "admin"]);
export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "member",
]);
export const userRoleEnum = pgEnum("user_role", ["buyer", "supplier", "admin"]);

/** MVP statuses: draft, published, awarded, closed, cancelled.
 * Legacy values kept for existing rows: submitted, under_review, aggregated, rejected.
 */
export const purchaseRequestStatusEnum = pgEnum("purchase_request_status", [
  "draft",
  "submitted",
  "under_review",
  "aggregated",
  "rejected",
  "cancelled",
  "published",
  "awarded",
  "closed",
]);

export const groupDealStatusEnum = pgEnum("group_deal_status", [
  "forming",
  "ready",
  "in_competition",
  "awarded",
  "closed",
  "cancelled",
]);

export const competitionStatusEnum = pgEnum("competition_status", [
  "draft",
  "inviting",
  "open",
  "closed",
  "revealed",
  "awarded",
  "cancelled",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
]);

export const bidStatusEnum = pgEnum("bid_status", [
  "draft",
  "submitted",
  "locked",
  "withdrawn",
]);

export const awardStatusEnum = pgEnum("award_status", [
  "pending",
  "approved",
  "rejected",
]);

export const finalOfferStatusEnum = pgEnum("final_offer_status", [
  "pending",
  "accepted",
  "rejected",
  "expired",
]);

export const offerStatusEnum = pgEnum("offer_status", [
  "draft",
  "submitted",
  "locked",
  "selected",
  "not_selected",
  "withdrawn",
]);

export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "issued",
  "confirmed",
  "in_fulfillment",
  "delivered",
  "cancelled",
]);

/** Supplier-controlled fulfillment lifecycle on the purchase order. */
export const fulfillmentStatusEnum = pgEnum("fulfillment_status", [
  "new",
  "confirmed",
  "preparing",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
]);

export const receiptStatusEnum = pgEnum("receipt_status", [
  "pending",
  "received_full",
  "received_with_issue",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "preparing",
  "scheduled",
  "out_for_delivery",
  "delivered",
  "failed",
  "new",
  "confirmed",
  "ready_for_delivery",
]);

export const complaintStatusEnum = pgEnum("complaint_status", [
  "open",
  "in_review",
  "resolved",
  "rejected",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    role: userRoleEnum("role").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_uidx").on(table.email)],
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    type: orgTypeEnum("type").notNull(),
    commercialRegister: text("commercial_register"),
    city: text("city").default("الرياض").notNull(),
    isVerified: boolean("is_verified").default(false).notNull(),
    ...timestamps,
  },
  (table) => [index("organizations_type_idx").on(table.type)],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    memberRole: memberRoleEnum("member_role").default("member").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organization_members_org_user_uidx").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_members_user_idx").on(table.userId),
  ],
);

export const buyerProfiles = pgTable("buyer_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" })
    .unique(),
  cuisineType: text("cuisine_type"),
  averageMonthlySpend: numeric("average_monthly_spend", {
    precision: 12,
    scale: 2,
  }),
  ...timestamps,
});

export const supplierProfiles = pgTable("supplier_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" })
    .unique(),
  ratingAverage: numeric("rating_average", { precision: 3, scale: 2 })
    .default("0")
    .notNull(),
  ratingCount: integer("rating_count").default(0).notNull(),
  complianceScore: integer("compliance_score").default(90).notNull(),
  deliveryLeadDays: integer("delivery_lead_days").default(3).notNull(),
  serviceCities: text("service_cities"),
  about: text("about"),
  ...timestamps,
});

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    city: text("city").default("الرياض").notNull(),
    district: text("district"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    ...timestamps,
  },
  (table) => [index("branches_org_idx").on(table.organizationId)],
);

export const deliveryAddresses = pgTable(
  "delivery_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    street: text("street").notNull(),
    district: text("district").notNull(),
    city: text("city").default("الرياض").notNull(),
    additionalNotes: text("additional_notes"),
    isDefault: boolean("is_default").default(true).notNull(),
    ...timestamps,
  },
  (table) => [index("delivery_addresses_branch_idx").on(table.branchId)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("categories_slug_uidx").on(table.slug)],
);

export const supplierCategories = pgTable(
  "supplier_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierOrganizationId: uuid("supplier_organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("supplier_categories_org_cat_uidx").on(
      table.supplierOrganizationId,
      table.categoryId,
    ),
    index("supplier_categories_org_idx").on(table.supplierOrganizationId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    unitLabel: text("unit_label").notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("products_sku_uidx").on(table.sku),
    index("products_category_idx").on(table.categoryId),
  ],
);

export const productSpecifications = pgTable(
  "product_specifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_specifications_product_key_uidx").on(
      table.productId,
      table.key,
    ),
  ],
);

export const purchaseRequests = pgTable(
  "purchase_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    branchId: uuid("branch_id").references(() => branches.id),
    deliveryAddressId: uuid("delivery_address_id").references(
      () => deliveryAddresses.id,
    ),
    status: purchaseRequestStatusEnum("status").default("draft").notNull(),
    title: text("title").notNull(),
    notes: text("notes"),
    neededByDate: date("needed_by_date"),
    minShelfLifeMonths: integer("min_shelf_life_months"),
    categoryId: uuid("category_id").references(() => categories.id),
    /** Free-text category when the buyer selects «أخرى». */
    categoryOtherText: text("category_other_text"),
    deliveryCity: text("delivery_city"),
    deliveryDistrict: text("delivery_district"),
    deliveryAddressText: text("delivery_address_text"),
    submissionDeadline: timestamp("submission_deadline", {
      withTimezone: true,
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    awardedAt: timestamp("awarded_at", { withTimezone: true }),
    selectedOfferId: uuid("selected_offer_id"),
    rawRequirementText: text("raw_requirement_text"),
    attachmentUrl: text("attachment_url"),
    attachmentName: text("attachment_name"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("purchase_requests_code_uidx").on(table.code),
    index("purchase_requests_org_idx").on(table.organizationId),
    index("purchase_requests_status_idx").on(table.status),
  ],
);

export const purchaseRequestItems = pgTable(
  "purchase_request_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseRequestId: uuid("purchase_request_id")
      .notNull()
      .references(() => purchaseRequests.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id),
    productName: text("product_name").notNull().default(""),
    description: text("description"),
    quantity: integer("quantity").notNull(),
    unitLabel: text("unit_label").notNull(),
    specificationNotes: text("specification_notes"),
    acceptedAlternatives: text("accepted_alternatives"),
    brandPreference: text("brand_preference"),
    minShelfLifeMonths: integer("min_shelf_life_months"),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    index("purchase_request_items_request_idx").on(table.purchaseRequestId),
  ],
);

export const purchaseRequestStatusHistory = pgTable(
  "purchase_request_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseRequestId: uuid("purchase_request_id")
      .notNull()
      .references(() => purchaseRequests.id, { onDelete: "cascade" }),
    fromStatus: purchaseRequestStatusEnum("from_status"),
    toStatus: purchaseRequestStatusEnum("to_status").notNull(),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

/** Direct RFQ offers (buyer request → supplier), replacing competition-mediated bids for MVP. */
export const offers = pgTable(
  "offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    purchaseRequestId: uuid("purchase_request_id")
      .notNull()
      .references(() => purchaseRequests.id, { onDelete: "cascade" }),
    supplierOrganizationId: uuid("supplier_organization_id")
      .notNull()
      .references(() => organizations.id),
    submittedByUserId: uuid("submitted_by_user_id").references(() => users.id),
    status: offerStatusEnum("status").default("draft").notNull(),
    offerValidityDate: date("offer_validity_date"),
    deliveryFee: numeric("delivery_fee", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    paymentTerms: text("payment_terms"),
    notes: text("notes"),
    attachmentUrl: text("attachment_url"),
    attachmentName: text("attachment_name"),
    proposedDeliveryDate: date("proposed_delivery_date").notNull(),
    meetsDeliveryDate: boolean("meets_delivery_date").default(true).notNull(),
    deliveryDaysDiff: integer("delivery_days_diff").default(0).notNull(),
    subtotalAmount: numeric("subtotal_amount", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    isLocked: boolean("is_locked").default(false).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("offers_code_uidx").on(table.code),
    uniqueIndex("offers_request_supplier_uidx").on(
      table.purchaseRequestId,
      table.supplierOrganizationId,
    ),
    index("offers_supplier_idx").on(table.supplierOrganizationId),
    index("offers_status_idx").on(table.status),
  ],
);

export const offerItems = pgTable(
  "offer_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    purchaseRequestItemId: uuid("purchase_request_item_id").references(
      () => purchaseRequestItems.id,
      { onDelete: "set null" },
    ),
    offeredProductName: text("offered_product_name").notNull(),
    brandName: text("brand_name"),
    specificationNote: text("specification_note"),
    availableQuantity: integer("available_quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
    isAlternative: boolean("is_alternative").default(false).notNull(),
    ...timestamps,
  },
  (table) => [index("offer_items_offer_idx").on(table.offerId)],
);

export const offerScores = pgTable(
  "offer_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" })
      .unique(),
    priceScore: numeric("price_score", { precision: 5, scale: 2 }).notNull(),
    deliveryScore: numeric("delivery_score", {
      precision: 5,
      scale: 2,
    }).notNull(),
    ratingScore: numeric("rating_score", { precision: 5, scale: 2 }).notNull(),
    totalScore: numeric("total_score", { precision: 5, scale: 2 }).notNull(),
    isBestValue: boolean("is_best_value").default(false).notNull(),
    isCheapest: boolean("is_cheapest").default(false).notNull(),
    isFastest: boolean("is_fastest").default(false).notNull(),
    isHighestRated: boolean("is_highest_rated").default(false).notNull(),
    explanation: text("explanation"),
    ...timestamps,
  },
);

export const groupDeals = pgTable(
  "group_deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    status: groupDealStatusEnum("status").default("forming").notNull(),
    totalQuantity: integer("total_quantity").default(0).notNull(),
    targetQuantity: integer("target_quantity"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("group_deals_code_uidx").on(table.code),
    index("group_deals_status_idx").on(table.status),
  ],
);

export const groupDealMembers = pgTable(
  "group_deal_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupDealId: uuid("group_deal_id")
      .notNull()
      .references(() => groupDeals.id, { onDelete: "cascade" }),
    purchaseRequestId: uuid("purchase_request_id")
      .notNull()
      .references(() => purchaseRequests.id),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    allocatedQuantity: integer("allocated_quantity").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("group_deal_members_deal_request_uidx").on(
      table.groupDealId,
      table.purchaseRequestId,
    ),
    index("group_deal_members_org_idx").on(table.organizationId),
  ],
);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    groupDealId: uuid("group_deal_id")
      .notNull()
      .references(() => groupDeals.id),
    title: text("title").notNull(),
    status: competitionStatusEnum("status").default("draft").notNull(),
    submissionDeadline: timestamp("submission_deadline", {
      withTimezone: true,
    }).notNull(),
    revealAt: timestamp("reveal_at", { withTimezone: true }).notNull(),
    sealedUntil: timestamp("sealed_until", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("competitions_code_uidx").on(table.code),
    uniqueIndex("competitions_group_deal_uidx").on(table.groupDealId),
    index("competitions_status_idx").on(table.status),
  ],
);

export const competitionInvitations = pgTable(
  "competition_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    supplierOrganizationId: uuid("supplier_organization_id")
      .notNull()
      .references(() => organizations.id),
    status: invitationStatusEnum("status").default("pending").notNull(),
    invitedAt: timestamp("invited_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("competition_invitations_comp_supplier_uidx").on(
      table.competitionId,
      table.supplierOrganizationId,
    ),
    index("competition_invitations_supplier_idx").on(
      table.supplierOrganizationId,
    ),
  ],
);

export const bids = pgTable(
  "bids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    supplierOrganizationId: uuid("supplier_organization_id")
      .notNull()
      .references(() => organizations.id),
    submittedByUserId: uuid("submitted_by_user_id").references(() => users.id),
    status: bidStatusEnum("status").default("draft").notNull(),
    brandName: text("brand_name"),
    originCountry: text("origin_country"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
    availableQuantity: integer("available_quantity"),
    deliveryDays: integer("delivery_days"),
    shelfLifeMonths: integer("shelf_life_months"),
    deliveryFee: numeric("delivery_fee", { precision: 12, scale: 2 }),
    offerValidityHours: integer("offer_validity_hours"),
    notes: text("notes"),
    isLocked: boolean("is_locked").default(false).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("bids_competition_supplier_uidx").on(
      table.competitionId,
      table.supplierOrganizationId,
    ),
    index("bids_supplier_idx").on(table.supplierOrganizationId),
    index("bids_status_idx").on(table.status),
  ],
);

export const bidItems = pgTable(
  "bid_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    ...timestamps,
  },
  (table) => [index("bid_items_bid_idx").on(table.bidId)],
);

export const bidScores = pgTable(
  "bid_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id, { onDelete: "cascade" })
      .unique(),
    priceScore: numeric("price_score", { precision: 5, scale: 2 }).notNull(),
    complianceScore: numeric("compliance_score", {
      precision: 5,
      scale: 2,
    }).notNull(),
    ratingScore: numeric("rating_score", { precision: 5, scale: 2 }).notNull(),
    deliveryScore: numeric("delivery_score", {
      precision: 5,
      scale: 2,
    }).notNull(),
    shelfLifeScore: numeric("shelf_life_score", {
      precision: 5,
      scale: 2,
    }).notNull(),
    quantityScore: numeric("quantity_score", {
      precision: 5,
      scale: 2,
    }).notNull(),
    totalScore: numeric("total_score", { precision: 5, scale: 2 }).notNull(),
    isRecommended: boolean("is_recommended").default(false).notNull(),
    isCheapest: boolean("is_cheapest").default(false).notNull(),
    recommendationNote: text("recommendation_note"),
    ...timestamps,
  },
);

export const awardDecisions = pgTable(
  "award_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" })
      .unique(),
    winningBidId: uuid("winning_bid_id")
      .notNull()
      .references(() => bids.id),
    decidedByUserId: uuid("decided_by_user_id")
      .notNull()
      .references(() => users.id),
    status: awardStatusEnum("status").default("pending").notNull(),
    rationale: text("rationale"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
);

export const finalOffers = pgTable(
  "final_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id),
    awardDecisionId: uuid("award_decision_id")
      .notNull()
      .references(() => awardDecisions.id),
    buyerOrganizationId: uuid("buyer_organization_id")
      .notNull()
      .references(() => organizations.id),
    supplierOrganizationId: uuid("supplier_organization_id")
      .notNull()
      .references(() => organizations.id),
    purchaseRequestId: uuid("purchase_request_id").references(
      () => purchaseRequests.id,
    ),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    deliveryFee: numeric("delivery_fee", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    status: finalOfferStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("final_offers_code_uidx").on(table.code),
    index("final_offers_buyer_idx").on(table.buyerOrganizationId),
    index("final_offers_status_idx").on(table.status),
  ],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    finalOfferId: uuid("final_offer_id").references(() => finalOffers.id),
    offerId: uuid("offer_id").references(() => offers.id),
    purchaseRequestId: uuid("purchase_request_id").references(
      () => purchaseRequests.id,
    ),
    buyerOrganizationId: uuid("buyer_organization_id")
      .notNull()
      .references(() => organizations.id),
    supplierOrganizationId: uuid("supplier_organization_id")
      .notNull()
      .references(() => organizations.id),
    status: purchaseOrderStatusEnum("status").default("issued").notNull(),
    fulfillmentStatus: fulfillmentStatusEnum("fulfillment_status")
      .default("new")
      .notNull(),
    receiptStatus: receiptStatusEnum("receipt_status")
      .default("pending")
      .notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    deliveryFee: numeric("delivery_fee", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    paymentTerms: text("payment_terms"),
    expectedDeliveryDate: date("expected_delivery_date"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("purchase_orders_code_uidx").on(table.code),
    uniqueIndex("purchase_orders_offer_uidx").on(table.offerId),
    index("purchase_orders_buyer_idx").on(table.buyerOrganizationId),
    index("purchase_orders_supplier_idx").on(table.supplierOrganizationId),
  ],
);

export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id),
    productName: text("product_name").notNull().default(""),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
    specificationNote: text("specification_note"),
    ...timestamps,
  },
  (table) => [index("purchase_order_items_po_idx").on(table.purchaseOrderId)],
);

export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" })
      .unique(),
    status: deliveryStatusEnum("status").default("preparing").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    carrierNotes: text("carrier_notes"),
    ...timestamps,
  },
);

export const deliveryStatusHistory = pgTable(
  "delivery_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id, { onDelete: "cascade" }),
    fromStatus: deliveryStatusEnum("from_status"),
    toStatus: deliveryStatusEnum("to_status").notNull(),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const fulfillmentEvents = pgTable(
  "fulfillment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    fromStatus: fulfillmentStatusEnum("from_status"),
    toStatus: fulfillmentStatusEnum("to_status").notNull(),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("fulfillment_events_po_idx").on(table.purchaseOrderId),
  ],
);

export const complaints = pgTable(
  "complaints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    purchaseOrderId: uuid("purchase_order_id").references(
      () => purchaseOrders.id,
    ),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: complaintStatusEnum("status").default("open").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("complaints_code_uidx").on(table.code),
    index("complaints_org_idx").on(table.organizationId),
  ],
);

export const supplierRatings = pgTable(
  "supplier_ratings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierOrganizationId: uuid("supplier_organization_id")
      .notNull()
      .references(() => organizations.id),
    buyerOrganizationId: uuid("buyer_organization_id")
      .notNull()
      .references(() => organizations.id),
    purchaseOrderId: uuid("purchase_order_id").references(
      () => purchaseOrders.id,
    ),
    score: integer("score").notNull(),
    comment: text("comment"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("supplier_ratings_po_buyer_uidx").on(
      table.purchaseOrderId,
      table.buyerOrganizationId,
    ),
    index("supplier_ratings_supplier_idx").on(table.supplierOrganizationId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    linkPath: text("link_path"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("notifications_user_idx").on(table.userId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_actor_idx").on(table.actorUserId),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
  notifications: many(notifications),
}));

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  members: many(organizationMembers),
  buyerProfile: one(buyerProfiles),
  supplierProfile: one(supplierProfiles),
  branches: many(branches),
}));
