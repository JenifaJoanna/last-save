import { lazy, StrictMode, Suspense, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { Terminal } from "./components/terminal/Terminal";
import { ToastProvider } from "./lib/toast";
import { useWallet, WalletProvider } from "./lib/wallet";
import Home from "./pages/Landing";
import "./styles.css";
import { PREVIEW } from "./preview/store";
import { PreviewWalletProvider } from "./preview/PreviewWallet";

const Signin = lazy(() => import("./pages/Signin"));
const How = lazy(() => import("./pages/How"));
const Judges = lazy(() => import("./pages/Judges"));
const Status = lazy(() => import("./pages/Status"));
const Store = lazy(() => import("./pages/app/Store"));
const LibraryPage = lazy(() => import("./pages/app/Library"));
const Play = lazy(() => import("./pages/app/Play"));
const Afterlife = lazy(() => import("./pages/app/Afterlife"));
const Hosts = lazy(() => import("./pages/app/Hosts"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Attack = lazy(() => import("./pages/Attack"));
const Own = lazy(() => import("./pages/Own"));
const Launch = lazy(() => import("./pages/Launch"));
const PreviewIndex = lazy(() => import("./preview/PreviewIndex"));
const HostRun = lazy(() => import("./preview/HostRun"));

const Fallback = () => <div className="grid gap-3"><div className="skeleton h-10 w-56" /><div className="skeleton h-40 w-full" /></div>;

/** App screens need a signed-in account; otherwise the terminal opens the sign-in screen. */
function RequireAccount({ children }: { children: ReactNode }) {
  const { ready, accountId } = useWallet();
  const [loc, navigate] = useLocation();
  useEffect(() => { if (ready && !accountId) navigate(`/signin?next=${encodeURIComponent(loc)}`, { replace: true }); }, [ready, accountId, loc, navigate]);
  return ready && accountId ? <>{children}</> : <Fallback />;
}

function App() {
  return (
    <Terminal>
      <Suspense fallback={<Fallback />}>
        <Switch>
          <Route path="/" component={Home} />
          {PREVIEW && <Route path="/preview" component={PreviewIndex} />}
          {PREVIEW && <Route path="/host-run" component={HostRun} />}
          <Route path="/how"><How /></Route>
          <Route path="/signin" component={Signin} />
          <Route path="/judges"><Judges /></Route>
          <Route path="/attack" component={Attack} />
          <Route path="/own" component={Own} />
          <Route path="/launch" component={Launch} />
          <Route path="/status" component={Status} />
          <Route path="/app"><Redirect to="/app/library" replace /></Route>
          <Route path="/app/how"><Redirect to="/how" replace /></Route>
          <Route path="/app/judges"><Redirect to="/judges" replace /></Route>
          <Route path="/app/:rest*">
            <RequireAccount>
              <Switch>
                <Route path="/app/store" component={Store} />
                <Route path="/app/library" component={LibraryPage} />
                <Route path="/app/play" component={Play} />
                <Route path="/app/afterlife" component={Afterlife} />
                <Route path="/app/hosts" component={Hosts} />
                <Route><Redirect to="/app/library" replace /></Route>
              </Switch>
            </RequireAccount>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Terminal>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ToastProvider>
        {PREVIEW ? <PreviewWalletProvider><App /></PreviewWalletProvider> : <WalletProvider><App /></WalletProvider>}
      </ToastProvider>
    </StrictMode>,
  );
}
