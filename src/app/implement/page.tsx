import SwarmApplication from "@/components/SwarmApplication";

export default function ImplementPage() {
  return (
    <SwarmApplication
      mode="prompt"
      promptText="Bloom from left to right"
      promptNextHref="/implement-two"
      promptSlot="provided-description-1"
      studyStep={5}
    />
  );
}
