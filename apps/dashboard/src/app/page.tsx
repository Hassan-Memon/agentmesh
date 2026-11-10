import { DemoHome } from '@/components/demo-pages';
import { HomeView } from '@/components/home-view';
import { api, DEMO_MODE, tryFetch } from '@/lib/api';

// Server component: fetched on every request (no caching of live data).
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  if (DEMO_MODE) return <DemoHome />;
  const [agents, runs] = await Promise.all([tryFetch(() => api.agents()), tryFetch(() => api.runs(8))]);
  return <HomeView agents={agents.data} runs={runs.data} error={Boolean(agents.error || runs.error)} />;
}
