export default function StudyStepProgress({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="study-progress" aria-label={`Study step ${currentStep} of ${totalSteps}`}>
      <span className="study-progress-caption">
        Step {currentStep} of {totalSteps}
      </span>
      <div className="playback-timeline study-progress-timeline">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === currentStep;
          const isComplete = stepNumber < currentStep;

          return (
            <div
              key={stepNumber}
              className={`timeline-step ${isCurrent ? "current" : ""} ${isComplete ? "complete" : ""}`}
            >
              <span className="timeline-dot" />
              {stepNumber < totalSteps ? <span className="timeline-line" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
