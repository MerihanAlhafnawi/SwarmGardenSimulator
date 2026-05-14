"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
const START_LEVEL = 1;
const YELLOW_SHADES = ["#fff4b0", "#ffe680", "#ffd24d", "#ffbf1f", "#f2a900", "#d88f00"];
const STEPS = 15;
const STEP_DELAY = 50;
const SHADE_DELAY = 2000;
const LOOP_DELAY = 2400;

type Cell = {
  row: number;
  col: number;
  color: string;
  level: number;
};

const createGrid = (): Cell[][] =>
  Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => ({
      row,
      col,
      color: "#ffffff",
      level: START_LEVEL,
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
  const [cells, setCells] = useState<Cell[][]>(() => createGrid());
  const [studyContext, setStudyContext] = useState<StudyContext>(getStoredStudyContext);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    setStudyContext(initializeStudyContextFromSearch(window.location.search));
  }, []);

  const stopDemo = () => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }
    timersRef.current = [];
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
  };

  const updateCells = (updater: (draft: Cell[][]) => void) => {
    setCells((current) => {
      const next = cloneGrid(current);
      updater(next);
      return next;
    });
  };

  const resetGrid = () => {
    updateCells((draft) => {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          draft[row][col].color = "#ffffff";
          draft[row][col].level = START_LEVEL;
        }
      }
    });
  };

  const fadeCell = (row: number, col: number, targetColor: string) => {
    const startRgb = hexToRgb(cells[row][col].color);
    const targetRgb = hexToRgb(targetColor);

    for (let step = 0; step <= STEPS; step += 1) {
      schedule(() => {
        const t = step / STEPS;
        const color = rgbToHex(interpolateRgb(startRgb, targetRgb, t));
        updateCells((draft) => {
          draft[row][col].color = color;
        });
      }, step * STEP_DELAY);
    }
  };

  const setAllLevels = (level: number) => {
    updateCells((draft) => {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          draft[row][col].level = level;
        }
      }
    });
  };

  const playYellowBloomDemo = () => {
    stopDemo();
    resetGrid();

    const bandCount = Math.ceil(COLS / 2);
    for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
      const shade = YELLOW_SHADES[bandIndex % YELLOW_SHADES.length];
      const startCol = bandIndex * 2;
      const delay = bandIndex * SHADE_DELAY;

      for (let row = 0; row < ROWS; row += 1) {
        for (let col = startCol; col < Math.min(startCol + 2, COLS); col += 1) {
          schedule(() => fadeCell(row, col, shade), delay);
        }
      }
    }

    const bloomDelay = bandCount * SHADE_DELAY;
    schedule(() => setAllLevels(11), bloomDelay);
    schedule(playYellowBloomDemo, bloomDelay + LOOP_DELAY);
  };

  useEffect(() => {
    playYellowBloomDemo();
    return () => stopDemo();
  }, []);

  const handleNext = async () => {
    if (!description.trim()) {
      setMessage("Please type a description of this behaviour in your own words");
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
          description: description.trim(),
          stimulus: "flowers start at 1, change through yellow shades in two-column bands, then bloom to 11 together",
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
          <h1>Describe This Behaviour</h1>
          <p className="intro-text">Please describe this behaviour in your own words.</p>
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
        <label className="field field-wide">
          <span>Describe the behaviour</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Type here"
            rows={3}
          />
        </label>
        <div className="behaviour-actions">
          <button onClick={() => void handleNext()}>Next</button>
          {message ? <p className="behaviour-message">{message}</p> : null}
        </div>
      </section>

      <section className="grid-card">
        <div className="swarm-grid" aria-label="Behaviour demo grid">
          {cells.map((row) =>
            row.map((cell) => (
              <div
                key={`${cell.row}:${cell.col}`}
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
      </section>
    </main>
  );
}
