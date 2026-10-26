import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFailure, isRetrySafe, decide, createScopeRegistry } from "./availability.js";

test("only 502/503/504 and 424 count as service unavailable; a plain 500 propagates", () => {
  assert.equal(classifyFailure({ status: 503 }), "server");
  assert.equal(classifyFailure({ status: 424 }), "server");
  assert.equal(classifyFailure({ status: 500 }), "application");
  assert.equal(classifyFailure({ status: 404 }), "application");
  assert.equal(classifyFailure({}), "network");
  assert.equal(classifyFailure({ timedOut: true }), "timeout");
});

test("reads are retry-safe, writes only when the caller vouches for idempotency", () => {
  assert.equal(isRetrySafe({ method: "get" }), true);
  assert.equal(isRetrySafe({ method: "POST" }), false);
  assert.equal(isRetrySafe({ method: "POST", availabilityRetrySafe: true }), true);
});

test("a create-order POST during an outage is never replayed: it publishes the outage instead", () => {
  const createOrder = { method: "POST", url: "purchase/create_order" };
  assert.equal(decide(createOrder, { status: 503 }), "publish-outage");
});

test("a GET during an outage is replayed once, then published", () => {
  const get = { method: "GET" };
  assert.equal(decide(get, { status: 502 }), "replay");
  assert.equal(decide(get, { status: 502 }, { alreadyReplayed: true }), "publish-outage");
});

test("an application error is left to the caller", () => {
  assert.equal(decide({ method: "GET" }, { status: 409 }), "propagate");
});

test("one failing scope does not mark the others down", () => {
  const reg = createScopeRegistry();
  reg.publish("video", { status: 503 });
  assert.equal(reg.isDown("video"), true);
  assert.equal(reg.isDown("payments"), false);
  assert.equal(reg.isDown(), false, "global scope untouched");
  reg.clear("video");
  assert.deepEqual(reg.downScopes(), []);
});
