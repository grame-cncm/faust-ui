import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import FaustUI from "../../src/FaustUI";
import Group from "../../src/components/Group";
import type Checkbox from "../../src/components/Checkbox";
import { nextFrames, parts } from "../helpers";
import { sequencer } from "../fixtures";

/**
 * Tolerance in pixels: groups have a 1px border around the box their items are placed in
 */
const border = 2;

let root: HTMLDivElement;
let faustUI: FaustUI;
const mountUI = async (width = 1000, height = 700) => {
    root = document.createElement("div");
    Object.assign(root.style, { position: "relative", width: `${width}px`, height: `${height}px` });
    document.body.appendChild(root);
    faustUI = new FaustUI({ root, ui: sequencer() as never, listenWindowResize: false, listenWindowMessage: false });
    await nextFrames();
};
beforeEach(() => mountUI());
afterEach(() => root.remove());

const tgroups = () => {
    const found: Record<string, Group> = {};
    const walk = (g: Group) => g.children.forEach((c) => {
        if (!(c instanceof Group)) return;
        if (c.state.type === "tgroup") found[c.state.label] = c;
        walk(c);
    });
    walk(faustUI.faustUIRoot);
    return found;
};
const widget = (path: string) => faustUI.componentMap[path][0].container;
const visibility = (e: Element) => getComputedStyle(e).visibility;
/**
 * The element a click at the center of `e` lands on
 */
const hit = (e: Element) => {
    const { left, top, width, height } = e.getBoundingClientRect();
    return document.elementFromPoint(left + width / 2, top + height / 2);
};
const isInside = (inner: DOMRect, outer: DOMRect, tolerance = border) => inner.left >= outer.left - tolerance
    && inner.top >= outer.top - tolerance
    && inner.right <= outer.right + tolerance
    && inner.bottom <= outer.bottom + tolerance;

describe("TGroup in a browser", () => {
    describe("visibility", () => {
        it("shows only the widgets of the active tabs", () => {
            expect(["/wave", "/cutoff", "/attack", "/gain", "/gate"].map(p => visibility(widget(p)))).toEqual(Array(5).fill("visible"));
            expect(["/fattack", "/room", "/wet", "/time", "/level", "/routing"].map(p => visibility(widget(p)))).toEqual(Array(6).fill("hidden"));
        });

        it("hides the tab bar and the active tab of a tgroup nested in a hidden tab", () => {
            // Regression: the active tab of the FX tgroup showed over the Instrument tab
            const { FX } = tgroups();
            expect(visibility(FX.tabs)).toBe("hidden");
            expect(visibility(parts(FX).tabs[0])).toBe("hidden");
            expect(visibility(widget("/room"))).toBe("hidden");
        });

        it("switches tabs when a header is clicked", async () => {
            const { Sequencer, FX } = tgroups();
            await userEvent.click(parts(Sequencer).headers[1]);
            expect(["/wave", "/attack", "/gain"].map(p => visibility(widget(p)))).toEqual(Array(3).fill("hidden"));
            expect(["/room", "/wet", "/routing", "/voices"].map(p => visibility(widget(p)))).toEqual(Array(4).fill("visible"));
            expect(visibility(FX.tabs)).toBe("visible");
            await userEvent.click(parts(FX).headers[1]);
            expect(["/room", "/time", "/feedback"].map(p => visibility(widget(p)))).toEqual(["hidden", "visible", "visible"]);
            await userEvent.click(parts(Sequencer).headers[0]);
            expect(["/time", "/attack"].map(p => visibility(widget(p)))).toEqual(["hidden", "visible"]);
        });

        it("lets a click on a widget of the active tab reach it, not a widget of a hidden tab", async () => {
            const { Sequencer, Envelope } = tgroups();
            ["/wave", "/cutoff", "/gain", "/gate", "/attack"].forEach(p => expect(widget(p).contains(hit(widget(p)))).toBe(true));
            await userEvent.click(parts(Envelope).headers[1]);
            expect(widget("/fattack").contains(hit(widget("/fattack")))).toBe(true);
            await userEvent.click(parts(Sequencer).headers[1]);
            ["/room", "/wet", "/routing", "/voices"].forEach(p => expect(widget(p).contains(hit(widget(p)))).toBe(true));
        });

        it("changes the value of a widget of the active tab on click", async () => {
            const { Sequencer } = tgroups();
            await userEvent.click(parts(Sequencer).headers[1]);
            const { FX } = tgroups();
            await userEvent.click(parts(FX).headers[1]);
            const sync = faustUI.componentMap["/sync"][0] as Checkbox;
            const changes: [string, number][] = [];
            faustUI.paramChangeByUI = (path, value) => changes.push([path, value]);
            expect(sync.state.value).toBe(0);
            await userEvent.click(sync.btn);
            expect(sync.state.value).toBe(1);
            expect(changes).toEqual([["/sync", 1]]);
        });
    });

    describe("geometry", () => {
        it("keeps every widget and group inside its group", () => {
            const outside: string[] = [];
            root.querySelectorAll(".faust-ui-group:not(.faust-ui-root) , .faust-ui-component").forEach((e) => {
                const parent = e.parentElement.closest(".faust-ui-group");
                if (!isInside(e.getBoundingClientRect(), parent.getBoundingClientRect())) outside.push(`${e.className} ${e.id}`);
            });
            expect(outside).toEqual([]);
        });

        it("keeps the menu of a narrow tab inside it", () => {
            // Regression: a menu ran out of its tab when another tab made the tgroup wider
            const { FX } = tgroups();
            const reverb = parts(FX).tabs[0].getBoundingClientRect();
            const echo = parts(FX).tabs[1].getBoundingClientRect();
            expect(reverb.width).toBeCloseTo(echo.width, 0);
            expect(isInside(widget("/room").getBoundingClientRect(), reverb)).toBe(true);
            expect(isInside(widget("/wet").getBoundingClientRect(), reverb)).toBe(true);
        });

        it("puts all the tabs of a tgroup at the same place, under its tab bar", () => {
            Object.values(tgroups()).forEach((tgroup) => {
                const [first, ...others] = parts(tgroup).tabs.map(t => t.getBoundingClientRect());
                others.forEach((r) => {
                    expect(r.left).toBeCloseTo(first.left, 0);
                    expect(r.top).toBeCloseTo(first.top, 0);
                });
                const { headers } = parts(tgroup);
                headers.forEach(h => expect(h.getBoundingClientRect().bottom).toBeLessThanOrEqual(first.top + border));
            });
        });

        it("lays its tab headers on one line inside the tgroup", () => {
            Object.values(tgroups()).forEach((tgroup) => {
                const box = tgroup.container.getBoundingClientRect();
                const headers = parts(tgroup).headers.map(h => h.getBoundingClientRect());
                headers.forEach((h, i) => {
                    expect(h.top).toBeCloseTo(headers[0].top, 0);
                    if (i) expect(h.left).toBeGreaterThan(headers[i - 1].right - 1);
                    expect(isInside(h, box)).toBe(true);
                });
            });
        });

        it("scales with the size of its DOM root", async () => {
            const { Sequencer } = tgroups();
            const before = Sequencer.container.getBoundingClientRect();
            const gridBefore = faustUI.grid;
            root.style.width = "2000px";
            root.style.height = "1400px";
            faustUI.resize();
            await nextFrames();
            const ratio = faustUI.grid / gridBefore;
            expect(ratio).toBeGreaterThan(1.5);
            const after = Sequencer.container.getBoundingClientRect();
            expect(after.width).toBeCloseTo(before.width * ratio, -1);
            expect(after.height).toBeCloseTo(before.height * ratio, -1);
            expect(parts(Sequencer).headers[0].getBoundingClientRect().height).toBeCloseTo(faustUI.grid - 20, 0);
        });
    });

    describe("styles", () => {
        it("styles the active header apart from the others", async () => {
            const { Sequencer } = tgroups();
            const [instrument, effect] = parts(Sequencer).headers;
            expect(getComputedStyle(instrument).backgroundColor).toBe("rgb(40, 40, 40)");
            expect(getComputedStyle(effect).backgroundColor).toBe("rgba(255, 255, 255, 0.5)");
            await userEvent.click(effect);
            expect(getComputedStyle(effect).backgroundColor).toBe("rgb(40, 40, 40)");
            expect(getComputedStyle(instrument).backgroundColor).not.toBe("rgb(40, 40, 40)");
        });

        it("draws its label", () => {
            const { Sequencer } = tgroups();
            const canvas = Sequencer.labelCanvas;
            expect(canvas.width).toBeGreaterThan(0);
            expect(canvas.height).toBeGreaterThan(0);
            const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
            expect(data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
        });
    });
});
