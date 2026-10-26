import { test } from "node:test";
import assert from "node:assert/strict";
import { createCrossTabLock } from "./crossTabLock.js";

function memoryStore() {
  const m = new Map();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) };
}

test("the first tab acquires, the second is refused while the lease is live", () => {
  const store = memoryStore();
  let t = 1000;
  const now = () => t;
  const a = createCrossTabLock({ store, owner: "A", now });
  const b = createCrossTabLock({ store, owner: "B", now });

  assert.equal(a.acquire(), true);
  assert.equal(b.acquire(), false);
  assert.equal(b.holder(), "A");
});

test("an expired lease can be taken over, and the old owner's heartbeat then fails", () => {
  const store = memoryStore();
  let t = 1000;
  const now = () => t;
  const a = createCrossTabLock({ store, owner: "A", now, ttlMs: 500 });
  const b = createCrossTabLock({ store, owner: "B", now, ttlMs: 500 });

  a.acquire();
  t += 600; // A's tab froze or died
  assert.equal(b.acquire(), true);
  assert.equal(a.heartbeat(), false, "A must notice it no longer owns the lock");
  assert.equal(b.holder(), "B");
});

test("heartbeat extends the lease; release only removes the owner's own lease", () => {
  const store = memoryStore();
  let t = 0;
  const now = () => t;
  const a = createCrossTabLock({ store, owner: "A", now, ttlMs: 100 });
  const b = createCrossTabLock({ store, owner: "B", now, ttlMs: 100 });

  a.acquire();
  t = 90;
  assert.equal(a.heartbeat(), true);
  t = 150;
  assert.equal(a.holder(), "A", "lease was extended at t=90 to t=190");
  b.release(); // B never owned it
  assert.equal(a.holder(), "A");
  a.release();
  assert.equal(a.holder(), null);
});

test("a corrupt lease never blocks checkout", () => {
  const store = memoryStore();
  store.set("checkout_lock", "{not json");
  const a = createCrossTabLock({ store, owner: "A" });
  assert.equal(a.acquire(), true);
});
