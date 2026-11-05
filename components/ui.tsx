import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  statusEntry,
  type StatusKind,
  type StatusTone,
} from "@/lib/status-labels";

const CSS_TONES = new Set<StatusTone>(["blue", "gold", "green", "purple"]);

const INLINE_TONES: Partial<Record<StatusTone, CSSProperties>> = {
  red: { color: "#f0a8a8", background: "rgba(168,56,56,.22)" },
  gray: { color: "#9aa3ad", background: "rgba(154,163,173,.14)" },
};

export function BrandWatermark() {
  return (
    <div className="brand-watermark" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/safqa-logo.png" alt="" width={906} height={280} />
    </div>
  );
}

export function Mark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="mark" aria-label="صفقة">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/safqa-logo.png"
        alt="صفقة"
        className="mark-logo"
        width={168}
        height={52}
      />
      <span className="mark-en">SAFQA</span>
    </Link>
  );
}

export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  const className = CSS_TONES.has(tone) ? `badge ${tone}` : "badge";
  return (
    <span className={className} style={INLINE_TONES[tone]}>
      {children}
    </span>
  );
}

export function StatusPill({
  kind,
  value,
}: {
  kind: StatusKind;
  value: string | null | undefined;
}) {
  const entry = statusEntry(kind, value);
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: ReactNode;
  action?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ?? action}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className ? `panel ${className}` : "panel"}>
      {title ? (
        <div className="panel-title">
          <div>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
  actionHref,
  actionLabel,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section
      className="panel"
      style={{ textAlign: "center", padding: "44px 24px" }}
    >
      <h3 style={{ margin: "0 0 6px", color: "var(--deep)" }}>{title}</h3>
      {description ? (
        <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: 13.5 }}>
          {description}
        </p>
      ) : null}
      {action}
      {!action && actionHref && actionLabel ? (
        <Link className="btn primary" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </section>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="stat-grid">{children}</div>;
}

export function StatCard({
  value,
  label,
  icon,
  accent = 0,
  tone,
  hint,
  href,
}: {
  value: string | number;
  label: string;
  icon?: ReactNode;
  accent?: 0 | 1 | 2 | 3;
  tone?: number;
  hint?: string;
  href?: string;
}) {
  const accentTone = (tone ?? accent) % 4;
  const body = (
    <>
      {icon ? (
        <span className={`stat-icon s${accentTone}`} aria-hidden>
          {icon}
        </span>
      ) : (
        <span className={`stat-icon s${accentTone}`} aria-hidden>
          {["▤", "◇", "◎", "▥"][accentTone]}
        </span>
      )}
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
      {href ? <small aria-hidden>عرض</small> : hint ? <small>{hint}</small> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="stat-card-link"
        aria-label={`${label}: ${value}. الانتقال إلى الصفحة`}
      >
        {body}
      </Link>
    );
  }

  return <article aria-label={`${label}: ${value}`}>{body}</article>;
}

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  width?: number | string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowClassName,
  caption,
  footer,
  emptyMessage = "لا توجد سجلات لعرضها.",
  headers,
  children,
}: {
  columns?: Column<T>[];
  rows?: T[];
  rowKey?: (row: T, index: number) => string;
  rowClassName?: (row: T) => string | undefined;
  caption?: ReactNode;
  footer?: ReactNode;
  emptyMessage?: string;
  /** Simple header+children mode used by route pages */
  headers?: string[];
  children?: ReactNode;
}) {
  if (headers) {
    return (
      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      </section>
    );
  }

  const cols = columns ?? [];
  const data = rows ?? [];

  return (
    <section className="panel table-panel">
      <div className="table-wrap">
        <table>
          {caption ? (
            <caption
              style={{
                captionSide: "top",
                textAlign: "right",
                padding: "14px 15px",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--deep)",
              }}
            >
              {caption}
            </caption>
          ) : null}
          <thead>
            <tr>
              {cols.map((column) => (
                <th key={column.key} style={{ width: column.width }}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={cols.length}
                  style={{
                    textAlign: "center",
                    color: "var(--muted)",
                    padding: "28px 12px",
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={rowKey?.(row, index) ?? String(index)}
                  className={rowClassName?.(row)}
                >
                  {cols.map((column) => (
                    <td key={column.key}>{column.cell(row)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="weights">{footer}</div> : null}
    </section>
  );
}

export function SoonButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn outline" disabled title="قريبًا">
      {label} · قريبًا
    </button>
  );
}
