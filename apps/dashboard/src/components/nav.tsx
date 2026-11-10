import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';

const links = [
  { href: '/agents', label: 'Agents' },
  { href: '/runs', label: 'Runs' },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            AgentMesh
          </Link>
          <nav className="flex items-center gap-3 text-sm text-muted sm:gap-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-fg">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/runs/new" className="btn btn-primary whitespace-nowrap">
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New run</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
