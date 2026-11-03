import type { Fixture, StatusGroup } from "./types";

const CSV_LIVE_WINDOW_SECONDS = 110 * 60;
const KICKOFF_REFRESH_EARLY_SECONDS = 15 * 60;
const KICKOFF_REFRESH_LATE_SECONDS = 150 * 60;
const RECENT_FINISHED_REFRESH_SECONDS = 150 * 60;
const LIVE_STATUSES = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
const FINISHED_STATUSES = ["FT", "AET", "PEN"];

export function statusGroup(fixture: Fixture): StatusGroup {
  if (LIVE_STATUSES.includes(fixture.statusShort)) return "live";
  if (FINISHED_STATUSES.includes(fixture.statusShort)) return "finished";
  if (["NS", "TBD"].includes(fixture.statusShort)) {
    return Date.now() / 1000 < fixture.timestamp ? "upcoming" : "pending";
  }
  return "other";
}

export function liveMinuteLabel(elapsed: number | null, elapsedDisplay: string | null | undefined): string | number {
  const stoppage = elapsedDisplay?.match(/(\d{1,3})\s*['′’]?\s*\+\s*(\d{1,2})/);
  if (!stoppage) return elapsed ?? "—";
  const baseMinute = Number(stoppage[1]);
  const displayedExtra = Number(stoppage[2]);
  const currentExtra = elapsed === null ? displayedExtra : Math.max(displayedExtra, elapsed - baseMinute);
  return `${baseMinute}+${currentExtra}`;
}

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

export function shouldRefreshFixtureStatus(fixture: Fixture, now = Date.now() / 1000) {
  return ["NS", "TBD"].includes(fixture.statusShort)
    && now >= fixture.timestamp - KICKOFF_REFRESH_EARLY_SECONDS
    && now < fixture.timestamp + KICKOFF_REFRESH_LATE_SECONDS;
}

export function shouldRefreshRecentlyFinishedFixture(fixture: Fixture, now = Date.now() / 1000) {
  return FINISHED_STATUSES.includes(fixture.statusShort)
    && now >= fixture.timestamp
    && now < fixture.timestamp + RECENT_FINISHED_REFRESH_SECONDS;
}
