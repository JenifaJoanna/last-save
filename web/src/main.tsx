import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Redirect, Route, Switch } from "wouter";
import { AppShell } from "./components/AppShell";
import { ToastProvider } from "./lib/toast";
import { WalletProvider } from "./lib/wallet";
import Landing from "./pages/Landing";
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
const PreviewIndex = lazy(() => import("./preview/PreviewIndex"));
const HostRun = lazy(() => import("./preview/HostRun"));
const PreviewDock = lazy(() => import("./preview/PreviewDock").then((m) => ({ default: m.PreviewDock })));

const Fallback = () => <div className="grid min-h-dvh place-items-center"><div className="skeleton h-8 w-40" /></div>;

function App() {
  return (
    <Suspense fallback={<Fallback />}>
      {PREVIEW && <PreviewDock />}
      <Switch>
        {PREVIEW && <Route path="/" component={PreviewIndex} />}
        {PREVIEW && <Route path="/home" component={Landing} />}
        {PREVIEW && <Route path="/host-run" component={HostRun} />}
        <Route path="/" component={Landing} />
        <Route path="/how"><How /></Route>
        <Route path="/signin" component={Signin} />
        <Route path="/judges"><Judges /></Route>
        <Route path="/status" component={Status} />
        <Route path="/app"><Redirect to="/app/library" replace /></Route>
        <Route path="/app/:rest*">
          <AppShell>
            <Suspense fallback={<div className="skeleton h-40 w-full" />}>
              <Switch>
                <Route path="/app/store" component={Store} />
                <Route path="/app/library" component={LibraryPage} />
                <Route path="/app/play" component={Play} />
                <Route path="/app/afterlife" component={Afterlife} />
                <Route path="/app/hosts" component={Hosts} />
                <Route path="/app/how"><How inApp /></Route>
                <Route path="/app/judges"><Judges inApp /></Route>
                <Route><Redirect to="/app/library" replace /></Route>
              </Switch>
            </Suspense>
          </AppShell>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
