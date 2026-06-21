import React, { useEffect, useRef, useState, useCallback } from "react";
import Hls, { Level } from "hls.js";
import { proxyLogo } from "../utils/logoProxy";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  RefreshCw, AlertTriangle, Settings, Wifi, WifiOff, Radio
} from "lucide-react";
import { IPTVChannel } from "../types";

interface HLSLivePlayerProps {
  channel: IPTVChannel;
  onPlaySuccess?: () => void;
  onStreamStatusChecked?: (isHealthy: boolean, latency?: number) => void;
}

export default function HLSLivePlayer({ channel, onPlaySuccess, onStreamStatusChecked }: HLSLivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showQuality, setShowQuality] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [streamHealthy, setStreamHealthy] = useState<boolean | null>(null);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const isMountedRef = useRef(true);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(true);
    setErrorMsg(null);
    setIsPlaying(false);
    setQualityLevels([]);
    setCurrentLevel(-1);
    setStreamHealthy(null);

    const video = videoRef.current;
    if (!video) return;

    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: channel.id })
    }).then(() => { if (isMountedRef.current) onPlaySuccess?.(); }).catch(() => {});

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const playVideo = async () => {
      if (!isMountedRef.current) return;
      try {
        await video.play();
        if (isMountedRef.current) setIsPlaying(true);
      } catch {
        if (isMountedRef.current) setIsPlaying(false);
      }
    };

    // Detect raw MPEG-TS streams (end in .ts, not .m3u8) — route via server proxy
    const urlPath = channel.streamUrl.split("?")[0].toLowerCase();
    const isRawTs = urlPath.endsWith(".ts") && !urlPath.endsWith(".m3u8");
    const isM3u = urlPath.endsWith(".m3u") && !urlPath.endsWith(".m3u8");

    const playDirect = (src: string) => {
      if (!isMountedRef.current) return;
      video.src = src;
      const onMeta = () => { if (isMountedRef.current) { setIsLoading(false); playVideo(); } };
      const onErr = () => {
        if (!isMountedRef.current) return;
        setErrorMsg("Live stream offline or network restricted.");
        setIsLoading(false);
        setStreamHealthy(false);
      };
      video.addEventListener("loadedmetadata", onMeta, { once: true });
      video.addEventListener("canplay", onMeta, { once: true });
      video.addEventListener("error", onErr, { once: true });
      video.load();
    };

    if (isM3u) {
      // Resolve the .m3u playlist server-side to get the real stream URL
      fetch(`/api/resolve-m3u?url=${encodeURIComponent(channel.streamUrl)}`)
        .then(r => r.json())
        .then(data => {
          if (!isMountedRef.current) return;
          if (data.streamUrl) {
            const resolved = data.streamUrl;
            const resolvedPath = resolved.split("?")[0].toLowerCase();
            if (resolvedPath.endsWith(".ts")) {
              playDirect(`/api/stream-proxy?url=${encodeURIComponent(resolved)}`);
            } else if (Hls.isSupported() && (resolvedPath.endsWith(".m3u8") || resolvedPath.includes("m3u8"))) {
              const hls = new Hls({ maxMaxBufferLength: 10, enableWorker: true, lowLatencyMode: true });
              hlsRef.current = hls;
              hls.loadSource(resolved);
              hls.attachMedia(video);
              hls.on(Hls.Events.MANIFEST_PARSED, (_, d) => {
                if (!isMountedRef.current) return;
                setQualityLevels(d.levels || []);
                setCurrentLevel(hls.currentLevel);
                setIsLoading(false);
                playVideo();
              });
              hls.on(Hls.Events.ERROR, (_, d) => {
                if (!isMountedRef.current) return;
                if (d.fatal) { setErrorMsg("Live stream offline or network restricted."); setIsLoading(false); setStreamHealthy(false); hls.destroy(); }
              });
            } else {
              playDirect(resolved);
            }
          } else {
            setErrorMsg("Could not resolve playlist stream.");
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isMountedRef.current) { setErrorMsg("Failed to load playlist."); setIsLoading(false); }
        });
    } else if (isRawTs) {
      // Pipe through server-side stream proxy to bypass CORS
      playDirect(`/api/stream-proxy?url=${encodeURIComponent(channel.streamUrl)}`);
    } else if (Hls.isSupported()) {
      const hls = new Hls({ maxMaxBufferLength: 10, enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(channel.streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        if (!isMountedRef.current) return;
        setQualityLevels(data.levels || []);
        setCurrentLevel(hls.currentLevel);
        setIsLoading(false);
        playVideo();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        if (isMountedRef.current) setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!isMountedRef.current) return;
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else {
            setErrorMsg("Live stream offline or network restricted.");
            setIsLoading(false);
            setStreamHealthy(false);
            hls.destroy();
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = channel.streamUrl;
      video.addEventListener("loadedmetadata", () => { if (isMountedRef.current) { setIsLoading(false); playVideo(); } });
      video.addEventListener("error", () => { if (isMountedRef.current) { setErrorMsg("Native video error."); setIsLoading(false); } });
    } else {
      video.src = channel.streamUrl;
      video.addEventListener("loadedmetadata", () => { if (isMountedRef.current) { setIsLoading(false); playVideo(); } });
      video.addEventListener("error", () => { if (isMountedRef.current) { setErrorMsg("Browser does not support HLS. Try Chrome or Firefox."); setIsLoading(false); } });
    }

    return () => {
      isMountedRef.current = false;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      try { video.pause(); video.removeAttribute("src"); video.load(); } catch {}
    };
  }, [channel.streamUrl, channel.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = isMuted ? 0 : volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) { video.pause(); setIsPlaying(false); }
    else { video.play().then(() => setIsPlaying(true)).catch(() => {}); }
    resetHideTimer();
  };

  const handleReload = () => {
    setIsLoading(true);
    setErrorMsg(null);
    const video = videoRef.current;
    if (video) {
      if (hlsRef.current) hlsRef.current.loadSource(channel.streamUrl);
      else { video.load(); }
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const setQuality = (level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      setCurrentLevel(level);
    }
    setShowQuality(false);
  };

  const getQualityLabel = (level: number) => {
    if (level === -1) return "Auto";
    const l = qualityLevels[level];
    if (!l) return "Auto";
    return l.height ? `${l.height}p` : `Level ${level + 1}`;
  };

  const triggerHealthCheck = async () => {
    try {
      const res = await fetch(`/api/health-check?url=${encodeURIComponent(channel.streamUrl)}`);
      const data = await res.json();
      setStreamHealthy(data.isHealthy);
      setPingLatency(data.latencyMs || null);
      onStreamStatusChecked?.(data.isHealthy, data.latencyMs);
    } catch {
      setStreamHealthy(false);
      onStreamStatusChecked?.(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-xl overflow-hidden group"
      style={{ aspectRatio: "16/9" }}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
      onMouseEnter={() => setShowControls(true)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        onClick={togglePlay}
        style={{ cursor: showControls ? "default" : "none" }}
      />

      {/* Loading Overlay */}
      {isLoading && !errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20">
          <div className="w-14 h-14 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin mb-4" />
          <p className="text-sm font-medium text-white">Loading stream...</p>
          <p className="text-xs text-slate-400 mt-1">{channel.name}</p>
        </div>
      )}

      {/* Error Overlay */}
      {errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h4 className="text-base font-semibold text-white mb-2">Stream Unavailable</h4>
          <p className="text-xs text-slate-400 max-w-xs">{errorMsg}</p>
          <div className="flex gap-3 mt-5">
            <button onClick={handleReload} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
            <button onClick={triggerHealthCheck} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer">
              <Wifi className="w-3.5 h-3.5" /> Check Stream
            </button>
          </div>
        </div>
      )}

      {/* Top Bar - Channel info overlay */}
      <div className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {channel.logo ? (
              <img src={proxyLogo(channel.logo)} alt={channel.name}
                className="w-8 h-8 rounded object-contain bg-white/10"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : null}
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                  <Radio className="w-2.5 h-2.5" /> Live
                </span>
                <span className="text-white font-semibold text-sm">{channel.name}</span>
              </div>
              <p className="text-slate-400 text-xs">{channel.country} • {channel.category}</p>
            </div>
          </div>

          {/* Health indicator */}
          <button onClick={triggerHealthCheck} className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full text-xs cursor-pointer">
            {streamHealthy === false
              ? <WifiOff className="w-3 h-3 text-red-400" />
              : <Wifi className="w-3 h-3 text-green-400" />}
            <span className={streamHealthy === false ? "text-red-400" : "text-green-400"}>
              {streamHealthy === false ? "Offline" : pingLatency ? `${pingLatency}ms` : "Live"}
            </span>
          </button>
        </div>
      </div>

      {/* Center Play/Pause on click feedback */}
      {!isLoading && !errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          {!isPlaying && (
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
          )}
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-8 pb-3 z-10 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
        {/* Live progress bar */}
        <div className="w-full h-1 bg-white/20 rounded-full mb-3 relative overflow-hidden">
          <div className="absolute left-0 top-0 h-full bg-red-500 rounded-full" style={{ width: "100%" }} />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500 shadow-lg" style={{ right: 0 }} />
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Left controls */}
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition cursor-pointer">
              {isPlaying
                ? <Pause className="w-5 h-5 fill-white" />
                : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>

            <button onClick={handleReload} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition cursor-pointer">
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol">
              <button onClick={() => setIsMuted(!isMuted)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition cursor-pointer">
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range" min="0" max="1" step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => { setVolume(parseFloat(e.target.value)); if (parseFloat(e.target.value) > 0) setIsMuted(false); }}
                className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-white h-1 rounded cursor-pointer overflow-hidden"
              />
            </div>

            {/* Live badge */}
            <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Quality selector */}
            {qualityLevels.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowQuality(!showQuality)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  {getQualityLabel(currentLevel)}
                </button>
                {showQuality && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a2e] border border-white/10 rounded-lg overflow-hidden shadow-xl min-w-[100px]">
                    <div className="px-3 py-2 border-b border-white/10">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Quality</span>
                    </div>
                    <button
                      onClick={() => setQuality(-1)}
                      className={`w-full text-left px-3 py-2 text-xs transition cursor-pointer ${currentLevel === -1 ? "text-violet-400 font-semibold" : "text-slate-300 hover:bg-white/5"}`}
                    >
                      Auto
                    </button>
                    {qualityLevels.map((lvl, i) => (
                      <button
                        key={i}
                        onClick={() => setQuality(i)}
                        className={`w-full text-left px-3 py-2 text-xs transition cursor-pointer ${currentLevel === i ? "text-violet-400 font-semibold" : "text-slate-300 hover:bg-white/5"}`}
                      >
                        {lvl.height ? `${lvl.height}p` : `Level ${i + 1}`}
                        {lvl.bitrate ? <span className="text-slate-500 ml-1">({Math.round(lvl.bitrate / 1000)}k)</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Resolution badge */}
            {channel.resolution && (
              <span className="px-2 py-0.5 bg-white/10 text-white text-[10px] font-bold rounded uppercase">
                {channel.resolution}
              </span>
            )}

            {/* Fullscreen */}
            <button onClick={handleFullscreen} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition cursor-pointer">
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
