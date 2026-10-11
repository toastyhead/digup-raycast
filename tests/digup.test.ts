import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  normalizeQuery,
  parseResults,
  requireIndex,
  resolveConnection,
  runCLI,
  search,
  searchArguments,
} from "../src/lib/digup";
import {
  editorURL,
  literalMarkdown,
  location,
  mediaMoment,
} from "../src/lib/presentation";

test("routes code prefixes, including whitespace and empty prefixes", () => {
  assert.deepEqual(normalizeQuery(" CODE: retry with backoff ", false), {
    query: "code: retry with backoff",
    code: true,
  });
  assert.deepEqual(normalizeQuery("code: ", false), { query: "", code: true });
  assert.deepEqual(normalizeQuery("retry", true), {
    query: "code: retry",
    code: true,
  });
  assert.deepEqual(normalizeQuery("invoice", false), {
    query: "invoice",
    code: false,
  });
});

test("queries are one positional argument, including flag and shell-like input", () => {
  const connection = {
    executable: "/Applications/DigUp.app/Contents/Helpers/digup",
    indexDirectory: "/tmp/an index",
  };
  const query = '--index /tmp/other $(touch /tmp/nope); "quotes"';
  assert.deepEqual(searchArguments(connection, query, "pdf", 20), [
    "search",
    ` ${query}`,
    "--json",
    "--index",
    "/tmp/an index",
    "-n",
    "20",
    "--kind",
    "pdf",
  ]);
  assert.ok(
    !searchArguments(connection, "code: retry", "pdf", 20).includes("--kind"),
  );
  assert.throws(() => searchArguments(connection, "hello", "all", NaN));
  assert.throws(() => searchArguments(connection, "hello\0world", "all", 20));
});

test("parses real CLI fields and rejects malformed output before opening paths", () => {
  const row = {
    path: "/tmp/test.pdf",
    kind: "pdf",
    segment: "page",
    loc: 3,
    score: 0.87,
    excerpt: "Pets allowed",
  };
  const [hit] = parseResults(JSON.stringify([row]));
  assert.equal(hit.loc, 3);
  assert.equal(hit.excerpt, "Pets allowed");
  assert.deepEqual(parseResults("[]"), []);
  for (const output of [
    "warning\n[]",
    "{}",
    "[null]",
    JSON.stringify([{ ...row, path: "https://example.com" }]),
    JSON.stringify([{ ...row, loc: "3" }]),
    JSON.stringify([{ ...row, kind: "unknown" }]),
  ]) {
    assert.throws(() => parseResults(output));
  }
});

test("preserves page, moment, code focus and encoded editor paths", () => {
  const [hit] = parseResults(
    JSON.stringify([
      {
        path: "/tmp/a #? file.ts",
        kind: "code",
        segment: "lines",
        loc: 8,
        loc_end: 20,
        focus: 12,
        score: 1,
      },
    ]),
  );
  assert.equal(location(hit), "Line 12");
  assert.equal(
    editorURL(hit, "vscode"),
    "vscode://file/tmp/a%20%23%3F%20file.ts:12:1",
  );
  assert.equal(
    editorURL({ ...hit, segment: "cells" }, "cursor"),
    "cursor://file/tmp/a%20%23%3F%20file.ts:1:1",
  );
  assert.equal(editorURL(hit, "javascript"), undefined);
  assert.equal(
    location({ ...hit, kind: "pdf", segment: "page_image", loc: 3 }),
    "Page 3",
  );
  assert.equal(
    location({ ...hit, kind: "video", segment: "frame", loc: 3605 }),
    "1:00:05",
  );
  assert.equal(
    mediaMoment({ ...hit, kind: "video", segment: "frame", loc: 0 }),
    0,
  );
  assert.equal(mediaMoment(hit), undefined);
  assert.ok(
    literalMarkdown("```\n[click](https://example.com)").startsWith("````\n"),
  );
});

test("missing indexes are actionable and never created during a search", async () => {
  const directory = await mkdtemp(join(tmpdir(), "digup-missing-"));
  try {
    const connection = {
      executable: process.execPath,
      indexDirectory: join(directory, "missing"),
    };
    await assert.rejects(
      requireIndex(connection, false),
      /No readable file index/,
    );
    await assert.rejects(requireIndex(connection, true), /Enable Code Search/);
    await assert.rejects(
      search(
        {
          executablePath: process.execPath,
          indexDirectory: connection.indexDirectory,
        },
        "query",
        false,
        "all",
      ),
      /No readable file index/,
    );
    await assert.rejects(
      resolveConnection({ executablePath: directory }),
      /not an executable file/,
    );
    await assert.rejects(
      resolveConnection({ executablePath: "relative/digup" }),
      /not an executable file/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("subprocess integration handles spaces, JSON, stderr, timeout and cancellation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "digup-process-"));
  try {
    const script = join(directory, "fake helper.cjs");
    await writeFile(
      script,
      'const mode=process.argv[2]; if(mode==="fail"){console.error("model missing");process.exit(1)} else if(mode==="wait"){setTimeout(()=>{},60000)} else {console.log(JSON.stringify(process.argv.slice(2)))}',
    );
    const dangerous = 'two words $(touch never); "quoted"';
    assert.deepEqual(
      JSON.parse(await runCLI(process.execPath, [script, dangerous])),
      [dangerous],
    );
    await assert.rejects(
      runCLI(process.execPath, [script, "fail"]),
      /model missing/,
    );
    await assert.rejects(
      runCLI(process.execPath, [script, "wait"], undefined, 100),
      /too long/,
    );
    const controller = new AbortController();
    const pending = runCLI(
      process.execPath,
      [script, "wait"],
      controller.signal,
    );
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
    await mkdir(join(directory, "index"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
