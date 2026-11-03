import test from "node:test";
import assert from "node:assert/strict";
import { shouldRefreshFixtureStatus, shouldRefreshRecentlyFinishedFixture, statusGroup } from "../src/lib/fixtureStatus.ts";

const now = Math.floor(Date.now() / 1000);
const fixture = (statusShort, timestamp = now) => ({
  statusShort,
  timestamp,
});

test("refreshes status shortly before and after the scheduled kickoff", () => {
  assert.equal(shouldRefreshFixtureStatus(fixture("NS", now - 15 * 60), now), true);
  assert.equal(shouldRefreshFixtureStatus(fixture("TBD", now + 15 * 60), now), true);
  assert.equal(shouldRefreshFixtureStatus(fixture("NS", now - 149 * 60), now), true);
  assert.equal(shouldRefreshFixtureStatus(fixture("NS", now - 151 * 60), now), false);
  assert.equal(shouldRefreshFixtureStatus(fixture("FT"), now), false);
});

test("a not-started fixture after kickoff remains pending but is eligible for status refresh", () => {
  const pendingFixture = fixture("NS", now - 10 * 60);
  assert.equal(statusGroup(pendingFixture), "pending");
  assert.equal(shouldRefreshFixtureStatus(pendingFixture, now), true);
});

test("refreshes a finished fixture briefly so recent form can include its result", () => {
  assert.equal(shouldRefreshRecentlyFinishedFixture(fixture("FT", now - 149 * 60), now), true);
  assert.equal(shouldRefreshRecentlyFinishedFixture(fixture("FT", now - 151 * 60), now), false);
  assert.equal(shouldRefreshRecentlyFinishedFixture(fixture("NS", now - 2 * 60 * 60), now), false);
});
