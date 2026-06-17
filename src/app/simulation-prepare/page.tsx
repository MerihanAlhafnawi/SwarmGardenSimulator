import Link from "next/link";
import StudyStepProgress from "@/components/StudyStepProgress";
import { buildStudyHref } from "@/lib/study";

export default async function SimulationPreparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const studyContext = {
    prolificPid: typeof params.PROLIFIC_PID === "string" ? params.PROLIFIC_PID : "",
    studyId: typeof params.STUDY_ID === "string" ? params.STUDY_ID : "",
    sessionId: typeof params.SESSION_ID === "string" ? params.SESSION_ID : "",
    manualParticipantId: typeof params.PARTICIPANT_ID === "string" ? params.PARTICIPANT_ID : "",
    manualSessionStamp:
      typeof params.MANUAL_SESSION_STAMP === "string" ? params.MANUAL_SESSION_STAMP : "",
    studyRunId: typeof params.STUDY_RUN_ID === "string" ? params.STUDY_RUN_ID : "",
    source:
      typeof params.PROLIFIC_PID === "string" && params.PROLIFIC_PID
        ? "prolific"
        : typeof params.PARTICIPANT_ID === "string" && params.PARTICIPANT_ID
          ? "manual"
          : "unknown",
  } as const;

  return (
    <main className="page-shell consent-shell">
      <section className="hero consent-hero">
        <div className="study-header-row">
          <StudyStepProgress currentStep={6} totalSteps={7} />
        </div>
        <div className="plain-transition-copy">
          <p>Thank you. Next, please create and describe 2 behaviours of your own.</p>
          <div className="transition-actions">
            <Link href={buildStudyHref("/simulation", studyContext)} className="intro-next">
              Next
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
