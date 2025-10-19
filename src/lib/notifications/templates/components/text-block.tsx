type TextBlockProps = {
  headline?: string;
  body: string;
};

export function TextBlock({ headline, body }: TextBlockProps) {
  return (
    <div>
      {headline ? (
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: "16px",
            fontWeight: 600,
            color: "#0f172a",
          }}
        >
          {headline}
        </h3>
      ) : null}
      <p
        style={{
          margin: 0,
          fontSize: "14px",
          lineHeight: 1.6,
          color: "#475569",
        }}
      >
        {body}
      </p>
    </div>
  );
}
