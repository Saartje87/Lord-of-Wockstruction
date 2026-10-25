"use client";

// PROTOTYPE (throwaway) for ticket #86: three HUD variants, switchable via
// ?variant=A|B|C, on the throwaway /prototype/hud route. Variant A draws its HUD
// in Pixi (see sim.ts); B and C draw theirs here, as DOM over the canvas.

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PrototypeSwitcher } from "@/components/prototype-switcher";
import type { GameHandle } from "./game-canvas";
import type { HudView, MonsterSnapshot } from "./sim";
import {
  type HudConfig,
  VARIANT_KEYS,
  VARIANTS,
  type VariantKey,
} from "./variants";

const GameCanvas = dynamic(() => import("./game-canvas"), { ssr: false });

export function HudPrototype() {
  const params = useSearchParams();
  const raw = params.get("variant") ?? "A";
  const variant: VariantKey = raw in VARIANTS ? (raw as VariantKey) : "A";
  const hud: HudConfig = VARIANTS[variant];
  const handleRef = useRef<GameHandle | null>(null);
  const [snap, setSnap] = useState<MonsterSnapshot | null>(null);
  const [view, setView] = useState<HudView | null>(null);
  const [menu, setMenu] = useState(false);
  const [title, setTitle] = useState(hud.credits === "title");
  const [info, setInfo] = useState(true);
  const blockedRef = useRef(false);
  blockedRef.current = menu || title;

  useEffect(() => {
    setMenu(false);
    setTitle(hud.credits === "title");
  }, [hud]);

  useEffect(() => {
    if (hud.layer === "pixi") return;
    let raf = 0;
    const loop = () => {
      const h = handleRef.current;
      if (h) setView(h.view());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hud]);

  return (
    <>
      <GameCanvas
        key={variant}
        hud={hud}
        onSnapshot={setSnap}
        handleRef={handleRef}
        blocked={() => blockedRef.current}
        toggleMenu={() => setMenu((m) => !m)}
      />

      {hud.layer !== "pixi" && view && (
        <DomHud hud={hud} v={view} openCredits={() => setMenu(true)} />
      )}
      {menu && <Menu onClose={() => setMenu(false)} />}
      {title && <TitleCard onStart={() => setTitle(false)} />}

      <div style={{ ...panel, right: 12, width: info ? 290 : "auto" }}>
        <button
          type="button"
          onClick={() => setInfo(!info)}
          style={{ ...btn, float: "right" }}
        >
          {info ? "hide" : "info"}
        </button>
        {info && (
          <>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {variant}: {hud.name}
            </div>
            <div style={{ opacity: 0.75, margin: "4px 0 8px" }}>
              {hud.blurb}
            </div>
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
            <div style={{ marginTop: 8, opacity: 0.7 }}>
              Hold left mouse: walk · Click a Monster: attack · Esc: menu · K:
              drop to 1 Life · H: heal · R: respawn · ←/→: switch variant
            </div>
          </>
        )}
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

function DomHud({
  hud,
  v,
  openCredits,
}: {
  hud: HudConfig;
  v: HudView;
  openCredits: () => void;
}) {
  const frac = Math.max(0, v.life / v.maxLife);
  const deathIn = Math.min(1, Math.max(0, v.deadT - 1) / 0.4);
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
      {/* B: Life bar with status pill, top-left */}
      {hud.life === "bar" && (
        <div style={{ position: "absolute", left: 16, top: 16, width: 260 }}>
          <div
            style={{
              height: 20,
              background: "rgba(0,0,0,.6)",
              border: "1px solid #555",
              borderRadius: 3,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${frac * 100}%`,
                height: "100%",
                background: "linear-gradient(#d83a3a, #8a1414)",
                transition: "width 120ms",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                font: "600 12px system-ui, sans-serif",
                textShadow: "0 1px 2px #000",
              }}
            >
              {Math.ceil(v.life)} / {v.maxLife}
            </div>
          </div>
          {!v.dead && <StatusPill v={v} />}
        </div>
      )}

      {/* Monster Life bars over heads */}
      {hud.monsterBars === "always" &&
        !v.dead &&
        v.bars.map((b) => (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: b.x - 15,
              top: b.y,
              width: 30,
              height: 4,
              background: "rgba(0,0,0,.7)",
              outline: b.hovered ? "1px solid #d8c890" : undefined,
            }}
          >
            <div
              style={{
                width: `${(b.life / b.maxLife) * 100}%`,
                height: "100%",
                background: b.life < b.maxLife ? "#c02020" : "#7a1a1a",
              }}
            />
          </div>
        ))}

      {/* C: Diablo-style nameplate on hover, top-centre */}
      {hud.nameplate && v.hovered && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 240,
            padding: "6px 12px 8px",
            background: "rgba(0,0,0,.65)",
            textAlign: "center",
            color: "#e8e0c8",
            font: "16px Georgia, serif",
          }}
        >
          {v.hovered.name}
          <div style={{ height: 8, marginTop: 4, background: "#2a0606" }}>
            <div
              style={{
                width: `${(v.hovered.life / v.hovered.maxLife) * 100}%`,
                height: "100%",
                background: "#a01818",
              }}
            />
          </div>
        </div>
      )}

      {/* hit flash */}
      {v.flash > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: v.flash,
            background:
              hud.flash === "vignette"
                ? "radial-gradient(ellipse at center, transparent 45%, rgba(255,0,0,.45) 100%)"
                : "radial-gradient(ellipse at center, transparent 65%, rgba(255,0,0,.25) 100%)",
          }}
        />
      )}

      {/* death */}
      {v.dead && hud.death === "blackout" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(0,0,0,${Math.min(0.85, v.deadT * 0.85)})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            opacity: 1,
          }}
        >
          <div
            style={{
              opacity: deathIn,
              color: "#ddd",
              font: "300 44px system-ui, sans-serif",
              letterSpacing: 8,
              textTransform: "uppercase",
            }}
          >
            You died
          </div>
          <div
            style={{
              opacity: deathIn * 0.6,
              color: "#aaa",
              font: "14px system-ui",
            }}
          >
            Click to return to Town
          </div>
        </div>
      )}
      {v.dead && hud.death === "d2" && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "22%",
            textAlign: "center",
            opacity: deathIn,
            font: "Georgia, serif",
          }}
        >
          <div
            style={{
              color: "#c8b070",
              font: "40px Georgia, serif",
              textShadow: "0 2px 8px #000",
            }}
          >
            You died
          </div>
          <div
            style={{
              color: "#c8bfa8",
              font: "16px Georgia, serif",
              marginTop: 6,
              textShadow: "0 1px 4px #000",
            }}
          >
            Click to return to Town
          </div>
        </div>
      )}

      {/* return-to-Town fade */}
      {v.fade > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#000",
            opacity: v.fade,
          }}
        />
      )}

      {/* B: always-visible credits link */}
      {hud.credits === "corner" && (
        <button
          type="button"
          onClick={openCredits}
          style={{
            position: "absolute",
            right: 10,
            bottom: 8,
            pointerEvents: "auto",
            background: "none",
            border: 0,
            color: "rgba(255,255,255,.45)",
            font: "11px system-ui, sans-serif",
            cursor: "pointer",
          }}
        >
          Art: Flare (CC-BY-SA 3.0) · Credits
        </button>
      )}
    </div>
  );
}

function StatusPill({ v }: { v: HudView }) {
  const [text, color] = v.inCombat
    ? [
        v.calmIn === null
          ? "⚔ In Combat"
          : `⚔ In Combat · regen in ${Math.ceil(v.calmIn)} s`,
        "#d84a3a",
      ]
    : v.regenerating
      ? ["✚ Regenerating +2/s", "#6ac46a"]
      : ["Full Life", "#888"];
  return (
    <div
      style={{
        display: "inline-block",
        marginTop: 6,
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(0,0,0,.6)",
        color,
        font: "600 11px system-ui, sans-serif",
      }}
    >
      {text}
    </div>
  );
}

const CREDITS = (
  <>
    Art: Flare game assets,{" "}
    <a
      href="https://github.com/flareteam/flare-game"
      style={{ color: "#c8b070" }}
    >
      flareteam/flare-game
    </a>
    <br />
    by the Flare contributors, licensed{" "}
    <a
      href="https://creativecommons.org/licenses/by-sa/3.0/"
      style={{ color: "#c8b070" }}
    >
      CC-BY-SA 3.0
    </a>
    <br />
    <a href="/assets/CREDITS.txt" style={{ color: "#c8b070" }}>
      Full credits
    </a>
  </>
);

function Menu({ onClose }: { onClose: () => void }) {
  return (
    // biome-ignore lint/a11y: prototype overlay; Esc also closes
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        display: "grid",
        placeItems: "center",
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: "#15120e",
          border: "2px solid #6b6258",
          padding: "24px 36px",
          color: "#e8e0c8",
          font: "15px/1.6 Georgia, serif",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 22, marginBottom: 12 }}>Paused</div>
        <div style={{ opacity: 0.8 }}>Credits</div>
        {CREDITS}
        <div style={{ marginTop: 16, opacity: 0.6, fontSize: 13 }}>
          Click or Esc to resume
        </div>
      </div>
    </div>
  );
}

function TitleCard({ onStart }: { onStart: () => void }) {
  return (
    // biome-ignore lint/a11y: prototype overlay; Esc also closes
    <div
      onClick={onStart}
      style={{
        position: "fixed",
        inset: 0,
        background: "#0b0a08",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#e8e0c8",
        font: "15px/1.6 Georgia, serif",
        textAlign: "center",
        zIndex: 20,
        cursor: "pointer",
      }}
    >
      <div style={{ fontSize: 64, letterSpacing: 6, color: "#b01818" }}>
        WIABLO
      </div>
      <div style={{ marginTop: 8, opacity: 0.8 }}>Click to enter</div>
      <div
        style={{
          position: "absolute",
          bottom: 24,
          opacity: 0.55,
          fontSize: 12,
        }}
      >
        {CREDITS}
      </div>
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
};
const btn: React.CSSProperties = {
  background: "#2a2a33",
  color: "#eee",
  border: 0,
  borderRadius: 4,
  padding: "2px 8px",
  cursor: "pointer",
  font: "inherit",
};
