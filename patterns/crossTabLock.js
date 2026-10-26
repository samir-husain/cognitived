// Cross-tab checkout lock: a lease held in shared storage with an owner id, a TTL
// and a heartbeat. Written for this repository as a small, dependency-free model
// of the rule used in the product: acquire the lock BEFORE creating an order, and
// never release it while a payment is pending or its outcome is unknown.
//
// `store` is anything with get(key) / set(key, value) / remove(key) that holds
// JSON-serialisable values (localStorage in a browser, a Map here in tests).
// `now` is injected so tests can move time without sleeping.

export function createCrossTabLock({ store, key = "checkout_lock", owner, ttlMs = 15000, now = () => Date.now() }) {
  if (!owner) throw new Error("owner id is required");

  function read() {
    const raw = store.get(key);
    if (!raw) return null;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return null; // a corrupt lease must never block checkout forever
    }
  }

  function write(lease) {
    store.set(key, JSON.stringify(lease));
  }

  /** Try to take the lock. Returns true when this owner holds it afterwards. */
  function acquire() {
    const lease = read();
    const t = now();
    const heldByOther = lease && lease.owner !== owner && lease.until > t;
    if (heldByOther) return false;
    write({ owner, until: t + ttlMs });
    return true;
  }

  /** Extend the lease; returns false if we no longer own it (another tab took over after expiry). */
  function heartbeat() {
    const lease = read();
    if (!lease || lease.owner !== owner) return false;
    write({ owner, until: now() + ttlMs });
    return true;
  }

  /** Release only our own lease. A pending or unknown payment must keep the lock, so the caller decides when. */
  function release() {
    const lease = read();
    if (lease && lease.owner === owner) store.remove(key);
  }

  function holder() {
    const lease = read();
    if (!lease || lease.until <= now()) return null;
    return lease.owner;
  }

  return { acquire, heartbeat, release, holder };
}
