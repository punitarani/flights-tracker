import type { CSSProperties, PropsWithChildren } from "react";

type EmailLayoutProps = PropsWithChildren<{ previewText?: string }>;

const styles: Record<string, CSSProperties> = {
  body: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    padding: 0,
    backgroundColor: "#f4f6fb",
    color: "#0f172a",
  },
  hiddenPreview: {
    display: "none",
    maxHeight: 0,
    overflow: "hidden",
  },
  wrapper: {
    width: "100%",
    padding: "24px 0",
  },
  container: {
    maxWidth: "640px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 12px 36px rgba(15, 23, 42, 0.08)",
    overflow: "hidden",
  },
  footer: {
    padding: "24px 28px",
    fontSize: "13px",
    color: "#64748b",
    borderTop: "1px solid #e2e8f0",
  },
};

export function EmailLayout({ previewText, children }: EmailLayoutProps) {
  return (
    <html lang="en" style={{ width: "100%" }}>
      {/* biome-ignore lint/style/noHeadElement: Transactional email requires explicit head metadata */}
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Flight Alerts</title>
      </head>
      <body style={styles.body}>
        <div style={styles.hiddenPreview}>{previewText}</div>
        <div style={styles.wrapper}>
          <div style={styles.container}>
            {children}
            <div style={styles.footer}>
              You are receiving this update because you subscribed to flight
              alerts.
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
