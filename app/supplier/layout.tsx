import { AppShell } from "@/components/app-shell";
import { logoutAction } from "@/app/actions/auth";
import { SUPPLIER_NAV } from "@/lib/constants";
import { requireRole } from "@/lib/rbac";

export default async function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["supplier"]);
  return (
    <AppShell
      nav={SUPPLIER_NAV}
      roleLabel="حساب مورد"
      organizationName={session.organizationName}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
