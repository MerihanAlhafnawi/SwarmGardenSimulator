import SwarmApplication from "@/components/SwarmApplication";

export default function ImplementTwoPage() {
  return (
    <SwarmApplication
      mode="prompt"
      promptVariants={{
        legacy: "Fireworks lighting up the sky",
        current: "Sun rising over the garden",
      }}
      promptVariantKey="implementTwo"
      promptSlot="provided-description-2"
      studyStep={5}
    />
  );
}
