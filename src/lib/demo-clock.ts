const pacificDateParts = (now: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as { month: string; day: string; year: string };

/** The demo's freshness marker is the current Pacific date at the 5 AM run. */
export function currentDemoAsOfLabel(now = new Date()) {
  const parts = pacificDateParts(now);
  return `${parts.month} ${parts.day}, ${parts.year} · 5:00 AM PST`;
}
