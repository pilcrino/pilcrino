import { randomBytes } from 'node:crypto'
import * as nodeFs from 'node:fs'
import { resolveOutFile } from './paths.mjs'

/**
 * The serp_search tool: one Google search through the Pilcrino extension in
 * the owner's browser (bridge.mjs), written to outFile as the one JSON object
 * both research skills read. The capture never enters the tool result.
 */

/** The search URL the extension opens: the marker is a query parameter, since Google drops fragments when it rewrites the address. */
export function buildSearchUrl(query, { hl, gl } = {}, token) {
  const u = new URL('https://www.google.com/search')
  u.searchParams.set('q', query)
  if (hl) u.searchParams.set('hl', hl)
  if (gl) u.searchParams.set('gl', gl)
  u.searchParams.set('pilcrino', token)
  return u.toString()
}

/** 128 random bits, base64url: single use, one search. */
export const newToken = () => randomBytes(16).toString('base64url')

export async function serpSearchTool(bridge, { query, outFile, locale }, ctx) {
  // The path is checked first, so a bad path never reaches the extension.
  const path = resolveOutFile(outFile, ctx.roots, { profile: ctx.profile, fs: ctx.fs })
  const token = newToken()
  const { value } = await bridge.search({ url: buildSearchUrl(String(query), locale ?? {}, token), token })
  const body = { engine: 'google', ...(value ?? {}) }
  const text = JSON.stringify(body, null, 2)
  ;(ctx.fs ?? nodeFs).writeFileSync(path, text)
  const res = { path, bytes: Buffer.byteLength(text), items: 1, engine: 'google' }
  if (body.blocked) res.blocked = true
  return res
}
