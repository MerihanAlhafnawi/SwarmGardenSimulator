export const REVIEW_RECORDINGS_STORAGE_KEY = "swarm-review-recordings";

export type ReviewRecording = {
  id: string;
  title: string;
  notes: string;
  createdAtLabel: string;
  eventCount: number;
};

export function getStoredReviewRecordings(): ReviewRecording[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(REVIEW_RECORDINGS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as ReviewRecording[];
  } catch {
    return [];
  }
}

export function storeReviewRecordings(recordings: ReviewRecording[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(REVIEW_RECORDINGS_STORAGE_KEY, JSON.stringify(recordings));
}
