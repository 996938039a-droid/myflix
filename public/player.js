
// ---------------------------------------------------------------
// MYFLIX Player Configuration
// Handles Play clicks for Movies, TV Shows and Anime.
// ---------------------------------------------------------------

window.MYFLIX = window.MYFLIX || {};

MYFLIX.onPlay = function (ctx) {

  // Encode title for URL (spaces become %20)
  const encodedTitle = encodeURIComponent(ctx.title);

  let embedUrl = "";

  if (ctx.type === "movie") {

    // Movie player
    embedUrl =
      `https://embed.vidrift.net/embed/movie/${ctx.id}` +
      `?title=${encodedTitle}&brand=myflix-directory`;

  } else if (ctx.type === "tv") {

    // TV Series / Anime player
    embedUrl =
      `https://embed.vidrift.net/embed/tv/${ctx.id}/${ctx.season}/${ctx.episode}` +
      `?title=${encodedTitle}&brand=myflix-directory`;

  } else {
    console.error("Unsupported media type:", ctx.type);
    return;
  }

  // Display player in fullscreen modal
  openPlayer(`
    <div style="
      position:relative;
      width:100%;
      padding-bottom:56.25%;
      height:0;
      background:#000;
      overflow:hidden;
    ">
      <iframe
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
        referrerpolicy="origin"
      ></iframe>
    </div>
  `);
};


// ---------------------------------------------------------------
// Player Modal
// ---------------------------------------------------------------

function openPlayer(html) {

  closePlayer();

  const modal = document.createElement("div");

  modal.className = "modal";
  modal.id = "playermodal";

  modal.innerHTML = `
    <div class="box" style="
      display:flex;
      align-items:center;
      justify-content:center;
      position:relative;
      width:90%;
      max-width:1100px;
      background:#000;
      overflow:hidden;
    ">
      <button class="x" aria-label="Close player">✕</button>
      ${html}
    </div>
  `;

  modal.onclick = (e) => {
    if (e.target === modal || e.target.classList.contains("x")) {
      closePlayer();
    }
  };

  document.body.appendChild(modal);
}


// ---------------------------------------------------------------
// Close Player
// ---------------------------------------------------------------

function closePlayer() {
  document.getElementById("playermodal")?.remove();
}


// Close on Escape key

addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePlayer();
});
