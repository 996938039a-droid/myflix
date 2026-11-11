// ---------------------------------------------------------------
// Called whenever any Play button is clicked. You define what happens.
//
//   ctx = {
//     type:    "movie" | "tv",
//     id:      TMDB id (number),
//     title:   "Title",
//     season:  number   (tv only; 1 when played from a poster/hero)
//     episode: number   (tv only; 1 when played from a poster/hero)
//   }
//
// Use openPlayer(html) to show anything in a full-screen modal,
// or navigate / fetch / do whatever you like here.
// ---------------------------------------------------------------
window.MYFLIX = window.MYFLIX || {};

MYFLIX.onPlay = function (ctx) {
  // TODO: define what happens on click.
  const label = ctx.type === "tv" ? `${ctx.title} S${ctx.season}E${ctx.episode}` : ctx.title;
  openPlayer(`<div style="color:#fff;padding:40px;text-align:center">
    <h3>Play: ${label}</h3>
    <p style="color:#9a9aae">No player configured yet. Edit <code>public/player.js</code>.</p>
    <pre style="color:#9a9aae">${JSON.stringify(ctx)}</pre></div>`);
};

// Helper: shows HTML inside a 16:9 modal. Click outside or press Esc to close.
function openPlayer(html) {
  closePlayer();
  const m = document.createElement("div");
  m.className = "modal"; m.id = "playermodal";
  m.innerHTML = `<div class="box" style="display:flex;align-items:center;justify-content:center"><button class="x">Close ✕</button>${html}</div>`;
  m.onclick = (e) => { if (e.target === m || e.target.className === "x") closePlayer(); };
  document.body.appendChild(m);
}
function closePlayer() { document.getElementById("playermodal")?.remove(); }
addEventListener("keydown", (e) => { if (e.key === "Escape") closePlayer(); });
