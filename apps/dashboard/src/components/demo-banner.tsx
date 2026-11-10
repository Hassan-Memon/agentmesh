// Shown on every page when NEXT_PUBLIC_DEMO_MODE=1 so nobody mistakes the simulation for a
// real deployment.
export const REPO_URL = 'https://github.com/Hassan-Memon/agentmesh';

export function DemoBanner() {
  return (
    <div role="note" className="border-b border-warn/40 bg-warn/10 text-fg">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs sm:px-6">
        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-warn" aria-hidden />
        <p className="min-w-0 flex-1">
          <span className="sm:hidden">Live demo: backend simulated in your browser.</span>
          <span className="hidden sm:inline">Live demo: the backend is simulated in your browser. Run the real stack with docker compose</span>
        </p>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="shrink-0 font-medium text-accent underline underline-offset-2">
          <span className="sm:hidden">Source</span>
          <span className="hidden sm:inline">github.com/Hassan-Memon/agentmesh</span>
        </a>
      </div>
    </div>
  );
}
