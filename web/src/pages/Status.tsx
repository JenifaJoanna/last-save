// Public, read-only entry to the live dashboard (actions ask for a wallet).
import { SiteFooter, SiteNav } from "../components/SiteNav";
import { AfterlifeView } from "./app/Afterlife";

export default function Status() {
  return (
    <div className="min-h-dvh">
      <SiteNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="eyebrow mb-4">Live licence status · Ember Rift</p>
        <AfterlifeView />
      </main>
      <SiteFooter />
    </div>
  );
}
