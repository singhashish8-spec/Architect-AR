// `err instanceof Error` alone silently drops the real reason for any
// rejection value that isn't a genuine Error instance -- which, in
// practice, is a real risk here: the .rpc()/.insert() calls in
// projectService.ts are cast through an `as { error: Error | null }`
// (necessary since supabase-js's rpc() return type isn't inferred
// without a generated Database type -- see that file's comment), so
// there's no compile-time guarantee the runtime value actually is one,
// only that we're trusting the cast. Falling back to `.message` on
// anything object-shaped, not just real Error instances, means a
// genuine mismatch there still surfaces the real database/network
// message instead of a generic string that hides it.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  if (err !== null && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}
