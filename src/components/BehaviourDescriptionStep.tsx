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
  demoKind: "blue-left-to-right" | "yellow-orange-bloom" | "rainbow-random-bloom";
};

const BLUE_COLOR = "#007fff";
const WARM_COLORS = ["#fff1a8", "#ffe16e", "#ffd04a", "#ffbe2f", "#f5aa14", "#e58900"];
const WARM_BAND_DELAY = 1000;
const BLOOM_STEP_DELAY = 180;
const RAINBOW_COLORS = [
  "#ff4d4d",
  "#ff8a1f",
  "#ffd84d",
  "#4dcf6f",
  "#47b8ff",
  "#7161ff",
  "#d45bff",
  "#ff6ec7",
  "#ff4d4d",
  "#ff8a1f",
  "#ffd84d",
  "#4dcf6f",
];
const RANDOM_BLOOM_SEQUENCE = [
  { row: 0, col: 3, level: 4 },
  { row: 2, col: 9, level: 8 },
  { row: 1, col: 5, level: 2 },
  { row: 0, col: 10, level: 11 },
  { row: 2, col: 1, level: 6 },
  { row: 1, col: 8, level: 3 },
  { row: 0, col: 0, level: 9 },
  { row: 2, col: 6, level: 5 },
];

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

  const playDemoByKind = () => {
    resetGrid();

    if (config.demoKind === "blue-left-to-right") {
      let index = 0;
      for (let col = 0; col < COLS; col += 1) {
        for (let row = 0; row < ROWS; row += 1) {
          schedule(() => fadeCell(row, col, BLUE_COLOR), index * 120);
          index += 1;
        }
      }
      return;
    }

    if (config.demoKind === "yellow-orange-bloom") {
      const bandCount = Math.ceil(COLS / 2);

      for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
        const targetColor = WARM_COLORS[bandIndex % WARM_COLORS.length];
        const startCol = bandIndex * 2;
        const delay = bandIndex * WARM_BAND_DELAY;

        for (let row = 0; row < ROWS; row += 1) {
          for (let col = startCol; col < Math.min(startCol + 2, COLS); col += 1) {
            schedule(() => fadeCell(row, col, targetColor), delay);
          }
        }
      }

      const bloomStartDelay = bandCount * WARM_BAND_DELAY;
      for (let level = 1; level <= 11; level += 1) {
        schedule(() => setAllLevels(level), bloomStartDelay + (level - 1) * BLOOM_STEP_DELAY);
      }
      return;
    }

    const centerOutColumns = [5, 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11];
    for (let index = 0; index < centerOutColumns.length; index += 1) {
      const targetColor = RAINBOW_COLORS[index];
      const col = centerOutColumns[index];
      for (let row = 0; row < ROWS; row += 1) {
        schedule(() => fadeCell(row, col, targetColor), index * 220);
      }
    }

    RANDOM_BLOOM_SEQUENCE.forEach((entry, index) => {
      schedule(() => setCellLevel(entry.row, entry.col, entry.level), 2200 + index * 350);
    });
  };

  useEffect(() => {
    const playLoop = () => {
      stopDemo(timersRef);
      playDemoByKind();
      schedule(playLoop, LOOP_DELAY + 12000);
    };

    playLoop();

    return () => stopDemo(timersRef);
  }, [config.demoKind, config.initialLevel]);

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
