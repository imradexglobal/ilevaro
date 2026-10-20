const NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return NGN_FORMATTER.format(amount);
}

export function formatDate(date: Date | { toDate(): Date }): string {
  const d = date instanceof Date ? date : date.toDate();
  return d.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | { toDate(): Date }): string {
  const d = date instanceof Date ? date : date.toDate();
  return d.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

let refCounter = 0;

export function generateReference(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  refCounter = (refCounter + 1) % 0xffffff;
  const counter = refCounter.toString(36).toUpperCase().padStart(4, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(4, "0");
  return `${prefix}-${timestamp}-${counter}${random}`;
}
