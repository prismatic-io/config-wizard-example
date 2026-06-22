"use client";

/**
 * A typed editing surface over a config var whose value is a JSON **string**.
 *
 * Several wizard config vars (the brand "Configuration" var, generic JSONFORMs) store
 * their value as a JSON string that the UI must parse to read and re-stringify to
 * write. Every step component was hand-rolling the same quartet — tolerant-parse,
 * read a nested slice with `Array.isArray`/`typeof === "object"` guards, shallow-merge
 * a patch, then `JSON.stringify(next, null, 2)` back through `onChange`. This hook owns
 * that quartet so a step component only thinks in terms of its parsed shape.
 */
export interface JsonDraft<T extends object> {
  /** The parsed value (or the fallback when the string is empty/invalid/non-object). */
  value: T;
  /** Replace the whole object — re-stringifies (2-space) through `onChange`. */
  set: (next: T) => void;
  /** Shallow-merge a partial at the top level. */
  patch: (partial: Partial<T>) => void;
  /** Read one key's value as an object ({} when missing or not a plain object). */
  slice: <V extends object = Record<string, unknown>>(key: keyof T) => V;
  /** Shallow-merge a partial into one key's object slice (the nested `setField` pattern). */
  patchSlice: <V extends object = Record<string, unknown>>(
    key: keyof T,
    partial: Partial<V>,
  ) => void;
}

/** Tolerant read of a value as a plain (non-array) object; {} otherwise. */
function asObject<V extends object>(v: unknown): V {
  return (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as V;
}

/** Tolerant parse of a JSON string to a plain object, falling back when empty/invalid. */
function parseObject<T extends object>(value: string, fallback: T | (() => T)): T {
  const fb = () => (typeof fallback === "function" ? (fallback as () => T)() : fallback);
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {
      /* fall through to fallback */
    }
  }
  return fb();
}

/**
 * @param value    The config var's current value (a JSON string).
 * @param onChange Persist the next value (a JSON string) — the field's `onChange`.
 * @param fallback The shape to use when `value` is empty/invalid. Pass a thunk when it's
 *                 derived (e.g. `() => defaultsFromSchema(schema)`).
 *
 * The one invariant this hook centralizes is **2-space stringify**: output formatting
 * must match what the rest of the wizard compares/round-trips (`pageReady`, submit), so
 * every writer goes through `JSON.stringify(_, null, 2)`.
 *
 * No manual `useMemo`/`useCallback` here: the parse is cheap and nothing depends on the
 * returned closures' identity, so plain recomputation each render is simplest. (Adding
 * memoization with mismatched deps would only trip eslint-plugin-react-hooks for no gain.)
 */
export function useJsonDraft<T extends object>(
  value: string,
  onChange: (next: string) => void,
  fallback: T | (() => T),
): JsonDraft<T> {
  const data = parseObject(value, fallback);
  const read = (key: keyof T) => (data as Record<string, unknown>)[key as string];

  const set = (next: T) => onChange(JSON.stringify(next, null, 2));

  return {
    value: data,
    set,
    patch: (partial) => set({ ...data, ...partial }),
    slice: <V extends object = Record<string, unknown>>(key: keyof T) =>
      asObject<V>(read(key)),
    patchSlice: <V extends object = Record<string, unknown>>(
      key: keyof T,
      partial: Partial<V>,
    ) => set({ ...data, [key]: { ...asObject(read(key)), ...partial } } as T),
  };
}
