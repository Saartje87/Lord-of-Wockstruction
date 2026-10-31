# Issue tracker: Tandembike

Issues and specs for this repo live as Tickets in the Tandembike project **Lord of Wockstruction** (projectId 2). Use the `tandembike` MCP tools for every operation; never call the database or write requests by hand. Refer to Tickets as `T<number>`; `#<number>` is a GitHub PR.

## Conventions

- **Create a ticket**: `create_ticket` with `projectName: "Lord of Wockstruction"`. Put acceptance criteria in the `acceptanceCriteria` field, never as a checklist in the description.
- **Create several related tickets**: `create_tickets`, listed in dependency order, with `blockedByPositions` for blockers.
- **Read a ticket**: `get_ticket`, plus `list_comments` for discussion.
- **A branch per ticket**: start each ticket on its own `t<N>-<slug>` branch from `main`. When the current branch already has a merged PR (`gh pr list --head <branch> --state merged`), branch again from `main` first.
- **Code moves past tickets.** Before starting, check the code a ticket quotes against HEAD (`git log --since=<createdAt> -- <files>`). Where a criterion can't be met as written, build the closest honest version, leave the criterion unchecked and comment why.
- **List tickets**: `list_tickets` filtered by `status`, labels, `blocked`, `claimed`, `cycleId`.
- **Parent/child**: create an Epic (`type: "Epic"`) and attach children with `epicNumber` or `attach_to_epic`.
- **Comment**: `add_comment`. Share progress and findings as comments; don't rewrite the description.
- **Apply / remove labels**: `add_ticket_labels` / `remove_ticket_labels`. Reuse labels from `list_labels`.
- **Status**: move to In progress when starting and Done when finished (`update_ticket`).
- **Close as won't-do**: label `wontfix`, comment why, then `archive_ticket`.

## Specs and cycles

- **A spec is an Epic** titled `Spec: <name>`. The tickets split from it are its children (`epicNumber`).
- **The Epic is the source of truth for its tickets.** Where a ticket or its acceptance criteria say less than a spec line, build the spec line and comment on the ticket saying so.
- **Tickets that rewrite the same module go in sequence**, with a blocker between them, even when their features are independent.
- **A Blocker from another spec's ticket** goes in this Epic's *Depends on* too, so the dependency shows before anyone starts the spec.
- **Every Implementation Decision lands in some ticket's acceptance criteria**, deferred ones ("once X exists") included: they go to the ticket that builds X, or to a ticket of their own. Check each decision against the criteria before the split is done.
- **Plan new tickets into the Active cycle**, the Epic included: find it with `list_cycles` (projectId 2), then `plan_tickets`.

## When a skill says "publish to the issue tracker"

Create a Tandembike ticket in Lord of Wockstruction.

## When a skill says "fetch the relevant ticket"

Use `get_ticket` and `list_comments`.

## When a skill says "post an agent brief"

Write its acceptance criteria to the ticket's `acceptanceCriteria` field, and have the brief point there instead of listing them.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single Epic with **child** tickets.

- **Map**: an Epic labelled `wayfinder:map`, holding Notes / Decisions-so-far / Fog in its description.
- **Child ticket**: a child of that Epic, labelled `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`).
- **Blocking**: `add_blocker`. A blocker is resolved once it's Done or archived.
- **Frontier query**: `list_tickets` with `status: "Todo"`, `blocked: false`, `claimed: false`, scoped to the Epic's children; first in order wins.
- **Claim**: `claim_ticket` with a unique agent-run ID, as the session's first write.
- **Resolve**: `add_comment` with the answer, move to Done, and append a pointer to the map's Decisions-so-far.
