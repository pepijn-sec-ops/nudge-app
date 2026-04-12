/** userId -> { focusing: boolean, lastBeat: number } */
const beats = new Map();
const TTL_MS = 45000;

export function setPresence(userId, focusing) {
  beats.set(userId, { focusing: !!focusing, lastBeat: Date.now() });
}

export function getGlobalFocusingCount() {
  const now = Date.now();
  let n = 0;
  for (const [, v] of beats) {
    if (now - v.lastBeat > TTL_MS) continue;
    if (v.focusing) n += 1;
  }
  return n;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of beats) {
    if (now - v.lastBeat > TTL_MS * 2) beats.delete(k);
  }
}, 60000).unref?.();
