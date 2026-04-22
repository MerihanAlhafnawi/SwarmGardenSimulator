"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  FirestoreError,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
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

export default function Home() {
  const [cells, setCells] = useState<Cell[][]>(() => createGrid());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentColor, setCurrentColor] = useState(DEFAULT_COLOR);
  const [buckleValue, setBuckleValue] = useState(DEFAULT_LEVEL);
  const [recording, setRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("Stopped");
  const [recordData, setRecordData] = useState<RecordingEvent[]>([]);
  const [recordingTitle, setRecordingTitle] = useState("Swarm composition");
  const [recordingNotes, setRecordingNotes] = useState("");
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [saveState, setSaveState] = useState("Firebase not configured");
  const timersRef = useRef<number[]>([]);
  const recordingStartRef = useRef<number>(0);

  const isFirebaseReady = Boolean(getFirebaseDb());

  useEffect(() => {
    if (!isFirebaseReady) {
      setSaveState("Add Firebase env vars to enable cloud saves");
      return;
    }

    void loadRecordings();
  }, [isFirebaseReady]);

  const loadRecordings = async () => {
    const db = getFirebaseDb();
    if (!db) {
      return;
    }

    setLoadingRecordings(true);
    try {
      const recordingsQuery = query(
        collection(db, "recordings"),
        orderBy("createdAt", "desc"),
        limit(12),
      );
      const snapshot = await getDocs(recordingsQuery);
      const nextRecordings = snapshot.docs.map((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.();
        return {
          id: doc.id,
          title: String(data.title ?? "Untitled recording"),
          notes: String(data.notes ?? ""),
          createdAtLabel: createdAt ? createdAt.toLocaleString() : "Pending timestamp",
          events: Array.isArray(data.events) ? (data.events as RecordingEvent[]) : [],
        };
      });
      setSavedRecordings(nextRecordings);
      setSaveState("Connected to Firebase");
    } catch (error) {
      console.error(error);
      const message =
        error instanceof FirestoreError || error instanceof Error
          ? error.message
          : "Unknown Firebase read error";
      setSaveState(`Could not load recordings: ${message}`);
    } finally {
      setLoadingRecordings(false);
    }
  };

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
    playbackCells?: Array<[number, number]>;
  }) => {
    const playbackSet = playbackCells
      ? new Set(playbackCells.map(([row, col]) => cellKey(row, col)))
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
    playbackCells?: Array<[number, number]>;
  }) => {
    setBuckleValue(level);
    const playbackSet = playbackCells
      ? new Set(playbackCells.map(([row, col]) => cellKey(row, col)))
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
      return;
    }

    const db = getFirebaseDb();
    if (!db) {
      setSaveState("Firebase env vars missing");
      return;
    }

    try {
      await addDoc(collection(db, "recordings"), {
        title: recordingTitle,
        notes: recordingNotes,
        events: recordData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSaveState("Saved to Firestore");
      await loadRecordings();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof FirestoreError || error instanceof Error
          ? error.message
          : "Unknown Firebase write error";
      setSaveState(`Save failed: ${message}`);
    }
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

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Vercel + Firebase Edition</p>
          <h1>Swarm Garden Simulator</h1>
          <p className="subtitle">
            A hosted browser version of your simulator with room for user accounts, saved
            compositions, and cloud playback records.
          </p>
        </div>

        <div className="status-panel">
          <div className="status-row">
            <span className="status-label">Recording</span>
            <span className={`status-pill ${recording ? "recording" : "stopped"}`}>
              {recordingStatus}
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">Selection</span>
            <span className="status-pill neutral">
              {selected.size} cell{selected.size === 1 ? "" : "s"}
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">Storage</span>
            <span className="status-pill neutral">{saveState}</span>
          </div>
        </div>
      </section>

      <section className="controls-card">
        <div className="toolbar">
          <label className="field">
            <span>Recording Title</span>
            <input
              value={recordingTitle}
              onChange={(event) => setRecordingTitle(event.target.value)}
              placeholder="Name this swarm behavior"
            />
          </label>
          <label className="field field-wide">
            <span>Notes</span>
            <textarea
              value={recordingNotes}
              onChange={(event) => setRecordingNotes(event.target.value)}
              placeholder="Describe the behavior or intent"
              rows={2}
            />
          </label>
        </div>

        <div className="toolbar">
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
              const selectedCells = [...selected].map(parseCellKey);
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

        <div className="toolbar">
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
                const selectedCells = [...selected].map(parseCellKey);
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
        </div>

        <div className="toolbar">
          <button
            className="record"
            onClick={() => {
              setRecording(true);
              setRecordData([]);
              recordingStartRef.current = performance.now();
              setRecordingStatus("Recording");
            }}
          >
            Record
          </button>
          <button
            className="stop"
            onClick={() => {
              setRecording(false);
              setRecordingStatus("Stopped");
            }}
          >
            Stop Recording
          </button>
          <button className="ghost" onClick={stopFlow}>
            Stop Flow
          </button>
          <button onClick={() => playbackRecording(recordData)}>Playback Current</button>
          <button onClick={() => void saveRecording()}>Save to Firebase</button>
        </div>
      </section>

      <section className="grid-card">
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

      <section className="library-card">
        <div className="library-header">
          <div>
            <p className="eyebrow">Saved Recordings</p>
            <h2>Firestore Library</h2>
          </div>
          <button className="ghost" onClick={() => void loadRecordings()}>
            {loadingRecordings ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="recording-list">
          {savedRecordings.length === 0 ? (
            <p className="empty-state">
              No cloud recordings yet. Add Firebase env vars, record a sequence, and save it here.
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
                  <button onClick={() => playbackRecording(recordingItem.events)}>Play</button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
