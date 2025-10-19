type BadgeRowProps = {
  items: Array<{ label: string; key?: string }>;
};

export function BadgeRow({ items }: BadgeRowProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
      {items.map((item, index) => (
        <span
          key={item.key ?? `${item.label}-${index}`}
          style={{
            display: "inline-block",
            padding: "4px 10px",
            fontSize: "12px",
            borderRadius: "9999px",
            background: "#eef2ff",
            color: "#4338ca",
            letterSpacing: "0.02em",
          }}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
