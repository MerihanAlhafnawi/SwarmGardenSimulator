import SwarmApplication from "@/components/SwarmApplication";

export default function ImplementTwoPage() {
  return (
    <SwarmApplication
      mode="prompt"
      promptText="Sun rising over the garden"
      promptSlot="provided-description-2"
      studyStep={5}
    />
  );
}
