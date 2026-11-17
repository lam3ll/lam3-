import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBodyCount,
  computeClassicSlotPose,
  computeFeetOffset,
  computeFrameHeight,
  computeModelHeight,
  computeRingSlotPose,
  shortestLoopDelta,
  stepSpring,
  wrapMod,
} from './runway-math';

test('computeBodyCount yields 12 for 6 looks and >=8 for dynamic look counts', () => {
  assert.equal(computeBodyCount(6), 12);
  assert.equal(computeBodyCount(7), 14);
  assert.equal(computeBodyCount(8), 8);
  assert.equal(computeBodyCount(3), 9);
});

test('shortestLoopDelta picks shortest circular direction', () => {
  assert.equal(shortestLoopDelta(0, 5, 6), -1);
  assert.equal(shortestLoopDelta(5, 0, 6), 1);
  assert.equal(shortestLoopDelta(1, 3, 6), 2);
});

test('computeFrameHeight and computeModelHeight match exact specification', () => {
  assert.equal(
    computeFrameHeight({ isMobile: false, innerHeight: 900, headerHeight: 88, mobileHeightVh: 109 }),
    812
  );
  assert.equal(
    computeFrameHeight({ isMobile: false, innerHeight: 400, headerHeight: 88, mobileHeightVh: 109 }),
    380
  );
  assert.equal(
    computeFrameHeight({ isMobile: true, innerHeight: 800, headerHeight: 68, mobileHeightVh: 109 }),
    872
  );
  assert.equal(computeModelHeight(656, 'ring', false), Math.round((656 - 34 - 18) / 1.08));
  assert.equal(computeModelHeight(400, 'classic', true), 400 - 24 - 18);
});

test('computeRingSlotPose matches front and ±1 slot geometry', () => {
  const W = 1060;
  const H = 660;
  const front = computeRingSlotPose({
    bodyIndex: 0,
    bodyCount: 12,
    cur: 0,
    W,
    H,
    fs: 1.08,
    isMobile: false,
    isStill: false,
    blurEnabled: true,
  });
  assert.ok(Math.abs(front.x - 0.5 * W) < 0.01);
  assert.ok(Math.abs(front.scale - 1.08) < 0.001);
  assert.equal(front.z, 1080);
  assert.equal(front.blur, 0);
  assert.equal(front.opacity, 1);

  const frontStill = computeRingSlotPose({
    bodyIndex: 0,
    bodyCount: 12,
    cur: 0,
    W,
    H,
    fs: 1.08,
    isMobile: false,
    isStill: true,
    blurEnabled: true,
  });
  assert.equal(frontStill.opacity, 0);

  const slot1 = computeRingSlotPose({
    bodyIndex: 1,
    bodyCount: 12,
    cur: 0,
    W,
    H,
    fs: 1.08,
    isMobile: false,
    isStill: true,
    blurEnabled: true,
  });
  assert.ok(Math.abs(slot1.scale - 0.952) < 0.01);
  assert.ok(Math.abs(slot1.x / W - 0.795) < 0.01);
  assert.ok(Math.abs(slot1.blur - 1.8) < 0.05);
  assert.equal(slot1.z, 952);
});

test('computeClassicSlotPose positions k=0 and k=1 slots on phone', () => {
  const k0 = computeClassicSlotPose({
    k: 0,
    exitE: -1,
    W: 390,
    isMobile: true,
    isStill: false,
    blurEnabled: true,
  });
  assert.equal(k0.x, 390 * 0.3);
  assert.equal(k0.scale, 1);
  assert.equal(k0.bottom, 22);

  const k1 = computeClassicSlotPose({
    k: 1,
    exitE: -1,
    W: 390,
    isMobile: true,
    isStill: true,
    blurEnabled: true,
  });
  assert.ok(Math.abs(k1.x - 390 * 0.62) < 0.01);
  assert.equal(k1.bottom, 44);
  assert.equal(k1.scale, 0.76);
  assert.ok(Math.abs(k1.opacity - 0.87) < 0.001);
});

test('stepSpring converges critically to target', () => {
  let cur = -1.15;
  let vel = 0;
  let settled = false;
  for (let i = 0; i < 200; i++) {
    const res = stepSpring(cur, vel, 0, 1 / 60);
    cur = res.cur;
    vel = res.vel;
    if (res.settled) {
      settled = true;
      break;
    }
  }
  assert.equal(settled, true);
  assert.equal(cur, 0);
  assert.equal(vel, 0);
});

test('computeFeetOffset clamps bottom transparency fraction', () => {
  assert.equal(computeFeetOffset(99, 100), 0);
  assert.ok(Math.abs(computeFeetOffset(89, 100) - 0.1) < 0.001);
  assert.equal(computeFeetOffset(10, 100), 0.4);
  assert.equal(wrapMod(-1, 6), 5);
});
