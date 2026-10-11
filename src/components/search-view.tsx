import {
  Action,
  ActionPanel,
  Icon,
  List,
  open,
  showToast,
  Toast,
  Keyboard,
} from "@raycast/api";
import { useMemo, useState } from "react";
import { basename } from "node:path";
import { Filter, normalizeQuery, runCLI, SearchHit } from "../lib/digup";
import {
  clock,
  editorURL,
  resultPreview,
  location,
  mediaMoment,
} from "../lib/presentation";
import { getPreferences } from "../lib/preferences";
import { useSearch } from "../lib/use-search";
import { SetupActions } from "./setup-actions";
import Setup from "../setup";

const filters: { value: Filter; title: string }[] = [
  { value: "all", title: "All Files" },
  { value: "image", title: "Images" },
  { value: "screenshot", title: "Screenshots" },
  { value: "pdf", title: "PDFs" },
  { value: "doc", title: "Documents" },
  { value: "audio", title: "Audio" },
  { value: "video", title: "Videos" },
];

async function perform(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Could not open result",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function openMoment(hit: SearchHit, seconds: number) {
  // Values go through argv, never through shell or AppleScript source interpolation.
  await runCLI("/usr/bin/osascript", [
    "-e",
    `on run argv
    set mediaPath to item 1 of argv
    set mediaTime to (item 2 of argv) as real
    tell application "QuickTime Player"
      set mediaDocument to open POSIX file mediaPath
      set current time of mediaDocument to mediaTime
      activate
    end tell
  end run`,
    hit.path,
    String(seconds),
  ]);
}

function ResultActions({ hit, editor }: { hit: SearchHit; editor: string }) {
  const url = editorURL(hit, editor);
  const moment = mediaMoment(hit);
  return (
    <ActionPanel>
      <ActionPanel.Section>
        <Action
          title={url ? "Open in Editor at Line" : "Open File"}
          icon={Icon.Document}
          onAction={() => perform(() => open(url ?? hit.path))}
        />
        <Action.ShowInFinder
          path={hit.path}
          shortcut={{ modifiers: ["cmd"], key: "return" }}
        />
        <Action.ToggleQuickLook
          shortcut={Keyboard.Shortcut.Common.ToggleQuickLook}
        />
        {moment !== undefined && (
          <Action
            title={`Open at ${clock(moment)} in QuickTime`}
            icon={Icon.Play}
            onAction={() => perform(() => openMoment(hit, moment))}
          />
        )}
      </ActionPanel.Section>
      <ActionPanel.Section>
        <Action.CopyToClipboard
          title="Copy File"
          content={{ file: hit.path }}
          shortcut={{ modifiers: ["cmd"], key: "c" }}
        />
        <Action.CopyToClipboard
          title="Copy Path"
          content={hit.path}
          shortcut={Keyboard.Shortcut.Common.Copy}
        />
        {hit.excerpt && (
          <Action.CopyToClipboard title="Copy Excerpt" content={hit.excerpt} />
        )}
      </ActionPanel.Section>
      <ActionPanel.Section>
        <SetupActions />
      </ActionPanel.Section>
    </ActionPanel>
  );
}

export default function SearchView({
  code = false,
  initialQuery = "",
}: {
  code?: boolean;
  initialQuery?: string;
}) {
  const settings = useMemo(getPreferences, []);
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<Filter>("all");
  const [revision, setRevision] = useState(0);
  const effectiveCode = normalizeQuery(query, code).code;
  const { hits, loading, error } = useSearch(
    settings,
    query,
    code,
    filter,
    revision,
  );
  const hasQuery = Boolean(normalizeQuery(query, code).query);
  const title = error
    ? "DigUp Needs Attention"
    : loading
      ? "Searching Your Local Index…"
      : hasQuery
        ? "No Matches"
        : effectiveCode
          ? "Describe What the Code Does"
          : "Describe What You Remember";
  const description =
    error ??
    (hasQuery
      ? "Try different words or check that the folder is indexed in DigUp."
      : effectiveCode
        ? "For example: retry a failed request with backoff"
        : "Search photos, documents, recordings, and videos. Use code: to search code.");

  return (
    <List
      navigationTitle={
        effectiveCode ? "Search Code — DigUp" : "Search Files — DigUp"
      }
      searchBarPlaceholder={
        effectiveCode ? "What does the code do?" : "What are you looking for?"
      }
      searchText={query}
      onSearchTextChange={setQuery}
      filtering={false}
      isLoading={loading}
      isShowingDetail={hits.length > 0}
      searchBarAccessory={
        !effectiveCode ? (
          <List.Dropdown
            tooltip="File Type"
            value={filter}
            onChange={(value) => setFilter(value as Filter)}
          >
            {filters.map((item) => (
              <List.Dropdown.Item key={item.value} {...item} />
            ))}
          </List.Dropdown>
        ) : undefined
      }
    >
      <List.EmptyView
        icon={error ? Icon.ExclamationMark : Icon.MagnifyingGlass}
        title={title}
        description={description}
        actions={
          <ActionPanel>
            {error && (
              <Action
                title="Retry Search"
                icon={Icon.ArrowClockwise}
                onAction={() => setRevision((value) => value + 1)}
              />
            )}
            <Action.Push
              title="Check Setup"
              icon={Icon.CheckCircle}
              target={<Setup />}
            />
            <SetupActions />
          </ActionPanel>
        }
      />
      {hits.map((hit, index) => (
        <List.Item
          key={`${hit.path}:${hit.segment}:${hit.loc ?? ""}:${index}`}
          title={basename(hit.path)}
          icon={{ fileIcon: hit.path }}
          accessories={location(hit) ? [{ text: location(hit) }] : []}
          quickLook={{ path: hit.path, name: basename(hit.path) }}
          detail={<List.Item.Detail markdown={resultPreview(hit)} />}
          actions={
            <ResultActions
              hit={hit}
              editor={settings.codeEditor ?? "default"}
            />
          }
        />
      ))}
    </List>
  );
}
