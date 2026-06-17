import SwarmApplication from "@/components/SwarmApplication";

export default function ImplementTwoPage() {
  return (
    <SwarmApplication
      mode="prompt"
      promptLabel="Behaviour 2"
      promptText="a sun rising over a garden"
      promptSlot="provided-description-2"
      studyStep={5}
    />
  );
}
