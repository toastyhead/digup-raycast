import { homedir } from "node:os";
import { SearchHit } from "./digup";

export function friendlyPath(path: string): string {
  return path.startsWith(homedir() + "/")
    ? "~" + path.slice(homedir().length)
    : path;
}

export function clock(seconds: number): string {
  const total = Math.floor(seconds);
  const parts = [Math.floor(total / 60) % 60, total % 60].map((n) =>
    String(n).padStart(2, "0"),
  );
  if (total >= 3600) parts.unshift(String(Math.floor(total / 3600)));
  return parts.join(":");
}

export function location(hit: SearchHit): string | undefined {
  if (hit.loc === undefined)
    return hit.segment === "ocr" ? "Text in image" : undefined;
  switch (hit.segment) {
    case "page":
    case "page_image":
      return `Page ${hit.loc}`;
    case "audio":
    case "frame":
      return clock(hit.loc);
    case "lines":
      return `Line ${hit.focus ?? hit.loc}`;
    case "cells":
      return `Cell ${hit.loc}`;
    case "chunk":
      return `Part ${hit.loc}`;
    default:
      return undefined;
  }
}

export function literalMarkdown(text: string): string {
  const longest = Math.max(
    2,
    ...Array.from(text.matchAll(/`+/g), (match) => match[0].length),
  );
  const fence = "`".repeat(longest + 1);
  return `${fence}\n${text}\n${fence}`;
}

export function editorURL(hit: SearchHit, editor: string): string | undefined {
  if (hit.kind !== "code" || !["vscode", "cursor", "windsurf"].includes(editor))
    return undefined;
  const line =
    hit.segment === "lines"
      ? Math.max(1, Math.floor(hit.focus ?? hit.loc ?? 1))
      : 1;
  const path = hit.path.split("/").map(encodeURIComponent).join("/");
  return `${editor}://file${path}:${line}:1`;
}

export function mediaMoment(hit: SearchHit): number | undefined {
  return (hit.kind === "audio" || hit.kind === "video") &&
    ["audio", "frame"].includes(hit.segment)
    ? hit.loc
    : undefined;
}
