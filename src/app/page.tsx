import Link from "next/link";
import { buildStudyHref } from "@/lib/study";

export default async function HomePage({
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

  const agreeHref = buildStudyHref("/intro", studyContext);

  return (
    <main className="page-shell consent-shell">
      <section className="hero consent-hero">
        <div className="consent-copy">
          <p className="eyebrow">PRINCETON UNIVERSITY</p>
          <h1>Consent form</h1>
        </div>

        <div className="consent-card">
          <p><strong>TITLE OF RESEARCH:</strong></p>
          <p>Co-designing robot swarm behaviors with Swarm Garden</p>
          <p>Princeton University IRB project #19319</p>

          <p><strong>INVESTIGATORS:</strong></p>
          <p>Prof. Radhika Nagpal               Principal Investigator</p>
          <p>Dr. Merihan Alhafnawi            Postdoctoral Researcher</p>

          <p><strong>INVESTIGATORS’ DEPARTMENT:</strong></p>
          <p>Mechanical and Aerospace Engineering</p>

          <p><strong>Key information about the study:</strong></p>
          <p>Your informed consent is being sought for research. Participation in the research is voluntary.</p>
          <p>Robot swarms consist of multiple robots that collaborate to accomplish shared tasks. While numerous applications of robot swarms have been explored (such as planetary exploration, environmental monitoring, and warehouse automation), interactive applications in which humans engage with swarms within everyday living spaces remain underexplored.</p>
          <p>In this study, we use a robotic swarm platform we developed, called Swarm Garden, to investigate how future users might interact with such systems. Specifically, we explore how users can design and interpret swarm behaviors. One intuitive and natural mode of interaction with robotic systems is through language. Therefore, we will ask you to view a simulation of the swarm and describe, in written language, the behavior you observe. You will then be invited to design your own swarm behaviors using the simulator by modifying system parameters, such as LED colors and blooming levels, and provide written descriptions of the behaviors you design. Finally, we will ask you to provide feedback on your experience using the simulator.</p>
          <p>No identifying information will be collected, and you will not be audio- or video-recorded. The expected duration of participation is 30 minutes. Upon full completion of the study, you will be compensated $10 for your time and effort.</p>
          <p>The are no reasonably foreseeable risks or discomforts to you as a result of participation.</p>
          <p>Robots will soon be ubiquitous in our everyday lives, and robot swarms are no exception. Learning how users wish to interact and how they perceive the system becomes crucial to deploy user-centered, intuitive, and beneficial systems. Having users in the center of the design process is therefore important to create better systems.</p>

          <p><strong>Additional information about the study:</strong></p>
          <p><strong>Confidentiality:</strong></p>
          <p>Your responses will be kept private. We are not collecting any identifying information. Anonymous data from the experiment (such as the description of the swarm behaviors) may be shared and made publicly available in an online database. No identifying information will be included.</p>
          <p>De-identified excerpts (e.g., quotations from the survey) may also be used in research outputs such as publications, presentations, and for training research models. Because de-identified data cannot be linked back to you, it may not be possible to remove your data after it has been de-identified and shared or included in analyses. Should you choose to withdraw from the study at any time before completion, you may do so without penalty. However, compensation is only provided upon full completion of the study. If you withdraw early, your data will not be retained or used, and you will not receive compensation. All research records will be stored securely on password-protected systems, and only authorized members of the research team will have access to identifiable data.</p>

          <p><strong>Who to contact with questions:</strong></p>
          <p>Professor Radhika Nagpal (rn1627@princeton.edu).</p>
          <p>Dr. Merihan Alhafnawi (m.alhafnawi@princeton.edu).</p>

          <p>If you have questions regarding your rights as a research subject, or if problems arise which you do not feel you can discuss with the Investigator, please contact the Institutional Review Board at:</p>
          <p>Phone: (609) 258-8543     Email: irb@princeton.edu</p>

          <p><strong>Summary:</strong></p>
          <p>I understand the information that was presented and that:</p>
          <ul className="consent-list">
            <li>My participation is voluntary.</li>
            <li>Refusal to participate will involve no penalty.</li>
            <li>I may discontinue participation at any time without penalty or loss of benefits.</li>
            <li>I do not waive any legal rights or release Princeton University or its agents from liability for negligence.</li>
            <li>Compensation will only be provided upon full completion of the study. If I choose to withdraw before completing the study, I will not receive compensation.</li>
            <li>I hereby give my consent to be the subject of the research.</li>
          </ul>

        </div>

        <div className="consent-actions">
          <Link href={agreeHref} className="intro-next">
            I Agree
          </Link>
          <Link href="/declined" className="decline-link">
            I Do Not Agree
          </Link>
        </div>
      </section>
    </main>
  );
}
