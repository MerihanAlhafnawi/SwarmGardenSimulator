"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Behaviour, calculateReward, ReplayGarden, type RecordingEvent } from "@/components/RewardTest";

const ADMIN_PASSWORD = "040924";
const ADMIN_AUTH_STORAGE_KEY = "swarm-garden-admin-auth";
const CONDITIONS = ["all_examples", "closest_three", "zero_shot"] as const;

type ConditionName = (typeof CONDITIONS)[number];
type RewardValue = { reward?: number };
type RetrievalItem = {
  rank: number;
  behaviour_id: string;
  description: string;
  description_cosine_similarity?: number;
  target_vs_reference_reward?: RewardValue;
  prediction_vs_reference_reward?: RewardValue;
};
type ReferencePair = { first_behaviour_id: string; second_behaviour_id: string; reward?: RewardValue };
type ResultRow = {
  split_index: number;
  model?: string;
  condition: ConditionName;
  target_behaviour_id: string;
  target_description: string;
  target_events: RecordingEvent[];
  predicted_events: RecordingEvent[];
  valid_prediction?: boolean;
  reward?: RewardValue | null;
  top_k_retrieval?: RetrievalItem[];
  top_k_comparison?: { references?: RetrievalItem[]; pairwise_reference_rewards?: ReferencePair[] };
};
type CleanRecord = { studyRunId?: string; _docId?: string; steps?: { designedBehaviours?: Array<{ data?: { description?: string; events?: RecordingEvent[] } }> } };
type ReferenceBehaviour = { id: string; description: string; events: RecordingEvent[] };

const emptyStats = { count: 0, mean: 0, median: 0, minimum: 0, maximum: 0 };
type Stats = typeof emptyStats;

const parseRows = (text: string): ResultRow[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parsed = (() => {
    try { return JSON.parse(trimmed); } catch { return trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }
  })();
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((value): value is ResultRow => {
    if (!value || typeof value !== "object") return false;
    const item = value as ResultRow;
    return CONDITIONS.includes(item.condition) && typeof item.target_behaviour_id === "string" && Array.isArray(item.target_events);
  });
};

const extractReferences = (value: unknown): Map<string, ReferenceBehaviour> => {
  if (!Array.isArray(value)) return new Map();
  const references = new Map<string, ReferenceBehaviour>();
  value.forEach((record, recordIndex) => {
    const entryList = (record as CleanRecord)?.steps?.designedBehaviours;
    if (!Array.isArray(entryList)) return;
    entryList.forEach((entry, entryIndex) => {
      const data = entry?.data;
      const description = data?.description?.trim() ?? "";
      const events = data?.events?.filter((event) => event && typeof event.action === "string") ?? [];
      if (!description || !events.length) return;
      // This mirrors the Python experiment's stable behavior ID construction.
      references.set(`behaviour-${String(recordIndex).padStart(3, "0")}-${String(entryIndex).padStart(2, "0")}`, {
        id: `behaviour-${String(recordIndex).padStart(3, "0")}-${String(entryIndex).padStart(2, "0")}`,
        description,
        events,
      });
    });
  });
  return references;
};

const statistics = (values: number[]): Stats => {
  if (!values.length) return emptyStats;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return {
    count: values.length,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    median: values.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2,
    minimum: ordered[0],
    maximum: ordered[ordered.length - 1],
  };
};

const rewardNumber = (value: RewardValue | null | undefined) => typeof value?.reward === "number" ? value.reward : null;
const readableCondition = (condition: ConditionName) => condition === "all_examples" ? "All database examples" : condition === "closest_three" ? "Closest three examples" : "Zero-shot";
const score = (value: number | null | undefined) => typeof value === "number" ? value.toFixed(3) : "No valid output";

export default function LlmResults() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [referenceMap, setReferenceMap] = useState<Map<string, ReferenceBehaviour>>(new Map());
  const [targetId, setTargetId] = useState("");
  const [splitIndex, setSplitIndex] = useState(0);
  const [playNonce, setPlayNonce] = useState(0);

  useEffect(() => {
    if (window.sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === "true") setUnlocked(true);
  }, []);

  const targets = useMemo(() => {
    const values = new Map<string, { id: string; description: string }>();
    rows.forEach((row) => values.set(row.target_behaviour_id, { id: row.target_behaviour_id, description: row.target_description }));
    return [...values.values()].sort((a, b) => a.description.localeCompare(b.description));
  }, [rows]);
  const allSplits = useMemo(() => [...new Set(rows.map((row) => row.split_index))].sort((a, b) => a - b), [rows]);
  const targetsInSelectedSplit = useMemo(() => {
    const values = new Map<string, { id: string; description: string }>();
    rows.filter((row) => row.split_index === splitIndex).forEach((row) => values.set(row.target_behaviour_id, { id: row.target_behaviour_id, description: row.target_description }));
    return [...values.values()].sort((a, b) => a.description.localeCompare(b.description));
  }, [rows, splitIndex]);
  const targetRows = useMemo(() => rows.filter((row) => row.target_behaviour_id === targetId), [rows, targetId]);
  const splitOptions = useMemo(() => [...new Set(targetRows.map((row) => row.split_index))].sort((a, b) => a - b), [targetRows]);
  const selectedRows = useMemo(() => targetRows.filter((row) => row.split_index === splitIndex), [targetRows, splitIndex]);
  const selectedByCondition = useMemo(() => new Map(selectedRows.map((row) => [row.condition, row])), [selectedRows]);
  const selectedTarget = selectedRows[0];
  const closestRow = selectedByCondition.get("closest_three");
  const selectedReferences = closestRow?.top_k_retrieval ?? [];

  const conditionStats = useMemo(() => CONDITIONS.map((condition) => ({
    condition,
    stats: statistics(targetRows.filter((row) => row.condition === condition).map((row) => rewardNumber(row.reward)).filter((value): value is number => value !== null)),
  })), [targetRows]);
  const retrievalStats = useMemo(() => {
    const closest = targetRows.filter((row) => row.condition === "closest_three");
    return [1, 2, 3].map((rank) => {
      const values = closest.flatMap((row) => {
        const item = row.top_k_comparison?.references?.find((reference) => reference.rank === rank) ?? row.top_k_retrieval?.find((reference) => reference.rank === rank);
        return item ? [item] : [];
      });
      return {
        rank,
        descriptionCosine: statistics(values.map((item) => item.description_cosine_similarity).filter((value): value is number => typeof value === "number")),
        targetVsReference: statistics(values.map((item) => rewardNumber(item.target_vs_reference_reward)).filter((value): value is number => value !== null)),
        predictionVsReference: statistics(values.map((item) => rewardNumber(item.prediction_vs_reference_reward)).filter((value): value is number => value !== null)),
      };
    });
  }, [targetRows]);
  const pairwiseReferenceStats = useMemo(() => statistics(targetRows.filter((row) => row.condition === "closest_three").flatMap((row) => row.top_k_comparison?.pairwise_reference_rewards ?? []).map((pair) => rewardNumber(pair.reward)).filter((value): value is number => value !== null)), [targetRows]);

  useEffect(() => { if (allSplits.length && !allSplits.includes(splitIndex)) setSplitIndex(allSplits[0]); }, [allSplits, splitIndex]);
  useEffect(() => {
    if (!targetsInSelectedSplit.length) return;
    if (!targetsInSelectedSplit.some((target) => target.id === targetId)) setTargetId(targetsInSelectedSplit[0].id);
  }, [targetId, targetsInSelectedSplit]);
  useEffect(() => { if (splitOptions.length && !splitOptions.includes(splitIndex)) setSplitIndex(splitOptions[0]); }, [splitIndex, splitOptions]);

  const unlock = () => {
    if (password !== ADMIN_PASSWORD) { setMessage("Incorrect password."); return; }
    window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, "true");
    setUnlocked(true);
    setMessage("LLM results viewer unlocked.");
  };
  const uploadResults = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const loaded = parseRows(await file.text());
      if (!loaded.length) throw new Error("No LLM experiment rows found. Upload the completed results.jsonl file.");
      setRows(loaded); setTargetId(""); setSplitIndex(Math.min(...loaded.map((row) => row.split_index))); setMessage(`Loaded ${loaded.length} experiment calls for ${new Set(loaded.map((row) => row.target_behaviour_id)).size} held-out behaviors.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not read experiment results."); }
    finally { event.target.value = ""; }
  };
  const uploadReferences = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const found = extractReferences(JSON.parse(await file.text()));
      if (!found.size) throw new Error("No own designed behaviors found in this cleaned Prolific JSON.");
      setReferenceMap(found); setMessage(`Loaded ${found.size} replayable reference behaviors from the cleaned Prolific data.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not read cleaned Prolific data."); }
    finally { event.target.value = ""; }
  };

  if (!unlocked) return <main className="page-shell"><section className="hero"><div className="application-hero"><h1>LLM Results Viewer</h1></div><p className="intro-text">Enter the admin password to inspect the completed LLM experiment.</p></section><section className="controls-card admin-panel"><div className="toolbar admin-upload-row"><label className="field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && unlock()} /></label><button onClick={unlock}>Unlock</button></div>{message ? <p className="control-hint admin-message">{message}</p> : null}</section></main>;

  const targetBehaviour: Behaviour | null = selectedTarget ? { id: `${selectedTarget.target_behaviour_id}-target`, participantId: "Original participant behavior", runId: selectedTarget.target_behaviour_id, prompt: selectedTarget.target_description, rawPrompt: selectedTarget.target_description, condition: "Held-out target", events: selectedTarget.target_events } : null;
  const predictionGardens = CONDITIONS.map((condition): Behaviour | null => {
    const row = selectedByCondition.get(condition);
    return row ? { id: `${row.target_behaviour_id}-${row.split_index}-${condition}`, participantId: readableCondition(condition), runId: `Similarity: ${score(rewardNumber(row.reward))}`, prompt: row.target_description, rawPrompt: row.target_description, condition, events: row.predicted_events ?? [] } : null;
  });
  const referenceGardens = selectedReferences.map((reference) => {
    const actual = referenceMap.get(reference.behaviour_id);
    return actual ? { id: `${actual.id}-${splitIndex}`, participantId: `Reference ${reference.rank}`, runId: actual.description, prompt: actual.description, rawPrompt: actual.description, condition: "Closest-three database reference", events: actual.events } satisfies Behaviour : null;
  });

  return <main className="page-shell reward-test-page llm-results-page">
    <section className="hero"><div className="application-hero"><h1>LLM Results Viewer</h1></div><p className="intro-text">Inspect every held-out participant behavior across all randomized splits and prompting conditions.</p></section>
    <section className="controls-card admin-panel reward-controls"><div className="toolbar admin-upload-row"><label className="field field-wide"><span>1. Completed experiment results: results.jsonl</span><input type="file" accept=".jsonl,.json,application/json" onChange={uploadResults} /></label><label className="field field-wide"><span>2. Cleaned Prolific data: all-study-data-prolific-conditions.json</span><input type="file" accept=".json,application/json" onChange={uploadReferences} /></label></div><p className="control-hint">The manifest is not needed. The second file is only needed to replay the top-three references; the original behavior and all LLM outputs work with <code>results.jsonl</code> alone.</p>{rows.length ? <div className="toolbar admin-upload-row"><label className="field"><span>1. Randomized split</span><select value={splitIndex} onChange={(event) => setSplitIndex(Number(event.target.value))}>{allSplits.map((split) => <option key={split} value={split}>Split {split + 1}</option>)}</select></label><label className="field field-wide"><span>2. Participant behavior description</span><select value={targetId} onChange={(event) => setTargetId(event.target.value)}>{targetsInSelectedSplit.map((target) => <option key={target.id} value={target.id}>{target.description} · {target.id}</option>)}</select></label><button onClick={() => setPlayNonce((value) => value + 1)} disabled={!selectedTarget}>Play all displayed</button></div> : null}{message ? <p className="control-hint admin-message">{message}</p> : null}</section>
    {!selectedTarget ? <section className="library-card llm-empty"><p>Upload the completed <code>results.jsonl</code> file to begin.</p></section> : <>
      <section className="library-card llm-selected-summary"><h2>Selected behavior</h2><p>{selectedTarget.target_description}</p><p className="control-hint">This behavior appears in {splitOptions.length} randomized splits. The selected split determines the exact closest-three references and all three LLM outputs shown below.</p></section>
      <section className="reward-gardens llm-gardens"><ReplayGarden behaviour={targetBehaviour} playNonce={playNonce} />{predictionGardens.map((behaviour, index) => <ReplayGarden key={CONDITIONS[index]} behaviour={behaviour} playNonce={playNonce} />)}</section>
      <section className="library-card reward-condition-summary"><div className="library-header"><div><h2>LLM Similarity to Original, Across All Splits</h2><p>Reward of each generated behavior against this participant&apos;s original implementation.</p></div></div><div className="reward-table-wrap"><table className="reward-table"><thead><tr><th>Condition</th><th>Valid calls</th><th>Mean</th><th>Median</th><th>Min</th><th>Max</th><th>Selected split</th></tr></thead><tbody>{conditionStats.map(({ condition, stats }) => <tr key={condition}><th>{readableCondition(condition)}</th><td>{stats.count}</td><td>{stats.mean.toFixed(3)}</td><td>{stats.median.toFixed(3)}</td><td>{stats.minimum.toFixed(3)}</td><td>{stats.maximum.toFixed(3)}</td><td>{score(rewardNumber(selectedByCondition.get(condition)?.reward))}</td></tr>)}</tbody></table></div></section>
      <section className="library-card reward-condition-summary"><div className="library-header"><div><h2>Closest-Three Reference Behaviors</h2><p>These are the three examples Claude saw only in the closest-three condition for this split.</p></div></div>{!referenceMap.size ? <p className="control-hint">Upload the cleaned Prolific JSON above to replay the top-three reference behaviors.</p> : <div className="reward-gardens llm-gardens">{referenceGardens.map((behaviour, index) => behaviour ? <ReplayGarden key={behaviour.id} behaviour={behaviour} playNonce={playNonce} /> : <p key={selectedReferences[index]?.behaviour_id} className="empty-state">Reference {index + 1} was not found in the uploaded data.</p>)}</div>}<div className="reward-table-wrap"><table className="reward-table"><thead><tr><th>Rank</th><th>Description cosine</th><th>Original vs reference</th><th>Closest-three LLM vs reference</th></tr></thead><tbody>{selectedReferences.map((reference) => { const comparison = closestRow?.top_k_comparison?.references?.find((item) => item.rank === reference.rank); return <tr key={reference.rank}><th>{reference.rank}: {reference.description}</th><td>{score(reference.description_cosine_similarity)}</td><td>{score(rewardNumber(reference.target_vs_reference_reward))}</td><td>{score(rewardNumber(comparison?.prediction_vs_reference_reward))}</td></tr>; })}</tbody></table></div><div className="reward-explainer llm-reference-pairs">{(closestRow?.top_k_comparison?.pairwise_reference_rewards ?? []).map((pair) => <span key={`${pair.first_behaviour_id}-${pair.second_behaviour_id}`}>Reference {selectedReferences.find((item) => item.behaviour_id === pair.first_behaviour_id)?.rank ?? "?"} vs {selectedReferences.find((item) => item.behaviour_id === pair.second_behaviour_id)?.rank ?? "?"}: {score(rewardNumber(pair.reward))}</span>)}</div></section>
      <section className="library-card reward-condition-summary"><div className="library-header"><div><h2>Closest-Three Statistics, Across All Splits</h2><p>Reference retrieval and behavior similarity for this same held-out participant behavior.</p></div></div><div className="reward-table-wrap"><table className="reward-table"><thead><tr><th>Reference rank</th><th>Mean description cosine</th><th>Mean original vs reference</th><th>Mean LLM vs reference</th></tr></thead><tbody>{retrievalStats.map((item) => <tr key={item.rank}><th>Top {item.rank}</th><td>{item.descriptionCosine.mean.toFixed(3)} ({item.descriptionCosine.count})</td><td>{item.targetVsReference.mean.toFixed(3)} ({item.targetVsReference.count})</td><td>{item.predictionVsReference.mean.toFixed(3)} ({item.predictionVsReference.count})</td></tr>)}</tbody></table></div><p className="control-hint">Mean pairwise similarity among the three retrieved reference implementations: <strong>{pairwiseReferenceStats.mean.toFixed(3)}</strong> across {pairwiseReferenceStats.count} reference pairs.</p></section>
    </>}</main>;
}
