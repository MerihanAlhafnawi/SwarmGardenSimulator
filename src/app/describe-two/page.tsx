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
          "change from 0 to 11 in two-column bands every second, then all change color to green",
        initialLevel: 1,
        nextHref: "/describe-three",
        demoKind: "two-column-bloom-green",
      }}
    />
  );
}
