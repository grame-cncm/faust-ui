import { describe, expect, it } from "vitest";
import type { FaustUIItem } from "@grame/faustwasm";
import Layout from "../../src/layout/Layout";
import AbstractGroup from "../../src/layout/AbstractGroup";
import TGroup from "../../src/layout/TGroup";
import { button, checkbox, group, hbargraph, hslider, knob, menu, nentry, radio, vbargraph, vslider } from "../helpers";
import { sequencer } from "../fixtures";

const { padding, labelHeight } = AbstractGroup;
const epsilon = 1e-9;

/**
 * Seeded pseudo-random generator (mulberry32), so a failing UI can be built again from its seed
 */
const random = (seed: number) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const widgets = [hslider, vslider, nentry, knob, menu, radio, button, checkbox, hbargraph, vbargraph];
const groupTypes = ["hgroup", "vgroup", "tgroup"] as const;

/**
 * A random UI tree, with tgroups more likely than in real DSPs
 */
const randomUI = (seed: number): FaustUIItem[] => {
    const rand = random(seed);
    const pick = <T>(array: readonly T[]) => array[Math.floor(rand() * array.length)];
    let n = 0;
    const item = (depth: number): FaustUIItem => {
        if (depth < 3 && rand() < 0.45) {
            const count = 1 + Math.floor(rand() * 4);
            return group(pick(groupTypes), `g${n++}`, Array.from({ length: count }, () => item(depth + 1)));
        }
        return pick(widgets)(`w${n++}`);
    };
    return [group(pick(groupTypes), "top", Array.from({ length: 1 + Math.floor(rand() * 3) }, () => item(1)))];
};

type Node = AbstractGroup | { layout: AbstractGroup["layout"]; label: string };
const right = (n: Node) => n.layout.left + n.layout.width;
const bottom = (n: Node) => n.layout.top + n.layout.height;
const frame = (n: Node) => `${n.label} [${n.layout.left.toFixed(3)}, ${n.layout.top.toFixed(3)}, ${right(n).toFixed(3)}, ${bottom(n).toFixed(3)}]`;

/**
 * The broken layout rules of a laid out UI, as readable messages
 */
const violations = (root: AbstractGroup) => {
    const found: string[] = [];
    const check = (g: AbstractGroup) => {
        const top = g.layout.top + (g.isRoot ? 0 : labelHeight) + (g instanceof TGroup ? TGroup.tabLayout.height : 0);
        g.items.forEach((item) => {
            if (!(item.layout.width > 0 && item.layout.height > 0)) found.push(`${item.label} has no size`);
            // Inside the frame of its group, below its label and its tab bar
            if (item.layout.left < g.layout.left + padding - epsilon
                || right(item) > right(g) - padding + epsilon
                || item.layout.top < top + padding - epsilon
                || bottom(item) > bottom(g) - padding + epsilon) found.push(`${frame(item)} out of ${g.layout.type} ${frame(g)}`);
        });
        if (g instanceof TGroup) {
            // All the tabs at the same place, the sizable ones fill the tgroup
            g.items.forEach((tab) => {
                if (Math.abs(tab.layout.left - g.layout.left - padding) > epsilon || Math.abs(tab.layout.top - top - padding) > epsilon) found.push(`tab ${frame(tab)} misplaced in ${frame(g)}`);
                const { sizing } = tab.layout;
                if ((sizing === "horizontal" || sizing === "both") && Math.abs(right(tab) - (right(g) - padding)) > epsilon) found.push(`tab ${frame(tab)} does not fill the width of ${frame(g)}`);
                if ((sizing === "vertical" || sizing === "both") && Math.abs(bottom(tab) - (bottom(g) - padding)) > epsilon) found.push(`tab ${frame(tab)} does not fill the height of ${frame(g)}`);
            });
            // The tab headers fit in the tgroup
            if (g.items.length * TGroup.tabLayout.width > g.layout.width + epsilon) found.push(`tab headers wider than ${frame(g)}`);
        } else {
            // Siblings do not overlap
            g.items.forEach((a, i) => g.items.slice(i + 1).forEach((b) => {
                const overlap = Math.min(right(a), right(b)) - Math.max(a.layout.left, b.layout.left) > epsilon
                    && Math.min(bottom(a), bottom(b)) - Math.max(a.layout.top, b.layout.top) > epsilon;
                if (overlap) found.push(`${frame(a)} overlaps ${frame(b)} in ${frame(g)}`);
            }));
        }
        g.items.forEach(item => item instanceof AbstractGroup && check(item));
    };
    check(root);
    return found;
};

describe("Layout invariants", () => {
    it("holds for the polyphonic sequencer UI", () => {
        expect(violations(Layout.calc(sequencer()))).toEqual([]);
    });

    it("holds for 500 random UIs with nested tgroups", () => {
        const failures: string[] = [];
        for (let seed = 1; seed <= 500; seed++) {
            const ui = randomUI(seed);
            const found = violations(Layout.calc(ui));
            if (found.length) failures.push(`seed ${seed}: ${found[0]}\n${JSON.stringify(ui)}`);
        }
        expect(failures.slice(0, 3), `${failures.length} UIs break the layout`).toEqual([]);
    });
});
