import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted">That run or page does not exist.</p>
      <Link href="/runs" className="btn mt-5">
        Back to runs
      </Link>
    </div>
  );
}
