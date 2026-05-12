import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

export const STUDY_CONTEXT_STORAGE_KEY = "swarm-study-context";

export type StudyContext = {
  source: "prolific" | "manual" | "unknown";
  prolificPid: string;
  studyId: string;
  sessionId: string;
  manualParticipantId: string;
};

const EMPTY_STUDY_CONTEXT: StudyContext = {
  source: "unknown",
  prolificPid: "",
  studyId: "",
  sessionId: "",
  manualParticipantId: "",
};

export function getStoredStudyContext(): StudyContext {
  if (typeof window === "undefined") {
    return EMPTY_STUDY_CONTEXT;
  }

  const raw = window.localStorage.getItem(STUDY_CONTEXT_STORAGE_KEY);
  if (!raw) {
    return EMPTY_STUDY_CONTEXT;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StudyContext>;
    return {
      source:
        parsed.source === "prolific" || parsed.source === "manual" || parsed.source === "unknown"
          ? parsed.source
          : "unknown",
      prolificPid: parsed.prolificPid ?? "",
      studyId: parsed.studyId ?? "",
      sessionId: parsed.sessionId ?? "",
      manualParticipantId: parsed.manualParticipantId ?? "",
    };
  } catch {
    return EMPTY_STUDY_CONTEXT;
  }
}

export function storeStudyContext(value: Partial<StudyContext>) {
  if (typeof window === "undefined") {
    return;
  }

  const current = getStoredStudyContext();
  const next = {
    source: value.source ?? current.source,
    prolificPid: value.prolificPid ?? current.prolificPid,
    studyId: value.studyId ?? current.studyId,
    sessionId: value.sessionId ?? current.sessionId,
    manualParticipantId: value.manualParticipantId ?? current.manualParticipantId,
  };
  window.localStorage.setItem(STUDY_CONTEXT_STORAGE_KEY, JSON.stringify(next));
}

export function getStudyContextFromSearch(search: string): Partial<StudyContext> {
  const params = new URLSearchParams(search);
  const prolificPid = params.get("PROLIFIC_PID") ?? "";
  const studyId = params.get("STUDY_ID") ?? "";
  const sessionId = params.get("SESSION_ID") ?? "";
  const manualParticipantId = params.get("PARTICIPANT_ID") ?? "";
  return {
    source: prolificPid ? "prolific" : manualParticipantId ? "manual" : undefined,
    prolificPid,
    studyId,
    sessionId,
    manualParticipantId,
  };
}

export function initializeStudyContextFromSearch(search: string): StudyContext {
  const fromSearch = getStudyContextFromSearch(search);
  if (fromSearch.prolificPid || fromSearch.studyId || fromSearch.sessionId || fromSearch.manualParticipantId) {
    storeStudyContext(fromSearch);
  }
  return getStoredStudyContext();
}

export function getParticipantIdentifier(context: StudyContext) {
  return context.prolificPid || context.manualParticipantId;
}

export function hasRequiredStudyContext(context: StudyContext) {
  return Boolean(getParticipantIdentifier(context));
}

export function buildStudyHref(pathname: string, context: Partial<StudyContext>, extra?: Record<string, string>) {
  const params = new URLSearchParams();
  if (context.prolificPid) {
    params.set("PROLIFIC_PID", context.prolificPid);
  }
  if (context.studyId) {
    params.set("STUDY_ID", context.studyId);
  }
  if (context.sessionId) {
    params.set("SESSION_ID", context.sessionId);
  }
  if (context.source === "manual" && context.manualParticipantId) {
    params.set("PARTICIPANT_ID", context.manualParticipantId);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

type StudyStepKey = "describe-behaviour" | "simulation" | "design-behaviour" | "post-study-survey";

type StudyRecord = {
  participantNumber: string;
  source: StudyContext["source"];
  prolificPid: string;
  studyId: string;
  sessionId: string;
  manualParticipantId: string;
  steps?: {
    describeBehaviour?: {
      step: "describe-behaviour";
      submittedAt: string;
      data: Record<string, unknown>;
    };
    implementedBehaviours?: Array<{
      id: string;
      step: "simulation";
      submittedAt: string;
      data: Record<string, unknown>;
    }>;
    designedBehaviours?: Array<{
      id: string;
      step: "design-behaviour";
      submittedAt: string;
      data: Record<string, unknown>;
    }>;
    postStudySurvey?: {
      step: "post-study-survey";
      submittedAt: string;
      data: Record<string, unknown>;
    };
  };
  createdAt?: unknown;
  updatedAt?: unknown;
};

function getStudyRecordId(studyContext: StudyContext) {
  if (studyContext.prolificPid) {
    return `prolific-${studyContext.prolificPid}-${studyContext.sessionId || studyContext.studyId || "session"}`;
  }

  if (studyContext.manualParticipantId) {
    return `manual-${studyContext.manualParticipantId}`;
  }

  throw new Error("Participant identifier missing");
}

async function getExistingStudyRecord(studyContext: StudyContext) {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firebase env vars missing");
  }

  const ref = doc(db, "recordings", getStudyRecordId(studyContext));
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? (snapshot.data() as StudyRecord) : null;
  return { db, ref, existing };
}

function getBaseStudyRecord(studyContext: StudyContext, existing?: StudyRecord | null): StudyRecord {
  return {
    participantNumber: getParticipantIdentifier(studyContext),
    source: studyContext.source,
    prolificPid: studyContext.prolificPid,
    studyId: studyContext.studyId,
    sessionId: studyContext.sessionId,
    manualParticipantId: studyContext.manualParticipantId,
    steps: existing?.steps ?? {},
  };
}

function nowIso() {
  return new Date().toISOString();
}

export async function saveStudyStep({
  studyContext,
  step,
  data,
}: {
  studyContext: StudyContext;
  step: StudyStepKey;
  data: Record<string, unknown>;
}) {
  const { ref, existing } = await getExistingStudyRecord(studyContext);
  const record = getBaseStudyRecord(studyContext, existing);
  const submittedAt = nowIso();

  if (step === "describe-behaviour") {
    record.steps!.describeBehaviour = { step, submittedAt, data };
  }

  if (step === "post-study-survey") {
    record.steps!.postStudySurvey = { step, submittedAt, data };
  }

  await setDoc(
    ref,
    {
      ...record,
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false },
  );

  return { id: ref.id };
}

export async function saveBehaviourRecording({
  studyContext,
  step,
  description,
  events,
}: {
  studyContext: StudyContext;
  step: "simulation" | "design-behaviour";
  description: string;
  events: Record<string, unknown>[];
}) {
  const { ref, existing } = await getExistingStudyRecord(studyContext);
  const record = getBaseStudyRecord(studyContext, existing);
  const submittedAt = nowIso();
  const behaviourId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${step}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let savedEntry;

  if (step === "simulation") {
    const entry = {
      id: behaviourId,
      step: "simulation" as const,
      submittedAt,
      data: {
        description,
        events,
      },
    };
    record.steps!.implementedBehaviours = [...(record.steps!.implementedBehaviours ?? []), entry];
    savedEntry = entry;
  } else {
    const entry = {
      id: behaviourId,
      step: "design-behaviour" as const,
      submittedAt,
      data: {
        description,
        events,
      },
    };
    record.steps!.designedBehaviours = [...(record.steps!.designedBehaviours ?? []), entry];
    savedEntry = entry;
  }

  await setDoc(
    ref,
    {
      ...record,
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false },
  );

  return savedEntry;
}

export async function deleteBehaviourRecording({
  studyContext,
  step,
  behaviourId,
}: {
  studyContext: StudyContext;
  step: "simulation" | "design-behaviour";
  behaviourId: string;
}) {
  const { ref, existing } = await getExistingStudyRecord(studyContext);
  if (!existing) {
    return;
  }

  const record = getBaseStudyRecord(studyContext, existing);
  if (step === "simulation") {
    record.steps!.implementedBehaviours = (record.steps!.implementedBehaviours ?? []).filter(
      (entry) => entry.id !== behaviourId,
    );
  } else {
    record.steps!.designedBehaviours = (record.steps!.designedBehaviours ?? []).filter(
      (entry) => entry.id !== behaviourId,
    );
  }

  await setDoc(
    ref,
    {
      ...record,
      createdAt: existing.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false },
  );
}
