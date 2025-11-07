"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type WeatherData = {
  temperatureC: number | null;
  weatherCode: number | null;
  sunrise: Date | null;
  sunset: Date | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatTwoDigits(n: number): string {
  return n.toString().padStart(2, "0");
}

function mapWeatherCodeToIcon(code: number | null): string {
  if (code == null) return "?";
  if ([0].includes(code)) return "?"; // clear
  if ([1, 2, 3].includes(code)) return "?"; // partly cloudy
  if ([45, 48].includes(code)) return "??"; // fog
  if ([51, 53, 55, 56, 57].includes(code)) return "??"; // drizzle
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "??"; // rain
  if ([66, 67, 71, 73, 75, 77, 85, 86].includes(code)) return "??"; // snow
  if ([95, 96, 99].includes(code)) return "?"; // thunder
  return "?";
}

function useNow(): Date {
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

function useSimulatedBattery(): number {
  const [battery, setBattery] = useState<number>(() => {
    if (typeof window === "undefined") return 75;
    const stored = localStorage.getItem("batteryPercent");
    const updatedAt = localStorage.getItem("batteryUpdatedAt");
    const baseline = stored ? parseFloat(stored) : Math.round(60 + Math.random() * 40);
    const last = updatedAt ? parseInt(updatedAt, 10) : Date.now();
    const minutesSince = (Date.now() - last) / 60000;
    // Drain at ~0.04% per minute (~2.4%/hour)
    const drained = Math.max(0, baseline - minutesSince * 0.04);
    return Math.round(drained * 10) / 10;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = setInterval(() => {
      setBattery((b) => {
        const next = clamp(b - 0.0007, 0, 100); // smooth drain
        localStorage.setItem("batteryPercent", String(next));
        localStorage.setItem("batteryUpdatedAt", String(Date.now()));
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return battery;
}

function useSimulatedSteps(now: Date): number {
  const startOfDay = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);
  const goal = 10000;
  const dayProgress = clamp((now.getTime() - startOfDay.getTime()) / (24 * 3600 * 1000), 0, 1);
  const circadian = 0.5 + 0.5 * Math.sin((now.getHours() - 6) / 24 * Math.PI * 2);
  const steps = Math.round(goal * dayProgress * (0.7 + 0.6 * circadian));
  return clamp(steps, 0, goal);
}

function useSimulatedHeartRate(): number {
  const [hr, setHr] = useState<number>(72);
  useEffect(() => {
    const id = setInterval(() => {
      setHr((prev) => clamp(Math.round(prev + (Math.random() - 0.5) * 4), 58, 140));
    }, 1500);
    return () => clearInterval(id);
  }, []);
  return hr;
}

function useWeather(now: Date): WeatherData {
  const [data, setData] = useState<WeatherData>({ temperatureC: null, weatherCode: null, sunrise: null, sunset: null });

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather(lat: number, lon: number) {
      try {
        const params = new URLSearchParams({
          latitude: String(lat),
          longitude: String(lon),
          current: "temperature_2m,weather_code",
          daily: "sunrise,sunset",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Weather fetch failed");
        const j = await res.json();
        const temperatureC = typeof j?.current?.temperature_2m === "number" ? j.current.temperature_2m : null;
        const weatherCode = typeof j?.current?.weather_code === "number" ? j.current.weather_code : null;
        const sunriseStr = j?.daily?.sunrise?.[0];
        const sunsetStr = j?.daily?.sunset?.[0];
        const sunrise = sunriseStr ? new Date(sunriseStr) : null;
        const sunset = sunsetStr ? new Date(sunsetStr) : null;
        if (!cancelled) setData({ temperatureC, weatherCode, sunrise, sunset });
      } catch (e) {
        if (!cancelled) setData((d) => ({ ...d }));
      }
    }

    function fallback() {
      // London fallback
      fetchWeather(51.5074, -0.1278);
    }

    if (navigator.geolocation) {
      const id = navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fallback(),
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 }
      );
      // geolocation uses callbacks; no cleanup id
    } else {
      fallback();
    }

    return () => {
      cancelled = true;
    };
  }, [now]);

  return data;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const a = toRadians(angleDeg - 90);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function handAngle(now: Date): { hour: number; minute: number; second: number } {
  const hour = now.getHours() % 12;
  const minute = now.getMinutes();
  const second = now.getSeconds();
  return {
    hour: (hour + minute / 60) * 30, // 360/12
    minute: (minute + second / 60) * 6, // 360/60
    second: second * 6,
  };
}

function formatHhMm(now: Date): string {
  const h = now.getHours();
  const m = now.getMinutes();
  return `${formatTwoDigits(h)}:${formatTwoDigits(m)}`;
}

function getZonedDate(tz: string): Date {
  const now = new Date();
  // Create a date in target TZ by formatting parts and reconstructing
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(now)
    .reduce((acc: Record<string, string>, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {} as Record<string, string>);
  const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  return new Date(iso);
}

export function Watchface({ diameterPx = 500, secondTimezone = "UTC" }: { diameterPx?: number; secondTimezone?: string }) {
  const now = useNow();
  const battery = useSimulatedBattery();
  const steps = useSimulatedSteps(now);
  const heartRate = useSimulatedHeartRate();
  const weather = useWeather(now);
  const secondNow = useMemo(() => getZonedDate(secondTimezone), [secondTimezone, now]);

  const size = diameterPx;
  const center = size / 2;
  const radius = size * 0.46;

  const angles = handAngle(now);

  const arcPath = (startAngle: number, endAngle: number, r: number) => {
    const start = polarToCartesian(center, center, r, endAngle);
    const end = polarToCartesian(center, center, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  };

  const tickMarks = useMemo(() => {
    const lines: JSX.Element[] = [];
    for (let i = 0; i < 60; i++) {
      const isHour = i % 5 === 0;
      const len = isHour ? radius * 0.12 : radius * 0.06;
      const width = isHour ? 3 : 1.5;
      const angle = i * 6;
      const outer = polarToCartesian(center, center, radius, angle);
      const inner = polarToCartesian(center, center, radius - len, angle);
      lines.push(
        <line
          key={`tick-${i}`}
          x1={inner.x}
          y1={inner.y}
          x2={outer.x}
          y2={outer.y}
          stroke={isHour ? "#9ec1ff" : "#4b5e86"}
          strokeWidth={width}
          strokeLinecap="round"
        />
      );
    }
    return lines;
  }, [center, radius]);

  const dateStr = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "2-digit" });
    return fmt.format(now);
  }, [now]);

  const secondaryTimeStr = useMemo(() => formatHhMm(secondNow), [secondNow]);

  // Small sub-dial positions
  const subR = radius * 0.32;
  const posTop = polarToCartesian(center, center, radius * 0.55, -90);
  const posLeft = polarToCartesian(center, center, radius * 0.55, -180);
  const posRight = polarToCartesian(center, center, radius * 0.55, 0);
  const posBottom = polarToCartesian(center, center, radius * 0.55, 90);

  const gradientId = useRef(`grad-${Math.random().toString(36).slice(2)}`);
  const glowId = useRef(`glow-${Math.random().toString(36).slice(2)}`);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Garmin-style watchface">
      <defs>
        <radialGradient id={gradientId.current} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#15223d" />
          <stop offset="60%" stopColor="#0e1a33" />
          <stop offset="100%" stopColor="#0a1224" />
        </radialGradient>
        <filter id={glowId.current} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer Bezel */}
      <circle cx={center} cy={center} r={radius + 18} fill="#0b1222" stroke="#1a2a4d" strokeWidth={2} />
      <circle cx={center} cy={center} r={radius + 10} fill="#0c1426" stroke="#1b2b51" strokeWidth={2} />

      {/* Dial */}
      <circle cx={center} cy={center} r={radius} fill={`url(#${gradientId.current})`} stroke="#263b6a" strokeWidth={2} />

      {/* Tick marks */}
      {tickMarks}

      {/* Date window (bottom) */}
      <g transform={`translate(${posBottom.x}, ${posBottom.y})`}>
        <rect x={-70} y={-22} width={140} height={44} rx={10} fill="#0c1323" stroke="#1e2b4d" />
        <text x={0} y={6} textAnchor="middle" fontSize={22} fill="#cce1ff" fontWeight={600} style={{ letterSpacing: 1 }}>
          {dateStr}
        </text>
      </g>

      {/* Battery (top) */}
      <g transform={`translate(${posTop.x}, ${posTop.y})`}>
        <circle r={subR} fill="#0c1323" stroke="#1e2b4d" />
        <path d={arcPath(0, (clamp(battery, 0, 100) / 100) * 360, subR - 6)} stroke="#80ffdb" strokeWidth={6} fill="none" />
        <text x={0} y={6} textAnchor="middle" fontSize={22} fill="#80ffdb" fontWeight={700}>{Math.round(battery)}%</text>
        <text x={0} y={28} textAnchor="middle" fontSize={12} fill="#96b0d6">Battery</text>
      </g>

      {/* Steps (left) */}
      <g transform={`translate(${posLeft.x}, ${posLeft.y})`}>
        <circle r={subR} fill="#0c1323" stroke="#1e2b4d" />
        <path d={arcPath(0, (steps / 10000) * 360, subR - 6)} stroke="#2ec27e" strokeWidth={6} fill="none" />
        <text x={0} y={6} textAnchor="middle" fontSize={22} fill="#2ec27e" fontWeight={700}>{steps}</text>
        <text x={0} y={28} textAnchor="middle" fontSize={12} fill="#96b0d6">Steps</text>
      </g>

      {/* Heart rate (right) */}
      <g transform={`translate(${posRight.x}, ${posRight.y})`}>
        <circle r={subR} fill="#0c1323" stroke="#1e2b4d" />
        <path d={arcPath(0, (clamp((heartRate - 50) / 100, 0, 1)) * 360, subR - 6)} stroke="#ff4d6d" strokeWidth={6} fill="none" />
        <text x={0} y={6} textAnchor="middle" fontSize={22} fill="#ff7189" fontWeight={700}>{heartRate}</text>
        <text x={0} y={28} textAnchor="middle" fontSize={12} fill="#96b0d6">bpm</text>
      </g>

      {/* Weather (above bottom) */}
      <g transform={`translate(${center}, ${center + radius * 0.25})`}>
        <rect x={-120} y={-24} width={240} height={48} rx={12} fill="#0c1323" stroke="#1e2b4d" />
        <text x={-92} y={6} textAnchor="start" fontSize={24} fill="#f4d35e" fontWeight={700} filter={`url(#${glowId.current})`}>
          {mapWeatherCodeToIcon(weather.weatherCode)}
        </text>
        <text x={-60} y={6} textAnchor="start" fontSize={18} fill="#f4d35e" fontWeight={600}>
          {weather.temperatureC != null ? `${Math.round(weather.temperatureC)}?C` : "--"}
        </text>
        <text x={60} y={-2} textAnchor="middle" fontSize={12} fill="#96b0d6">Rise</text>
        <text x={60} y={14} textAnchor="middle" fontSize={14} fill="#c8dcff" fontWeight={600}>
          {weather.sunrise ? `${formatTwoDigits(weather.sunrise.getHours())}:${formatTwoDigits(weather.sunrise.getMinutes())}` : "--:--"}
        </text>
        <text x={100} y={-2} textAnchor="middle" fontSize={12} fill="#96b0d6">Set</text>
        <text x={100} y={14} textAnchor="middle" fontSize={14} fill="#c8dcff" fontWeight={600}>
          {weather.sunset ? `${formatTwoDigits(weather.sunset.getHours())}:${formatTwoDigits(weather.sunset.getMinutes())}` : "--:--"}
        </text>
      </g>

      {/* Second timezone subdial (center-top arc) */}
      <g transform={`translate(${center}, ${center - radius * 0.25})`}>
        <rect x={-120} y={-24} width={240} height={48} rx={12} fill="#0c1323" stroke="#1e2b4d" />
        <text x={0} y={6} textAnchor="middle" fontSize={16} fill="#b8caf0" fontWeight={600}>
          {secondTimezone}: {secondaryTimeStr}
        </text>
      </g>

      {/* Hands */}
      <g>
        {/* Hour hand */}
        <line
          x1={center}
          y1={center}
          x2={polarToCartesian(center, center, radius * 0.5, angles.hour).x}
          y2={polarToCartesian(center, center, radius * 0.5, angles.hour).y}
          stroke="#4cc9f0"
          strokeWidth={6}
          strokeLinecap="round"
          filter={`url(#${glowId.current})`}
        />
        {/* Minute hand */}
        <line
          x1={center}
          y1={center}
          x2={polarToCartesian(center, center, radius * 0.75, angles.minute).x}
          y2={polarToCartesian(center, center, radius * 0.75, angles.minute).y}
          stroke="#99e1ff"
          strokeWidth={4}
          strokeLinecap="round"
          filter={`url(#${glowId.current})`}
        />
        {/* Second hand */}
        <line
          x1={center}
          y1={center}
          x2={polarToCartesian(center, center, radius * 0.85, angles.second).x}
          y2={polarToCartesian(center, center, radius * 0.85, angles.second).y}
          stroke="#ff6b6b"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={center} cy={center} r={6} fill="#0b1222" stroke="#9ec1ff" />
      </g>

      {/* Hour numerals */}
      <g fill="#86a8ff" fontSize={16} fontWeight={600}>
        {[...Array(12)].map((_, i) => {
          const n = i + 1;
          const angle = n * 30;
          const p = polarToCartesian(center, center, radius * 0.83, angle);
          return (
            <text key={`num-${n}`} x={p.x} y={p.y + 5} textAnchor="middle">
              {n}
            </text>
          );
        })}
      </g>

      {/* Digital time readout */}
      <g>
        <rect x={center - 72} y={center - 18} width={144} height={36} rx={10} fill="#0c1323" stroke="#1e2b4d" />
        <text x={center} y={center + 6} textAnchor="middle" fontSize={22} fill="#cce1ff" fontWeight={700}>
          {formatHhMm(now)}
        </text>
      </g>
    </svg>
  );
}
