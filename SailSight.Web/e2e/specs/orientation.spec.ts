import { expect, test } from "@playwright/test";
import { directionPoints, formatDirection, quaternionToOrientation, shortestAngleDelta } from "../../src/lib/orientation";
import { sgSmoothAngularRad, sgSmoothQuaternions } from "../../src/lib/downsampling";

test("true NED heading follows bow orientation at each cardinal point", () => {
  for (const heading of [0, 90, 180, 270, 359]) {
    const half = heading * Math.PI / 360;
    const q = { w: Math.cos(half), x: 0, y: 0, z: Math.sin(half) };
    expect(quaternionToOrientation(q)?.heading).toBeCloseTo(heading);
    expect(quaternionToOrientation({ w: -q.w * 2, x: 0, y: 0, z: -q.z * 2 })?.heading).toBeCloseTo(heading);
  }
});

test("attitude retains values beyond the instrument scales", () => {
  const heel = quaternionToOrientation({ w: Math.cos(Math.PI / 6), x: Math.sin(Math.PI / 6), y: 0, z: 0 });
  const trim = quaternionToOrientation({ w: Math.cos(Math.PI / 18), x: 0, y: -Math.sin(Math.PI / 18), z: 0 });
  expect(heel?.heel).toBeCloseTo(60);
  expect(trim?.trim).toBeCloseTo(-20);
  expect(quaternionToOrientation({ w: 0, x: 0, y: 0, z: 0 })).toBeNull();
  expect(quaternionToOrientation({ w: NaN, x: 0, y: 0, z: 0 })).toBeNull();
});

test("smoothing preserves invalid orientation and COG gaps", () => {
  const north = { w: 1, x: 0, y: 0, z: 0 };
  const east = { w: Math.SQRT1_2, x: 0, y: 0, z: Math.SQRT1_2 };
  const result = sgSmoothQuaternions([...Array(8).fill(north), { w: 0, x: 0, y: 0, z: 0 }, ...Array(8).fill(east)], 5);
  expect(quaternionToOrientation(result[7])?.heading).toBeCloseTo(0);
  expect(quaternionToOrientation(result[8])).toBeNull();
  expect(quaternionToOrientation(result[9])?.heading).toBeCloseTo(90);
  const cog = sgSmoothAngularRad([...Array(8).fill(0), NaN, ...Array(8).fill(Math.PI / 2)], 5);
  expect(cog[8]).toBeNaN();
  expect(cog[7]).toBeCloseTo(0);
  expect(cog[9]).toBeCloseTo(Math.PI / 2);
});

test("north crossings use short rotation and chart gaps in either direction", () => {
  expect(shortestAngleDelta(359, 1)).toBe(2);
  expect(shortestAngleDelta(1, 359)).toBe(-2);
  expect(formatDirection(359.9)).toBe("0°");
  expect(formatDirection(NaN)).toBe("—");
  for (const values of [[359, 1], [1, 359]]) {
    expect(directionPoints(values.map((v, t) => ({ t, v })))).toEqual([
      { t: 0, v: values[0] }, { t: 0.5, v: null }, { t: 1, v: values[1] },
    ]);
  }
  expect(directionPoints([{ t: 0, v: 90 }, { t: 1, v: NaN }, { t: 2, v: 100 }])[1].v).toBeNull();
});
