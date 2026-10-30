"use client";

import { IconSearch } from "./icons";
import { LocalizedSearchField } from "./LocalizedSearchField";

export function LocalizedSearchInput() {
  return (
    <form action="/buscar" className="relative hidden lg:block">
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <LocalizedSearchField className="w-64 rounded-xl border border-line bg-card py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-brand" />
    </form>
  );
}
