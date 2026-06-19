"use client";

import Image from "next/image";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { getFirebaseDb } from "@/lib/firebase";

const ROWS = 3;
const COLS = 12;
const DEFAULT_LEVEL = 11;
const STEPS = 15;
const STEP_DELAY = 50;
const HOP_DELAY = 120;
const START_OFFSET = 120;
const BUCKLE_DURATION = 2000;
const BUCKLE_STEP_DELAY = 100;
const REPLAY_STEP_DELAY = 2000;
const COLOR_FLOW_DURATION = COLS * HOP_DELAY + STEPS * STEP_DELAY;
const BUCKLE_FLOW_DURATION = ROWS * COLS * START_OFFSET + BUCKLE_DURATION;

type Cell = {
  row: number;
  col: number;
  color: string;
  level: number;
};

type RecordingEvent = {
  time?: number;
  action: string;
  data: Record<string, unknown>;
};

type BehaviourEntry = {
  id: string;
  promptSlot?: string;
  submittedAt?: string;
  data?: {
    description?: string;
    events?: RecordingEvent[];
    promptSlot?: string;
  };
};

type DescribeResponse = {
  stimulus?: string;
  description?: string;
};

type StudyRecordLike = {
  _docId?: string;
  participantNumber?: string;
  prolificPid?: string;
  manualParticipantId?: string;
  studyRunId?: string;
  steps?: {
    describeBehaviour?: {
      submittedAt?: string;
      data?: {
        responses?: DescribeResponse[];
        currentPage?: string;
      };
    };
    providedPrompts?: BehaviourEntry[];
    implementedBehaviours?: BehaviourEntry[];
    designedBehaviours?: BehaviourEntry[];
  };
};

type PlaybackProgress = {
  recordingId: string;
  activeIndex: number;
  activeDuration: number;
};

type PlaybackCellsInput = Array<string | [number, number]>;

type ReplayItem = {
  id: string;
  title: string;
  submittedAt?: string;
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

const getFlowWaves = (direction: string) => {
  if (direction === "left_to_right") {
    const waves: Array<Array<[number, number]>> = [];
    for (let col = 0; col < COLS; col += 1) {
      const wave: Array<[number, number]> = [];
      for (let row = 0; row < ROWS; row += 1) {
        wave.push([row, col]);
      }
      waves.push(wave);
    }
    return waves;
  }

  if (direction === "right_to_left") {
    const waves: Array<Array<[number, number]>> = [];
    for (let col = COLS - 1; col >= 0; col -= 1) {
      const wave: Array<[number, number]> = [];
      for (let row = 0; row < ROWS; row += 1) {
        wave.push([row, col]);
      }
      waves.push(wave);
    }
    return waves;
  }

  const centerRow = Math.floor(ROWS / 2);
  const centerCol = Math.floor(COLS / 2);
  const cells = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      cells.push({
        row,
        col,
        distance: Math.abs(row - centerRow) + Math.abs(col - centerCol),
      });
    }
  }

  cells.sort((a, b) => a.distance - b.distance);
  const waveMap = new Map<number, Array<[number, number]>>();
  cells.forEach(({ row, col, distance }) => {
    const wave = waveMap.get(distance) ?? [];
    wave.push([row, col]);
    waveMap.set(distance, wave);
  });

  return [...waveMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, wave]) => wave);
};

const extractStudyRecords = (value: unknown): StudyRecordLike[] => {
  const results: StudyRecordLike[] = [];

  const visit = (node: unknown, docId?: string) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((item) => visit(item));
      return;
    }

    const candidate = node as Record<string, unknown>;
    if (candidate.steps && (candidate.participantNumber || candidate.prolificPid || candidate.manualParticipantId)) {
      results.push({
        ...(candidate as unknown as StudyRecordLike),
        _docId: docId,
      });
    }

    Object.entries(candidate).forEach(([key, child]) => {
      visit(child, key);
    });
  };

  visit(value);
  return results;
};

const downloadJsonFile = (name: string, value: unknown) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

const getPlaybackStepLabel = (action: string) => {
  switch (action) {
    case "color_selected":
      return "Color selected";
    case "color_all":
      return "Color all";
    case "color_flow":
      return "Color flow";
    case "buckle_selected":
      return "Buckle selected";
    case "buckle_all":
      return "Buckle all";
    case "buckle_flow":
      return "Buckle flow";
    default:
      return "Action";
  }
};

const getPromptSlotLabel = (slot?: string) => {
  if (slot === "provided-description-1") {
    return "Provided description 1";
  }
  if (slot === "provided-description-2") {
    return "Provided description 2";
  }
  return "Provided description";
};

export default function AdminReplay() {
  const [rawJson, setRawJson] = useState<unknown>(null);
  const [records, setRecords] = useState<StudyRecordLike[]>([]);
  const [message, setMessage] = useState("");
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [cells, setCells] = useState<Cell[][]>(() => createGrid());
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<PlaybackProgress | null>(null);

  const animationTimersRef = useRef<number[]>([]);
  const replayTimersRef = useRef<number[]>([]);
  const cellsRef = useRef<Cell[][]>(createGrid());
  const pendingGridRef = useRef<Cell[][] | null>(null);
  const flushFrameRef = useRef<number | null>(null);

  const participants = useMemo(() => {
    const ids = new Set(
      records
        .map((record) => record.participantNumber || record.prolificPid || record.manualParticipantId || "")
        .filter(Boolean),
    );
    return [...ids].sort();
  }, [records]);

  const participantRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          (record.participantNumber || record.prolificPid || record.manualParticipantId || "") ===
          selectedParticipant,
      ),
    [records, selectedParticipant],
  );

  const selectedRecord = useMemo(
    () =>
      participantRecords.find((record) => (record.studyRunId || record._docId || "") === selectedRunId) ??
      participantRecords[0] ??
      null,
    [participantRecords, selectedRunId],
  );

  const describeResponses = selectedRecord?.steps?.describeBehaviour?.data?.responses ?? [];
  const providedPromptBehaviours =
    selectedRecord?.steps?.providedPrompts && selectedRecord.steps.providedPrompts.length > 0
      ? selectedRecord.steps.providedPrompts
      : selectedRecord?.steps?.implementedBehaviours ?? [];
  const designedBehaviours = selectedRecord?.steps?.designedBehaviours ?? [];

  const replayItems = useMemo<ReplayItem[]>(
    () => [
      ...providedPromptBehaviours.map((entry) => ({
        id: entry.id,
        title: entry.data?.description || getPromptSlotLabel(entry.promptSlot || entry.data?.promptSlot),
        submittedAt: entry.submittedAt,
        events: entry.data?.events ?? [],
      })),
      ...designedBehaviours.map((entry) => ({
        id: entry.id,
        title: entry.data?.description || "Untitled behaviour",
        submittedAt: entry.submittedAt,
        events: entry.data?.events ?? [],
      })),
    ],
    [providedPromptBehaviours, designedBehaviours],
  );

  useEffect(() => {
    if (!selectedParticipant && participants[0]) {
      setSelectedParticipant(participants[0]);
    }
  }, [participants, selectedParticipant]);

  useEffect(() => {
    if (!participantRecords.length) {
      setSelectedRunId("");
      return;
    }

    const defaultRun = participantRecords[0]?.studyRunId || participantRecords[0]?._docId || "";
    if (
      !selectedRunId ||
      !participantRecords.some((record) => (record.studyRunId || record._docId || "") === selectedRunId)
    ) {
      setSelectedRunId(defaultRun);
    }
  }, [participantRecords, selectedRunId]);

  useEffect(() => {
    resetGrid();
  }, [selectedParticipant, selectedRunId]);

  useEffect(() => {
    return () => {
      stopFlow();
      stopReplaySchedule();
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
      }
    };
  }, []);

  const stopFlow = () => {
    for (const timer of animationTimersRef.current) {
      window.clearTimeout(timer);
    }
    animationTimersRef.current = [];
  };

  const scheduleAnimation = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    animationTimersRef.current.push(timer);
  };

  const stopReplaySchedule = () => {
    for (const timer of replayTimersRef.current) {
      window.clearTimeout(timer);
    }
    replayTimersRef.current = [];
  };

  const scheduleReplay = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    replayTimersRef.current.push(timer);
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
    stopFlow();
    stopReplaySchedule();
    setPlayingRecordingId(null);
    setPlaybackProgress(null);
    updateCells((draft) => {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          draft[row][col].level = DEFAULT_LEVEL;
          draft[row][col].color = "#ffffff";
        }
      }
    });
  };

  const fadeWave = (wave: Array<[number, number]>, targetColor: string) => {
    const targetRgb = hexToRgb(targetColor);
    const waveStarts = wave.map(([row, col]) => ({
      row,
      col,
      startRgb: hexToRgb(cellsRef.current[row][col].color),
    }));

    for (let step = 0; step <= STEPS; step += 1) {
      scheduleAnimation(() => {
        const t = step / STEPS;
        updateCells((draft) => {
          waveStarts.forEach(({ row, col, startRgb }) => {
            draft[row][col].color = rgbToHex(interpolateRgb(startRgb, targetRgb, t));
          });
        });
      }, step * STEP_DELAY);
    }
  };

  const fadeToColor = ({
    targetColor,
    playbackCells,
  }: {
    targetColor: string;
    playbackCells?: PlaybackCellsInput;
  }) => {
    const normalizedPlaybackCells = playbackCells ? normalizePlaybackCells(playbackCells) : null;
    const playbackSet = normalizedPlaybackCells
      ? new Set(normalizedPlaybackCells.map(([row, col]) => `${row}:${col}`))
      : null;

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (playbackSet && !playbackSet.has(`${row}:${col}`)) {
          continue;
        }
        fadeWave([[row, col]], targetColor);
      }
    }
  };

  const startLedFlow = (direction: string, color: string) => {
    stopFlow();
    getFlowWaves(direction).forEach((wave, index) => {
      scheduleAnimation(() => fadeWave(wave, color), index * HOP_DELAY);
    });
  };

  const setBuckleLevel = ({
    level,
    playbackCells,
  }: {
    level: number;
    playbackCells?: PlaybackCellsInput;
  }) => {
    const normalizedPlaybackCells = playbackCells ? normalizePlaybackCells(playbackCells) : null;
    const playbackSet = normalizedPlaybackCells
      ? new Set(normalizedPlaybackCells.map(([row, col]) => `${row}:${col}`))
      : null;

    updateCells((draft) => {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          if (playbackSet && !playbackSet.has(`${row}:${col}`)) {
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
      scheduleAnimation(() => {
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
    getFlowWaves(direction).flat().forEach(([row, col], index) => {
      scheduleAnimation(() => animateBuckleCell(row, col, DEFAULT_LEVEL, 1), index * START_OFFSET);
    });
  };

  const runPlaybackAction = (entry: RecordingEvent) => {
    const extra = entry.data ?? {};

    if (entry.action === "color_all") {
      fadeToColor({ targetColor: String(extra.color ?? "#007fff") });
      return;
    }

    if (entry.action === "color_selected") {
      fadeToColor({
        targetColor: String(extra.color ?? "#007fff"),
        playbackCells: Array.isArray(extra.selected) ? (extra.selected as PlaybackCellsInput) : [],
      });
      return;
    }

    if (entry.action === "color_flow") {
      startLedFlow(String(extra.direction ?? "left_to_right"), String(extra.color ?? "#007fff"));
      return;
    }

    if (entry.action === "buckle_all") {
      setBuckleLevel({ level: Number(extra.to ?? extra.val ?? DEFAULT_LEVEL) });
      return;
    }

    if (entry.action === "buckle_selected") {
      setBuckleLevel({
        level: Number(extra.to ?? extra.val ?? DEFAULT_LEVEL),
        playbackCells: Array.isArray(extra.selected) ? (extra.selected as PlaybackCellsInput) : [],
      });
      return;
    }

    if (entry.action === "buckle_flow") {
      startBuckleFlow(String(extra.direction ?? "left_to_right"));
    }
  };

  const getReplayActionDuration = (entry: RecordingEvent) => {
    switch (entry.action) {
      case "color_flow":
        return COLOR_FLOW_DURATION;
      case "buckle_flow":
        return BUCKLE_FLOW_DURATION;
      case "color_all":
      case "color_selected":
        return STEPS * STEP_DELAY;
      case "buckle_all":
      case "buckle_selected":
        return 300;
      default:
        return 500;
    }
  };

  const playbackRecording = (recordingId: string, events: RecordingEvent[]) => {
    resetGrid();
    setPlayingRecordingId(recordingId);
    setPlaybackProgress({ recordingId, activeIndex: -1, activeDuration: 0 });
    let playbackOffset = 0;

    events.forEach((entry, index) => {
      scheduleReplay(() => {
        setPlaybackProgress({
          recordingId,
          activeIndex: index,
          activeDuration: getReplayActionDuration(entry),
        });
        runPlaybackAction(entry);
      }, playbackOffset);
      playbackOffset += getReplayActionDuration(entry) + REPLAY_STEP_DELAY;
    });

    scheduleReplay(() => {
      setPlayingRecordingId(null);
      setPlaybackProgress(null);
    }, playbackOffset + 600);
  };

  const replayAllBehaviours = () => {
    resetGrid();
    let playbackOffset = 0;

    replayItems.forEach((item, itemIndex) => {
      scheduleReplay(() => {
        setPlayingRecordingId(item.id);
        setPlaybackProgress({ recordingId: item.id, activeIndex: -1, activeDuration: 0 });
      }, playbackOffset);

      item.events.forEach((entry, index) => {
        scheduleReplay(() => {
          setPlayingRecordingId(item.id);
          setPlaybackProgress({
            recordingId: item.id,
            activeIndex: index,
            activeDuration: getReplayActionDuration(entry),
          });
          runPlaybackAction(entry);
        }, playbackOffset);
        playbackOffset += getReplayActionDuration(entry) + REPLAY_STEP_DELAY;
      });

      if (itemIndex < replayItems.length - 1) {
        playbackOffset += 800;
      }
    });

    scheduleReplay(() => {
      setPlayingRecordingId(null);
      setPlaybackProgress(null);
    }, playbackOffset + 600);
  };

  const handleDownloadAllJson = async () => {
    const db = getFirebaseDb();
    if (!db) {
      setMessage("Firebase is not configured for this app.");
      return;
    }

    try {
      setIsDownloadingAll(true);
      setMessage("Downloading all study data...");
      const snapshot = await getDocs(collection(db, "recordings"));
      const allRecords = snapshot.docs.map((doc) => ({
        _docId: doc.id,
        ...doc.data(),
      }));
      downloadJsonFile("all-study-data.json", allRecords);
      setMessage(`Downloaded ${allRecords.length} study record${allRecords.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not download data from Firebase.");
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const nextRecords = extractStudyRecords(parsed);
      setRawJson(parsed);
      setRecords(nextRecords);
      setMessage(
        nextRecords.length
          ? `Loaded ${nextRecords.length} study record${nextRecords.length === 1 ? "" : "s"}.`
          : "No study records found in this JSON.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read this JSON file.");
      setRawJson(null);
      setRecords([]);
    }
  };

  const selectedRecordDownloadName = selectedRecord
    ? `participant-${selectedRecord.participantNumber || selectedRecord.prolificPid || selectedRecord.manualParticipantId || "record"}.json`
    : "participant.json";

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="application-hero">
          <h1>Admin Replay</h1>
        </div>
        <p className="intro-text">
          Upload exported study JSON, choose a participant, and review their full study record.
        </p>
      </section>

      <section className="controls-card admin-panel">
        <div className="toolbar admin-upload-row">
          <label className="field field-wide">
            <span>Upload JSON</span>
            <input type="file" accept="application/json,.json" onChange={handleUpload} />
          </label>
          <button className="ghost" onClick={() => void handleDownloadAllJson()} disabled={isDownloadingAll}>
            {isDownloadingAll ? "Downloading..." : "Download JSON"}
          </button>
        </div>

        <div className="toolbar admin-upload-row">
          <label className="field">
            <span>Participant ID</span>
            <select
              value={selectedParticipant}
              onChange={(event) => setSelectedParticipant(event.target.value)}
              disabled={participants.length === 0}
            >
              <option value="">Select participant</option>
              {participants.map((participantId) => (
                <option key={participantId} value={participantId}>
                  {participantId}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Study run</span>
            <select
              value={selectedRunId}
              onChange={(event) => setSelectedRunId(event.target.value)}
              disabled={participantRecords.length === 0}
            >
              <option value="">Select run</option>
              {participantRecords.map((record, index) => {
                const value = record.studyRunId || record._docId || `run-${index + 1}`;
                return (
                  <option key={value} value={value}>
                    {value}
                  </option>
                );
              })}
            </select>
          </label>

          {selectedRecord ? (
            <button className="ghost" onClick={() => downloadJsonFile(selectedRecordDownloadName, selectedRecord)}>
              Download selected participant JSON
            </button>
          ) : null}

          {replayItems.length > 0 ? (
            <button onClick={replayAllBehaviours}>Replay all behaviours</button>
          ) : null}
        </div>

        {message ? <p className="control-hint admin-message">{message}</p> : null}
        {selectedRecord ? (
          <p className="control-hint admin-message">
            Showing the study record for participant{" "}
            <strong>{selectedRecord.participantNumber || selectedRecord.prolificPid || selectedRecord.manualParticipantId}</strong>
            {selectedRecord.studyRunId ? ` (${selectedRecord.studyRunId})` : ""}.
          </p>
        ) : null}
      </section>

      <section className="grid-card">
        <div className="swarm-grid" aria-label="Replay grid">
          {cells.map((row) =>
            row.map((cell) => (
              <div
                key={`admin-${cell.row}:${cell.col}`}
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

      <section className="library-card">
        <div className="library-header">
          <div>
            <h2>Description responses</h2>
          </div>
        </div>

        <div className="recording-list">
          {!selectedRecord ? (
            <p className="empty-state">Upload JSON and choose a participant to review their study record.</p>
          ) : describeResponses.length === 0 ? (
            <p className="empty-state">No description responses were found for this participant.</p>
          ) : (
            describeResponses.map((response, index) => (
              <article key={`response-${index + 1}`} className="recording-card">
                <div className="recording-meta">
                  <h3>Describe behaviour {index + 1}</h3>
                  <p>{response.stimulus || "No stimulus recorded"}</p>
                </div>
                <p className="recording-notes">{response.description || "No response recorded."}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="library-card">
        <div className="library-header">
          <div>
            <h2>Behaviours from provided descriptions</h2>
          </div>
        </div>

        <div className="recording-list">
          {!selectedRecord ? (
            <p className="empty-state">Upload JSON and choose a participant to review their study record.</p>
          ) : providedPromptBehaviours.length === 0 ? (
            <p className="empty-state">No provided-description behaviours were found for this participant.</p>
          ) : (
            providedPromptBehaviours.map((recordingItem) => {
              const events = recordingItem.data?.events ?? [];
              const label = getPromptSlotLabel(recordingItem.promptSlot || recordingItem.data?.promptSlot);
              return (
                <article key={recordingItem.id} className="recording-card">
                  <div className="recording-meta">
                    <h3>{label}</h3>
                    <p>{recordingItem.submittedAt ? new Date(recordingItem.submittedAt).toLocaleString() : "No timestamp"}</p>
                  </div>
                  <p className="recording-notes">{recordingItem.data?.description || "No description yet."}</p>
                  {events.length > 0 ? (
                    <div className="playback-progress">
                      <div className="playback-progress-header">
                        <span>Replay progress</span>
                        <span>
                          {playingRecordingId === recordingItem.id && playbackProgress?.recordingId === recordingItem.id
                            ? playbackProgress.activeIndex >= 0
                              ? `Step ${playbackProgress.activeIndex + 1} of ${events.length}`
                              : "Starting replay"
                            : `${events.length} steps`}
                        </span>
                      </div>
                      <div className="playback-timeline" aria-label="Replay timeline">
                        {events.map((event, index) => {
                          const isCurrent =
                            playingRecordingId === recordingItem.id &&
                            playbackProgress?.recordingId === recordingItem.id &&
                            playbackProgress.activeIndex === index;
                          const isComplete =
                            playingRecordingId === recordingItem.id &&
                            playbackProgress?.recordingId === recordingItem.id &&
                            playbackProgress.activeIndex > index;

                          return (
                            <div
                              key={`${recordingItem.id}-${index}`}
                              className={`timeline-step ${isCurrent ? "current" : ""} ${isComplete ? "complete" : ""}`}
                              style={
                                isCurrent
                                  ? ({
                                      ["--timeline-duration" as string]: `${playbackProgress?.activeDuration ?? 0}ms`,
                                    } as CSSProperties)
                                  : undefined
                              }
                              title={getPlaybackStepLabel(event.action)}
                            >
                              <span className="timeline-dot" />
                              {index < events.length - 1 ? <span className="timeline-line" /> : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div className="recording-actions">
                    <span>{events.length} events</span>
                    <div className="recording-buttons">
                      <button onClick={() => playbackRecording(recordingItem.id, events)}>
                        {playingRecordingId === recordingItem.id ? "Playing" : "Play"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="library-card">
        <div className="library-header">
          <div>
            <h2>Own designed behaviours</h2>
          </div>
        </div>

        <div className="recording-list">
          {!selectedRecord ? (
            <p className="empty-state">Upload JSON and choose a participant to review their study record.</p>
          ) : designedBehaviours.length === 0 ? (
            <p className="empty-state">No self-designed behaviours were found for this participant.</p>
          ) : (
            designedBehaviours.map((recordingItem) => {
              const events = recordingItem.data?.events ?? [];
              return (
                <article key={recordingItem.id} className="recording-card">
                  <div className="recording-meta">
                    <h3>{recordingItem.data?.description || "Untitled behaviour"}</h3>
                    <p>{recordingItem.submittedAt ? new Date(recordingItem.submittedAt).toLocaleString() : "No timestamp"}</p>
                  </div>
                  {events.length > 0 ? (
                    <div className="playback-progress">
                      <div className="playback-progress-header">
                        <span>Replay progress</span>
                        <span>
                          {playingRecordingId === recordingItem.id && playbackProgress?.recordingId === recordingItem.id
                            ? playbackProgress.activeIndex >= 0
                              ? `Step ${playbackProgress.activeIndex + 1} of ${events.length}`
                              : "Starting replay"
                            : `${events.length} steps`}
                        </span>
                      </div>
                      <div className="playback-timeline" aria-label="Replay timeline">
                        {events.map((event, index) => {
                          const isCurrent =
                            playingRecordingId === recordingItem.id &&
                            playbackProgress?.recordingId === recordingItem.id &&
                            playbackProgress.activeIndex === index;
                          const isComplete =
                            playingRecordingId === recordingItem.id &&
                            playbackProgress?.recordingId === recordingItem.id &&
                            playbackProgress.activeIndex > index;

                          return (
                            <div
                              key={`${recordingItem.id}-${index}`}
                              className={`timeline-step ${isCurrent ? "current" : ""} ${isComplete ? "complete" : ""}`}
                              style={
                                isCurrent
                                  ? ({
                                      ["--timeline-duration" as string]: `${playbackProgress?.activeDuration ?? 0}ms`,
                                    } as CSSProperties)
                                  : undefined
                              }
                              title={getPlaybackStepLabel(event.action)}
                            >
                              <span className="timeline-dot" />
                              {index < events.length - 1 ? <span className="timeline-line" /> : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <p className="recording-notes">{recordingItem.data?.description || "No description yet."}</p>
                  <div className="recording-actions">
                    <span>{events.length} events</span>
                    <div className="recording-buttons">
                      <button onClick={() => playbackRecording(recordingItem.id, events)}>
                        {playingRecordingId === recordingItem.id ? "Playing" : "Play"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
