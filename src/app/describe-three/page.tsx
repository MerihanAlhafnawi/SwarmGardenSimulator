import BehaviourDescriptionStep from "@/components/BehaviourDescriptionStep";

export default function DescribeThreePage() {
  return (
    <BehaviourDescriptionStep
      config={{
        title: "Describe This Behaviour",
        helperText: "Please describe the Swarm Garden behaviour in your own words.",
        progressStep: 3,
        responseLabel: "Describe the behaviour",
        responseKey: "behaviour-3",
        stimulus:
          "two-column bands bloom to different levels, then single robots gain random colors one at a time",
        initialLevel: 1,
        nextHref: "/prepare",
        isFinalStep: true,
        demoKind: "bloom-patterns-random-color",
      }}
    />
  );
}
