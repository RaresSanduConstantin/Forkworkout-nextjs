import type { ShareServerConfig } from "@/lib/sharing/config";

const CACHE_MS = 15 * 60 * 1000;

export type ShareQuotaStatus = {
  allowCreates: boolean;
  usage?: number;
  limit: number;
  threshold: number;
  reason?: "configuration" | "quota" | "unavailable";
};

let cached:
  | { key: string; expiresAt: number; status: ShareQuotaStatus }
  | undefined;

export async function getShareQuotaStatus(
  config: ShareServerConfig,
  options: { fetcher?: typeof fetch; now?: number; bypassCache?: boolean } = {}
): Promise<ShareQuotaStatus> {
  const base = {
    limit: config.monthlyCommandLimit,
    threshold: config.quotaThreshold,
  };
  if (!config.quotaGuardEnabled) return { ...base, allowCreates: true };
  if (!config.databaseId || !config.developerEmail || !config.developerApiKey) {
    return { ...base, allowCreates: false, reason: "configuration" };
  }

  const now = options.now ?? Date.now();
  const cacheKey = `${config.databaseId}:${config.monthlyCommandLimit}:${config.quotaThreshold}`;
  if (!options.bypassCache && cached?.key === cacheKey && cached.expiresAt > now) {
    return cached.status;
  }

  try {
    const auth = Buffer.from(
      `${config.developerEmail}:${config.developerApiKey}`
    ).toString("base64");
    const response = await (options.fetcher ?? fetch)(
      `https://api.upstash.com/v2/redis/stats/${encodeURIComponent(config.databaseId)}`,
      {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(4_000),
        cache: "no-store",
      }
    );
    if (!response.ok) throw new Error("Quota API request failed.");
    const body = (await response.json()) as { total_monthly_requests?: unknown };
    const usage = Number(body.total_monthly_requests);
    if (!Number.isFinite(usage) || usage < 0) throw new Error("Invalid quota response.");
    const status: ShareQuotaStatus = {
      ...base,
      usage,
      allowCreates: usage < config.monthlyCommandLimit * config.quotaThreshold,
      reason:
        usage >= config.monthlyCommandLimit * config.quotaThreshold
          ? "quota"
          : undefined,
    };
    cached = { key: cacheKey, expiresAt: now + CACHE_MS, status };
    return status;
  } catch {
    return { ...base, allowCreates: false, reason: "unavailable" };
  }
}

export function clearShareQuotaCacheForTests(): void {
  cached = undefined;
}

