import { sortBaseStyles, splitStyleLabel, composeStyleLabel, serializeStyleFamilies } from "../../shared/style-families.js";
import { normalizeStyleName } from "../../shared/tanda-utils.js";
import type { StyleFamily } from "../../shared/style-families.js";
import { pulseStyleFamilyEditFields } from "../modules/style-family-view.js";
import { setLegacyStyleMapping, getLegacyStyleMapping } from "../../shared/legacy-style-mappings.js";
import type { StyleMap } from "../../shared/playlist-sequence.js";
import type { LegacyStyleMappingState } from "../../shared/legacy-style-mappings.js";

export interface StyleSettingsControllerOptions {
  styleFamilies: StyleFamily[];
  availableStyles: string[];
  getPlaylistStyleMap: () => StyleMap;
  STYLE_FAMILIES_KEY: "tanda-style-families";
  loadStyles: () => Promise<void>;
  renderTandaDesigner: () => void;
  refreshSearch: () => Promise<void>;
  styleFamilyList: HTMLDivElement | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  styleFamilyCodeInput: HTMLInputElement | null;
  styleFamilyBaseInput: HTMLInputElement | null;
  styleFamilyVariantsInput: HTMLInputElement | null;
  LEGACY_STYLE_MAPPINGS_KEY: "tanda-legacy-style-mappings-v1";
  legacyStyleMappings: LegacyStyleMappingState;
  legacyImportRootPath: string | null;
  legacyStyleRows: { value: string; normalized: string; count: number; mappedTo: string; }[];
  legacyStylesResult: HTMLDivElement | null;
  legacyStyleMappingEl: HTMLDivElement | null;
  legacyStyleMappingBody: HTMLTableSectionElement | null;
}

export const createStyleSettingsController = (options: StyleSettingsControllerOptions) => {
  const {
    getPlaylistStyleMap,
    STYLE_FAMILIES_KEY,
    loadStyles,
    renderTandaDesigner,
    refreshSearch,
    styleFamilyList,
    t,
    styleFamilyCodeInput,
    styleFamilyBaseInput,
    styleFamilyVariantsInput,
    LEGACY_STYLE_MAPPINGS_KEY,
    legacyStylesResult,
    legacyStyleMappingEl,
    legacyStyleMappingBody,
  } = options;

  const getBaseStyles = () => {
    const bases = sortBaseStyles(options.styleFamilies.map((family) => family.base).filter(Boolean));
    if (bases.length > 0) {
      return bases;
    }
    return sortBaseStyles(
      options.availableStyles.map((style) => splitStyleLabel(style).base).filter(Boolean),
    );
  };

  const getSelectableStyles = () => {
    const expanded = Object.values(getPlaylistStyleMap()).flat();
    if (expanded.length > 0) {
      return Array.from(new Set(expanded.map((style) => normalizeStyleName(style)).filter(Boolean)));
    }
    return options.availableStyles;
  };

  const syncStylesFromFamilies = async () => {
    if (!window.tanda) {
      return;
    }
    const desired = new Set<string>();
    options.styleFamilies.forEach((family) => {
      const base = normalizeStyleName(family.base);
      if (!base) {
        return;
      }
      desired.add(base);
      family.variants.forEach((variant) => {
        const composed = composeStyleLabel(base, variant);
        if (composed) {
          desired.add(composed);
        }
      });
    });
    for (const style of Array.from(desired)) {
      await window.tanda.addStyle(style);
    }
  };

  const setStyleFamilies = async (families: StyleFamily[]) => {
    options.styleFamilies = families
      .map((family) => ({
        code: family.code.trim().toUpperCase(),
        base: normalizeStyleName(family.base),
        variants: family.variants
          .map((variant) => normalizeStyleName(variant))
          .filter(Boolean),
      }))
      .filter((family) => family.code && family.base);
    localStorage.setItem(STYLE_FAMILIES_KEY, serializeStyleFamilies(options.styleFamilies));
    await syncStylesFromFamilies();
    await loadStyles();
    await refreshLegacyStyleRows();
    renderTandaDesigner();
    refreshSearch();
  };

  const renderStyleFamilyList = () => {
    if (!styleFamilyList) {
      return;
    }
    styleFamilyList.innerHTML = "";
    if (options.styleFamilies.length === 0) {
      styleFamilyList.textContent = t("styleEmpty");
      return;
    }
    options.styleFamilies.forEach((family) => {
      const row = document.createElement("div");
      row.className = "style-family-row";

      const code = document.createElement("span");
      code.className = "code";
      code.textContent = family.code;

      const base = document.createElement("span");
      base.className = "base";
      base.textContent = family.base;

      const variants = document.createElement("span");
      variants.className = "variants";
      variants.textContent =
        family.variants.length > 0
          ? family.variants.join(" · ")
          : family.base;

      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = t("styleFamilyEdit");
      edit.addEventListener("click", () => {
        if (styleFamilyCodeInput) {
          styleFamilyCodeInput.value = family.code;
        }
        if (styleFamilyBaseInput) {
          styleFamilyBaseInput.value = family.base;
        }
        if (styleFamilyVariantsInput) {
          styleFamilyVariantsInput.value = family.variants.join(", ");
        }
        pulseStyleFamilyEditFields([
          styleFamilyCodeInput,
          styleFamilyBaseInput,
          styleFamilyVariantsInput,
        ]);
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = t("styleRemove");
      remove.setAttribute("aria-label", t("styleRemoveLabel", { style: family.base }));
      remove.addEventListener("click", async () => {
        const next = options.styleFamilies.filter((item) => item.code !== family.code);
        await setStyleFamilies(next);
      });
      row.append(code, base, variants, edit, remove);
      styleFamilyList.appendChild(row);
    });
  };

  const mapLegacyStyleToCanonical = async (
    legacyStyle: string,
    canonicalStyle: string,
  ) => {
    if (!window.tanda) {
      return;
    }
    const target = canonicalStyle.trim();
    if (!target) {
      return;
    }
    const definitions = await window.tanda.listStyleDefinitions();
    const current = definitions.find((definition) => definition.name === target);
    const aliases = current?.aliases ?? [];
    const normalizedLegacy = normalizeStyleName(legacyStyle);
    const alreadyMapped =
      normalizeStyleName(target).toLowerCase() === normalizedLegacy.toLowerCase() ||
      aliases.some(
        (alias) => normalizeStyleName(alias).toLowerCase() === normalizedLegacy.toLowerCase(),
      );
    if (alreadyMapped) {
      return;
    }
    const definition = [target, ...aliases, legacyStyle].join(";");
    await window.tanda.addStyle(definition);
  };

  const saveLegacyStyleMappings = () => {
    localStorage.setItem(
      LEGACY_STYLE_MAPPINGS_KEY,
      JSON.stringify(options.legacyStyleMappings),
    );
  };

  const rememberLegacyStyleMapping = (legacyStyle: string, canonicalStyle: string) => {
    if (!options.legacyImportRootPath) {
      return;
    }
    options.legacyStyleMappings = setLegacyStyleMapping(
      options.legacyStyleMappings,
      options.legacyImportRootPath,
      legacyStyle,
      canonicalStyle,
    );
    saveLegacyStyleMappings();
  };

  const resolveStoredLegacyStyleMapping = (legacyStyle: string) => {
    if (!options.legacyImportRootPath) {
      return "";
    }
    return getLegacyStyleMapping(
      options.legacyStyleMappings,
      options.legacyImportRootPath,
      legacyStyle,
    );
  };

  const refreshLegacyStyleRows = async () => {
    if (!window.tanda || !options.legacyImportRootPath) {
      return;
    }
    const result = await window.tanda.listLegacyStyles(options.legacyImportRootPath);
    if (!result.ok) {
      return;
    }
    options.legacyStyleRows = result.styles.map((entry) => {
      const mappedTo = entry.mappedTo || resolveStoredLegacyStyleMapping(entry.value);
      if (mappedTo) {
        rememberLegacyStyleMapping(entry.value, mappedTo);
      }
      return {
        ...entry,
        mappedTo,
      };
    });
    if (legacyStylesResult) {
      const mappedCount = options.legacyStyleRows.filter((entry) => entry.mappedTo).length;
      legacyStylesResult.textContent = t("legacyStylesSummary", {
        total: options.legacyStyleRows.length,
        mapped: mappedCount,
        unmapped: Math.max(0, options.legacyStyleRows.length - mappedCount),
      });
    }
    renderLegacyStyleMappingTable();
  };

  const applyStoredLegacyStyleMappingsForImport = async () => {
    if (!window.tanda || !options.legacyImportRootPath || options.legacyStyleRows.length === 0) {
      return;
    }
    let changed = false;
    for (const row of options.legacyStyleRows) {
      if (row.mappedTo) {
        continue;
      }
      const target = resolveStoredLegacyStyleMapping(row.value);
      if (!target) {
        continue;
      }
      await mapLegacyStyleToCanonical(row.value, target);
      rememberLegacyStyleMapping(row.value, target);
      changed = true;
    }
    if (changed) {
      await loadStyles();
      await refreshLegacyStyleRows();
    }
  };

  const renderLegacyStyleMappingTable = () => {
    if (!legacyStyleMappingEl || !legacyStyleMappingBody) {
      return;
    }
    legacyStyleMappingBody.innerHTML = "";
    if (options.legacyStyleRows.length === 0) {
      legacyStyleMappingEl.classList.add("hidden");
      return;
    }
    legacyStyleMappingEl.classList.remove("hidden");
    options.legacyStyleRows.forEach((entry) => {
      const row = document.createElement("tr");

      const valueCell = document.createElement("td");
      valueCell.textContent = entry.value;

      const countCell = document.createElement("td");
      countCell.textContent = entry.count.toString();

      const mappedCell = document.createElement("td");
      mappedCell.textContent = entry.mappedTo || t("legacyStylesUnmapped");

      const actionsCell = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "legacy-style-mapping-actions";
      const primaryActions = document.createElement("div");
      primaryActions.className = "legacy-style-actions-primary";
      const secondaryActions = document.createElement("div");
      secondaryActions.className = "legacy-style-actions-secondary hidden";
      const select = document.createElement("select");
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = t("legacyStylesMapSelect");
      select.appendChild(empty);
      getSelectableStyles().forEach((style) => {
        const option = document.createElement("option");
        option.value = style;
        option.textContent = style;
        select.appendChild(option);
      });
      select.value = entry.mappedTo || "";
      select.addEventListener("change", () => {
        const selected = select.value;
        if (!selected) {
          return;
        }
        void mapLegacyStyleToCanonical(entry.value, selected).then(async () => {
          rememberLegacyStyleMapping(entry.value, selected);
          await loadStyles();
          await refreshLegacyStyleRows();
        });
      });

      const addCode = document.createElement("input");
      addCode.type = "text";
      addCode.maxLength = 3;
      addCode.value = (entry.value.trim().slice(0, 1).toUpperCase() || "X").replace(
        /[^A-Z0-9]/g,
        "",
      );
      addCode.title = t("styleFamilyCodePlaceholder");
      addCode.setAttribute("aria-label", t("styleFamilyCodePlaceholder"));

      const addBase = document.createElement("input");
      addBase.type = "text";
      addBase.value = entry.mappedTo || normalizeStyleName(entry.value);
      addBase.title = t("styleFamilyBasePlaceholder");
      addBase.setAttribute("aria-label", t("styleFamilyBasePlaceholder"));

      const addAlias = document.createElement("input");
      addAlias.type = "text";
      addAlias.value = entry.value;
      addAlias.title = t("legacyStylesColValue");
      addAlias.setAttribute("aria-label", t("legacyStylesColValue"));

      const addNewBtn = document.createElement("button");
      addNewBtn.type = "button";
      addNewBtn.textContent = t("legacyStylesAddAsNew");
      const toggleAddNewBtn = document.createElement("button");
      toggleAddNewBtn.type = "button";
      toggleAddNewBtn.textContent = t("legacyStylesAddAsNew");
      toggleAddNewBtn.addEventListener("click", () => {
        const opening = secondaryActions.classList.contains("hidden");
        secondaryActions.classList.toggle("hidden", !opening);
        toggleAddNewBtn.textContent = opening ? t("cancel") : t("legacyStylesAddAsNew");
      });
      addNewBtn.addEventListener("click", async () => {
        const code = addCode.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        const base = normalizeStyleName(addBase.value);
        const alias = addAlias.value.trim();
        if (!code || !base) {
          return;
        }
        const baseParts = splitStyleLabel(base);
        const incoming = {
          code,
          base: baseParts.base || normalizeStyleName(base),
          variants: baseParts.variant ? [baseParts.variant] : [],
        };
        const existing = options.styleFamilies.find((family) => family.code === code);
        const nextFamilies = options.styleFamilies.filter((family) => family.code !== code);
        if (existing && existing.base === incoming.base) {
          nextFamilies.push({
            code,
            base: existing.base,
            variants: Array.from(new Set(existing.variants.concat(incoming.variants))),
          });
        } else {
          nextFamilies.push(incoming);
        }
        await setStyleFamilies(nextFamilies);
        await mapLegacyStyleToCanonical(entry.value, base);
        rememberLegacyStyleMapping(entry.value, base);
        if (alias && normalizeStyleName(alias) !== normalizeStyleName(entry.value)) {
          await mapLegacyStyleToCanonical(alias, base);
        }
        await refreshLegacyStyleRows();
      });
      primaryActions.append(select, toggleAddNewBtn);
      secondaryActions.append(addCode, addBase, addAlias, addNewBtn);
      actions.append(primaryActions, secondaryActions);
      actionsCell.appendChild(actions);

      row.append(valueCell, countCell, mappedCell, actionsCell);
      legacyStyleMappingBody.appendChild(row);
    });
  };

  return {
    getBaseStyles,
    renderStyleFamilyList,
    renderLegacyStyleMappingTable,
    refreshLegacyStyleRows,
    setStyleFamilies,
    applyStoredLegacyStyleMappingsForImport,
  };
};
