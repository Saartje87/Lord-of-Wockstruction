import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { metadata } from "./layout";
import manifest from "./manifest";

describe("the manifest that makes the game an Installed game", () => {
  const declared = manifest();

  it("names it Wiablo and starts it at the usual start page", () => {
    expect(declared).toMatchObject({
      name: "Wiablo",
      short_name: "Wiablo",
      start_url: "/",
      scope: "/",
    });
  });

  it("describes it as the website does", () => {
    expect(declared.description).toBe(metadata.description);
  });

  it("opens it fullscreen, falling back to the standalone display mode, held sideways", () => {
    expect(declared.display).toBe("fullscreen");
    expect(declared.display_override).toEqual(["fullscreen", "standalone"]);
    expect(declared.orientation).toBe("landscape");
  });

  it("launches on black, as the game's dark screen", () => {
    expect(declared.background_color).toBe("#000000");
    expect(declared.theme_color).toBe("#000000");
  });

  it("lists 192 and 512 px icons, and a 512 px maskable one", () => {
    expect(
      declared.icons?.map(({ sizes, purpose }) => ({ sizes, purpose })),
    ).toEqual([
      { sizes: "192x192", purpose: "any" },
      { sizes: "512x512", purpose: "any" },
      { sizes: "512x512", purpose: "maskable" },
    ]);
  });

  it.each(
    (declared.icons ?? []).map(({ src }) => src),
  )("has the icon %s in the repo", (src) => {
    expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
  });
});
