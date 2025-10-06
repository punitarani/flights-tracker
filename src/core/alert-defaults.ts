import { addMonths, addWeeks, format, startOfDay, subDays } from "date-fns";

const ISO_DATE_FORMAT = "yyyy-MM-dd";

export function getDefaultAlertDateRange(baseDate: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = startOfDay(addWeeks(baseDate, 1));
  const end = startOfDay(subDays(addMonths(start, 1), 1));
  return { start, end };
}

export function getDefaultAlertDateRangeIso(baseDate: Date = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const { start, end } = getDefaultAlertDateRange(baseDate);
  return {
    dateFrom: format(start, ISO_DATE_FORMAT),
    dateTo: format(end, ISO_DATE_FORMAT),
  };
}
