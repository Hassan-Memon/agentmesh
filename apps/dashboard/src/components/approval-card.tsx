'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  runId: string;
  interrupt: Record<string, unknown>;
  onDecided?: () => void;
}

export function ApprovalCard({ runId, interrupt, onDecided }: Props) {
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (approved: boolean) => {
    setBusy(approved ? 'approve' : 'reject');
    setError(null);
    try {
      await api.approve(runId, { approved, feedback: feedback || undefined });
      onDecided?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const review = interrupt.review as Record<string, unknown> | undefined;
  const notes = Array.isArray(review?.notes) ? (review?.notes as unknown[]) : [];

  return (
    <section className="card border-warn/60 p-5" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-warn pulse" aria-hidden />
        <h2 className="text-base font-semibold">Human approval required</h2>
      </div>
      <p className="mt-2 text-sm text-muted">{String(interrupt.question ?? 'The agent is waiting for your decision.')}</p>

      {review ? (
        <div className="mt-4 rounded-lg bg-surface-2 p-3 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Verdict: <strong>{String(review.verdict ?? 'n/a')}</strong>
            </span>
            {review.score !== undefined ? (
              <span>
                Score: <strong>{String(review.score)}/10</strong>
              </span>
            ) : null}
          </div>
          {notes.length > 0 ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted">
              {notes.map((n, i) => (
                <li key={i}>{String(n)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {typeof interrupt.submission_preview === 'string' ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">Submission preview</summary>
          <p className="mt-2 whitespace-pre-wrap rounded-md bg-surface-2 p-3">{interrupt.submission_preview}</p>
        </details>
      ) : null}

      <label className="mt-4 block text-sm">
        <span className="text-muted">Feedback (optional)</span>
        <textarea
          className="input mt-1 min-h-20"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Why you approved or what should change"
        />
      </label>

      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      <div className="mt-4 flex gap-2">
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => decide(true)}>
          {busy === 'approve' ? 'Approving...' : 'Approve'}
        </button>
        <button type="button" className="btn btn-danger" disabled={busy !== null} onClick={() => decide(false)}>
          {busy === 'reject' ? 'Rejecting...' : 'Reject'}
        </button>
      </div>
    </section>
  );
}
