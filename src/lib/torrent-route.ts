/** Keep magnet query separators intact when Expo Router parses the player route. */
export function encodeTorrentMagnet(uri: string): string {
  return encodeURIComponent(uri).replace(/~/g, "%7E").replace(/%/g, "~");
}

export function decodeTorrentMagnet(value: string): string {
  try {
    return decodeURIComponent(value.replace(/~/g, "%"));
  } catch {
    return "";
  }
}
