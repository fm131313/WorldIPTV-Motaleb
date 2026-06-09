/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";

interface M3UPlaylistImporterProps {
  onImportSuccess: (count: number) => void;
}

export default function M3UPlaylistImporter({ onImportSuccess }: M3UPlaylistImporterProps) {
  const [playlistText, setPlaylistText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDoc, setShowDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (textToSubmit: string) => {
    if (!textToSubmit.trim()) {
      setImportStatus({ type: "error", msg: "Please enter or upload playlist content first." });
      return;
    }

    setLoading(true);
    setImportStatus(null);

    try {
      const res = await fetch("/api/playlists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSubmit })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setImportStatus({
          type: "success",
          msg: `Successfully imported ${data.count} public IPTV streams! They are now searchable and browsable in your list.`
        });
        setPlaylistText("");
        onImportSuccess(data.count);
      } else {
        setImportStatus({ type: "error", msg: data.error || "Failed to process playlist file." });
      }
    } catch (err: any) {
      setImportStatus({ type: "error", msg: `Failed connecting to server: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleFileRead = (file: File) => {
    if (!file) return;
    
    // Safety size checks
    if (file.size > 15 * 1024 * 1024) {
      setImportStatus({ type: "error", msg: "File is too large. Maximum size is 15MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setPlaylistText(content);
        setImportStatus(null);
        // Automatically trigger import for convenience
        handleImport(content);
      }
    };
    reader.onerror = () => {
      setImportStatus({ type: "error", msg: "Error reading selected playlist file." });
    };
    reader.readAsText(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileRead(files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileRead(files[0]);
    }
  };

  return (
    <div id="m3u-importer-container" className="glass-panel p-5 rounded-xl border border-slate-800 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-indigo-400" />
          <h3 className="font-display font-semibold text-base text-slate-100">Custom M3U Stream Importer</h3>
        </div>
        <button
          onClick={() => setShowDoc(!showDoc)}
          className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1.5 font-medium cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Format Specs
        </button>
      </div>

      {showDoc && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 text-xs text-slate-400 space-y-2 leading-relaxed">
          <p className="font-semibold text-slate-300">Supported Syntax (M3U Standard):</p>
          <p>Each playlist text must initiate with <code className="text-pink-400">#EXTM3U</code> followed by channels defined in blocks:</p>
          <pre className="p-2.5 bg-slate-950 rounded text-[10px] font-mono overflow-x-auto text-emerald-400 leading-normal">
{`#EXTM3U
#EXTINF:-1 tvg-id="btv" tvg-logo="https://logo.png" group-title="News",BTV News
http://stream-source/live.m3u8`}
          </pre>
          <p>Imports will tag streams with your categories for filtering.</p>
        </div>
      )}

      {/* Drag and Drop Zone */}
      <div
        id="playlist-drop-zone"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-indigo-500 bg-indigo-500/5"
            : "border-slate-800 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".m3u,.m3u8,text/plain"
          onChange={onFileChange}
          className="hidden"
        />
        <FileText className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-200">
          Drag and drop your M3U / M3U8 playlist here
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Or <span className="text-indigo-400 font-semibold underline">browse hardware files</span> (max 15MB)
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="raw-m3u-textarea" className="block text-xs font-medium text-slate-400 font-mono">
          Or paste raw EXTM3U spreadsheet payload:
        </label>
        <textarea
          id="raw-m3u-textarea"
          value={playlistText}
          onChange={(e) => setPlaylistText(e.target.value)}
          placeholder={`#EXTM3U\n#EXTINF:-1 group-title="Sports",My Sports TV\nhttps://mybroadcaster.com/live.m3u8`}
          rows={5}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <button
        id="btn-import-m3u"
        onClick={() => handleImport(playlistText)}
        disabled={loading}
        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        ) : (
          "Parse & Inject Playlist"
        )}
      </button>

      {importStatus && (
        <div
          id="import-message-alert"
          className={`p-3 rounded-lg flex items-start gap-2.5 text-xs leading-relaxed ${
            importStatus.type === "success"
              ? "bg-green-950/40 border border-green-900/40 text-green-300"
              : "bg-red-950/40 border border-red-900/40 text-red-300"
          }`}
        >
          {importStatus.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-green-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          )}
          <span>{importStatus.msg}</span>
        </div>
      )}
    </div>
  );
}
