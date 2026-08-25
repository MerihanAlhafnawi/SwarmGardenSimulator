"use client";

import { useEffect, useState } from "react";
import BehaviourDescriptionStep from "@/components/BehaviourDescriptionStep";
import { initializeStudyContextFromSearch } from "@/lib/study";

export default function DescribeThreePage() {
  const [variant, setVariant] = useState<"legacy" | "current" | null>(null);

  useEffect(() => {
    setVariant(initializeStudyContextFromSearch(window.location.search).studyVariants?.describeThree ?? "current");
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
        responseKey: "behaviour-3",
        stimulus: legacy
          ? "rainbow colors with robots blooming randomly"
          : "two-column bands buckle to different levels, then single robots gain permanent random colors every 0.5 seconds",
        initialLevel: legacy ? 11 : 1,
        nextHref: "/prepare",
        isFinalStep: true,
        demoKind: legacy ? "rainbow-random-bloom" : "bloom-patterns-random-color",
      }}
    />
  );
}
