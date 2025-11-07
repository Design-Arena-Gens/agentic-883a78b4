"use client";

import React, { useMemo, useState } from "react";
import { Watchface } from "@/components/Watchface";

export default function Page() {
  const [secondTimezone, setSecondTimezone] = useState<string>(
    typeof window !== "undefined" && localStorage.getItem("secondTz")
      ? (localStorage.getItem("secondTz") as string)
      : "UTC"
  );

  const timezones = useMemo(
    () => [
      "UTC",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Asia/Dubai",
      "Asia/Tokyo",
      "Australia/Sydney",
    ],
    []
  );

  return (
    <div className="grid">
      <div className="card" style={{ display: "grid", placeItems: "center" }}>
        <Watchface diameterPx={600} secondTimezone={secondTimezone} />
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Controls</h3>
        <div className="controls">
          <select
            className="input"
            value={secondTimezone}
            onChange={(e) => {
              const v = e.target.value;
              setSecondTimezone(v);
              if (typeof window !== "undefined") localStorage.setItem("secondTz", v);
            }}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <button
            className="button"
            onClick={() => {
              if (typeof window === "undefined") return;
              localStorage.removeItem("batteryPercent");
              localStorage.removeItem("batteryUpdatedAt");
              location.reload();
            }}
          >
            Reset Simulated Battery
          </button>
        </div>
        <div className="legend">
          <div className="legend-item"><span className="dot accent" /> Time hands</div>
          <div className="legend-item"><span className="dot success" /> Steps</div>
          <div className="legend-item"><span className="dot warning" /> Weather</div>
          <div className="legend-item"><span className="dot danger" /> Heart rate</div>
        </div>
        <p className="small" style={{ marginTop: 12 }}>
          Weather uses your location via the browser and Open?Meteo. If denied, it falls back to London.
          Battery, steps and heart-rate are simulated locally.
        </p>
      </div>
    </div>
  );
}
