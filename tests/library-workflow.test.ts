import { describe, expect, it } from "vitest";
import {
  deriveLibraryWorkflow,
  getDefaultExpandedLibraryWorkflowStep,
  getLibraryWorkflowGuidanceKey,
  resolveLibraryWorkflowExpandedStep,
} from "../app/src/renderer/modules/library-workflow";

describe("library workflow helper", () => {
  it("guides users to configure roots first", () => {
    const result = deriveLibraryWorkflow({
      hasMusicRoot: false,
      hasCortinaRoot: false,
      legacyDetected: false,
      legacyStylesReviewed: false,
      legacyImported: false,
      analysisCompleted: false,
      readiness: "idle",
    });

    expect(result.guidanceKey).toBe("libraryWorkflowGuidanceRoots");
    expect(result.steps).toEqual([
      { key: "roots", status: "current" },
      { key: "legacy-styles", status: "optional" },
      { key: "legacy-import", status: "optional" },
      { key: "analysis", status: "pending" },
      { key: "verify", status: "pending" },
    ]);
  });

  it("guides legacy users from import into analysis and verification", () => {
    const afterImport = deriveLibraryWorkflow({
      hasMusicRoot: true,
      hasCortinaRoot: true,
      legacyDetected: true,
      legacyStylesReviewed: true,
      legacyImported: true,
      analysisCompleted: false,
      readiness: "idle",
    });

    expect(afterImport.guidanceKey).toBe("libraryWorkflowGuidanceAnalysis");
    expect(afterImport.steps.find((step) => step.key === "legacy-import")?.status).toBe("complete");
    expect(afterImport.steps.find((step) => step.key === "analysis")?.status).toBe("current");

    const verified = deriveLibraryWorkflow({
      hasMusicRoot: true,
      hasCortinaRoot: true,
      legacyDetected: true,
      legacyStylesReviewed: true,
      legacyImported: true,
      analysisCompleted: true,
      readiness: "warn",
    });

    expect(verified.guidanceKey).toBe("libraryWorkflowGuidanceReady");
    expect(verified.steps.find((step) => step.key === "verify")?.status).toBe("complete");
  });

  it("defaults only the roots step open when no music root exists", () => {
    expect(
      getDefaultExpandedLibraryWorkflowStep({
        hasMusicRoot: false,
        hasCortinaRoot: false,
        legacyDetected: false,
        legacyStylesReviewed: false,
        legacyImported: false,
        analysisCompleted: false,
        readiness: "idle",
      }),
    ).toBe("roots");

    expect(
      getDefaultExpandedLibraryWorkflowStep({
        hasMusicRoot: true,
        hasCortinaRoot: false,
        legacyDetected: false,
        legacyStylesReviewed: false,
        legacyImported: false,
        analysisCompleted: false,
        readiness: "idle",
      }),
    ).toBeNull();
  });

  it("preserves the current expanded roots step after the initial default is applied", () => {
    const noRootsState = {
      hasMusicRoot: false,
      hasCortinaRoot: false,
      legacyDetected: false,
      legacyStylesReviewed: false,
      legacyImported: false,
      analysisCompleted: false,
      readiness: "idle" as const,
    };
    const afterMusicAddedState = {
      ...noRootsState,
      hasMusicRoot: true,
    };

    const initialExpanded = resolveLibraryWorkflowExpandedStep(
      noRootsState,
      null,
      false,
    );
    expect(initialExpanded).toBe("roots");

    expect(
      resolveLibraryWorkflowExpandedStep(
        afterMusicAddedState,
        initialExpanded,
        true,
      ),
    ).toBe("roots");
  });

  it("uses focused-step guidance when a workflow step is expanded", () => {
    const state = {
      hasMusicRoot: true,
      hasCortinaRoot: true,
      legacyDetected: true,
      legacyStylesReviewed: true,
      legacyImported: true,
      analysisCompleted: true,
      readiness: "warn" as const,
    };

    expect(getLibraryWorkflowGuidanceKey(state, "roots")).toBe(
      "libraryWorkflowGuidanceRoots",
    );
    expect(getLibraryWorkflowGuidanceKey(state, "legacy-import")).toBe(
      "libraryWorkflowGuidanceLegacy",
    );
    expect(getLibraryWorkflowGuidanceKey(state, "analysis")).toBe(
      "libraryWorkflowGuidanceAnalysis",
    );
    expect(getLibraryWorkflowGuidanceKey(state, "verify")).toBe(
      "libraryWorkflowGuidanceReady",
    );
  });

  it("advances from legacy-style review to import when review is marked done", () => {
    const result = deriveLibraryWorkflow({
      hasMusicRoot: true,
      hasCortinaRoot: true,
      legacyDetected: true,
      legacyStylesReviewed: true,
      legacyImported: false,
      analysisCompleted: false,
      readiness: "idle",
    });

    expect(result.steps.find((step) => step.key === "legacy-styles")?.status).toBe(
      "complete",
    );
    expect(result.steps.find((step) => step.key === "legacy-import")?.status).toBe(
      "current",
    );
  });
});
