import React, { useState } from "react";
import { Search, ChevronRight, ChevronLeft, Tv, Zap, Wifi, Globe as GlobeIcon } from "lucide-react";
import { proxyLogo } from "../utils/logoProxy";
import { IPTVChannel, CountryMetadata, CategoryMetadata } from "../types";
import ChannelCard from "./ChannelCard";

interface HomePageProps {
  channels: IPTVChannel[];
  countries: CountryMetadata[];
  categories: CategoryMetadata[];
  searchQuery: string;
  onSearch: (q: string) => void;
  selectedCountry: string;
  onSelectCountry: (code: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onChannelSelect: (channel: IPTVChannel) => void;
  loadingChannels: boolean;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  All: "⊞",
  Sports: "⚽",
  News: "📰",
  Movies: "🎬",
  Entertainment: "🌟",
  Kids: "🧸",
  Music: "🎵",
  Lifestyle: "🌿",
  Religion: "🕌",
  Documentary: "🎥",
  General: "📺",
};

function getFlagEmoji(code: string) {
  if (!code || code.length !== 2) return "📡";
  try {
    return String.fromCodePoint(...code.toUpperCase().split("").map(c => 127397 + c.charCodeAt(0)));
  } catch { return "📡"; }
}

const FEATURED_COUNTRIES = ["BD", "IN", "US", "GB", "PK", "CA", "AU", "SA"];

export default function HomePage({
  channels, countries, categories, searchQuery, onSearch,
  selectedCountry, onSelectCountry, selectedCategory, onSelectCategory,
  onChannelSelect, loadingChannels, page, totalPages, onPageChange
}: HomePageProps) {
  const [heroIndex, setHeroIndex] = useState(0);

  const featuredChannels = channels.filter(c => c.countryCode === "BD").slice(0, 3);
  const hero = featuredChannels[heroIndex] || channels[0];

  const topCountries = FEATURED_COUNTRIES
    .map(code => countries.find(c => c.code === code))
    .filter(Boolean) as CountryMetadata[];
  const restCountries = countries.filter(c => !FEATURED_COUNTRIES.includes(c.code));
  const displayCountries = [...topCountries, ...restCountries].slice(0, 8);

  const allCategories = [{ name: "All", count: 0 }, ...categories.slice(0, 8)];

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      {/* Top Header — hidden on mobile (mobile top bar is in App.tsx) */}
      <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 bg-[#0a0a14]/90 backdrop-blur-md z-20">
        <div className="flex-1 max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearch(e.target.value)}
              placeholder="Search channels, shows, categories..."
              className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm">A</div>
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="md:hidden px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search channels..."
            className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition"
          />
        </div>
      </div>

      <div className="px-3 md:px-6 py-4 md:py-6 space-y-6 md:space-y-8">
        {/* Hero Banner */}
        {hero && (
          <div
            className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a1040] via-[#0f0a2a] to-[#0a0a14] border border-white/8"
            style={{ minHeight: 180 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

            {hero.logo && (
              <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 opacity-20">
                <img src={proxyLogo(hero.logo)} alt="" className="w-32 md:w-64 h-20 md:h-40 object-contain" onError={e => { e.currentTarget.style.display = "none"; }} />
              </div>
            )}

            <div className="relative p-5 md:p-8 flex flex-col justify-between h-full" style={{ minHeight: 180 }}>
              <div>
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE NOW
                  </span>
                </div>
                <h2 className="text-xl md:text-3xl font-bold text-white mb-1 md:mb-2">{hero.name}</h2>
                <p className="text-slate-300 text-xs md:text-sm mb-1">{hero.category} • {hero.country} • {hero.language}</p>
                {hero.resolution && <p className="text-slate-500 text-xs hidden md:block">{hero.resolution}</p>}
              </div>

              <div className="flex items-center gap-3 mt-4 md:mt-6">
                <button
                  onClick={() => onChannelSelect(hero)}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-full text-sm font-semibold transition cursor-pointer shadow-lg shadow-violet-600/30"
                >
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  Watch Now
                </button>
                <div className="flex items-center gap-1.5 ml-1">
                  {featuredChannels.slice(0, 3).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setHeroIndex(i)}
                      className={`rounded-full transition-all cursor-pointer ${i === heroIndex ? "w-5 h-2 bg-violet-400" : "w-2 h-2 bg-white/30 hover:bg-white/50"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Browse by Category */}
        <div>
          <h2 className="text-sm md:text-base font-semibold text-white mb-2 md:mb-3">Browse by Category</h2>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 md:flex-wrap md:overflow-visible">
            {allCategories.map(cat => (
              <button
                key={cat.name}
                onClick={() => onSelectCategory(cat.name === "All" ? "" : cat.name)}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-sm font-medium border transition cursor-pointer shrink-0 ${
                  (cat.name === "All" && !selectedCategory) || selectedCategory === cat.name
                    ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20"
                    : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <span>{CATEGORY_ICONS[cat.name] || "📺"}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Select Country */}
        <div>
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h2 className="text-sm md:text-base font-semibold text-white">Select Country</h2>
            <button
              onClick={() => onSelectCountry("")}
              className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition cursor-pointer"
            >
              <GlobeIcon className="w-3.5 h-3.5" /> View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-3">
            {displayCountries.map(c => (
              <button
                key={c.code}
                onClick={() => onSelectCountry(selectedCountry === c.code ? "" : c.code)}
                className={`flex flex-col items-center gap-1.5 p-2 md:p-3 rounded-xl border transition cursor-pointer ${
                  selectedCountry === c.code
                    ? "bg-violet-600/20 border-violet-500 text-white"
                    : "bg-white/3 border-white/8 text-slate-300 hover:bg-white/8 hover:border-white/20"
                }`}
              >
                <span className="text-2xl md:text-3xl leading-none">{getFlagEmoji(c.code)}</span>
                <span className="text-[10px] font-medium text-center leading-tight truncate w-full">{c.name.length > 8 ? c.name.slice(0, 8) + "…" : c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Popular Channels */}
        <div>
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h2 className="text-sm md:text-base font-semibold text-white truncate mr-2">
              {selectedCountry
                ? `Channels in ${countries.find(c => c.code === selectedCountry)?.name || selectedCountry}`
                : selectedCategory
                ? `${selectedCategory} Channels`
                : "Popular Channels in Bangladesh"}
            </h2>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-slate-500 hidden sm:inline">Page {page} of {totalPages}</span>
              <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 disabled:opacity-30 transition cursor-pointer">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/10 disabled:opacity-30 transition cursor-pointer">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loadingChannels ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-white/5 animate-pulse" style={{ aspectRatio: "16/9" }} />
              ))}
            </div>
          ) : channels.length === 0 ? (
            <div className="py-16 text-center bg-white/3 rounded-xl border border-white/8">
              <Tv className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No channels found</p>
              <p className="text-xs text-slate-600 mt-1">Try different filters or reset your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {channels.map(chan => (
                <ChannelCard key={chan.id} channel={chan} onClick={onChannelSelect} />
              ))}
            </div>
          )}
        </div>

        {/* Features Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 pt-4 border-t border-white/5">
          {[
            { icon: Tv, label: "1000+ Live Channels", sub: "Global & local channels" },
            { icon: Zap, label: "HD Streaming", sub: "Crystal clear quality" },
            { icon: Wifi, label: "No Buffering", sub: "Smooth streaming" },
            { icon: GlobeIcon, label: "Watch Anywhere", sub: "Any device, anytime" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-xl bg-white/3 border border-white/8">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-violet-600/20 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 md:w-5 md:h-5 text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-semibold text-white leading-tight">{label}</p>
                <p className="text-[10px] md:text-[11px] text-slate-500 hidden sm:block">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
