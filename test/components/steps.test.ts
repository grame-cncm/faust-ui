// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FaustUIItem } from "@grame/faustwasm";
import type Group from "../../src/components/Group";
import type HSlider from "../../src/components/HSlider";
import type Knob from "../../src/components/Knob";
import type Nentry from "../../src/components/Nentry";
import type AbstractItem from "../../src/components/AbstractItem";
import { countSteps, decimals } from "../../src/components/utils";
import { fakeContext2D, group, mount } from "../helpers";

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fakeContext2D() as any);
});
afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
});

type Range = { init?: number; min: number; max: number; step: number };
const item = (type: "hslider" | "nentry", { init = 0, min, max, step }: Range, meta?: FaustUIItem["meta"]) => ({ type, label: "p", address: "/p", index: 0, init, min, max, step, meta } as FaustUIItem);
/**
 * Mounts one widget of `type` with `range`, in a vgroup
 */
const mountWidget = <T extends AbstractItem<any>>(type: "hslider" | "nentry" | "knob", range: Range) => {
    const ui = [group("vgroup", "G", [type === "knob" ? item("hslider", range, [{ style: "knob" }]) : item(type, range)])];
    const { root, emitter } = mount(ui);
    return { widget: emitter.componentMap["/p"][0] as T, group: root.children[0] as Group, emitter };
};

describe("utils", () => {
    it("counts the whole steps in a range despite floating-point errors", () => {
        expect(countSteps(0.3, 0.1)).toBe(3);
        expect(countSteps(1, 0.1)).toBe(10);
        expect(countSteps(0.95, 0.1)).toBe(9);
        expect(countSteps(19980, 0.01)).toBe(1998000);
        expect(countSteps(0, 0.1)).toBe(0);
    });

    it("counts the decimals of a number", () => {
        expect([0.1, 0.25, 0.01, 1, 440, 1e-7, 0.001, 2.5].map(decimals)).toEqual([1, 2, 2, 0, 0, 7, 3, 1]);
    });
});

describe("step of a widget", () => {
    it.each([
        // min, max, step, value given, value kept
        [0, 1, 0.1, 0.3, 0.3],
        [0, 1, 0.1, 0.6, 0.6],
        [0, 1, 0.1, 0.7, 0.7],
        [0, 1, 0.1, 0.33, 0.3],
        [0, 1, 0.1, 0.37, 0.4],
        [0, 1, 0.1, 1, 1],
        [-1, 1, 0.1, -0.3, -0.3],
        [-1, 1, 0.1, 0.9, 0.9],
        [20, 20000, 0.01, 440, 440],
        [20, 20000, 0.01, 440.123, 440.12],
        [0, 0.3, 0.1, 0.3, 0.3],
        [0.05, 1, 0.1, 0.25, 0.25],
        [0, 10, 1, 7.4, 7],
        [0, 10, 1, 7.6, 8],
        [0, 10, 2.5, 6, 5],
        [0, 1, 0.001, 0.123, 0.123]
    ])("in [%s, %s] by %s keeps %s as %s", (min, max, step, value, expected) => {
        const { widget } = mountWidget<Nentry>("nentry", { min, max, step });
        expect(widget.toValidNumber(value)).toBe(expected);
    });

    it("clamps to the range", () => {
        const { widget } = mountWidget<Nentry>("nentry", { min: 0, max: 1, step: 0.1 });
        expect(widget.toValidNumber(2)).toBe(1);
        expect(widget.toValidNumber(-1)).toBe(0);
    });

    it("does not go past a max that is not on a step", () => {
        const { widget } = mountWidget<Nentry>("nentry", { min: 0, max: 0.95, step: 0.1 });
        expect(widget.toValidNumber(0.95)).toBe(0.9);
        expect(widget.toValidNumber(2)).toBe(0.9);
    });

    it("keeps any value in the range when there is no step", () => {
        const { widget } = mountWidget<Nentry>("nentry", { min: 0, max: 1, step: 0 });
        // A step of 0 in the Faust UI becomes 1 in the component: set it on the state
        widget.state.step = 0;
        expect(widget.toValidNumber(0.123456)).toBe(0.123456);
        expect(widget.toValidNumber(3)).toBe(1);
    });

    it("sends the value typed in a nentry", () => {
        const { widget, emitter } = mountWidget<Nentry>("nentry", { min: 0, max: 1, step: 0.1 });
        widget.input.value = "0.3";
        widget.input.dispatchEvent(new Event("change"));
        expect(widget.state.value).toBe(0.3);
        expect(emitter.changes).toEqual([{ path: "/p", value: 0.3 }]);
    });

    it("sends the value typed in a knob", () => {
        const { widget, emitter } = mountWidget<Knob>("knob", { min: 0, max: 1, step: 0.1 });
        widget.input.value = "0.7";
        widget.input.dispatchEvent(new Event("change"));
        expect(emitter.changes).toEqual([{ path: "/p", value: 0.7 }]);
    });

    it("goes back to its init value exactly when its group label is double-clicked", () => {
        const { widget, group: g } = mountWidget<HSlider>("hslider", { init: 0.3, min: 0, max: 1, step: 0.1 });
        widget.setValue(0.8);
        g.labelCanvas.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
        expect(widget.state.value).toBe(0.3);
    });

    it("counts the steps of a slider up to a max that is on a step", () => {
        const { widget } = mountWidget<HSlider>("hslider", { min: 0, max: 0.3, step: 0.1 });
        expect(widget.stepsCount).toBe(3);
    });

    it.each([
        [0, 1, 0.1, 0.7, 0.7],
        [0, 1, 0.1, 0.3, 0.3],
        [0, 0.3, 0.1, 1, 0.3],
        [-1, 1, 0.1, 0.35, -0.3]
    ])("sets a slider in [%s, %s] by %s clicked at %s of its width to %s", (min, max, step, position, expected) => {
        const { widget, emitter } = mountWidget<HSlider>("hslider", { min, max, step });
        // jsdom lays nothing out: give the slider the rectangle it would have
        widget.interactionRect = [0, 0, 1000, 10];
        widget.handleMouseOrTouchDown({ pointerId: -1, x: position * 1000, y: 5, originalEvent: null });
        expect(widget.state.value).toBe(expected);
        expect(emitter.changes).toEqual([{ path: "/p", value: expected }]);
    });
});
