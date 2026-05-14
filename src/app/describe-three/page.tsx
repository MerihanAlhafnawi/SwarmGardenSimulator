import BehaviourDescriptionStep from "@/components/BehaviourDescriptionStep";

const RAINBOW_COLORS = [
  "#ff4d4d",
  "#ff8a1f",
  "#ffd84d",
  "#4dcf6f",
  "#47b8ff",
  "#7161ff",
  "#d45bff",
  "#ff6ec7",
  "#ff4d4d",
  "#ff8a1f",
  "#ffd84d",
  "#4dcf6f",
];
const RANDOM_BLOOM_SEQUENCE = [
  { row: 0, col: 3, level: 4 },
  { row: 2, col: 9, level: 8 },
  { row: 1, col: 5, level: 2 },
  { row: 0, col: 10, level: 11 },
  { row: 2, col: 1, level: 6 },
  { row: 1, col: 8, level: 3 },
  { row: 0, col: 0, level: 9 },
  { row: 2, col: 6, level: 5 },
];

export default function DescribeThreePage() {
  return (
    <BehaviourDescriptionStep
      config={{
        title: "Describe This Behaviour",
        helperText: "Please describe this behaviour in your own words.",
        responseLabel: "Describe the behaviour",
        responseKey: "behaviour-3",
        stimulus: "rainbow colors with robots blooming randomly",
        initialLevel: 11,
        nextHref: "/prepare",
        isFinalStep: true,
        playDemo: ({ resetGrid, fadeCell, setCellLevel, schedule }) => {
          resetGrid();

          for (let col = 0; col < RAINBOW_COLORS.length; col += 1) {
            const targetColor = RAINBOW_COLORS[col];
            for (let row = 0; row < 3; row += 1) {
              schedule(() => fadeCell(row, col, targetColor), col * 220);
            }
          }

          RANDOM_BLOOM_SEQUENCE.forEach((entry, index) => {
            schedule(() => setCellLevel(entry.row, entry.col, entry.level), 2200 + index * 350);
          });
        },
      }}
    />
  );
}
