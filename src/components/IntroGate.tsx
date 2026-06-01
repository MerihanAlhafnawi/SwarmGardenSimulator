"use client";

import Link from "next/link";
import { useState } from "react";

export default function IntroGate({ nextHref }: { nextHref: string }) {
  const [videoFinished, setVideoFinished] = useState(false);

  return (
    <>
      <div className="video-placeholder">
        <video
          className="intro-video"
          controls
          playsInline
          autoPlay
          muted
          preload="metadata"
          onEnded={() => setVideoFinished(true)}
        >
          <source src="/intro_video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="intro-actions">
        <p className={`intro-helper ${videoFinished ? "intro-helper-hidden" : ""}`}>
          Please finish the video before continuing.
        </p>
        <Link
          href={videoFinished ? nextHref : "#"}
          className={`intro-next ${videoFinished ? "" : "intro-next-disabled"}`}
          aria-disabled={!videoFinished}
          onClick={(event) => {
            if (!videoFinished) {
              event.preventDefault();
            }
          }}
        >
          Next
        </Link>
      </div>
    </>
  );
}
