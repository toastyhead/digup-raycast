# DigUp for Raycast

Search the files on your Mac by what is in them, directly from Raycast. This extension uses [DigUp](https://github.com/ARahim3/DigUp)'s existing local index and the `digup` CLI bundled with its Mac app. It does not need an API key, a separate server, or a Swift build.

## Commands

| Command               | What it does                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------- |
| **Search Files**      | Search documents, PDFs, images, screenshots, recordings, and videos. Filter by file type. |
| **Search Code**       | Search the repositories enabled in DigUp's code settings.                                 |
| **Check DigUp Setup** | Find the helper, inspect both indexes, and show setup instructions.                       |

Searches preserve DigUp's ranking. Images and screenshots appear directly in the preview pane. Other results show text excerpts when available, with page, timestamp, or line locations beside the result. Actions open the file, reveal it in Finder, show Quick Look, and copy the file, path, or excerpt. Supported code editors open at the matching line. A recording can open at its matching timestamp in QuickTime.

## Requirements

- Apple Silicon Mac with macOS 14 or later.
- Raycast. Developed and tested against the 1.104 API.
- DigUp with at least one folder indexed. Tested against **DigUp 0.6.0**.
- Node.js **22.22.2 or later** and npm for building/importing the extension.

## Install

1. [Download DigUp](https://github.com/ARahim3/DigUp/releases/latest), or install with Homebrew:

   ```sh
   brew install --cask arahim3/tap/digup
   ```

2. Open DigUp. Allow its initial model download (about 865 MB), choose your folders, and wait for indexing. Enable **Settings → Code** and select repositories if you want code search.

3. Clone this repository and install the extension:

   ```sh
   git clone https://github.com/toastyhead/digup-raycast.git
   cd digup-raycast
   npm ci
   npm run dev
   ```

   If your Node version is older and you use nvm, run `nvm install 22` and `nvm use 22` first.

4. Open Raycast and run **Check DigUp Setup**, then **Search Files** or **Search Code**. `npm run dev` imports the extension and watches for changes. Stop the watcher with Ctrl+C when finished. The built commands remain installed locally.

You can also select this source folder using Raycast's **Import Extension** command. The extension has not been published to the Raycast Store; `author` in `package.json` is local development metadata and must be changed to your actual Raycast Store handle before publishing.

## Use

Examples: `a dog on the beach`, `the clause about pets`, `where they discuss sleep`, or `code: retry with backoff`. The optional command argument can prefill a query. `code:` also works in Search Files.

| Action                                       | Shortcut            |
| -------------------------------------------- | ------------------- |
| Open file / open code in the selected editor | Return              |
| Reveal in Finder                             | Command + Return    |
| Quick Look                                   | Command + Y         |
| Copy file                                    | Command + C         |
| Copy path                                    | Command + Shift + C |

Open the action menu with Command + K for additional actions. Assign hotkeys through Raycast's extension settings if desired.

## Preferences

- **DigUp CLI Path:** usually leave blank. The extension checks `/Applications/DigUp.app/Contents/Helpers/digup`, `~/Applications/DigUp.app/Contents/Helpers/digup`, and common Homebrew executable paths. For a source build, choose its `.build/release/digup` binary.
- **Index Directory:** usually leave blank. Defaults to `~/Library/Application Support/DigUp/index.noindex`. A custom directory must already contain `index.sqlite` and/or `code.sqlite` created by DigUp.
- **Maximum Results:** 20, 50, or 100.
- **Open Code In:** default application, VS Code, Cursor, or Windsurf. Choose an installed editor to jump to the matching line. Notebook results open the file at its start.

## Behavior and limits

- All search requests run on this Mac. The extension passes an argument array directly to the installed executable; it does not run search text through a shell.
- Searches debounce for 300 ms and cancel the previous process when the query changes or the command closes. Stale results are hidden immediately. Each CLI invocation loads the query encoder, so this extension may be slower than DigUp's own warm search panel.
- DigUp owns the model, folder selection, permissions, indexing, and exclusions. This extension does not start indexing or download models. Missing indexes show setup guidance instead of creating empty databases. DigUp's CLI may perform its normal schema migrations on existing indexes.
- Ordinary Open File and Quick Look open at the beginning. The result shows the matching page or timestamp. **Open at … in QuickTime** explicitly seeks to a recording's match; macOS may ask for Automation permission when you use it. Automatic PDF page navigation is not implemented.
- The CLI is an upstream developer interface. Unexpected response shapes produce an error instead of silently dropping results.

## Development and validation

```sh
npm test
npm run typecheck
npm run lint
npm run build
DIGUP_TEST_CLI=/Applications/DigUp.app/Contents/Helpers/digup npm run test:integration
```

`npm run build` writes distributable JavaScript and assets to `dist/`. `npm run dev` writes development builds to Raycast's extensions directory.

Validation completed on 2026-10-11:

- Six automated tests covering argument boundaries, JSON validation, code routing, location formatting, missing indexes, subprocess errors, timeout, and cancellation.
- An integration test against the official DigUp 0.6.0 binary, using disposable SQLite indexes and real CLI searches. It checks file results, filters, code results, limits, and flag-like queries. No personal index is touched. The integration test is skipped unless `DIGUP_TEST_CLI` is set.
- TypeScript, ESLint, formatting, and the Raycast production build passed.
- A live semantic query against the installed model returned 20 screenshot matches. The native Raycast command displayed the results, an excerpt, and local folder metadata successfully. This verifies live search and result rendering; open, Quick Look, editor jumps, and QuickTime actions have not been exercised on screen.

## Credits

- **Original project: [ARahim3/DigUp](https://github.com/ARahim3/DigUp)**, created by [Abdur Rahim (@ARahim3)](https://github.com/ARahim3). DigUp provides the local indexing, model runtime, and semantic search that power this extension.
- **App icon:** reused from DigUp under its MIT license. The original copyright and license notice are preserved in [`assets/LICENSE-DigUp.txt`](assets/LICENSE-DigUp.txt).
- **Inspiration:** [the original DigUp announcement](https://www.reddit.com/r/LocalLLaMA/comments/1x2eeds/opensource_mac_app_that_runs_embeddinggemma_2/).

This is an independent Raycast integration, not an official DigUp release. All credit for DigUp's search engine and native Mac app belongs to the original project and its contributors.
