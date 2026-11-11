
/* ---------------------------------------------------------------
   MYFLIX PLAYER
   Supports Movies, TV Series and Anime via Vidrift embeds.
   --------------------------------------------------------------- */

window.MYFLIX = window.MYFLIX || {};


/* ---------------------------------------------------------------
   PLAY HANDLER
   Called whenever any Play button is clicked.

   ctx = {
     type: "movie" | "tv",
     id: TMDB_ID,
     title: "Title",
     season: number,   // TV only
     episode: number   // TV only
   }
   --------------------------------------------------------------- */

MYFLIX.onPlay = function (ctx) {

  if (!ctx || !ctx.id || !ctx.title) {
    console.error("MYFLIX: Invalid playback context.", ctx);
    return;
  }

  const encodedTitle = encodeURIComponent(ctx.title);

  let embedUrl;

  if (ctx.type === "movie") {

    // Movie embed
    embedUrl =
      `https://embed.vidrift.net/embed/movie/${ctx.id}` +
      `?title=${encodedTitle}&brand=myflix-directory`;

  } else if (ctx.type === "tv") {

    // TV Series / Anime embed
    const season = ctx.season || 1;
    const episode = ctx.episode || 1;

    embedUrl =
      `https://embed.vidrift.net/embed/tv/${ctx.id}/${season}/${episode}` +
      `?title=${encodedTitle}&brand=myflix-directory`;

  } else {

    console.error("MYFLIX: Unsupported media type:", ctx.type);
    return;
  }

  console.log("MYFLIX: Opening player:", embedUrl);

  openPlayer(embedUrl);
};


/* ---------------------------------------------------------------
   OPEN PLAYER MODAL
   --------------------------------------------------------------- */

function openPlayer(embedUrl) {

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

  // Close when clicking outside the player
  modal.onclick = function (e) {
    if (
      e.target === modal ||
      e.target.classList.contains("x")
    ) {
      closePlayer();
    }
  };

  document.body.appendChild(modal);

  // Prevent background scrolling
  document.body.style.overflow = "hidden";
}


/* ---------------------------------------------------------------
   CLOSE PLAYER
   --------------------------------------------------------------- */

function closePlayer() {

  const modal = document.getElementById("playermodal");

  if (modal) {
    const iframe = modal.querySelector("iframe");

    // Stop playback by removing iframe
    if (iframe) {
      iframe.src = "about:blank";
    }

    modal.remove();
  }

  document.body.style.overflow = "";
}


/* ---------------------------------------------------------------
   KEYBOARD SUPPORT
   Escape key closes player.
   --------------------------------------------------------------- */

document.addEventListener("keydown", function (e) {

  if (e.key === "Escape") {
    closePlayer();
  }

});


/* ---------------------------------------------------------------
   VIDRIFT EXIT MESSAGE SUPPORT
   Allows Vidrift to request closing the modal.
   --------------------------------------------------------------- */

window.addEventListener("message", function (event) {

  // Accept messages only from Vidrift
  if (event.origin !== "https://embed.vidrift.net") {
    return;
  }

  if (event.data === "vidrift:exit") {
    closePlayer();
  }

});
