import { describe, expect, it } from "vitest";
import { ANALYSIS_PIPELINE_VERSION } from "../app/src/main/library/analysis";
import { shouldReuseUnchangedAnalysis } from "../app/src/main/library/scan";

describe("shouldReuseUnchangedAnalysis", () => {
  const stat = { size: 1000, mtimeMs: 1000.2 };

  it("reuses when file and analysis metadata are complete", () => {
    expect(
      shouldReuseUnchangedAnalysis(
        {
          file_size: 1000,
          file_mtime_ms: 1000,
          duration_ms: 120000,
          start_offset_ms: 200,
          end_trim_ms: 100,
          loudness_db: -18,
          gain_db: 2,
          tag_json: "{}",
          analysis_json: JSON.stringify({ pipelineVersion: ANALYSIS_PIPELINE_VERSION }),
          tag_error: "",
          analysis_error: "",
        },
        stat,
      ),
    ).toBe(true);
  });

  it("forces re-analysis when duration is missing/zero", () => {
    expect(
      shouldReuseUnchangedAnalysis(
        {
          file_size: 1000,
          file_mtime_ms: 1000,
          duration_ms: 0,
          start_offset_ms: 0,
          end_trim_ms: 0,
          tag_json: "{}",
          analysis_json: JSON.stringify({ pipelineVersion: ANALYSIS_PIPELINE_VERSION }),
          tag_error: "",
          analysis_error: "",
        },
        stat,
      ),
    ).toBe(false);
  });

  it("forces re-analysis when loudness and gain are incomplete", () => {
    expect(
      shouldReuseUnchangedAnalysis(
        {
          file_size: 1000,
          file_mtime_ms: 1000,
          duration_ms: 120000,
          start_offset_ms: 0,
          end_trim_ms: 0,
          loudness_db: null,
          gain_db: null,
          tag_json: "{}",
          analysis_json: JSON.stringify({ pipelineVersion: ANALYSIS_PIPELINE_VERSION }),
          tag_error: "",
          analysis_error: "",
        },
        stat,
      ),
    ).toBe(false);
  });

  it("forces re-analysis for legacy import placeholders", () => {
    expect(
      shouldReuseUnchangedAnalysis(
        {
          file_size: 1000,
          file_mtime_ms: 1000,
          duration_ms: 120000,
          start_offset_ms: 0,
          end_trim_ms: 0,
          tag_json: "{}",
          analysis_json: '{"source":"legacy-import"}',
          tag_error: "",
          analysis_error: "",
        },
        stat,
      ),
    ).toBe(false);
  });

  it("forces re-analysis when stored analysis comes from an older pipeline version", () => {
    expect(
      shouldReuseUnchangedAnalysis(
        {
          file_size: 1000,
          file_mtime_ms: 1000,
          duration_ms: 120000,
          start_offset_ms: 0,
          end_trim_ms: 0,
          tag_json: "{}",
          analysis_json: JSON.stringify({ pipelineVersion: ANALYSIS_PIPELINE_VERSION - 1 }),
          tag_error: "",
          analysis_error: "",
        },
        stat,
      ),
    ).toBe(false);
  });
});
