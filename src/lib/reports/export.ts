import type { InstitutionalReport } from "@/lib/reports/institutional";

export function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function toCsv(rows: string[][]) {
  return rows.map((row) => row.map((cell) => csvEscape(cell ?? "")).join(",")).join("\n");
}

export function downloadTextFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function slugFile(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function institutionalCsv(report: InstitutionalReport) {
  return toCsv([
    ["Pillar", "Score", "Status", "Note"],
    ...report.pillars.map((item) => [item.label, String(item.score), item.status, item.note]),
    [],
    ["Flag", "Severity", "Detail"],
    ...report.flags.map((item) => [item.title, item.severity, item.detail]),
    [],
    ["Unknown"],
    ...report.unknowns.map((item) => [item]),
  ]);
}
