import { ImageResponse } from "next/og";
import { OG_IMAGE_SIZE, OgCard } from "@/lib/og/card";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function DefaultOpenGraphImage() {
  return new ImageResponse(
    <OgCard
      badge="Graypane"
      title="Flight Search & Alerts"
      subtitle="Monitor flight prices, explore fare history, and stay ahead with personalized alerts."
      footer="Real-time flight intelligence"
    />,
    {
      ...size,
    },
  );
}
