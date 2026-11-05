import { AppShell } from "@/components/app-shell";
import { logoutAction } from "@/app/actions/auth";
import { ADMIN_NAV } from "@/lib/constants";
import { requireRole } from "@/lib/rbac";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["admin"]);
  return (
    <AppShell
      nav={ADMIN_NAV}
      roleLabel="حساب مسؤول"
      organizationName={session.organizationName}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
