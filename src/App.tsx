/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import {
  Tv,
  Heart,
  Search,
  Globe,
  Tag,
  Download,
  Info,
  Activity,
  History,
  Star,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  ListVideo
} from "lucide-react";
import { IPTVChannel, CountryMetadata, CategoryMetadata } from "./types";
import { STABLE_CHANNELS } from "./seedChannels";
import HLSLivePlayer from "./components/HLSLivePlayer";
import EPGSchedule from "./components/EPGSchedule";
import M3UPlaylistImporter from "./components/M3UPlaylistImporter";

export default function App() {
  // Navigation & Page State
  const [channels, setChannels] = useState<IPTVChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<IPTVChannel>(STABLE_CHANNELS[0]);
  const [countries, setCountries] = useState<CountryMetadata[]>([]);
  const [categories, setCategories] = useState<CategoryMetadata[]>([]);
  
  // Filtering & Pagination State
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingChannels, setLoadingChannels] = useState<boolean>(true);

  // User Space Sync
  const [favorites, setFavorites] = useState<IPTVChannel[]>([]);
  const [history, setHistory] = useState<IPTVChannel[]>([]);
  const [isFavorited, setIsFavorited] = useState<boolean>(false);

  // Layout Tab selection
  const [activeTab, setActiveTab] = useState<"channels" | "favorites" | "import">("channels");
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Fetch lists and collections
  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const url = new URL("/api/channels", window.location.origin);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("limit", "12");
      if (selectedCountry) url.searchParams.set("country", selectedCountry);
      if (selectedCategory) url.searchParams.set("category", selectedCategory);
      if (searchQuery) url.searchParams.set("search", searchQuery);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data && Array.isArray(data.channels)) {
        setChannels(data.channels);
        setTotalPages(data.pagination.totalPages || 1);
      }
    } catch (err) {
      console.error("Error loading channels API:", err);
      // Fallback local search if Express route fails
      setChannels(STABLE_CHANNELS);
    } finally {
      setLoadingChannels(false);
    }
  };

  const loadMetaData = async () => {
    try {
      const [countriesRes, categoriesRes] = await Promise.all([
        fetch("/api/countries").then((r) => r.json()),
        fetch("/api/categories").then((r) => r.json())
      ]);

      if (Array.isArray(countriesRes)) setCountries(countriesRes);
      if (Array.isArray(categoriesRes)) setCategories(categoriesRes);
    } catch (err) {
      console.error("Error loading filters metadata:", err);
    }
  };

  const loadFavorites = async () => {
    try {
      const res = await fetch("/api/favorites");
      const data = await res.json();
      if (Array.isArray(data)) {
        setFavorites(data);
        setIsFavorited(data.some((f) => f.id === activeChannel.id));
      }
    } catch (err) {
      console.error("Error reading favorites:", err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistory(data);
      }
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  // Sync state on startups
  useEffect(() => {
    loadMetaData();
    loadFavorites();
    loadHistory();
  }, []);

  // Reload channels grid on filter updates
  useEffect(() => {
    loadChannels();
  }, [selectedCountry, selectedCategory, searchQuery, page]);

  // Sync favorited button when selected active channel changes
  useEffect(() => {
    setIsFavorited(favorites.some((f) => f.id === activeChannel.id));
  }, [activeChannel, favorites]);

  // Favorite toggle action
  const toggleFavorite = async () => {
    try {
      if (isFavorited) {
        const res = await fetch(`/api/favorites/${activeChannel.id}`, { method: "DELETE" });
        if (res.ok) {
          setFavorites(favorites.filter((f) => f.id !== activeChannel.id));
          setIsFavorited(false);
        }
      } else {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeChannel.id })
        });
        if (res.ok) {
          setFavorites([...favorites, activeChannel]);
          setIsFavorited(true);
        }
      }
    } catch (err) {
      console.error("Could not toggle favorite stream:", err);
    }
  };

  // Handle custom M3U post action
  const handlePlaylistImportSuccess = (count: number) => {
    setImportNotice(`Successfully uploaded custom playlist containing ${count} streams! Check the catalog tab.`);
    loadMetaData();
    loadChannels();
    setTimeout(() => setImportNotice(null), 6000);
  };

  // Trigger downloading favorite list as a valid M3U file
  const downloadFavoritesM3U = () => {
    window.open("/api/playlists/export/favorites.m3u", "_blank");
  };

  // Helper: display country flag or general earth logo
  const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return "📡";
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) =>  127397 + char.charCodeAt(0));
    try {
      return String.fromCodePoint(...codePoints);
    } catch {
      return "📡";
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      
      {/* HEADER HUD BAR */}
      <header className="sticky top-0 z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800/80 shadow-lg px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-pink-600 to-red-500 flex items-center justify-center shadow-lg shadow-indigo-505/20 border border-white/10">
              <Tv className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg md:text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                IPTV Live-TV Platform
              </h1>
              <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase">
                Globally Managed Channels • Bangladesh Priority
              </p>
            </div>
          </div>

          {/* Search HUD bar */}
          <div className="relative w-full md:max-w-md">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              id="search-input-field"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1); // Reset page on query change
              }}
              placeholder="Search worldwide channels by name, category, or country..."
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
            />
          </div>

          {/* Connected Badge */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-full border border-emerald-900/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 live-pulse" />
              Live DB Indexer
            </span>
          </div>
        </div>
      </header>

      {/* SUCCESS POPUP ALERT */}
      {importNotice && (
        <div className="bg-emerald-900 border-b border-emerald-800 text-white text-xs px-6 py-2.5 text-center flex items-center justify-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-300" />
          <span className="font-medium">{importNotice}</span>
        </div>
      )}

      {/* DASHBOARD CORE CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: ACTIVE PLAYER STAGE (7 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Video Viewport */}
          <HLSLivePlayer
            channel={activeChannel}
            onPlaySuccess={() => {
              // Reload history tab state safely
              loadHistory();
            }}
            onStreamStatusChecked={(isHealthy, latency) => {
              console.log(`Stream Status -> Healthy: ${isHealthy}, ping: ${latency}ms`);
            }}
          />

          {/* Profile Details of Active Channel */}
          <div className="glass-panel rounded-xl p-5 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              
              <div className="flex items-center gap-4">
                {/* Logo Frame with Ref referrer policy */}
                <div className="w-16 h-16 rounded-xl bg-slate-900 p-2 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                  {activeChannel.logo ? (
                    <img
                      src={activeChannel.logo}
                      alt={activeChannel.name}
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        // Fallback typography letter
                        e.currentTarget.style.display = "none";
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const tag = document.createElement("span");
                          tag.className = "text-xl font-display font-bold text-indigo-400";
                          tag.innerText = activeChannel.name.charAt(0);
                          parent.appendChild(tag);
                        }
                      }}
                    />
                  ) : (
                    <span className="text-xl font-display font-bold text-indigo-400">
                      {activeChannel.name.charAt(0)}
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-display font-semibold text-slate-300">
                      {getFlagEmoji(activeChannel.countryCode)} {activeChannel.country}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 bg-slate-800 text-indigo-300 rounded-md border border-slate-700">
                      <Tag className="w-2.5 h-2.5" />
                      {activeChannel.category || "General"}
                    </span>
                    {activeChannel.language && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 bg-slate-900 text-slate-400 rounded">
                        {activeChannel.language}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-display font-bold text-white mt-1">
                    {activeChannel.name}
                  </h2>
                </div>
              </div>

              {/* Action buttons */}
              <button
                id="btn-toggle-favorite"
                onClick={toggleFavorite}
                className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition duration-200 cursor-pointer ${
                  isFavorited
                    ? "bg-pink-600/15 border-pink-500/40 text-pink-400 hover:bg-pink-600/35"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800"
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorited ? "fill-current text-pink-500" : ""}`} />
                {isFavorited ? "In Favorites" : "Add to Favorites"}
              </button>

            </div>

            {/* Custom Metadata Table */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/60 text-xs">
              <div className="bg-slate-900/30 p-2.5 border border-slate-800/40 rounded-lg">
                <span className="text-slate-500 block">Stream Resolution</span>
                <span className="font-mono font-semibold text-slate-200 mt-0.5 block">{activeChannel.resolution || "Adaptive Auto"}</span>
              </div>
              <div className="bg-slate-900/30 p-2.5 border border-slate-800/40 rounded-lg">
                <span className="text-slate-500 block">Typical Bitrate</span>
                <span className="font-mono font-semibold text-slate-200 mt-0.5 block">{activeChannel.bitrate ? `${activeChannel.bitrate} kbps` : "Standard Broadcast"}</span>
              </div>
              <div className="bg-slate-900/30 p-2.5 border border-slate-800/40 rounded-lg">
                <span className="text-slate-500 block">Language Track</span>
                <span className="font-mono font-semibold text-slate-300 mt-0.5 block">{activeChannel.language || "Stereo Mix"}</span>
              </div>
              <div className="bg-slate-900/30 p-2.5 border border-slate-800/40 rounded-lg">
                <span className="text-slate-500 block">Copyright Clear</span>
                <span className="font-mono font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Public Stream
                </span>
              </div>
            </div>
          </div>

          {/* EPG Timeline Guide */}
          <EPGSchedule channelId={activeChannel.id} />

        </div>

        {/* RIGHT COLUMN: INTERACTIVE BROWSER PANEL (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Quick Access Tab Bar */}
          <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 font-display">
            <button
              onClick={() => setActiveTab("channels")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "channels"
                  ? "bg-indigo-600 text-white shadow-md font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Stream Guide
            </button>
            <button
              id="tab-myspace-favorites"
              onClick={() => {
                setActiveTab("favorites");
                loadFavorites();
                loadHistory();
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "favorites"
                  ? "bg-indigo-600 text-white shadow-md font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              My Favorites
            </button>
            <button
              onClick={() => setActiveTab("import")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "import"
                  ? "bg-indigo-600 text-white shadow-md font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Import M3U
            </button>
          </div>

          {/* Content rendering based on active tab */}
          {activeTab === "channels" && (
            <div className="space-y-4">
              
              {/* Category & Region selectors */}
              <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs uppercase font-mono text-indigo-400 tracking-wider">Browse Filter Blocks</span>
                
                {/* Countries List Selection (With BD top-of-file prioritizer) */}
                <div className="space-y-1">
                  <label htmlFor="country-selector-box" className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    By Country / State:
                  </label>
                  <select
                    id="country-selector-box"
                    value={selectedCountry}
                    onChange={(e) => {
                      setSelectedCountry(e.target.value);
                      setPage(1);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">🌎 Worldwide Feeds (All Countries)</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code === "BD" ? "🇧🇩 BANGLADESH (First Select)" : `${getFlagEmoji(c.code)} ${c.name}`} ({c.count})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Categories filtering selection */}
                <div className="space-y-1">
                  <label htmlFor="category-selector-box" className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <ListVideo className="w-3.5 h-3.5" />
                    By Category / Content:
                  </label>
                  <select
                    id="category-selector-box"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setPage(1);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">🎬 All Content Categorizations</option>
                    {categories.map((c) => (
                      <option key={c.name} value={c.name}>
                        📺 {c.name} ({c.count})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reset button if active */}
                {(selectedCountry || selectedCategory || searchQuery) && (
                  <button
                    onClick={() => {
                      setSelectedCountry("");
                      setSelectedCategory("");
                      setSearchQuery("");
                      setPage(1);
                    }}
                    className="w-full py-1.5 text-xs font-medium text-indigo-400 bg-indigo-950/20 rounded-md border border-indigo-900/40 hover:bg-slate-800 transition cursor-pointer"
                  >
                    Reset Active Filters
                  </button>
                )}
              </div>

              {/* Dynamic Channels Grid List */}
              <div className="space-y-2.5">
                <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">
                  Channels Catalog ({totalPages > 0 ? `Page ${page} of ${totalPages}` : "0 results"})
                </span>
                
                {loadingChannels ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 border border-slate-800/40 rounded-xl">
                    <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-slate-500 font-mono mt-3">Re-indexing stream guides...</span>
                  </div>
                ) : channels.length === 0 ? (
                  <div className="py-14 text-center bg-slate-900/10 border border-slate-800 rounded-xl">
                    <Tv className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-sm text-slate-400 font-display">No channels matched your filters.</p>
                    <p className="text-xs text-slate-600 mt-1">Try resetting selected filters or importing a custom playlist.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto pr-1">
                    {channels.map((chan) => {
                      const isBD = chan.countryCode === "BD";
                      const isActive = chan.id === activeChannel.id;

                      return (
                        <div
                          key={chan.id}
                          onClick={() => setActiveChannel(chan)}
                          className={`group p-2.5 rounded-lg border text-left cursor-pointer transition-all duration-200 flex items-center justify-between ${
                            isActive
                              ? "bg-indigo-600/15 border-indigo-500 text-white shadow"
                              : "bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-3 truncate">
                            {/* Logo */}
                            <div className="w-10 h-10 rounded bg-slate-950 p-1 flex items-center justify-center overflow-hidden border border-slate-800/60 grow-0 shrink-0">
                              {chan.logo ? (
                                <img
                                  src={chan.logo}
                                  alt={chan.name}
                                  referrerPolicy="no-referrer"
                                  className="max-w-full max-h-full object-contain"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    const parent = e.currentTarget.parentElement;
                                    if (parent) {
                                      parent.innerHTML = `<span class="text-xs font-bold text-indigo-400">${chan.name.charAt(0)}</span>`;
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-xs font-bold text-indigo-400">{chan.name.charAt(0)}</span>
                              )}
                            </div>

                            <div className="truncate">
                              <h4 className="text-xs font-semibold group-hover:text-white truncate">
                                {chan.name}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                                <span>{getFlagEmoji(chan.countryCode)} {chan.country}</span>
                                <span>•</span>
                                <span className="text-indigo-400">{chan.category || "General"}</span>
                              </div>
                            </div>
                          </div>

                          {isBD && (
                            <span className="text-[9px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 bg-red-950/80 text-red-400 border border-red-900/60 rounded">
                              BD Selected
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination HUD controls */}
                {!loadingChannels && totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs font-mono select-none">
                    <button
                      id="btn-page-prev"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg flex items-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </button>
                    <span className="text-slate-400 font-medium">Page {page} of {totalPages}</span>
                    <button
                      id="btn-page-next"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg flex items-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "favorites" && (
            <div className="space-y-4">
              
              {/* Favorites list section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-indigo-900/30 pb-2">
                  <span className="text-xs uppercase font-mono text-indigo-400 tracking-wider">
                    My Favorites ({favorites.length})
                  </span>

                  {favorites.length > 0 && (
                    <button
                      id="btn-export-favorites"
                      onClick={downloadFavoritesM3U}
                      className="text-[11px] font-mono font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export M3U Playlist
                    </button>
                  )}
                </div>

                {favorites.length === 0 ? (
                  <div className="py-10 text-center bg-slate-900/10 border border-slate-850 rounded-xl">
                    <Star className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Your favorites index is empty.</p>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal max-w-xs mx-auto">
                      Click the heart icon "Add to Favorites" on any channel live TV page to catalog your key channels.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {favorites.map((chan) => (
                      <div
                        key={`fav-${chan.id}`}
                        onClick={() => setActiveChannel(chan)}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all duration-200 flex items-center justify-between ${
                          chan.id === activeChannel.id
                            ? "bg-indigo-600/15 border-indigo-500 text-white shadow"
                            : "bg-slate-900/40 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <span className="text-lg grow-0 shrink-0">{getFlagEmoji(chan.countryCode)}</span>
                          <span className="text-xs font-semibold truncate">{chan.name}</span>
                        </div>
                        <span className="text-[10px] text-indigo-300 bg-slate-950 px-2 py-0.5 rounded font-mono">
                          {chan.category || "General"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Watch History List */}
              <div className="space-y-2.5">
                <span className="text-xs uppercase font-mono text-slate-400 tracking-wider flex items-center gap-1">
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  Watcher History ({history.length})
                </span>

                {history.length === 0 ? (
                  <div className="py-6 text-center bg-slate-900/5 border border-slate-850 rounded-xl">
                    <p className="text-xs text-slate-500">Your playback logs are empty.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {history.map((chan) => (
                      <div
                        key={`hist-${chan.id}-${chan.isHealthy}`}
                        onClick={() => setActiveChannel(chan)}
                        className="p-2 bg-slate-950/40 hover:bg-slate-900 border border-slate-850/40 hover:border-slate-700 rounded-lg text-left cursor-pointer transition flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{getFlagEmoji(chan.countryCode)}</span>
                          <span className="text-xs text-slate-300 truncate">{chan.name}</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500">Watched Now</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === "import" && (
            <M3UPlaylistImporter
              onImportSuccess={handlePlaylistImportSuccess}
            />
          )}

        </div>
      </main>

      {/* COMPLIANCE / DMCA FOOTER LEGAL SYSTEM */}
      <footer className="bg-slate-950 border-t border-slate-900 mt-20 py-8 px-4 lg:px-8 text-center text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-slate-400 font-mono text-[11px]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              100% Free Open Stream Indexes
            </span>
            <span className="hidden sm:inline">•</span>
            <span>No Proprietary DRMs Required</span>
            <span className="hidden sm:inline">•</span>
            <span>Secure SSL Protected Handshakes</span>
          </div>
          
          <p className="max-w-2xl mx-auto leading-relaxed text-slate-500">
            <strong>DMCA Legal Notice:</strong> IPTV Live-TV Platform operates strictly as a full-stack directory index mapping public live streaming links. We do not host, store, or transmit any copyright-protected media broadcast archives or database servers. All media streams belong dynamically and exclusively to their respective transmission organizations.
          </p>

          <p className="text-[10px] text-slate-600 font-mono pt-2">
            Inspired by iptv-org open-source protocols • Running on Google Cloud Platform (0.0.0.0:3000)
          </p>
        </div>
      </footer>

    </div>
  );
}
