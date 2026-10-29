export interface ScoreEntry {
  name: string;
  score: number;
  len: number;
  date: string;
}

const KEY = "neon-snake-scores-v1";
const MAX = 5;

export function getScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (e): e is ScoreEntry =>
          e && typeof e.score === "number" && typeof e.name === "string"
      )
      .map((e) => ({
        name: String(e.name).slice(0, 8).toUpperCase() || "YOU",
        score: e.score,
        len: typeof e.len === "number" ? e.len : 0,
        date: typeof e.date === "string" ? e.date : "",
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function addScore(name: string, score: number, len: number): ScoreEntry[] {
  const list = getScores();
  list.push({
    name: (name.trim() || "YOU").toUpperCase().slice(0, 8),
    score,
    len,
    date: new Date().toISOString().slice(0, 10),
  });
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(top));
  } catch {
    /* storage unavailable — play on */
  }
  return top;
}

export function qualifies(score: number): boolean {
  if (score <= 0) return false;
  const list = getScores();
  return list.length < MAX || score > list[list.length - 1].score;
}
