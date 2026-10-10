import { CATEGORIES, categoryOf, classify } from "./constants";

export type QueryIntent = {
  category: string;
  objective: string;
  matched: string[];
  confidence: number;
};

export function getQueryIntent(text: string): QueryIntent {
  const result = classify(text);
  const category = categoryOf(result.id);
  return {
    category: result.id,
    objective: category.label,
    matched: result.matched,
    confidence: Math.max(result.matched.length, 1),
  };
}

export function rankSimilarCases<T extends { category: string; title: string; affectedCount: number }>(
  text: string,
  cases: T[],
) {
  const intent = getQueryIntent(text);
  return [...cases]
    .filter((item) => item.category === intent.category)
    .sort((a, b) => b.affectedCount - a.affectedCount)
    .slice(0, 5);
}

export function buildAssistantContext(problem: string, area: string) {
  const intent = getQueryIntent(problem);
  return {
    area,
    objective: intent.objective,
    category: intent.category,
    categoryLabel: categoryOf(intent.category).label,
    likelyMatches: CATEGORIES.filter((category) => category.id === intent.category).map((category) => ({
      id: category.id,
      label: category.label,
      department: category.department,
      keywords: category.keywords,
    })),
  };
}
