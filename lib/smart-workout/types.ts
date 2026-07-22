export type WorkoutStrategy = "balanced" | "progressive" | "low-fatigue";

export type WorkoutStrategyDefinition = {
  value: WorkoutStrategy;
  title: string;
  description: string;
};

export type HistoryConfidence = "none" | "low" | "medium" | "high";

export type WorkoutRecommendationMetadata = {
  strategy: WorkoutStrategy;
  title: string;
  summary: string;
  reasons: string[];
  warnings: string[];
  estimatedMinutes: number;
  historyConfidence: HistoryConfidence;
};

export const WORKOUT_STRATEGIES: WorkoutStrategyDefinition[] = [
  {
    value: "balanced",
    title: "Balanced Session",
    description: "A practical mix of compound and isolation exercises.",
  },
  {
    value: "progressive",
    title: "Progression Focus",
    description: "Prioritizes exercises with useful local performance history.",
  },
  {
    value: "low-fatigue",
    title: "Low-Fatigue Session",
    description: "Uses fewer sets and favors stable, less demanding movements.",
  },
];

export function getStrategyDefinition(strategy: WorkoutStrategy): WorkoutStrategyDefinition {
  return WORKOUT_STRATEGIES.find((definition) => definition.value === strategy)!;
}
