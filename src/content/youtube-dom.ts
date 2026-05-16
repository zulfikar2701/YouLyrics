import type { VideoMetadata } from "../shared/types";

export type NavigationCallback = () => void;

export function onYoutubeNavigation(cb: NavigationCallback): () => void {
  let lastUrl = location.href;
  let timer: number | null = null;

  const debounced = () => {
    if (timer !== null) clearTimeout(timer);
    timer = window.setTimeout(cb, 500);
  };

  const handler = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      debounced();
    }
  };

  window.addEventListener("yt-navigate-finish", debounced);
  window.addEventListener("popstate", handler);
  debounced();

  return () => {
    if (timer !== null) clearTimeout(timer);
    window.removeEventListener("yt-navigate-finish", debounced);
    window.removeEventListener("popstate", handler);
  };
}

export function getVideoIdFromUrl(): string | null {
  return new URL(location.href).searchParams.get("v");
}

export function getVideoElement(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>("video.html5-main-video");
}

export function getPlayerElement(): HTMLElement | null {
  return document.getElementById("movie_player");
}

async function waitForDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  return new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener("loadedmetadata", handler);
      resolve(video.duration);
    };
    video.addEventListener("loadedmetadata", handler);
  });
}

export async function extractMetadata(): Promise<VideoMetadata | null> {
  const videoId = getVideoIdFromUrl();
  if (!videoId) return null;
  const video = getVideoElement();
  if (!video) return null;

  const titleEl = document.querySelector<HTMLElement>(
    "h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string",
  );
  const channelEl = document.querySelector<HTMLElement>(
    "ytd-channel-name #text a, ytd-channel-name a",
  );
  const isLive = !Number.isFinite(video.duration) || video.duration === Infinity;

  const title = titleEl?.textContent?.trim() ?? "";
  const channelName = channelEl?.textContent?.trim() ?? "";
  if (!title || !channelName) return null;

  const durationSec = Math.round(await waitForDuration(video));
  return {
    videoId,
    title,
    channelName,
    durationSec,
    isLive,
  };
}
