import { LaunchProps } from "@raycast/api";
import SearchView from "./components/search-view";

export default function Command(
  props: LaunchProps<{ arguments: { query?: string } }>,
) {
  return <SearchView code initialQuery={props.arguments.query} />;
}
