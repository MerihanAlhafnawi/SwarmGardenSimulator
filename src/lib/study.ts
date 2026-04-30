import { addDoc, collection, serverTimestamp } from "firebase/firestore";
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
  if (fromSearch.prolificPid || fromSearch.studyId || fromSearch.sessionId) {
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

export async function saveStudyStep({
  studyContext,
  step,
  data,
}: {
  studyContext: StudyContext;
  step: string;
  data: Record<string, unknown>;
}) {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firebase env vars missing");
  }

  return addDoc(collection(db, "recordings"), {
    participantNumber: getParticipantIdentifier(studyContext),
    source: studyContext.source,
    prolificPid: studyContext.prolificPid,
    studyId: studyContext.studyId,
    sessionId: studyContext.sessionId,
    manualParticipantId: studyContext.manualParticipantId,
    step,
    data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
