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
        stimulus: "rainbow colors with robots blooming randomly",
        initialLevel: 11,
        nextHref: "/prepare",
        isFinalStep: true,
        demoKind: "rainbow-random-bloom",
      }}
    />
  );
}
