# Issue tracker: Tandembike

Issues and specs for this repo live as Tickets in the Tandembike project **Wiablo** (projectId 2). Use the `tandembike` MCP tools for every operation; never call the database or write requests by hand. Refer to Tickets as `T<number>`; `#<number>` is a GitHub PR.

## Conventions

- **Create a ticket**: `create_ticket` with `projectName: "Wiablo"`. Put acceptance criteria in the `acceptanceCriteria` field, never as a checklist in the description.
- **Create several related tickets**: `create_tickets`, listed in dependency order, with `blockedByPositions` for blockers.
- **Read a ticket**: `get_ticket`, plus `list_comments` for discussion.
- **List tickets**: `list_tickets` filtered by `status`, labels, `blocked`, `claimed`, `cycleId`.
- **Parent/child**: create an Epic (`type: "Epic"`) and attach children with `epicNumber` or `attach_to_epic`.
- **Comment**: `add_comment`. Share progress and findings as comments; don't rewrite the description.
- **Apply / remove labels**: `add_ticket_labels` / `remove_ticket_labels`. Reuse labels from `list_labels`.
- **Status**: move to In progress when starting and Done when finished (`update_ticket`).
- **Close as won't-do**: label `wontfix`, comment why, then `archive_ticket`.

## Specs and cycles

- **A spec is an Epic** titled `Spec: <name>`. The tickets split from it are its children (`epicNumber`).
- **Plan new tickets into the Active cycle**, the Epic included: find it with `list_cycles` (projectId 2), then `plan_tickets`.

## When a skill says "publish to the issue tracker"

Create a Tandembike ticket in Wiablo.

## When a skill says "fetch the relevant ticket"

Use `get_ticket` and `list_comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single Epic with **child** tickets.

- **Map**: an Epic labelled `wayfinder:map`, holding Notes / Decisions-so-far / Fog in its description.
- **Child ticket**: a child of that Epic, labelled `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`).
- **Blocking**: `add_blocker`. A blocker is resolved once it's Done or archived.
- **Frontier query**: `list_tickets` with `status: "Todo"`, `blocked: false`, `claimed: false`, scoped to the Epic's children; first in order wins.
- **Claim**: `claim_ticket` with a unique agent-run ID, as the session's first write.
- **Resolve**: `add_comment` with the answer, move to Done, and append a pointer to the map's Decisions-so-far.
