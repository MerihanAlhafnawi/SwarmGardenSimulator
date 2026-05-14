import BehaviourDescriptionStep from "@/components/BehaviourDescriptionStep";

export default function DescribeTwoPage() {
  return (
    <BehaviourDescriptionStep
      config={{
        title: "Describe This Behaviour",
        helperText: "Please describe this behaviour in your own words.",
        responseLabel: "Describe the behaviour",
        responseKey: "behaviour-2",
        stimulus:
          "flowers start at 1, change from yellow to orange in two-column bands every second, then gradually bloom to 11 together",
        initialLevel: 1,
        nextHref: "/describe-three",
        demoKind: "yellow-orange-bloom",
      }}
    />
  );
}
