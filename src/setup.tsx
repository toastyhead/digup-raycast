import { Action, ActionPanel, Detail, Icon, Keyboard } from "@raycast/api";
import { useEffect, useState } from "react";
import { requireIndex, resolveConnection, runCLI } from "./lib/digup";
import { literalMarkdown } from "./lib/presentation";
import { getPreferences } from "./lib/preferences";
import { SetupActions } from "./components/setup-actions";

const guide = `## Get started
1. Install [DigUp](https://github.com/ARahim3/DigUp/releases/latest) in Applications.
2. Open DigUp, let it download its model, and choose the folders you want to search.
3. Wait for indexing, then run **Search Files** in Raycast.
4. For **Search Code**, enable code search and select repositories in DigUp Settings → Code.

DigUp manages the model, folder permissions, and indexing. This extension searches its existing local index. No account or API key is needed.

Use extension preferences for a custom CLI or index folder. Quick Look and ordinary Open File start at the beginning; matching pages and timestamps appear beside each result. For recordings, use **Open at … in QuickTime** (macOS may ask for Automation permission). Select a supported editor in preferences to open code at the matched line.`;

export default function Setup() {
  const [markdown, setMarkdown] = useState(guide);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    async function check() {
      try {
        const connection = await resolveConnection(getPreferences());
        const sections = [
          "# DigUp Setup",
          "Helper found",
          literalMarkdown(connection.executable),
        ];
        for (const code of [false, true]) {
          sections.push(code ? "## Code index" : "## File index");
          try {
            await requireIndex(connection, code);
            const status = await runCLI(
              connection.executable,
              [
                "status",
                "--index",
                connection.indexDirectory,
                ...(code ? ["--code"] : []),
              ],
              controller.signal,
            );
            sections.push(literalMarkdown(status.trim()));
          } catch (error) {
            if (controller.signal.aborted) return;
            sections.push(
              literalMarkdown(
                error instanceof Error ? error.message : String(error),
              ),
            );
          }
        }
        if (!controller.signal.aborted)
          setMarkdown(sections.join("\n\n") + "\n\n" + guide);
      } catch (error) {
        if (!controller.signal.aborted)
          setMarkdown(
            "# DigUp Setup\n\n" +
              literalMarkdown(
                error instanceof Error ? error.message : String(error),
              ) +
              "\n\n" +
              guide,
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void check();
    return () => controller.abort();
  }, [revision]);

  return (
    <Detail
      navigationTitle="Check DigUp Setup"
      markdown={markdown}
      isLoading={loading}
      actions={
        <ActionPanel>
          <SetupActions />
          <Action
            title="Refresh Status"
            icon={Icon.ArrowClockwise}
            onAction={() => setRevision((value) => value + 1)}
            shortcut={Keyboard.Shortcut.Common.Refresh}
          />
          <Action.CopyToClipboard
            title="Copy Homebrew Install Command"
            content="brew install --cask arahim3/tap/digup"
          />
        </ActionPanel>
      }
    />
  );
}
