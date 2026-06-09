import React, { useEffect, useState, useCallback } from "react";
import { IPTVChannel, CountryMetadata, CategoryMetadata } from "./types";
import { STABLE_CHANNELS } from "./seedChannels";
import Sidebar from "./components/Sidebar";
import HomePage from "./components/HomePage";
import WatchPage from "./components/WatchPage";
import ChannelCard from "./components/ChannelCard";
import M3UPlaylistImporter from "./components/M3UPlaylistImporter";
import { Heart, Search, Download, Tv, Clock, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Hash Routing helpers ───────────────────────────────────────────────────
function getRoute(): { path: string; channelId?: string } {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  if (hash.startsWith("/watch/")) {
    return { path: "/watch", channelId: hash.replace("/watch/", "") };
  }
  return { path: hash || "/" };
}
function setRoute(path: string) {
  window.location.hash = path;
}

function getFlagEmoji(code: string) {
  if (!code || code.length !== 2) return "📡";
  try {
    return String.fromCodePoint(...code.toUpperCase().split("").map(c => 127397 + c.charCodeAt(0)));
  } catch { return "📡"; }
}

export default function App() {
  // ─── Router state ────────────────────────────────────────────────────────
  const [route, setRouteState] = useState(getRoute());

  // ─── Data state ──────────────────────────────────────────────────────────
  const [channels, setChannels] = useState<IPTVChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<IPTVChannel | null>(null);
  const [countries, setCountries] = useState<CountryMetadata[]>([]);
  const [categories, setCategories] = useState<CategoryMetadata[]>([]);
  const [favorites, setFavorites] = useState<IPTVChannel[]>([]);
  const [history, setHistory] = useState<IPTVChannel[]>([]);
  const [isFavorited, setIsFavorited] = useState(false);

  // ─── Filter / pagination state ───────────────────────────────────────────
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // ─── Hash-change listener ─────────────────────────────────────────────────
  useEffect(() => {
    const onHashChange = () => {
      const r = getRoute();
      setRouteState(r);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // ─── Navigate helper ──────────────────────────────────────────────────────
  const navigate = useCallback((path: string) => {
    setRoute(path);
    setRouteState(getRoute());
  }, []);

  // ─── Channel selection (sets active + navigates) ─────────────────────────
  const selectChannel = useCallback((ch: IPTVChannel) => {
    setActiveChannel(ch);
    navigate(`/watch/${ch.id}`);
  }, [navigate]);

  // ─── On route change to /watch/:id, resolve channel from all channels ────
  useEffect(() => {
    if (route.path === "/watch" && route.channelId) {
      // Try to find in loaded channels first
      const found =
        channels.find(c => c.id === route.channelId) ||
        STABLE_CHANNELS.find(c => c.id === route.channelId);
      if (found) {
        setActiveChannel(found);
      } else if (route.channelId) {
        // Fetch from API if not loaded yet
        fetch(`/api/channels/${encodeURIComponent(route.channelId)}`)
          .then(r => r.json())
          .then(data => { if (data && data.id) setActiveChannel(data); })
          .catch(() => {});
      }
    }
  }, [route, channels]);

  // ─── Data loaders ────────────────────────────────────────────────────────
  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const url = new URL("/api/channels", window.location.origin);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("limit", "20");
      if (selectedCountry) url.searchParams.set("country", selectedCountry);
      if (selectedCategory) url.searchParams.set("category", selectedCategory);
      if (searchQuery) url.searchParams.set("search", searchQuery);
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data && Array.isArray(data.channels)) {
        setChannels(data.channels);
        setTotalPages(data.pagination.totalPages || 1);
      }
    } catch {
      setChannels(STABLE_CHANNELS);
    } finally {
      setLoadingChannels(false);
    }
  }, [selectedCountry, selectedCategory, searchQuery, page]);

  const loadMeta = useCallback(async () => {
    try {
      const [cr, catr] = await Promise.all([
        fetch("/api/countries").then(r => r.json()),
        fetch("/api/categories").then(r => r.json()),
      ]);
      if (Array.isArray(cr)) setCountries(cr);
      if (Array.isArray(catr)) setCategories(catr);
    } catch {}
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const res = await fetch("/api/favorites");
      const data = await res.json();
      if (Array.isArray(data)) {
        setFavorites(data);
      }
    } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } catch {}
  }, []);

  useEffect(() => { loadMeta(); loadFavorites(); loadHistory(); }, []);
  useEffect(() => { loadChannels(); }, [selectedCountry, selectedCategory, searchQuery, page]);

  useEffect(() => {
    if (activeChannel) {
      setIsFavorited(favorites.some(f => f.id === activeChannel.id));
    }
  }, [activeChannel, favorites]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const toggleFavorite = async () => {
    if (!activeChannel) return;
    try {
      if (isFavorited) {
        const res = await fetch(`/api/favorites/${activeChannel.id}`, { method: "DELETE" });
        if (res.ok) { setFavorites(prev => prev.filter(f => f.id !== activeChannel.id)); setIsFavorited(false); }
      } else {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeChannel.id }),
        });
        if (res.ok) { setFavorites(prev => [...prev, activeChannel]); setIsFavorited(true); }
      }
    } catch {}
  };

  const handleImportSuccess = (count: number) => {
    setImportNotice(`Imported ${count} channels! Browse the channel list.`);
    loadMeta(); loadChannels();
    setTimeout(() => setImportNotice(null), 5000);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const { path } = route;
  const isWatchPage = path === "/watch";

  return (
    <div className="flex min-h-screen bg-[#0a0a14] text-white font-sans">
      {/* Sidebar */}
      <Sidebar currentRoute={path} onNavigate={navigate} />

      {/* Main content (offset by sidebar width) */}
      <div className="flex-1 ml-56 min-h-screen overflow-y-auto">
        {/* Import success notice */}
        {importNotice && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <span>✓</span> {importNotice}
          </div>
        )}

        {/* ── HOME ── */}
        {(path === "/" || path === "") && (
          <HomePage
            channels={channels}
            countries={countries}
            categories={categories}
            searchQuery={searchQuery}
            onSearch={q => { setSearchQuery(q); setPage(1); }}
            selectedCountry={selectedCountry}
            onSelectCountry={code => { setSelectedCountry(code); setPage(1); }}
            selectedCategory={selectedCategory}
            onSelectCategory={cat => { setSelectedCategory(cat); setPage(1); }}
            onChannelSelect={selectChannel}
            loadingChannels={loadingChannels}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}

        {/* ── WATCH ── */}
        {isWatchPage && activeChannel && (
          <WatchPage
            channel={activeChannel}
            allChannels={channels}
            favorites={favorites}
            onChannelSelect={selectChannel}
            onBack={() => navigate("/")}
            onToggleFavorite={toggleFavorite}
            isFavorited={isFavorited}
            onPlaySuccess={loadHistory}
          />
        )}
        {isWatchPage && !activeChannel && (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Loading channel...</p>
            </div>
          </div>
        )}

        {/* ── LIVE TV ── */}
        {path === "/live" && (
          <ChannelListPage
            title="Live TV"
            channels={channels}
            countries={countries}
            categories={categories}
            searchQuery={searchQuery}
            onSearch={q => { setSearchQuery(q); setPage(1); }}
            selectedCountry={selectedCountry}
            onSelectCountry={code => { setSelectedCountry(code); setPage(1); }}
            selectedCategory={selectedCategory}
            onSelectCategory={cat => { setSelectedCategory(cat); setPage(1); }}
            onChannelSelect={selectChannel}
            loadingChannels={loadingChannels}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}

        {/* ── CATEGORIES ── */}
        {path === "/categories" && (
          <ChannelListPage
            title="Categories"
            channels={channels}
            countries={countries}
            categories={categories}
            searchQuery={searchQuery}
            onSearch={q => { setSearchQuery(q); setPage(1); }}
            selectedCountry={selectedCountry}
            onSelectCountry={code => { setSelectedCountry(code); setPage(1); }}
            selectedCategory={selectedCategory}
            onSelectCategory={cat => { setSelectedCategory(cat); setPage(1); }}
            onChannelSelect={selectChannel}
            loadingChannels={loadingChannels}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}

        {/* ── COUNTRIES ── */}
        {path === "/countries" && (
          <ChannelListPage
            title="Countries"
            channels={channels}
            countries={countries}
            categories={categories}
            searchQuery={searchQuery}
            onSearch={q => { setSearchQuery(q); setPage(1); }}
            selectedCountry={selectedCountry}
            onSelectCountry={code => { setSelectedCountry(code); setPage(1); }}
            selectedCategory={selectedCategory}
            onSelectCategory={cat => { setSelectedCategory(cat); setPage(1); }}
            onChannelSelect={selectChannel}
            loadingChannels={loadingChannels}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}

        {/* ── FAVORITES ── */}
        {path === "/favorites" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5 text-pink-400" />
              <h1 className="text-xl font-bold">My Favorites</h1>
            </div>
            {favorites.length === 0 ? (
              <div className="py-20 text-center bg-white/3 rounded-xl border border-white/8">
                <Heart className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No favorites yet</p>
                <p className="text-xs text-slate-600 mt-1">Browse channels and save your favorites</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {favorites.map(ch => (
                    <ChannelCard key={ch.id} channel={ch} onClick={selectChannel} />
                  ))}
                </div>
                <button
                  onClick={() => window.open("/api/playlists/export/favorites.m3u", "_blank")}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-lg text-sm hover:bg-white/10 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Export as M3U
                </button>
              </>
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {path === "/history" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <h1 className="text-xl font-bold">Recently Viewed</h1>
            </div>
            {history.length === 0 ? (
              <div className="py-20 text-center bg-white/3 rounded-xl border border-white/8">
                <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No history yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {history.map(ch => (
                  <ChannelCard key={ch.id} channel={ch} onClick={selectChannel} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── IMPORT (M3U) ── */}
        {path === "/mylist" && (
          <div className="p-6 space-y-6">
            <h1 className="text-xl font-bold">My List &amp; Import M3U</h1>
            <M3UPlaylistImporter onImportSuccess={handleImportSuccess} />
          </div>
        )}

        {/* ── SETTINGS / FALLBACK ── */}
        {(path === "/settings" || path === "/schedule" || path === "/trending") && (
          <div className="p-6">
            <div className="py-20 text-center bg-white/3 rounded-xl border border-white/8">
              <Tv className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium capitalize">{path.replace("/", "")} — Coming Soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reusable full-channel-list page ─────────────────────────────────────────
interface ChannelListPageProps {
  title: string;
  channels: IPTVChannel[];
  countries: CountryMetadata[];
  categories: CategoryMetadata[];
  searchQuery: string;
  onSearch: (q: string) => void;
  selectedCountry: string;
  onSelectCountry: (code: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onChannelSelect: (ch: IPTVChannel) => void;
  loadingChannels: boolean;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

function getFlagEmojiLocal(code: string) {
  if (!code || code.length !== 2) return "📡";
  try {
    return String.fromCodePoint(...code.toUpperCase().split("").map(c => 127397 + c.charCodeAt(0)));
  } catch { return "📡"; }
}

function ChannelListPage({
  title, channels, countries, categories, searchQuery, onSearch,
  selectedCountry, onSelectCountry, selectedCategory, onSelectCategory,
  onChannelSelect, loadingChannels, page, totalPages, onPageChange,
}: ChannelListPageProps) {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{title}</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-white/3 rounded-xl border border-white/8">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search channels..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition"
          />
        </div>

        <select
          value={selectedCountry}
          onChange={e => onSelectCountry(e.target.value)}
          className="bg-white/5 border border-white/10 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500 cursor-pointer min-w-40"
        >
          <option value="">🌎 All Countries</option>
          {countries.map(c => (
            <option key={c.code} value={c.code}>
              {c.code === "BD" ? "🇧🇩 Bangladesh" : `${getFlagEmojiLocal(c.code)} ${c.name}`} ({c.count})
            </option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={e => onSelectCategory(e.target.value)}
          className="bg-white/5 border border-white/10 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-violet-500 cursor-pointer min-w-40"
        >
          <option value="">🎬 All Categories</option>
          {categories.map(c => (
            <option key={c.name} value={c.name}>📺 {c.name} ({c.count})</option>
          ))}
        </select>

        {(selectedCountry || selectedCategory || searchQuery) && (
          <button
            onClick={() => { onSelectCountry(""); onSelectCategory(""); onSearch(""); }}
            className="px-3 py-1.5 text-xs text-violet-400 bg-violet-600/10 border border-violet-500/30 rounded-lg hover:bg-violet-600/20 transition cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Grid */}
      {loadingChannels ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white/5 animate-pulse" style={{ aspectRatio: "16/9" }} />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="py-20 text-center bg-white/3 rounded-xl border border-white/8">
          <Tv className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No channels found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {channels.map(ch => (
            <ChannelCard key={ch.id} channel={ch} onClick={onChannelSelect} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white/5 border border-white/10 text-slate-300 rounded-lg hover:bg-white/10 disabled:opacity-30 transition cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white/5 border border-white/10 text-slate-300 rounded-lg hover:bg-white/10 disabled:opacity-30 transition cursor-pointer">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
