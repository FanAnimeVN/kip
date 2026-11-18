export type Lang = "vi" | "en";

export function detectLang(env: NodeJS.ProcessEnv = process.env): Lang {
  const v = (env.KIP_LANG ?? env.LC_ALL ?? env.LC_MESSAGES ?? env.LANG ?? "").toLowerCase();
  return v.startsWith("vi") ? "vi" : "en";
}

export function ago(unixSeconds: number, lang: Lang, now = Date.now() / 1000): string {
  const s = Math.max(0, now - unixSeconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(s / 3600);
  const d = Math.floor(s / 86400);
  if (lang === "vi") {
    if (m < 1) return "vừa xong";
    if (h < 1) return `${m} phút trước`;
    if (d < 1) return `${h} giờ trước`;
    return `${d} ngày trước`;
  }
  if (m < 1) return "just now";
  if (h < 1) return `${m} min ago`;
  if (d < 1) return `${h} h ago`;
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

/** Lower-case the first letter for use mid-sentence, but keep acronyms like "ORM", "HTTP". */
export const mid = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

const list = (items: string[], lang: Lang) => {
  if (items.length <= 1) return items.join("");
  const and = lang === "vi" ? " và " : " and ";
  return items.slice(0, -1).join(", ") + and + items[items.length - 1];
};

export function messages(lang: Lang) {
  const vi = lang === "vi";
  return {
    lang,
    list: (items: string[]) => list(items, lang),
    you: vi ? "bạn" : "you",
    team: vi ? "nhóm" : "the team",
    someone: vi ? "một bạn trong nhóm" : "a teammate",

    // brief
    briefTitle: (base: string) => (vi ? `Tin từ nhóm (${base})` : `Team news (${base})`),
    newSince: (n: number, first: boolean) =>
      vi
        ? first
          ? `${n} commit trên nhánh chung mà bạn chưa có:`
          : `${n} commit mới kể từ lần cuối bạn xem:`
        : first
          ? `${n} commit${n === 1 ? "" : "s"} on the team line that you don't have yet:`
          : `${n} new commit${n === 1 ? "" : "s"} since you last checked:`,
    nothingNew: vi ? "Không có gì mới từ nhóm kể từ lần cuối bạn xem." : "Nothing new from the team since you last checked.",
    commits: (n: number) => (vi ? `${n} commit` : `${n} commit${n === 1 ? "" : "s"}`),
    areas: vi ? "vùng" : "areas",
    depsLine: vi ? "Thư viện" : "Dependencies",
    schemaLine: vi ? "Data model" : "Data model",
    decisionsLine: vi ? "Quyết định" : "Decisions",
    youVsTeam: vi ? "Bạn so với nhóm:" : "You vs. the team:",
    allClear: vi ? "✓ Không thấy dấu hiệu lệch hướng. Cứ tiếp tục!" : "✓ No signs of divergence. Carry on!",
    moreCommits: (n: number) => (vi ? `… và ${n} commit nữa` : `… and ${n} more`),

    // signals
    violation: (pkg: string, decision: string, expected?: string) =>
      vi
        ? expected
          ? `Bạn thêm ${pkg}, nhưng nhóm đã quyết định dùng ${expected} ("${decision}").`
          : `Bạn thêm ${pkg}, nhưng quyết định "${decision}" nói tránh nó.`
        : expected
          ? `You added ${pkg}, but the team decided to use ${expected} ("${decision}").`
          : `You added ${pkg}, but the decision "${decision}" says to avoid it.`,
    depConflict: (mine: string, theirs: string[], category: string) =>
      vi
        ? `Bạn thêm ${mine} cho ${mid(category)}, trong khi nhóm đang dùng ${list(theirs, lang)}.`
        : `You added ${mine} for ${mid(category)}, but the team already uses ${list(theirs, lang)}.`,
    parallel: (topic: string, who: string) =>
      vi
        ? `Cả bạn và ${who} đều đang làm "${topic}" — ở hai chỗ khác nhau:`
        : `Both you and ${who} are building "${topic}" — in two different places:`,
    yourFiles: vi ? "bạn" : "you",
    lockfile: (mine: string, theirs: string[]) =>
      vi
        ? `Bạn đang cài thư viện bằng ${mine}, còn nhóm dùng ${list(theirs, lang)}.`
        : `You're installing packages with ${mine}; the team uses ${list(theirs, lang)}.`,
    ecosystem: (eco: string, manifest: string) =>
      vi
        ? `Bạn thêm một hệ ngôn ngữ mới (${eco}, ${manifest}) mà phần còn lại của dự án chưa dùng.`
        : `You introduced a new ecosystem (${eco}, ${manifest}) that the rest of the project doesn't use.`,
    overlap: (n: number) =>
      vi ? `Bạn và nhóm cùng sửa ${n} file:` : `You and the team both changed ${n} file${n === 1 ? "" : "s"}:`,
    schemaBoth: vi ? "Cả bạn và nhóm đều đổi data model:" : "Both you and the team changed the data model:",
    schemaTheirs: vi ? "Nhóm đã đổi data model:" : "The team changed the data model:",
    decisionsChanged: vi ? "Quyết định của nhóm đã thay đổi:" : "Team decisions changed:",
    stale: (n: number, days: number) =>
      vi
        ? `Bạn đang chậm ${n} commit${days > 0 ? ` (${days} ngày)` : ""} so với nhánh chung.`
        : `You're ${n} commit${n === 1 ? "" : "s"} behind the team line${days > 0 ? ` (${days} day${days === 1 ? "" : "s"})` : ""}.`,

    // next steps
    nextTitle: vi ? "Nên làm gì:" : "What to do:",
    nextViolation: vi
      ? "Hỏi nhóm trước khi dùng thư viện khác — hoặc đề xuất đổi quyết định: kip decide \"...\""
      : "Ask the team before switching libraries — or propose a new decision: kip decide \"...\"",
    nextParallel: (who: string) =>
      vi ? `Nhắn ${who}: hai bạn có đang làm trùng một việc không? Chốt ai làm phần nào.` : `Ping ${who}: are you two building the same thing? Agree who owns it.`,
    nextLockfile: (pm: string) =>
      vi ? `Xoá lockfile của bạn và cài lại bằng ${pm}.` : `Delete your lockfile and reinstall with ${pm}.`,
    nextSync: (base: string) =>
      vi
        ? `Cập nhật code của nhóm trước khi làm tiếp: git pull --rebase (hoặc git merge ${base}).`
        : `Bring in the team's work before going further: git pull --rebase (or git merge ${base}).`,

    // hook preamble for agents
    hookPreamble: vi
      ? "[kip] Bản tin nhóm cho phiên làm việc này. TRƯỚC KHI viết code, hãy tóm tắt cho người dùng (bằng tiếng Việt, 2–5 gạch đầu dòng) những gì đồng đội đã thay đổi và mọi cảnh báo ⚠. Nếu có ⚠, hỏi người dùng muốn xử lý thế nào trước khi chạm vào các phần đó. Tuân theo các quyết định trong .kip/decisions.md."
      : "[kip] Team briefing for this session. BEFORE writing code, summarize for the user (2–5 bullets) what teammates changed and every ⚠ warning. If there are ⚠ warnings, ask the user how to proceed before touching those areas. Follow the decisions in .kip/decisions.md.",

    // summary (PR)
    summaryTitle: vi ? "kip · Tóm tắt thay đổi" : "kip · Change summary",
    summaryBy: (n: number, authors: string[], files: number) =>
      vi
        ? `**${n} commit** của ${list(authors, lang)} · ${files} file thay đổi`
        : `**${n} commit${n === 1 ? "" : "s"}** by ${list(authors, lang)} · ${files} file${files === 1 ? "" : "s"} changed`,
    summaryAreas: vi ? "Vùng thay đổi" : "Areas touched",
    summaryDivergence: (base: string) => (vi ? `Lệch hướng so với ${base}` : `Divergence from ${base}`),
    summaryNoDivergence: (base: string) =>
      vi ? `✓ Không thấy dấu hiệu lệch hướng so với ${base}.` : `✓ No signs of divergence from ${base}.`,
    summaryFooter: vi
      ? "kip giúp cả nhóm — và agent của mọi người — đi cùng một hướng."
      : "kip keeps your team — and everyone's AI agents — on the same page.",

    // init / sync / decide
    initDone: vi ? "Đã cài kip cho repo này." : "kip is set up for this repo.",
    created: vi ? "tạo" : "created",
    updated: vi ? "cập nhật" : "updated",
    unchanged: vi ? "giữ nguyên" : "unchanged",
    detected: (n: number) =>
      vi ? `Tự nhận diện ${n} quyết định từ thư viện đang dùng (sửa lại nếu sai):` : `Detected ${n} decision${n === 1 ? "" : "s"} from your dependencies (edit if wrong):`,
    initNext: vi
      ? [
          "Mở .kip/decisions.md, ghi thêm các quyết định quan trọng của nhóm.",
          "Commit thư mục .kip/ và các file hướng dẫn agent, rồi push cho cả nhóm.",
          "Mỗi người: mở agent như bình thường — agent sẽ tự chạy `kip brief`.",
          "Tuỳ chọn: thêm GitHub Action để tóm tắt mọi PR (xem README).",
        ]
      : [
          "Open .kip/decisions.md and write down the decisions that matter.",
          "Commit .kip/ and the agent instruction files, then push for the team.",
          "Everyone: open your agent as usual — it will run `kip brief` on its own.",
          "Optional: add the GitHub Action to summarize every PR (see README).",
        ],
    nextSteps: vi ? "Tiếp theo:" : "Next:",
    decided: (title: string) => (vi ? `Đã ghi quyết định: ${title}` : `Recorded decision: ${title}`),
    decideNext: vi
      ? "Commit .kip/decisions.md và báo nhóm — agent của mọi người sẽ đọc quyết định này."
      : "Commit .kip/decisions.md and tell the team — everyone's agent will pick this up.",
    synced: vi ? "Đã đồng bộ hướng dẫn cho các agent:" : "Synced agent instructions:",
    noSuggestions: vi ? "Không có quyết định nào để gợi ý thêm." : "Nothing new to suggest.",
    suggestions: vi ? "Gợi ý quyết định từ thư viện đang dùng:" : "Suggested decisions from your dependencies:",
    suggestWriteHint: vi ? "Chạy lại với --write để ghi vào .kip/decisions.md." : "Run again with --write to add them to .kip/decisions.md.",
    useFor: (lib: string, cat: string) => (vi ? `Dùng ${lib} cho ${mid(cat)}` : `Use ${lib} for ${mid(cat)}`),
    autoDetected: vi ? "tự nhận diện bởi kip" : "auto-detected by kip",

    // errors
    notRepo: vi ? "Không phải git repo. Hãy chạy kip trong thư mục dự án." : "Not a git repository. Run kip inside your project.",
    noBase: vi
      ? "Không tìm thấy nhánh chung của nhóm (vd: origin/main). Dùng --base <ref> hoặc thêm \"base\" vào .kip/config.json."
      : "Couldn't find the team's main line (e.g. origin/main). Pass --base <ref> or set \"base\" in .kip/config.json.",
    noCommits: vi ? "Repo chưa có commit nào." : "This repository has no commits yet.",
    notifySent: (where: string) => (vi ? `Đã gửi tóm tắt tới ${where}.` : `Sent summary to ${where}.`),
    notifyFailed: (where: string, why: string) => (vi ? `Gửi tới ${where} thất bại: ${why}` : `Sending to ${where} failed: ${why}`),
  };
}

export type Messages = ReturnType<typeof messages>;
