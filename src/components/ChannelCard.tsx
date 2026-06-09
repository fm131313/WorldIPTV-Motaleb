import React, { useState, useEffect, useCallback, useRef } from "react";
import { IPTVChannel } from "../types";
import { proxyLogo } from "../utils/logoProxy";

interface ChannelCardProps {
  channel: IPTVChannel;
  onClick: (channel: IPTVChannel) => void;
  isActive?: boolean;
  compact?: boolean;
}

const COLORS = [
  "from-violet-600 to-indigo-600",
  "from-rose-600 to-pink-600",
  "from-emerald-600 to-teal-600",
  "from-orange-600 to-amber-600",
  "from-sky-600 to-blue-600",
  "from-fuchsia-600 to-purple-600",
];

// Global in-memory cache so we never call wiki API twice for same channel in a session
const wikiLogoSessionCache: Record<string, string | null> = {};
// Track in-flight requests to avoid duplicate calls
const wikiLogoInflight: Record<string, Promise<string | null>> = {};

async function fetchWikiLogo(name: string): Promise<string | null> {
  const key = name.toLowerCase();
  if (key in wikiLogoSessionCache) return wikiLogoSessionCache[key];
  if (key in wikiLogoInflight) return wikiLogoInflight[key];

  const promise = fetch(`/api/wiki-logo?name=${encodeURIComponent(name)}`)
    .then(r => r.json())
    .then(d => {
      const url: string | null = d.logoUrl ?? null;
      wikiLogoSessionCache[key] = url;
      delete wikiLogoInflight[key];
      return url;
    })
    .catch(() => {
      wikiLogoSessionCache[key] = null;
      delete wikiLogoInflight[key];
      return null;
    });

  wikiLogoInflight[key] = promise;
  return promise;
}

function useChannelLogo(channel: IPTVChannel) {
  const [src, setSrc] = useState<string | null>(
    channel.logo ? proxyLogo(channel.logo) : null
  );
  const [imgFailed, setImgFailed] = useState(false);
  const didWikiLookup = useRef(false);

  // If no logo from server, try Wikipedia on mount
  useEffect(() => {
    if (channel.logo || didWikiLookup.current) return;
    didWikiLookup.current = true;
    fetchWikiLogo(channel.name).then(url => {
      if (url) setSrc(proxyLogo(url));
    });
  }, [channel.id, channel.name, channel.logo]);

  // When proxied URL 404s, try wiki as fallback
  const handleImgError = useCallback(() => {
    if (didWikiLookup.current) {
      // Already tried wiki, show letter avatar
      setSrc(null);
      setImgFailed(true);
      return;
    }
    didWikiLookup.current = true;
    fetchWikiLogo(channel.name).then(url => {
      if (url) {
        setSrc(proxyLogo(url));
        setImgFailed(false);
      } else {
        setSrc(null);
        setImgFailed(true);
      }
    });
  }, [channel.name]);

  const showLetter = !src || imgFailed;
  return { src, showLetter, handleImgError };
}

export default function ChannelCard({ channel, onClick, isActive, compact }: ChannelCardProps) {
  const { src: logoSrc, showLetter, handleImgError } = useChannelLogo(channel);
  const initial = channel.name.charAt(0).toUpperCase();
  const colorClass = COLORS[channel.name.charCodeAt(0) % COLORS.length];

  if (compact) {
    return (
      <div
        onClick={() => onClick(channel)}
        className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
          isActive
            ? "bg-violet-600/15 border-violet-500 text-white"
            : "bg-white/3 border-white/8 hover:bg-white/8 hover:border-white/15 text-slate-300"
        }`}
      >
        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-black/30">
          {!showLetter ? (
            <img
              src={logoSrc!}
              alt={channel.name}
              className="w-full h-full object-contain"
              onError={handleImgError}
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${colorClass} flex items-center justify-center`}>
              <span className="text-white font-bold text-sm">{initial}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{channel.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-green-400 font-medium">LIVE</span>
            <span className="text-[10px] text-slate-500">• {channel.category}</span>
          </div>
        </div>
        {isActive && (
          <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
        )}
      </div>
    );
  }

  return (
    <div onClick={() => onClick(channel)} className="group cursor-pointer">
      {/* Thumbnail */}
      <div
        className={`relative w-full rounded-xl overflow-hidden mb-2 border border-white/8 transition-all duration-200 group-hover:border-violet-500/50 group-hover:shadow-lg group-hover:shadow-violet-500/10 ${isActive ? "border-violet-500 shadow-lg shadow-violet-500/20" : ""}`}
        style={{ aspectRatio: "16/9", background: "#0d0d1a" }}
      >
        {!showLetter ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/10">
            <img
              src={logoSrc!}
              alt={channel.name}
              className="max-w-full max-h-full object-contain drop-shadow-lg"
              onError={handleImgError}
            />
          </div>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} flex items-center justify-center`}>
            <span className="text-white font-bold text-3xl">{initial}</span>
          </div>
        )}

        {/* Live badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-green-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider z-10">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
          LIVE
        </div>

        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
          <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white fill-white ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0 bg-black/30">
          {!showLetter ? (
            <img src={logoSrc!} alt="" className="w-full h-full object-contain" onError={() => {}} />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${colorClass} flex items-center justify-center`}>
              <span className="text-white font-bold text-[10px]">{initial}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{channel.name}</p>
          <p className="text-[10px] text-slate-500">{channel.category}</p>
        </div>
      </div>
    </div>
  );
}
