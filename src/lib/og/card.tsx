import type { ReactNode } from "react";

export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630,
};

type OgCardProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  footer?: string;
  children?: ReactNode;
};

export function OgCard({
  title,
  subtitle,
  badge,
  footer,
  children,
}: OgCardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "64px",
        color: "white",
        background:
          "radial-gradient(circle at 20% 20%, #38bdf8, #0f172a 55%, #020617)",
        fontFamily:
          "'Geist', 'Inter', 'SF Pro Display', 'Segoe UI', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {badge ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: 24,
            fontWeight: 600,
            padding: "10px 18px",
            borderRadius: 999,
            background: "rgba(15, 23, 42, 0.35)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            maxWidth: "70%",
          }}
        >
          <span role="img" aria-label="flight">
            ✈️
          </span>
          <span>{badge}</span>
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.2,
            marginTop: badge ? 36 : 0,
            maxWidth: "85%",
            textShadow: "0 18px 40px rgba(15, 23, 42, 0.65)",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 24,
              fontSize: 30,
              color: "rgba(226, 232, 240, 0.85)",
              maxWidth: "70%",
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        ) : null}
        {children}
      </div>

      {footer ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 28,
            color: "rgba(226, 232, 240, 0.8)",
          }}
        >
          <div>graypane.com</div>
          <div>{footer}</div>
        </div>
      ) : (
        <div
          style={{
            fontSize: 28,
            color: "rgba(226, 232, 240, 0.8)",
          }}
        >
          graypane.com
        </div>
      )}
    </div>
  );
}
