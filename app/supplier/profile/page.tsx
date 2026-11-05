import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations, supplierProfiles } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { SupplierProfileForm } from "@/components/supplier-profile-form";
import { requireRole } from "@/lib/rbac";
import { formatDurationDays, formatRating } from "@/lib/format";

export default async function SupplierProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await requireRole(["supplier"]);
  const { saved } = await searchParams;
  const db = getDb();

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, session.organizationId))
    .limit(1);

  const [profile] = await db
    .select()
    .from(supplierProfiles)
    .where(eq(supplierProfiles.organizationId, session.organizationId))
    .limit(1);

  return (
    <>
      <PageHeader
        title="ملف المورد"
        description="هذه المعلومات تساعد على مطابقة فرص التوريد المناسبة لمنشأتك."
      />

      <div className="offer-layout">
        <SupplierProfileForm
          city={organization?.city ?? "الرياض"}
          serviceCities={profile?.serviceCities ?? organization?.city ?? "الرياض"}
          about={profile?.about ?? ""}
          saved={saved === "1"}
        />

        <aside className="panel decision-panel">
          <h3>مؤشرات الأداء</h3>
          <div className="deal-numbers" style={{ marginTop: 12, gridTemplateColumns: "1fr 1fr" }}>
            <span>
              <small>التقييم</small>
              <b>{formatRating(profile?.ratingAverage)}</b>
            </span>
            <span>
              <small>عدد التقييمات</small>
              <b>{profile?.ratingCount ?? 0}</b>
            </span>
            <span>
              <small>مؤشر الالتزام</small>
              <b>{profile?.complianceScore ?? 90}</b>
            </span>
            <span>
              <small>متوسط مدة التوريد</small>
              <b>{formatDurationDays(profile?.deliveryLeadDays ?? 3)}</b>
            </span>
          </div>
          <p className="helper-text" style={{ marginTop: 14 }}>
            التقييم ومتوسط مدة التوريد يعتمدان على أوامر مكتملة. مؤشر الالتزام يعكس التزام المورد
            بمواعيد التسليم المتفق عليها.
          </p>
        </aside>
      </div>
    </>
  );
}
