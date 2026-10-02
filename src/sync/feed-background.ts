import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { listSavedFeeds } from "@/db/nyaa";
import { refreshEpisodes } from "@/sync/refresh";

const TASK_NAME = "nekostream-feed-refresh";
const INTERVAL_KEY = "nekostream:feed-refresh-minutes";
const NOTIFICATIONS_KEY = "nekostream:release-notifications";
const COOLDOWN_KEY = "nekostream:nyaa-cooldown-until";
const CHANNEL_ID = "new-releases";
const DEFAULT_INTERVAL: FeedInterval = "180";
const REQUEST_GAP_MS = 2_000;
const RATE_LIMIT_COOLDOWN_MS = 6 * 60 * 60_000;
const ERROR_COOLDOWN_MS = 30 * 60_000;

export const FEED_INTERVALS = [
  { key: "0", label: "Off" },
  { key: "60", label: "Every hour" },
  { key: "180", label: "Every 3 hours" },
  { key: "360", label: "Every 6 hours" },
  { key: "720", label: "Every 12 hours" },
] as const;

export type FeedInterval = (typeof FEED_INTERVALS)[number]["key"];

export async function getFeedInterval(): Promise<FeedInterval> {
  const stored = await AsyncStorage.getItem(INTERVAL_KEY);
  return FEED_INTERVALS.find((option) => option.key === stored)?.key ?? DEFAULT_INTERVAL;
}

export async function setFeedInterval(interval: FeedInterval): Promise<void> {
  await AsyncStorage.setItem(INTERVAL_KEY, interval);
  await syncFeedBackgroundTask();
}

export async function getReleaseNotificationsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(NOTIFICATIONS_KEY)) === "true";
}

export async function setReleaseNotificationsEnabled(enabled: boolean): Promise<boolean> {
  if (enabled) {
    await ensureNotificationChannel();
    const permissions = await Notifications.requestPermissionsAsync();
    if (!permissions.granted) return false;
  }
  await AsyncStorage.setItem(NOTIFICATIONS_KEY, String(enabled));
  return enabled;
}

async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "New releases",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function syncFeedBackgroundTask(): Promise<void> {
  if (Platform.OS === "web") return;

  const interval = Number(await getFeedInterval());
  const hasFeeds = (await listSavedFeeds()).length > 0;
  const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);

  if (!hasFeeds || interval === 0) {
    if (registered) await BackgroundTask.unregisterTaskAsync(TASK_NAME);
    return;
  }

  // Re-registering applies a changed interval to the native scheduler.
  await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: interval });
}

async function notifyNewReleases(
  title: string,
  count: number,
  libraryEntryId: string,
) {
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) return;
  await ensureNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "New releases on NekoStream",
      body: `${title}: ${count} new ${count === 1 ? "release" : "releases"}`,
      data: { url: `/anime/${libraryEntryId}` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: Date.now() + 1_000,
      channelId: CHANNEL_ID,
    },
  });
}

let currentRefresh: Promise<void> | null = null;

export function refreshDueFeeds(): Promise<void> {
  if (currentRefresh) return currentRefresh;
  currentRefresh = runDueFeedRefresh().finally(() => { currentRefresh = null; });
  return currentRefresh;
}

async function runDueFeedRefresh(): Promise<void> {
  const interval = Number(await getFeedInterval());
  if (interval === 0) return;

  const cooldownUntil = Number(await AsyncStorage.getItem(COOLDOWN_KEY));
  if (cooldownUntil > Date.now()) return;

  const notify = await getReleaseNotificationsEnabled();
  const feeds = await listSavedFeeds();
  const due = feeds.filter((feed) =>
    !feed.lastFetchedAt || Date.now() - feed.lastFetchedAt.getTime() >= interval * 60_000,
  ).slice(0, 10);

  for (const [index, feed] of due.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS));
    try {
      const { added } = await refreshEpisodes(feed.libraryEntryId);
      if (notify && feed.lastFetchedAt && added > 0) {
        try {
          await notifyNewReleases(feed.title ?? feed.titleRomaji, added, feed.libraryEntryId);
        } catch (error) {
          console.warn("Could not show release notification", error);
        }
      }
    } catch (error) {
      console.warn("Feed refresh failed", feed.libraryEntryId, error);
      const cooldown = error instanceof Error && /returned 429\b/.test(error.message)
        ? RATE_LIMIT_COOLDOWN_MS
        : ERROR_COOLDOWN_MS;
      await AsyncStorage.setItem(COOLDOWN_KEY, String(Date.now() + cooldown));
      break;
    }
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await refreshDueFeeds();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn("Background feed refresh failed", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
