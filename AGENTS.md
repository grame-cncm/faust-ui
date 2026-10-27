# AGENTS.md

Guide for coding agents working on faust-ui. The [README](README.md) describes the library for its users; this file covers what you need to change it safely.

## What this is

faust-ui renders the UI description that the Faust compiler puts in a DSP's JSON (groups, sliders, knobs, menus, bargraphs…) as DOM components, and connects them to the DSP. It is published on npm as `@grame/faust-ui` (formerly `@shren/faust-ui`) and used by faustwasm and the Faust web tools: a polyphonic DSP with an effect, for instance, comes as a `tgroup` with an Instrument tab and an Effect tab.

## Repository layout

- `src/FaustUI.ts`: the entry class. It filters the UI (hidden items, soundfiles), lays it out, mounts a root `vgroup`, keeps `componentMap` (address → widgets), listens to `ui` and `param` window messages, and `destroy()` removes its window listeners.
- `src/layout/`: the layout, in grid units. `Layout.calc` builds a tree of layout items and runs three passes on it:
  - `adjust`: the minimum sizes;
  - `expand`: gives the extra space to the sizable items;
  - `offset`: the positions.
- `src/components/`: the DOM components.
  - `AbstractComponent`: the state, its events, and the rendering scheduled on `requestAnimationFrame`.
  - `AbstractItem`: the base of the widgets.
  - `Group`: the `hgroup`, `vgroup` and `tgroup`.
  - `utils.ts`: the conversion helpers.
- `src/instantiate.ts`: the page bootstrap used by `dist/index.html`.
- `dist/`: the **committed** build output: UMD bundle, ESM bundle with its CSS, and `index.d.ts`.
- `test/`: Vitest tests (see below).

## Commands

```bash
npm install
npx playwright install chromium   # once, for the browser tests
npm run build                     # webpack (UMD + ESM) then dist/index.d.ts
npm test                          # unit and browser tests
npm run coverage                  # the same, with a coverage report in ./coverage
```

`npm publish` runs `prepublishOnly` (tests, then build); only `dist/` is published (`files`). CI (`.github/workflows/test.yml`) runs `npm ci` and `npm run coverage` on Node 22.

## Code style

- Follow `.eslintrc.json` (airbnb-base with TypeScript), even though ESLint is not installed, so match it by hand:
  - 4-space indent;
  - double quotes;
  - semicolons;
  - no trailing commas;
  - arrow parameters without parentheses when there is a single one.
- Document methods and getters with `/** */`. Keep line comments short, and use them to say why.
- TypeScript targets ES2015 and CommonJS. `tsconfig.json` only includes `src/`; the tests are type-checked by Vitest's transform only.
- Do not edit `dist/` by hand: rebuild it with `npm run build`.

## How the code works: rules not to break

### Layout

- Sizes are in grid units:
  - `AbstractGroup.padding` = 0.2;
  - `labelHeight` = 0.25;
  - `spaceBetween` = 0.1;
  - a tab header is 2 × 1 (`TGroup.tabLayout`).
- In `expand`, a group adds to an item's size the space it gives it, then calls `item.expand`. `HGroup`, `VGroup` and `TGroup` must all do this. Otherwise the flexible children of an item grow outside its frame.
- A root group has no label: use `this.isRoot ? 0 : labelHeight` everywhere, in `adjust` as in `expand` and `offset`.
- `Layout.getItems` mutates the tree it is given: it replaces each group's `items` with layout instances.

### Components

- The lifecycle is `componentWillMount` (build the DOM), then `mount` (append it), then `componentDidMount` (listeners and first paint).
- `setState` sets and emits each key that changed. An unknown or unchanged key is skipped, not the keys after it.
- Rendering runs on the next animation frame. Widgets render every 3 frames (`frameReduce = 3`).
- **Values from the user:**
  - `setValue` goes through `toValidNumber` (nearest step, rounded to the decimals of the step), then `change()`, which calls `emitter.paramChangeByUI`;
  - it sends nothing when the value does not change.
- **Values from the DSP:** they arrive as `setState({ value })` and are never sent back.
- Widgets display their value through `AbstractItem.displayValue`, never through `toFixed(3)`.
- Menu and radio entries come from the `style` meta, parsed by `Group.parseMeta`, with one entry or more and an optional final `;`.

### Tabs

- The headers are built from `this.children`, and a click shows `this.children[i].container`.
- The container's children are, in order, the label (absent for a root group), the tab bar, then the tabs. `mountChildren()` keeps this order.
- The active tab gets `visibility: inherit`, **not** `visible`. A `visible` descendant shows through a hidden ancestor, so a tgroup nested in a hidden tab would appear.
- When a group's `items` change, it unregisters its old widgets from the emitter, removes their containers, and mounts the new ones.

## Tests

`vitest.config.mts` defines two projects.

- **`unit`** (`test/**`, except `test/browser`):
  - runs in Node;
  - a file that needs the DOM starts with `// @vitest-environment jsdom`;
  - jsdom has no canvas, so stub `HTMLCanvasElement.prototype.getContext` with `fakeContext2D()` in `beforeEach`.
- **`browser`** (`test/browser/**`):
  - runs in headless Chromium through Playwright, with a 1280 × 900 viewport;
  - the real styles are loaded (`css: true`);
  - use it for whatever needs layout, computed styles, canvas pixels or real pointer events.

Shared helpers:

- **`test/helpers.ts`:**
  - builders for the UI items: `hslider`, `menu`, `group`…;
  - `mount(ui)` mounts like `FaustUI.mount`, with a fake emitter that records `changes` and keeps a `componentMap`;
  - `parts(tgroup)` and `isShown(element)` for tabs;
  - `nextFrames()` waits for the scheduled rendering.
- **`test/fixtures.ts`:** `sequencer()`, the UI faustwasm builds for a polyphonic DSP with an effect.

Rules when adding tests:

- **For a bug fix:** add a test that fails without the fix, and check that it does by reverting the fix for a moment, for instance with `git stash push <the source file>`.
- **The layout invariants (`test/layout/invariants.test.ts`):**
  - they check every child inside its group, no overlapping siblings, and tabs filling their tgroup, on the fixture and on 500 random UIs;
  - a failure prints the seed and the UI;
  - keep them passing.
- **`FaustUI` instances:** destroy the ones a test creates, since they listen to `window`.
- **Values:** compare them with `toBe`. Values are exact since the step rounding fix, so do not loosen a test to `toBeCloseTo` to make it pass.

## Commits

- **Subject line:** one sentence stating the behavior that is now true, for example "A tgroup nested in a hidden tab no longer shows its active tab" or "setState sets the keys that follow an unchanged one".
- **Body:** explains what went wrong and why, then what changed, wrapped at about 72 columns.
- **One commit per fix or feature**, with its tests.
- **The build:**
  - after source changes, rebuild `dist/` and commit it **separately**, with the message `build`;
  - never mix `dist/` with source changes.
- **Version bumps** (`1.1.20`) are commits of their own, made by the maintainer: do not change the version unless asked.
- Do not push or publish unless asked.
