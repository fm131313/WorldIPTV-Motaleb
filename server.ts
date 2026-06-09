/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import http from "http";
import https from "https";
import { createServer as createViteServer } from "vite";
import { STABLE_CHANNELS } from "./src/seedChannels";
import { IPTVChannel, EPGItem, PlaybackHistory, UserFavorite } from "./src/types";

// Setup storage directories for persistent data
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FAVORITES_FILE = path.join(DATA_DIR, "favorites.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const PLAYLISTS_FILE = path.join(DATA_DIR, "playlists.json");

// Local cache file for downloaded IPTV-org dataset
const IPTv_CACHE_FILE = path.join(DATA_DIR, "iptv_cache.json");

// Country code → full name mapping
const COUNTRY_NAMES: Record<string, string> = {
  AF:"Afghanistan",AL:"Albania",DZ:"Algeria",AD:"Andorra",AO:"Angola",AG:"Antigua and Barbuda",AR:"Argentina",AM:"Armenia",AU:"Australia",AT:"Austria",AZ:"Azerbaijan",BS:"Bahamas",BH:"Bahrain",BD:"Bangladesh",BB:"Barbados",BY:"Belarus",BE:"Belgium",BZ:"Belize",BJ:"Benin",BT:"Bhutan",BO:"Bolivia",BA:"Bosnia and Herzegovina",BW:"Botswana",BR:"Brazil",BN:"Brunei",BG:"Bulgaria",BF:"Burkina Faso",BI:"Burundi",CV:"Cabo Verde",KH:"Cambodia",CM:"Cameroon",CA:"Canada",CF:"Central African Republic",TD:"Chad",CL:"Chile",CN:"China",CO:"Colombia",KM:"Comoros",CG:"Congo",CR:"Costa Rica",HR:"Croatia",CU:"Cuba",CY:"Cyprus",CZ:"Czech Republic",DK:"Denmark",DJ:"Djibouti",DO:"Dominican Republic",CD:"DR Congo",EC:"Ecuador",EG:"Egypt",SV:"El Salvador",GQ:"Equatorial Guinea",ER:"Eritrea",EE:"Estonia",SZ:"Eswatini",ET:"Ethiopia",FJ:"Fiji",FI:"Finland",FR:"France",GA:"Gabon",GM:"Gambia",GE:"Georgia",DE:"Germany",GH:"Ghana",GR:"Greece",GT:"Guatemala",GN:"Guinea",GW:"Guinea-Bissau",GY:"Guyana",HT:"Haiti",HN:"Honduras",HU:"Hungary",IS:"Iceland",IN:"India",ID:"Indonesia",IR:"Iran",IQ:"Iraq",IE:"Ireland",IL:"Israel",IT:"Italy",JM:"Jamaica",JP:"Japan",JO:"Jordan",KZ:"Kazakhstan",KE:"Kenya",KW:"Kuwait",KG:"Kyrgyzstan",LA:"Laos",LV:"Latvia",LB:"Lebanon",LS:"Lesotho",LR:"Liberia",LY:"Libya",LI:"Liechtenstein",LT:"Lithuania",LU:"Luxembourg",MG:"Madagascar",MW:"Malawi",MY:"Malaysia",MV:"Maldives",ML:"Mali",MT:"Malta",MR:"Mauritania",MU:"Mauritius",MX:"Mexico",MD:"Moldova",MC:"Monaco",MN:"Mongolia",ME:"Montenegro",MA:"Morocco",MZ:"Mozambique",MM:"Myanmar",NA:"Namibia",NP:"Nepal",NL:"Netherlands",NZ:"New Zealand",NI:"Nicaragua",NE:"Niger",NG:"Nigeria",MK:"North Macedonia",NO:"Norway",OM:"Oman",PK:"Pakistan",PA:"Panama",PG:"Papua New Guinea",PY:"Paraguay",PE:"Peru",PH:"Philippines",PL:"Poland",PT:"Portugal",QA:"Qatar",RO:"Romania",RU:"Russia",RW:"Rwanda",WS:"Samoa",SM:"San Marino",SA:"Saudi Arabia",SN:"Senegal",RS:"Serbia",SL:"Sierra Leone",SG:"Singapore",SK:"Slovakia",SI:"Slovenia",SO:"Somalia",ZA:"South Africa",SS:"South Sudan",ES:"Spain",LK:"Sri Lanka",SD:"Sudan",SR:"Suriname",SE:"Sweden",CH:"Switzerland",SY:"Syria",TW:"Taiwan",TJ:"Tajikistan",TZ:"Tanzania",TH:"Thailand",TL:"Timor-Leste",TG:"Togo",TT:"Trinidad and Tobago",TN:"Tunisia",TR:"Turkey",TM:"Turkmenistan",UG:"Uganda",UA:"Ukraine",AE:"United Arab Emirates",GB:"United Kingdom",US:"United States",UY:"Uruguay",UZ:"Uzbekistan",VE:"Venezuela",VN:"Vietnam",YE:"Yemen",ZM:"Zambia",ZW:"Zimbabwe",
};

// Global in-memory cache
let channelsCollection: IPTVChannel[] = [...STABLE_CHANNELS];
let iptvOrgLoaded = false;

// Initialize file resources
const readJsonFile = <T>(filePath: string, defaultVal: T): T => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return defaultVal;
};

const writeJsonFile = <T>(filePath: string, data: T): void => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
};

// Helper: Custom M3U parser
function parseM3uContent(content: string): IPTVChannel[] {
  const lines = content.split(/\r?\n/);
  const channels: IPTVChannel[] = [];
  let currentMeta: {
    name: string;
    logo?: string;
    country: string;
    countryCode: string;
    category: string;
    language: string;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      // Parse EXTINF metadata
      // e.g. #EXTINF:-1 tvg-id="AlJazeera.qa" tvg-logo="https://..." group-title="News",Al Jazeera English
      const nameMatch = line.match(/,(.+)$/);
      const name = nameMatch ? nameMatch[1].trim() : "Unnamed Stream";

      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const logo = logoMatch ? logoMatch[1] : undefined;

      const groupMatch = line.match(/group-title="([^"]+)"/);
      const category = groupMatch ? groupMatch[1] : "General";

      const countryMatch = line.match(/tvg-country="([^"]+)"/) || line.match(/country="([^"]+)"/);
      const countryCode = countryMatch ? countryMatch[1].toUpperCase() : "US";
      
      let country = "Imported";
      if (countryCode === "BD") country = "Bangladesh";
      else if (countryCode === "US") country = "United States";
      else if (countryCode === "GB") country = "United Kingdom";

      const languageMatch = line.match(/tvg-language="([^"]+)"/) || line.match(/language="([^"]+)"/);
      const language = languageMatch ? languageMatch[1] : "English";

      currentMeta = {
        name,
        logo,
        country,
        countryCode,
        category,
        language
      };
    } else if (line.startsWith("http://") || line.startsWith("https://")) {
      if (currentMeta) {
        const ext = line.split("?")[0].split(".").pop() || "";
        const id = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        channels.push({
          id,
          name: currentMeta.name,
          logo: currentMeta.logo,
          country: currentMeta.country,
          countryCode: currentMeta.countryCode,
          category: currentMeta.category,
          language: currentMeta.language,
          streamUrl: line,
          resolution: ext.includes("m3u8") ? "Auto" : "HD",
          isHealthy: true
        });
        currentMeta = null;
      }
    }
  }
  return channels;
}

// Background task to load the vast database of IPTV-org
async function loadIptvOrgData() {
  console.log("Starting background loading of IPTV-org channels...");
  try {
    // We fetch official stable lists from public iptv-org raw streams or verified indexes
    // To make it incredibly reliable and avoid rate limits, we use streams.json and channels.json.
    // If we have local cache, we read it first!
    if (fs.existsSync(IPTv_CACHE_FILE)) {
      const cached = readJsonFile<IPTVChannel[]>(IPTv_CACHE_FILE, []);
      if (cached.length > 0) {
        channelsCollection = [...STABLE_CHANNELS, ...cached.filter(c => !STABLE_CHANNELS.some(sc => sc.id === c.id))];
        iptvOrgLoaded = true;
        console.log(`Loaded ${channelsCollection.length} channels from local cache.`);
        // Don't stop here, try updating in background
      }
    }

    console.log("Fetching new data from iptv-org API...");
    // Fetch channels metadata and stream links
    const [streamsRes, channelsRes] = await Promise.all([
      fetch("https://iptv-org.github.io/api/streams.json").then(r => r.json()).catch(() => []),
      fetch("https://iptv-org.github.io/api/channels.json").then(r => r.json()).catch(() => [])
    ]);

    if (Array.isArray(streamsRes) && streamsRes.length > 0 && Array.isArray(channelsRes) && channelsRes.length > 0) {
      console.log(`Downloaded ${streamsRes.length} streams and ${channelsRes.length} channels.`);
      
      // Index channels by ID for fast lookup
      const channelMap = new Map();
      channelsRes.forEach((ch: any) => {
        channelMap.set(ch.id, ch);
      });

      const parsedChannels: IPTVChannel[] = [];
      
      // We process streams and map to full channel objects
      streamsRes.forEach((stream: any) => {
        if (!stream.channel || !stream.url) return;
        const channelMeta = channelMap.get(stream.channel);
        if (!channelMeta) return;

        // Map category
        let category = "General";
        if (channelMeta.categories && channelMeta.categories.length > 0) {
          const cat = channelMeta.categories[0].toLowerCase();
          if (cat.includes("news")) category = "News";
          else if (cat.includes("sport")) category = "Sports";
          else if (cat.includes("movie") || cat.includes("film") || cat.includes("entertainment")) category = "Movies";
          else if (cat.includes("kids") || cat.includes("animation")) category = "Kids";
          else if (cat.includes("music")) category = "Music";
          else if (cat.includes("religious") || cat.includes("spiritual")) category = "Religion";
          else category = cat.charAt(0).toUpperCase() + cat.slice(1);
        }

        const countryCode = (channelMeta.country || "US").toUpperCase();
        let country = COUNTRY_NAMES[countryCode] || channelMeta.country || "International";

        const language = channelMeta.languages && channelMeta.languages.length > 0 ? channelMeta.languages[0] : "English";

        // Filter out obviously outdated or blocked URLs
        if (stream.url.startsWith("rtsp") || stream.url.includes("paywall")) return;

        parsedChannels.push({
          id: `iptvorg-${channelMeta.id}`,
          name: channelMeta.name,
          logo: channelMeta.logo || undefined,
          country,
          countryCode,
          category,
          language: language.charAt(0).toUpperCase() + language.slice(1),
          streamUrl: stream.url,
          bitrate: stream.bitrate || undefined,
          resolution: stream.height ? `${stream.height}p` : undefined,
          isHealthy: true
        });
      });

      // Save to cache
      if (parsedChannels.length > 0) {
        writeJsonFile(IPTv_CACHE_FILE, parsedChannels);
        // Merge without duplicate IDs
        const existingIds = new Set(STABLE_CHANNELS.map(c => c.id));
        const finalCollection = [...STABLE_CHANNELS];
        
        parsedChannels.forEach(c => {
          if (!existingIds.has(c.id)) {
            finalCollection.push(c);
            existingIds.add(c.id);
          }
        });

        channelsCollection = finalCollection;
        iptvOrgLoaded = true;
        console.log(`Success! Channel database initialized with ${channelsCollection.length} total channels.`);
      }
    } else {
      console.warn("Could not download channels from API, operating with seeded dataset.");
    }
  } catch (error) {
    console.error("Error downloading IPTV-org dataset:", error);
  }
}

// Fire background load
loadIptvOrgData();

async function startServer() {
  const app = express();
  const PORT = 5000;

  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true, limit: "20mb" }));

  // --- API ROUTES ---

  // Health-check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "online",
      channelsCount: channelsCollection.length,
      iptvOrgLoaded,
      timestamp: new Date().toISOString()
    });
  });

  // Fetch list of countries (Bangladesh prioritized at very first position)
  app.get("/api/countries", (req, res) => {
    const tally: Record<string, { code: string; name: string; count: number }> = {};
    
    channelsCollection.forEach((ch) => {
      const code = ch.countryCode;
      const name = ch.country || code;
      if (!tally[code]) {
        tally[code] = { code, name, count: 0 };
      }
      tally[code].count += 1;
    });

    const countryList = Object.values(tally);
    
    // Sort logic: Bangladesh ALWAYS first, then others by name
    countryList.sort((a, b) => {
      if (a.code === "BD") return -1;
      if (b.code === "BD") return 1;
      return a.name.localeCompare(b.name);
    });

    res.json(countryList);
  });

  // Fetch list of categories
  app.get("/api/categories", (req, res) => {
    const tally: Record<string, number> = {};
    channelsCollection.forEach((ch) => {
      const cat = ch.category || "General";
      tally[cat] = (tally[cat] || 0) + 1;
    });

    const categoryList = Object.entries(tally).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count); // Sorted by size

    res.json(categoryList);
  });

  // Get filtered channels with Bangladesh prioritization
  app.get("/api/channels", (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.toLowerCase() : "";
    const countryCode = typeof req.query.country === "string" ? req.query.country.toUpperCase() : "";
    const category = typeof req.query.category === "string" ? req.query.category.toLowerCase() : "";
    const language = typeof req.query.language === "string" ? req.query.language.toLowerCase() : "";
    
    // pagination params
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "40", 10);
    const offset = (page - 1) * limit;

    let results = [...channelsCollection];

    // Filter by criteria
    if (search) {
      results = results.filter(
        (ch) =>
          ch.name.toLowerCase().includes(search) ||
          ch.country.toLowerCase().includes(search) ||
          ch.category.toLowerCase().includes(search) ||
          ch.language.toLowerCase().includes(search)
      );
    }

    if (countryCode) {
      results = results.filter((ch) => ch.countryCode === countryCode);
    }

    if (category) {
      results = results.filter((ch) => ch.category.toLowerCase() === category);
    }

    if (language) {
      results = results.filter((ch) => ch.language.toLowerCase() === language);
    }

    // Default Sorting Strategy:
    // If we're performing a general search/browse, sort BD channels first, then by name
    if (!countryCode) {
      results.sort((a, b) => {
        const aIsBD = a.countryCode === "BD" ? 1 : 0;
        const bIsBD = b.countryCode === "BD" ? 1 : 0;
        if (aIsBD !== bIsBD) {
          return bIsBD - aIsBD; // BD higher
        }
        return a.name.localeCompare(b.name);
      });
    } else {
      results.sort((a, b) => a.name.localeCompare(b.name));
    }

    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    res.json({
      channels: paginatedResults,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  });

  // Get channels details
  app.get("/api/channels/:id", (req, res) => {
    const channel = channelsCollection.find((ch) => ch.id === req.params.id);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    res.json(channel);
  });

  // --- USER FAVORITES (Server-persisted) ---
  app.get("/api/favorites", (req, res) => {
    const favorites = readJsonFile<UserFavorite[]>(FAVORITES_FILE, []);
    const favChannelIds = new Set(favorites.map((f) => f.channelId));
    
    // Find all channels matching the favorites list
    const favChannels = channelsCollection.filter((c) => favChannelIds.has(c.id));
    res.json(favChannels);
  });

  app.post("/api/favorites", (req, res) => {
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    let favorites = readJsonFile<UserFavorite[]>(FAVORITES_FILE, []);
    if (!favorites.some((f) => f.channelId === channelId)) {
      favorites.push({
        channelId,
        addedAt: new Date().toISOString()
      });
      writeJsonFile(FAVORITES_FILE, favorites);
    }

    res.json({ success: true, message: "Added to favorites" });
  });

  app.delete("/api/favorites/:channelId", (req, res) => {
    const { channelId } = req.params;
    let favorites = readJsonFile<UserFavorite[]>(FAVORITES_FILE, []);
    const originalLength = favorites.length;
    favorites = favorites.filter((f) => f.channelId !== channelId);
    
    if (favorites.length !== originalLength) {
      writeJsonFile(FAVORITES_FILE, favorites);
    }

    res.json({ success: true, message: "Removed from favorites" });
  });

  // --- PLAYBACK HISTORY ---
  app.get("/api/history", (req, res) => {
    const history = readJsonFile<PlaybackHistory[]>(HISTORY_FILE, []);
    // Map to actual channels (keep latest first)
    const historyMap = new Map(history.map(h => [h.channelId, h.playedAt]));
    
    const playedChannels = channelsCollection
      .filter((c) => historyMap.has(c.id))
      .map((c) => ({
        ...c,
        playedAt: historyMap.get(c.id)
      }))
      .sort((a: any, b: any) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

    res.json(playedChannels);
  });

  app.post("/api/history", (req, res) => {
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    let history = readJsonFile<PlaybackHistory[]>(HISTORY_FILE, []);
    // Remove previous entry for same channel to push to top
    history = history.filter((h) => h.channelId !== channelId);
    history.push({
      channelId,
      playedAt: new Date().toISOString()
    });

    // Keep history bounded to 50 items
    if (history.length > 50) {
      history.shift();
    }

    writeJsonFile(HISTORY_FILE, history);
    res.json({ success: true });
  });

  // --- CUSTOM PLAYLIST IMPORT / EXPORT ---
  app.post("/api/playlists/import", (req, res) => {
    const { text, url } = req.body;
    let rawContent = "";

    if (text) {
      rawContent = text;
    } else if (url) {
      // Not handling external fetching on client requests directly here for stability,
      // but we can parse submitted text representation instantly.
      return res.status(400).json({ error: "Please provide the playlist content directly as text." });
    }

    if (!rawContent || !rawContent.includes("#EXTM3U")) {
      return res.status(400).json({ error: "Invalid M3U playlist. Must start with #EXTM3U" });
    }

    try {
      const parsed = parseM3uContent(rawContent);
      if (parsed.length === 0) {
        return res.status(400).json({ error: "No channels found in M3U file." });
      }

      // Add to main memory and save persistence
      const customPlaylists = readJsonFile<IPTVChannel[]>(PLAYLISTS_FILE, []);
      const mergedList = [...customPlaylists];
      
      parsed.forEach((importedChan) => {
        if (!mergedList.some(c => c.streamUrl === importedChan.streamUrl)) {
          mergedList.push(importedChan);
          channelsCollection.push(importedChan);
        }
      });

      writeJsonFile(PLAYLISTS_FILE, mergedList);
      res.json({ success: true, count: parsed.length, channels: parsed });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to parse playlist: ${err.message}` });
    }
  });

  // Get imported channels
  app.get("/api/playlists/imported", (req, res) => {
    const customPlaylists = readJsonFile<IPTVChannel[]>(PLAYLISTS_FILE, []);
    res.json(customPlaylists);
  });

  // Export favorited playlist in direct M3U string format!
  app.get("/api/playlists/export/favorites.m3u", (req, res) => {
    const favorites = readJsonFile<UserFavorite[]>(FAVORITES_FILE, []);
    const favIds = new Set(favorites.map(f => f.channelId));
    const favChannels = channelsCollection.filter(c => favIds.has(c.id));

    let m3u = "#EXTM3U\n";
    favChannels.forEach((c) => {
      m3u += `#EXTINF:-1 tvg-id="${c.id}" tvg-name="${c.name}" tvg-logo="${c.logo || ""}" tvg-country="${c.countryCode}" tvg-language="${c.language}" group-title="${c.category}",${c.name}\n`;
      m3u += `${c.streamUrl}\n`;
    });

    res.setHeader("Content-Disposition", "attachment; filename=favorites.m3u");
    res.setHeader("Content-Type", "audio/x-mpegurl");
    res.send(m3u);
  });

  // Stream Health Check & Latency Ping
  app.get("/api/health-check", async (req, res) => {
    const streamUrl = req.query.url as string;
    if (!streamUrl) {
      return res.status(400).json({ error: "Stream URL is required" });
    }

    try {
      const targetUrl = new URL(streamUrl);
      const isHttps = targetUrl.protocol === "https:";
      const lib = isHttps ? https : http;

      const startTime = Date.now();
      const requestOptions = {
        method: "GET",
        timeout: 4000,
        headers: {
          "User-Agent": "Mozilla/5.0 IPTV-Checker/1.0"
        }
      };

      const healthRequest = lib.request(streamUrl, requestOptions, (checkRes) => {
        const statusCode = checkRes.statusCode || 500;
        const latencyMs = Date.now() - startTime;
        const isHealthy = statusCode >= 200 && statusCode < 400;
        
        // Find in memory collection to update health
        const matched = channelsCollection.find(c => c.streamUrl === streamUrl);
        if (matched) {
          matched.isHealthy = isHealthy;
          matched.latencyMs = latencyMs;
          matched.lastChecked = new Date().toISOString();
        }

        res.json({
          url: streamUrl,
          statusCode,
          isHealthy,
          latencyMs,
          statusMessage: checkRes.statusMessage || "OK"
        });
      });

      healthRequest.on("error", (err) => {
        const matched = channelsCollection.find(c => c.streamUrl === streamUrl);
        if (matched) {
          matched.isHealthy = false;
          matched.latencyMs = undefined;
          matched.lastChecked = new Date().toISOString();
        }
        res.json({ url: streamUrl, isHealthy: false, error: err.message });
      });

      healthRequest.on("timeout", () => {
        healthRequest.destroy();
        const matched = channelsCollection.find(c => c.streamUrl === streamUrl);
        if (matched) {
          matched.isHealthy = false;
          matched.lastChecked = new Date().toISOString();
        }
        res.json({ url: streamUrl, isHealthy: false, error: "Connection timed out" });
      });

      healthRequest.end();

    } catch (err: any) {
      res.json({ url: streamUrl, isHealthy: false, error: `Invalid stream URL: ${err.message}` });
    }
  });

  // Get Mock EPG guide data for any channel in real or local time!
  app.get("/api/epg/:channelId", (req, res) => {
    const { channelId } = req.params;
    const channel = channelsCollection.find(c => c.id === channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // Generate dynamic EPG schedule for today based on current hour
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const schedules: EPGItem[] = [];
    const showNames = [
      "Good Morning Bangladesh",
      "World News Briefing",
      "Special Documentary Special",
      "Midday News Round",
      "Talk Show Forum Live",
      "Afternoon Sports Highlights",
      "National Golden Awards",
      "Prime Time Regional News Hour",
      "Blockbuster Evening Presentation",
      "Late Night Current Affairs Analysis",
      "Cultural Resonance Performance"
    ];

    const movieShowNames = [
      "Classic Hollywood Feature film",
      "Action Blockbuster of the Week",
      "Retro Film Festival Special",
      "Sci-Fi Odyssey Night",
      "Thriller Hour Special Edition"
    ];

    const kidsShowNames = [
      "Good Morning Cartoons Hour",
      "Creative Balloon Making Show",
      "Educational Tales with Puppets",
      "Happy Jump Adventures",
      "The Bedtime Lullaby Show"
    ];

    const sportsShowNames = [
      "Extreme Action Sports Live",
      "Wreckage and Records Championship",
      "Interactive Arena Debates",
      "Red Bull Adventure Legends",
      "Weekly Combat Showdowns"
    ];

    let sourceNames = showNames;
    if (channel.category === "Movies") sourceNames = movieShowNames;
    else if (channel.category === "Kids") sourceNames = kidsShowNames;
    else if (channel.category === "Sports") sourceNames = sportsShowNames;

    // Build 2-hour EPG blocks for 24 hours
    for (let h = 0; h < 24; h += 2) {
      const itemStart = new Date(startOfToday.getTime() + h * 60 * 60 * 1000);
      const itemEnd = new Date(startOfToday.getTime() + (h + 2) * 60 * 60 * 1000);
      
      const showIdx = (channelId.charCodeAt(0) + h) % sourceNames.length;
      const title = sourceNames[showIdx];
      
      schedules.push({
        id: `epg-${channelId}-${h}`,
        channelId,
        title,
        description: `This is a high definition playback of ${title} brought to you by ${channel.name}. Broadcasting live stream to all viewers globally.`,
        start: itemStart.toISOString(),
        end: itemEnd.toISOString()
      });
    }

    res.json(schedules);
  });

  // Load imported channels from playlists.json at startup to ensure persistence!
  try {
    const customPlaylists = readJsonFile<IPTVChannel[]>(PLAYLISTS_FILE, []);
    customPlaylists.forEach((importedChan) => {
      if (!channelsCollection.some(c => c.id === importedChan.id)) {
        channelsCollection.push(importedChan);
      }
    });
    console.log(`Loaded ${customPlaylists.length} persisted custom playlist channels.`);
  } catch (err) {
    console.warn("Could not reload custom playlists file.", err);
  }

  // --- VITE MIDDLEWARE CONFIGURATION ---
  if (process.env.NODE_ENV !== "production") {
    // DEV MODE
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // PRODUCTION BUILD SERVING
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Express Backend] Live television platform running on http://0.0.0.0:${PORT}`);
    console.log(`[Environment] NODE_ENV = ${process.env.NODE_ENV || "development"}`);
  });
}

startServer().catch((err) => {
  console.error("FATAL: Failed to launch backend Express server:", err);
});
