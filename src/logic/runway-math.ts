export interface SpringStepResult {
  cur: number;
  vel: number;
  settled: boolean;
}

export interface PoseResult {
  x: number;
  bottom: number;
  scale: number;
  opacity: number;
  blur: number;
  z: number;
  sl: number;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function wrapMod(value: number, n: number): number {
  if (n <= 0) return 0;
  return ((value % n) + n) % n;
}

export function wrapSignedAngle(phi: number): number {
  const twoPi = Math.PI * 2;
  let wrapped = ((phi % twoPi) + twoPi) % twoPi;
  if (wrapped > Math.PI) wrapped -= twoPi;
  return wrapped;
}

export function computeBodyCount(lookCount: number): number {
  const n = Math.max(1, lookCount);
  return n * Math.ceil(8 / n);
}

export function shortestLoopDelta(fromIndex: number, toIndex: number, count: number): number {
  if (count <= 0) return 0;
  let d = wrapMod(toIndex - fromIndex, count);
  if (d > count / 2) d -= count;
  return d;
}

export function computeFrameHeight(opts: {
  isMobile: boolean;
  innerHeight: number;
  headerHeight: number;
  mobileHeightVh: number;
}): number {
  if (opts.isMobile) {
    return Math.round(opts.innerHeight * (clamp(opts.mobileHeightVh, 50, 120) / 100));
  }
  return Math.max(380, Math.round(opts.innerHeight - opts.headerHeight));
}

export function computeModelHeight(stageHeight: number, mode: 'ring' | 'classic', isMobile: boolean): number {
  if (mode === 'ring') {
    return Math.max(200, Math.round((stageHeight - 34 - 18) / 1.08));
  }
  const pad = isMobile ? 24 : 36;
  return Math.max(200, Math.round(stageHeight - pad - 18));
}

export function stepSpring(
  cur: number,
  vel: number,
  target: number,
  dt: number,
  K = 95,
  C = 2 * Math.sqrt(95),
  tolerance = 0.0005
): SpringStepResult {
  let nextCur = cur;
  let nextVel = vel;
  const subSteps = 3;
  const h = dt / subSteps;

  for (let s = 0; s < subSteps; s++) {
    const acc = -K * (nextCur - target) - C * nextVel;
    nextVel += acc * h;
    nextCur += nextVel * h;
  }

  const settled =
    Math.abs(nextCur - target) <= tolerance && Math.abs(nextVel) <= tolerance;
  if (settled) {
    return { cur: target, vel: 0, settled: true };
  }
  return { cur: nextCur, vel: nextVel, settled: false };
}

export function computeRingSlotPose(params: {
  bodyIndex: number;
  bodyCount: number;
  cur: number;
  W: number;
  H: number;
  fs: number;
  isMobile: boolean;
  isStill: boolean;
  blurEnabled: boolean;
}): PoseResult {
  const { bodyIndex, bodyCount, cur, W, H, fs, isMobile, isStill, blurEnabled } = params;
  const cx = 0.5 * W;
  const R = (isMobile ? 0.72 : 0.62) * W;
  const P = (isMobile ? 1.9 : 1.65) * W;
  const floor = H - 34;
  const horizon = 0.36 * H;
  const step = (Math.PI * 2) / Math.max(1, bodyCount);

  const phi = wrapSignedAngle((bodyIndex - cur) * step);
  const zDepth = R * (1 - Math.cos(phi));
  const persp = P / (P + zDepth);
  const sl = Math.abs(phi) / step;
  const scale = persp * (1 + (fs - 1) * clamp(1 - sl, 0, 1));
  const x = cx + R * Math.sin(phi) * persp;
  const feet = horizon + (floor - horizon) * persp;
  const bottom = H - feet;
  const blur = blurEnabled
    ? sl <= 1
      ? 1.8 * sl
      : Math.min(1.8 + (sl - 1) * 2, 6.5)
    : 0;
  let opacity = clamp((Math.cos(phi) + 0.55) / 0.3, 0, 1);
  if (isStill && sl < 0.02) {
    opacity = 0;
  }
  const z = Math.round(scale * 1000);

  return { x, bottom, scale, opacity, blur, z, sl };
}

export function computeClassicSlotPose(params: {
  k: number;
  exitE: number;
  W: number;
  isMobile: boolean;
  isStill: boolean;
  blurEnabled: boolean;
}): PoseResult {
  const { k, exitE, W, isMobile, isStill, blurEnabled } = params;
  const ax = isMobile ? 0.3 : 0.4;
  const ay = isMobile ? 22 : 36;
  const sx = isMobile ? 0.32 : 0.125;
  const sy = isMobile ? 22 : 58;
  const sr = 0.76;
  const ex = isMobile ? 0.55 : 0.38;
  const d = isMobile ? 4 : 5;

  if (exitE >= 0) {
    const x = W * (ax - ex * exitE);
    const bottom = ay - 22 * exitE;
    const scale = 1 + 0.14 * exitE;
    const opacity = Math.max(0, 1 - 1.05 * exitE);
    const blur = blurEnabled ? 4 * Math.min(exitE, 1) : 0;
    return { x, bottom, scale, opacity, blur, z: 1100, sl: exitE };
  }

  const x = W * (ax + sx * k);
  const bottom = ay + sy * k;
  const scale = Math.pow(sr, k);
  let opacity = k <= d - 1 ? 1 - 0.13 * k : Math.max(0, 0.61 * (d - k));
  if (isStill && Math.abs(k) < 0.02) {
    opacity = 0;
  }
  const blur = blurEnabled ? Math.min(0.9 * k, 3.2) : 0;
  const z = 1000 - Math.round(10 * k);

  return { x, bottom, scale, opacity, blur, z, sl: Math.abs(k) };
}

export function computeFeetOffset(lastOpaqueRow: number, height: number): number {
  if (height <= 0 || lastOpaqueRow < 0) return 0;
  return clamp((height - 1 - lastOpaqueRow) / height, 0, 0.4);
}
