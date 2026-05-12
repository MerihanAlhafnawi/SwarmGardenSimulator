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
          <p className="eyebrow">Princeton University</p>
          <h1>Adult Consent Poster</h1>
          <p className="intro-text">
            Please read this information before deciding whether to continue to the study.
          </p>
        </div>

        <div className="consent-card">
          <p><strong>Title of Research:</strong> Adapting distributed behavior for sustained human engagement with interactive robot swarms</p>
          <p>Princeton University IRB project# 18332.</p>

          <p><strong>Investigators:</strong></p>
          <p>Professor Radhika Nagpal, Principal Investigator</p>
          <p>Dr. Merihan Alhafnawi, Postdoctoral Researcher</p>

          <p><strong>Investigators&apos; Department:</strong> Mechanical and Aerospace Engineering</p>

          <h2>Key Information About the Study</h2>
          <p>Your informed consent is being sought for research. Participation in the research is voluntary.</p>
          <p>
            The purpose of the research is to understand what types of robot behaviors encourage people to stay engaged for longer periods. Specifically, we aim to investigate whether robot swarms can learn which behaviors are most engaging by observing people&apos;s visual cues, such as body position, proximity, or movement, during the interaction. To do so, we will use a machine learning method called contextual multi-armed bandits (CMAB). This algorithm allows a system to select between different behavior strategies based on the context, such as how the person is currently engaging with the robots, and learn over time which strategies work best. The robot swarm will try different predefined behaviors and observe how users respond, adapting its future choices to increase engagement.
          </p>
          <p>
            Participants may interact with the swarm for as short or as long as they wish (interaction time is indeterminate). Afterward, they will be invited to complete a brief survey, which takes approximately 5 minutes.
          </p>
          <p>
            <strong>Procedures:</strong> You will be invited to enter the restricted area (marked by colored tape on the floor), and can observe the robots as long or as short as you want. A camera will detect your proximity and position relative to the robots via an algorithm that identifies various body key points (such as shoulders and arms) to accurately detect and track human presence. After the interaction is done, we will approach you to ask you to take a short survey if you wish. Participation is completely voluntary.
          </p>
          <p>There are no reasonably foreseeable risks or discomforts to the subject as a result of participation.</p>
          <p>
            Our system is designed for future deployment in human-centered environments. Understanding how a robot swarm can sustain human engagement over time is critical for its long-term integration into such spaces. While prior work in human-swarm interaction has focused primarily on control, coordination, or interaction modalities, the use of machine learning, particularly for adaptively maintaining user engagement, remains largely unexplored. By investigating how adaptive behavior selection can extend interaction duration, this work offers valuable insights for swarm robotics researchers aiming to design more interactive, responsive, and socially integrated swarm systems.
          </p>

          <h2>Additional Information About the Study</h2>
          <p><strong>Confidentiality:</strong></p>
          <p>
            All records from the survey will be kept confidential, should you choose to fill it. Your responses in the survey will be kept private, and we will not include any information that will make it possible to identify you in any report or publication that uses quotes or analysis from the survey. Photos and videos will be taken for interaction analysis, for example, to study proximity, position, and engagement duration with the robots, and to document the experiment, which we may use for research dissemination. If you do not wish to be recorded, please let us know, and you will not be included on camera. If you choose this option, we will not proceed with the experiment.
          </p>
          <p>
            Research records will be stored securely in a locked cabinet and/or on university password-protected computers. The research team will be the only party that will have access to your data. We will destroy all data one year after collection.
          </p>

          <h2>Who to Contact With Questions</h2>
          <p>Professor Radhika Nagpal (rn1627@princeton.edu).</p>
          <p>Dr. Merihan Alhafnawi (m.alhafnawi@princeton.edu).</p>
          <p>
            If you have questions regarding your rights as a research subject, or if problems arise which you do not feel you can discuss with the Investigator, please contact the Institutional Review Board at:
          </p>
          <p>Phone: (609) 258-8543</p>
          <p>Email: irb@princeton.edu</p>

          <h2>Summary</h2>
          <ul className="consent-list">
            <li>My participation is voluntary.</li>
            <li>Refusal to participate will involve no penalty or loss of benefits to which I am otherwise entitled.</li>
            <li>I may discontinue participation at any time without penalty or loss of benefits.</li>
            <li>I do not waive any legal rights or release Princeton University or its agents from liability for negligence.</li>
            <li>I hereby give my consent to be the subject of the research.</li>
          </ul>

          <h2>Audio/Video Recordings</h2>
          <p>
            With your permission, we would also like to tape-record the interview. Please sign below if you agree to be photographed, and/or audio videotaped.
          </p>
          <p>I hereby give my consent for audio/video recording.</p>
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
