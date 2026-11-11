// Netlify Function: proxies TMDB so your API key stays private.
// Routes (via /api/*):
//   GET /api/search?q=inception        -> movies + series matching the name
//   GET /api/movie/:id                 -> full movie details
//   GET /api/tv/:id                    -> full series details + every season + every episode
const BASE = "https://api.themoviedb.org/3";

function authed(url) {
  const key = process.env.TMDB_API_KEY || "";
  const headers = { accept: "application/json" };
  if (key.length > 40) headers.Authorization = `Bearer ${key}`; // v4 read token
  else url.searchParams.set("api_key", key);                    // v3 key
  return { url, headers };
}

async function tmdb(path, params = {}) {
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const { url, headers } = authed(u);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = new Error(`TMDB ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function getMovie(id) {
  return tmdb(`/movie/${id}`, {
    append_to_response: "credits,videos,external_ids,release_dates,keywords,similar,watch/providers",
  });
}

async function getTV(id) {
  const show = await tmdb(`/tv/${id}`, {
    append_to_response: "credits,videos,external_ids,content_ratings,keywords,similar,watch/providers",
  });
  // TMDB allows up to 20 appended sub-requests per call, so fetch seasons in batches.
  const nums = show.seasons.map((s) => s.season_number);
  const seasons = [];
  for (let i = 0; i < nums.length; i += 20) {
    const batch = nums.slice(i, i + 20);
    const data = await tmdb(`/tv/${id}`, {
      append_to_response: batch.map((n) => `season/${n}`).join(","),
    });
    for (const n of batch) if (data[`season/${n}`]) seasons.push(data[`season/${n}`]);
  }
  return { ...show, seasons_full: seasons };
}

async function search(q) {
  const data = await tmdb("/search/multi", { query: q, include_adult: "false" });
  return {
    results: data.results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .map((r) => ({
        id: r.id,
        type: r.media_type,
        title: r.title || r.name,
        year: (r.release_date || r.first_air_date || "").slice(0, 4),
        poster: r.poster_path,
        overview: r.overview,
        rating: r.vote_average,
      })),
  };
}


// Whitelisted browse rows -> TMDB endpoints. Provider/region filters use /discover.
const ROWS = {
  trending_all:   { path: "/trending/all/day" },
  trending_movie: { path: "/trending/movie/week", type: "movie" },
  trending_tv:    { path: "/trending/tv/week", type: "tv" },
  popular_movie:  { path: "/movie/popular", type: "movie", disc: { sort_by: "popularity.desc" } },
  popular_tv:     { path: "/tv/popular", type: "tv", disc: { sort_by: "popularity.desc" } },
  top_movie:      { path: "/movie/top_rated", type: "movie", disc: { sort_by: "vote_average.desc", "vote_count.gte": "1500" } },
  top_tv:         { path: "/tv/top_rated", type: "tv", disc: { sort_by: "vote_average.desc", "vote_count.gte": "500" } },
  new_movie:      { path: "/movie/now_playing", type: "movie", disc: { sort_by: "primary_release_date.desc", "primary_release_date.lte": "TODAY", "vote_count.gte": "20" } },
  new_tv:         { path: "/tv/on_the_air", type: "tv", disc: { sort_by: "first_air_date.desc", "first_air_date.lte": "TODAY", "vote_count.gte": "10" } },
  anime:          { path: "/discover/tv", type: "tv", disc: { with_genres: "16", with_original_language: "ja", sort_by: "popularity.desc" }, always: true },
  genre_movie:    { path: "/discover/movie", type: "movie", disc: { sort_by: "popularity.desc" }, always: true },
  genre_tv:       { path: "/discover/tv", type: "tv", disc: { sort_by: "popularity.desc" }, always: true },
};

async function browse(key, qs) {
  const row = ROWS[key];
  if (!row) return null;
  const region = /^[A-Z]{2}$/.test(qs.region || "") ? qs.region : "US";
  const provider = /^\d+$/.test(qs.provider || "") ? qs.provider : "";
  const genre = /^\d+$/.test(qs.genre || "") ? qs.genre : "";
  const today = new Date().toISOString().slice(0, 10);
  let path = row.path, params = { page: /^\d+$/.test(qs.page || "") ? qs.page : "1", region, include_adult: "false" };
  if ((provider || row.always) && row.type) {
    path = row.path.startsWith("/discover") ? row.path : `/discover/${row.type}`;
    for (const [k, v] of Object.entries(row.disc || {})) params[k] = v === "TODAY" ? today : v;
    if (provider) { params.with_watch_providers = provider; params.watch_region = region; params.with_watch_monetization_types = "flatrate"; }
  }
  if (genre) params.with_genres = genre;
  const data = await tmdb(path, params);
  return {
    results: data.results
      .filter((r) => (r.media_type || row.type) === "movie" || (r.media_type || row.type) === "tv")
      .map((r) => {
        const type = r.media_type || row.type;
        return {
          id: r.id, type, title: r.title || r.name,
          year: (r.release_date || r.first_air_date || "").slice(0, 4),
          poster: r.poster_path, backdrop: r.backdrop_path,
          overview: r.overview, rating: r.vote_average,
        };
      }),
  };
}

exports.handler = async (event) => {
  if (!process.env.TMDB_API_KEY) return json(500, { error: "TMDB_API_KEY not set" }, 0);
  // Netlify may pass either the original /api/... path or the rewritten function path.
  const parts = event.path.replace(/^\/(?:\.netlify\/functions\/tmdb|api)\/?/, "").split("/").filter(Boolean);
  try {
    if (parts[0] === "search") {
      const q = (event.queryStringParameters?.q || "").trim();
      if (!q) return json(400, { error: "missing q" }, 0);
      return json(200, await search(q), 3600);
    }
    if (parts[0] === "browse" && parts[1]) {
      const data = await browse(parts[1], event.queryStringParameters || {});
      return data ? json(200, data, 3600) : json(404, { error: "unknown row" }, 0);
    }
    if ((parts[0] === "movie" || parts[0] === "tv") && /^\d+$/.test(parts[1] || "")) {
      const data = parts[0] === "movie" ? await getMovie(parts[1]) : await getTV(parts[1]);
      return json(200, data, 86400);
    }
    return json(404, { error: "not found" }, 0);
  } catch (e) {
    return json(e.status || 502, { error: e.message }, 0);
  }
};

function json(status, body, ttl) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      // Netlify's CDN caches successful lookups so repeat views are instant.
      "cache-control": ttl ? `public, max-age=300` : "no-store",
      ...(ttl ? { "netlify-cdn-cache-control": `public, s-maxage=${ttl}, stale-while-revalidate=604800` } : {}),
    },
    body: JSON.stringify(body),
  };
}
