import { AppShell } from "@/components/app-shell";
import { logoutAction } from "@/app/actions/auth";
import { BUYER_NAV } from "@/lib/constants";
import { requireRole } from "@/lib/rbac";

export default async function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["buyer"]);
  return (
    <AppShell
      nav={BUYER_NAV}
      roleLabel="حساب مشتري"
      organizationName={session.organizationName}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
