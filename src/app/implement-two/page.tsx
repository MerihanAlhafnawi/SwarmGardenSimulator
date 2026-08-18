import SwarmApplication from "@/components/SwarmApplication";

export default function ImplementTwoPage() {
  return (
    <SwarmApplication
      mode="prompt"
      promptText="Fireworks lighting up the sky"
      promptSlot="provided-description-2"
      studyStep={5}
    />
  );
}
