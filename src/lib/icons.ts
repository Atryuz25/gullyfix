import { IssueCategory } from "@/lib/types";

export const getCategoryIcon = (category: IssueCategory): string => {
  switch (category) {
    case "road_damage": return "🕳️";
    case "water_leakage": return "💧";
    case "waste": return "🗑️";
    case "streetlight": return "💡";
    default: return "📍";
  }
};
