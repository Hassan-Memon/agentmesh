export function Notice({ title, children, tone = 'warn' }: { title: string; children?: React.ReactNode; tone?: 'warn' | 'danger' | 'info' }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'info' ? 'text-info' : 'text-warn';
  return (
    <div className="card p-4">
      <p className={`text-sm font-semibold ${color}`}>{title}</p>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
    </div>
  );
}
