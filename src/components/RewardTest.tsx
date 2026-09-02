"use client";

import Image from "next/image";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { CLEANED_PROLIFIC_STUDIES } from "@/lib/cleanedProlificRuns";
import { getFirebaseDb } from "@/lib/firebase";

// Keep this aligned with AdminReplay so both internal tools use the same access
// code and unlock state for the current browser session.
const ADMIN_PASSWORD = "040924";
const ADMIN_AUTH_STORAGE_KEY = "swarm-garden-admin-auth";

const ROWS = 3;
const COLS = 12;
const ROBOT_COUNT = ROWS * COLS;
const DEFAULT_LEVEL = 11;
const DEFAULT_COLOR = "#ffffff";
const COLOR_STEPS = 15;
const COLOR_STEP_DELAY = 50;
const FLOW_HOP_DELAY = 120;
const BUCKLE_DURATION = 2000;
const BUCKLE_STEP_DELAY = 100;
const BUCKLE_FLOW_OFFSET = 120;
const REPLAY_PAUSE = 2000;

type Cell = { row: number; col: number; color: string; level: number };
type EventData = Record<string, unknown>;
type RecordingEvent = { action: string; data?: EventData; time?: number };
type BehaviourEntry = {
  id?: string;
  submittedAt?: string;
  promptSlot?: string;
  data?: { description?: string; events?: RecordingEvent[] };
};
type StudyRecord = {
  _docId?: string;
  participantNumber?: string;
  prolificPid?: string;
  manualParticipantId?: string;
  studyRunId?: string;
  condition?: string | number;
  condition_description?: string;
  steps?: { providedPrompts?: BehaviourEntry[]; implementedBehaviours?: BehaviourEntry[] };
};
type Behaviour = {
  id: string;
  participantId: string;
  runId: string;
  prompt: string;
  rawPrompt: string;
  condition: string;
  events: RecordingEvent[];
};
type MatchDetail = {
  firstIndex: number;
  secondIndex: number;
  stepSimilarity: number;
  positionSimilarity: number;
  contribution: number;
};
type RewardResult = {
  reward: number;
  rawMatchedReward: number;
  denominator: number;
  unmatchedFirst: number;
  unmatchedSecond: number;
  matches: MatchDetail[];
};
type ComparisonPreset = {
  label: "Lowest similarity" | "Middle similarity" | "Highest similarity";
  firstId: string;
  secondId: string;
  reward: number;
};
type ActionUse = { average: number; participantPercentage: number };
type ConditionActionSummary = {
  condition: string;
  behaviourCount: number;
  participantCount: number;
  buckle: ActionUse;
  buckleFlow: ActionUse;
  color: ActionUse;
  colorFlow: ActionUse;
  bothColorAndBuckle: ActionUse;
};
type PilotResult = {
  model?: string;
  target_behaviour_id?: string;
  target_run_key?: string;
  target_description?: string;
  target_events?: RecordingEvent[];
  predicted_events?: RecordingEvent[];
};
type PilotComparison = {
  id: string;
  model: string;
  description: string;
  target: Behaviour;
  prediction: Behaviour;
};

const createGrid = (): Cell[][] =>
  Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => ({ row, col, color: DEFAULT_COLOR, level: DEFAULT_LEVEL })),
  );

const cloneGrid = (grid: Cell[][]) => grid.map((row) => row.map((cell) => ({ ...cell })));
const levelImage = (level: number) => `/blooming/${level}.png`;

const canonicalPrompt = (value: string) => {
  const cleaned = value.trim().toLowerCase().replace(/\.$/, "");
  if (
    cleaned === "a sun rising over a garden" ||
    cleaned === "sun rising over a garden" ||
    cleaned === "sun rising over the garden"
  ) {
    return "Sun rising over a garden";
  }
  return value.trim();
};

const participantIdFor = (record: StudyRecord) =>
  record.prolificPid || record.participantNumber || record.manualParticipantId || "Unknown participant";

const conditionLabelFor = (record: StudyRecord) => {
  const number = record.condition === undefined || record.condition === null ? "Unspecified condition" : String(record.condition);
  return record.condition_description ? `${number} | ${record.condition_description}` : number;
};

const extractRecords = (value: unknown): StudyRecord[] => {
  const records: StudyRecord[] = [];
  const visit = (node: unknown, docId?: string) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item));
      return;
    }
    const candidate = node as Record<string, unknown>;
    if (candidate.steps && (candidate.prolificPid || candidate.participantNumber || candidate.manualParticipantId)) {
      records.push({ ...(candidate as StudyRecord), _docId: docId });
    }
    Object.entries(candidate).forEach(([key, child]) => visit(child, key));
  };
  visit(value);
  return records;
};

const extractBehaviours = (records: StudyRecord[]): Behaviour[] =>
  records.flatMap((record, recordIndex) => {
    const entries = record.steps?.providedPrompts?.length
      ? record.steps.providedPrompts
      : record.steps?.implementedBehaviours ?? [];
    return entries.flatMap((entry, entryIndex) => {
      const events = entry.data?.events?.filter((event) => event && typeof event.action === "string") ?? [];
      const rawPrompt = entry.data?.description?.trim() ?? "Unknown prompt";
      if (!events.length) return [];
      return [{
        id: entry.id || `${record.studyRunId || record._docId || recordIndex}-${entryIndex}`,
        participantId: participantIdFor(record),
        runId: record.studyRunId || record._docId || `run-${recordIndex + 1}`,
        prompt: canonicalPrompt(rawPrompt),
        rawPrompt,
        condition: conditionLabelFor(record),
        events,
      }];
    });
  });

const extractPilotResults = (value: unknown): PilotResult[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PilotResult => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as PilotResult;
    return (
      typeof candidate.target_behaviour_id === "string" &&
      typeof candidate.target_description === "string" &&
      Array.isArray(candidate.target_events) &&
      Array.isArray(candidate.predicted_events)
    );
  });
};

const parsePilotUpload = (fileText: string): PilotResult[] => {
  // A running pilot writes one JSON object per line (.jsonl); the optional
  // formatting command writes one JSON array (.json).  This accepts either.
  const trimmed = fileText.trim();
  if (!trimmed) return [];
  try {
    return extractPilotResults(JSON.parse(trimmed));
  } catch {
    return extractPilotResults(trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)));
  }
};

const hexToRgb = (value: unknown): number[] => {
  const color = String(value || DEFAULT_COLOR).replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(color)) return [1, 1, 1];
  return [0, 2, 4].map((index) => Number.parseInt(color.slice(index, index + 2), 16) / 255);
};

const colorSimilarity = (first: unknown, second: unknown) => {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const distance = Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
  return Math.max(0, 1 - distance / Math.sqrt(3));
};

const buckleSimilarity = (first: unknown, second: unknown) => {
  const a = Number(first);
  const b = Number(second);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, 1 - Math.abs(a - b) / 10);
};

const selectedIndices = (value: unknown) => {
  if (!Array.isArray(value)) return new Set<number>();
  const selected = new Set<number>();
  value.forEach((cell) => {
    let row: number | undefined;
    let col: number | undefined;
    if (typeof cell === "string") {
      const [rawRow, rawCol] = cell.split(":").map(Number);
      row = rawRow;
      col = rawCol;
    } else if (Array.isArray(cell) && cell.length === 2) {
      row = Number(cell[0]);
      col = Number(cell[1]);
    }
    if (Number.isInteger(row) && Number.isInteger(col) && row! >= 0 && row! < ROWS && col! >= 0 && col! < COLS) {
      selected.add(row! * COLS + col!);
    }
  });
  return selected;
};

const selectedColorSimilarity = (first: RecordingEvent, second: RecordingEvent) => {
  const firstData = first.data ?? {};
  const secondData = second.data ?? {};
  const firstSelected = selectedIndices(firstData.selected);
  const secondSelected = selectedIndices(secondData.selected);
  const firstColor = firstData.color;
  const secondColor = secondData.color;
  let total = 0;
  for (let index = 0; index < ROBOT_COUNT; index += 1) {
    total += colorSimilarity(firstSelected.has(index) ? firstColor : DEFAULT_COLOR, secondSelected.has(index) ? secondColor : DEFAULT_COLOR);
  }
  return total / ROBOT_COUNT;
};

const selectedBuckleSimilarity = (first: RecordingEvent, second: RecordingEvent) => {
  const firstData = first.data ?? {};
  const secondData = second.data ?? {};
  const firstSelected = selectedIndices(firstData.selected);
  const secondSelected = selectedIndices(secondData.selected);
  let total = 0;
  for (let index = 0; index < ROBOT_COUNT; index += 1) {
    total += buckleSimilarity(firstSelected.has(index) ? firstData.val : DEFAULT_LEVEL, secondSelected.has(index) ? secondData.val : DEFAULT_LEVEL);
  }
  return total / ROBOT_COUNT;
};

// This is the reward definition agreed for the study analysis.  Only actions
// of the same mode match: flow, all, and individual selection stay distinct.
const stepSimilarity = (first: RecordingEvent, second: RecordingEvent) => {
  const firstData = first.data ?? {};
  const secondData = second.data ?? {};
  if (first.action === "color_flow" && second.action === "color_flow") {
    return 0.5 * colorSimilarity(firstData.color, secondData.color) + 0.5 * Number(firstData.direction === secondData.direction);
  }
  if (first.action === "buckle_flow" && second.action === "buckle_flow") {
    return firstData.direction === secondData.direction ? 1 : 0.5;
  }
  if (first.action === "color_all" && second.action === "color_all") return colorSimilarity(firstData.color, secondData.color);
  if (first.action === "buckle_all" && second.action === "buckle_all") return buckleSimilarity(firstData.val, secondData.val);
  if (first.action === "color_selected" && second.action === "color_selected") return selectedColorSimilarity(first, second);
  if (first.action === "buckle_selected" && second.action === "buckle_selected") return selectedBuckleSimilarity(first, second);
  return 0;
};

// Hungarian assignment finds the global best set of one-to-one step matches.
// It avoids a greedy early choice preventing a stronger later pairing.
const maximumWeightMatching = (weights: number[][]): Array<[number, number, number]> => {
  const rowCount = weights.length;
  const colCount = weights[0]?.length ?? 0;
  const size = Math.max(rowCount, colCount);
  if (!size) return [];
  const maximum = Math.max(0, ...weights.flat());
  const cost = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => maximum - (weights[row]?.[col] ?? 0)),
  );
  const u = Array(size + 1).fill(0);
  const v = Array(size + 1).fill(0);
  const p = Array(size + 1).fill(0);
  const way = Array(size + 1).fill(0);

  for (let row = 1; row <= size; row += 1) {
    p[0] = row;
    let currentCol = 0;
    const minimum = Array(size + 1).fill(Infinity);
    const used = Array(size + 1).fill(false);
    do {
      used[currentCol] = true;
      const currentRow = p[currentCol];
      let delta = Infinity;
      let nextCol = 0;
      for (let col = 1; col <= size; col += 1) {
        if (used[col]) continue;
        const current = cost[currentRow - 1][col - 1] - u[currentRow] - v[col];
        if (current < minimum[col]) {
          minimum[col] = current;
          way[col] = currentCol;
        }
        if (minimum[col] < delta) {
          delta = minimum[col];
          nextCol = col;
        }
      }
      for (let col = 0; col <= size; col += 1) {
        if (used[col]) {
          u[p[col]] += delta;
          v[col] -= delta;
        } else {
          minimum[col] -= delta;
        }
      }
      currentCol = nextCol;
    } while (p[currentCol] !== 0);

    do {
      const previousCol = way[currentCol];
      p[currentCol] = p[previousCol];
      currentCol = previousCol;
    } while (currentCol !== 0);
  }

  const matches: Array<[number, number, number]> = [];
  for (let col = 1; col <= size; col += 1) {
    const row = p[col];
    if (row > 0 && row <= rowCount && col <= colCount && weights[row - 1][col - 1] > 0) {
      matches.push([row - 1, col - 1, weights[row - 1][col - 1]]);
    }
  }
  return matches;
};

const calculateReward = (first: RecordingEvent[], second: RecordingEvent[]): RewardResult => {
  const weights = first.map((firstEvent) => second.map((secondEvent) => stepSimilarity(firstEvent, secondEvent)));
  const rawMatches = maximumWeightMatching(weights);
  const matches = rawMatches.map(([firstIndex, secondIndex, similarity]) => {
    const firstPosition = firstIndex / Math.max(first.length - 1, 1);
    const secondPosition = secondIndex / Math.max(second.length - 1, 1);
    const positionSimilarity = 1 - Math.abs(firstPosition - secondPosition);
    return {
      firstIndex,
      secondIndex,
      stepSimilarity: similarity,
      positionSimilarity,
      contribution: similarity * (0.85 + 0.15 * positionSimilarity),
    };
  });
  const rawMatchedReward = matches.reduce((sum, match) => sum + match.contribution, 0);
  const denominator = Math.max(first.length, second.length, 1);
  return {
    reward: rawMatchedReward / denominator,
    rawMatchedReward,
    denominator,
    unmatchedFirst: first.length - matches.length,
    unmatchedSecond: second.length - matches.length,
    matches,
  };
};

const summarizeActionUse = (condition: string, items: Behaviour[]): ConditionActionSummary => {
  // "Buckle" and "Color" here mean the direct all/selected actions.  Their
  // flow counterparts are separate columns, so the table makes the distinction
  // between individual/global changes and collective flow actions explicit.
  const categories = {
    buckle: new Set(["buckle_all", "buckle_selected"]),
    buckleFlow: new Set(["buckle_flow"]),
    color: new Set(["color_all", "color_selected"]),
    colorFlow: new Set(["color_flow"]),
  };
  const participantEvents = new Map<string, Set<string>>();
  const eventTotals = { buckle: 0, buckleFlow: 0, color: 0, colorFlow: 0 };

  items.forEach((behaviour) => {
    const participantKey = `${behaviour.participantId} | ${behaviour.runId}`;
    const actions = participantEvents.get(participantKey) ?? new Set<string>();
    behaviour.events.forEach((event) => {
      actions.add(event.action);
      (Object.keys(categories) as Array<keyof typeof categories>).forEach((category) => {
        if (categories[category].has(event.action)) eventTotals[category] += 1;
      });
    });
    participantEvents.set(participantKey, actions);
  });

  const participantCount = participantEvents.size;
  const makeActionUse = (category: keyof typeof categories): ActionUse => {
    const participantsUsing = [...participantEvents.values()].filter((actions) =>
      [...categories[category]].some((action) => actions.has(action)),
    ).length;
    return {
      average: items.length ? eventTotals[category] / items.length : 0,
      participantPercentage: participantCount ? (participantsUsing / participantCount) * 100 : 0,
    };
  };
  const bothParticipants = [...participantEvents.values()].filter((actions) =>
    [...categories.color, ...categories.colorFlow].some((action) => actions.has(action)) &&
    [...categories.buckle, ...categories.buckleFlow].some((action) => actions.has(action)),
  ).length;

  return {
    condition,
    behaviourCount: items.length,
    participantCount,
    buckle: makeActionUse("buckle"),
    buckleFlow: makeActionUse("buckleFlow"),
    color: makeActionUse("color"),
    colorFlow: makeActionUse("colorFlow"),
    bothColorAndBuckle: {
      // A participant can count only once for "both", so its average is the
      // proportion of behaviors belonging to participants who used both modes.
      average: items.length ? bothParticipants / items.length : 0,
      participantPercentage: participantCount ? (bothParticipants / participantCount) * 100 : 0,
    },
  };
};

const formatActionUse = (value: ActionUse) => `${value.average.toFixed(2)} avg · ${value.participantPercentage.toFixed(0)}%`;

const getFlowWaves = (direction: string): Array<Array<[number, number]>> => {
  if (direction === "left_to_right" || direction === "right_to_left") {
    const columns = direction === "left_to_right" ? [...Array(COLS).keys()] : [...Array(COLS).keys()].reverse();
    return columns.map((col) => [...Array(ROWS).keys()].map((row) => [row, col] as [number, number]));
  }
  const centerRow = Math.floor(ROWS / 2);
  const centerCol = Math.floor(COLS / 2);
  const waves = new Map<number, Array<[number, number]>>();
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const distance = Math.abs(row - centerRow) + Math.abs(col - centerCol);
      waves.set(distance, [...(waves.get(distance) ?? []), [row, col]]);
    }
  }
  return [...waves.entries()].sort(([a], [b]) => a - b).map(([, wave]) => wave);
};

const eventDuration = (event: RecordingEvent) => {
  if (event.action === "color_flow") return COLS * FLOW_HOP_DELAY + COLOR_STEPS * COLOR_STEP_DELAY;
  if (event.action === "buckle_flow") return ROWS * COLS * BUCKLE_FLOW_OFFSET + BUCKLE_DURATION;
  if (event.action === "color_all" || event.action === "color_selected") return COLOR_STEPS * COLOR_STEP_DELAY;
  return 300;
};

function ReplayGarden({ behaviour, playNonce }: { behaviour: Behaviour | null; playNonce: number }) {
  const [grid, setGrid] = useState<Cell[][]>(() => createGrid());
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const gridRef = useRef<Cell[][]>(createGrid());
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const updateGrid = (updater: (draft: Cell[][]) => void) => {
    const next = cloneGrid(gridRef.current);
    updater(next);
    gridRef.current = next;
    setGrid(next);
  };

  useEffect(() => {
    clearTimers();
    const reset = createGrid();
    gridRef.current = reset;
    setGrid(reset);
    setActiveStep(null);
    setIsPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [behaviour?.id]);

  useEffect(() => {
    if (!playNonce || !behaviour) return;
    clearTimers();
    const reset = createGrid();
    gridRef.current = reset;
    setGrid(reset);
    setIsPlaying(true);
    let offset = 0;

    const schedule = (callback: () => void, delay: number) => {
      timersRef.current.push(window.setTimeout(callback, delay));
    };
    const fadeCells = (cells: Array<[number, number]>, target: string, delay = 0) => {
      const starts = cells.map(([row, col]) => ({ row, col, color: gridRef.current[row][col].color }));
      const targetRgb = hexToRgb(target).map((value) => Math.round(value * 255));
      starts.forEach(({ row, col, color }) => {
        const startRgb = hexToRgb(color).map((value) => Math.round(value * 255));
        for (let step = 0; step <= COLOR_STEPS; step += 1) {
          schedule(() => updateGrid((draft) => {
            const progress = step / COLOR_STEPS;
            const rgb = startRgb.map((value, index) => Math.round(value + (targetRgb[index] - value) * progress));
            draft[row][col].color = `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
          }), delay + step * COLOR_STEP_DELAY);
        }
      });
    };
    const runEvent = (event: RecordingEvent) => {
      const data = event.data ?? {};
      if (event.action === "color_all" || event.action === "color_selected") {
        const selected = event.action === "color_selected" ? selectedIndices(data.selected) : null;
        const cells = Array.from({ length: ROBOT_COUNT }, (_, index) => [Math.floor(index / COLS), index % COLS] as [number, number])
          .filter(([row, col]) => !selected || selected.has(row * COLS + col));
        fadeCells(cells, String(data.color ?? "#007fff"));
      } else if (event.action === "color_flow") {
        getFlowWaves(String(data.direction ?? "left_to_right")).forEach((wave, index) => fadeCells(wave, String(data.color ?? "#007fff"), index * FLOW_HOP_DELAY));
      } else if (event.action === "buckle_all" || event.action === "buckle_selected") {
        const selected = event.action === "buckle_selected" ? selectedIndices(data.selected) : null;
        const level = Number(data.val ?? DEFAULT_LEVEL);
        updateGrid((draft) => draft.forEach((row) => row.forEach((cell) => {
          if (!selected || selected.has(cell.row * COLS + cell.col)) cell.level = level;
        })));
      } else if (event.action === "buckle_flow") {
        getFlowWaves(String(data.direction ?? "left_to_right")).flat().forEach(([row, col], index) => {
          for (let step = 0; step <= BUCKLE_DURATION / BUCKLE_STEP_DELAY; step += 1) {
            schedule(() => updateGrid((draft) => {
              draft[row][col].level = Math.round(DEFAULT_LEVEL + (1 - DEFAULT_LEVEL) * (step / (BUCKLE_DURATION / BUCKLE_STEP_DELAY)));
            }), index * BUCKLE_FLOW_OFFSET + step * BUCKLE_STEP_DELAY);
          }
        });
      }
    };

    behaviour.events.forEach((event, index) => {
      schedule(() => {
        setActiveStep(index);
        runEvent(event);
      }, offset);
      offset += eventDuration(event) + REPLAY_PAUSE;
    });
    schedule(() => {
      setActiveStep(null);
      setIsPlaying(false);
    }, offset);

    return clearTimers;
    // `playNonce` is deliberately the trigger.  A click starts both gardens
    // from the same render cycle, even if the selected behaviors are unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playNonce]);

  return (
    <article className="reward-garden">
      <div className="reward-garden-heading">
        <strong>{behaviour?.participantId ?? "Select a participant"}</strong>
        <span>{behaviour ? `${behaviour.events.length} steps${isPlaying && activeStep !== null ? ` · Playing step ${activeStep + 1}` : ""}` : ""}</span>
      </div>
      <div className="swarm-grid reward-swarm-grid" aria-label="Participant replay grid">
        {grid.flat().map((cell) => (
          <div key={`${cell.row}:${cell.col}`} className="swarm-cell behaviour-cell" style={{ background: cell.color }}>
            <Image src={levelImage(cell.level)} alt="" width={80} height={80} className="swarm-image" />
          </div>
        ))}
      </div>
    </article>
  );
}

const eventLabel = (event: RecordingEvent) => {
  const data = event.data ?? {};
  const direction = data.direction ? ` ${String(data.direction).replaceAll("_", " ")}` : "";
  const color = data.color ? ` ${String(data.color)}` : "";
  const level = data.val ? ` level ${String(data.val)}` : "";
  return `${event.action.replaceAll("_", " ")}${direction}${color}${level}`;
};

export default function RewardTest() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [records, setRecords] = useState<StudyRecord[]>([]);
  const [prompt, setPrompt] = useState("");
  const [condition, setCondition] = useState("");
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");
  const [pilotResults, setPilotResults] = useState<PilotResult[]>([]);
  const [selectedPilotId, setSelectedPilotId] = useState("");
  const [playNonce, setPlayNonce] = useState(0);

  useEffect(() => {
    if (window.sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === "true") setUnlocked(true);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    const load = async () => {
      const db = getFirebaseDb();
      if (!db) {
        setMessage("Firebase is not configured for this app.");
        return;
      }
      try {
        setMessage("Loading study data...");
        const snapshot = await getDocs(collection(db, "recordings"));
        const allRecords = extractRecords(snapshot.docs.map((doc) => ({ _docId: doc.id, ...doc.data() })));
        // The reward tool intentionally uses only the 104 records retained in
        // the cleaned Prolific export.  Manual entries and discarded duplicate
        // runs are filtered out before they reach any selector or calculation.
        const nextRecords = allRecords.flatMap((record) => {
          const metadata = CLEANED_PROLIFIC_STUDIES.get(record.studyRunId || record._docId || "");
          if (!record.prolificPid || !metadata) return [];
          // Firebase records predate the condition annotations.  Attach the
          // trusted metadata from the cleaned export before grouping records.
          return [{
            ...record,
            condition: metadata.condition ?? undefined,
            condition_description: metadata.conditionDescription ?? undefined,
          }];
        });
        setRecords(nextRecords);
        setMessage(
          nextRecords.length
            ? `Loaded ${nextRecords.length} cleaned Prolific study records.`
            : "No cleaned Prolific study records found in Firebase.",
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load Firebase data.");
      }
    };
    void load();
  }, [unlocked]);

  const behaviours = useMemo(() => extractBehaviours(records), [records]);
  const prompts = useMemo(() => [...new Set(behaviours.map((behaviour) => behaviour.prompt))].sort(), [behaviours]);
  const promptCandidates = useMemo(() => behaviours.filter((behaviour) => behaviour.prompt === prompt), [behaviours, prompt]);
  const conditions = useMemo(
    () => [...new Set(promptCandidates.map((behaviour) => behaviour.condition))].sort(),
    [promptCandidates],
  );
  // All selectable participants are filtered to one condition.  This ensures
  // that manual comparisons and low/middle/high presets never cross conditions.
  const candidates = useMemo(
    () => (condition ? promptCandidates.filter((behaviour) => behaviour.condition === condition) : promptCandidates),
    [promptCandidates, condition],
  );
  const pilotComparisons = useMemo<PilotComparison[]>(
    () => pilotResults.map((result, index) => {
      const id = `${result.model || "Claude"}-${result.target_behaviour_id || index}`;
      const description = result.target_description || "Untitled behavior";
      const runId = result.target_run_key || "held-out run";
      return {
        id,
        model: result.model || "Claude",
        description,
        target: {
          id: `${id}-participant`,
          participantId: "Participant original",
          runId,
          prompt: description,
          rawPrompt: description,
          condition: "Held-out test behavior",
          events: result.target_events ?? [],
        },
        prediction: {
          id: `${id}-model`,
          participantId: result.model || "Claude prediction",
          runId,
          prompt: description,
          rawPrompt: description,
          condition: "LLM prediction",
          events: result.predicted_events ?? [],
        },
      };
    }),
    [pilotResults],
  );
  const selectedPilot = selectedPilotId
    ? pilotComparisons.find((item) => item.id === selectedPilotId) ?? pilotComparisons[0] ?? null
    : null;
  const conditionActionSummaries = useMemo(() => {
    const groups = new Map<string, Behaviour[]>();
    behaviours.forEach((behaviour) => groups.set(behaviour.condition, [...(groups.get(behaviour.condition) ?? []), behaviour]));
    const perCondition = [...groups.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([label, items]) => summarizeActionUse(label, items));
    return [summarizeActionUse("All conditions", behaviours), ...perCondition];
  }, [behaviours]);
  const first = selectedPilot ? selectedPilot.target : candidates.find((behaviour) => behaviour.id === firstId) ?? null;
  const second = selectedPilot ? selectedPilot.prediction : candidates.find((behaviour) => behaviour.id === secondId) ?? null;
  const reward = useMemo(() => (first && second ? calculateReward(first.events, second.events) : null), [first, second]);
  const comparisonPresets = useMemo<ComparisonPreset[]>(() => {
    const pairs: Array<Omit<ComparisonPreset, "label">> = [];
    for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < candidates.length; secondIndex += 1) {
        pairs.push({
          firstId: candidates[firstIndex].id,
          secondId: candidates[secondIndex].id,
          reward: calculateReward(candidates[firstIndex].events, candidates[secondIndex].events).reward,
        });
      }
    }
    if (!pairs.length) return [];

    const sorted = [...pairs].sort((firstPair, secondPair) => firstPair.reward - secondPair.reward);
    const median = sorted[Math.floor(sorted.length / 2)].reward;
    const middle = sorted.reduce((closest, pair) =>
      Math.abs(pair.reward - median) < Math.abs(closest.reward - median) ? pair : closest,
    );
    return [
      { label: "Lowest similarity", ...sorted[0] },
      { label: "Middle similarity", ...middle },
      { label: "Highest similarity", ...sorted[sorted.length - 1] },
    ];
  }, [candidates]);

  useEffect(() => {
    if (!prompt && prompts[0]) setPrompt(prompts[0]);
  }, [prompt, prompts]);

  useEffect(() => {
    if (condition && !conditions.includes(condition)) setCondition("");
  }, [condition, conditions]);

  useEffect(() => {
    if (!candidates.length) {
      setFirstId("");
      setSecondId("");
      return;
    }
    if (!candidates.some((candidate) => candidate.id === firstId)) setFirstId(candidates[0].id);
    if (!candidates.some((candidate) => candidate.id === secondId)) setSecondId(candidates[1]?.id || candidates[0].id);
  }, [candidates, firstId, secondId]);

  const unlock = () => {
    if (password !== ADMIN_PASSWORD) {
      setMessage("Incorrect password.");
      return;
    }
    window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, "true");
    setUnlocked(true);
    setMessage("Reward test unlocked.");
  };

  const applyPreset = (preset: ComparisonPreset) => {
    setSelectedPilotId("");
    setFirstId(preset.firstId);
    setSecondId(preset.secondId);
  };

  const handlePilotUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parsePilotUpload(await file.text());
      if (!parsed.length) {
        setMessage("No pilot predictions found. Upload results.json or results.jsonl from the Claude pilot.");
        setPilotResults([]);
        return;
      }
      setPilotResults(parsed);
      setSelectedPilotId(`${parsed[0].model || "Claude"}-${parsed[0].target_behaviour_id || 0}`);
      setMessage(`Loaded ${parsed.length} model prediction${parsed.length === 1 ? "" : "s"}. Choose one below to compare it with the held-out participant behavior.`);
    } catch (error) {
      setPilotResults([]);
      setSelectedPilotId("");
      setMessage(error instanceof Error ? error.message : "Could not read the pilot results file.");
    } finally {
      // Allow re-uploading the same file after a refresh or updated pilot.
      event.target.value = "";
    }
  };

  if (!unlocked) {
    return (
      <main className="page-shell">
        <section className="hero"><div className="application-hero"><h1>Reward Test</h1></div><p className="intro-text">Enter the admin password to compare participant behaviors.</p></section>
        <section className="controls-card admin-panel">
          <div className="toolbar admin-upload-row">
            <label className="field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && unlock()} placeholder="Enter admin password" /></label>
            <button onClick={unlock}>Unlock</button>
          </div>
          {message ? <p className="control-hint admin-message">{message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell reward-test-page">
      <section className="hero"><div className="application-hero"><h1>Reward Test</h1></div><p className="intro-text">Compare two participant implementations of the same provided prompt and inspect the step-level reward.</p></section>
      <section className="controls-card admin-panel reward-controls">
        <div className="toolbar admin-upload-row">
          <label className="field field-wide"><span>Claude pilot results</span><input type="file" accept=".json,.jsonl,application/json" onChange={handlePilotUpload} /></label>
          {pilotComparisons.length ? (
            <>
              <label className="field field-wide"><span>LLM comparison</span><select value={selectedPilotId} onChange={(event) => setSelectedPilotId(event.target.value)}>{pilotComparisons.map((item) => <option key={item.id} value={item.id}>{item.model} · {item.description}</option>)}</select></label>
              <button className="ghost" onClick={() => setSelectedPilotId("")}>Use participant comparison</button>
            </>
          ) : <p className="control-hint">Upload the pilot&apos;s <code>results.jsonl</code> or <code>results.json</code> to compare a participant with Sonnet or Haiku.</p>}
        </div>
        <div className="toolbar admin-upload-row">
          <label className="field field-wide"><span>Provided prompt</span><select value={prompt} onChange={(event) => { setSelectedPilotId(""); setPrompt(event.target.value); }} disabled={!prompts.length}><option value="">Select prompt</option>{prompts.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="field field-wide"><span>Condition</span><select value={condition} onChange={(event) => { setSelectedPilotId(""); setCondition(event.target.value); }} disabled={!conditions.length}><option value="">All conditions</option>{conditions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="field"><span>Participant 1</span><select value={firstId} onChange={(event) => { setSelectedPilotId(""); setFirstId(event.target.value); }} disabled={!candidates.length}>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.participantId} · {candidate.runId}</option>)}</select></label>
          <label className="field"><span>Participant 2</span><select value={secondId} onChange={(event) => { setSelectedPilotId(""); setSecondId(event.target.value); }} disabled={!candidates.length}>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.participantId} · {candidate.runId}</option>)}</select></label>
          <button onClick={() => setPlayNonce((current) => current + 1)} disabled={!first || !second}>Play both</button>
        </div>
        <div className="reward-preset-row" aria-label="Comparison presets">
          <span>Quick comparisons</span>
          {comparisonPresets.length === 0 ? <em>Select a prompt with at least two saved behaviors.</em> : comparisonPresets.map((preset) => (
            <button key={preset.label} className="ghost reward-preset-button" onClick={() => applyPreset(preset)}>
              {preset.label}: {preset.reward.toFixed(3)}
            </button>
          ))}
        </div>
        {message ? <p className="control-hint admin-message">{message}</p> : null}
      </section>

      <section className="reward-gardens">
        <ReplayGarden behaviour={first} playNonce={playNonce} />
        <ReplayGarden behaviour={second} playNonce={playNonce} />
      </section>

      <section className="library-card reward-condition-summary">
        <div className="library-header"><div><h2>Action Use by Condition</h2><p>Average event count per provided-prompt behavior and percent of participants who used each action type.</p></div></div>
        <div className="reward-table-wrap">
          <table className="reward-table">
            <thead><tr><th>Condition</th><th>Behaviors</th><th>Participants</th><th>Buckle</th><th>Buckle Flow</th><th>Color</th><th>Color Flow</th><th>Both Color + Buckle</th></tr></thead>
            <tbody>{conditionActionSummaries.map((summary) => (
              <tr key={summary.condition} className={condition === summary.condition || (!condition && summary.condition === "All conditions") ? "selected" : ""}>
                <th>{summary.condition}</th><td>{summary.behaviourCount}</td><td>{summary.participantCount}</td><td>{formatActionUse(summary.buckle)}</td><td>{formatActionUse(summary.buckleFlow)}</td><td>{formatActionUse(summary.color)}</td><td>{formatActionUse(summary.colorFlow)}</td><td>{formatActionUse(summary.bothColorAndBuckle)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="library-card reward-summary">
        <div className="library-header"><div><h2>Reward Breakdown</h2><p>{selectedPilot ? `Participant original vs ${selectedPilot.model}.` : "The score uses the current step-level reward function."}</p></div>{reward ? <strong className="reward-score">{reward.reward.toFixed(3)}</strong> : null}</div>
        {!reward || !first || !second ? <p className="empty-state">Choose one prompt and two participant implementations to calculate the reward.</p> : (
          <>
            <p className="reward-formula"><code>reward = matched contributions / longer behavior length = {reward.rawMatchedReward.toFixed(3)} / {reward.denominator} = {reward.reward.toFixed(3)}</code></p>
            <div className="reward-explainer"><span>{reward.matches.length} matched step pairs</span><span>{reward.unmatchedFirst} unmatched step{reward.unmatchedFirst === 1 ? "" : "s"} for {selectedPilot ? "the participant" : "participant 1"}</span><span>{reward.unmatchedSecond} unmatched step{reward.unmatchedSecond === 1 ? "" : "s"} for {selectedPilot ? selectedPilot.model : "participant 2"}</span></div>
            <div className="reward-match-list">
              {reward.matches.length === 0 ? <p className="empty-state">These behaviors have no matching action modes.</p> : reward.matches.map((match) => (
                <article key={`${match.firstIndex}-${match.secondIndex}`} className="reward-match">
                  <div><strong>{selectedPilot ? "Participant" : "P1"} step {match.firstIndex + 1}</strong><p>{eventLabel(first.events[match.firstIndex])}</p></div>
                  <div><strong>{selectedPilot?.model ?? "P2"} step {match.secondIndex + 1}</strong><p>{eventLabel(second.events[match.secondIndex])}</p></div>
                  <div className="reward-numbers"><span>Step similarity: {match.stepSimilarity.toFixed(3)}</span><span>Position similarity: {match.positionSimilarity.toFixed(3)}</span><strong>Contribution: {match.contribution.toFixed(3)}</strong></div>
                </article>
              ))}
            </div>
            <p className="control-hint">A contribution is calculated as <code>step similarity × (0.85 + 0.15 × position similarity)</code>. Flow, all, and selected actions only match the same action mode.</p>
          </>
        )}
      </section>
    </main>
  );
}
