"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  buildStudyHref,
  getStoredStudyContext,
  hasRequiredStudyContext,
  initializeStudyContextFromSearch,
  saveStudyStep,
  storeStudyContext,
  type StudyContext,
} from "@/lib/study";

const ROWS = 3;
const COLS = 12;
const BLUE_START_LEVEL = 11;
const WARM_START_LEVEL = 1;
const BLUE_COLOR = "#007fff";
const WARM_COLORS = ["#fff1a8", "#ffe16e", "#ffd04a", "#ffbe2f", "#f5aa14", "#e58900"];
const COLOR_STEPS = 15;
const COLOR_STEP_DELAY = 50;
const BLUE_HOP_DELAY = 120;
const WARM_BAND_DELAY = 1000;
const BLOOM_STEP_DELAY = 180;
const LOOP_DELAY = 2400;

type Cell = {
  row: number;
  col: number;
  color: string;
  level: number;
};

const createGrid = (level: number): Cell[][] =>
  Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => ({
      row,
      col,
      color: "#ffffff",
      level,
    })),
  );

const levelImage = (level: number) => `/blooming/${level}.png`;

const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
};

const rgbToHex = (rgb: number[]) =>
  `#${rgb.map((part) => part.toString(16).padStart(2, "0")).join("")}`;

const interpolateRgb = (start: number[], end: number[], t: number) =>
  start.map((value, index) => Math.round(value + (end[index] - value) * t));

const cloneGrid = (grid: Cell[][]) => grid.map((row) => row.map((cell) => ({ ...cell })));

export default function BehaviourPage() {
  const router = useRouter();
  const [blueCells, setBlueCells] = useState<Cell[][]>(() => createGrid(BLUE_START_LEVEL));
  const [warmCells, setWarmCells] = useState<Cell[][]>(() => createGrid(WARM_START_LEVEL));
  const [studyContext, setStudyContext] = useState<StudyContext>(getStoredStudyContext);
  const [blueDescription, setBlueDescription] = useState("");
  const [warmDescription, setWarmDescription] = useState("");
  const [message, setMessage] = useState("");
  const blueTimersRef = useRef<number[]>([]);
  const warmTimersRef = useRef<number[]>([]);

  useEffect(() => {
    setStudyContext(initializeStudyContextFromSearch(window.location.search));
  }, []);

  const stopTimers = (timersRef: MutableRefObject<number[]>) => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }
    timersRef.current = [];
  };

  const schedule = (
    timersRef: MutableRefObject<number[]>,
    callback: () => void,
    delay: number,
  ) => {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
  };

  const updateBlueCells = (updater: (draft: Cell[][]) => void) => {
    setBlueCells((current) => {
      const next = cloneGrid(current);
      updater(next);
      return next;
    });
  };

  const updateWarmCells = (updater: (draft: Cell[][]) => void) => {
    setWarmCells((current) => {
      const next = cloneGrid(current);
      updater(next);
      return next;
    });
  };

  const resetBlueGrid = () => {
    updateBlueCells((draft) => {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          draft[row][col].color = "#ffffff";
          draft[row][col].level = BLUE_START_LEVEL;
        }
      }
    });
  };

  const resetWarmGrid = () => {
    updateWarmCells((draft) => {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          draft[row][col].color = "#ffffff";
          draft[row][col].level = WARM_START_LEVEL;
        }
      }
    });
  };

  const fadeCell = ({
    timersRef,
    setCells,
    row,
    col,
    startColor,
    targetColor,
  }: {
    timersRef: MutableRefObject<number[]>;
    setCells: (updater: (draft: Cell[][]) => void) => void;
    row: number;
    col: number;
    startColor: string;
    targetColor: string;
  }) => {
    const startRgb = hexToRgb(startColor);
    const targetRgb = hexToRgb(targetColor);

    for (let step = 0; step <= COLOR_STEPS; step += 1) {
      schedule(timersRef, () => {
        const t = step / COLOR_STEPS;
        const color = rgbToHex(interpolateRgb(startRgb, targetRgb, t));
        setCells((draft) => {
          draft[row][col].color = color;
        });
      }, step * COLOR_STEP_DELAY);
    }
  };

  const animateWarmBloom = () => {
    for (let level = WARM_START_LEVEL; level <= 11; level += 1) {
      schedule(warmTimersRef, () => {
        updateWarmCells((draft) => {
          for (let row = 0; row < ROWS; row += 1) {
            for (let col = 0; col < COLS; col += 1) {
              draft[row][col].level = level;
            }
          }
        });
      }, (level - WARM_START_LEVEL) * BLOOM_STEP_DELAY);
    }
  };

  const playBlueLeftToRight = () => {
    stopTimers(blueTimersRef);
    resetBlueGrid();

    let index = 0;
    for (let col = 0; col < COLS; col += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        schedule(blueTimersRef, () => {
          fadeCell({
            timersRef: blueTimersRef,
            setCells: updateBlueCells,
            row,
            col,
            startColor: "#ffffff",
            targetColor: BLUE_COLOR,
          });
        }, index * BLUE_HOP_DELAY);
        index += 1;
      }
    }

    schedule(blueTimersRef, playBlueLeftToRight, index * BLUE_HOP_DELAY + LOOP_DELAY);
  };

  const playWarmBloomDemo = () => {
    stopTimers(warmTimersRef);
    resetWarmGrid();

    const bandCount = Math.ceil(COLS / 2);
    for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
      const targetColor = WARM_COLORS[bandIndex % WARM_COLORS.length];
      const startCol = bandIndex * 2;
      const delay = bandIndex * WARM_BAND_DELAY;

      for (let row = 0; row < ROWS; row += 1) {
        for (let col = startCol; col < Math.min(startCol + 2, COLS); col += 1) {
          schedule(warmTimersRef, () => {
            fadeCell({
              timersRef: warmTimersRef,
              setCells: updateWarmCells,
              row,
              col,
              startColor: "#ffffff",
              targetColor,
            });
          }, delay);
        }
      }
    }

    const bloomStartDelay = bandCount * WARM_BAND_DELAY;
    schedule(warmTimersRef, animateWarmBloom, bloomStartDelay);
    schedule(
      warmTimersRef,
      playWarmBloomDemo,
      bloomStartDelay + (11 - WARM_START_LEVEL) * BLOOM_STEP_DELAY + LOOP_DELAY,
    );
  };

  useEffect(() => {
    playBlueLeftToRight();
    playWarmBloomDemo();

    return () => {
      stopTimers(blueTimersRef);
      stopTimers(warmTimersRef);
    };
  }, []);

  const handleNext = async () => {
    if (!blueDescription.trim() || !warmDescription.trim()) {
      setMessage("Please describe both behaviours in your own words");
      return;
    }

    if (!hasRequiredStudyContext(studyContext)) {
      setMessage("Please enter a participant ID to continue");
      return;
    }

    try {
      await saveStudyStep({
        studyContext,
        step: "describe-behaviour",
        data: {
          responses: [
            {
              stimulus: "color left-to-right blue",
              description: blueDescription.trim(),
            },
            {
              stimulus:
                "flowers start at 1, change from yellow to orange in two-column bands every second, then gradually bloom to 11 together",
              description: warmDescription.trim(),
            },
          ],
        },
      });
      setMessage("");
      router.push(buildStudyHref("/prepare", studyContext));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not save your response";
      setMessage(errorMessage);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero behaviour-hero">
        <div>
          <h1>Describe These Behaviours</h1>
          <p className="intro-text">Please describe each behaviour in your own words.</p>
        </div>
      </section>

      <section className="controls-card behaviour-card">
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
                  manualSessionStamp:
                    event.target.value === studyContext.manualParticipantId ? studyContext.manualSessionStamp : "",
                };
                setStudyContext(nextContext);
                storeStudyContext(nextContext);
              }}
              placeholder="Type here"
            />
          </label>
        )}

        <div className="behaviour-prompt-grid">
          <article className="behaviour-prompt-card">
            <div className="behaviour-prompt-copy">
              <h2>Behaviour 1</h2>
              <p className="intro-text">Please describe this behaviour.</p>
            </div>
            <div className="swarm-grid" aria-label="Blue behaviour demo grid">
              {blueCells.map((row) =>
                row.map((cell) => (
                  <div
                    key={`blue-${cell.row}:${cell.col}`}
                    className="swarm-cell behaviour-cell"
                    style={{ background: cell.color }}
                  >
                    <Image
                      src={levelImage(cell.level)}
                      alt=""
                      width={80}
                      height={80}
                      className="swarm-image"
                    />
                  </div>
                )),
              )}
            </div>
            <label className="field">
              <span>Describe behaviour 1</span>
              <textarea
                value={blueDescription}
                onChange={(event) => setBlueDescription(event.target.value)}
                placeholder="Type here"
                rows={3}
              />
            </label>
          </article>

          <article className="behaviour-prompt-card">
            <div className="behaviour-prompt-copy">
              <h2>Behaviour 2</h2>
              <p className="intro-text">Please describe this behaviour.</p>
            </div>
            <div className="swarm-grid" aria-label="Warm behaviour demo grid">
              {warmCells.map((row) =>
                row.map((cell) => (
                  <div
                    key={`warm-${cell.row}:${cell.col}`}
                    className="swarm-cell behaviour-cell"
                    style={{ background: cell.color }}
                  >
                    <Image
                      src={levelImage(cell.level)}
                      alt=""
                      width={80}
                      height={80}
                      className="swarm-image"
                    />
                  </div>
                )),
              )}
            </div>
            <label className="field">
              <span>Describe behaviour 2</span>
              <textarea
                value={warmDescription}
                onChange={(event) => setWarmDescription(event.target.value)}
                placeholder="Type here"
                rows={3}
              />
            </label>
          </article>
        </div>

        <div className="behaviour-actions">
          <button onClick={() => void handleNext()}>Next</button>
          {message ? <p className="behaviour-message">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
