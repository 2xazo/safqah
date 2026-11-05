import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { complaints } from "@/db/schema";
import { Badge, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDateTime, formatDate } from "@/lib/format";
import { COMPLAINT_STATUS, statusTone } from "@/lib/labels";

export default async function BuyerComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["buyer"]);
  const db = getDb();

  const [complaint] = await db
    .select()
    .from(complaints)
    .where(
      and(
        eq(complaints.id, id),
        eq(complaints.organizationId, session.organizationId),
      ),
    )
    .limit(1);

  if (!complaint) notFound();

  return (
    <>
      <PageHeader
        title={complaint.title}
        description={complaint.code}
        actions={
          <Badge tone={statusTone(complaint.status)}>
            {COMPLAINT_STATUS[complaint.status] ?? complaint.status}
          </Badge>
        }
      />
      <section className="panel">
        <p style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{complaint.description}</p>
        <p style={{ fontSize: 12, color: "var(--muted)" }}>
          تاريخ الإنشاء: {formatDateTime(complaint.createdAt)}
        </p>
        <Link className="btn outline" href="/buyer/complaints">
          العودة للبلاغات
        </Link>
      </section>
    </>
  );
}
