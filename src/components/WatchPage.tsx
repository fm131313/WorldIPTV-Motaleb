import React, { useEffect, useState } from "react";
import { Heart, Share2, Download, ArrowLeft, Tag, Globe, Radio } from "lucide-react";
import { proxyLogo } from "../utils/logoProxy";
import { IPTVChannel } from "../types";
import HLSLivePlayer from "./HLSLivePlayer";
import EPGSchedule from "./EPGSchedule";
import ChannelCard from "./ChannelCard";

interface WatchPageProps {
  channel: IPTVChannel;
  allChannels: IPTVChannel[];
  favorites: IPTVChannel[];
  onChannelSelect: (channel: IPTVChannel) => void;
  onBack: () => void;
  onToggleFavorite: () => void;
  isFavorited: boolean;
  onPlaySuccess: () => void;
}

function getFlagEmoji(code: string) {
  if (!code || code.length !== 2) return "📡";
  try {
    return String.fromCodePoint(...code.toUpperCase().split("").map(c => 127397 + c.charCodeAt(0)));
  } catch { return "📡"; }
}

export default function WatchPage({
  channel, allChannels, favorites, onChannelSelect, onBack,
  onToggleFavorite, isFavorited, onPlaySuccess
}: WatchPageProps) {
  const related = allChannels
    .filter(c => c.id !== channel.id && (c.category === channel.category || c.countryCode === channel.countryCode))
    .slice(0, 12);

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 md:px-6 py-3 md:py-4 border-b border-white/5 overflow-hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-medium transition cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-slate-600 shrink-0">/</span>
        <span className="text-slate-400 text-sm shrink-0 hidden sm:inline">{channel.category}</span>
        <span className="text-slate-600 shrink-0 hidden sm:inline">/</span>
        <span className="text-white text-sm font-medium truncate">{channel.name}</span>
      </div>

      <div className="flex gap-0">
        {/* Main content */}
        <div className="flex-1 min-w-0 p-3 md:p-6 space-y-4 md:space-y-5">
          {/* Player */}
          <HLSLivePlayer
            channel={channel}
            onPlaySuccess={onPlaySuccess}
            onStreamStatusChecked={(healthy, latency) => {
              console.log(`Stream: healthy=${healthy}, latency=${latency}ms`);
            }}
          />

          {/* Channel Info */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 md:gap-4">
            <div className="flex items-start gap-3">
              {/* Logo */}
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                {channel.logo ? (
                  <img
                    src={proxyLogo(channel.logo)}
                    alt={channel.name}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const p = e.currentTarget.parentElement;
                      if (p) p.innerHTML = `<span class="text-white font-bold text-xl">${channel.name.charAt(0)}</span>`;
                    }}
                  />
                ) : (
                  <span className="text-white font-bold text-xl">{channel.name.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    <Radio className="w-2.5 h-2.5" /> Live Now
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    <Tag className="w-3 h-3" /> {channel.category}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    <Globe className="w-3 h-3" /> {getFlagEmoji(channel.countryCode)} {channel.country}
                  </span>
                  {channel.language && (
                    <span className="text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                      {channel.language}
                    </span>
                  )}
                </div>
                <h1 className="text-lg md:text-xl font-bold text-white">{channel.name}</h1>
                {channel.resolution && (
                  <span className="text-xs text-slate-500 mt-0.5 block">
                    {channel.resolution} {channel.bitrate ? `• ${channel.bitrate} kbps` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onToggleFavorite}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition cursor-pointer ${
                  isFavorited
                    ? "bg-pink-600/15 border-pink-500/40 text-pink-400"
                    : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`} />
                {isFavorited ? "Saved" : "Save"}
              </button>
              <button
                onClick={() => window.open("/api/playlists/export/favorites.m3u", "_blank")}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export M3U
              </button>
            </div>
          </div>

          {/* EPG Schedule */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Program Schedule</h3>
            <EPGSchedule channelId={channel.id} />
          </div>

          {/* Related channels — mobile only (shown inline) */}
          {related.length > 0 && (
            <div className="md:hidden">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Related Channels</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {related.map(ch => (
                  <div key={ch.id} className="shrink-0 w-40">
                    <ChannelCard
                      channel={ch}
                      onClick={onChannelSelect}
                      isActive={ch.id === channel.id}
                      compact
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar — desktop only */}
        <div className="hidden md:block w-72 shrink-0 border-l border-white/5 p-4 space-y-3 overflow-y-auto max-h-screen">
          <h3 className="text-sm font-semibold text-slate-300">Related Channels</h3>
          {related.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">No related channels</p>
          ) : (
            <div className="space-y-2">
              {related.map(ch => (
                <ChannelCard
                  key={ch.id}
                  channel={ch}
                  onClick={onChannelSelect}
                  isActive={ch.id === channel.id}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
