"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredReviewRecordings, type ReviewRecording } from "@/lib/review";
import { getStoredStudyContext, buildStudyHref } from "@/lib/study";

export default function ReviewPage() {
  const [recordings, setRecordings] = useState<ReviewRecording[]>([]);
  const [continueHref, setContinueHref] = useState("/simulation");
  const [editHref, setEditHref] = useState("/simulation");
  const [reviewMode, setReviewMode] = useState("design");

  useEffect(() => {
    setRecordings(getStoredReviewRecordings());
    const params = new URLSearchParams(window.location.search);
    const studyContext = getStoredStudyContext();
    setContinueHref(
      buildStudyHref(params.get("continue") || "/simulation", studyContext),
    );
    setEditHref(buildStudyHref(params.get("edit") || "/simulation", studyContext));
    setReviewMode(params.get("review") || "design");
  }, []);

  return (
    <main className="page-shell consent-shell">
      <section className="hero consent-hero">
        <div className="transition-card review-card">
          <p>Here are your saved behaviours.</p>
          <span className="review-subtext">
            Please review your current behaviour below. If you are happy with it, continue. If
            not, go back and edit the behaviour.
          </span>
          <div className="review-list">
            {recordings.length === 0 ? (
              <p className="empty-state">No saved behaviours yet.</p>
            ) : (
              recordings.map((recording) => (
                <article key={recording.id} className="review-item">
                  <h2>{recording.title}</h2>
                  <p>{recording.notes || "No description provided."}</p>
                  <span>
                    {recording.eventCount} events · {recording.createdAtLabel}
                  </span>
                </article>
              ))
            )}
          </div>
          <div className="transition-actions">
            <Link href={continueHref} className="intro-next">
              {reviewMode === "prompt" ? "I like this behaviour" : "Keep this behaviour and continue"}
            </Link>
            <Link href={editHref} className="ghost intro-next">
              Edit this behaviour
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
