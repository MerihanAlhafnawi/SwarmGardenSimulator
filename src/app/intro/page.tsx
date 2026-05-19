import { buildStudyHref } from "@/lib/study";
import IntroGate from "@/components/IntroGate";

export default async function IntroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const nextHref = buildStudyHref(
    "/describe",
    {
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
    },
  );

  return (
    <main className="page-shell intro-shell">
      <section className="hero intro-hero">
        <div className="intro-copy">
          <h1>Swarm Garden Simulator</h1>
          <p className="intro-text">
            Watch the instructions first, then continue to the study.
          </p>
        </div>

        <IntroGate nextHref={nextHref} />
      </section>
    </main>
  );
}
