import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

export const PARTICIPANT_STORAGE_KEY = "swarm-participant-number";

export function getStoredParticipantNumber() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(PARTICIPANT_STORAGE_KEY) ?? "";
}

export function storeParticipantNumber(value: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, value);
}

export async function saveStudyStep({
  participantNumber,
  step,
  data,
}: {
  participantNumber: string;
  step: string;
  data: Record<string, unknown>;
}) {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firebase env vars missing");
  }

  return addDoc(collection(db, "studyResponses"), {
    participantNumber,
    step,
    data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
