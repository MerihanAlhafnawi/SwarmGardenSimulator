import SwarmApplication from "@/components/SwarmApplication";

export default function ImplementPage() {
  return (
    <SwarmApplication
      mode="prompt"
      promptLabel="Behaviour 1"
      promptText="the color red flowing from right to left"
      promptNextHref="/implement-two"
      promptSlot="provided-description-1"
      studyStep={5}
    />
  );
}
