// Error thrown by the API helpers (real gateway or the in-browser demo backend) so pages can
// branch on the HTTP status, for example 404 -> notFound().
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
