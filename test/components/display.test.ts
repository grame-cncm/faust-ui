// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FaustUIItem } from "@grame/faustwasm";
import type AbstractItem from "../../src/components/AbstractItem";
import type HSlider from "../../src/components/HSlider";
import type Knob from "../../src/components/Knob";
import type Nentry from "../../src/components/Nentry";
import type Numerical from "../../src/components/Numerical";
import type VBargraph from "../../src/components/VBargraph";
import { fakeContext2D, group, mount, nextFrames } from "../helpers";

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fakeContext2D() as any);
});
afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
});

type Options = { init?: number; min?: number; max?: number; step?: number; style?: string; unit?: string };
const input = (type: "hslider" | "nentry", { init = 0, min = 0, max = 1, step = 0.01, style, unit }: Options = {}) => ({
    type, label: "p", address: "/p", index: 0, init, min, max, step, meta: [...(style ? [{ style }] : []), ...(unit ? [{ unit }] : [])]
} as FaustUIItem);
const output = (type: "hbargraph" | "vbargraph", { min = 0, max = 1, style, unit }: Options = {}) => ({
    type, label: "p", address: "/p", index: 0, min, max, meta: [...(style ? [{ style }] : []), ...(unit ? [{ unit }] : [])]
} as FaustUIItem);
/**
 * Mounts `item`, and returns its component
 */
const mountItem = <T extends AbstractItem<any>>(item: FaustUIItem) => mount([group("vgroup", "G", [item])]).emitter.componentMap["/p"][0] as T;
/**
 * Sets the value of `widget` as the DSP does, and waits for it to be displayed
 */
const fromDSP = async (widget: AbstractItem<any>, value: number) => {
    widget.setState({ value });
    await nextFrames();
};

describe("displayed value", () => {
    describe("of a nentry", () => {
        it("has the decimals of a fine step", async () => {
            const nentry = mountItem<Nentry>(input("nentry", { init: 0.0002, step: 0.0001 }));
            expect(nentry.input.value).toBe("0.0002");
            await fromDSP(nentry, 0.0004);
            expect(nentry.input.value).toBe("0.0004");
        });

        it("shows the value typed on a fine step", async () => {
            const nentry = mountItem<Nentry>(input("nentry", { step: 0.0001 }));
            nentry.input.value = "0.0005";
            nentry.input.dispatchEvent(new Event("change"));
            await nextFrames();
            expect(nentry.state.value).toBe(0.0005);
            expect(nentry.input.value).toBe("0.0005");
        });

        it("has no exponent for a tiny step", async () => {
            const nentry = mountItem<Nentry>(input("nentry", { max: 0.001, step: 1e-7 }));
            await fromDSP(nentry, 3e-7);
            expect(nentry.input.value).toBe("0.0000003");
        });
    });

    it("of an hslider has the decimals of a fine step, and its unit", async () => {
        const slider = mountItem<HSlider>(input("hslider", { step: 0.0001, unit: "s" }));
        await fromDSP(slider, 0.0004);
        expect(slider.inputNumber.value).toBe("0.0004");
        expect(slider.input.value).toBe("0.0004s");
    });

    it("of a knob has the decimals of a fine step", async () => {
        const knob = mountItem<Knob>(input("hslider", { step: 0.0001, style: "knob" }));
        await fromDSP(knob, 0.0004);
        expect(knob.input.value).toBe("0.0004");
    });

    it("of a numerical has the decimals of a small range", async () => {
        const numerical = mountItem<Numerical>(output("hbargraph", { max: 0.001, style: "numerical", unit: "V" }));
        await fromDSP(numerical, 0.00042);
        expect(numerical.input.value).toBe("0.00042V");
    });

    it.each(["hbargraph", "vbargraph"] as const)("of a %s has the decimals of a small range", async (type) => {
        const bargraph = mountItem<VBargraph>(output(type, { max: 0.01 }));
        await fromDSP(bargraph, 0.0042);
        expect(bargraph.input.value).toBe("0.0042");
    });

    describe("keeps 3 decimals", () => {
        it("for a step of 0.01 and a value of the DSP", async () => {
            const nentry = mountItem<Nentry>(input("nentry", { step: 0.01 }));
            await fromDSP(nentry, 0.123456);
            expect(nentry.input.value).toBe("0.123");
        });

        it("for a dB bargraph", async () => {
            const bargraph = mountItem<VBargraph>(output("vbargraph", { min: -70, max: 6, unit: "dB" }));
            await fromDSP(bargraph, -12.3456);
            expect(bargraph.input.value).toBe("-12.346dB");
        });
    });

    it.each([
        // step, value, displayed
        [1, 7, "7"],
        [0.01, 0.30000001192092896, "0.3"],
        [0.01, -0.00001, "0"],
        [0.5, 2.5, "2.5"],
        [10, 440, "440"]
    ])("on a step of %s shows %s as %s", async (step, value, expected) => {
        const nentry = mountItem<Nentry>(input("nentry", { min: -1000, max: 1000, step }));
        await fromDSP(nentry, value);
        expect(nentry.input.value).toBe(expected);
    });
});
