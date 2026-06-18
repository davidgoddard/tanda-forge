export type LibraryWorkflowReadiness = "idle" | "pass" | "warn" | "fail";

export type LibraryWorkflowStepKey =
  | "roots"
  | "legacy-styles"
  | "legacy-import"
  | "analysis"
  | "verify";

export type LibraryWorkflowStepStatus =
  | "pending"
  | "current"
  | "complete"
  | "optional"
  | "attention";

export type LibraryWorkflowState = {
  hasMusicRoot: boolean;
  hasCortinaRoot: boolean;
  legacyDetected: boolean;
  legacyStylesReviewed: boolean;
  legacyImported: boolean;
  analysisCompleted: boolean;
  readiness: LibraryWorkflowReadiness;
};

export type LibraryWorkflowStep = {
  key: LibraryWorkflowStepKey;
  status: LibraryWorkflowStepStatus;
};

export const getLibraryWorkflowGuidanceKey = (
  state: LibraryWorkflowState,
  focusedStep?: LibraryWorkflowStepKey | null,
) => {
  if (focusedStep) {
    if (focusedStep === "roots") {
      return "libraryWorkflowGuidanceRoots";
    }
    if (focusedStep === "legacy-styles" || focusedStep === "legacy-import") {
      return "libraryWorkflowGuidanceLegacy";
    }
    if (focusedStep === "analysis") {
      return "libraryWorkflowGuidanceAnalysis";
    }
    return state.readiness === "pass" || state.readiness === "warn"
      ? "libraryWorkflowGuidanceReady"
      : "libraryWorkflowGuidanceVerify";
  }
  return !state.hasMusicRoot || !state.hasCortinaRoot
    ? "libraryWorkflowGuidanceRoots"
    : state.legacyDetected && !state.legacyImported
      ? "libraryWorkflowGuidanceLegacy"
      : !state.analysisCompleted
        ? "libraryWorkflowGuidanceAnalysis"
        : state.readiness === "pass" || state.readiness === "warn"
          ? "libraryWorkflowGuidanceReady"
          : "libraryWorkflowGuidanceVerify";
};

export const getDefaultExpandedLibraryWorkflowStep = (
  state: LibraryWorkflowState,
): LibraryWorkflowStepKey | null => (state.hasMusicRoot ? null : "roots");

export const resolveLibraryWorkflowExpandedStep = (
  state: LibraryWorkflowState,
  currentExpandedStep: LibraryWorkflowStepKey | null,
  hasAppliedDefaultExpansion: boolean,
): LibraryWorkflowStepKey | null => {
  if (hasAppliedDefaultExpansion) {
    return currentExpandedStep;
  }
  return currentExpandedStep ?? getDefaultExpandedLibraryWorkflowStep(state);
};

export const deriveLibraryWorkflow = (state: LibraryWorkflowState) => {
  const rootsReady = state.hasMusicRoot && state.hasCortinaRoot;
  const importNeeded = state.legacyDetected;
  const legacyStylesDone =
    !importNeeded || state.legacyStylesReviewed || state.legacyImported;

  const steps: LibraryWorkflowStep[] = [
    {
      key: "roots",
      status: rootsReady ? "complete" : "current",
    },
    {
      key: "legacy-styles",
      status: !importNeeded ? "optional" : legacyStylesDone ? "complete" : "current",
    },
    {
      key: "legacy-import",
      status: !importNeeded
        ? "optional"
        : state.legacyImported
          ? "complete"
          : rootsReady && legacyStylesDone
            ? "current"
            : "pending",
    },
    {
      key: "analysis",
      status: state.analysisCompleted
        ? "complete"
        : !rootsReady || (importNeeded && !state.legacyImported)
          ? "pending"
          : "current",
    },
    {
      key: "verify",
      status:
        state.readiness === "pass" || state.readiness === "warn"
          ? "complete"
          : state.readiness === "fail"
            ? "attention"
            : state.analysisCompleted
              ? "current"
              : "pending",
    },
  ];

  return {
    steps,
    guidanceKey: getLibraryWorkflowGuidanceKey(state),
  };
};
