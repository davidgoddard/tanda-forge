import {
  requiresResearchResolution, researchFields, type ResearchApi, type ResearchEdit, type ResearchRow,
  type ResearchScope, type ResearchValues,
} from "../../shared/metadata-research.js";

type Translate = (key: string, params?: Record<string, string | number>) => string;
type Options = {
  api: ResearchApi; t: Translate; selected: () => string[];
  filtered: () => Promise<string[]>; changed: () => Promise<void>;
  canWrite: () => boolean;
  buildPreview: (trackId: string) => HTMLElement;
  stopPreview: () => void;
  confirm: (message: string) => Promise<boolean>;
};

export function initializeMetadataResearch(panel: HTMLElement, review: HTMLElement, options: Options) {
  const { api, t } = options;
  let state: Awaited<ReturnType<ResearchApi["state"]>> | undefined;
  let busy = false;
  let page = 0;
  const selected = new Set<string>();
  const key = (row: ResearchRow) => `${row.batch}:${row.line}`;
  const label = (name: string) => t(`research_${name}`);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, content?: string) => {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    return node;
  };
  const message = el("p");
  message.setAttribute("role", "status");
  const reviewMessage = el("p");
  reviewMessage.setAttribute("role", "status");
  const announce = (value: string) => { message.textContent = reviewMessage.textContent = value; };
  const refresh = async () => { state = await api.state(); render(); };
  const run = async (action: () => Promise<void>, inlineError?: HTMLElement) => {
    if (busy) return;
    busy = true;
    announce("");
    if (inlineError) inlineError.textContent = "";
    try { await action(); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (inlineError) {
        const reason = message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");
        const feedback: Record<string, string> = {
          "Resolve research conflicts before approving": "approvalConflict",
          "Resolve the recording-match warning before approving": "approvalRecording",
          "Invalid genre": "approvalGenre",
          "Select at least one correction": "approvalEmpty",
        };
        inlineError.textContent = feedback[reason] ? label(feedback[reason]) : reason;
      } else announce(message);
    }
    finally { busy = false; }
  };
  const button = (name: string, action: () => void) => {
    const node = el("button", label(name));
    node.dataset.i18n = `research_${name}`;
    node.type = "button";
    node.addEventListener("click", action);
    return node;
  };
  const select = (name: string, choices: string[]) => {
    const node = el("select");
    node.setAttribute("aria-label", label(name));
    node.dataset.i18n = `research_${name}`;
    node.dataset.i18nAttr = "aria-label";
    for (const value of choices) {
      const option = el("option", /^\d+$/.test(value) && value !== "0" ? value : label(value));
      option.value = value;
      if (!/^\d+$/.test(value) || value === "0") option.dataset.i18n = `research_${value}`;
      node.append(option);
    }
    return node;
  };
  const check = (name: string) => {
    const node = el("input");
    node.type = "checkbox";
    node.setAttribute("aria-label", label(name));
    return node;
  };
  const labeledField = (name: string, control: HTMLElement) => {
    const field = el("label");
    field.className = "metadata-research-panel-field";
    const caption = el("span", label(name));
    caption.dataset.i18n = `research_${name}`;
    field.append(caption, control);
    return field;
  };
  const scope = select("scope", ["needed", "selected", "filtered", "genre", "year", "new"]);
  const size = select("batchSize", ["10", "20", "30", "50", "100", "0"]);
  size.value = "30";
  const repeat = check("repeat");
  const repeatLabel = el("label");
  const repeatText = el("span", label("repeat"));
  repeatText.dataset.i18n = "research_repeat";
  repeatLabel.append(repeat, repeatText);
  const counts = el("p");
  const open = button("open", () => void run(async () => {
    await refresh();
    review.hidden = false;
    review.focus();
  }));
  const apply = button("apply", () => void run(async () => {
    if (!options.canWrite()) { announce(label("stopPlayback")); return; }
    const rows = state?.rows.filter((row) => row.state === "approved") ?? [];
    let fields = 0;
    let overwrites = 0;
    for (const row of rows) for (const field of researchFields) {
      if (!(field in row.approved)) continue;
      fields++;
      const value = row.snapshot?.[field];
      if (value != null && value !== "" && value !== "?") overwrites++;
    }
    if (!fields) return;
    if (!await options.confirm(t("research_confirmApply", {
      tracks: rows.length, fields, overwrites, missing: fields - overwrites,
      warnings: state?.rows.filter((row) => row.state === "pending" && (row.conflict || row.issues.length)).length ?? 0,
    }))) return;
    if (!options.canWrite()) { announce(label("stopPlayback")); return; }
    const result = await api.apply();
    await options.changed();
    await refresh();
    announce(t("research_appliedCount", result));
  }));
  const heading = el("h2", label("reviewTitle"));
  heading.dataset.i18n = "research_reviewTitle";
  heading.id = "metadata-research-heading";
  review.setAttribute("aria-labelledby", heading.id);
  const filter = select("filter", [
    "all", "pending", "approved", "rejected", "high", "medium", "low", "unresolved", "conflict",
    "applied", "reviewed", "undone", ...researchFields.map((field) => `changed_${field}`),
  ]);
  const sort = select("sort", ["title", "artist", "singer", "genre", "year", "bpm", "confidence", "changes", "status"]);
  const query = el("input");
  query.type = "search";
  query.placeholder = label("search");
  query.setAttribute("aria-label", label("search"));
  query.dataset.i18n = "research_search";
  query.dataset.i18nAttr = "placeholder,aria-label";
  for (const node of [filter, sort, query]) node.addEventListener("input", () => { page = 0; render(); });
  const rowsContainer = el("div");
  const gridHeader = el("div");
  gridHeader.className = "metadata-research-grid metadata-research-grid-header";
  gridHeader.append(el("span"), ...["title", "artist", "singer", "genre", "year", "bpm", "confidence", "changes", "status"]
    .map((field) => {
      const caption = el("span", label(field));
      caption.dataset.i18n = `research_${field}`;
      return caption;
    }));
  const reviewCounts = el("p");
  const pageLabel = el("span");
  const next = button("next", () => { page++; render(); });
  const prev = button("previous", () => { page--; render(); });
  const bulkField = select("approvalField", ["all", ...researchFields]);
  const allowBulk = (row: ResearchRow) => row.state === "pending" && !row.conflict && !row.issues.length &&
    !requiresResearchResolution(row);
  const persist = async (edits: ResearchEdit[]) => { if (edits.length) await api.review(edits); await refresh(); };
  const actionable = (row: ResearchRow) => row.state === "pending" || row.state === "approved" || row.state === "rejected";
  const makeEdit = (row: ResearchRow, status: ResearchEdit["state"], values?: ResearchValues): ResearchEdit =>
    ({ batch: row.batch, line: row.line, state: status, values });
  const bulk = (mode: "selected" | "high" | "missing" | "field") => void run(async () => {
    const edits: ResearchEdit[] = [];
    for (const row of visibleRows) {
      if (!allowBulk(row) || (mode === "high" ? row.original.confidence?.toLowerCase() !== "high" : !selected.has(key(row)))) continue;
      const values: ResearchValues = {};
      for (const field of researchFields) {
        if (row.proposed[field] === undefined) continue;
        const current = row.snapshot?.[field];
        const isMissing = current == null || current === "" || current === "?";
        if (field === "bpm" && !isMissing) continue;
        if (mode === "missing" && !isMissing) continue;
        if (mode === "field" && bulkField.value !== "all" && bulkField.value !== field) continue;
        values[field] = row.proposed[field];
      }
      if (Object.keys(values).length) edits.push(makeEdit(row, "approved", values));
    }
    await persist(edits);
  });
  let visibleRows: ResearchRow[] = [];
  const changeSelected = (status: "pending" | "rejected") => void run(async () =>
    persist(visibleRows.filter((row) => selected.has(key(row)) && actionable(row)).map((row) => makeEdit(row, status))));
  const controls = el("div");
  controls.className = "metadata-research-controls";
  const filters = el("div");
  filters.className = "metadata-research-filter-bar";
  filters.append(labeledField("filter", filter), labeledField("sort", sort), labeledField("search", query));
  const selectionTools = el("div");
  selectionTools.className = "metadata-research-action-group metadata-research-selection-tools";
  selectionTools.append(
    button("selectVisible", () => { visibleRows.forEach((row) => selected.add(key(row))); render(); }),
    button("deselect", () => { selected.clear(); render(); }),
  );
  const selectedActions = el("div");
  selectedActions.className = "metadata-research-action-group metadata-research-selected-actions";
  const approveSelected = button("approveSelected", () => bulk("selected"));
  approveSelected.className = "metadata-research-primary-action";
  selectedActions.append(
    button("rejectTracks", () => changeSelected("rejected")),
    button("resetSelected", () => changeSelected("pending")),
  );
  const assistedActions = el("div");
  assistedActions.className = "metadata-research-action-group metadata-research-assisted-actions";
  const approvalPanel = el("fieldset");
  approvalPanel.className = "metadata-research-approval";
  const approvalLegend = el("legend", label("approval"));
  approvalLegend.dataset.i18n = "research_approval";
  const fieldActions = el("div");
  fieldActions.className = "metadata-research-action-group metadata-research-field-actions";
  fieldActions.append(labeledField("approvalField", bulkField), button("approveField", () => bulk("field")));
  assistedActions.append(
    approveSelected,
    button("approveHigh", () => bulk("high")),
    button("approveMissing", () => bulk("missing")),
  );
  approvalPanel.append(approvalLegend, assistedActions, fieldActions);
  selectionTools.append(button("hideRejected", () => { hideRejected = !hideRejected; page = 0; render(); }));
  controls.append(filters, selectionTools, selectedActions, approvalPanel);
  let hideRejected = false;
  const top = el("div");
  top.className = "metadata-research-header";
  const close = () => {
    options.stopPreview();
    review.hidden = true;
    open.focus();
  };
  const back = button("back", close);
  review.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !busy) close();
  });
  back.className = "metadata-research-back";
  apply.className = "metadata-research-primary-action metadata-research-apply";
  top.append(back, heading, apply);
  const overview = el("div");
  overview.className = "metadata-research-overview";
  overview.append(reviewCounts);
  const table = el("div");
  table.className = "metadata-research-table";
  table.append(gridHeader, rowsContainer);
  const pagination = el("div");
  pagination.className = "metadata-research-pagination";
  pagination.append(prev, pageLabel, next);
  review.append(top, overview, controls, reviewMessage, table, pagination);
  const exportButton = button("export", () => void run(async () => {
      const mode = scope.value as ResearchScope;
      const ids = mode === "filtered" ? await options.filtered() : mode === "selected" ? options.selected() : [];
      const count = await api.export(mode, ids, Number(size.value), repeat.checked);
      await refresh();
      announce(t("research_exportedCount", { count }));
    }));
  const panelHeading = el("h3", label("titlePanel"));
  panelHeading.dataset.i18n = "research_titlePanel";
  scope.addEventListener("change", () => render());
  const importButton = button("import", () => void run(async () => {
      const result = await api.import();
      if (!result) return;
      await refresh();
      const batch = state?.rows.filter((row) => row.batch === result.batch) ?? [];
      announce(result.duplicate ? label("duplicate") : t("research_importedCount", {
        total: batch.length, matched: batch.filter((row) => row.snapshot).length,
        changes: batch.filter((row) => Object.keys(row.proposed).length).length,
        unchanged: batch.filter((row) => row.snapshot && !Object.keys(row.proposed).length).length,
        invalid: batch.filter((row) => row.issues.length).length,
        manual: batch.filter((row) => row.issues.length || row.conflict || row.original.confidence?.toLowerCase() !== "high").length,
        unknown: batch.filter((row) => !row.snapshot).length,
        duplicate: batch.filter((row) => row.issues.includes("Duplicate track ID")).length,
        conflicts: batch.filter((row) => row.conflict).length,
      }));
    }));
  const promptButton = button("prompt", () => void run(async () => { await api.prompt(); announce(label("copied")); }));
  const panelHeader = el("div");
  panelHeader.className = "metadata-research-panel-header";
  panelHeader.append(panelHeading, counts);
  const exportSetup = el("div");
  exportSetup.className = "metadata-research-export-setup";
  const exportActions = el("div");
  exportActions.className = "metadata-research-action-group metadata-research-export-actions";
  exportButton.className = "metadata-research-primary-action";
  exportActions.append(exportButton, promptButton);
  exportSetup.append(labeledField("scope", scope), labeledField("batchSize", size), repeatLabel, exportActions);
  const panelActions = el("div");
  panelActions.className = "metadata-research-panel-actions";
  panelActions.append(importButton, open);
  panel.append(panelHeader, exportSetup, panelActions, message);

  function renderDetails(row: ResearchRow, target: HTMLElement) {
    if (target.childElementCount) return;
    target.className = "metadata-research-detail";
    if (row.snapshot) target.append(options.buildPreview(row.id));
    if (row.appliedAt) {
      const date = (value: string | undefined) => value ? new Date(value).toLocaleString() : "—";
      target.append(el("p", t("research_history", {
        batch: row.batch.slice(0, 12), imported: date(row.importedAt), approved: date(row.approvedAt),
        applied: date(row.appliedAt), undone: date(row.undoneAt),
      })));
    }
    const notes = el("aside");
    notes.className = "metadata-research-notes";
    const genreWarning = row.issues.some((issue) => issue === "Invalid genre" || issue === "Style requires a genre mapping");
    const evidence = [row.original.review_status, row.original.suggested_style,
      row.original.suggested_subgenre, row.original.recording_date,
      ...row.issues.filter((issue) => issue !== "Invalid genre" && issue !== "Style requires a genre mapping"),
      row.conflict ? label("conflict") : ""].filter(Boolean).join(" · ");
    notes.append(el("h3", label("notes")));
    if (row.original.notes?.trim()) notes.append(el("p", row.original.notes));
    if (evidence) notes.append(el("p", evidence));
    if (genreWarning) notes.append(el("p", label("unmappedGenre")));
    for (const source of (row.original.source_url ?? "").split("|").map((value) => value.trim()).filter(Boolean)) {
      const link = el("button", source);
      link.type = "button";
      link.addEventListener("click", () => void run(() => api.evidence(source)));
      notes.append(link);
    }
    const table = el("table");
    const editable = actionable(row);
    if (!editable) target.append(el("p", label(row.state === "applied" ? "appliedReadOnly" : "historyReadOnly")));
    const header = el("tr");
    for (const name of ["field", "current", "suggested", editable ? "customValue" : "final"]) header.append(el("th", label(name)));
    const head = el("thead");
    head.append(header);
    table.append(head);
    const body = el("tbody");
    const values: ResearchValues = {};
    const saved = row.state === "approved" ? row.approved : row.draft ?? {};
    const clearSinger = check("clearSinger");
    clearSinger.checked = saved.singer === null;
    for (const field of researchFields) {
      const tr = el("tr");
      const current = row.snapshot?.[field];
      const suggested = row.proposed[field];
      const editValue = Object.prototype.hasOwnProperty.call(saved, field) ? saved[field]
        : current;
      const instrumental = field === "instrumental";
      const display = (value: string | number | null | undefined) => {
        if (value == null || value === "") return "—";
        return instrumental ? label(String(value) === "1" ? "yes" : "no") : String(value);
      };
      const input = instrumental ? el("select") : el("input");
      if (instrumental) {
        for (const [value, caption] of [["", "—"], ["1", label("yes")], ["0", label("no")]]) {
          const option = el("option", caption);
          option.value = value;
          input.append(option);
        }
      }
      const displayed = row.after ? row.after[field] : editValue;
      input.value = displayed == null ? "" : String(displayed);
      input.setAttribute("aria-label", label(field));
      const inputCell = el("td");
      const currentCell = el("td", display(current));
      const suggestionCell = el("td", display(suggested));
      if (editable) {
        const keep = el("button", display(current));
        const use = el("button", display(suggested));
        const choose = (selection: "current" | "suggested" | "custom") => {
          keep.setAttribute("aria-pressed", String(selection === "current"));
          use.setAttribute("aria-pressed", String(selection === "suggested"));
          inputCell.classList.toggle("metadata-research-custom-selected", selection === "custom");
        };
        for (const [button, column] of [[keep, "current"], [use, "suggested"]] as const) {
          button.type = "button";
          button.className = "metadata-research-value-choice";
          button.setAttribute("aria-label", `${label(field)} · ${label(column)} · ${button.textContent}`);
        }
        keep.addEventListener("click", () => {
          if (field === "singer") clearSinger.checked = false;
          delete values[field];
          input.value = current == null ? "" : String(current);
          choose("current");
        });
        use.addEventListener("click", () => {
          if (field === "singer") clearSinger.checked = false;
          values[field] = suggested;
          input.value = suggested == null ? "" : String(suggested);
          choose("suggested");
        });
        input.addEventListener("input", () => {
          if (field === "singer") clearSinger.checked = false;
          const value = input.value.trim();
          if (value) values[field] = instrumental ? Number(value) : value;
          else delete values[field];
          choose(value ? "custom" : "current");
        });
        const hasSaved = Object.prototype.hasOwnProperty.call(saved, field) && editValue != null;
        if (hasSaved) values[field] = editValue;
        choose(!hasSaved || editValue === current ? "current" : editValue === suggested ? "suggested" : "custom");
        currentCell.replaceChildren(keep);
        if (suggested !== undefined) suggestionCell.replaceChildren(use);
        inputCell.append(input);
      } else inputCell.textContent = display(displayed);
      tr.append(el("th", label(field)), currentCell, suggestionCell, inputCell);
      body.append(tr);
    }
    table.append(body);
    const comparison = el("div");
    comparison.className = "metadata-research-comparison";
    const fields = el("div");
    fields.className = "metadata-research-fields";
    fields.append(table);
    comparison.append(fields);
    if (notes.childElementCount > 1) comparison.append(notes);
    target.append(comparison);
    if (actionable(row)) {
      const clearLabel = el("label");
      clearLabel.append(clearSinger, label("clearSinger"));
      const getEdits = () => {
        return clearSinger.checked ? { ...values, singer: null } : { ...values };
      };
      const resolved = check("resolved");
      if (requiresResearchResolution(row)) {
        const resolution = el("label");
        resolution.append(resolved, label("resolved"));
        target.append(resolution);
      }
      const approvalError = el("p");
      approvalError.className = "metadata-research-approval-error";
      approvalError.setAttribute("role", "alert");
      const approve = (values: ResearchValues, allowNoChanges = false) => void run(async () => {
        if (requiresResearchResolution(row) && !resolved.checked) {
          approvalError.textContent = label("approvalRecording");
          return;
        }
        await persist([{ ...makeEdit(row, "approved", values), resolved: resolved.checked, allowNoChanges }]);
      }, approvalError);
      const detailOptions = el("div");
      detailOptions.className = "metadata-research-detail-options";
      detailOptions.append(clearLabel);
      const detailActions = el("div");
      detailActions.className = "metadata-research-detail-actions";
      const approveFields = button("approve", () => approve(getEdits(), true));
      approveFields.className = "metadata-research-primary-action";
      detailActions.append(approveFields,
        button("saveDraft", () => void run(() => persist([makeEdit(row, "pending", getEdits())]))),
        button("recheck", () => void run(() => persist([{ ...makeEdit(row, "pending", getEdits()), recheck: true }]))),
        button("acceptAll", () => approve(row.proposed)),
        button("rejectSelected", () => void run(() => persist([makeEdit(row, "rejected")]))),
        button("resetSelected", () => void run(() => persist([makeEdit(row, "pending")]))));
      target.append(detailOptions, detailActions, approvalError);
    } else if (row.state === "reviewed") {
      target.append(button("resetSelected", () => void run(() =>
        persist([{ ...makeEdit(row, "pending"), recheck: true }]))));
    } else if (row.state === "applied") {
      for (const batch of [false, true]) target.append(button(batch ? "undoBatch" : "undoTrack", () => void run(async () => {
        if (!options.canWrite()) { announce(label("stopPlayback")); return; }
        if (!await options.confirm(label("confirmUndo"))) return;
        if (!options.canWrite()) { announce(label("stopPlayback")); return; }
        const count = await api.undo(row.batch, batch ? undefined : row.line);
        await options.changed();
        await refresh();
        announce(t("research_undoneCount", { count }));
      })));
    }
  }

  function render() {
    if (!state) return;
    const rows = state.rows;
    const pending = rows.filter((row) => row.state === "pending" || row.state === "approved");
    counts.textContent = t("research_counts", { needed: state.needed, selected: options.selected().length,
      exported: state.exported, pending: new Set(pending.map((row) => row.id)).size, completed: state.completed });
    exportButton.disabled = scope.value === "selected" && !options.selected().length;
    const confidence = (row: ResearchRow) => row.original.confidence?.toLowerCase();
    const unresolved = (row: ResearchRow) => !Object.keys(row.proposed).length || row.original.review_status?.toLowerCase() === "unresolved";
    const activeFilter = filter.value;
    const text = query.value.trim().toLowerCase();
    visibleRows = rows.filter((row) => {
      if (hideRejected && row.state === "rejected" && activeFilter !== "rejected") return false;
      if (text && ![row.id, row.original.title, row.original.artist, row.original.singer, row.original.notes]
        .some((value) => value?.toLowerCase().includes(text))) return false;
      if (activeFilter === "all") return true;
      if (activeFilter === "conflict") return row.conflict || row.issues.length > 0;
      if (activeFilter === "unresolved") return unresolved(row);
      if (activeFilter.startsWith("changed_")) return activeFilter.slice(8) in row.proposed;
      return row.state === activeFilter || confidence(row) === activeFilter;
    });
    const sortValue = (row: ResearchRow) => {
      if (sort.value === "status") return row.state;
      if (sort.value === "changes") return Object.keys(row.proposed).length;
      return row.original[sort.value] ?? "";
    };
    visibleRows.sort((a, b) => String(sortValue(a)).localeCompare(String(sortValue(b)), undefined, { numeric: true }));
    const pages = Math.max(1, Math.ceil(visibleRows.length / 30));
    page = Math.min(pages - 1, Math.max(0, page));
    prev.disabled = page === 0;
    next.disabled = page + 1 >= pages;
    pageLabel.textContent = t("research_page", { page: page + 1, pages });
    apply.disabled = !rows.some((row) => row.state === "approved");
    reviewCounts.textContent = t("research_reviewCounts", {
      total: rows.length, changed: rows.filter((row) => Object.keys(row.proposed).length).length,
      high: rows.filter((row) => confidence(row) === "high").length,
      medium: rows.filter((row) => confidence(row) === "medium").length,
      low: rows.filter((row) => confidence(row) === "low").length,
      unresolved: rows.filter(unresolved).length,
      conflicts: rows.filter((row) => row.conflict).length,
      approved: rows.filter((row) => row.state === "approved").length,
      rejected: rows.filter((row) => row.state === "rejected").length,
      pending: rows.filter((row) => row.state === "pending").length,
    });
    rowsContainer.replaceChildren();
    for (const row of visibleRows.slice(page * 30, page * 30 + 30)) {
      const details = el("details");
      const summary = el("summary");
      summary.className = "metadata-research-grid";
      const checkbox = check("selected");
      checkbox.checked = selected.has(key(row));
      checkbox.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => checkbox.checked ? selected.add(key(row)) : selected.delete(key(row)));
      const current = row.snapshot;
      const confidenceKey = confidence(row) ?? "";
      const confidenceLabel = ["high", "medium", "low", "unknown"].includes(confidenceKey)
        ? label(confidenceKey)
        : row.original.confidence || "—";
      summary.append(checkbox, ...[
        String(current?.title || row.original.title || row.id || label("unresolved")),
        String(current?.artist || row.original.artist || "—"), String(current?.singer || row.original.singer || "—"),
        String(current?.genre || row.original.genre || "—"), String(current?.year || row.original.year || "—"),
        String(current?.bpm || row.original.bpm || "—"),
        confidenceLabel,
        t("research_changeCount", { count: Object.keys(row.proposed).length }),
        [label(row.state), row.conflict || row.issues.length ? label("conflict") : ""].filter(Boolean).join(" · "),
      ].map((value) => el("span", value)));
      const content = el("div");
      details.append(summary, content);
      details.addEventListener("toggle", () => { if (details.open) renderDetails(row, content); });
      rowsContainer.append(details);
    }
  }
  document.querySelector('[data-tab="library"]:is(button)')?.addEventListener("click", () => void run(refresh));
  return () => void run(refresh);
}
