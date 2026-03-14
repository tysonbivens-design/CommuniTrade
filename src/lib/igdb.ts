// src/lib/igdb.ts
// Server-side only — never import this in client components.
// Handles Twitch OAuth token caching and IGDB game cover lookups.

let cachedToken: string | null = null
let tokenExpiry = 0

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.IGDB_CLIENT_ID}&client_secret=${process.env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  )
  if (!res.ok) throw new Error('Failed to get IGDB token')
  const data = await res.json()
  cachedToken = data.access_token
  // Expire 60s early to be safe
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken!
}

export interface IGDBResult {
  cover_url: string | null
  year: number | null
  genres: string[]
}

export async function fetchGameCover(title: string): Promise<IGDBResult> {
  const token = await getAccessToken()

  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': process.env.IGDB_CLIENT_ID!,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body: `search "${title}"; fields name,cover.image_id,first_release_date,genres.name; limit 1;`,
  })

  if (!res.ok) throw new Error('IGDB request failed')
  const games = await res.json()
  const game = games?.[0]
  if (!game) return { cover_url: null, year: null, genres: [] }

  const cover_url = game.cover?.image_id
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
    : null

  const year = game.first_release_date
    ? new Date(game.first_release_date * 1000).getFullYear()
    : null

  const genres: string[] = game.genres?.map((g: { name: string }) => g.name) ?? []

  return { cover_url, year, genres }
}
