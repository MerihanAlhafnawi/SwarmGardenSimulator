import BehaviourDescriptionStep from "@/components/BehaviourDescriptionStep";

export default function BehaviourPage() {
  return (
    <BehaviourDescriptionStep
      config={{
        title: "Describe This Behaviour",
        helperText: "Please describe this behaviour in your own words.",
        responseLabel: "Describe the behaviour",
        responseKey: "behaviour-1",
        stimulus: "color left-to-right blue",
        initialLevel: 11,
        nextHref: "/describe-two",
        demoKind: "blue-left-to-right",
      }}
    />
  );
}
