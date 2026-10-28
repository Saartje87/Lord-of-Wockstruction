"use client";

// PROTOTYPE tooling: floating variant switcher. Never shown in production builds.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

export function PrototypeSwitcher({
  variants,
  labels = {},
}: {
  variants: string[];
  labels?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("variant") ?? variants[0];
  const index = Math.max(0, variants.indexOf(current));

  const go = useCallback(
    (delta: number) => {
      const next =
        variants[(index + delta + variants.length) % variants.length];
      const sp = new URLSearchParams(params.toString());
      sp.set("variant", next);
      router.replace(`${pathname}?${sp.toString()}`);
    },
    [index, params, pathname, router, variants],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (process.env.NODE_ENV === "production") return null;

  const label = labels[current] ? `${current} (${labels[current]})` : current;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "6px 10px",
        borderRadius: 999,
        background: "#ff2fb4",
        color: "#fff",
        font: "600 13px/1 system-ui, sans-serif",
        boxShadow: "0 4px 16px rgba(0,0,0,.5)",
        zIndex: 1000,
        userSelect: "none",
      }}
    >
      <button
        type="button"
        onClick={() => go(-1)}
        style={arrow}
        aria-label="Previous variant"
      >
        ←
      </button>
      <span style={{ minWidth: 150, textAlign: "center" }}>{label}</span>
      <button
        type="button"
        onClick={() => go(1)}
        style={arrow}
        aria-label="Next variant"
      >
        →
      </button>
    </div>
  );
}

const arrow: React.CSSProperties = {
  background: "rgba(255,255,255,.2)",
  border: 0,
  borderRadius: 999,
  color: "inherit",
  width: 28,
  height: 28,
  cursor: "pointer",
  font: "inherit",
};
