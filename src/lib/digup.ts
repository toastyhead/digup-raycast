import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

export const kinds = [
  "screenshot",
  "image",
  "pdf",
  "doc",
  "audio",
  "video",
  "code",
] as const;
export type FileKind = (typeof kinds)[number];
export type Filter = "all" | Exclude<FileKind, "code">;
export interface SearchHit {
  path: string;
  kind: FileKind;
  segment: string;
  score: number;
  loc?: number;
  loc_end?: number;
  focus?: number;
  excerpt?: string;
}
export interface Settings {
  executablePath?: string;
  indexDirectory?: string;
  maxResults?: string;
  codeEditor?: string;
}
export interface Connection {
  executable: string;
  indexDirectory: string;
}
export class DigUpError extends Error {}

export function expandHome(path: string): string {
  return path === "~"
    ? homedir()
    : path.startsWith("~/")
      ? join(homedir(), path.slice(2))
      : path;
}

async function executableFile(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export async function resolveConnection(
  settings: Settings,
): Promise<Connection> {
  const custom = settings.executablePath?.trim();
  const candidates = custom
    ? [expandHome(custom)]
    : [
        "/Applications/DigUp.app/Contents/Helpers/digup",
        join(homedir(), "Applications/DigUp.app/Contents/Helpers/digup"),
        "/opt/homebrew/bin/digup",
        "/usr/local/bin/digup",
      ];
  for (const executable of candidates) {
    if (!isAbsolute(executable) || !(await executableFile(executable)))
      continue;
    const indexDirectory = expandHome(
      settings.indexDirectory?.trim() ||
        "~/Library/Application Support/DigUp/index.noindex",
    );
    if (!isAbsolute(indexDirectory))
      throw new DigUpError("Choose an absolute path for the index directory.");
    return { executable, indexDirectory };
  }
  throw new DigUpError(
    custom
      ? "The configured DigUp CLI is not an executable file. Check its full path in extension preferences."
      : "Install DigUp in Applications, then open it to download the model and choose your folders.",
  );
}

export function normalizeQuery(
  query: string,
  code: boolean,
): { query: string; code: boolean } {
  const trimmed = query.trim();
  const prefixed = /^code:/i.test(trimmed);
  const words = prefixed ? trimmed.slice(5).trim() : trimmed;
  return {
    query: words ? (code || prefixed ? `code: ${words}` : words) : "",
    code: code || prefixed,
  };
}

export function searchArguments(
  connection: Connection,
  query: string,
  filter: Filter,
  limit: number,
): string[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new DigUpError("Result limit must be 1–100.");
  if (query.includes("\0"))
    throw new DigUpError("The query contains an unsupported null character.");
  // DigUp's argument parser has no `--` terminator. A leading space keeps flag-like
  // queries positional; its search/code parser ignores surrounding whitespace.
  const args = [
    "search",
    ` ${query}`,
    "--json",
    "--index",
    connection.indexDirectory,
    "-n",
    String(limit),
  ];
  if (filter !== "all" && !/^code:/i.test(query)) args.push("--kind", filter);
  return args;
}

export function runCLI(
  executable: string,
  args: string[],
  signal?: AbortSignal,
  timeout = 30_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      { signal, timeout, maxBuffer: 8 * 1024 * 1024, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (signal?.aborted || error?.name === "AbortError") {
          reject(new DOMException("Search cancelled", "AbortError"));
        } else if (error) {
          const reason = error.killed
            ? "DigUp took too long to respond. Wait for indexing to settle, then try again."
            : stderr.trim().slice(0, 1500) || error.message;
          reject(new DigUpError(reason));
        } else {
          resolve(stdout);
        }
      },
    );
  });
}

export function parseResults(output: string): SearchHit[] {
  let rows: unknown;
  try {
    rows = JSON.parse(output);
  } catch {
    throw new DigUpError(
      "DigUp returned invalid JSON. Update DigUp or check the configured CLI path.",
    );
  }
  if (!Array.isArray(rows))
    throw new DigUpError(
      "DigUp returned an unexpected response; expected a result list.",
    );
  return rows.map((value: unknown) => {
    if (typeof value !== "object" || value === null)
      throw new DigUpError("DigUp returned an invalid search result.");
    const row = value as Record<string, unknown>;
    if (
      typeof row.path !== "string" ||
      !isAbsolute(row.path) ||
      row.path.includes("\0") ||
      !kinds.includes(row.kind as FileKind) ||
      typeof row.segment !== "string" ||
      typeof row.score !== "number" ||
      !Number.isFinite(row.score)
    )
      throw new DigUpError(
        "DigUp returned an invalid search result. Check that DigUp is up to date.",
      );
    for (const key of ["loc", "loc_end", "focus"] as const) {
      if (
        row[key] !== undefined &&
        (typeof row[key] !== "number" ||
          !Number.isFinite(row[key]) ||
          row[key] < 0)
      ) {
        throw new DigUpError(`DigUp returned an invalid ${key} value.`);
      }
    }
    if (row.excerpt !== undefined && typeof row.excerpt !== "string")
      throw new DigUpError("Invalid result excerpt.");
    return {
      path: row.path,
      kind: row.kind as FileKind,
      segment: row.segment,
      score: row.score,
      loc: row.loc as number | undefined,
      loc_end: row.loc_end as number | undefined,
      focus: row.focus as number | undefined,
      excerpt: row.excerpt as string | undefined,
    };
  });
}

export async function requireIndex(
  connection: Connection,
  code: boolean,
): Promise<void> {
  const path = join(
    connection.indexDirectory,
    code ? "code.sqlite" : "index.sqlite",
  );
  try {
    await access(path, constants.R_OK);
    if (!(await stat(path)).isFile()) throw new Error("Not a file");
  } catch {
    throw new DigUpError(
      code
        ? "No readable code index. Enable Code Search and choose repositories in DigUp Settings → Code."
        : "No readable file index. Open DigUp, choose folders, and let indexing start. Check the index directory in extension preferences if you use a custom location.",
    );
  }
}

export async function search(
  settings: Settings,
  text: string,
  code: boolean,
  filter: Filter,
  signal?: AbortSignal,
): Promise<SearchHit[]> {
  const normalized = normalizeQuery(text, code);
  if (!normalized.query) return [];
  const connection = await resolveConnection(settings);
  // The upstream CLI creates a database when missing; never create one just by searching.
  await requireIndex(connection, normalized.code);
  const output = await runCLI(
    connection.executable,
    searchArguments(
      connection,
      normalized.query,
      filter,
      Number(settings.maxResults || "20"),
    ),
    signal,
  );
  return parseResults(output);
}
