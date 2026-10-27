// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FaustUIItem } from "@grame/faustwasm";
import type AbstractItem from "../../src/components/AbstractItem";
import type Button from "../../src/components/Button";
import type Knob from "../../src/components/Knob";
import type Nentry from "../../src/components/Nentry";
import type Radio from "../../src/components/Radio";
import Soundfile from "../../src/components/Soundfile";
import { button, checkbox, fakeContext2D, group, hbargraph, hslider, knob, menu, mount, nentry, nextFrames, radio, vbargraph, vslider } from "../helpers";

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fakeContext2D() as any);
});
afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
});

const led = (label: string): FaustUIItem => ({ ...hbargraph(label), min: -60, max: 0, meta: [{ style: "led" }] } as FaustUIItem);
const numerical = (label: string): FaustUIItem => ({ ...hbargraph(label), meta: [{ style: "numerical" }] } as FaustUIItem);
const soundfile = (label: string): FaustUIItem => ({ type: "soundfile", label, address: `/${label}`, index: 0 } as FaustUIItem);
const withMeta = (item: FaustUIItem, ...meta: object[]) => ({ ...item, meta: [...((item as any).meta || []), ...meta] } as FaustUIItem);
/**
 * Mounts `items` in a vgroup, and returns the component of each address
 */
const mountItems = (...items: FaustUIItem[]) => {
    const { emitter } = mount([group("vgroup", "G", items)]);
    const get = <T = AbstractItem<any>>(path: string) => emitter.componentMap[path][0] as unknown as T;
    return { emitter, get };
};

describe("widgets", () => {
    it.each([
        [hslider, "hslider"], [vslider, "vslider"], [nentry, "nentry"], [knob, "knob"], [menu, "menu"], [radio, "radio"],
        [button, "button"], [checkbox, "checkbox"], [hbargraph, "hbargraph"], [vbargraph, "vbargraph"], [led, "led"],
        [numerical, "numerical"], [soundfile, "soundfile"]
    ] as const)("%# mounts a %s registered at its address", (builder, className) => {
        const { get } = mountItems((builder as (label: string) => FaustUIItem)("w"));
        const w = get("/w");
        expect(w.container.classList).toContain("faust-ui-component");
        expect(w.container.classList).toContain(`faust-ui-component-${className}`);
        expect(w.container.id).toBe("/w");
        expect(document.body.contains(w.container)).toBe(true);
    });

    it("shows its tooltip", () => {
        const { get } = mountItems(withMeta(hslider("w"), { tooltip: "Gain of the output" }));
        expect(get("/w").container.title).toBe("Gain of the output");
    });

    it("shows a new label", async () => {
        const { get } = mountItems(button("w"));
        get<Button>("/w").setState({ label: "Go" });
        await nextFrames();
        expect(get<Button>("/w").span.innerText).toBe("Go");
    });

    describe("button and checkbox", () => {
        it.each([button, checkbox])("%# shows a value of the DSP", async (builder) => {
            const { get } = mountItems(builder("w"));
            const w = get<Button>("/w");
            expect(w.btn.style.backgroundColor).toBe("rgb(40, 40, 40)");
            w.setState({ value: 1 });
            await nextFrames();
            expect(w.btn.style.backgroundColor).toBe("rgb(18, 18, 18)");
            expect(w.btn.style.borderColor).toBe("rgb(255, 165, 0)");
        });
    });

    it("a radio checks the button of a value of the DSP", async () => {
        const { get } = mountItems(radio("w"));
        const r = get<Radio>("/w");
        r.setState({ value: 2 });
        await nextFrames();
        const checked = Array.from(r.group.querySelectorAll("input")).map(i => i.checked);
        expect(checked).toEqual([false, false, true]);
    });

    it("a nentry follows a change of its range and step", async () => {
        const { get } = mountItems(nentry("w"));
        const n = get<Nentry>("/w");
        n.setState({ min: -5, max: 20, step: 0.5 });
        await nextFrames();
        expect([n.input.min, n.input.max, n.input.step]).toEqual(["-5", "20", "0.5"]);
    });

    it("a knob clamps a value typed out of its range", async () => {
        const { get, emitter } = mountItems(knob("w"));
        const k = get<Knob>("/w");
        k.input.value = "5";
        k.input.dispatchEvent(new Event("change"));
        await nextFrames();
        expect(k.state.value).toBe(1);
        expect(k.input.value).toBe("1");
        expect(emitter.changes).toEqual([{ path: "/w", value: 1 }]);
    });

    it("a knob ignores a text that is not a number", async () => {
        const { get, emitter } = mountItems(knob("w", 0.5));
        const k = get<Knob>("/w");
        k.input.value = "loud";
        k.input.dispatchEvent(new Event("change"));
        expect(k.state.value).toBe(0.5);
        expect(k.input.value).toBe("0.5");
        expect(emitter.changes).toEqual([]);
    });

    it("a soundfile sends nothing when pressed", () => {
        const { get, emitter } = mountItems(soundfile("w"));
        const s = get<Soundfile>("/w");
        expect(s).toBeInstanceOf(Soundfile);
        s.handleMouseOrTouchDown();
        s.handleMouseOrTouchUp();
        expect(emitter.changes).toEqual([]);
    });

    it("an output sends nothing when the DSP changes its value", async () => {
        const { get, emitter } = mountItems(hbargraph("a"), vbargraph("b"), led("c"), numerical("d"));
        ["/a", "/b", "/c", "/d"].forEach(path => get(path).setState({ value: 0.5 }));
        await nextFrames();
        expect(emitter.changes).toEqual([]);
    });
});
