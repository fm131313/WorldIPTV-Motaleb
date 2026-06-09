import React, { useState } from "react";
import { IPTVChannel } from "../types";

interface ChannelCardProps {
  channel: IPTVChannel;
  onClick: (channel: IPTVChannel) => void;
  isActive?: boolean;
  compact?: boolean;
}

export default function ChannelCard({ channel, onClick, isActive, compact }: ChannelCardProps) {
  const [imgError, setImgError] = useState(false);

  const initial = channel.name.charAt(0).toUpperCase();

  const colors = [
    "from-violet-600 to-indigo-600",
    "from-rose-600 to-pink-600",
    "from-emerald-600 to-teal-600",
    "from-orange-600 to-amber-600",
    "from-sky-600 to-blue-600",
    "from-fuchsia-600 to-purple-600",
  ];
  const colorClass = colors[channel.name.charCodeAt(0) % colors.length];

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
          {channel.logo && !imgError ? (
            <img
              src={channel.logo}
              alt={channel.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
              onError={() => setImgError(true)}
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
    <div
      onClick={() => onClick(channel)}
      className="group cursor-pointer"
    >
      {/* Logo box */}
      <div className={`relative w-full rounded-xl overflow-hidden mb-2 border border-white/8 transition-all duration-200 group-hover:border-violet-500/50 group-hover:shadow-lg group-hover:shadow-violet-500/10 ${isActive ? "border-violet-500 shadow-lg shadow-violet-500/20" : ""}`}
        style={{ aspectRatio: "16/9", background: "#0d0d1a" }}
      >
        {channel.logo && !imgError ? (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <img
              src={channel.logo}
              alt={channel.name}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full object-contain"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} flex items-center justify-center`}>
            <span className="text-white font-bold text-3xl">{initial}</span>
          </div>
        )}

        {/* Live badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-green-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
          LIVE
        </div>

        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white fill-white ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0 bg-black/30">
          {channel.logo && !imgError ? (
            <img src={channel.logo} alt="" referrerPolicy="no-referrer" className="w-full h-full object-contain" onError={() => setImgError(true)} />
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
