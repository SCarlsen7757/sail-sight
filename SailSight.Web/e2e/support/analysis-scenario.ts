import type { components } from "../../src/lib/api-types";
import type { APIRequestContext } from "@playwright/test";

const degreesPerMetre = 180 / (Math.PI * 6371000);
export const analysisPosition = (x: number, y: number) => ({ latitude: y * degreesPerMetre, longitude: x * degreesPerMetre });

/** Small synthetic VKX 1.4 recording: two gates crossed at race +20s and +40s. No personal data. */
export function analysisRecording(start = Date.now()) {
  const header = Buffer.alloc(8); header[0] = 255; header[1] = 5;
  const config = Buffer.alloc(14); config[0] = 8; config[13] = 1;
  const timer = (seconds: number, kind: number, value = 0) => {
    const b = Buffer.alloc(14); b[0] = 4; b.writeBigUInt64LE(BigInt(start + seconds * 1000), 1); b[9] = kind; b.writeInt32LE(value, 10); return b;
  };
  const rows = [header, config, timer(-10, 1, 10), timer(0, 3)];
  for (let seconds = -10; seconds <= 60; seconds++) {
    const b = Buffer.alloc(45); b[0] = 2; b.writeBigUInt64LE(BigInt(start + seconds * 1000), 1);
    b.writeInt32LE(0, 9); b.writeInt32LE(Math.round((seconds - 20) * degreesPerMetre * 1e7), 13);
    b.writeFloatLE(1, 17); b.writeFloatLE(Math.PI / 2, 21); b.writeFloatLE(1, 29); rows.push(b);
  }
  rows.push(timer(60, 4)); return Buffer.concat(rows);
}

export async function analysisScenario(api: APIRequestContext) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const json = async <T = { id: string }>(response: Awaited<ReturnType<APIRequestContext["get"]>>) => {
    if (!response.ok()) throw new Error(`${response.status()} ${await response.text()}`);
    return response.json() as Promise<T>;
  };
  const marks: string[] = [];
  for (const [x, y] of [[0, -10], [0, 10], [20, -10], [20, 10]]) {
    const mark = await json(await api.post('/api/v1/marks', { data: { name: `Analysis ${suffix} ${x} ${y}`, activeFrom: '2026-01-01', ...analysisPosition(x, y), defaultRoundingRadiusMeters: 20 } }));
    marks.push(mark.id);
  }
  const body = { name: `Analysis ${suffix}`, year: 2026, legs: [0, 2].map((i, index) => ({ markId: marks[i], gateMarkId: marks[i + 1], legType: 'Gate', passingSide: 'Port', legName: `Gate ${index + 1}` })) };
  const course = await json(await api.post('/api/v1/courses', { data: body }));
  const session = await json<components["schemas"]["SessionDetailDto"]>(await api.post('/api/v1/sessions', { multipart: { file: { name: 'synthetic-analysis.vkx', mimeType: 'application/octet-stream', buffer: analysisRecording() } } }));
  const raceId = session.races[0].id as string;
  const raceUrl = `/api/v1/races/${raceId}`;
  await json(await api.patch(raceUrl, { data: { courseId: course.id } }));
  return { raceId, raceUrl, sessionId: session.id as string, courseId: course.id as string, body, marks,
    legs: async () => json<components["schemas"]["RaceLegPerformanceDto"][]>(await api.get(`/api/v1/performance/legs?raceId=${raceId}`)),
    cleanup: async () => {
      await api.delete(`/api/v1/sessions/${session.id}`);
      await api.delete(`/api/v1/courses/${course.id}`);
      for (const id of marks) await api.delete(`/api/v1/marks/${id}`);
    } };
}
