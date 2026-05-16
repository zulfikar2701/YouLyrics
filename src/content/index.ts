import { onYoutubeNavigation, extractMetadata, getPlayerElement, getVideoElement } from "./youtube-dom";
import { normalizeTitle } from "./normalizer";
import { shouldAutoFetch } from "./detector";
import { getLyrics, putLyrics, getNoLyrics, putNoLyrics, getOverride, putOverride } from "./cache";
import { fetchLrclib } from "./lrclib";
import { parseLrc } from "./lrc-parser";
import { SyncEngine } from "./sync-engine";
import { LyricsOverlay } from "./overlay/overlay";
import { PlayerButton } from "./overlay/player-button";
import { openSearchDialog } from "./overlay/search-dialog";
import { getSettings } from "../shared/settings";
import type { LrclibResult, LyricsRecord, RuntimeMessage, VideoMetadata } from "../shared/types";

type FetchOutcome = "never-fetched" | "fetched-empty";

type SessionState = {
  meta: VideoMetadata;
  parsed: { artist: string; song: string };
  overlay: LyricsOverlay | null;
  button: PlayerButton;
  engine: SyncEngine | null;
  outcome: FetchOutcome;
  cleanupDialog?: () => void;
};

let session: SessionState | null = null;

async function run() {
  teardown();

  const meta = await extractMetadata();
  if (!meta) return;

  const settings = await getSettings();
  if (!settings.enabled) return;

  const player = getPlayerElement();
  const video = getVideoElement();
  if (!player || !video) return;

  const parsed = normalizeTitle(meta.title, meta.channelName);

  const rightControls = player.querySelector<HTMLElement>(".ytp-right-controls");
  if (!rightControls) return;
  const button = new PlayerButton(
    rightControls,
    () => onButtonClick(),
    () => onButtonClick(),
  );

  session = { meta, parsed, overlay: null, button, engine: null, outcome: "never-fetched" };

  const override = await getOverride(meta.videoId);
  const allowAuto = override !== null || shouldAutoFetch(meta, settings.maxDurationSec);

  if (!allowAuto) {
    button.setState("unavailable");
    return;
  }

  await runFetchPipeline({ artist: parsed.artist, song: parsed.song, override });
}

async function runFetchPipeline(args: {
  artist: string;
  song: string;
  override: { artist: string; title: string } | null;
}) {
  if (!session) return;
  const { meta } = session;
  session.button.setState("loading");

  const fetchArtist = args.override?.artist ?? args.artist;
  const fetchSong = args.override?.title ?? args.song;

  // 1. Cache lookup
  let record = await getLyrics(fetchArtist, fetchSong);

  // 2. If cache miss, check negative cache for non-overrides
  if (!record && !args.override) {
    const negative = await getNoLyrics(fetchArtist, fetchSong);
    if (negative) {
      session.outcome = "fetched-empty";
      session.button.setState("unavailable");
      return;
    }
  }

  // 3. Fetch fresh: LRCLIB → Genius fallback
  if (!record) {
    const lrcResult = await fetchLrclib({
      artist: fetchArtist, song: fetchSong, durationSec: meta.durationSec,
    });
    if (lrcResult?.syncedLyrics) {
      record = await persistLrclib(fetchArtist, fetchSong, lrcResult);
    } else {
      const geniusText = await fetchGeniusViaBackground(fetchArtist, fetchSong);
      if (geniusText) {
        record = await persistGenius(fetchArtist, fetchSong, geniusText);
      } else if (lrcResult?.plainLyrics) {
        record = await persistLrclib(fetchArtist, fetchSong, lrcResult);
      } else {
        await putNoLyrics(fetchArtist, fetchSong);
      }
    }
  }

  if (!record) {
    session.outcome = "fetched-empty";
    session.button.setState("unavailable");
    return;
  }

  await renderRecord(record);
}

async function renderRecord(record: LyricsRecord) {
  if (!session) return;
  const settings = await getSettings();
  const player = getPlayerElement();
  const video = getVideoElement();
  if (!player || !video) return;

  const overlay = new LyricsOverlay(
    player, settings,
    () => openWrongSongDialog(),
  );
  session.overlay = overlay;

  if (record.syncedLyrics) {
    const lines = parseLrc(record.syncedLyrics);
    overlay.setSyncedLines(lines);
    const engine = new SyncEngine(video, lines, (idx) => overlay.render(idx));
    engine.start();
    session.engine = engine;
  } else if (record.plainLyrics) {
    overlay.setStaticText(record.plainLyrics);
  } else {
    overlay.destroy();
    session.overlay = null;
    session.outcome = "fetched-empty";
    session.button.setState("unavailable");
    return;
  }

  session.button.setState("available");
}

async function persistLrclib(artist: string, song: string, r: LrclibResult): Promise<LyricsRecord> {
  const rec: LyricsRecord = {
    syncedLyrics: r.syncedLyrics,
    plainLyrics: r.plainLyrics,
    source: "lrclib",
    lrclibId: r.id,
    fetchedAt: Date.now(),
  };
  await putLyrics(artist, song, rec);
  return rec;
}

async function persistGenius(artist: string, song: string, text: string): Promise<LyricsRecord> {
  const rec: LyricsRecord = {
    syncedLyrics: null,
    plainLyrics: text,
    source: "genius",
    fetchedAt: Date.now(),
  };
  await putLyrics(artist, song, rec);
  return rec;
}

async function fetchGeniusViaBackground(artist: string, song: string): Promise<string | null> {
  const search = await chrome.runtime.sendMessage({ type: "geniusSearch", query: `${artist} ${song}` });
  if (!search?.url) return null;
  const lyrics = await chrome.runtime.sendMessage({ type: "geniusFetch", url: search.url });
  return typeof lyrics === "string" ? lyrics : null;
}

function onButtonClick() {
  if (!session) return;
  if (session.overlay) {
    session.overlay.setHidden(!session.overlay.isHidden());
    return;
  }
  if (session.outcome === "never-fetched") {
    void runFetchPipeline({ artist: session.parsed.artist, song: session.parsed.song, override: null });
  } else {
    openWrongSongDialog();
  }
}

function openWrongSongDialog() {
  if (!session) return;
  const player = getPlayerElement();
  if (!player) return;
  session.cleanupDialog?.();
  session.cleanupDialog = openSearchDialog(player, {
    initialArtist: session.parsed.artist,
    initialSong: session.parsed.song,
    onPick: async (r: LrclibResult) => {
      if (!session) return;
      await putOverride(session.meta.videoId, {
        artist: r.artistName, title: r.trackName, lrclibId: r.id, setAt: Date.now(),
      });
      await persistLrclib(r.artistName, r.trackName, r);
      session.cleanupDialog?.();
      void run();
    },
    onClose: () => { session?.cleanupDialog?.(); },
  });
}

function teardown() {
  session?.engine?.destroy();
  session?.overlay?.destroy();
  session?.button?.destroy();
  session?.cleanupDialog?.();
  session = null;
}

chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  if (msg.type === "openManualSearch" && session) {
    openWrongSongDialog();
  }
});

onYoutubeNavigation(() => { void run(); });
