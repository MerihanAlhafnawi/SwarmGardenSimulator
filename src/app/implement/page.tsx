import SwarmApplication from "@/components/SwarmApplication";

export default function ImplementPage() {
  return (
    <SwarmApplication
      mode="prompt"
      promptVariants={{
        legacy: "the color red flowing from right to left",
        current: "Buckle from left to right",
      }}
      promptVariantKey="implementOne"
      promptNextHref="/implement-two"
      promptSlot="provided-description-1"
      studyStep={5}
    />
  );
}
