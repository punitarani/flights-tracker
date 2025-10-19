import type { PropsWithChildren } from "react";

type SectionProps = PropsWithChildren<{
  title?: string;
  description?: string;
}>;

export function EmailSection({ title, description, children }: SectionProps) {
  return (
    <section style={{ padding: "28px", borderBottom: "1px solid #e2e8f0" }}>
      {title ? (
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: "18px",
            fontWeight: 600,
            color: "#0f172a",
          }}
        >
          {title}
        </h2>
      ) : null}
      {description ? (
        <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#64748b" }}>
          {description}
        </p>
      ) : null}
      <div style={{ display: "grid", gap: "16px" }}>{children}</div>
    </section>
  );
}
