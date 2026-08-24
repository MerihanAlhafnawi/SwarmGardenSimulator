"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { CSSProperties } from "react";
import StudyStepProgress from "@/components/StudyStepProgress";
import {
  buildStudyHref,
  getStoredStudyContext,
  hasRequiredStudyContext,
  initializeStudyContextFromSearch,
  saveStudyStep,
  type StudyContext,
} from "@/lib/study";

const ROWS = 3;
const COLS = 12;
const COLOR_STEPS = 15;
const COLOR_STEP_DELAY = 50;
const HOP_DELAY = 120;
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
  progressStep: number;
  responseLabel: string;
  responseKey: string;
  stimulus: string;
  initialLevel: number;
  nextHref: string;
  isFinalStep?: boolean;
  demoKind:
    | "bloom-left-to-right"
    | "two-column-bloom-green"
    | "bloom-patterns-random-color";
};

const BLOOM_STEP_DELAY = 180;
const TWO_COLUMN_BAND_DELAY = 1000;
const GREEN_COLOR = "#36a852";
const SECOND_DEMO_BLOOM_BANDS = [
  { from: 1, to: 3 },
  { from: 3, to: 5 },
  { from: 5, to: 7 },
  { from: 7, to: 8 },
  { from: 9, to: 11 },
];
const THIRD_DEMO_BLOOM_LEVELS = [3, 8, 5, 11, 2, 7];
const RANDOM_COLOR_FLASHES = [
  { row: 0, col: 9, color: "#ff4d4d" },
  { row: 2, col: 2, color: "#47b8ff" },
  { row: 1, col: 6, color: "#ffd84d" },
  { row: 0, col: 1, color: "#d45bff" },
  { row: 2, col: 11, color: "#4dcf6f" },
  { row: 1, col: 4, color: "#ff8a1f" },
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);
  const timersRef = useRef<number[]>([]);
  const hasAutoPlayedRef = useRef(false);
  const cellsRef = useRef<Cell[][]>(createGrid(config.initialLevel));
  const pendingGridRef = useRef<Cell[][] | null>(null);
  const flushFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setStudyContext(initializeStudyContextFromSearch(window.location.search));
  }, []);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    const storedResponses = getStoredResponses();
    setDescription(storedResponses[config.responseKey]?.description ?? "");
  }, [config.responseKey]);

  const stopDemo = (ref: MutableRefObject<number[]>) => {
    for (const timer of ref.current) {
      window.clearTimeout(timer);
    }
    ref.current = [];
    setDemoProgress(0);
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
  };

  const flushPendingGrid = () => {
    flushFrameRef.current = null;

    if (!pendingGridRef.current) {
      return;
    }

    const next = pendingGridRef.current;
    pendingGridRef.current = null;
    cellsRef.current = next;
    setCells(next);
  };

  const updateCells = (updater: (draft: Cell[][]) => void) => {
    const base = pendingGridRef.current ? cloneGrid(pendingGridRef.current) : cloneGrid(cellsRef.current);
    updater(base);
    pendingGridRef.current = base;

    if (flushFrameRef.current === null) {
      flushFrameRef.current = window.requestAnimationFrame(flushPendingGrid);
    }
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
    const startRgb = hexToRgb(cellsRef.current[row][col].color);
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

  const fadeWave = (wave: Array<[number, number]>, targetColor: string) => {
    const targetRgb = hexToRgb(targetColor);
    const waveStarts = wave.map(([row, col]) => ({
      row,
      col,
      startRgb: hexToRgb(cellsRef.current[row][col].color),
    }));

    for (let step = 0; step <= COLOR_STEPS; step += 1) {
      schedule(() => {
        const t = step / COLOR_STEPS;
        updateCells((draft) => {
          waveStarts.forEach(({ row, col, startRgb }) => {
            draft[row][col].color = rgbToHex(interpolateRgb(startRgb, targetRgb, t));
          });
        });
      }, step * COLOR_STEP_DELAY);
    }
  };

  const setWaveLevel = (wave: Array<[number, number]>, level: number) => {
    updateCells((draft) => {
      wave.forEach(([row, col]) => {
        draft[row][col].level = level;
      });
    });
  };

  const animateWaveLevel = (
    wave: Array<[number, number]>,
    from: number,
    to: number,
    delay: number,
    duration: number,
  ) => {
    const stepCount = 12;
    for (let step = 0; step <= stepCount; step += 1) {
      schedule(() => {
        const progress = step / stepCount;
        setWaveLevel(wave, Math.round(from + (to - from) * progress));
      }, delay + Math.round((duration * step) / stepCount));
    }
  };

  const setCellColor = (row: number, col: number, color: string) => {
    updateCells((draft) => {
      draft[row][col].color = color;
    });
  };

  const bloomWave = (wave: Array<[number, number]>, delay: number) => {
    for (let level = 1; level <= 11; level += 1) {
      schedule(() => setWaveLevel(wave, level), delay + (level - 1) * BLOOM_STEP_DELAY);
    }
  };

  const columnWave = (col: number): Array<[number, number]> =>
    Array.from({ length: ROWS }, (_, row) => [row, col] as [number, number]);

  const getDemoDuration = () => {
    if (config.demoKind === "bloom-left-to-right") {
      return (COLS - 1) * HOP_DELAY + 10 * BLOOM_STEP_DELAY + 600;
    }

    if (config.demoKind === "two-column-bloom-green") {
      return SECOND_DEMO_BLOOM_BANDS.length * TWO_COLUMN_BAND_DELAY + COLOR_STEPS * COLOR_STEP_DELAY + 600;
    }

    return THIRD_DEMO_BLOOM_LEVELS.length * TWO_COLUMN_BAND_DELAY + RANDOM_COLOR_FLASHES.length * 1000;
  };

  const startProgressBar = (duration: number) => {
    const tickCount = 40;
    setDemoProgress(0);

    for (let tick = 1; tick <= tickCount; tick += 1) {
      schedule(() => {
        setDemoProgress(tick / tickCount);
      }, Math.round((duration * tick) / tickCount));
    }
  };

  const playDemoByKind = () => {
    resetGrid();
    const duration = getDemoDuration();
    startProgressBar(duration);

    if (config.demoKind === "bloom-left-to-right") {
      for (let col = 0; col < COLS; col += 1) {
        bloomWave(columnWave(col), col * HOP_DELAY);
      }
      return;
    }

    if (config.demoKind === "two-column-bloom-green") {
      SECOND_DEMO_BLOOM_BANDS.forEach(({ from, to }, bandIndex) => {
        const startCol = bandIndex * 2;
        const wave = [...columnWave(startCol), ...columnWave(startCol + 1)];
        animateWaveLevel(wave, from, to, bandIndex * TWO_COLUMN_BAND_DELAY, TWO_COLUMN_BAND_DELAY - 120);
      });

      const greenStartDelay = SECOND_DEMO_BLOOM_BANDS.length * TWO_COLUMN_BAND_DELAY;
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          schedule(() => fadeCell(row, col, GREEN_COLOR), greenStartDelay);
        }
      }
      return;
    }

    THIRD_DEMO_BLOOM_LEVELS.forEach((targetLevel, index) => {
      const startCol = index * 2;
      const wave = [...columnWave(startCol), ...columnWave(startCol + 1)];
      animateWaveLevel(wave, 1, targetLevel, index * TWO_COLUMN_BAND_DELAY, TWO_COLUMN_BAND_DELAY - 120);
    });

    const flashStartDelay = THIRD_DEMO_BLOOM_LEVELS.length * TWO_COLUMN_BAND_DELAY;
    RANDOM_COLOR_FLASHES.forEach(({ row, col, color }, index) => {
      const delay = flashStartDelay + index * 1000;
      schedule(() => setCellColor(row, col, color), delay);
      schedule(() => setCellColor(row, col, "#ffffff"), delay + 700);
    });
  };

  useEffect(() => {
    if (!hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      replayBehaviour();
    }

    return () => {
      stopDemo(timersRef);
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
      }
    };
  }, [config.demoKind, config.initialLevel]);

  const replayBehaviour = () => {
    stopDemo(timersRef);
    playDemoByKind();
  };

  const handleNext = async () => {
    if (isSubmitting) {
      return;
    }

    if (!description.trim()) {
      setMessage("Please type a description of this behaviour in your own words");
      return;
    }

    if (!hasRequiredStudyContext(studyContext)) {
      setMessage("Study session missing. Please restart the study.");
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
      setIsSubmitting(true);
      setMessage("Saving...");
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero behaviour-hero">
        <div className="study-header-row">
          <StudyStepProgress currentStep={config.progressStep} totalSteps={7} />
        </div>
        <div>
          <h1>{config.title}</h1>
          <p className="intro-text">{config.helperText}</p>
        </div>
      </section>

      <section className="controls-card behaviour-card">
        <div className="study-header-row">
          <div className="study-progress" aria-label="Behaviour timeline">
            <span className="study-progress-caption">Behaviour progress</span>
            <div className="behaviour-progress-bar" aria-hidden="true">
              <span
                className="behaviour-progress-fill"
                style={{ width: `${Math.round(demoProgress * 100)}%` }}
              />
            </div>
          </div>
          <button type="button" className="ghost" onClick={replayBehaviour}>
            Replay behaviour
          </button>
        </div>

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
          <button onClick={() => void handleNext()} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Next"}
          </button>
          {message ? <p className="behaviour-message">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
