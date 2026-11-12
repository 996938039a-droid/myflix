
/* ===============================================================
   MYFLIX PLAYER.JS
   Streaming Provider: Vidrift
   Storage: Browser localStorage

   FEATURES:
   1. Movies, TV Series and Anime
   2. Automatic playback tracking
   3. Continue Watching
   4. Automatic resume
   5. Episode-wise progress tracking
   6. Watch history
   7. Vidrift exit integration

   IMPORTANT:
   - No iframe sandbox attribute.
   - No fetch() for embed URLs.
   - Direct iframe embedding only.
   =============================================================== */


window.MYFLIX = window.MYFLIX || {};


/* ===============================================================
   CONFIGURATION
   =============================================================== */

const MYFLIX_CONFIG = {

  EMBED_ORIGIN: "https://embed.vidrift.net",

  STORAGE_KEY: "myflix_continue_watching",

  BRAND: "myflix-directory",

  // Ignore progress below this timestamp
  MIN_PROGRESS: 10,

  // Consider an item complete when Vidrift sends ended.
  // Do not infer completion merely from reaching 95%.

};


/* ===============================================================
   STORAGE HELPERS
   =============================================================== */

MYFLIX.getStorage = function () {

  try {

    return JSON.parse(
      localStorage.getItem(MYFLIX_CONFIG.STORAGE_KEY) || "{}"
    );

  } catch (error) {

    console.error("MYFLIX: Storage read error", error);

    return {};

  }

};


MYFLIX.saveStorage = function (data) {

  try {

    localStorage.setItem(
      MYFLIX_CONFIG.STORAGE_KEY,
      JSON.stringify(data)
    );

  } catch (error) {

    console.error("MYFLIX: Storage write error", error);

  }

};


/* ===============================================================
   MEDIA HELPERS
   =============================================================== */

function normalizeContext(ctx) {

  const type = ctx.type === "movie" ? "movie" : "tv";

  return {

    type: type,

    id: Number(ctx.id),

    title: ctx.title || "Untitled",

    season: type === "tv"
      ? Number(ctx.season || 1)
      : null,

    episode: type === "tv"
      ? Number(ctx.episode || 1)
      : null

  };

}


function getMediaKey(ctx) {

  return [
    ctx.type,
    ctx.id,
    ctx.season || 0,
    ctx.episode || 0
  ].join("_");

}


MYFLIX.getProgress = function (ctx) {

  const normalized = normalizeContext(ctx);

  const history = MYFLIX.getStorage();

  return history[getMediaKey(normalized)] || null;

};


/* ===============================================================
   PLAY HANDLER
   Called whenever a Play button is clicked.

   ctx = {
     type: "movie" | "tv",
     id: TMDB_ID,
     title: "Title",
     season: number,
     episode: number,

     Optional:
     startOver: true
     resumeAt: seconds
   }
   =============================================================== */

MYFLIX.currentContext = null;

MYFLIX.onPlay = function (ctx) {

  if (!ctx || !ctx.id || !ctx.title) {

    console.error("MYFLIX: Invalid playback context", ctx);

    return;

  }

  const media = normalizeContext(ctx);

  MYFLIX.currentContext = media;

  // Retrieve previous progress
  const saved = MYFLIX.getProgress(media);

  let resumeAt = 0;

  if (ctx.resumeAt !== undefined) {

    resumeAt = Math.max(0, Number(ctx.resumeAt) || 0);

  } else if (!ctx.startOver && saved) {

    resumeAt = Number(saved.currentTime) || 0;

  }

  // Avoid resuming at the very end of a title
  if (
    saved &&
    saved.duration > 0 &&
    resumeAt >= saved.duration - 30 &&
    ctx.resumeAt === undefined
  ) {

    resumeAt = 0;

  }

  let embedUrl = "";

  const encodedTitle = encodeURIComponent(media.title);

  if (media.type === "movie") {

    embedUrl =
      `${MYFLIX_CONFIG.EMBED_ORIGIN}/embed/movie/${media.id}` +
      `?title=${encodedTitle}` +
      `&brand=${MYFLIX_CONFIG.BRAND}` +
      `&exit=1`;

  } else {

    // TV Series and TMDB-based Anime

    embedUrl =
      `${MYFLIX_CONFIG.EMBED_ORIGIN}/embed/tv/` +
      `${media.id}/${media.season}/${media.episode}` +
      `?title=${encodedTitle}` +
      `&brand=${MYFLIX_CONFIG.BRAND}` +
      `&exit=1`;

  }

  console.log("MYFLIX: Playing", media);

  console.log("MYFLIX: Resume position:", resumeAt);

  openPlayer(embedUrl, resumeAt);

};


/* ===============================================================
   PLAY FROM CONTINUE WATCHING
   =============================================================== */

MYFLIX.playFromProgress = function (item) {

  if (!item) return;

  MYFLIX.onPlay({

    type: item.type,

    id: item.id,

    title: item.title,

    season: item.season,

    episode: item.episode,

    resumeAt: item.currentTime

  });

};


/* ===============================================================
   OPEN PLAYER MODAL
   =============================================================== */

function openPlayer(embedUrl, resumeAt = 0) {

  closePlayer();

  const modal = document.createElement("div");

  modal.className = "modal";

  modal.id = "playermodal";

  modal.innerHTML = `

    <div class="box" style="
      position:relative;
      display:flex;
      align-items:center;
      justify-content:center;
      width:90%;
      max-width:1200px;
      padding:0;
      background:#000;
      overflow:hidden;
    ">

      <button
        class="x"
        aria-label="Close player"
        style="
          position:absolute;
          top:12px;
          right:12px;
          z-index:100;
          cursor:pointer;
        "
      >✕</button>

      <div style="
        position:relative;
        width:100%;
        padding-bottom:56.25%;
        height:0;
        background:#000;
      ">

        <iframe
          id="myflix-iframe"
          src="${embedUrl}"
          style="
            position:absolute;
            inset:0;
            width:100%;
            height:100%;
            border:0;
          "
          allowfullscreen
          allow="autoplay; fullscreen"
        ></iframe>

      </div>

    </div>

  `;

  // Close on outside click or Close button
  modal.onclick = function (e) {

    if (
      e.target === modal ||
      e.target.classList.contains("x")
    ) {

      closePlayer();

    }

  };

  document.body.appendChild(modal);

  document.body.style.overflow = "hidden";

  const iframe = document.getElementById("myflix-iframe");

  // Vidrift documents resume as safe before video readiness.
  // Send it after the iframe document loads.

  iframe.addEventListener("load", function () {

    if (!iframe.contentWindow) return;

    // Request current player state
    iframe.contentWindow.postMessage({

      type: "vidrift:get-state"

    }, MYFLIX_CONFIG.EMBED_ORIGIN);

    // Resume at the previously saved position
    if (resumeAt > 0) {

      iframe.contentWindow.postMessage({

        type: "vidrift:resume",

        currentTime: resumeAt

      }, MYFLIX_CONFIG.EMBED_ORIGIN);

    }

  }, { once: true });

}


/* ===============================================================
   SAVE PLAYBACK PROGRESS
   =============================================================== */

function savePlaybackProgress(data) {

  const active = MYFLIX.currentContext;

  if (!active) return;

  // Prefer the metadata supplied by Vidrift
  const type = data.mediaType === "movie"
    ? "movie"
    : active.type;

  const media = {

    type: type,

    id: Number(data.tmdbId || active.id),

    title: active.title,

    season: type === "tv"
      ? Number(data.season ?? active.season ?? 1)
      : null,

    episode: type === "tv"
      ? Number(data.episode ?? active.episode ?? 1)
      : null

  };

  if (!media.id) return;

  const currentTime = Number(data.currentTime);

  if (!Number.isFinite(currentTime) || currentTime < 0) {
    return;
  }

  const history = MYFLIX.getStorage();

  const key = getMediaKey(media);

  const previous = history[key] || {};

  const duration = Number(data.duration);

  // Keep previous duration if paused event doesn't provide it
  history[key] = {

    ...previous,

    ...media,

    currentTime: currentTime,

    duration:
      Number.isFinite(duration) && duration > 0
        ? duration
        : previous.duration || 0,

    progress:
      Number.isFinite(duration) && duration > 0
        ? Math.min(100, (currentTime / duration) * 100)
        : previous.progress || 0,

    lastWatched: Date.now()

  };

  MYFLIX.saveStorage(history);

  console.log(
    "MYFLIX: Progress saved",
    media.title,
    currentTime
  );

}


/* ===============================================================
   MARK AS COMPLETED
   =============================================================== */

function markAsCompleted(data) {

  const active = MYFLIX.currentContext;

  if (!active) return;

  const media = {

    type: data.mediaType === "movie"
      ? "movie"
      : active.type,

    id: Number(data.tmdbId || active.id),

    title: active.title,

    season: data.mediaType === "movie"
      ? null
      : Number(data.season ?? active.season ?? 1),

    episode: data.mediaType === "movie"
      ? null
      : Number(data.episode ?? active.episode ?? 1)

  };

  const history = MYFLIX.getStorage();

  const key = getMediaKey(media);

  // Remove completed title/episode from Continue Watching
  delete history[key];

  MYFLIX.saveStorage(history);

  console.log("MYFLIX: Completed", media);

}


/* ===============================================================
   VIDRIFT MESSAGE LISTENER
   All communication with the cross-origin player happens here.

   Supported incoming messages:
   - vidrift:progress
   - vidrift:paused
   - vidrift:unpaused
   - vidrift:episode
   - vidrift:ended
   - vidrift:exit
   - vidrift:state
   =============================================================== */

window.addEventListener("message", function (event) {

  // Security: accept only Vidrift
  if (event.origin !== MYFLIX_CONFIG.EMBED_ORIGIN) {
    return;
  }

  const iframe = document.getElementById("myflix-iframe");

  // Accept messages only from our current player iframe
  if (!iframe || event.source !== iframe.contentWindow) {
    return;
  }

  const data = event.data;

  if (!data || typeof data !== "object") {
    return;
  }

  switch (data.type) {

    // -----------------------------------------------------------
    // Playback progress: every 5 seconds
    // -----------------------------------------------------------

    case "vidrift:progress":

      savePlaybackProgress(data);

      break;


    // -----------------------------------------------------------
    // User paused playback
    // -----------------------------------------------------------

    case "vidrift:paused":

      savePlaybackProgress(data);

      break;


    // -----------------------------------------------------------
    // Playback resumed
    // -----------------------------------------------------------

    case "vidrift:unpaused":

      console.log("MYFLIX: Playback resumed");

      break;


    // -----------------------------------------------------------
    // Episode changed inside Vidrift
    // -----------------------------------------------------------

    case "vidrift:episode":

      if (MYFLIX.currentContext) {

        MYFLIX.currentContext.season = Number(data.season);

        MYFLIX.currentContext.episode = Number(data.episode);

      }

      console.log(
        "MYFLIX: Episode changed",
        data.season,
        data.episode
      );

      break;


    // -----------------------------------------------------------
    // Video completed
    // -----------------------------------------------------------

    case "vidrift:ended":

      markAsCompleted(data);

      break;


    // -----------------------------------------------------------
    // Vidrift exit button clicked
    // -----------------------------------------------------------

    case "vidrift:exit":

      closePlayer();

      break;


    // -----------------------------------------------------------
    // Player state response
    // -----------------------------------------------------------

    case "vidrift:state":

      if (
        typeof data.currentTime === "number" &&
        data.currentTime >= 0
      ) {

        savePlaybackProgress(data);

      }

      break;


    // -----------------------------------------------------------
    // Command errors
    // -----------------------------------------------------------

    case "vidrift:command-error":

      console.warn("MYFLIX: Vidrift command error", data);

      break;

  }

});


/* ===============================================================
   GET CONTINUE WATCHING LIST
   Returns all unfinished titles, newest first.

   Usage:
   const list = MYFLIX.getContinueWatching();
   =============================================================== */

MYFLIX.getContinueWatching = function () {

  const history = MYFLIX.getStorage();

  return Object.values(history)

    .filter(item => {

      return (
        item.currentTime >= MYFLIX_CONFIG.MIN_PROGRESS &&
        (
          !item.duration ||
          item.currentTime < item.duration - 30
        )
      );

    })

    .sort((a, b) => {

      return b.lastWatched - a.lastWatched;

    });

};


/* ===============================================================
   CLEAR A SPECIFIC TITLE / EPISODE
   =============================================================== */

MYFLIX.removeFromContinueWatching = function (item) {

  if (!item) return;

  const key = getMediaKey(item);

  const history = MYFLIX.getStorage();

  delete history[key];

  MYFLIX.saveStorage(history);

};


/* ===============================================================
   CLEAR ALL WATCH HISTORY
   =============================================================== */

MYFLIX.clearWatchHistory = function () {

  localStorage.removeItem(MYFLIX_CONFIG.STORAGE_KEY);

  console.log("MYFLIX: Watch history cleared");

};


/* ===============================================================
   CLOSE PLAYER
   =============================================================== */

function closePlayer() {

  const modal = document.getElementById("playermodal");

  if (modal) {

    const iframe = modal.querySelector("iframe");

    // Stop playback
    if (iframe) {

      iframe.src = "about:blank";

    }

    modal.remove();

  }

  document.body.style.overflow = "";

  MYFLIX.currentContext = null;

}


/* ===============================================================
   KEYBOARD SUPPORT
   =============================================================== */

document.addEventListener("keydown", function (e) {

  if (e.key === "Escape") {

    closePlayer();

  }

});


/* ===============================================================
   INITIALIZATION
   =============================================================== */

console.log("MYFLIX Player initialized successfully.");

