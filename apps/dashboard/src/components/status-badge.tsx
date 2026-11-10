import type { RunStatus } from '@/lib/types';

const styles: Record<RunStatus, { dot: string; label: string }> = {
  QUEUED: { dot: 'bg-muted', label: 'Queued' },
  RUNNING: { dot: 'bg-info pulse', label: 'Running' },
  WAITING_APPROVAL: { dot: 'bg-warn pulse', label: 'Needs approval' },
  COMPLETED: { dot: 'bg-ok', label: 'Completed' },
  FAILED: { dot: 'bg-danger', label: 'Failed' },
  REJECTED: { dot: 'bg-danger', label: 'Rejected' },
};

export function StatusBadge({ status }: { status: RunStatus }) {
  const s = styles[status] ?? styles.QUEUED;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}
