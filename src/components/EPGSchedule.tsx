/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Clock, Calendar, AlertCircle, PlayCircle } from "lucide-react";
import { EPGItem } from "../types";

interface EPGScheduleProps {
  channelId: string;
}

export default function EPGSchedule({ channelId }: EPGScheduleProps) {
  const [schedule, setSchedule] = useState<EPGItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch guide program on focus channel changes
  useEffect(() => {
    setLoading(true);
    fetch(`/api/epg/${channelId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSchedule(data);
        } else {
          setSchedule([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching EPG:", err);
        setSchedule([]);
        setLoading(false);
      });
  }, [channelId]);

  // Keep progress countdown alive dynamically every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // every 30s
    return () => clearInterval(timer);
  }, []);

  const formatTimeStr = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isCurrentShow = (startIso: string, endIso: string) => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    return currentTime >= start && currentTime < end;
  };

  const getProgressPercentage = (startIso: string, endIso: string) => {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const now = currentTime.getTime();

    if (now < start) return 0;
    if (now > end) return 100;

    const elapsed = now - start;
    const total = end - start;
    return Math.round((elapsed / total) * 100);
  };

  const getRemainingMinutes = (endIso: string) => {
    const end = new Date(endIso).getTime();
    const now = currentTime.getTime();
    const diff = end - now;
    if (diff <= 0) return 0;
    return Math.round(diff / 60000);
  };

  return (
    <div id="epg-schedule-box" className="glass-panel rounded-xl p-5 border border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" />
          <h3 className="font-display font-semibold text-base text-slate-100">Live TV Guide & Schedule</h3>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
          Local Time: {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : schedule.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <AlertCircle className="w-8 h-8 text-slate-500 mb-2" />
          <p className="text-slate-400 text-sm">No scheduled guide data found for this channel.</p>
        </div>
      ) : (
        <div className="relative space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {schedule.map((program) => {
            const current = isCurrentShow(program.start, program.end);
            const progress = current ? getProgressPercentage(program.start, program.end) : 0;
            const remaining = current ? getRemainingMinutes(program.end) : 0;
            const startsIn = new Date(program.start).getTime() - currentTime.getTime();
            const upcoming = startsIn > 0;

            return (
              <div
                key={program.id}
                className={`p-3.5 rounded-lg border transition-all duration-200 ${
                  current
                    ? "bg-indigo-600/10 border-indigo-500/40 shadow-sm"
                    : upcoming
                    ? "bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                    : "bg-slate-950/20 border-slate-900 text-slate-500 hover:bg-slate-900/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-medium text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-900/20">
                        {formatTimeStr(program.start)} - {formatTimeStr(program.end)}
                      </span>
                      {current && (
                        <span className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 bg-red-500 text-white font-bold rounded-full animate-pulse">
                          <PlayCircle className="w-2.5 h-2.5" />
                          On Air Now
                        </span>
                      )}
                    </div>
                    <h4 className={`text-sm font-semibold font-display ${current ? "text-slate-100" : "text-slate-300"}`}>
                      {program.title}
                    </h4>
                    {program.description && (
                      <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                        {program.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Live program progress bar */}
                {current && (
                  <div className="mt-4 space-y-1.5">
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-indigo-500 rounded-full transition-all duration-1000"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>{progress}% elapsed</span>
                      <span>{remaining} min remaining</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
