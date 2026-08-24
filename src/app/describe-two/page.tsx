import BehaviourDescriptionStep from "@/components/BehaviourDescriptionStep";

export default function DescribeTwoPage() {
  return (
    <BehaviourDescriptionStep
      config={{
        title: "Describe This Behaviour",
        helperText: "Please describe the Swarm Garden behaviour in your own words.",
        progressStep: 3,
        responseLabel: "Describe the behaviour",
        responseKey: "behaviour-2",
        stimulus:
          "robots bloom to levels 1, 3, 5, 7, 9, and 11 in two-column bands, then all change color to green",
        initialLevel: 1,
        nextHref: "/describe-three",
        demoKind: "two-column-bloom-green",
      }}
    />
  );
}
