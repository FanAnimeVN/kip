import fs from "node:fs";
import path from "node:path";
import type { Lang } from "./i18n.js";

export const KIP_DIR = ".kip";
export const DECISIONS_FILE = `${KIP_DIR}/decisions.md`;

export interface Decision {
  title: string;
  date?: string;
  why?: string;
  use: string[];
  avoid: string[];
  owner?: string;
  status: "active" | "proposed" | "superseded";
  source?: string;
}

const FIELD_ALIASES: Record<string, keyof Decision | "status"> = {
  why: "why",
  "lý do": "why",
  "ly do": "why",
  "vì sao": "why",
  use: "use",
  dùng: "use",
  dung: "use",
  avoid: "avoid",
  tránh: "avoid",
  tranh: "avoid",
  "không dùng": "avoid",
  owner: "owner",
  "người phụ trách": "owner",
  "phụ trách": "owner",
  status: "status",
  "trạng thái": "status",
  source: "source",
  "nguồn": "source",
};

const SUPERSEDED = new Set(["superseded", "replaced", "deprecated", "dropped", "bỏ", "đã bỏ", "thay thế", "huỷ", "hủy"]);
const PROPOSED = new Set(["proposed", "draft", "đề xuất", "nháp"]);

const splitList = (v: string) =>
  v
    .split(/[,;]/)
    .map((x) => x.replace(/`/g, "").trim())
    .filter(Boolean);

/**
 * Parse `.kip/decisions.md`. Each `## heading` is one decision; optional `- key: value`
 * lines underneath (English or Vietnamese keys) make it machine-checkable.
 */
export function parseDecisions(text: string): Decision[] {
  const decisions: Decision[] = [];
  let current: Decision | null = null;
  // Examples inside <!-- comments --> are documentation, not decisions.
  const visible = text.replace(/<!--[\s\S]*?(-->|$)/g, "");
  for (const raw of visible.split("\n")) {
    const heading = /^##\s+(.+?)\s*$/.exec(raw);
    if (heading?.[1]) {
      let title = heading[1];
      let date: string | undefined;
      const dated = /^(\d{4}-\d{2}-\d{2})\s*[·•|—–-]\s*(.+)$/.exec(title);
      if (dated?.[1] && dated[2]) {
        date = dated[1];
        title = dated[2];
      }
      current = { title: title.trim(), date, use: [], avoid: [], status: "active" };
      decisions.push(current);
      continue;
    }
    if (!current) continue;
    const field = /^\s*[-*]\s*([^:]{1,30}):\s*(.*)$/.exec(raw);
    if (!field?.[1]) continue;
    const key = FIELD_ALIASES[field[1].trim().toLowerCase()];
    const value = (field[2] ?? "").trim();
    if (!key) continue;
    if (key === "use") current.use.push(...splitList(value));
    else if (key === "avoid") current.avoid.push(...splitList(value));
    else if (key === "status") {
      const v = value.toLowerCase();
      current.status = SUPERSEDED.has(v) ? "superseded" : PROPOSED.has(v) ? "proposed" : "active";
    } else if (key === "why" || key === "owner" || key === "source") current[key] = value;
  }
  return decisions;
}

export function activeDecisions(decisions: Decision[]): Decision[] {
  return decisions.filter((d) => d.status !== "superseded");
}

export function readDecisions(root: string): Decision[] {
  try {
    return parseDecisions(fs.readFileSync(path.join(root, DECISIONS_FILE), "utf8"));
  } catch {
    return [];
  }
}

export function decisionTemplate(lang: Lang): string {
  if (lang === "vi") {
    return `# Quyết định của nhóm

<!--
Mỗi quyết định là một mục "##". Ghi ngắn: đã chọn gì, vì sao.
Các dòng "- dùng:" / "- tránh:" là tùy chọn — có chúng, kip tự kiểm tra code của mọi người
(và agent của mọi người) có đi đúng hướng không.

Ví dụ:

## 2026-11-18 · Dùng Prisma + PostgreSQL cho database
- lý do: cả nhóm quen SQL, deploy miễn phí được
- dùng: prisma, pg
- tránh: mongoose, typeorm
- phụ trách: @an

Đổi ý? Đừng xoá — thêm "- trạng thái: bỏ" vào quyết định cũ và ghi quyết định mới.
Lệnh nhanh: kip decide "Tiêu đề" --why "..." --use a,b --avoid c
-->
`;
  }
  return `# Team decisions

<!--
One "##" section per decision. Keep it short: what we chose and why.
The optional "- use:" / "- avoid:" lines let kip check that everyone's code
(and everyone's AI agent) is heading the same way.

Example:

## 2026-11-18 · Use Prisma + PostgreSQL for the database
- why: everyone knows SQL, free hosting is easy
- use: prisma, pg
- avoid: mongoose, typeorm
- owner: @an

Changed your mind? Don't delete — add "- status: superseded" to the old one and record a new one.
Shortcut: kip decide "Title" --why "..." --use a,b --avoid c
-->
`;
}

export interface NewDecision {
  title: string;
  why?: string;
  use?: string[];
  avoid?: string[];
  owner?: string;
  source?: string;
  date?: string;
}

export function formatDecision(d: NewDecision, lang: Lang): string {
  const k =
    lang === "vi"
      ? { why: "lý do", use: "dùng", avoid: "tránh", owner: "phụ trách", source: "nguồn" }
      : { why: "why", use: "use", avoid: "avoid", owner: "owner", source: "source" };
  const lines = [`## ${d.date ?? today()} · ${d.title}`];
  if (d.why) lines.push(`- ${k.why}: ${d.why}`);
  if (d.use?.length) lines.push(`- ${k.use}: ${d.use.join(", ")}`);
  if (d.avoid?.length) lines.push(`- ${k.avoid}: ${d.avoid.join(", ")}`);
  if (d.owner) lines.push(`- ${k.owner}: ${d.owner}`);
  if (d.source) lines.push(`- ${k.source}: ${d.source}`);
  return lines.join("\n") + "\n";
}

export function appendDecisions(root: string, items: NewDecision[], lang: Lang): void {
  const file = path.join(root, DECISIONS_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : decisionTemplate(lang);
  if (!text.endsWith("\n")) text += "\n";
  for (const item of items) text += "\n" + formatDecision(item, lang);
  fs.writeFileSync(file, text);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Titles added/removed between two versions of decisions.md. */
export function diffDecisionTitles(before: string | null, after: string | null): { added: Decision[]; retired: Decision[] } {
  const a = parseDecisions(before ?? "");
  const b = parseDecisions(after ?? "");
  const beforeActive = new Map(a.filter((d) => d.status !== "superseded").map((d) => [d.title, d]));
  const afterActive = new Map(b.filter((d) => d.status !== "superseded").map((d) => [d.title, d]));
  return {
    added: [...afterActive.values()].filter((d) => !beforeActive.has(d.title)),
    retired: [...beforeActive.values()].filter((d) => !afterActive.has(d.title)),
  };
}
