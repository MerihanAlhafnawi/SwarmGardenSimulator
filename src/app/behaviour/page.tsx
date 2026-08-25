"use client";

import { useEffect, useState } from "react";
import BehaviourDescriptionStep from "@/components/BehaviourDescriptionStep";
import { initializeStudyContextFromSearch } from "@/lib/study";

export default function BehaviourPage() {
  const [variant, setVariant] = useState<"legacy" | "current" | null>(null);

  useEffect(() => {
    setVariant(initializeStudyContextFromSearch(window.location.search).studyVariants?.describeOne ?? "current");
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
        responseKey: "behaviour-1",
        stimulus: legacy ? "color left-to-right blue" : "bloom left-to-right with no color change",
        initialLevel: legacy ? 11 : 1,
        nextHref: "/describe-two",
        demoKind: legacy ? "blue-left-to-right" : "bloom-left-to-right",
      }}
    />
  );
}
