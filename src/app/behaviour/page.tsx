import BehaviourDescriptionStep from "@/components/BehaviourDescriptionStep";

export default function BehaviourPage() {
  return (
    <BehaviourDescriptionStep
      config={{
        title: "Describe This Behaviour",
        helperText: "Please describe the Swarm Garden behaviour in your own words.",
        progressStep: 3,
        responseLabel: "Describe the behaviour",
        responseKey: "behaviour-1",
        stimulus: "bloom left-to-right with no color change",
        initialLevel: 1,
        nextHref: "/describe-two",
        demoKind: "bloom-left-to-right",
      }}
    />
  );
}
