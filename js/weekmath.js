// Shared date-range helpers used by Weekly Collection and Rice Collection,
// on both the staff and admin dashboards. All math is done in UTC calendar
// days to avoid local-timezone drift when comparing against Sheet dates.

function toDateKey(v) {
  if (!v) return null;
  const dt = new Date(v);
  if (isNaN(dt)) return null;
  return dt.toISOString().slice(0, 10);
}

function utcDate(y, m, d) {
  return new Date(Date.UTC(y, m, d));
}

// Weekly Collection: Monday through Saturday (6 days).
function mondaySaturdayWeek(refDateStr) {
  const ref = refDateStr ? new Date(refDateStr) : new Date();
  const d = utcDate(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = utcDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + mondayOffset);
  const end = utcDate(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 5);
  return { start, end };
}

// Rice Collection: Saturday through Friday (7 days), restarting from the
// first Saturday of whichever month the reference date falls in — so
// Aug 1 (a Saturday) through Aug 7, then Aug 8 through Aug 14, and so on.
function riceWeek(refDateStr) {
  const ref = refDateStr ? new Date(refDateStr) : new Date();
  const d = utcDate(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
  const firstOfMonth = utcDate(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const firstSatOffset = (6 - firstOfMonth.getUTCDay() + 7) % 7;
  const firstSaturday = utcDate(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth(), 1 + firstSatOffset);
  let diffDays = Math.round((d - firstSaturday) / 86400000);
  if (diffDays < 0) diffDays = 0; // any day before the month's first Saturday folds into week 1
  const weekIndex = Math.floor(diffDays / 7);
  const start = utcDate(firstSaturday.getUTCFullYear(), firstSaturday.getUTCMonth(), firstSaturday.getUTCDate() + weekIndex * 7);
  const end = utcDate(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6);
  return { start, end };
}

// All the Sat–Fri rice-collection weeks that start within the given
// month — e.g. for August: Aug 1–7, 8–14, 15–21, 22–28, and a final week
// that starts Aug 29 (its Friday end may fall into September, same as how
// riceWeek() always produces fixed 7-day blocks).
function riceWeeksInMonth(refDateStr) {
  const bounds = monthBoundsFor(refDateStr);
  const weeks = [];
  let w = riceWeek(toDateKey(bounds.start));
  while (toDateKey(w.start) <= toDateKey(bounds.end)) {
    weeks.push(w);
    const nextStart = utcDate(w.start.getUTCFullYear(), w.start.getUTCMonth(), w.start.getUTCDate() + 7);
    w = riceWeek(toDateKey(nextStart));
  }
  return weeks;
}

// Short header label for a report column, matching "August 1-7, 2026"
// style when the week sits entirely in one month, or "Aug 29-Sep 4, 2026"
// when it spans two.
function formatWeekColumnLabel(week) {
  const sameMonth = week.start.getUTCMonth() === week.end.getUTCMonth() && week.start.getUTCFullYear() === week.end.getUTCFullYear();
  if (sameMonth) {
    const month = week.start.toLocaleDateString('en-PH', { month: 'long', timeZone: 'UTC' });
    return `${month} ${week.start.getUTCDate()}-${week.end.getUTCDate()}, ${week.end.getUTCFullYear()}`;
  }
  const f1 = week.start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const f2 = week.end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${f1}-${f2}`;
}

function monthBoundsFor(refDateStr) {
  const ref = refDateStr ? new Date(refDateStr) : new Date();
  const start = utcDate(ref.getUTCFullYear(), ref.getUTCMonth(), 1);
  const end = utcDate(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0); // last day of month
  return { start, end };
}

function dateInRange(dateVal, start, end) {
  const dk = toDateKey(dateVal);
  if (!dk) return false;
  return dk >= toDateKey(start) && dk <= toDateKey(end);
}

function dateInWeek(dateVal, week) {
  return dateInRange(dateVal, week.start, week.end);
}

function formatWeekLabel(week) {
  const f1 = week.start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const f2 = week.end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  return f1 + ' \u2013 ' + f2;
}

function formatMonthLabel(bounds) {
  return bounds.start.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}
