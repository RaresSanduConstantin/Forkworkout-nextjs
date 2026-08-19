import type { ShareServerConfig } from "@/lib/sharing/config";
import { getRedisClient } from "@/lib/sharing/redis";
import {
  DisabledShareStorage,
  UpstashShareStorage,
  type ShareStorage,
} from "@/lib/sharing/storage";

export function getShareStorage(config: ShareServerConfig): ShareStorage {
  if (!config.enabled) return new DisabledShareStorage();
  return new UpstashShareStorage(getRedisClient(config));
}

