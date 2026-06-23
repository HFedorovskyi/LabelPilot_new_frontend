import React from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm transition-all hover:bg-white/[0.07]">
      <div className="absolute -right-4 -top-4 text-white/[0.03]">
        {icon}
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">{title}</h3>
        {trend && (
          <span
            className={cx(
              "flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5",
              trend === "up" ? "bg-emerald-500/10 text-emerald-400" : 
              trend === "down" ? "bg-rose-500/10 text-rose-400" : 
              "bg-white/10 text-white/60"
            )}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "−"}
            {trendValue}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold text-white tracking-tight">{value}</span>
      </div>
      {subtitle && (
        <p className="mt-2 text-sm text-white/40 font-medium">{subtitle}</p>
      )}
    </div>
  );
}
