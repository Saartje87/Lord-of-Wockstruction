import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();

/**
 * Makes `dir` a checkout of `commit` from `url`, holding only `paths`.
 * Fetches only what is missing, so a re-run with a warm cache is offline.
 */
export function checkout(
  url: string,
  commit: string,
  dir: string,
  paths: string[],
) {
  if (!existsSync(`${dir}/.git`)) {
    mkdirSync(dir, { recursive: true });
    git(dir, "init", "--quiet");
    git(dir, "remote", "add", "origin", url);
  }
  git(dir, "sparse-checkout", "set", "--no-cone", ...paths);

  let head = "";
  try {
    head = git(dir, "rev-parse", "HEAD");
  } catch {
    // A fresh repository has no HEAD yet.
  }
  if (head !== commit) {
    console.log(`Fetching ${url} at ${commit.slice(0, 7)}…`);
    git(
      dir,
      "fetch",
      "--quiet",
      "--depth",
      "1",
      "--filter=blob:none",
      "origin",
      commit,
    );
    git(dir, "checkout", "--quiet", "--detach", commit);
  }
}
