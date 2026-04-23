import Link from "next/link";

const tutorialSections = [
  {
    title: "Color controls",
    description:
      "Pick a color, then apply it to selected robots, all robots, or send it through the swarm as a moving color flow.",
    items: ["Choose a color with the picker.", "Use Color Selected or Color All.", "Use the three flow buttons to animate color across the grid."],
  },
  {
    title: "Selection",
    description:
      "Click any robot to select it. Selected robots are the ones affected by targeted color and buckle changes.",
    items: ["Click a robot to select or unselect it.", "Use Deselect All to clear the current selection."],
  },
  {
    title: "Buckle controls",
    description:
      "Use the slider to change buckle level, or trigger directional buckle flows for the full swarm.",
    items: ["Move the slider to set the buckle level.", "Use Buckle L→R, Buckle R→L, or Buckle Center → Out for animated flows.", "Use Stop Flow if you want to interrupt a running animation."],
  },
  {
    title: "Recording",
    description:
      "Record captures the actions you perform. When you stop, the app reminds you to save the behaviour.",
    items: ["Press Record to begin capturing actions.", "Press Stop Recording when you are done.", "Press Save Recording to store the behaviour once you have written a description."],
  },
  {
    title: "Reset and saved behaviours",
    description:
      "Reset restores the default swarm state, while the recorded behaviours section lets you replay, download, or delete saved items.",
    items: ["Reset returns all robots to white and buckle level 11.", "Recorded behaviours shows what you saved in the current session.", "Delete removes a saved behaviour permanently from the database."],
  },
];

export default function TutorialPage() {
  return (
    <main className="page-shell">
      <section className="hero tutorial-hero">
        <div className="tutorial-header">
          <h1>Quick Tutorial</h1>
          <p className="intro-text">
            This page gives a fast overview of what each control does before you start using the
            simulator.
          </p>
        </div>

        <div className="tutorial-grid">
          {tutorialSections.map((section) => (
            <article key={section.title} className="tutorial-card">
              <h2>{section.title}</h2>
              <p>{section.description}</p>
              <ul className="tutorial-list">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="intro-actions">
          <Link href="/" className="intro-next ghost-link">
            Back
          </Link>
          <Link href="/application" className="intro-next">
            Open Application
          </Link>
        </div>
      </section>
    </main>
  );
}
