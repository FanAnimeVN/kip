/** Post a message to team chat via incoming webhooks. Zero dependencies (global fetch, Node 18+). */
export interface NotifyTarget {
  name: "discord" | "slack";
  url: string;
}

export function notifyTargets(env: NodeJS.ProcessEnv = process.env): NotifyTarget[] {
  const targets: NotifyTarget[] = [];
  if (env.KIP_DISCORD_WEBHOOK) targets.push({ name: "discord", url: env.KIP_DISCORD_WEBHOOK });
  if (env.KIP_SLACK_WEBHOOK) targets.push({ name: "slack", url: env.KIP_SLACK_WEBHOOK });
  return targets;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

export async function notify(target: NotifyTarget, text: string): Promise<void> {
  const body =
    target.name === "discord"
      ? { content: truncate(text, 1900), allowed_mentions: { parse: [] } }
      : { text: truncate(text, 3800) };
  const res = await fetch(target.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
