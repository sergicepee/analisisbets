import type { Fixture } from "./types";

const CSV_LIVE_WINDOW_SECONDS = 110 * 60;

export function isWithinCsvLiveWindow(fixture: Fixture, now = Date.now() / 1000) {
  return ["NS", "TBD"].includes(fixture.statusShort)
    && now >= fixture.timestamp
    && now < fixture.timestamp + CSV_LIVE_WINDOW_SECONDS;
}

export function shouldRefreshCsvFixture(fixture: Fixture, now = Date.now() / 1000) {
  return ["NS", "TBD"].includes(fixture.statusShort)
    && now < fixture.timestamp + CSV_LIVE_WINDOW_SECONDS;
}

export function isNearCsvLiveWindow(fixture: Fixture, now = Date.now() / 1000) {
  return ["NS", "TBD"].includes(fixture.statusShort)
    && now >= fixture.timestamp - CSV_LIVE_WINDOW_SECONDS
    && now < fixture.timestamp + CSV_LIVE_WINDOW_SECONDS;
}
