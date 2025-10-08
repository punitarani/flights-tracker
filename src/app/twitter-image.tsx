import { ImageResponse } from "next/og";
import { OG_IMAGE_SIZE, OgCard } from "@/lib/og/card";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    <OgCard
      badge="Graypane"
      title="Flight Search & Alerts"
      subtitle="Track fare trends and manage flight alerts with the GrayPane dashboard on graypane.com."
      footer="Real-time flight intelligence"
    />,
    {
      ...size,
    },
  );
}
