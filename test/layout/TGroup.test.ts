import { describe, expect, it } from "vitest";
import type { FaustUIItem } from "@grame/faustwasm";
import Layout from "../../src/layout/Layout";
import AbstractGroup from "../../src/layout/AbstractGroup";
import TGroup from "../../src/layout/TGroup";
import { button, group, hslider, menu, nentry, vslider } from "../helpers";

const { padding, labelHeight } = AbstractGroup;
const tabHeight = TGroup.tabLayout.height;

/**
 * Runs the layout of `ui` and returns its root group
 */
const calc = (ui: FaustUIItem[]) => Layout.calc(ui);

describe("TGroup layout", () => {
    it("is created for a tgroup item", () => {
        const root = calc([group("tgroup", "T", [group("vgroup", "A", [button("b")])])]);
        expect(root.items[0]).toBeInstanceOf(TGroup);
    });

    describe("adjust", () => {
        it("is as large as its largest tab, plus padding, label and tab bar", () => {
            const tgroup = new TGroup({
                type: "tgroup",
                label: "T",
                items: Layout.getItems([
                    group("hgroup", "Wide", [hslider("s1"), hslider("s2")]),
                    group("vgroup", "Tall", [button("b1"), button("b2"), button("b3")])
                ] as FaustUIItem[]) as AbstractGroup[]
            });
            tgroup.adjust();
            const [wide, tall] = tgroup.items;
            expect(tgroup.layout.width).toBeCloseTo(Math.max(wide.layout.width, tall.layout.width) + 2 * padding);
            expect(tgroup.layout.height).toBeCloseTo(Math.max(wide.layout.height, tall.layout.height) + 2 * padding + labelHeight + tabHeight);
        });

        it("is wide enough for all its tab headers", () => {
            const tabs = ["A", "B", "C", "D", "E"].map(l => group("vgroup", l, [button(l)]));
            const tgroup = new TGroup({ type: "tgroup", label: "T", items: Layout.getItems(tabs) as AbstractGroup[] });
            tgroup.adjust();
            expect(tgroup.layout.width).toBeGreaterThanOrEqual(tabs.length * TGroup.tabLayout.width);
        });

        it("is sizable when one of its tabs is", () => {
            const root = calc([group("tgroup", "T", [group("vgroup", "A", [button("b")]), group("vgroup", "B", [hslider("s")])])]);
            expect(root.items[0].layout.sizing).toBe("horizontal");
        });
    });

    describe("expand", () => {
        it("gives each tab the width and height of the tgroup", () => {
            // Regression: a narrow tab was expanded without growing, so its menu ran out of its frame
            const root = calc([
                group("tgroup", "T", [
                    group("vgroup", "Narrow", [menu("m")]),
                    group("hgroup", "Wide", [hslider("s1"), hslider("s2"), hslider("s3")])
                ])
            ]);
            const tgroup = root.items[0] as TGroup;
            const contentWidth = tgroup.layout.width - 2 * padding;
            const contentHeight = tgroup.layout.height - 2 * padding - labelHeight - tabHeight;
            tgroup.items.forEach((tab) => {
                expect(tab.layout.width).toBeCloseTo(contentWidth);
                if (tab.layout.sizing === "both" || tab.layout.sizing === "vertical") expect(tab.layout.height).toBeCloseTo(contentHeight);
            });
        });

        it.each(["vgroup", "hgroup"] as const)("keeps the flexible children of a %s tab inside the tab's frame", (type) => {
            // An hgroup expands its children by the dX it is given, a vgroup by its own width:
            // both must stay inside the tab
            const root = calc([
                group("tgroup", "T", [
                    group(type, "Narrow", [menu("m"), nentry("n")]),
                    group("hgroup", "Wide", [hslider("s1"), hslider("s2"), hslider("s3")])
                ])
            ]);
            const tgroup = root.items[0] as TGroup;
            const narrow = tgroup.items[0] as AbstractGroup;
            narrow.items.forEach((item) => {
                expect(item.layout.left).toBeGreaterThanOrEqual(narrow.layout.left - 1e-9);
                expect(item.layout.left + item.layout.width).toBeLessThanOrEqual(narrow.layout.left + narrow.layout.width + 1e-9);
                expect(item.layout.top + item.layout.height).toBeLessThanOrEqual(narrow.layout.top + narrow.layout.height + 1e-9);
            });
            // The menu takes the width the other tab gives the tgroup
            expect(narrow.items[0].layout.width).toBeGreaterThan(Layout.getItem(menu("m")).layout.width);
        });

        it("does not grow a tab that is not sizable", () => {
            const root = calc([
                group("tgroup", "T", [
                    group("vgroup", "Fixed", [nentry("n")]),
                    group("hgroup", "Wide", [hslider("s1"), hslider("s2")])
                ])
            ]);
            const fixed = (root.items[0] as TGroup).items[0];
            expect(fixed.layout.sizing).toBe("none");
            const alone = calc([group("vgroup", "Fixed", [nentry("n")])]).items[0];
            expect(fixed.layout.width).toBeCloseTo(alone.layout.width);
            expect(fixed.layout.height).toBeCloseTo(alone.layout.height);
        });

        it("stays inside its parent group", () => {
            const root = calc([
                group("hgroup", "H", [
                    group("tgroup", "T", [
                        group("vgroup", "Narrow", [menu("m")]),
                        group("hgroup", "Wide", [hslider("s1"), hslider("s2")])
                    ]),
                    hslider("next")
                ])
            ]);
            const h = root.items[0] as AbstractGroup;
            const [tgroup, next] = h.items;
            const tabs = (tgroup as TGroup).items;
            tabs.forEach((tab) => {
                expect(tab.layout.left + tab.layout.width).toBeLessThanOrEqual(tgroup.layout.left + tgroup.layout.width + 1e-9);
            });
            // The item after the tgroup is not overlapped by it
            expect(next.layout.left).toBeGreaterThanOrEqual(tgroup.layout.left + tgroup.layout.width - 1e-9);
        });
    });

    describe("as the root", () => {
        // FaustUI makes a vgroup root, but a TGroup can be laid out as a root, without a label
        const rootTGroup = () => {
            const tgroup = new TGroup({
                type: "tgroup",
                label: "",
                items: Layout.getItems([
                    group("hgroup", "Short", [vslider("v")]),
                    group("vgroup", "Tall", [nentry("n1"), nentry("n2"), nentry("n3"), nentry("n4"), nentry("n5"), nentry("n6")])
                ]) as AbstractGroup[]
            }, true);
            return tgroup.adjust().expand().offset();
        };

        it("has no label height", () => {
            const tgroup = rootTGroup();
            // The tall tab is not sizable: the tgroup is as high as it, plus padding and tab bar
            const tall = tgroup.items[1];
            expect(tall.layout.sizing).toBe("none");
            expect(tgroup.layout.height).toBeCloseTo(tall.layout.height + 2 * padding + tabHeight);
        });

        it("gives its tabs its whole height under the tab bar", () => {
            const tgroup = rootTGroup();
            const short = tgroup.items[0];
            expect(short.layout.top).toBeCloseTo(padding + tabHeight);
            expect(short.layout.top + short.layout.height).toBeCloseTo(tgroup.layout.height - padding);
        });
    });

    describe("edge cases", () => {
        it("has a minimum width when it has no tabs", () => {
            const tgroup = calc([group("tgroup", "Empty", [])]).items[0];
            expect(tgroup.layout.width).toBeCloseTo(2 * padding + 1);
            expect(tgroup.layout.height).toBeCloseTo(2 * padding + labelHeight + tabHeight);
            expect(tgroup.layout.sizing).toBe("none");
        });

        it("is wide enough for the header of its only tab", () => {
            const tgroup = calc([group("tgroup", "T", [group("vgroup", "A", [nentry("n")])])]).items[0] as TGroup;
            expect(tgroup.layout.width).toBeGreaterThanOrEqual(TGroup.tabLayout.width);
            expect(tgroup.items[0].layout.offsetLeft).toBeCloseTo(padding);
        });

        it("gives a vertically sizable tab the height another tab gives the tgroup", () => {
            const root = calc([
                group("tgroup", "T", [
                    group("hgroup", "Short", [vslider("v")]),
                    group("vgroup", "Tall", [nentry("n1"), nentry("n2"), nentry("n3"), nentry("n4"), nentry("n5")])
                ])
            ]);
            const tgroup = root.items[0] as TGroup;
            const short = tgroup.items[0] as AbstractGroup;
            expect(short.layout.height).toBeCloseTo(tgroup.layout.height - 2 * padding - labelHeight - tabHeight);
            // Its vslider grows with it
            const v = short.items[0];
            expect(v.layout.top + v.layout.height).toBeCloseTo(short.layout.top + short.layout.height - padding);
        });

        it("fills, with its tabs, the width a vgroup gives it", () => {
            const root = calc([
                group("tgroup", "T", [group("vgroup", "A", [hslider("a")])]),
                group("hgroup", "Wide", [hslider("w1"), hslider("w2"), hslider("w3")])
            ]);
            const [tgroup, wide] = root.items as AbstractGroup[];
            expect(tgroup.layout.width).toBeCloseTo(wide.layout.width);
            expect(tgroup.items[0].layout.width).toBeCloseTo(tgroup.layout.width - 2 * padding);
        });

        it("fills, with its tabs, the height an hgroup gives it", () => {
            const root = calc([
                group("hgroup", "H", [
                    group("tgroup", "T", [group("hgroup", "A", [vslider("a")])]),
                    group("vgroup", "Tall", [nentry("n1"), nentry("n2"), nentry("n3"), nentry("n4"), nentry("n5"), nentry("n6")])
                ])
            ]);
            const h = root.items[0] as AbstractGroup;
            const tgroup = h.items[0] as TGroup;
            expect(tgroup.layout.height).toBeCloseTo(h.layout.height - 2 * padding - labelHeight);
            expect(tgroup.items[0].layout.height).toBeCloseTo(tgroup.layout.height - 2 * padding - labelHeight - tabHeight);
        });
    });

    describe("offset", () => {
        it("places all tabs at the same position, below the label and the tab bar", () => {
            const root = calc([
                group("tgroup", "T", [
                    group("vgroup", "A", [button("b")]),
                    group("hgroup", "B", [hslider("s1"), hslider("s2")]),
                    group("vgroup", "C", [menu("m")])
                ])
            ]);
            const tgroup = root.items[0] as TGroup;
            tgroup.items.forEach((tab) => {
                expect(tab.layout.offsetLeft).toBeCloseTo(padding);
                expect(tab.layout.offsetTop).toBeCloseTo(padding + labelHeight + tabHeight);
                expect(tab.layout.left).toBeCloseTo(tgroup.layout.left + padding);
                expect(tab.layout.top).toBeCloseTo(tgroup.layout.top + padding + labelHeight + tabHeight);
            });
        });

        it("offsets the children of nested tgroups from their own tab", () => {
            const root = calc([
                group("tgroup", "Outer", [
                    group("vgroup", "A", [group("tgroup", "Inner", [group("vgroup", "X", [button("x")]), group("vgroup", "Y", [button("y")])])]),
                    group("vgroup", "B", [button("b")])
                ])
            ]);
            const outer = root.items[0] as TGroup;
            const inner = (outer.items[0] as AbstractGroup).items[0] as TGroup;
            inner.items.forEach((tab) => {
                expect(tab.layout.left).toBeCloseTo(inner.layout.left + padding);
                expect(tab.layout.top).toBeCloseTo(inner.layout.top + padding + labelHeight + tabHeight);
            });
        });
    });
});
