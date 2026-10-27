import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { FaustUIItem } from "@grame/faustwasm";
import FaustUI from "../../src/FaustUI";
import type Button from "../../src/components/Button";
import type HSlider from "../../src/components/HSlider";
import type Knob from "../../src/components/Knob";
import type Led from "../../src/components/Led";
import type Menu from "../../src/components/Menu";
import type Nentry from "../../src/components/Nentry";
import type VSlider from "../../src/components/VSlider";
import { button, group, hslider, knob, menu, nentry, nextFrames, vslider } from "../helpers";

const led = (label: string): FaustUIItem => ({ type: "hbargraph", label, address: `/${label}`, index: 0, min: -60, max: 0, meta: [{ style: "led" }] } as FaustUIItem);

let root: HTMLDivElement;
let faustUI: FaustUI;
let changes: [string, number][];
beforeEach(async () => {
    root = document.createElement("div");
    Object.assign(root.style, { position: "relative", width: "1200px", height: "800px" });
    document.body.appendChild(root);
    faustUI = new FaustUI({
        root,
        ui: [
            group("vgroup", "Widgets", [
                group("hgroup", "Continuous", [hslider("h", 0.5), vslider("v"), knob("k"), nentry("n")]),
                group("hgroup", "Discrete", [button("b"), menu("m"), led("l")])
            ])
        ] as never,
        listenWindowResize: false,
        listenWindowMessage: false
    });
    changes = [];
    faustUI.paramChangeByUI = (path, value) => changes.push([path, value]);
    await nextFrames();
});
afterEach(() => {
    faustUI.destroy();
    root.remove();
});

const widget = <T>(path: string) => faustUI.componentMap[path][0] as T;
const pointer = (type: "pointerdown" | "pointermove" | "pointerup", target: EventTarget, [clientX, clientY]: number[]) => {
    target.dispatchEvent(new PointerEvent(type, { clientX, clientY, pointerId: 1, isPrimary: true, bubbles: true, cancelable: true }));
};
/**
 * The client point at (`fx`, `fy`) of the area of `slider` that sets its value
 */
const at = (slider: VSlider, fx: number, fy: number) => {
    const rect = slider.canvas.getBoundingClientRect();
    const [left, top, width, height] = slider.interactionRect;
    return [rect.left + left + fx * width, rect.top + top + fy * height];
};
/**
 * Presses the pointer on `target` at `from`, moves it through `path`, and releases it at the last point
 */
const drag = (target: EventTarget, from: number[], ...path: number[][]) => {
    pointer("pointerdown", target, from);
    path.forEach(p => pointer("pointermove", document, p));
    pointer("pointerup", document, path[path.length - 1] || from);
};

describe("widgets in a browser", () => {
    describe("hslider", () => {
        it("takes the value under the pointer", () => {
            const slider = widget<HSlider>("/h");
            pointer("pointerdown", slider.canvas, at(slider, 0.3, 0.5));
            pointer("pointerup", document, at(slider, 0.3, 0.5));
            expect(slider.state.value).toBe(0.3);
            expect(changes).toEqual([["/h", 0.3]]);
        });

        it("follows a drag, and stops at its ends", () => {
            const slider = widget<HSlider>("/h");
            drag(slider.canvas, at(slider, 0.5, 0.5), at(slider, 0.75, 0.5), at(slider, 1.5, 0.5));
            expect(slider.state.value).toBe(1);
            expect(changes).toEqual([["/h", 0.75], ["/h", 1]]);
            drag(slider.canvas, at(slider, 0.2, 0.5), at(slider, -1, 0.5));
            expect(slider.state.value).toBe(0);
        });

        it("goes back to its init value on double-click", async () => {
            const slider = widget<HSlider>("/h");
            // Off the init value: the presses of the double-click first set the value under the pointer
            const [left, , width, height] = slider.interactionRect;
            await userEvent.dblClick(slider.canvas, { position: { x: left + 0.9 * width, y: height / 2 } });
            expect(changes[0]).toEqual(["/h", 0.9]);
            expect(slider.state.value).toBe(0.5);
            expect(changes[changes.length - 1]).toEqual(["/h", 0.5]);
        });

        it("draws its value", async () => {
            const slider = widget<HSlider>("/h");
            // The color of the track at a quarter of the slider
            const pixel = () => {
                const rect = slider.canvas.getBoundingClientRect();
                const [x, y] = at(slider, 0.25, 0.5);
                const ratio = window.devicePixelRatio || 1;
                return Array.from(slider.ctx.getImageData((x - rect.left) * ratio, (y - rect.top) * ratio, 1, 1).data).join();
            };
            slider.setState({ value: 0 });
            await nextFrames();
            const empty = pixel();
            slider.setState({ value: 1 });
            await nextFrames();
            expect(pixel()).not.toBe(empty);
        });
    });

    describe("vslider", () => {
        it("takes the value under the pointer, from the bottom up", () => {
            const slider = widget<VSlider>("/v");
            drag(slider.canvas, at(slider, 0.5, 0.2));
            expect(slider.state.value).toBe(0.8);
            drag(slider.canvas, at(slider, 0.5, 0.5), at(slider, 0.5, 2));
            expect(slider.state.value).toBe(0);
        });
    });

    describe("knob", () => {
        it("turns with a vertical drag, and stops at its ends", () => {
            const k = widget<Knob>("/k");
            const { left, top, width, height } = k.canvas.getBoundingClientRect();
            const center = [left + width / 2, top + height / 2];
            drag(k.canvas, center, [center[0], center[1] - 50]);
            expect(k.state.value).toBe(0.5);
            drag(k.canvas, center, [center[0], center[1] - 200]);
            expect(k.state.value).toBe(1);
            drag(k.canvas, center, [center[0], center[1] + 300]);
            expect(k.state.value).toBe(0);
            expect(changes.map(([, v]) => v)).toEqual([0.5, 1, 0]);
        });

        it("takes the value typed in its field", async () => {
            const k = widget<Knob>("/k");
            await userEvent.fill(k.input, "0.25");
            k.input.dispatchEvent(new Event("change"));
            expect(k.state.value).toBe(0.25);
            expect(changes).toEqual([["/k", 0.25]]);
        });
    });

    it("a button sends 1 when pressed and 0 when released", async () => {
        const b = widget<Button>("/b");
        await userEvent.click(b.btn);
        expect(changes).toEqual([["/b", 1], ["/b", 0]]);
        expect(b.state.value).toBe(0);
    });

    it("a menu sends the option chosen", async () => {
        const m = widget<Menu>("/m");
        await userEvent.selectOptions(m.select, "2");
        expect(changes).toEqual([["/m", 2]]);
    });

    it("a nentry sends the value typed", async () => {
        const n = widget<Nentry>("/n");
        await userEvent.fill(n.input, "7");
        await userEvent.keyboard("{Tab}");
        expect(n.state.value).toBe(7);
        expect(changes).toEqual([["/n", 7]]);
    });

    it("a led changes color with the value of the DSP", async () => {
        const l = widget<Led>("/l");
        const center = () => Array.from(l.ctx.getImageData(l.canvas.width / 2, l.canvas.height / 2, 1, 1).data).join();
        faustUI.paramChangeByDSP("/l", -60);
        await nextFrames();
        const off = center();
        faustUI.paramChangeByDSP("/l", 0);
        await nextFrames();
        expect(center()).not.toBe(off);
        expect(changes).toEqual([]);
    });
});
