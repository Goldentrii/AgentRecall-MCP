/**
 * Salience scoring for palace memories and rooms.
 *
 * Formula: salience = (importance × 0.4) + (recency × 0.3) + (access_freq × 0.2) + (connections × 0.1)
 */

import type { Importance } from "../types.js";

const IMPORTANCE_WEIGHTS: Record<Importance, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

/** Exponential decay: 0.95^days, floor at 0.05. */
function recencyScore(lastUpdated: string): number {
  const days =
    (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0.05, Math.pow(0.95, days));
}

/** Normalized access frequency: min(1.0, count / 20). */
function accessScore(accessCount: number): number {
  return Math.min(1.0, accessCount / 20);
}

/** Connection score: min(1.0, edgeCount / 10). */
function connectionScore(edgeCount: number): number {
  return Math.min(1.0, edgeCount / 10);
}

export function computeSalience(params: {
  importance: Importance;
  lastUpdated: string;
  accessCount: number;
  connectionCount: number;
}): number {
  const imp = IMPORTANCE_WEIGHTS[params.importance] * 0.4;
  const rec = recencyScore(params.lastUpdated) * 0.3;
  const acc = accessScore(params.accessCount) * 0.2;
  const con = connectionScore(params.connectionCount) * 0.1;
  return Math.round((imp + rec + acc + con) * 1000) / 1000;
}

export const ARCHIVE_THRESHOLD = 0.15;
export const AUTO_ARCHIVE_THRESHOLD = 0.05;
