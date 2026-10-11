import { getPreferenceValues } from "@raycast/api";
import { Settings } from "./digup";

export function getPreferences(): Settings {
  return getPreferenceValues<Settings>();
}
