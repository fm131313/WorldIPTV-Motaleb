import React from "react";
import {
  Home,
  Tv,
  Grid,
  Globe,
  Heart,
  Calendar,
  Clock,
  TrendingUp,
  List,
  Settings,
  Crown,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

const navItems = [
  { icon: Home, label: "Home", route: "/" },
  { icon: Tv, label: "Live TV", route: "/live" },
  { icon: Grid, label: "Categories", route: "/categories" },
  { icon: Globe, label: "Countries", route: "/countries" },
  { icon: Heart, label: "Favorites", route: "/favorites" },
  { icon: Calendar, label: "Schedule", route: "/schedule" },
];

const quickItems = [
  { icon: Clock, label: "Recently Viewed", route: "/history" },
  { icon: TrendingUp, label: "Trending Now", route: "/trending" },
  { icon: List, label: "My List", route: "/mylist" },
  { icon: Settings, label: "Settings", route: "/settings" },
];

export default function Sidebar({ currentRoute, onNavigate }: SidebarProps) {
  const isActive = (route: string) => {
    if (route === "/" && currentRoute === "/") return true;
    if (route !== "/" && currentRoute.startsWith(route)) return true;
    return false;
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-[#0d0d1a] border-r border-white/5 flex flex-col z-30 overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-lg leading-none">VistaTV</span>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">LIVE. ANYTIME.</p>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ icon: Icon, label, route }) => (
          <button
            key={route}
            onClick={() => onNavigate(route)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              isActive(route)
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className="w-4.5 h-4.5 shrink-0" />
            {label}
          </button>
        ))}

        {/* Quick Access */}
        <div className="pt-4 pb-1">
          <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Quick Access
          </span>
        </div>

        {quickItems.map(({ icon: Icon, label, route }) => (
          <button
            key={route}
            onClick={() => onNavigate(route)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              isActive(route)
                ? "bg-violet-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className="w-4.5 h-4.5 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* Go Premium */}
      <div className="m-3 p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
        <div className="flex items-center gap-2 mb-1">
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Go Premium</span>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">Unlock ad-free streaming &amp; exclusive channels.</p>
        <button className="w-full py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-lg hover:opacity-90 transition cursor-pointer">
          Upgrade Now
        </button>
      </div>
    </aside>
  );
}
