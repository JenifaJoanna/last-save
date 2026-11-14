// Unknown route: an empty save slot.
import { LinkButton } from "../components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-full place-items-center text-center">
      <div data-print>
        <p className="num text-[clamp(64px,12vw,120px)] leading-none text-dead">404</p>
        <h1 className="display mt-4 text-2xl">Empty save slot</h1>
        <p className="mt-3 text-muted">&gt; no screen at this address<span className="caret" /></p>
        <div className="mt-8 flex justify-center gap-3"><LinkButton href="/">Summary</LinkButton><LinkButton href="/status" variant="ghost">Live status</LinkButton></div>
      </div>
    </div>
  );
}
