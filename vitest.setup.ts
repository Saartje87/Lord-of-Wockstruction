import { afterEach, beforeEach } from "vitest";

// Runs for every test file. Before each test it snapshots every exported object
// of the tuning modules; after each test it puts them back in place: changed
// values restored (nested too), added keys removed, replaced objects swapped
// back. The objects stay the same objects, so code holding a reference sees the
// restored values. Only tuning is covered; other module state is the test's own.
const tuningModules = import.meta.glob("./src/game/tuning/*.ts", {
  eager: true,
}) as Record<string, Record<string, unknown>>;

type Node = {
  target: object;
  length?: number;
  entries: Map<PropertyKey, unknown | Node>;
};

const isNode = (value: unknown): value is Node =>
  typeof value === "object" &&
  value !== null &&
  "entries" in value &&
  "target" in value;

function isTraversable(value: unknown): value is object {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return true;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function snapshot(value: object, seen: Map<object, Node>): Node {
  const known = seen.get(value);
  if (known) return known;
  const node: Node = { target: value, entries: new Map() };
  if (Array.isArray(value)) node.length = value.length;
  seen.set(value, node);
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === "length") continue;
    const child = (value as Record<PropertyKey, unknown>)[key];
    node.entries.set(
      key,
      isTraversable(child) ? snapshot(child, seen) : { leaf: child },
    );
  }
  return node;
}

function restore(node: Node, done: Set<Node>): void {
  if (done.has(node)) return;
  done.add(node);
  const target = node.target as Record<PropertyKey, unknown>;
  if (node.length !== undefined) (target as unknown[]).length = node.length;
  for (const key of Reflect.ownKeys(target)) {
    if (Array.isArray(target) && key === "length") continue;
    if (!node.entries.has(key)) delete target[key];
  }
  for (const [key, saved] of node.entries) {
    if (isNode(saved)) {
      if (target[key] !== saved.target) target[key] = saved.target;
      restore(saved, done);
    } else {
      const { leaf } = saved as { leaf: unknown };
      if (target[key] !== leaf) target[key] = leaf;
    }
  }
}

let snapshots: Node[] = [];

beforeEach(() => {
  const seen = new Map<object, Node>();
  snapshots = [];
  for (const exports of Object.values(tuningModules)) {
    for (const value of Object.values(exports)) {
      if (isTraversable(value)) snapshots.push(snapshot(value, seen));
    }
  }
});

afterEach(() => {
  const done = new Set<Node>();
  for (const node of snapshots) restore(node, done);
  snapshots = [];
});
