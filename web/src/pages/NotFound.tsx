import { SiteNav } from "../components/SiteNav";
import { LinkButton } from "../components/ui";

export default function NotFound() {
  return (
    <div className="min-h-dvh">
      <SiteNav />
      <main className="grid min-h-[calc(100dvh-64px)] place-items-center px-4 text-center">
        <div>
          <p className="num text-7xl font-bold text-ember">404</p>
          <h1 className="mt-4 text-2xl font-semibold">This save slot is empty</h1>
          <p className="mt-2 text-muted">The page you asked for does not exist.</p>
          <div className="mt-8 flex justify-center gap-3"><LinkButton href="/">Home</LinkButton><LinkButton href="/status" variant="ghost">Live status</LinkButton></div>
        </div>
      </main>
    </div>
  );
}
