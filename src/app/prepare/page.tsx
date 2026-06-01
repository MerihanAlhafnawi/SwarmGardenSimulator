import Link from "next/link";
import { buildStudyHref } from "@/lib/study";

export default async function PreparePage({
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
    manualSessionStamp: typeof params.MANUAL_SESSION_STAMP === "string" ? params.MANUAL_SESSION_STAMP : "",
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
        <div className="plain-transition-copy">
          <p>Thank you. Please go through this short tutorial to learn how to use the simulator.</p>
          <div className="transition-actions">
            <Link
              href={buildStudyHref("/application", studyContext, { tour: "1" })}
              className="intro-next"
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
