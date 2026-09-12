export interface DragDismissOptions {
  threshold?: number;
  flingVelocity?: number;
  minFlingDistance?: number;
}

export function shouldDismissSheet(dy: number, dtMs: number, options?: DragDismissOptions): boolean {
  const threshold = options?.threshold ?? 110;
  const flingVelocity = options?.flingVelocity ?? 0.55;
  const minFling = options?.minFlingDistance ?? 24;
  if (dy <= 0) return false;
  if (dy > threshold) return true;
  const velocity = dy / Math.max(1, dtMs);
  return dy > minFling && velocity > flingVelocity;
}
