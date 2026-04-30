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
const DEFAULT_LEVEL = 11;
const DEMO_COLOR = "#007fff";
const STEPS = 15;
const STEP_DELAY = 50;
const HOP_DELAY = 120;
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
      level: DEFAULT_LEVEL,
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
          draft[row][col].level = DEFAULT_LEVEL;
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

  const playBlueLeftToRight = () => {
    stopDemo();
    resetGrid();

    let index = 0;
    for (let col = 0; col < COLS; col += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        schedule(() => fadeCell(row, col, DEMO_COLOR), index * HOP_DELAY);
        index += 1;
      }
    }

    schedule(playBlueLeftToRight, index * HOP_DELAY + LOOP_DELAY);
  };

  useEffect(() => {
    playBlueLeftToRight();
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
          stimulus: "color left-to-right blue",
        },
      });
      setMessage("");
      router.push(buildStudyHref("/implement", studyContext));
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
