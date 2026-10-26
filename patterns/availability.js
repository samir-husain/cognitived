// Failure classification and the replay rule from the product's API availability contract.
// Only "service unavailable" failures are published to the UI as outages, and only
// retry-safe requests are ever replayed automatically. A write is replayed only when
// its caller explicitly vouches that the backend treats it idempotently.

const UNAVAILABLE_STATUSES = new Set([502, 503, 504, 424]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * @param {{ status?: number, code?: string, timedOut?: boolean }} failure
 * @returns {"network" | "timeout" | "server" | "application"}
 */
export function classifyFailure(failure) {
  if (failure.timedOut || failure.code === "ECONNABORTED") return "timeout";
  if (failure.status == null) return "network";
  if (UNAVAILABLE_STATUSES.has(failure.status)) return "server";
  return "application"; // 400s and a plain 500 propagate to the caller unchanged
}

/** Is this failure an outage the availability layer should own (replay once, then show Retry)? */
export function isUnavailable(failure) {
  const kind = classifyFailure(failure);
  return kind === "network" || kind === "timeout" || kind === "server";
}

/**
 * @param {{ method?: string, availabilityRetrySafe?: boolean }} request
 */
export function isRetrySafe(request) {
  const method = (request.method || "GET").toUpperCase();
  if (SAFE_METHODS.has(method)) return true;
  return request.availabilityRetrySafe === true;
}

/**
 * Decide what to do with a failed request.
 * @returns {"replay" | "publish-outage" | "propagate"}
 */
export function decide(request, failure, { alreadyReplayed = false } = {}) {
  if (!isUnavailable(failure)) return "propagate";
  if (isRetrySafe(request) && !alreadyReplayed) return "replay";
  return "publish-outage";
}

/**
 * Per-scope outage registry: one failing section degrades alone. Unscoped failures
 * fall into the global scope.
 */
export function createScopeRegistry() {
  const outages = new Map();
  return {
    publish(scope = "global", failure) {
      outages.set(scope, { failure, at: Date.now() });
    },
    clear(scope = "global") {
      outages.delete(scope);
    },
    isDown(scope = "global") {
      return outages.has(scope);
    },
    downScopes() {
      return [...outages.keys()];
    },
  };
}
