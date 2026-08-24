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
        stimulus: "bloom in different patterns, then change to random colors",
        initialLevel: 1,
        nextHref: "/prepare",
        isFinalStep: true,
        demoKind: "bloom-patterns-random-color",
      }}
    />
  );
}
