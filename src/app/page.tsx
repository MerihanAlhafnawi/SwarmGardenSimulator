import Link from "next/link";

export default function HomePage() {
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
          <span>Instructional video placeholder</span>
        </div>

        <div className="intro-actions">
          <Link href="/application?tour=1" className="intro-next">
            Next
          </Link>
        </div>
      </section>
    </main>
  );
}
