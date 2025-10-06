import { ImageResponse } from "next/og";
import { OG_IMAGE_SIZE, OgCard } from "@/lib/og/card";

export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function DefaultOpenGraphImage() {
  return new ImageResponse(
    <OgCard
      badge="Fli by Graypane"
      title="Stay ahead of airfare changes"
      subtitle="Monitor fare trends, explore airports worldwide, and set price alerts in one streamlined dashboard."
      footer="Real-time flight intelligence"
    />,
    {
      ...size,
    },
  );
}
