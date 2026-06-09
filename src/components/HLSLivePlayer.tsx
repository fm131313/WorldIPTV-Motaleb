/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, Maximize, RefreshCw, AlertTriangle, ShieldCheck, Zap, Activity } from "lucide-react";
import { IPTVChannel } from "../types";

interface HLSLivePlayerProps {
  channel: IPTVChannel;
  onPlaySuccess?: () => void;
  onStreamStatusChecked?: (isHealthy: boolean, latency?: number) => void;
}

export default function HLSLivePlayer({ channel, onPlaySuccess, onStreamStatusChecked }: HLSLivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // Stream Metrics
  const [pingLatency, setPingLatency] = useState<number | null>(channel.latencyMs || null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [streamHealthy, setStreamHealthy] = useState<boolean | null>(channel.isHealthy !== undefined ? channel.isHealthy : null);

  // Trigger stream loading
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(true);
    setErrorMsg(null);
    setIsPlaying(false);

    const video = videoRef.current;
    if (!video) return;

    // Reset stream tracking metrics
    setPingLatency(channel.latencyMs || null);
    setStreamHealthy(channel.isHealthy !== undefined ? channel.isHealthy : null);

    // Save playing event back to express history DB
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: channel.id })
    })
      .then(() => {
        if (isMountedRef.current) onPlaySuccess?.();
      })
      .catch((err) => console.error("Error logging history:", err));

    // Cleanup previous hls stream
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const playVideo = async () => {
      if (!isMountedRef.current) return;
      try {
        await video.play();
        if (isMountedRef.current) {
          setIsPlaying(true);
        }
      } catch (err) {
        console.warn("Autoplay block or playback interruption:", err);
        if (isMountedRef.current) {
          setIsPlaying(false);
        }
      }
    };

    if (Hls.isSupported() && channel.streamUrl.includes(".m3u8")) {
      const hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;

      hls.loadSource(channel.streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isMountedRef.current) {
          setIsLoading(false);
          playVideo();
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (!isMountedRef.current) return;
        if (data.fatal) {
          console.warn("Fatal HLS error encountered:", data.type);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setErrorMsg("Playback error: Live stream offline or network restricted.");
              setIsLoading(false);
              setStreamHealthy(false);
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari support
      video.src = channel.streamUrl;
      const onLoadedMetadata = () => {
        if (isMountedRef.current) {
          setIsLoading(false);
          playVideo();
        }
      };
      const onError = () => {
        if (isMountedRef.current) {
          setErrorMsg("Native video error: failed to stream this link.");
          setIsLoading(false);
          setStreamHealthy(false);
        }
      };
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("error", onError);
    } else {
      // General format fallback or direct mp4 wrapper
      video.src = channel.streamUrl;
      const onLoadedMetadata = () => {
        if (isMountedRef.current) {
          setIsLoading(false);
          playVideo();
        }
      };
      const onError = () => {
        if (isMountedRef.current) {
          setErrorMsg("This browser does not support HLS stream decoding. Try playing with Safari, Chrome or Firefox.");
          setIsLoading(false);
          setStreamHealthy(false);
        }
      };
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("error", onError);
    }

    return () => {
      isMountedRef.current = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch (e) {
        console.warn("Error resetting video element during state cleanup:", e);
      }
    };
  }, [channel.streamUrl, channel.id]);

  // Audio configuration updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = isMuted ? 0 : volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => setIsPlaying(true)).catch((err) => console.error(err));
    }
  };

  const handleReload = () => {
    setIsLoading(true);
    setErrorMsg(null);
    const video = videoRef.current;
    if (video) {
      video.load();
      if (hlsRef.current) {
        hlsRef.current.loadSource(channel.streamUrl);
      }
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0) setIsMuted(false);
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if ((video as any).webkitRequestFullscreen) {
      (video as any).webkitRequestFullscreen(); // Safari
    }
  };

  // Run a stream health check on the Express backend!
  const triggerHealthCheck = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch(`/api/health-check?url=${encodeURIComponent(channel.streamUrl)}`);
      const data = await res.json();
      setStreamHealthy(data.isHealthy);
      if (data.isHealthy) {
        setPingLatency(data.latencyMs || 250);
        onStreamStatusChecked?.(true, data.latencyMs);
      } else {
        setPingLatency(null);
        onStreamStatusChecked?.(false);
      }
    } catch (err) {
      setStreamHealthy(false);
      setPingLatency(null);
      onStreamStatusChecked?.(false);
    } finally {
      setCheckingHealth(false);
    }
  };

  return (
    <div id="video-stage" className={`relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 transition-all duration-300 ${isTheaterMode ? "col-span-full" : ""}`}>
      {/* Aspect ratio frame */}
      <div className="relative aspect-video w-full">
        {/* Actual Video Element */}
        <video
          id="live-player-element"
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          onClick={togglePlay}
        />

        {/* Loading Spinner */}
        {isLoading && !errorMsg && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-20">
            <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm font-mono text-slate-300">Establishing stream handshake...</p>
            <p className="text-xs text-slate-500 mt-1">Connecting to feed: {channel.name}</p>
          </div>
        )}

        {/* Error State Overlay */}
        {errorMsg && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 z-20 p-6 text-center">
            <AlertTriangle className="w-14 h-14 text-red-500 mb-4" />
            <h4 className="text-lg font-display font-semibold text-slate-200">Stream Connection Offline</h4>
            <p className="text-xs text-slate-400 max-w-md mt-2 leading-relaxed">
              {errorMsg}
            </p>
            <p className="text-xs text-indigo-400 mt-1 font-mono">{channel.streamUrl}</p>
            <div className="flex gap-4 mt-6">
              <button
                id="btn-retry-player"
                onClick={handleReload}
                className="px-4 py-2 bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-lg flex items-center gap-2 text-xs font-medium border border-slate-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Stream
              </button>
              <button
                id="btn-healthcheck-player"
                onClick={triggerHealthCheck}
                disabled={checkingHealth}
                className="px-4 py-2 bg-indigo-950 text-indigo-300 hover:bg-slate-800 rounded-lg flex items-center gap-2 text-xs font-medium border border-indigo-900 transition"
              >
                <Activity className="w-3.5 h-3.5" />
                {checkingHealth ? "Pinging Server..." : "Check Stream Route"}
              </button>
            </div>
          </div>
        )}

        {/* Header HUD overlay */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center gap-2.5 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800/40">
            <span className="w-2 h-2 rounded-full bg-red-500 live-pulse" />
            <span className="text-xs uppercase font-mono tracking-widest text-slate-200 font-medium">LIVE BROADCAST</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Stream Health Indicator */}
            <span className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-800/40 text-xs font-mono">
              <Activity className={`w-3.5 h-3.5 ${streamHealthy === false ? "text-yellow-500" : "text-green-500"}`} />
              <button 
                onClick={(e) => { e.preventDefault(); triggerHealthCheck(); }} 
                disabled={checkingHealth}
                className="pointer-events-auto text-slate-300 hover:text-indigo-400 font-semibold focus:outline-none"
              >
                {checkingHealth ? "Checking..." : streamHealthy === false ? "Dead Feed" : streamHealthy === true ? `${pingLatency ? pingLatency + 'ms' : 'Healthy'}` : "Check Health"}
              </button>
            </span>

            {/* Resolution/Quality tag */}
            <span className="bg-slate-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-md border border-slate-800/40 text-[10px] font-mono font-bold text-indigo-400">
              {channel.resolution || "AUTO"}
            </span>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 flex items-center justify-between text-slate-300">
        <div className="flex items-center gap-4">
          <button
            id="control-btn-play"
            onClick={togglePlay}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow-md"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <button
            id="control-btn-reload"
            onClick={handleReload}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700"
            title="Refresh stream feed"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Volume control */}
          <div className="flex items-center gap-2">
            <button
              id="control-btn-mute"
              onClick={toggleMute}
              className="p-2 text-slate-400 hover:text-white transition"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              id="volume-slider-input"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 accent-indigo-500 h-1 rounded bg-slate-700 appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Title HUD */}
        <div className="hidden md:block text-center max-w-sm truncate">
          <span className="text-xs font-medium text-slate-400">{channel.country} • {channel.category}</span>
          <h4 className="text-sm font-semibold text-slate-200 mt-0.5">{channel.name}</h4>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="control-btn-theater"
            onClick={() => setIsTheaterMode(!isTheaterMode)}
            className={`px-3 py-1.5 text-xs rounded-lg font-mono tracking-wider border transition ${
              isTheaterMode
                ? "bg-indigo-900 border-indigo-700 text-indigo-300"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white"
            }`}
            title="Theater Mode"
          >
            [THEATER]
          </button>

          <button
            id="control-btn-fullscreen"
            onClick={handleFullscreen}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700"
            title="Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
