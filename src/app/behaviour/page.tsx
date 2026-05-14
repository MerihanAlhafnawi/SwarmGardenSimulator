import BehaviourDescriptionStep from "@/components/BehaviourDescriptionStep";

const BLUE_COLOR = "#007fff";

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
        playDemo: ({ resetGrid, fadeCell, schedule }) => {
          resetGrid();
          let index = 0;

          for (let col = 0; col < 12; col += 1) {
            for (let row = 0; row < 3; row += 1) {
              schedule(() => fadeCell(row, col, BLUE_COLOR), index * 120);
              index += 1;
            }
          }
        },
      }}
    />
  );
}
