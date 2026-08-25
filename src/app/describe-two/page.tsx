"use client";

import { useEffect, useState } from "react";
import BehaviourDescriptionStep from "@/components/BehaviourDescriptionStep";
import { initializeStudyContextFromSearch } from "@/lib/study";

export default function DescribeTwoPage() {
  const [variant, setVariant] = useState<"legacy" | "current" | null>(null);

  useEffect(() => {
    setVariant(initializeStudyContextFromSearch(window.location.search).studyVariants?.describeTwo ?? "current");
  }, []);

  if (!variant) return null;

  const legacy = variant === "legacy";
  return (
    <BehaviourDescriptionStep
      config={{
        title: "Describe This Behaviour",
        helperText: "Please describe the Swarm Garden behaviour in your own words.",
        progressStep: 3,
        responseLabel: "Describe the behaviour",
        responseKey: "behaviour-2",
        stimulus: legacy
          ? "flowers start at 1, change from yellow to orange in two-column bands every second, then gradually bloom to 11 together"
          : "robots bloom to levels 1, 3, 5, 7, 9, and 11 in two-column bands, then all change color to green",
        initialLevel: 1,
        nextHref: "/describe-three",
        demoKind: legacy ? "yellow-orange-bloom" : "two-column-bloom-green",
      }}
    />
  );
}
