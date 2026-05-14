import SwarmApplication from "@/components/SwarmApplication";

export default function ImplementTwoPage() {
  return (
    <SwarmApplication
      mode="prompt"
      promptText="a sun rising over a garden"
      promptSlot="provided-description-2"
    />
  );
}
