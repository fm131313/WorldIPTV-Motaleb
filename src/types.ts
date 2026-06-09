/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface IPTVChannel {
  id: string;
  name: string;
  logo?: string;
  country: string;
  countryCode: string; // e.g., "BD", "US", "GB"
  category: string;    // e.g., "News", "Sports", "Movies", "Music", "Kids", "Entertainment", "Documentary", "Religious"
  language: string;    // e.g., "Bengali", "English", "Spanish"
  streamUrl: string;
  bitrate?: number;    // kbps
  resolution?: string; // e.g., "1080p", "720p", "SD"
  epgLink?: string;    // EPG source XML
  isHealthy?: boolean;
  latencyMs?: number;
  lastChecked?: string;
}

export interface EPGItem {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  start: string; // ISO timestamp
  end: string;   // ISO timestamp
}

export interface UserFavorite {
  channelId: string;
  addedAt: string;
}

export interface PlaybackHistory {
  channelId: string;
  playedAt: string;
}

export interface CountryMetadata {
  name: string;
  code: string;
  flag?: string;
  count: number;
}

export interface CategoryMetadata {
  name: string;
  count: number;
}
