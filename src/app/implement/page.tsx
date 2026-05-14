import SwarmApplication from "@/components/SwarmApplication";

export default function ImplementPage() {
  return (
    <SwarmApplication
      mode="prompt"
      promptText="the color red flowing from right to left"
      promptNextHref="/implement-two"
    />
  );
}
