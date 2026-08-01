import type { Decision, ItemStatus, RevenueInsight } from "./types";

export interface BriefingState {
  insights: RevenueInsight[];
  decisions: Decision[];
}

export type BriefingAction =
  | { type: "set-insight-status"; id: string; status: ItemStatus }
  | { type: "edit-insight"; id: string; recommendation: string }
  | { type: "set-decision-status"; id: string; status: ItemStatus }
  | { type: "edit-decision"; id: string; recommendation: string };

export function briefingReducer(state: BriefingState, action: BriefingAction): BriefingState {
  switch (action.type) {
    case "set-insight-status":
      return { ...state, insights: state.insights.map((item) => item.id === action.id ? { ...item, status: action.status } : item) };
    case "edit-insight":
      return { ...state, insights: state.insights.map((item) => item.id === action.id ? { ...item, recommendedAction: action.recommendation } : item) };
    case "set-decision-status":
      return { ...state, decisions: state.decisions.map((item) => item.id === action.id ? { ...item, status: action.status } : item) };
    case "edit-decision":
      return { ...state, decisions: state.decisions.map((item) => item.id === action.id ? { ...item, recommendation: action.recommendation } : item) };
  }
}
