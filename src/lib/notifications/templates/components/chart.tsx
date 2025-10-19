type ChartPoint = {
  label: string;
  value: number;
};

type ChartProps = {
  title: string;
  summary: string;
  unit?: "usd" | "minutes" | "percent" | "count";
  chartType: "sparkline" | "bar";
  data: ChartPoint[];
};

const unitFormatter: Record<
  NonNullable<ChartProps["unit"]>,
  (value: number) => string
> = {
  usd: (value) => `${value.toFixed(0)} USD`,
  minutes: (value) => `${value.toFixed(0)} min`,
  percent: (value) => `${value.toFixed(1)}%`,
  count: (value) => `${value.toFixed(0)}`,
};

function formatValue(value: number, unit?: ChartProps["unit"]) {
  if (!unit) return value.toFixed(0);
  return unitFormatter[unit](value);
}

export function ChartBlock({
  title,
  summary,
  unit,
  chartType,
  data,
}: ChartProps) {
  const maxValue = Math.max(...data.map((point) => point.value));
  const minValue = Math.min(...data.map((point) => point.value));

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "20px",
        background: "#f8fafc",
      }}
    >
      <h3 style={{ margin: "0 0 8px", fontSize: "16px", color: "#0f172a" }}>
        {title}
      </h3>
      <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#475569" }}>
        {summary}
      </p>
      <table
        role="presentation"
        style={{ width: "100%", borderCollapse: "collapse" }}
      >
        <tbody>
          {data.map((point) => {
            const percentage =
              maxValue === minValue
                ? 100
                : ((point.value - minValue) / (maxValue - minValue)) * 100;

            return (
              <tr key={point.label}>
                <td
                  style={{
                    padding: "6px 8px",
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  {point.label}
                </td>
                <td style={{ width: "60%", padding: "6px 8px" }}>
                  <div
                    style={{
                      height: "8px",
                      borderRadius: "9999px",
                      background: "#e2e8f0",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(6, percentage)}%`,
                        background:
                          chartType === "sparkline" ? "#60a5fa" : "#818cf8",
                        height: "100%",
                      }}
                    />
                  </div>
                </td>
                <td
                  style={{
                    padding: "6px 0",
                    fontSize: "12px",
                    color: "#0f172a",
                    textAlign: "right",
                  }}
                >
                  {formatValue(point.value, unit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
