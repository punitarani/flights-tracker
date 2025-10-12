import { ulid } from "@/utils/ulid";

const tablePrefix = {
  airport: "apt",
  alert: "alt",
  airline: "aln",
  notification: "ntf",
  alertNotification: "ant",
  seatsAeroSearchRequest: "sasr",
  seatsAeroAvailabilityTrip: "saat",
} as const;

type TableName = keyof typeof tablePrefix;

/**
 * Generate an ID for a given table.
 * @example generateId("airport") -> "apt-01hcb3dxj4nb7j7gk0m9p6htm8"
 */
export function generateId(table: TableName): string {
  return `${tablePrefix[table]}-${ulid()}`;
}

/**
 * Cast a string to a typed ID for a given table.
 * @example castId<"airport">("apt-01hcb3dxj4nb7j7gk0m9p6htm8") -> "apt-01hcb3dxj4nb7j7gk0m9p6htm8"
 * @throws Will throw an error if the ID prefix does not match the table.
 */
export function castId<T extends TableName>(
  id: string,
): `${(typeof tablePrefix)[T]}-${string}` {
  const prefix = id.split("-")[0];
  if (!Object.values(tablePrefix).includes(prefix as (typeof tablePrefix)[T])) {
    throw new Error(`Invalid ID prefix: ${prefix}`);
  }
  return id as `${(typeof tablePrefix)[T]}-${string}`;
}
