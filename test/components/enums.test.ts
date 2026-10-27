// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import AbstractItem from "../../src/components/AbstractItem";
import HSlider from "../../src/components/HSlider";
import Nentry from "../../src/components/Nentry";
import VSlider from "../../src/components/VSlider";

// Group.getComponent never makes an "enum" widget: these build them directly
const props = (enums: { [key: string]: number }) => ({
    address: "/e",
    type: "enum" as const,
    enums,
    min: 0,
    max: Object.keys(enums).length - 1,
    step: 1,
    init: 0,
    value: 0,
    style: { grid: 40, width: 5, height: 1, left: 0, top: 0 }
});
const three = { a: 0, b: 1, c: 2 };

describe("enum widgets", () => {
    it("count one step less than their entries", () => {
        expect(AbstractItem.enumSteps(three)).toBe(2);
        expect(AbstractItem.enumSteps({ a: 0 })).toBe(0);
        expect(AbstractItem.enumSteps({})).toBe(0);
        expect(AbstractItem.enumSteps(undefined)).toBe(0);
        expect(new Nentry(props(three)).stepsCount).toBe(2);
        expect(new HSlider(props(three)).stepsCount).toBe(2);
        expect(new VSlider(props(three)).stepsCount).toBe(2);
    });

    it.each([[0, 0], [1, 0.5], [2, 1]])("put entry %s at %s of their range", (value, distance) => {
        expect(AbstractItem.getDistance({ ...props(three), value, scale: "linear" })).toBe(distance);
    });

    it("put the only entry of a one-entry enum at the start", () => {
        expect(AbstractItem.getDistance({ ...props({ a: 0 }), value: 0, scale: "linear" })).toBe(0);
    });

    it.each([[0, 0], [0.4, 1], [0.5, 1], [0.9, 2], [1, 2]])("give the entry under the pointer, at %s of a slider: %s", (position, entry) => {
        const slider = new HSlider(props(three));
        slider.interactionRect = [0, 0, 1000, 10];
        expect(slider.getValueFromPos({ x: position * 1000, y: 5 })).toBe(entry);
    });
});
