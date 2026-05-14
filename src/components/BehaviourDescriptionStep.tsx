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
const COLOR_STEPS = 15;
const COLOR_STEP_DELAY = 50;
const LOOP_DELAY = 2400;
const DESCRIPTION_RESPONSES_STORAGE_KEY = "swarm-describe-responses";

type Cell = {
  row: number;
  col: number;
  color: string;
  level: number;
};

type StoredResponse = {
  stimulus: string;
  description: string;
};

type StepConfig = {
  title: string;
  helperText: string;
  responseLabel: string;
  responseKey: string;
  stimulus: string;
  initialLevel: number;
  nextHref: string;
  isFinalStep?: boolean;
  playDemo: (helpers: DemoHelpers) => void;
};

type DemoHelpers = {
  resetGrid: () => void;
  fadeCell: (row: number, col: number, targetColor: string) => void;
  setCellLevel: (row: number, col: number, level: number) => void;
  setAllLevels: (level: number) => void;
  schedule: (callback: () => void, delay: number) => void;
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

function getStoredResponses() {
  if (typeof window === "undefined") {
    return {} as Record<string, StoredResponse>;
  }

  const raw = window.localStorage.getItem(DESCRIPTION_RESPONSES_STORAGE_KEY);
  if (!raw) {
    return {} as Record<string, StoredResponse>;
  }

  try {
    return JSON.parse(raw) as Record<string, StoredResponse>;
  } catch {
    return {} as Record<string, StoredResponse>;
  }
}

function storeResponses(value: Record<string, StoredResponse>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DESCRIPTION_RESPONSES_STORAGE_KEY, JSON.stringify(value));
}

function clearStoredResponses() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(DESCRIPTION_RESPONSES_STORAGE_KEY);
}

export default function BehaviourDescriptionStep({ config }: { config: StepConfig }) {
  const router = useRouter();
  const [cells, setCells] = useState<Cell[][]>(() => createGrid(config.initialLevel));
  const [studyContext, setStudyContext] = useState<StudyContext>(getStoredStudyContext);
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    setStudyContext(initializeStudyContextFromSearch(window.location.search));
  }, []);

  useEffect(() => {
    const storedResponses = getStoredResponses();
    setDescription(storedResponses[config.responseKey]?.description ?? "");
  }, [config.responseKey]);

  const stopDemo = (ref: MutableRefObject<number[]>) => {
    for (const timer of ref.current) {
      window.clearTimeout(timer);
    }
    ref.current = [];
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
          draft[row][col].level = config.initialLevel;
        }
      }
    });
  };

  const fadeCell = (row: number, col: number, targetColor: string) => {
    const startRgb = hexToRgb(cells[row][col].color);
    const targetRgb = hexToRgb(targetColor);

    for (let step = 0; step <= COLOR_STEPS; step += 1) {
      schedule(() => {
        const t = step / COLOR_STEPS;
        const color = rgbToHex(interpolateRgb(startRgb, targetRgb, t));
        updateCells((draft) => {
          draft[row][col].color = color;
        });
      }, step * COLOR_STEP_DELAY);
    }
  };

  const setCellLevel = (row: number, col: number, level: number) => {
    updateCells((draft) => {
      draft[row][col].level = level;
    });
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

  useEffect(() => {
    const playLoop = () => {
      stopDemo(timersRef);
      config.playDemo({
        resetGrid,
        fadeCell,
        setCellLevel,
        setAllLevels,
        schedule,
      });
      schedule(playLoop, LOOP_DELAY + 12000);
    };

    playLoop();

    return () => stopDemo(timersRef);
  }, [config]);

  const handleNext = async () => {
    if (!description.trim()) {
      setMessage("Please type a description of this behaviour in your own words");
      return;
    }

    if (!hasRequiredStudyContext(studyContext)) {
      setMessage("Please enter a participant ID to continue");
      return;
    }

    const storedResponses = getStoredResponses();
    const nextResponses = {
      ...storedResponses,
      [config.responseKey]: {
        stimulus: config.stimulus,
        description: description.trim(),
      },
    };

    storeResponses(nextResponses);

    try {
      await saveStudyStep({
        studyContext,
        step: "describe-behaviour",
        data: {
          responses: Object.values(nextResponses),
          currentPage: config.responseKey,
        },
      });

      if (config.isFinalStep) {
        clearStoredResponses();
      }

      setMessage("");
      router.push(buildStudyHref(config.nextHref, studyContext));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not save your response";
      setMessage(errorMessage);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero behaviour-hero">
        <div>
          <h1>{config.title}</h1>
          <p className="intro-text">{config.helperText}</p>
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

        <div className="swarm-grid" aria-label={`${config.title} demo grid`}>
          {cells.map((row) =>
            row.map((cell) => (
              <div
                key={`${config.responseKey}-${cell.row}:${cell.col}`}
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

        <label className="field field-wide">
          <span>{config.responseLabel}</span>
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
    </main>
  );
}
