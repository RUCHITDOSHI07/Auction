import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) { return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>; }
export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "live" | "warning" | "success" | "blue" }) { return <span className={`status-badge ${tone}`}><i />{children}</span>; }
export function StatCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) { return <div className="stat-card" style={{ borderTopColor: accent }}><span className="stat-label">{label}</span><strong>{value}</strong><span className="stat-detail">{detail}</span></div>; }
export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) { return <div className="section-heading"><h2>{title}</h2>{action}</div>; }
