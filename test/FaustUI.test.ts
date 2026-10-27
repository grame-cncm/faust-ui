// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FaustUIItem } from "@grame/faustwasm";
import FaustUI from "../src/FaustUI";
import Group from "../src/components/Group";
import Menu from "../src/components/Menu";
import Nentry from "../src/components/Nentry";
import { fakeContext2D, group, hslider, isShown, nentry, nextFrames, parts } from "./helpers";
import { sequencer } from "./fixtures";

let root: HTMLDivElement;
beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fakeContext2D() as any);
    root = document.createElement("div");
    document.body.appendChild(root);
});
afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
});

const createUI = (ui: FaustUIItem[], listenWindowMessage = false) => new FaustUI({ root, ui: ui as never, listenWindowResize: false, listenWindowMessage });
/**
 * The tgroups of a mounted UI, by label
 */
const tgroups = (faustUI: FaustUI) => {
    const found: Record<string, Group> = {};
    const walk = (g: Group) => g.children.forEach((c) => {
        if (!(c instanceof Group)) return;
        if (c.state.type === "tgroup") found[c.state.label] = c;
        walk(c);
    });
    walk(faustUI.faustUIRoot);
    return found;
};
const shown = (faustUI: FaustUI, path: string) => isShown(faustUI.componentMap[path][0].container);

describe("FaustUI with tgroups", () => {
    it("mounts one root group in its DOM root", () => {
        const faustUI = createUI(sequencer());
        expect(root.children).toHaveLength(1);
        expect(root.firstElementChild).toBe(faustUI.faustUIRoot.container);
        expect(faustUI.faustUIRoot.container.classList).toContain("faust-ui-root");
        expect(Object.keys(tgroups(faustUI)).sort()).toEqual(["Envelope", "FX", "Sequencer"]);
    });

    it("registers the widgets of every tab", () => {
        const faustUI = createUI(sequencer());
        expect(Object.keys(faustUI.componentMap).sort()).toEqual([
            "/attack", "/cutoff", "/fattack", "/feedback", "/frelease", "/gain", "/gate", "/level", "/mix", "/peak",
            "/release", "/room", "/routing", "/sync", "/time", "/voices", "/wave", "/wet"
        ]);
    });

    it("shows the first tab of each tgroup, and only what is in shown tabs", () => {
        const faustUI = createUI(sequencer());
        expect(["/wave", "/attack", "/gain", "/gate"].map(p => shown(faustUI, p))).toEqual([true, true, true, true]);
        expect(["/fattack", "/room", "/time", "/level", "/routing"].map(p => shown(faustUI, p))).toEqual([false, false, false, false, false]);
    });

    it("shows the effect, and only its active tab, when the Effect tab is clicked", () => {
        const faustUI = createUI(sequencer());
        const { Sequencer, FX } = tgroups(faustUI);
        parts(Sequencer).headers[1].click();
        expect(["/wave", "/attack", "/gain"].map(p => shown(faustUI, p))).toEqual([false, false, false]);
        expect(["/room", "/wet", "/routing", "/voices"].map(p => shown(faustUI, p))).toEqual([true, true, true, true]);
        expect(["/time", "/level"].map(p => shown(faustUI, p))).toEqual([false, false]);
        parts(FX).headers[2].click();
        expect(["/room", "/level", "/peak"].map(p => shown(faustUI, p))).toEqual([false, true, true]);
    });

    it("sends the values changed in a tab with paramChangeByUI", () => {
        const faustUI = createUI(sequencer());
        const paramChangeByUI = vi.fn();
        faustUI.paramChangeByUI = paramChangeByUI;
        parts(tgroups(faustUI).Sequencer).headers[1].click();
        const room = faustUI.componentMap["/room"][0] as Menu;
        room.select.value = "1";
        room.select.dispatchEvent(new Event("change"));
        expect(paramChangeByUI).toHaveBeenCalledWith("/room", 1);
    });

    it("posts the values changed by the UI to the window that sent the UI", () => {
        const faustUI = createUI(sequencer());
        const hostWindow = { postMessage: vi.fn() };
        faustUI.hostWindow = hostWindow as any;
        (faustUI.componentMap["/voices"][0] as Nentry).setValue(6);
        expect(hostWindow.postMessage).toHaveBeenCalledWith({ path: "/voices", value: 6, type: "param" }, "*");
    });

    it("applies the values of the DSP to the widgets of hidden tabs", async () => {
        const faustUI = createUI(sequencer());
        expect(shown(faustUI, "/room")).toBe(false);
        faustUI.paramChangeByDSP("/room", 2);
        faustUI.paramChangeByDSP("/feedback", 0.8);
        await nextFrames();
        const room = faustUI.componentMap["/room"][0] as Menu;
        expect(room.state.value).toBe(2);
        expect(room.select.selectedIndex).toBe(2);
        expect(faustUI.componentMap["/feedback"][0].state.value).toBe(0.8);
        // An unknown path is ignored
        expect(() => faustUI.paramChangeByDSP("/unknown", 1)).not.toThrow();
    });

    it("leaves out hidden widgets and soundfiles in tabs", () => {
        const faustUI = createUI([
            group("tgroup", "T", [
                group("vgroup", "A", [hslider("shown"), { ...hslider("secret"), meta: [{ hidden: "1" }] } as FaustUIItem]),
                group("vgroup", "B", [{ type: "soundfile", label: "sf", address: "/sf", index: 0 } as FaustUIItem, nentry("n")])
            ])
        ]);
        expect(Object.keys(faustUI.componentMap).sort()).toEqual(["/n", "/shown"]);
        const [a, b] = tgroups(faustUI).T.children as Group[];
        expect(a.children).toHaveLength(1);
        expect(b.children).toHaveLength(1);
    });

    it("mounts a new UI from scratch, with its first tab shown", () => {
        const faustUI = createUI(sequencer());
        parts(tgroups(faustUI).Sequencer).headers[1].click();
        faustUI.ui = [group("tgroup", "New", [group("vgroup", "X", [hslider("x")]), group("vgroup", "Y", [hslider("y")])])];
        expect(root.children).toHaveLength(1);
        expect(Object.keys(faustUI.componentMap).sort()).toEqual(["/x", "/y"]);
        expect(Object.keys(tgroups(faustUI))).toEqual(["New"]);
        expect([shown(faustUI, "/x"), shown(faustUI, "/y")]).toEqual([true, false]);
    });

    it("takes a new UI or a param value from a window message", async () => {
        const faustUI = createUI([], true);
        window.postMessage({ type: "ui", ui: sequencer() }, "*");
        await vi.waitFor(() => expect(faustUI.componentMap["/room"]).toBeDefined());
        expect(Object.keys(tgroups(faustUI)).sort()).toEqual(["Envelope", "FX", "Sequencer"]);
        window.postMessage({ type: "param", path: "/room", value: 1 }, "*");
        await vi.waitFor(() => expect(faustUI.componentMap["/room"][0].state.value).toBe(1));
    });

    it("has a minimum size of 40 pixels per grid unit", () => {
        const faustUI = createUI(sequencer());
        expect(faustUI.minWidth).toBeCloseTo(faustUI.layout.width * 40 + 1);
        expect(faustUI.minHeight).toBeCloseTo(faustUI.layout.height * 40 + 1);
    });

    it("resizes the tgroups to the size of its DOM root", async () => {
        const faustUI = createUI(sequencer());
        expect(faustUI.grid).toBe(40);
        const { Sequencer } = tgroups(faustUI);
        const width = faustUI.layout.width * 80;
        const height = faustUI.layout.height * 80;
        vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ width, height, left: 0, top: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => undefined } as DOMRect);
        faustUI.resize();
        expect(faustUI.grid).toBeCloseTo(80);
        await nextFrames();
        expect(Sequencer.tabs.style.height).toBe("80px");
        parts(Sequencer).headers.forEach(h => expect(h.style.width).toBe(`${2 * 80 - 20}px`));
        const sequencerItem = faustUI.ui[0] as any;
        expect(Sequencer.container.style.width).toBe(`${sequencerItem.layout.width * 80}px`);
    });
});
