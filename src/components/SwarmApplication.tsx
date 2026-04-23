"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, FirestoreError, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

const ROWS = 3;
const COLS = 12;
const DEFAULT_COLOR = "#007fff";
const DEFAULT_LEVEL = 11;
const STEPS = 15;
const STEP_DELAY = 50;
const HOP_DELAY = 120;
const START_OFFSET = 1000;
const BUCKLE_DURATION = 10000;
const BUCKLE_STEP_DELAY = 100;

type Cell = {
  row: number;
  col: number;
  color: string;
  level: number;
};

type RecordingEvent = {
  time: number;
  action: string;
  data: Record<string, unknown>;
};

type SavedRecording = {
  id: string;
  title: string;
  notes: string;
  createdAtLabel: string;
  events: RecordingEvent[];
};

type PlaybackCellsInput = Array<string | [number, number]>;
type TourStep = {
  title: string;
  body: string;
  targetId: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    targetId: "behaviour-field",
    title: "Describe the behaviour",
    body: "Write a short description here before saving so each recorded behaviour is easy to recognize later.",
  },
  {
    targetId: "grid",
    title: "Select robots",
    body: "Click robots in the grid to select them. Selected robots are the ones affected by targeted changes.",
  },
  {
    targetId: "color-controls",
    title: "Color controls",
    body: "Pick a color, then apply it to selected robots, all robots, or send it through the swarm as a moving flow.",
  },
  {
    targetId: "buckle-controls",
    title: "Buckle controls",
    body: "Use the buckle slider or the directional buckle buttons to change bloom levels across the swarm.",
  },
  {
    targetId: "record-controls",
    title: "Record and save",
    body: "Press Record to capture your actions, Stop Recording when you are done, then Save Recording to store the behaviour.",
  },
  {
    targetId: "reset-button",
    title: "Reset",
    body: "Reset clears selections, restores white backgrounds, and returns every robot to buckle level 11.",
  },
  {
    targetId: "recorded-behaviours",
    title: "Recorded behaviours",
    body: "Saved behaviours appear here. You can replay them, download them as JSON, or delete them later.",
  },
];

const createGrid = (): Cell[][] =>
  Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => ({
      row,
      col,
      color: "#ffffff",
      level: DEFAULT_LEVEL,
    })),
  );

const cellKey = (row: number, col: number) => `${row}:${col}`;

const parseCellKey = (key: string): [number, number] => {
  const [row, col] = key.split(":").map(Number);
  return [row, col];
};

const normalizePlaybackCells = (value: unknown): Array<[number, number]> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item === "string") {
      return [parseCellKey(item)];
    }

    if (
      Array.isArray(item) &&
      item.length === 2 &&
      typeof item[0] === "number" &&
      typeof item[1] === "number"
    ) {
      return [[item[0], item[1]] as [number, number]];
    }

    return [];
  });
};

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

export default function SwarmApplication({ forceTour = false }: { forceTour?: boolean }) {
  const [cells, setCells] = useState<Cell[][]>(() => createGrid());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentColor, setCurrentColor] = useState(DEFAULT_COLOR);
  const [buckleValue, setBuckleValue] = useState(DEFAULT_LEVEL);
  const [recording, setRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [recordData, setRecordData] = useState<RecordingEvent[]>([]);
  const [recordingNotes, setRecordingNotes] = useState("");
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);
  const [saveState, setSaveState] = useState("Firebase not configured");
  const [deletingRecordingId, setDeletingRecordingId] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const timersRef = useRef<number[]>([]);
  const recordingStartRef = useRef<number>(0);

  const isFirebaseReady = Boolean(getFirebaseDb());
  const activeTourStep = TOUR_STEPS[tourStepIndex];

  useEffect(() => {
    setSaveState(
      isFirebaseReady ? "Connected to Firebase" : "Add Firebase env vars to enable cloud saves",
    );
  }, [isFirebaseReady]);

  useEffect(() => {
    const hasSeenTour = window.localStorage.getItem("swarm-tour-dismissed") === "true";

    if (forceTour || !hasSeenTour) {
      setTourOpen(true);
      setTourStepIndex(0);
    }
  }, [forceTour]);

  useEffect(() => {
    if (!tourOpen) {
      return;
    }

    const target = document.querySelector<HTMLElement>(`[data-tour-id="${activeTourStep.targetId}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, [activeTourStep, tourOpen]);

  const startTour = () => {
    setTourStepIndex(0);
    setTourOpen(true);
  };

  const closeTour = () => {
    window.localStorage.setItem("swarm-tour-dismissed", "true");
    setTourOpen(false);
  };

  const nextTourStep = () => {
    if (tourStepIndex === TOUR_STEPS.length - 1) {
      closeTour();
      return;
    }

    setTourStepIndex((current) => current + 1);
  };

  const previousTourStep = () => {
    setTourStepIndex((current) => Math.max(0, current - 1));
  };

  const getTourClass = (targetId: string) =>
    tourOpen && activeTourStep.targetId === targetId ? "tour-target-active" : "";

  const stopFlow = () => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }
    timersRef.current = [];
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
  };

  const captureState = (action: string, data: Record<string, unknown> = {}) => {
    if (!recording) {
      return;
    }

    setRecordData((current) => [
      ...current,
      {
        time: (performance.now() - recordingStartRef.current) / 1000,
        action,
        data,
      },
    ]);
  };

  const updateCells = (updater: (draft: Cell[][]) => void) => {
    setCells((current) => {
      const next = cloneGrid(current);
      updater(next);
      return next;
    });
  };

  const toggleSelection = (row: number, col: number) => {
    const key = cellKey(row, col);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const deselectAll = () => {
    setSelected(new Set());
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

  const fadeToColor = ({
    targetColor,
    selectedOnly = false,
    playbackCells,
  }: {
    targetColor: string;
    selectedOnly?: boolean;
    playbackCells?: PlaybackCellsInput;
  }) => {
    const normalizedPlaybackCells = playbackCells ? normalizePlaybackCells(playbackCells) : null;
    const playbackSet = normalizedPlaybackCells
      ? new Set(normalizedPlaybackCells.map(([row, col]) => cellKey(row, col)))
      : null;

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const key = cellKey(row, col);
        if (selectedOnly && !selected.has(key)) {
          continue;
        }
        if (playbackSet && !playbackSet.has(key)) {
          continue;
        }
        fadeCell(row, col, targetColor);
      }
    }
  };

  const getFlowOrder = (direction: string) => {
    const order: Array<[number, number]> = [];

    if (direction === "left_to_right") {
      for (let col = 0; col < COLS; col += 1) {
        for (let row = 0; row < ROWS; row += 1) {
          order.push([row, col]);
        }
      }
      return order;
    }

    if (direction === "right_to_left") {
      for (let col = COLS - 1; col >= 0; col -= 1) {
        for (let row = 0; row < ROWS; row += 1) {
          order.push([row, col]);
        }
      }
      return order;
    }

    const centerRow = Math.floor(ROWS / 2);
    const centerCol = Math.floor(COLS / 2);
    const next = [];

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        next.push({
          row,
          col,
          distance: Math.abs(row - centerRow) + Math.abs(col - centerCol),
        });
      }
    }

    next.sort((a, b) => a.distance - b.distance);
    return next.map(({ row, col }) => [row, col] as [number, number]);
  };

  const startLedFlow = (direction: string, color = currentColor) => {
    stopFlow();
    getFlowOrder(direction).forEach(([row, col], index) => {
      schedule(() => fadeCell(row, col, color), index * HOP_DELAY);
    });
  };

  const setBuckleLevel = ({
    level,
    playback = false,
    playbackCells,
  }: {
    level: number;
    playback?: boolean;
    playbackCells?: PlaybackCellsInput;
  }) => {
    setBuckleValue(level);
    const normalizedPlaybackCells = playbackCells ? normalizePlaybackCells(playbackCells) : null;
    const playbackSet = normalizedPlaybackCells
      ? new Set(normalizedPlaybackCells.map(([row, col]) => cellKey(row, col)))
      : null;

    updateCells((draft) => {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          const key = cellKey(row, col);
          if (!playback && selected.size > 0 && !selected.has(key)) {
            continue;
          }
          if (playbackSet && !playbackSet.has(key)) {
            continue;
          }
          draft[row][col].level = level;
        }
      }
    });
  };

  const animateBuckleCell = (row: number, col: number, startLevel: number, endLevel: number) => {
    const totalSteps = Math.floor(BUCKLE_DURATION / BUCKLE_STEP_DELAY);
    for (let step = 0; step <= totalSteps; step += 1) {
      schedule(() => {
        const progress = step / totalSteps;
        const level = Math.round(startLevel + (endLevel - startLevel) * progress);
        updateCells((draft) => {
          draft[row][col].level = level;
        });
      }, step * BUCKLE_STEP_DELAY);
    }
  };

  const startBuckleFlow = (direction: string) => {
    stopFlow();
    getFlowOrder(direction).forEach(([row, col], index) => {
      schedule(() => animateBuckleCell(row, col, DEFAULT_LEVEL, 1), index * START_OFFSET);
    });
  };

  const saveRecording = async () => {
    if (!recordData.length) {
      setSaveState("Record something before saving");
      return false;
    }

    const trimmedNotes = recordingNotes.trim();
    if (!trimmedNotes) {
      window.alert("Please describe a behaviour before saving.");
      setSaveState("Add a behaviour description before saving");
      return false;
    }

    const db = getFirebaseDb();
    if (!db) {
      setSaveState("Firebase env vars missing");
      return false;
    }

    try {
      const payload = {
        title: trimmedNotes,
        notes: trimmedNotes,
        events: recordData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "recordings"), payload);

      setSavedRecordings((current) => [
        {
          id: docRef.id,
          title: trimmedNotes,
          notes: trimmedNotes,
          createdAtLabel: new Date().toLocaleString(),
          events: recordData,
        },
        ...current,
      ]);
      setSaveState("Saved to Firestore for this session");
      return true;
    } catch (error) {
      console.error(error);
      const message =
        error instanceof FirestoreError || error instanceof Error
          ? error.message
          : "Unknown Firebase write error";
      setSaveState(`Save failed: ${message}`);
      return false;
    }
  };

  const resetSwarm = () => {
    stopFlow();
    setSelected(new Set());
    setBuckleValue(DEFAULT_LEVEL);
    updateCells((draft) => {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          draft[row][col].level = DEFAULT_LEVEL;
          draft[row][col].color = "#ffffff";
        }
      }
    });
  };

  const runPlaybackAction = (entry: RecordingEvent) => {
    const extra = entry.data;

    if (entry.action === "color_all") {
      fadeToColor({ targetColor: String(extra.color ?? DEFAULT_COLOR) });
      return;
    }

    if (entry.action === "color_selected") {
      fadeToColor({
        targetColor: String(extra.color ?? DEFAULT_COLOR),
        playbackCells: Array.isArray(extra.selected)
          ? (extra.selected as Array<[number, number]>)
          : [],
      });
      return;
    }

    if (entry.action === "color_flow") {
      startLedFlow(String(extra.direction ?? "left_to_right"), String(extra.color ?? DEFAULT_COLOR));
      return;
    }

    if (entry.action === "buckle_flow") {
      startBuckleFlow(String(extra.direction ?? "left_to_right"));
      return;
    }

    if (entry.action === "buckle_all") {
      setBuckleLevel({ level: Number(extra.val ?? DEFAULT_LEVEL), playback: true });
      return;
    }

    if (entry.action === "buckle_selected") {
      setBuckleLevel({
        level: Number(extra.val ?? DEFAULT_LEVEL),
        playback: true,
        playbackCells: Array.isArray(extra.selected)
          ? (extra.selected as Array<[number, number]>)
          : [],
      });
    }
  };

  const playbackRecording = (events: RecordingEvent[]) => {
    stopFlow();
    events.forEach((entry) => {
      schedule(() => runPlaybackAction(entry), Math.round(entry.time * 1000));
    });
  };

  const downloadRecordingsJson = () => {
    if (savedRecordings.length === 0) {
      setSaveState("No saved recordings to download");
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      count: savedRecordings.length,
      recordings: savedRecordings,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `swarm-garden-recordings-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSaveState("Downloaded recordings JSON");
  };

  const deleteRecording = async (recordingId: string) => {
    const confirmed = window.confirm(
      "Are you sure? This will be permanent and delete the entry from the database.",
    );

    if (!confirmed) {
      return;
    }

    const db = getFirebaseDb();
    if (!db) {
      setSaveState("Firebase env vars missing");
      return;
    }

    setDeletingRecordingId(recordingId);

    try {
      await deleteDoc(doc(db, "recordings", recordingId));
      setSavedRecordings((current) => current.filter((recording) => recording.id !== recordingId));
      setSaveState("Recording deleted permanently");
    } catch (error) {
      console.error(error);
      const message =
        error instanceof FirestoreError || error instanceof Error
          ? error.message
          : "Unknown Firebase delete error";
      setSaveState(`Delete failed: ${message}`);
    } finally {
      setDeletingRecordingId(null);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="application-hero">
          <h1>Swarm Garden Simulator</h1>
          <button className="ghost" onClick={startTour}>
            Show Tour
          </button>
        </div>
      </section>

      <section className="controls-card">
        <div className="toolbar">
          <label className={`field field-wide ${getTourClass("behaviour-field")}`} data-tour-id="behaviour-field">
            <span>Describe a behaviour</span>
            <textarea
              value={recordingNotes}
              onChange={(event) => setRecordingNotes(event.target.value)}
              placeholder="Type here"
              rows={2}
            />
          </label>
        </div>

        <div className={`toolbar ${getTourClass("color-controls")}`} data-tour-id="color-controls">
          <label className="color-picker">
            <span>Robot Color</span>
            <input
              type="color"
              value={currentColor}
              onChange={(event) => setCurrentColor(event.target.value)}
            />
          </label>
          <button
            onClick={() => {
              const selectedCells = [...selected];
              captureState("color_selected", { color: currentColor, selected: selectedCells });
              fadeToColor({ targetColor: currentColor, selectedOnly: true });
            }}
          >
            Color Selected
          </button>
          <button
            onClick={() => {
              captureState("color_all", { color: currentColor });
              fadeToColor({ targetColor: currentColor });
            }}
          >
            Color All
          </button>
          <button
            onClick={() => {
              captureState("color_flow", { direction: "left_to_right", color: currentColor });
              startLedFlow("left_to_right");
            }}
          >
            Color L→R
          </button>
          <button
            onClick={() => {
              captureState("color_flow", { direction: "right_to_left", color: currentColor });
              startLedFlow("right_to_left");
            }}
          >
            Color R→L
          </button>
          <button
            onClick={() => {
              captureState("color_flow", { direction: "center_outwards", color: currentColor });
              startLedFlow("center_outwards");
            }}
          >
            Color Center → Out
          </button>
          <button className="ghost" onClick={deselectAll}>
            Deselect All
          </button>
        </div>

        <div className={`toolbar ${getTourClass("buckle-controls")}`} data-tour-id="buckle-controls">
          <label className="slider-group">
            <span>Buckle Level</span>
            <input
              type="range"
              min="1"
              max="11"
              step="1"
              value={buckleValue}
              onChange={(event) => {
                const level = Number(event.target.value);
                const selectedCells = [...selected];
                if (selected.size > 0) {
                  captureState("buckle_selected", { val: String(level), selected: selectedCells });
                } else {
                  captureState("buckle_all", { val: String(level) });
                }
                setBuckleLevel({ level });
              }}
            />
            <output>{buckleValue}</output>
          </label>
          <button
            onClick={() => {
              captureState("buckle_flow", { direction: "left_to_right" });
              startBuckleFlow("left_to_right");
            }}
          >
            Buckle L→R
          </button>
          <button
            onClick={() => {
              captureState("buckle_flow", { direction: "right_to_left" });
              startBuckleFlow("right_to_left");
            }}
          >
            Buckle R→L
          </button>
          <button
            onClick={() => {
              captureState("buckle_flow", { direction: "center_outwards" });
              startBuckleFlow("center_outwards");
            }}
          >
            Buckle Center → Out
          </button>
          <button className="ghost" onClick={stopFlow}>
            Stop Flow
          </button>
        </div>

        <div className={`toolbar ${getTourClass("record-controls")}`} data-tour-id="record-controls">
          <button
            className={recording ? "stop" : "record"}
            onClick={() => {
              if (recording) {
                setRecording(false);
                setRecordingStatus("Don't forget to save");
                return;
              }

              setRecording(true);
              setRecordData([]);
              recordingStartRef.current = performance.now();
              setRecordingStatus("Recording");
            }}
          >
            {recording ? "Stop Recording" : "Record"}
          </button>
          <button onClick={() => void saveRecording()}>Save Recording</button>
          {recordingStatus ? <span className="controls-status-text">{recordingStatus}</span> : null}
          <div className="toolbar-spacer" />
          <button className={`ghost ${getTourClass("reset-button")}`} data-tour-id="reset-button" onClick={resetSwarm}>
            Reset
          </button>
        </div>
      </section>

      <section className={`grid-card ${getTourClass("grid")}`} data-tour-id="grid">
        <div className="swarm-grid" aria-label="Swarm grid">
          {cells.map((row) =>
            row.map((cell) => {
              const key = cellKey(cell.row, cell.col);
              return (
                <button
                  key={key}
                  type="button"
                  className={`swarm-cell ${selected.has(key) ? "selected" : ""}`}
                  style={{ background: cell.color }}
                  onClick={() => toggleSelection(cell.row, cell.col)}
                >
                  <Image
                    src={levelImage(cell.level)}
                    alt=""
                    width={80}
                    height={80}
                    className="swarm-image"
                  />
                </button>
              );
            }),
          )}
        </div>
      </section>

      <section className={`library-card ${getTourClass("recorded-behaviours")}`} data-tour-id="recorded-behaviours">
        <div className="library-header">
          <div>
            <h2>Recorded behaviours</h2>
          </div>
          <div className="library-actions">
            <button className="ghost" onClick={downloadRecordingsJson}>
              Download JSON
            </button>
          </div>
        </div>

        <div className="recording-list">
          {savedRecordings.length === 0 ? (
            <p className="empty-state">
              No recordings saved in this session yet. Save a sequence and it will appear here.
            </p>
          ) : (
            savedRecordings.map((recordingItem) => (
              <article key={recordingItem.id} className="recording-card">
                <div className="recording-meta">
                  <h3>{recordingItem.title}</h3>
                  <p>{recordingItem.createdAtLabel}</p>
                </div>
                <p className="recording-notes">{recordingItem.notes || "No notes yet."}</p>
                <div className="recording-actions">
                  <span>{recordingItem.events.length} events</span>
                  <div className="recording-buttons">
                    <button onClick={() => playbackRecording(recordingItem.events)}>Play</button>
                    <button
                      className="danger"
                      onClick={() => void deleteRecording(recordingItem.id)}
                      disabled={deletingRecordingId === recordingItem.id}
                    >
                      {deletingRecordingId === recordingItem.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {tourOpen ? (
        <>
          <div className="tour-overlay" onClick={closeTour} />
          <aside className="tour-card" aria-live="polite">
            <p className="eyebrow">
              Guided Tour {tourStepIndex + 1}/{TOUR_STEPS.length}
            </p>
            <h2>{activeTourStep.title}</h2>
            <p className="tour-body">{activeTourStep.body}</p>
            <div className="tour-actions">
              <button className="ghost" onClick={closeTour}>
                Skip
              </button>
              <div className="tour-actions-right">
                <button className="ghost" onClick={previousTourStep} disabled={tourStepIndex === 0}>
                  Back
                </button>
                <button onClick={nextTourStep}>
                  {tourStepIndex === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
                </button>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </main>
  );
}
