'use client';

// The status badge in the run header. The header is rendered from a snapshot (often taken while
// the run is still QUEUED), so follow the run's events to keep the badge current.
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getRunsSocket } from '@/lib/socket';
import type { RunEvent, RunStatus } from '@/lib/types';
import { StatusBadge } from './status-badge';

function statusAfter(ev: RunEvent): RunStatus | null {
  switch (ev.type) {
    case 'RUN_STARTED':
    case 'RESUMED':
      return 'RUNNING';
    case 'INTERRUPT':
      return 'WAITING_APPROVAL';
    case 'DONE':
      return ev.payload.status === 'REJECTED' ? 'REJECTED' : 'COMPLETED';
    case 'FAILED':
      return 'FAILED';
    default:
      return null;
  }
}

export function LiveStatusBadge({ runId, initial }: { runId: string; initial: RunStatus }) {
  const [status, setStatus] = useState<RunStatus>(initial);

  useEffect(() => {
    let alive = true;
    // Events that happened between the snapshot and this effect are not replayed: catch up once.
    api.run(runId).then(
      (run) => alive && setStatus(run.status),
      () => undefined,
    );
    const socket = getRunsSocket();
    const onEvent = (ev: RunEvent) => {
      if (ev.runId !== runId) return;
      const next = statusAfter(ev);
      if (next) setStatus(next);
    };
    socket.on('run.event', onEvent);
    return () => {
      alive = false;
      socket.off('run.event', onEvent);
    };
  }, [runId]);

  return <StatusBadge status={status} />;
}
