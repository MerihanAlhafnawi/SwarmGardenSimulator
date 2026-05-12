"use client";

import { useEffect, useState } from "react";
import {
  getStoredStudyContext,
  hasRequiredStudyContext,
  initializeStudyContextFromSearch,
  saveStudyStep,
  storeStudyContext,
  type StudyContext,
} from "@/lib/study";

const familiarityOptions = [
  "Very unfamiliar",
  "Unfamiliar",
  "Neutral",
  "Familiar",
  "Very familiar",
] as const;

const genderOptions = [
  "Male",
  "Female",
  "Non-binary",
  "Other",
  "Prefer not to say",
] as const;

export default function SurveyPage() {
  const [studyContext, setStudyContext] = useState<StudyContext>(getStoredStudyContext);
  const [familiarity, setFamiliarity] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [confusingAspects, setConfusingAspects] = useState("");
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setStudyContext(initializeStudyContextFromSearch(window.location.search));
  }, []);

  const handleSubmit = async () => {
    if (!hasRequiredStudyContext(studyContext)) {
      setMessage("Please enter a participant ID to continue.");
      return;
    }

    if (!familiarity || !age.trim() || !gender) {
      setMessage("Please complete the required survey questions.");
      return;
    }

    try {
      await saveStudyStep({
        studyContext,
        step: "post-study-survey",
        data: {
          familiarity,
          age: age.trim(),
          gender,
          confusingAspects: confusingAspects.trim(),
          feedback: feedback.trim(),
        },
      });
      setSubmitted(true);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your survey.");
    }
  };

  return (
    <main className="page-shell consent-shell">
      <section className="hero consent-hero">
        <div className="consent-copy">
          <h1>Post-study survey</h1>
          <p className="intro-text">Please answer the following questions before finishing the study.</p>
        </div>

        <section className="controls-card survey-card">
          {studyContext.source === "prolific" ? (
            <p className="study-source-badge">Prolific participant ID connected</p>
          ) : (
            <label className="field participant-field">
              <span>Participant ID</span>
              <input
                value={studyContext.manualParticipantId}
                onChange={(event) => {
                  const nextContext: StudyContext = {
                    ...studyContext,
                    source: "manual",
                    manualParticipantId: event.target.value,
                  };
                  setStudyContext(nextContext);
                  storeStudyContext(nextContext);
                }}
                placeholder="Type here"
              />
            </label>
          )}

          <div className="survey-question">
            <p>How familiar are you with robots?</p>
            <div className="survey-options">
              {familiarityOptions.map((option) => (
                <label key={option} className="survey-option">
                  <input
                    type="radio"
                    name="familiarity"
                    value={option}
                    checked={familiarity === option}
                    onChange={(event) => setFamiliarity(event.target.value)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="field">
            <span>Please provide your age.</span>
            <input value={age} onChange={(event) => setAge(event.target.value)} placeholder="Type here" />
          </label>

          <div className="survey-question">
            <p>Please provide your gender</p>
            <div className="survey-options">
              {genderOptions.map((option) => (
                <label key={option} className="survey-option">
                  <input
                    type="radio"
                    name="gender"
                    value={option}
                    checked={gender === option}
                    onChange={(event) => setGender(event.target.value)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="field field-wide">
            <span>Was there any aspects of the simulation that was hard and/or confusing?</span>
            <textarea
              value={confusingAspects}
              onChange={(event) => setConfusingAspects(event.target.value)}
              rows={4}
              placeholder="Type here"
            />
          </label>

          <label className="field field-wide">
            <span>Please provide any feedback you have on the simulation.</span>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={4}
              placeholder="Type here"
            />
          </label>

          <div className="behaviour-actions">
            <button onClick={() => void handleSubmit()}>Submit survey</button>
            {message ? <p className="behaviour-message">{message}</p> : null}
            {submitted ? <p className="survey-success">Thank you. Your survey has been submitted.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
