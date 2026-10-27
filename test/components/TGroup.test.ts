// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Group from "../../src/components/Group";
import Menu from "../../src/components/Menu";
import Nentry from "../../src/components/Nentry";
import Layout from "../../src/layout/Layout";
import { button, fakeContext2D, group, hslider, isShown, knob, menu, mount, nentry, nextFrames, parts, vslider } from "../helpers";

beforeEach(() => {
    // jsdom has no canvas: the components draw into a context that does nothing
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fakeContext2D() as any);
});
afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
});

const simple = () => [group("tgroup", "T", [group("vgroup", "A", []), group("vgroup", "B", []), group("vgroup", "C", [])])];
/**
 * The first tgroup of the root
 */
const mountTGroup = (...args: Parameters<typeof mount>) => {
    const mounted = mount(...args);
    return { ...mounted, tgroup: mounted.root.children[0] as Group };
};

describe("TGroup component", () => {
    describe("structure", () => {
        it("has one tab header per tab, with its label", () => {
            const { tgroup } = mountTGroup(simple());
            expect(tgroup.container.classList).toContain("faust-ui-tgroup");
            const { headers, tabs } = parts(tgroup);
            expect(headers.map(h => h.innerText)).toEqual(["A", "B", "C"]);
            expect(headers.every(h => h.classList.contains("faust-ui-tgroup-tab"))).toBe(true);
            expect(tabs).toHaveLength(3);
        });

        it("puts its label, then its tab bar, then its tabs in its container", () => {
            // The click handler counts on this order: it skips the first two children
            const { tgroup } = mountTGroup(simple());
            const children = Array.from(tgroup.container.children);
            expect(children[0]).toBe(tgroup.label);
            expect(children[1]).toBe(tgroup.tabs);
            expect(children.slice(2)).toEqual(parts(tgroup).tabs);
            expect(tgroup.tabs.classList).toContain("faust-ui-tgroup-tabs");
        });

        it("has a label with a canvas", () => {
            const { tgroup } = mountTGroup(simple());
            expect(tgroup.label.classList).toContain("faust-ui-group-label");
            expect(tgroup.label.firstChild).toBe(tgroup.labelCanvas);
        });

        it("has no tab bar when it has no tabs", () => {
            const { tgroup } = mountTGroup([group("tgroup", "Empty", [])]);
            expect(tgroup.children).toHaveLength(0);
            expect(tgroup.tabs.children).toHaveLength(0);
            expect(tgroup.container.contains(tgroup.tabs)).toBe(false);
        });

        it("shows its only tab", () => {
            const { tgroup } = mountTGroup([group("tgroup", "T", [group("vgroup", "Only", [hslider("s")])])]);
            const { headers, tabs } = parts(tgroup);
            expect(headers.map(h => h.innerText)).toEqual(["Only"]);
            expect(tabs.map(isShown)).toEqual([true]);
            expect(headers[0].classList).toContain("active");
        });

        it("makes a tab of a widget put directly in it", () => {
            const { tgroup, emitter } = mountTGroup([group("tgroup", "T", [hslider("gain"), menu("mode"), group("vgroup", "G", [button("go")])])]);
            const { headers, tabs } = parts(tgroup);
            expect(headers.map(h => h.innerText)).toEqual(["gain", "mode", "G"]);
            expect(tabs.map(isShown)).toEqual([true, false, false]);
            headers[1].click();
            expect(tabs.map(isShown)).toEqual([false, true, false]);
            expect(tabs[1]).toBe(emitter.componentMap["/mode"][0].container);
        });

        it("builds and registers the widgets of every tab, shown or not", () => {
            const { emitter } = mountTGroup([
                group("tgroup", "T", [
                    group("vgroup", "A", [hslider("a1"), knob("a2")]),
                    group("hgroup", "B", [menu("b1"), vslider("b2"), button("b3")])
                ])
            ]);
            expect(Object.keys(emitter.componentMap).sort()).toEqual(["/a1", "/a2", "/b1", "/b2", "/b3"]);
            Object.values(emitter.componentMap).forEach(([item]) => expect(document.body.contains(item.container)).toBe(true));
        });
    });

    describe("tab switching", () => {
        it("shows the first tab once mounted", () => {
            const { tgroup } = mountTGroup(simple());
            const { headers, tabs } = parts(tgroup);
            expect(tabs.map(isShown)).toEqual([true, false, false]);
            expect(headers.map(h => h.classList.contains("active"))).toEqual([true, false, false]);
        });

        it("shows the tab whose header is clicked, and hides the others", () => {
            const { tgroup } = mountTGroup(simple());
            const { headers, tabs } = parts(tgroup);
            headers[2].click();
            expect(tabs.map(isShown)).toEqual([false, false, true]);
            expect(headers.map(h => h.classList.contains("active"))).toEqual([false, false, true]);
            headers[1].click();
            expect(tabs.map(isShown)).toEqual([false, true, false]);
            expect(headers.map(h => h.classList.contains("active"))).toEqual([false, true, false]);
        });

        it("keeps the active tab when its header is clicked again", () => {
            const { tgroup } = mountTGroup(simple());
            const { headers, tabs } = parts(tgroup);
            headers[1].click();
            headers[1].click();
            expect(tabs.map(isShown)).toEqual([false, true, false]);
            expect(headers.map(h => h.classList.contains("active"))).toEqual([false, true, false]);
        });

        it("lets the active tab inherit its visibility", () => {
            const { tgroup } = mountTGroup(simple());
            const { tabs } = parts(tgroup);
            expect(tabs[0].style.visibility).toBe("inherit");
            expect(tabs[1].style.visibility).toBe("hidden");
        });

        it("hides a tgroup nested in a hidden tab", () => {
            // Regression: the active tab of a tgroup in the Effect tab showed over the Instrument tab
            const { tgroup: outer } = mountTGroup([
                group("tgroup", "Sequencer", [
                    group("vgroup", "Instrument", [group("tgroup", "Voice", [group("vgroup", "Osc", []), group("vgroup", "Env", [])])]),
                    group("vgroup", "Effect", [group("tgroup", "FX", [group("vgroup", "Reverb", []), group("vgroup", "Echo", [])])])
                ])
            ]);
            const [instrument, effect] = outer.children as Group[];
            const voice = instrument.children[0] as Group;
            const fx = effect.children[0] as Group;

            expect(parts(voice).tabs.map(isShown)).toEqual([true, false]);
            expect(parts(fx).tabs.map(isShown)).toEqual([false, false]);

            parts(outer).headers[1].click();
            expect(parts(voice).tabs.map(isShown)).toEqual([false, false]);
            expect(parts(fx).tabs.map(isShown)).toEqual([true, false]);

            parts(fx).headers[1].click();
            expect(parts(fx).tabs.map(isShown)).toEqual([false, true]);
            parts(outer).headers[0].click();
            expect(parts(fx).tabs.map(isShown)).toEqual([false, false]);
            expect(parts(voice).tabs.map(isShown)).toEqual([true, false]);
            // The nested tgroup remembers its active tab
            parts(outer).headers[1].click();
            expect(parts(fx).tabs.map(isShown)).toEqual([false, true]);
        });

        it("hides the widgets of a hidden tab", () => {
            const { tgroup, emitter } = mountTGroup([group("tgroup", "T", [group("vgroup", "A", [hslider("a")]), group("vgroup", "B", [menu("b")])])]);
            const a = emitter.componentMap["/a"][0].container;
            const b = emitter.componentMap["/b"][0].container;
            expect([isShown(a), isShown(b)]).toEqual([true, false]);
            parts(tgroup).headers[1].click();
            expect([isShown(a), isShown(b)]).toEqual([false, true]);
        });

        it("sends nothing to the DSP when switching tabs", () => {
            const { tgroup, emitter } = mountTGroup([group("tgroup", "T", [group("vgroup", "A", [hslider("a", 0.5)]), group("vgroup", "B", [menu("b", 1)])])]);
            parts(tgroup).headers[1].click();
            parts(tgroup).headers[0].click();
            expect(emitter.changes).toEqual([]);
        });
    });

    describe("values", () => {
        it("keeps the values of a tab while another tab is shown", async () => {
            const { tgroup, emitter } = mountTGroup([group("tgroup", "T", [group("vgroup", "A", [menu("m")]), group("vgroup", "B", [nentry("n")])])]);
            const m = emitter.componentMap["/m"][0] as Menu;
            m.select.value = "2";
            m.select.dispatchEvent(new Event("change"));
            expect(emitter.changes).toEqual([{ path: "/m", value: 2 }]);
            parts(tgroup).headers[1].click();
            parts(tgroup).headers[0].click();
            await nextFrames();
            expect(m.state.value).toBe(2);
            expect(m.select.value).toBe("2");
        });

        it("updates a widget of a hidden tab when the DSP changes its value", async () => {
            const { emitter } = mountTGroup([group("tgroup", "T", [group("vgroup", "A", [hslider("a")]), group("vgroup", "B", [menu("m")])])]);
            const m = emitter.componentMap["/m"][0] as Menu;
            expect(isShown(m.container)).toBe(false);
            m.setState({ value: 1 });
            await nextFrames();
            expect(m.select.selectedIndex).toBe(1);
            // A value from the DSP is not sent back to it
            expect(emitter.changes).toEqual([]);
        });

        it("resets the widgets of all its tabs when its label is double-clicked", () => {
            const { tgroup, emitter } = mountTGroup([
                group("tgroup", "T", [
                    group("vgroup", "A", [nentry("a", 3)]),
                    group("vgroup", "B", [group("tgroup", "Inner", [group("vgroup", "X", [nentry("x", 2)]), group("vgroup", "Y", [nentry("y", 5)])])])
                ])
            ]);
            const items = ["/a", "/x", "/y"].map(path => emitter.componentMap[path][0] as Nentry);
            items.forEach(item => item.setValue(7));
            emitter.changes.length = 0;
            tgroup.labelCanvas.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
            expect(items.map(item => item.state.value)).toEqual([3, 2, 5]);
            expect(emitter.changes).toEqual([{ path: "/a", value: 3 }, { path: "/x", value: 2 }, { path: "/y", value: 5 }]);
        });

        it("resets only the widgets of a nested tgroup when its label is double-clicked", () => {
            const { tgroup, emitter } = mountTGroup([
                group("tgroup", "T", [
                    group("vgroup", "A", [nentry("a", 3)]),
                    group("vgroup", "B", [group("tgroup", "Inner", [group("vgroup", "X", [nentry("x", 2)])])])
                ])
            ]);
            const a = emitter.componentMap["/a"][0] as Nentry;
            const x = emitter.componentMap["/x"][0] as Nentry;
            a.setValue(7);
            x.setValue(7);
            const inner = (tgroup.children[1] as Group).children[0] as Group;
            inner.labelCanvas.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
            expect([a.state.value, x.state.value]).toEqual([7, 2]);
        });
    });

    describe("geometry", () => {
        it("sizes the tab bar and its headers from the grid", () => {
            const grid = 50;
            const { tgroup } = mountTGroup(simple(), { grid });
            expect(tgroup.tabs.style.height).toBe(`${grid}px`);
            expect(tgroup.tabs.style.top).toBe(`${0.25 * grid}px`);
            parts(tgroup).headers.forEach((h) => {
                expect(h.style.width).toBe(`${2 * grid - 20}px`);
                expect(h.style.height).toBe(`${grid - 20}px`);
                expect(h.style.lineHeight).toBe(`${grid - 20}px`);
                expect(h.style.fontSize).toBe(`${0.25 * grid}px`);
            });
        });

        it("places and sizes itself and its tabs from the layout", () => {
            const grid = 40;
            const { root, tgroup } = mountTGroup(simple(), { grid });
            const tgroupItem = root.state.items[0] as any;
            const { offsetLeft, offsetTop, width, height } = tgroupItem.layout;
            expect(tgroup.container.style.left).toBe(`${offsetLeft * grid}px`);
            expect(tgroup.container.style.top).toBe(`${offsetTop * grid}px`);
            expect(tgroup.container.style.width).toBe(`${width * grid}px`);
            expect(tgroup.container.style.height).toBe(`${height * grid}px`);
            parts(tgroup).tabs.forEach((tab, i) => {
                const { layout } = tgroupItem.items[i];
                expect(tab.style.left).toBe(`${layout.offsetLeft * grid}px`);
                expect(tab.style.top).toBe(`${layout.offsetTop * grid}px`);
                expect(tab.style.width).toBe(`${layout.width * grid}px`);
                expect(tab.style.height).toBe(`${layout.height * grid}px`);
            });
        });

        it("resizes its tab bar, its headers and its tabs when the grid changes", async () => {
            const { root, tgroup } = mountTGroup([group("tgroup", "T", [group("vgroup", "A", [hslider("a")]), group("vgroup", "B", [hslider("b")])])], { grid: 40 });
            const grid = 60;
            root.setState({ style: { grid } });
            await nextFrames();
            expect(tgroup.tabs.style.height).toBe(`${grid}px`);
            parts(tgroup).headers.forEach(h => expect(h.style.width).toBe(`${2 * grid - 20}px`));
            const tgroupItem = root.state.items[0] as any;
            expect(tgroup.container.style.width).toBe(`${tgroupItem.layout.width * grid}px`);
            parts(tgroup).tabs.forEach((tab, i) => expect(tab.style.width).toBe(`${tgroupItem.items[i].layout.width * grid}px`));
        });

        it("keeps the shown tab when the grid changes", async () => {
            const { root, tgroup } = mountTGroup(simple());
            parts(tgroup).headers[2].click();
            root.setState({ style: { grid: 60 } });
            await nextFrames();
            expect(parts(tgroup).tabs.map(isShown)).toEqual([false, false, true]);
        });
    });

    describe("state changes", () => {
        it("shows its new label as the title of its label", async () => {
            const { tgroup } = mountTGroup(simple());
            tgroup.setState({ label: "Renamed" });
            await nextFrames();
            expect(tgroup.state.label).toBe("Renamed");
            expect(tgroup.label.title).toBe("Renamed");
        });

        // `itemsChange` rebuilds the tab headers and the children, but does not mount the new
        // children: their containers never reach the DOM. FaustUI does not use it (a new UI
        // mounts a new root group), so this documents the current behavior.
        it.fails("replaces its tabs when its items change", async () => {
            const { tgroup } = mountTGroup(simple());
            const items = Layout.getItems([group("vgroup", "X", []), group("vgroup", "Y", [])]);
            items.forEach(item => item.layout.offsetLeft = item.layout.offsetTop = 0);
            tgroup.setState({ items: items as any });
            await nextFrames();
            expect(parts(tgroup).headers.map(h => h.innerText)).toEqual(["X", "Y"]);
            parts(tgroup).tabs.forEach(tab => expect(tgroup.container.contains(tab)).toBe(true));
        });
    });
});
