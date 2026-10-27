import { describe, expect, it } from "vitest";
import { atodb, dbtoa, denormalize, iNormExp, iNormLog, normalize, normExp, normLog, toMIDI, toRad } from "../src/components/utils";

describe("utils", () => {
    it("normalizes a value to its range, and back", () => {
        expect(normalize(5, 0, 10)).toBe(0.5);
        expect(normalize(-20, -40, 0)).toBe(0.5);
        expect(denormalize(0.5, -40, 0)).toBe(-20);
        // An empty range gives 0, not NaN
        expect(normalize(3, 3, 3)).toBe(0);
    });

    describe("log scale", () => {
        it("maps the middle of a range to its geometric mean", () => {
            expect(normLog(50.5, 1, 100)).toBeCloseTo(10);
            expect(iNormLog(10, 1, 100)).toBeCloseTo(50.5);
        });

        it("keeps the ends of the range", () => {
            expect(normLog(20, 20, 20000)).toBeCloseTo(20);
            expect(normLog(20000, 20, 20000)).toBeCloseTo(20000);
            expect(iNormLog(20, 20, 20000)).toBeCloseTo(20);
            expect(iNormLog(20000, 20, 20000)).toBeCloseTo(20000);
        });

        it.each([20, 100, 440, 1000, 5000, 19999])("goes back to %s", (frequency) => {
            expect(iNormLog(normLog(frequency, 20, 20000), 20, 20000)).toBeCloseTo(frequency, 6);
            expect(normLog(iNormLog(frequency, 20, 20000), 20, 20000)).toBeCloseTo(frequency, 6);
        });

        it("clamps to the range", () => {
            expect(iNormLog(1, 20, 20000)).toBeCloseTo(20);
            expect(iNormLog(1e6, 20, 20000)).toBeCloseTo(20000);
        });

        it("is the inverse of the exp scale", () => {
            expect(normExp).toBe(iNormLog);
            expect(iNormExp).toBe(normLog);
        });
    });

    it("converts amplitudes and decibels", () => {
        expect(atodb(1)).toBe(0);
        expect(atodb(0.1)).toBeCloseTo(-20);
        expect(dbtoa(-20)).toBeCloseTo(0.1);
        expect(dbtoa(atodb(0.5))).toBeCloseTo(0.5);
    });

    it("names MIDI notes, with middle C as C3", () => {
        expect([60, 61, 65, 66, 69, 71, 72, 0, 127, -1].map(toMIDI)).toEqual(["C3", "C#3", "F3", "F#3", "A3", "B3", "C4", "C-2", "G8", "B-3"]);
    });

    it("converts degrees to radians", () => {
        expect(toRad(180)).toBeCloseTo(Math.PI);
        expect(toRad(-90)).toBeCloseTo(-Math.PI / 2);
    });
});
