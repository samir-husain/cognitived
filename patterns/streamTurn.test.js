import { test } from "node:test";
import assert from "node:assert/strict";
import { createTurnController } from "./streamTurn.js";

// A fake transport the tests drive by hand: no timers, no sleeps.
function fakeTransport() {
  const t = { onChunk: null, onDone: null, onError: null, cancelled: 0 };
  t.start = (onChunk, onDone, onError) => {
    t.onChunk = onChunk; t.onDone = onDone; t.onError = onError;
    return () => { t.cancelled++; };
  };
  return t;
}

// Manual timer so the first-byte deadline can be fired deliberately.
function fakeTimers() {
  const pending = new Map(); let id = 0;
  return {
    setTimer: (fn) => { pending.set(++id, fn); return id; },
    clearTimer: (h) => pending.delete(h),
    fire: () => { for (const [h, fn] of [...pending]) { pending.delete(h); fn(); } },
    count: () => pending.size,
  };
}

test("chunks render while the turn is active and the turn ends as done", () => {
  const tr = fakeTransport(); const tm = fakeTimers();
  const c = createTurnController({ start: tr.start, setTimer: tm.setTimer, clearTimer: tm.clearTimer });
  const out = []; let end = null;
  c.ask("q", { onChunk: (x) => out.push(x), onEnd: (o) => (end = o) });
  tr.onChunk("Hel"); tr.onChunk("lo"); tr.onDone();
  assert.deepEqual(out, ["Hel", "lo"]);
  assert.deepEqual(end, { status: "done", chunks: 2 });
  assert.equal(c.isActive(), false);
  assert.equal(tm.count(), 0, "first-byte timer cleared after the first chunk");
});

test("cancel stops the transport and late chunks are ignored", () => {
  const tr = fakeTransport(); const tm = fakeTimers();
  const c = createTurnController({ start: tr.start, setTimer: tm.setTimer, clearTimer: tm.clearTimer });
  const out = []; let end = null;
  c.ask("q", { onChunk: (x) => out.push(x), onEnd: (o) => (end = o) });
  tr.onChunk("partial");
  assert.equal(c.cancel(), true);
  tr.onChunk("late chunk after cancel");
  tr.onDone();
  assert.deepEqual(out, ["partial"]);
  assert.equal(tr.cancelled, 1);
  assert.deepEqual(end, { status: "cancelled", chunks: 1 });
});

test("no first byte before the deadline becomes a timeout, not a frozen screen", () => {
  const tr = fakeTransport(); const tm = fakeTimers();
  const c = createTurnController({ start: tr.start, setTimer: tm.setTimer, clearTimer: tm.clearTimer });
  let end = null;
  c.ask("q", { onChunk: () => {}, onEnd: (o) => (end = o) });
  tm.fire();
  assert.deepEqual(end, { status: "timeout", chunks: 0 });
  assert.equal(tr.cancelled, 1);
});

test("a second ask while a turn is running is refused until cancel", () => {
  const tr = fakeTransport(); const tm = fakeTimers();
  const c = createTurnController({ start: tr.start, setTimer: tm.setTimer, clearTimer: tm.clearTimer });
  c.ask("one", { onChunk: () => {}, onEnd: () => {} });
  assert.throws(() => c.ask("two", { onChunk: () => {}, onEnd: () => {} }));
  c.cancel();
  assert.doesNotThrow(() => c.ask("two", { onChunk: () => {}, onEnd: () => {} }));
});
