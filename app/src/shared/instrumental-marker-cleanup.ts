const TRAILING_SUFFIX_PATTERN =
  /(?:(?:\s*(?:\([^)]*\)|\[[^\]]*\]))+)?(?:\.[A-Za-z0-9]{2,5})?\s*$/;

const STRIP_PATTERNS: Array<[pattern: RegExp, replacer: string | ((...args: string[]) => string)]> = [
  [/\(\s*instrumental\s*\(([^()]*)\)\s*\)(?=(?:\s*(?:\([^)]*\)|\[[^\]]*\]))*(?:\.[A-Za-z0-9]{2,5})?\s*$)/i, "($1)"],
  [/\[\s*instrumental\s*\[([^[\]]*)\]\s*\](?=(?:\s*(?:\([^)]*\)|\[[^\]]*\]))*(?:\.[A-Za-z0-9]{2,5})?\s*$)/i, "[$1]"],
  [/\(\s*instrumental\s*\)(?=(?:\s*(?:\([^)]*\)|\[[^\]]*\]))*(?:\.[A-Za-z0-9]{2,5})?\s*$)/i, ""],
  [/\[\s*instrumental\s*\](?=(?:\s*(?:\([^)]*\)|\[[^\]]*\]))*(?:\.[A-Za-z0-9]{2,5})?\s*$)/i, ""],
  [/\s*[.,:/|-]\s*instrumental(?=(?:\s*(?:\([^)]*\)|\[[^\]]*\]))*(?:\.[A-Za-z0-9]{2,5})?\s*$)/i, ""],
  [/\s+instrumental(?=(?:\s*(?:\([^)]*\)|\[[^\]]*\]))*(?:\.[A-Za-z0-9]{2,5})?\s*$)/i, ""],
];

const tidyTrailingSeparators = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\s+([)\]])/g, "$1")
    .replace(/\s*[(\[]\s*$/g, "")
    .replace(/\s*[-.,:/|]\s*$/g, "")
    .trim();

const stripFromTrailingSuffix = (value: string) => {
  let current = value;
  let changed = false;
  while (true) {
    let replaced = false;
    for (const [pattern, replacer] of STRIP_PATTERNS) {
      const next = current.replace(pattern, replacer as never);
      if (next !== current) {
        current = next;
        changed = true;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      break;
    }
  }
  return { changed, value: current };
};

export const hasAppendedInstrumentalMarker = (value: string | null | undefined) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || !TRAILING_SUFFIX_PATTERN.test(raw)) {
    return false;
  }
  return stripAppendedInstrumentalMarker(raw).changed;
};

export const stripAppendedInstrumentalMarker = (value: string | null | undefined) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return { changed: false, value: "" };
  }
  const stripped = stripFromTrailingSuffix(raw);
  if (!stripped.changed) {
    return { changed: false, value: raw };
  }
  const cleaned = tidyTrailingSeparators(stripped.value);
  return {
    changed: cleaned !== raw,
    value: cleaned,
  };
};
