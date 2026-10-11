import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runCLI, search } from "../../src/lib/digup";

// Uses a REAL released helper and its REAL SQLite schema in a disposable directory.
// Keyword-only fixture: no model download and no access to the user's index.
test(
  "released DigUp CLI: files, kinds, code, limits, and flag-like queries",
  { skip: !process.env.DIGUP_TEST_CLI },
  async () => {
    const executablePath = process.env.DIGUP_TEST_CLI!;
    const directory = await mkdtemp(join(tmpdir(), "digup-release-test-"));
    try {
      const indexDirectory = join(directory, "index with spaces");
      await runCLI(executablePath, ["status", "--index", indexDirectory]);
      await runCLI(executablePath, [
        "status",
        "--code",
        "--index",
        indexDirectory,
      ]);
      const document = join(directory, "lease with spaces.txt");
      await writeFile(document, "Pets are allowed in the rental apartment.");
      const escaped = document.replaceAll("'", "''");
      const insert = (
        path: string,
        kind: string,
        segment: string,
        body: string,
      ) => `
      INSERT INTO files(id,path,kind,size,mtime,inode,device,state) VALUES(1,'${path}','${kind}',40,0,1,1,'done');
      INSERT INTO segments(id,file,kind,modality,loc,excerpt) VALUES(1,1,'${segment}','none',3,'${body}');
      INSERT INTO fts(rowid,name,body) VALUES(1,'test','${body}');`;
      await runCLI("/usr/bin/sqlite3", [
        join(indexDirectory, "index.sqlite"),
        insert(escaped, "doc", "chunk", "pets allowed rental apartment"),
      ]);
      await runCLI("/usr/bin/sqlite3", [
        join(indexDirectory, "code.sqlite"),
        insert(escaped, "code", "lines", "function retryRequest with backoff"),
      ]);
      const settings = { executablePath, indexDirectory, maxResults: "20" };
      const hits = await search(settings, "pets", false, "all");
      assert.equal(hits[0]?.path, document);
      assert.equal(hits[0]?.loc, 3);
      assert.equal(hits[0]?.kind, "doc");
      assert.deepEqual(await search(settings, "pets", false, "pdf"), []);
      assert.equal(
        (await search(settings, "retryRequest", true, "all"))[0]?.kind,
        "code",
      );
      assert.equal(
        (await search(settings, " CODE: retryRequest", false, "pdf"))[0]?.kind,
        "code",
      );
      assert.deepEqual(await search(settings, "--index", false, "all"), []);
      assert.equal(
        (await search({ ...settings, maxResults: "1" }, "pets", false, "all"))
          .length,
        1,
      );
      assert.deepEqual(
        await search(settings, "unrelatedxyz", false, "all"),
        [],
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
