import {
  Action,
  Icon,
  open,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { getPreferences } from "../lib/preferences";
import { resolveConnection } from "../lib/digup";

export async function openDigUp() {
  let target = "/Applications/DigUp.app";
  try {
    const { executable } = await resolveConnection(getPreferences());
    const suffix = "/Contents/Helpers/digup";
    if (executable.endsWith(suffix))
      target = executable.slice(0, -suffix.length);
  } catch {
    // A fresh installation may exist before its CLI can be resolved.
  }
  try {
    await open(target);
  } catch {
    await showToast({
      style: Toast.Style.Failure,
      title: "Install DigUp first",
      message: "Use Download DigUp in the action menu.",
    });
  }
}

export function SetupActions() {
  return (
    <>
      <Action title="Open DigUp" icon={Icon.AppWindow} onAction={openDigUp} />
      <Action.OpenInBrowser
        title="Download DigUp"
        url="https://github.com/ARahim3/DigUp/releases/latest"
      />
      <Action
        title="Extension Preferences"
        icon={Icon.Gear}
        onAction={openExtensionPreferences}
      />
    </>
  );
}
