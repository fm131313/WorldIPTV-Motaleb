/**
 * Static logo map for channels whose Wikipedia page title differs from their common name.
 * Keys are lowercase channel names. Values are Wikipedia page title overrides.
 * These are used to improve the Wikipedia REST API lookup accuracy.
 */
export const WIKI_TITLE_OVERRIDES: Record<string, string> = {
  // Bangladesh
  "ananda tv": "Ananda TV (Bangladesh)",
  "atn bangla": "ATN Bangla",
  "atn news": "ATN News (Bangladesh)",
  "bangla tv": "Bangla TV (Bangladesh)",
  "bangla vision": "Banglavision",
  "bijoy tv": "Bijoy TV",
  "boishakhi tv": "Boishakhi TV",
  "btv world": "Bangladesh Television",
  "btv national": "Bangladesh Television",
  "btv news": "Bangladesh Television",
  "btv chattogram": "Bangladesh Television",
  "channel i": "Channel i",
  "channel 24": "Channel 24 (Bangladesh)",
  "channel 9": "Channel 9 (Bangladesh)",
  "deepto tv": "Deepto TV",
  "desh tv": "Desh TV",
  "dbc news": "DBC News",
  "gtv": "Gazi Television",
  "gazi tv": "Gazi Television",
  "jamuna tv": "Jamuna Television",
  "maasranga tv": "Maasranga Television",
  "my tv": "My TV (Bangladesh)",
  "ntv": "NTV (Bangladesh)",
  "rtv": "RTV Bangladesh",
  "r tv": "RTV Bangladesh",
  "sa tv": "SA TV",
  "somoy tv": "Somoy TV",
  "somoy news tv": "Somoy TV",
  "independent tv": "Independent Television (Bangladesh)",
  // International
  "bbc world news": "BBC World News",
  "cnn international": "CNN International",
  "al jazeera english": "Al Jazeera English",
  "france 24": "France 24",
  "dw": "Deutsche Welle",
  "nhk world": "NHK World News",
  "euronews": "Euronews",
};

/**
 * Returns the best Wikipedia page title to use for a logo lookup.
 */
export function getWikiTitle(channelName: string): string {
  const key = channelName.toLowerCase().trim();
  return WIKI_TITLE_OVERRIDES[key] || channelName;
}
