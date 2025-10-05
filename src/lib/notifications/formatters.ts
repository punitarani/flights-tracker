const baseCurrencyOptions: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
};

export function formatCurrency(
  amount: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
): string {
  const formatter = new Intl.NumberFormat("en-US", {
    ...baseCurrencyOptions,
    currency,
    ...options,
  });
  return formatter.format(amount);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoDate));
}

export function formatDateTime(
  isoDate: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "short",
    ...options,
  }).format(new Date(isoDate));
}

export function joinWithAnd(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function stripHtml(html: string): string {
  return html
    .replace(/\s*<[^>]+>\s*/g, (match) => {
      if (match === "<br>" || match === "<br/>" || match === "<br />") {
        return "\n";
      }
      if (/^<\/(p|div|h[1-6]|li)>$/i.test(match)) {
        return "\n";
      }
      return " ";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
