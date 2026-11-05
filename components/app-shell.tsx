"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandWatermark, Mark } from "@/components/ui";

export type NavItem = { href: string; label: string };

export function AppShell({
  roleLabel,
  organizationName,
  userName,
  nav,
  title,
  headerAction,
  logoutAction,
  logoutSlot,
  children,
}: {
  roleLabel: string;
  organizationName: string;
  userName?: string;
  nav: readonly NavItem[];
  title?: string;
  headerAction?: ReactNode;
  logoutAction?: () => Promise<void>;
  logoutSlot?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const initial = organizationName.trim().slice(0, 1) || "ص";
  const [navOpen, setNavOpen] = useState(false);

  const activeHref = useMemo(() => {
    let best: string | null = null;
    for (const item of nav) {
      const matches =
        pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (matches && (best === null || item.href.length > best.length)) {
        best = item.href;
      }
    }
    return best;
  }, [nav, pathname]);

  const headerTitle =
    nav.find((item) => item.href === activeHref)?.label ?? title ?? "صفقة";

  return (
    <div className="app-shell">
      <BrandWatermark />
      {navOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="إغلاق القائمة"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <aside className={navOpen ? "sidebar is-open" : "sidebar"} id="app-sidebar">
        <Mark href="/" />
        <div className="role-chip">
          <span aria-hidden>{initial}</span>
          <div>
            <small>{roleLabel}</small>
            <strong>{organizationName}</strong>
          </div>
        </div>
        <nav aria-label="القائمة الجانبية">
          {nav.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={active ? "nav-link active" : "nav-link"}
                onClick={() => setNavOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {logoutSlot}
        {!logoutSlot && logoutAction ? (
          <form action={logoutAction}>
            <button type="submit" className="back-public" style={{ width: "100%" }}>
              تسجيل الخروج
            </button>
          </form>
        ) : null}
      </aside>
      <section className="app-main">
        <header className="app-header">
          <div className="header-lead">
            <button
              type="button"
              className="mobile-nav-toggle"
              aria-expanded={navOpen}
              aria-controls="app-sidebar"
              onClick={() => setNavOpen((open) => !open)}
            >
              القائمة
            </button>
            <div>
              <p className="live-pulse" aria-hidden>
                <span className="live-dot" />
                مباشر
              </p>
              <h1>{headerTitle}</h1>
            </div>
          </div>
          <div className="header-tools">
            {headerAction}
            <span className="account-label">
              {userName ? userName : organizationName}
            </span>
          </div>
        </header>
        <div className="content">{children}</div>
      </section>
    </div>
  );
}
