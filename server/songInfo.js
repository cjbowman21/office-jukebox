const DEFAULT_AUDIO_DB_KEY = '123';
const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const WIKIPEDIA_SEARCH_URL = 'https://en.wikipedia.org/w/rest.php/v1/search/page';
const WIKIPEDIA_SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const AUDIO_DB_BASE_URL = 'https://www.theaudiodb.com/api/v1/json';

const SOURCE_TIMEOUT_MS = 6500;
const MAX_CARD_LENGTH = 520;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeTrack(track = {}) {
  const artists = Array.isArray(track.artists)
    ? track.artists.map((artist) => normalizeText(artist.name)).filter(Boolean)
    : [];

  return {
    id: normalizeText(track.id),
    name: normalizeText(track.name),
    artists,
    artistName: artists[0] || '',
    albumName: normalizeText(track.album?.name || track.albumName),
    isrc: normalizeText(track.external_ids?.isrc || track.isrc).toUpperCase(),
    spotifyUrl: normalizeText(track.external_urls?.spotify || track.spotifyUrl),
  };
}

function firstSentences(text, maxLength = MAX_CARD_LENGTH) {
  const clean = normalizeText(text)
    .replace(/\s*\([^)]*listen\)[^.]*/gi, '')
    .replace(/\s*<a\b[^>]*>.*?<\/a>/gi, '');

  if (!clean) {
    return '';
  }

  const sentences = clean.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [clean];
  let output = '';

  for (const sentence of sentences) {
    const candidate = `${output}${sentence}`.trim();
    if (candidate.length > maxLength && output) {
      break;
    }
    output = candidate;
    if (output.length >= 240) {
      break;
    }
  }

  if (output.length <= maxLength) {
    return output;
  }

  return `${output.slice(0, maxLength - 1).trim()}...`;
}

function makeUserAgent(env) {
  return env.ENRICHMENT_USER_AGENT
    || `office-jukebox/${env.npm_package_version || '0.1.0'} (${env.CLIENT_ORIGIN || 'local network app'})`;
}

function card(id, title, body, sourceName, sourceUrl) {
  const cleanBody = firstSentences(body);
  if (!cleanBody) {
    return null;
  }

  return {
    id,
    title,
    body: cleanBody,
    sourceName,
    sourceUrl,
  };
}

function fact(label, value, sourceName, sourceUrl) {
  const cleanValue = Array.isArray(value)
    ? value.map(normalizeText).filter(Boolean).join(', ')
    : normalizeText(value);

  if (!cleanValue) {
    return null;
  }

  return {
    label,
    value: cleanValue,
    sourceName,
    sourceUrl,
  };
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function compact(items) {
  return items.filter(Boolean);
}

function createRateLimitedRunner(intervalMs) {
  let queue = Promise.resolve();
  let nextRunAt = 0;

  return async (operation) => {
    const run = queue.then(async () => {
      const waitMs = Math.max(0, nextRunAt - Date.now());
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      nextRunAt = Date.now() + intervalMs;
      return operation();
    });

    queue = run.catch(() => {});
    return run;
  };
}

function sourceUrlForMusicBrainz(recording) {
  return recording?.id ? `https://musicbrainz.org/recording/${recording.id}` : 'https://musicbrainz.org/';
}

function scoreRecording(recording, track) {
  const recordingTitle = normalizeText(recording.title).toLowerCase();
  const trackTitle = track.name.toLowerCase();
  const albumTitle = track.albumName.toLowerCase();
  const artistCredit = (recording['artist-credit'] || [])
    .map((credit) => normalizeText(credit.name || credit.artist?.name).toLowerCase())
    .join(' ');
  const releaseTitles = (recording.releases || [])
    .map((release) => normalizeText(release.title).toLowerCase())
    .filter(Boolean);

  let score = 0;
  if (recordingTitle === trackTitle) {
    score += 4;
  } else if (recordingTitle.includes(trackTitle) || trackTitle.includes(recordingTitle)) {
    score += 2;
  }

  if (track.artistName && artistCredit.includes(track.artistName.toLowerCase())) {
    score += 3;
  }

  if (albumTitle && releaseTitles.some((releaseTitle) => releaseTitle === albumTitle)) {
    score += 4;
  } else if (albumTitle && releaseTitles.some((releaseTitle) => releaseTitle.includes(albumTitle) || albumTitle.includes(releaseTitle))) {
    score += 2;
  }

  if (recording['first-release-date']) {
    score += 1;
  }

  return score;
}

function pickBestRecording(recordings = [], track) {
  return [...recordings]
    .sort((left, right) => {
      const scoreDiff = scoreRecording(right, track) - scoreRecording(left, track);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return normalizeText(left['first-release-date'] || '9999')
        .localeCompare(normalizeText(right['first-release-date'] || '9999'));
    })[0] || null;
}

function quoteMusicBrainzQuery(value) {
  return `"${normalizeText(value).replace(/["\\]/g, ' ')}"`;
}

function parseMusicBrainzRecording(recording, track) {
  if (!recording) {
    return { cards: [], facts: [], links: [] };
  }

  const sourceUrl = sourceUrlForMusicBrainz(recording);
  const releases = Array.isArray(recording.releases) ? recording.releases : [];
  const relations = Array.isArray(recording.relations) ? recording.relations : [];
  const genres = Array.isArray(recording.genres) ? recording.genres.map((genre) => genre.name) : [];
  const tags = Array.isArray(recording.tags) ? recording.tags.map((tag) => tag.name) : [];

  const firstReleaseDate = recording['first-release-date']
    || releases.map((release) => release.date).filter(Boolean).sort()[0];

  const earliestRelease = releases
    .filter((release) => release.date)
    .sort((left, right) => left.date.localeCompare(right.date))[0];

  const releaseNames = uniqueBy(releases, (release) => normalizeText(release.title).toLowerCase())
    .slice(0, 3)
    .map((release) => release.title);

  const contributors = relations
    .filter((relation) => relation.artist && ['composer', 'lyricist', 'writer'].includes(relation.type))
    .map((relation) => `${relation.type}: ${relation.artist.name}`)
    .slice(0, 4);

  const releaseContextParts = compact([
    firstReleaseDate ? `MusicBrainz lists the first release date as ${firstReleaseDate}.` : '',
    earliestRelease?.title ? `An early matched release is ${earliestRelease.title}.` : '',
    releaseNames.length > 1 ? `Related releases include ${releaseNames.join(', ')}.` : '',
  ]);

  return {
    cards: compact([
      card('musicbrainz-release', 'Release Context', releaseContextParts.join(' '), 'MusicBrainz', sourceUrl),
    ]),
    facts: compact([
      fact('First release date', firstReleaseDate, 'MusicBrainz', sourceUrl),
      fact('MusicBrainz genres', genres.slice(0, 4), 'MusicBrainz', sourceUrl),
      fact('MusicBrainz tags', tags.slice(0, 4), 'MusicBrainz', sourceUrl),
      fact('Credits', contributors, 'MusicBrainz', sourceUrl),
    ]),
    links: compact([
      { label: 'MusicBrainz recording', url: sourceUrl },
    ]),
    track,
  };
}

async function fetchMusicBrainzRecording(requestJson, track) {
  if (track.isrc && /^[A-Z0-9-]+$/.test(track.isrc)) {
    const data = await requestJson(`${MUSICBRAINZ_BASE_URL}/isrc/${encodeURIComponent(track.isrc)}`, {
      params: {
        inc: 'artist-credits+releases+work-rels+artist-rels+genres+tags',
        fmt: 'json',
      },
    });
    return pickBestRecording(data.recordings, track);
  }

  if (!track.name || !track.artistName) {
    return null;
  }

  const baseQuery = `recording:${quoteMusicBrainzQuery(track.name)} AND artist:${quoteMusicBrainzQuery(track.artistName)}`;
  const queries = compact([
    track.albumName ? `${baseQuery} AND release:${quoteMusicBrainzQuery(track.albumName)}` : '',
    baseQuery,
  ]);

  for (const query of queries) {
    const data = await requestJson(`${MUSICBRAINZ_BASE_URL}/recording`, {
      params: {
        query,
        limit: 10,
        fmt: 'json',
      },
    });

    const bestRecording = pickBestRecording(data.recordings, track);
    if (bestRecording) {
      return bestRecording;
    }
  }

  return null;
}

function scoreWikipediaSummary(summary, track, kind) {
  const title = normalizeText(summary.title).toLowerCase();
  const description = normalizeText(summary.description).toLowerCase();
  const extract = normalizeText(summary.extract).toLowerCase();
  const artist = track.artistName.toLowerCase();
  const song = track.name.toLowerCase();

  if (summary.type === 'disambiguation') {
    return -10;
  }

  let score = 0;

  if (kind === 'song') {
    if (title.includes(song)) {
      score += 3;
    }
    if (description.includes('song') || description.includes('single') || description.includes('composition')) {
      score += 2;
    }
    if (artist && extract.includes(artist)) {
      score += 3;
    }
    if (title.includes('album') || description.includes('album')) {
      score -= 2;
    }
    return score;
  }

  if (title.includes(artist)) {
    score += 3;
  }
  if (description.match(/musician|singer|rapper|band|duo|group|artist|composer|songwriter/)) {
    score += 2;
  }
  if (extract.match(/musician|singer|rapper|band|duo|group|artist|composer|songwriter/)) {
    score += 1;
  }

  return score;
}

async function fetchWikipediaSummaryByTitle(requestJson, title) {
  const key = normalizeText(title).replace(/\s/g, '_');
  if (!key) {
    return null;
  }

  return requestJson(`${WIKIPEDIA_SUMMARY_URL}/${encodeURIComponent(key)}`);
}

async function searchWikipediaSummary(requestJson, query, track, kind) {
  const searchData = await requestJson(WIKIPEDIA_SEARCH_URL, {
    params: { q: query, limit: 5 },
  });

  const pages = Array.isArray(searchData.pages) ? searchData.pages : [];
  const summaries = [];

  for (const page of pages.slice(0, 4)) {
    try {
      const summary = await fetchWikipediaSummaryByTitle(requestJson, page.key || page.title);
      if (summary?.extract) {
        summaries.push(summary);
      }
    } catch (err) {
      // A single bad page match should not block the full panel.
    }
  }

  const scored = summaries
    .map((summary) => ({ summary, score: scoreWikipediaSummary(summary, track, kind) }))
    .sort((left, right) => right.score - left.score);

  return scored[0]?.score > 0 ? scored[0].summary : null;
}

function wikipediaLink(summary) {
  return summary?.content_urls?.desktop?.page || summary?.content_urls?.mobile?.page || '';
}

async function fetchWikipediaCards(requestJson, track) {
  const songQuery = `${track.name} ${track.artistName} song`;
  const artistQuery = `${track.artistName} musician`;

  const [songSummary, artistSummary] = await Promise.all([
    track.name && track.artistName
      ? searchWikipediaSummary(requestJson, songQuery, track, 'song').catch(() => null)
      : null,
    track.artistName
      ? searchWikipediaSummary(requestJson, artistQuery, track, 'artist').catch(() => null)
      : null,
  ]);

  return {
    cards: compact([
      card('wikipedia-song', 'About the Song', songSummary?.extract, 'Wikipedia', wikipediaLink(songSummary)),
      card('wikipedia-artist', 'Artist Background', artistSummary?.extract, 'Wikipedia', wikipediaLink(artistSummary)),
    ]),
    facts: compact([
      fact('Song article', songSummary?.title, 'Wikipedia', wikipediaLink(songSummary)),
      fact('Artist article', artistSummary?.title, 'Wikipedia', wikipediaLink(artistSummary)),
    ]),
    links: compact([
      songSummary && wikipediaLink(songSummary)
        ? { label: `${songSummary.title} on Wikipedia`, url: wikipediaLink(songSummary) }
        : null,
      artistSummary && wikipediaLink(artistSummary)
        ? { label: `${artistSummary.title} on Wikipedia`, url: wikipediaLink(artistSummary) }
        : null,
    ]),
  };
}

function audioDbUrl(type, id) {
  if (!id) {
    return 'https://www.theaudiodb.com/';
  }
  return `https://www.theaudiodb.com/${type}/${id}`;
}

function parseAudioDbData(trackData, artistData) {
  const audioTrack = Array.isArray(trackData?.track) ? trackData.track[0] : null;
  const audioArtist = Array.isArray(artistData?.artists) ? artistData.artists[0] : null;
  const trackUrl = audioDbUrl('track', audioTrack?.idTrack);
  const artistUrl = audioDbUrl('artist', audioArtist?.idArtist);

  return {
    cards: compact([
      card('audiodb-track', 'Track Notes', audioTrack?.strDescriptionEN, 'TheAudioDB', trackUrl),
      card('audiodb-artist', 'More on the Artist', audioArtist?.strBiographyEN, 'TheAudioDB', artistUrl),
    ]),
    facts: compact([
      fact('Genre', audioTrack?.strGenre || audioArtist?.strGenre, 'TheAudioDB', audioTrack ? trackUrl : artistUrl),
      fact('Style', audioTrack?.strStyle || audioArtist?.strStyle, 'TheAudioDB', audioTrack ? trackUrl : artistUrl),
      fact('Mood', audioTrack?.strMood, 'TheAudioDB', trackUrl),
      fact('Formed', audioArtist?.intFormedYear, 'TheAudioDB', artistUrl),
      fact('Country', audioArtist?.strCountry, 'TheAudioDB', artistUrl),
    ]),
    links: compact([
      audioTrack?.idTrack ? { label: 'TheAudioDB track', url: trackUrl } : null,
      audioArtist?.idArtist ? { label: 'TheAudioDB artist', url: artistUrl } : null,
    ]),
  };
}

async function fetchAudioDbData(requestJson, env, track) {
  const key = env.THEAUDIODB_API_KEY || DEFAULT_AUDIO_DB_KEY;
  const base = `${AUDIO_DB_BASE_URL}/${encodeURIComponent(key)}`;

  const [trackData, artistData] = await Promise.all([
    track.name && track.artistName
      ? requestJson(`${base}/searchtrack.php`, {
        params: { s: track.artistName, t: track.name },
      }).catch(() => null)
      : null,
    track.artistName
      ? requestJson(`${base}/search.php`, {
        params: { s: track.artistName },
      }).catch(() => null)
      : null,
  ]);

  return parseAudioDbData(trackData, artistData);
}

function mergeResults(results) {
  const cards = uniqueBy(
    results.flatMap((result) => result.cards || []),
    (item) => `${item.sourceName}:${item.title}:${item.body.slice(0, 80)}`
  ).slice(0, 5);

  const facts = uniqueBy(
    results.flatMap((result) => result.facts || []),
    (item) => `${item.label}:${item.value}`
  ).slice(0, 8);

  const links = uniqueBy(
    results.flatMap((result) => result.links || []),
    (item) => item.url
  ).slice(0, 8);

  return { cards, facts, links };
}

function createSongInfoClient({ axiosInstance, env = process.env } = {}) {
  if (!axiosInstance) {
    throw new Error('axiosInstance is required');
  }

  const userAgent = makeUserAgent(env);
  const runMusicBrainzRequest = createRateLimitedRunner(1000);

  async function requestJson(url, options = {}) {
    const response = await axiosInstance.get(url, {
      timeout: SOURCE_TIMEOUT_MS,
      ...options,
      headers: {
        Accept: 'application/json',
        'User-Agent': userAgent,
        ...(options.headers || {}),
      },
    });
    return response.data || {};
  }

  return {
    async getSongInfo(rawTrack) {
      const track = normalizeTrack(rawTrack);

      if (!track.name || !track.artistName) {
        throw new Error('Track name and artist are required.');
      }

      const [musicBrainzRecording, wikipediaData, audioDbData] = await Promise.all([
        fetchMusicBrainzRecording(
          (url, options) => runMusicBrainzRequest(() => requestJson(url, options)),
          track
        ).catch(() => null),
        fetchWikipediaCards(requestJson, track).catch(() => ({ cards: [], facts: [], links: [] })),
        fetchAudioDbData(requestJson, env, track).catch(() => ({ cards: [], facts: [], links: [] })),
      ]);

      const musicBrainzData = parseMusicBrainzRecording(musicBrainzRecording, track);
      const merged = mergeResults([wikipediaData, musicBrainzData, audioDbData]);

      return {
        track,
        cards: merged.cards,
        facts: merged.facts,
        links: merged.links,
        sources: ['Wikipedia', 'MusicBrainz', 'TheAudioDB'],
        retrievedAt: new Date().toISOString(),
      };
    },
  };
}

module.exports = {
  createSongInfoClient,
  normalizeTrack,
};
