// Public, read-only entry to the live dashboard (actions ask for a wallet).
import { ScreenTitle } from "../components/ui";
import { AfterlifeView } from "./app/Afterlife";

export default function Status() {
  return (
    <div className="mx-auto max-w-7xl">
      <ScreenTitle eyebrow="Live licence status · Ember Rift">Status</ScreenTitle>
      <AfterlifeView />
    </div>
  );
}
