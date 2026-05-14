import BehaviourDescriptionStep from "@/components/BehaviourDescriptionStep";

const WARM_COLORS = ["#fff1a8", "#ffe16e", "#ffd04a", "#ffbe2f", "#f5aa14", "#e58900"];
const WARM_BAND_DELAY = 1000;
const BLOOM_STEP_DELAY = 180;
const COLS = 12;

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
        playDemo: ({ resetGrid, fadeCell, setAllLevels, schedule }) => {
          resetGrid();
          const bandCount = Math.ceil(COLS / 2);

          for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
            const targetColor = WARM_COLORS[bandIndex % WARM_COLORS.length];
            const startCol = bandIndex * 2;
            const delay = bandIndex * WARM_BAND_DELAY;

            for (let row = 0; row < 3; row += 1) {
              for (let col = startCol; col < Math.min(startCol + 2, COLS); col += 1) {
                schedule(() => fadeCell(row, col, targetColor), delay);
              }
            }
          }

          const bloomStartDelay = bandCount * WARM_BAND_DELAY;
          for (let level = 1; level <= 11; level += 1) {
            schedule(() => setAllLevels(level), bloomStartDelay + (level - 1) * BLOOM_STEP_DELAY);
          }
        },
      }}
    />
  );
}
