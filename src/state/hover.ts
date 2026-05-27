import type { Reducer } from "@zaymonoid/katha";
import type { Action } from "./root";

// ============================================================================
// Actions
// ============================================================================

export type HoverAction =
  | { id: "hover/set"; data: { routeId: string; index: number } }
  | { id: "hover/clear" };

// ============================================================================
// State
// ============================================================================

export type HoverState = {
  hoveredHandle: { routeId: string; index: number } | null;
};

export const hoverInitialState: HoverState = { hoveredHandle: null };

// ============================================================================
// Reducer
// ============================================================================

export const hoverReducer: Reducer<HoverState, Action> = (_state, action) => {
  switch (action.id) {
    case "hover/set":
      return { hoveredHandle: action.data };
    case "hover/clear":
      return { hoveredHandle: null };
    case "tool/set":
      // Clear hover when leaving the branch tool.
      return action.data === "branch" ? undefined : { hoveredHandle: null };
    default:
      return undefined;
  }
};
