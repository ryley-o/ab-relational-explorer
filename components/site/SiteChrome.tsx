import Link from "next/link";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-50 border-b border-ink-faint/10 bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink transition-colors hover:text-accent"
          >
            Art Blocks Explorer
          </Link>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">
            relational graph
          </span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
