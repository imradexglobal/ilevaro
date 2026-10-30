/**
 * Firestore rejects `undefined` field values outright:
 *   "Function DocumentReference.set() called with invalid data.
 *    Unsupported field value: undefined"
 *
 * Optional form fields are naturally `undefined` when left blank, so every
 * write is passed through `stripUndefined` first. Keys whose value is
 * `undefined` are omitted from the payload entirely, nested plain objects are
 * cleaned recursively, and Firestore types (Timestamp, FieldValue sentinels,
 * GeoPoint, Date, class instances) are left untouched.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (isPlainObject(value)) return stripUndefined(value);
  return value;
}

export function stripUndefined<T extends object>(data: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    result[key] = clean(value);
  }
  return result as unknown as T;
}
