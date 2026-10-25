"use client";

// PROTOTYPE (throwaway) for ticket #77: three movement + melee feel variants,
// switchable via ?variant=A|B|C, on the throwaway /prototype/feel route.

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PrototypeSwitcher } from "@/components/prototype-switcher";
import type { FeelSnapshot } from "./sim";
import {
  type FeelConfig,
  VARIANT_KEYS,
  VARIANTS,
  type VariantKey,
} from "./variants";

const GameCanvas = dynamic(() => import("./game-canvas"), { ssr: false });

type NumKey =
  | "speed"
  | "attackTime"
  | "hitFrac"
  | "range"
  | "knockback"
  | "hitstopMs"
  | "shake";
const SLIDERS: [NumKey, string, number, number, number][] = [
  ["speed", "Move speed (tiles/s)", 1, 9, 0.25],
  ["attackTime", "Swing time (s)", 0.15, 1.2, 0.05],
  ["hitFrac", "Hit lands at (fraction of swing)", 0.1, 0.95, 0.05],
  ["range", "Melee reach (tiles)", 0.8, 2.5, 0.1],
  ["knockback", "Knockback (tiles)", 0, 1.5, 0.05],
  ["hitstopMs", "Hitstop (ms)", 0, 150, 5],
  ["shake", "Camera shake (px)", 0, 16, 1],
];
type BoolKey = "buffer" | "cancelAfterHit" | "repeatWhileHeld";
const TOGGLES: [BoolKey, string][] = [
  ["buffer", "Buffer clicks during swing"],
  ["cancelAfterHit", "Move cancels swing after hit"],
  ["repeatWhileHeld", "Hold = keep swinging"],
];

export function FeelPrototype() {
  const params = useSearchParams();
  const raw = params.get("variant") ?? "A";
  const variant: VariantKey = raw in VARIANTS ? (raw as VariantKey) : "A";
  // The sim reads this object every frame, so knobs mutate it in place.
  const config = useMemo<FeelConfig>(
    () => ({ ...VARIANTS[variant] }),
    [variant],
  );
  const [, rerender] = useState(0);
  const [snap, setSnap] = useState<FeelSnapshot | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof FeelConfig>(k: K, v: FeelConfig[K]) => {
    config[k] = v;
    rerender((n) => n + 1);
  };

  return (
    <>
      <GameCanvas config={config} onSnapshot={setSnap} />

      <div style={{ ...panel, left: 12, width: 290 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {variant}: {config.name}
        </div>
        <div style={{ opacity: 0.75, marginBottom: 8 }}>{config.blurb}</div>
        <Choice
          label="Movement"
          value={config.moveMode}
          options={["tile", "free"]}
          onChange={(v) => set("moveMode", v as FeelConfig["moveMode"])}
        />
        <Choice
          label="Input"
          value={config.input}
          options={["click", "hold"]}
          onChange={(v) => set("input", v as FeelConfig["input"])}
        />
        <Choice
          label="Facing"
          value={config.facing}
          options={["8", "free"]}
          onChange={(v) => set("facing", v as FeelConfig["facing"])}
        />
        {SLIDERS.map(([k, label, min, max, step]) => (
          <label key={k} style={{ display: "block", marginTop: 6 }}>
            {label}: <b>{config[k]}</b>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={config[k]}
              onChange={(e) => set(k, Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
        ))}
        {TOGGLES.map(([k, label]) => (
          <label key={k} style={{ display: "block", marginTop: 4 }}>
            <input
              type="checkbox"
              checked={config[k]}
              onChange={(e) => set(k, e.target.checked)}
            />{" "}
            {label}
          </label>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button
            type="button"
            style={btn}
            onClick={() => {
              Object.assign(config, VARIANTS[variant]);
              rerender((n) => n + 1);
            }}
          >
            Reset knobs
          </button>
          <button
            type="button"
            style={btn}
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(config, null, 2));
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? "Copied!" : "Copy settings"}
          </button>
        </div>
      </div>

      <div style={{ ...panel, right: 12, width: 260 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>State</div>
        {snap &&
          Object.entries(snap).map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span style={{ opacity: 0.6 }}>{k}</span>
              <span>{String(v)}</span>
            </div>
          ))}
        <div style={{ marginTop: 10, opacity: 0.7 }}>
          Left-click ground: move · Left-click a dummy: attack · Shift + click:
          swing in place · ←/→: switch variant
        </div>
      </div>

      <PrototypeSwitcher
        variants={VARIANT_KEYS}
        labels={Object.fromEntries(
          VARIANT_KEYS.map((k) => [k, VARIANTS[k].name]),
        )}
      />
    </>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}
    >
      <span style={{ width: 70 }}>{label}</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          style={{ ...btn, background: o === value ? "#4a7bd8" : "#2a2a33" }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

const panel: React.CSSProperties = {
  position: "fixed",
  top: 12,
  padding: 10,
  borderRadius: 8,
  background: "rgba(10,10,14,.85)",
  color: "#ddd",
  font: "12px/1.35 system-ui, sans-serif",
  zIndex: 10,
  maxHeight: "calc(100vh - 80px)",
  overflowY: "auto",
};
const btn: React.CSSProperties = {
  background: "#2a2a33",
  color: "#eee",
  border: 0,
  borderRadius: 4,
  padding: "4px 8px",
  cursor: "pointer",
  font: "inherit",
};
