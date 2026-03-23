import type { AppApi, ScanProgress, ScanSummary } from "../../shared/types.js";

type ScanIssue = { filePath: string; message: string };

type PrecomputeProgress = Parameters<AppApi["onPrecomputeCompressedProgress"]>[0] extends (
  value: infer T,
) => void
  ? T
  : never;

type CompressionConfig = Parameters<AppApi["precomputeCompressedTracks"]>[0];
type StartupFlowResult = Awaited<ReturnType<AppApi["runStartupFlow"]>>;

type LibraryMaintenanceElements = {
  errorList?: HTMLElement | null;
  progressEl?: HTMLProgressElement | null;
  progressLabel?: HTMLElement | null;
  progressElSettings?: HTMLProgressElement | null;
  progressLabelSettings?: HTMLElement | null;
  precomputeProgressElSettings?: HTMLProgressElement | null;
  precomputeProgressLabelSettings?: HTMLElement | null;
  precomputeCompressedResult?: HTMLElement | null;
  precomputeCompressedBtn?: HTMLButtonElement | null;
  precomputeCompressedShortcutBtn?: HTMLButtonElement | null;
  startupFlowBtn?: HTMLButtonElement | null;
  startupFlowResult?: HTMLElement | null;
  scanMusicBtn?: HTMLButtonElement | null;
  scanCortinasBtn?: HTMLButtonElement | null;
  exportSystemBtn?: HTMLButtonElement | null;
  importSystemBtn?: HTMLButtonElement | null;
  systemTransferResult?: HTMLElement | null;
  cacheVerifyResult?: HTMLElement | null;
};

export type LibraryMaintenanceControllerDeps = {
  translate: (key: string, params?: Record<string, string | number>) => string;
  basenameForDisplay: (filePath: string | null | undefined) => string;
  api: Pick<
    AppApi,
    | "scanKind"
    | "runStartupFlow"
    | "precomputeCompressedTracks"
    | "verifyCachedFiles"
    | "clearCachedFiles"
    | "exportSystemData"
    | "importSystemData"
  >;
  elements: LibraryMaintenanceElements;
  setStatus: (message: string) => void;
  clearAlert: () => void;
  getCompressionConfig: () => CompressionConfig;
  scheduleCompressionPrefetch: () => void;
  onScanCompleted: (kind: "music" | "cortina", summary: ScanSummary) => Promise<void>;
  onCachedFilesCleared: () => Promise<void>;
  onStartupFlowCompleted: (result: Extract<StartupFlowResult, { ok: true }>) => Promise<void>;
  onSystemImported: () => Promise<void>;
};

const MAX_SCAN_ISSUES = 50;
const MAX_PRECOMPUTE_FAILURE_LINES = 20;

const renderIssuesList = (
  errorList: HTMLElement | null | undefined,
  translate: LibraryMaintenanceControllerDeps["translate"],
  issues: ScanIssue[],
) => {
  if (!errorList) {
    return;
  }
  errorList.innerHTML = "";
  issues.slice(0, MAX_SCAN_ISSUES).forEach((error) => {
    const li = document.createElement("li");
    li.textContent = `${error.filePath}: ${error.message}`;
    errorList.appendChild(li);
  });
  if (issues.length > MAX_SCAN_ISSUES) {
    const li = document.createElement("li");
    li.textContent = translate("scanIssuesMore", {
      count: issues.length - MAX_SCAN_ISSUES,
    });
    errorList.appendChild(li);
  }
};

const renderPrecomputeFailureResult = (
  target: HTMLElement | null | undefined,
  translate: LibraryMaintenanceControllerDeps["translate"],
  errors: ScanIssue[],
) => {
  if (!target) {
    return;
  }
  if (errors.length === 0) {
    target.textContent = "";
    return;
  }
  const lines = errors
    .slice(0, MAX_PRECOMPUTE_FAILURE_LINES)
    .map((error) => `${error.filePath}: ${error.message}`);
  if (errors.length > MAX_PRECOMPUTE_FAILURE_LINES) {
    lines.push(
      translate("scanIssuesMore", {
        count: errors.length - MAX_PRECOMPUTE_FAILURE_LINES,
      }),
    );
  }
  target.textContent = lines.join("\n");
};

export const createSettingsLibraryController = (deps: LibraryMaintenanceControllerDeps) => {
  let currentIssueErrors: ScanIssue[] = [];
  let currentPrecomputeIssueErrors: ScanIssue[] = [];
  let currentPrecomputeIssueKeys = new Set<string>();
  let scanRequestInFlight = false;
  let precomputeCompressionInProgress = false;
  let startupFlowInProgress = false;

  const setScanButtonsDisabled = (disabled: boolean) => {
    if (deps.elements.scanMusicBtn) {
      deps.elements.scanMusicBtn.disabled = disabled;
    }
    if (deps.elements.scanCortinasBtn) {
      deps.elements.scanCortinasBtn.disabled = disabled;
    }
  };

  const setPrecomputeButtonsDisabled = (disabled: boolean) => {
    if (deps.elements.precomputeCompressedBtn) {
      deps.elements.precomputeCompressedBtn.disabled = disabled;
    }
    if (deps.elements.precomputeCompressedShortcutBtn) {
      deps.elements.precomputeCompressedShortcutBtn.disabled = disabled;
    }
  };

  const setStartupFlowButtonDisabled = (disabled: boolean) => {
    if (deps.elements.startupFlowBtn) {
      deps.elements.startupFlowBtn.disabled = disabled;
    }
  };

  const setSystemTransferButtonsDisabled = (disabled: boolean) => {
    if (deps.elements.exportSystemBtn) {
      deps.elements.exportSystemBtn.disabled = disabled;
    }
    if (deps.elements.importSystemBtn) {
      deps.elements.importSystemBtn.disabled = disabled;
    }
  };

  const updateScanIssues = (
    errors: ScanIssue[],
    mode: "replace" | "append" = "replace",
    updateProgressLabels = true,
  ) => {
    currentIssueErrors =
      mode === "append" ? [...currentIssueErrors, ...errors] : [...errors];
    if (updateProgressLabels && deps.elements.progressLabel) {
      deps.elements.progressLabel.textContent = deps.translate("statusScanIssues", {
        count: currentIssueErrors.length,
      });
    }
    if (updateProgressLabels && deps.elements.progressLabelSettings) {
      deps.elements.progressLabelSettings.textContent = deps.translate("statusScanIssues", {
        count: currentIssueErrors.length,
      });
    }
    renderIssuesList(deps.elements.errorList, deps.translate, currentIssueErrors);
  };

  const appendPrecomputeIssue = (error: ScanIssue) => {
    const key = `${error.filePath}|${error.message}`;
    if (currentPrecomputeIssueKeys.has(key)) {
      return;
    }
    currentPrecomputeIssueKeys.add(key);
    currentPrecomputeIssueErrors = [...currentPrecomputeIssueErrors, error];
    renderPrecomputeFailureResult(
      deps.elements.precomputeCompressedResult,
      deps.translate,
      currentPrecomputeIssueErrors,
    );
    updateScanIssues([error], "append", false);
  };

  const handleScanProgress = (progress: ScanProgress) => {
    const currentFile = deps.basenameForDisplay(progress.filePath);
    const progressText = currentFile
      ? deps.translate("statusScanProgressWithFile", {
          current: progress.current,
          total: progress.total,
          root: progress.rootLabel,
          file: currentFile,
        })
      : deps.translate("statusScanProgress", {
          current: progress.current,
          total: progress.total,
          root: progress.rootLabel,
        });
    if (deps.elements.progressEl) {
      deps.elements.progressEl.max = progress.total || 1;
      deps.elements.progressEl.value = progress.current;
    }
    if (deps.elements.progressLabel) {
      deps.elements.progressLabel.textContent = progressText;
    }
    if (deps.elements.progressElSettings) {
      deps.elements.progressElSettings.max = progress.total || 1;
      deps.elements.progressElSettings.value = progress.current;
    }
    if (deps.elements.progressLabelSettings) {
      deps.elements.progressLabelSettings.textContent = progressText;
    }
  };

  const handlePrecomputeProgress = (progress: PrecomputeProgress) => {
    if (!precomputeCompressionInProgress) {
      return;
    }
    if (progress.latestError) {
      appendPrecomputeIssue(progress.latestError);
    }
    if (deps.elements.precomputeProgressElSettings) {
      deps.elements.precomputeProgressElSettings.max = Math.max(1, progress.total || 1);
      deps.elements.precomputeProgressElSettings.value = Math.min(
        progress.current,
        progress.total || progress.current,
      );
    }
    if (deps.elements.precomputeProgressLabelSettings) {
      deps.elements.precomputeProgressLabelSettings.textContent = progress.currentFile
        ? deps.translate("statusPrecomputeCompressionProgressWithFile", {
            current: progress.current,
            total: progress.total,
            rendered: progress.rendered,
            cached: progress.cached,
            failed: progress.failed,
            file: progress.currentFile,
          })
        : deps.translate("statusPrecomputeCompressionProgress", {
            current: progress.current,
            total: progress.total,
            rendered: progress.rendered,
            cached: progress.cached,
            failed: progress.failed,
          });
    }
  };

  const runScan = async (kind: "music" | "cortina") => {
    if (scanRequestInFlight) {
      deps.setStatus(deps.translate("statusScanInProgress"));
      return;
    }
    scanRequestInFlight = true;
    setScanButtonsDisabled(true);
    deps.clearAlert();
    deps.setStatus(deps.translate("statusScanning"));
    if (deps.elements.progressLabel) {
      deps.elements.progressLabel.textContent = deps.translate("statusPreparingScan");
    }
    if (deps.elements.progressLabelSettings) {
      deps.elements.progressLabelSettings.textContent = deps.translate("statusPreparingScan");
    }
    if (deps.elements.progressEl) {
      deps.elements.progressEl.value = 0;
      deps.elements.progressEl.max = 1;
    }
    if (deps.elements.progressElSettings) {
      deps.elements.progressElSettings.value = 0;
      deps.elements.progressElSettings.max = 1;
    }
    try {
      const summary = await deps.api.scanKind(kind);
      if (!summary) {
        deps.setStatus(deps.translate("statusScanFailedNoResponse"));
        return;
      }
      if (summary.inProgress) {
        deps.setStatus(deps.translate("statusScanInProgress"));
        return;
      }
      const reused = Math.max(0, summary.scanned - summary.added - summary.updated);
      deps.setStatus(
        deps.translate("statusScanComplete", {
          checked: summary.scanned,
          reused,
          added: summary.added,
          updated: summary.updated,
          removed: summary.removed,
        }),
      );
      updateScanIssues(summary.errors);
      await deps.onScanCompleted(kind, summary);
    } catch (error) {
      if (error instanceof Error && error.message === "SCAN_IN_PROGRESS") {
        deps.setStatus(deps.translate("statusScanInProgress"));
        return;
      }
      deps.setStatus(
        error instanceof Error
          ? deps.translate("statusScanFailedDetail", { message: error.message })
          : deps.translate("statusScanFailed"),
      );
    } finally {
      scanRequestInFlight = false;
      setScanButtonsDisabled(false);
    }
  };

  const runPrecomputeCompressedTracks = async () => {
    currentPrecomputeIssueKeys = new Set<string>();
    currentPrecomputeIssueErrors = [];
    renderPrecomputeFailureResult(deps.elements.precomputeCompressedResult, deps.translate, []);
    deps.setStatus(deps.translate("statusPrecomputeCompressionRunning"));
    precomputeCompressionInProgress = true;
    if (deps.elements.precomputeProgressElSettings) {
      deps.elements.precomputeProgressElSettings.max = 1;
      deps.elements.precomputeProgressElSettings.value = 0;
    }
    if (deps.elements.precomputeProgressLabelSettings) {
      deps.elements.precomputeProgressLabelSettings.textContent = deps.translate(
        "statusPrecomputeCompressionRunning",
      );
    }
    setPrecomputeButtonsDisabled(true);
    try {
      const result = await deps.api.precomputeCompressedTracks(deps.getCompressionConfig());
      if (!result?.ok) {
        deps.setStatus(
          deps.translate("statusPrecomputeCompressionFailed", {
            message: result?.error ?? deps.translate("statusUnknownError"),
          }),
        );
        return;
      }
      deps.setStatus(
        deps.translate("statusPrecomputeCompressionDone", {
          rendered: result.rendered,
          cached: result.cached,
          failed: result.failed,
        }),
      );
      result.errors?.forEach((error) => appendPrecomputeIssue(error));
      deps.scheduleCompressionPrefetch();
    } catch (error) {
      deps.setStatus(
        deps.translate("statusPrecomputeCompressionFailed", {
          message: error instanceof Error ? error.message : deps.translate("statusUnknownError"),
        }),
      );
    } finally {
      precomputeCompressionInProgress = false;
      currentPrecomputeIssueKeys = new Set<string>();
      setPrecomputeButtonsDisabled(false);
    }
  };

  const renderStartupFlowResult = (result: string) => {
    if (deps.elements.startupFlowResult) {
      deps.elements.startupFlowResult.textContent = result;
    }
  };

  const runStartupFlow = async () => {
    if (startupFlowInProgress || scanRequestInFlight || precomputeCompressionInProgress) {
      deps.setStatus(deps.translate("statusScanInProgress"));
      return;
    }
    currentPrecomputeIssueKeys = new Set<string>();
    currentPrecomputeIssueErrors = [];
    renderPrecomputeFailureResult(deps.elements.precomputeCompressedResult, deps.translate, []);
    startupFlowInProgress = true;
    setStartupFlowButtonDisabled(true);
    setScanButtonsDisabled(true);
    setPrecomputeButtonsDisabled(true);
    deps.clearAlert();
    renderStartupFlowResult(deps.translate("startupFlowRunning"));
    deps.setStatus(deps.translate("startupFlowRunning"));
    try {
      const result = await deps.api.runStartupFlow(deps.getCompressionConfig());
      if (!result.ok) {
        const message = deps.translate("startupFlowFailed", { message: result.error });
        renderStartupFlowResult(message);
        deps.setStatus(message);
        return;
      }
      updateScanIssues([
        ...result.legacyImport.missingFiles,
        ...result.musicScan.errors,
        ...result.cortinaScan.errors,
        ...result.precompute.errors,
      ]);
      result.precompute.errors.forEach((error) => appendPrecomputeIssue(error));
      renderStartupFlowResult(
        deps.translate("startupFlowDone", {
          legacy: result.legacyImported
            ? deps.translate("startupFlowLegacyImported")
            : result.legacyDetected
              ? deps.translate("startupFlowLegacyDetected")
              : deps.translate("startupFlowLegacySkipped"),
          music: result.musicScan.scanned,
          cortinas: result.cortinaScan.scanned,
          rendered: result.precompute.rendered,
          cached: result.precompute.cached,
          failed: result.precompute.failed,
        }),
      );
      deps.setStatus(
        deps.translate("startupFlowStatusDone", {
          music: result.musicScan.scanned,
          cortinas: result.cortinaScan.scanned,
          rendered: result.precompute.rendered,
          cached: result.precompute.cached,
          failed: result.precompute.failed,
        }),
      );
      deps.scheduleCompressionPrefetch();
      await deps.onStartupFlowCompleted(result);
    } catch (error) {
      const message = deps.translate("startupFlowFailed", {
        message: error instanceof Error ? error.message : deps.translate("statusUnknownError"),
      });
      renderStartupFlowResult(message);
      deps.setStatus(message);
    } finally {
      startupFlowInProgress = false;
      setStartupFlowButtonDisabled(false);
      setScanButtonsDisabled(false);
      setPrecomputeButtonsDisabled(false);
    }
  };

  const runVerifyCachedFiles = async () => {
    if (!deps.elements.cacheVerifyResult) {
      return;
    }
    deps.elements.cacheVerifyResult.textContent = deps.translate("verifyCachedFilesRunning");
    try {
      const result = await deps.api.verifyCachedFiles();
      if (!result?.ok) {
        deps.elements.cacheVerifyResult.textContent = deps.translate("verifyCachedFilesFailed");
        return;
      }
      deps.elements.cacheVerifyResult.textContent = deps.translate("verifyCachedFilesSummary", {
        waveformFiles: result.waveformFiles,
        waveformRemoved: result.waveformRemoved,
        compressedFiles: result.compressedFiles,
        compressedRemoved: result.compressedRemoved,
      });
    } catch (error) {
      deps.elements.cacheVerifyResult.textContent = deps.translate(
        "verifyCachedFilesFailedDetail",
        {
          message: error instanceof Error ? error.message : deps.translate("statusUnknownError"),
        },
      );
    }
  };

  const runClearCachedFiles = async (confirm: () => Promise<boolean>) => {
    if (!(await confirm())) {
      return;
    }
    const result = await deps.api.clearCachedFiles();
    if (!result?.ok) {
      return;
    }
    if (deps.elements.cacheVerifyResult) {
      deps.elements.cacheVerifyResult.textContent = deps.translate("eraseCachedFilesDone");
    }
    deps.setStatus(deps.translate("eraseCachedFilesDone"));
    await deps.onCachedFilesCleared();
  };

  const runExportSystemData = async () => {
    const resultEl = deps.elements.systemTransferResult;
    if (!resultEl) {
      return;
    }
    setSystemTransferButtonsDisabled(true);
    resultEl.textContent = deps.translate("systemExportRunning");
    try {
      const result = await deps.api.exportSystemData();
      if (result.cancelled) {
        resultEl.textContent = deps.translate("systemTransferCancelled");
        return;
      }
      if (!result.ok) {
        resultEl.textContent = deps.translate("systemExportFailed", {
          message: result.error ?? deps.translate("statusUnknownError"),
        });
        return;
      }
      resultEl.textContent = deps.translate("systemExportDone", {
        path: result.path,
      });
    } catch (error) {
      resultEl.textContent = deps.translate("systemExportFailed", {
        message: error instanceof Error ? error.message : deps.translate("statusUnknownError"),
      });
    } finally {
      setSystemTransferButtonsDisabled(false);
    }
  };

  const runImportSystemData = async (confirm: () => Promise<boolean>) => {
    const resultEl = deps.elements.systemTransferResult;
    if (!resultEl) {
      return;
    }
    if (!(await confirm())) {
      return;
    }
    setSystemTransferButtonsDisabled(true);
    resultEl.textContent = deps.translate("systemImportRunning");
    try {
      const result = await deps.api.importSystemData();
      if (result.cancelled) {
        resultEl.textContent = deps.translate("systemTransferCancelled");
        return;
      }
      if (!result.ok) {
        resultEl.textContent = deps.translate("systemImportFailed", {
          message: result.error ?? deps.translate("statusUnknownError"),
        });
        return;
      }
      resultEl.textContent = deps.translate("systemImportDone", {
        path: result.path,
      });
      await deps.onSystemImported();
    } catch (error) {
      resultEl.textContent = deps.translate("systemImportFailed", {
        message: error instanceof Error ? error.message : deps.translate("statusUnknownError"),
      });
    } finally {
      setSystemTransferButtonsDisabled(false);
    }
  };

  return {
    handleScanProgress,
    handlePrecomputeProgress,
    updateScanIssues,
    runScan,
    runStartupFlow,
    runPrecomputeCompressedTracks,
    runVerifyCachedFiles,
    runClearCachedFiles,
    runExportSystemData,
    runImportSystemData,
  };
};
