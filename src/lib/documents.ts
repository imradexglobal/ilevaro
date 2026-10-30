import "firebase/compat/firestore";
import { db } from "./firebase";
import { stripUndefined } from "./sanitize";

export interface DocumentRecord {
  id: string;
  agencyId: string;
  name: string;
  type: "contract" | "invoice" | "receipt" | "lease" | "other";
  description?: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export async function createDocumentRecord(
  agencyId: string,
  record: Omit<DocumentRecord, "id" | "uploadedAt">
): Promise<string> {
  const now = new Date();
  const docRef = await db
    .collection("agencies")
    .doc(agencyId)
    .collection("documents")
    .add({ ...stripUndefined(record), uploadedAt: now });
  return docRef.id;
}

export async function getDocumentRecords(
  agencyId: string
): Promise<DocumentRecord[]> {
  const snap = await db
    .collection("agencies")
    .doc(agencyId)
    .collection("documents")
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      agencyId: data.agencyId,
      name: data.name,
      type: data.type,
      description: data.description,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      uploadedBy: data.uploadedBy,
      uploadedAt: data.uploadedAt?.toDate?.() || new Date(),
    } as DocumentRecord;
  });
}

export async function deleteDocumentRecord(
  agencyId: string,
  documentId: string
): Promise<void> {
  await db
    .collection("agencies")
    .doc(agencyId)
    .collection("documents")
    .doc(documentId)
    .delete();
}

export function documentsToCSV(documents: DocumentRecord[]): string {
  const headers = [
    "id",
    "name",
    "type",
    "description",
    "fileName",
    "fileSize",
    "mimeType",
    "uploadedBy",
    "uploadedAt",
  ];
  const escape = (value: string | number | undefined): string => {
    const str = value === undefined ? "" : String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const rows = documents.map((d) =>
    [
      d.id,
      d.name,
      d.type,
      d.description ?? "",
      d.fileName,
      d.fileSize?.toString() ?? "",
      d.mimeType ?? "",
      d.uploadedBy,
      d.uploadedAt.toISOString(),
    ].map(escape).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

export function documentsFromCSV(csvText: string): Omit<DocumentRecord, "id">[] {
  const lines = csvText.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const requiredHeaders = ["name", "type", "fileName"];
  for (const required of requiredHeaders) {
    if (!headers.includes(required)) {
      return [];
    }
  }

  const results: Omit<DocumentRecord, "id">[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = parseCSVLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });

    results.push({
      agencyId: "",
      name: record.name,
      type: (record.type as DocumentRecord["type"]) || "other",
      description: record.description || undefined,
      fileName: record.fileName,
      fileSize: parseInt(record.fileSize || "0", 10) || undefined,
      mimeType: record.mimeType || undefined,
      uploadedBy: record.uploadedBy || "",
      uploadedAt: new Date(),
    });
  }

  return results;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      i++;
      continue;
    }
    current += char;
    i++;
  }
  result.push(current);
  return result;
}