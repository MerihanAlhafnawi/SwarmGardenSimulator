import Link from "next/link";
import { buildStudyHref } from "@/lib/study";

export default async function IntroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const nextHref = buildStudyHref(
    "/application",
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
    { tour: "1" },
  );

  return (
    <main className="page-shell intro-shell">
      <section className="hero intro-hero">
        <div className="intro-copy">
          <h1>Swarm Garden Simulator</h1>
          <p className="intro-text">
            Watch the instructions first, then continue into the application.
          </p>
        </div>

        <div className="video-placeholder">
          <video className="intro-video" controls playsInline preload="metadata">
            <source src="/intro_video.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>

        <div className="intro-actions">
          <Link href={nextHref} className="intro-next">
            Next
          </Link>
        </div>
      </section>
    </main>
  );
}
