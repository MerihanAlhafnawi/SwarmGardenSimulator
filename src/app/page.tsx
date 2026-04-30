import Link from "next/link";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextParams = new URLSearchParams();
  nextParams.set("tour", "1");

  for (const key of ["PROLIFIC_PID", "STUDY_ID", "SESSION_ID", "PARTICIPANT_ID"]) {
    const value = params[key];
    if (typeof value === "string" && value) {
      nextParams.set(key, value);
    }
  }

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
          <Link href={`/application?${nextParams.toString()}`} className="intro-next">
            Next
          </Link>
        </div>
      </section>
    </main>
  );
}
