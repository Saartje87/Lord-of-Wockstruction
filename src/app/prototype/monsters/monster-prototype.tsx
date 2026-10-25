"use client";

// PROTOTYPE (throwaway) for ticket #82: three Monster behaviour variants,
// switchable via ?variant=A|B|C, on the throwaway /prototype/monsters route.

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PrototypeSwitcher } from "@/components/prototype-switcher";
import type { MonsterSnapshot } from "./sim";
import {
  type MonsterConfig,
  VARIANT_KEYS,
  VARIANTS,
  type VariantKey,
} from "./variants";

const GameCanvas = dynamic(() => import("./game-canvas"), { ssr: false });

type NumKey = {
  [K in keyof MonsterConfig]: MonsterConfig[K] extends number ? K : never;
}[keyof MonsterConfig];
type BoolKey = {
  [K in keyof MonsterConfig]: MonsterConfig[K] extends boolean ? K : never;
}[keyof MonsterConfig];

const GROUPS: {
  title: string;
  sliders: [NumKey, string, number, number, number][];
  toggles?: [BoolKey, string][];
}[] = [
  {
    title: "Noticing",
    sliders: [
      ["aggroRadius", "Aggro radius (tiles)", 1, 14, 0.5],
      ["spreadRadius", "Aggro spreads to (tiles, 0 = off)", 0, 14, 0.5],
      ["wanderRadius", "Wander radius (tiles)", 0, 6, 0.5],
    ],
    toggles: [
      ["needsSight", "Needs line of sight"],
      ["wander", "Wander while idle"],
    ],
  },
  {
    title: "Chasing",
    sliders: [
      ["monsterSpeed", "Monster speed (tiles/s, Hero 5.5)", 0.5, 6, 0.1],
      ["leash", "Leash from spawn (tiles, 0 = never)", 0, 30, 1],
    ],
  },
  {
    title: "Attacking",
    sliders: [
      ["reach", "Reach (tiles)", 0.5, 2.5, 0.1],
      ["windUp", "Wind-up / telegraph (s)", 0.1, 1.2, 0.05],
      ["recovery", "Recovery between swings (s)", 0.2, 3, 0.05],
      ["jitter", "Recovery jitter (s)", 0, 1.5, 0.05],
      ["maxAttackers", "Max winding up at once (0 = all)", 0, 6, 1],
    ],
  },
  {
    title: "Hit reaction",
    sliders: [
      ["flinchChance", "Monster flinch chance", 0, 1, 0.05],
      ["flinchTime", "Monster flinch time (s)", 0, 0.8, 0.02],
      ["heroFlinchChance", "Hero flinch chance", 0, 1, 0.05],
      ["heroFlinchTime", "Hero flinch time (s)", 0, 0.6, 0.02],
      ["shake", "Shake when Hero is hit (px)", 0, 16, 1],
    ],
    toggles: [["flinchInterrupts", "Flinch cancels a Monster's wind-up"]],
  },
  {
    title: "Numbers",
    sliders: [
      ["heroLife", "Hero Life", 20, 400, 10],
      ["monsterLife", "Monster Life (Hero hits for 25)", 25, 300, 5],
      ["monsterDamage", "Monster damage", 1, 40, 1],
    ],
    toggles: [["showRadii", "Show aggro / spread / leash radii"]],
  },
];

export function MonsterPrototype() {
  const params = useSearchParams();
  const raw = params.get("variant") ?? "A";
  const variant: VariantKey = raw in VARIANTS ? (raw as VariantKey) : "A";
  // The sim reads this object every frame, so knobs mutate it in place.
  const config = useMemo<MonsterConfig>(
    () => ({ ...VARIANTS[variant] }),
    [variant],
  );
  const [, rerender] = useState(0);
  const [snap, setSnap] = useState<MonsterSnapshot | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof MonsterConfig>(k: K, v: MonsterConfig[K]) => {
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
        <div style={{ opacity: 0.75, marginBottom: 4 }}>{config.blurb}</div>
        <Choice
          label="Pathing"
          value={config.pathing}
          options={["direct", "astar"]}
          onChange={(v) => set("pathing", v as MonsterConfig["pathing"])}
        />
        {GROUPS.map((grp) => (
          <div key={grp.title} style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 700, opacity: 0.85 }}>{grp.title}</div>
            {grp.sliders.map(([k, label, min, max, step]) => (
              <label key={k} style={{ display: "block", marginTop: 4 }}>
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
            {grp.toggles?.map(([k, label]) => (
              <label key={k} style={{ display: "block", marginTop: 2 }}>
                <input
                  type="checkbox"
                  checked={config[k]}
                  onChange={(e) => set(k, e.target.checked)}
                />{" "}
                {label}
              </label>
            ))}
          </div>
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

      <div style={{ ...panel, right: 12, width: 280 }}>
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
              <span style={{ textAlign: "right" }}>{String(v)}</span>
            </div>
          ))}
        <div style={{ marginTop: 10, opacity: 0.7 }}>
          Hold left mouse: walk · Click / hold on a Monster: attack · Shift +
          click: swing in place · R: respawn everything · H: heal · ←/→: switch
          variant
        </div>
        <div style={{ marginTop: 6, opacity: 0.7 }}>
          Green floor is the start. Packs of 1, 3, 5, 4, 7 and 2 Skeletons. Red
          wedge = Monster wind-up; step out of it to dodge.
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
