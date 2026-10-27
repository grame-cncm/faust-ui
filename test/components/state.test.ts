// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AbstractComponent from "../../src/components/AbstractComponent";
import type Group from "../../src/components/Group";
import type Nentry from "../../src/components/Nentry";
import { fakeContext2D, group, mount, nentry, nextFrames } from "../helpers";

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fakeContext2D() as any);
});
afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
});

/**
 * The events `component` emits for `keys`
 */
const record = (component: { on: (type: any, listener: (e: any) => any) => any }, keys: string[]) => {
    const events: [string, unknown][] = [];
    keys.forEach(key => component.on(key, (value: unknown) => events.push([key, value])));
    return events;
};

class Component extends AbstractComponent<{ a: number; b: number; c: number }> {
    static defaultProps = { a: 0, b: 0, c: 0 };
}

describe("setState", () => {
    describe("of a component", () => {
        it("sets and emits the changed keys after an unchanged one", () => {
            const component = new Component();
            const events = record(component, ["a", "b", "c"]);
            component.setState({ a: 0, b: 1, c: 2 });
            expect(component.state).toEqual({ a: 0, b: 1, c: 2 });
            expect(events).toEqual([["b", 1], ["c", 2]]);
        });

        it("skips an unknown key", () => {
            const component = new Component();
            component.setState({ d: 1, b: 1 } as any);
            expect(component.state).toEqual({ a: 0, b: 1, c: 0 });
        });
    });

    describe("of a widget", () => {
        const mountNentry = () => mount([group("vgroup", "G", [nentry("n", 3)])]).emitter.componentMap["/n"][0] as Nentry;

        it("sets and emits the changed keys after an unchanged one", () => {
            const widget = mountNentry();
            const events = record(widget, ["label", "value", "max"]);
            expect(widget.setState({ label: "n", value: 5, max: 20 })).toBe(true);
            expect([widget.state.value, widget.state.max]).toEqual([5, 20]);
            expect(events).toEqual([["value", 5], ["max", 20]]);
        });

        it("shows a value set after an unchanged key", async () => {
            const widget = mountNentry();
            widget.setState({ min: 0, value: 7 });
            await nextFrames();
            expect(widget.input.value).toBe("7");
        });

        it("tells whether something changed", () => {
            const widget = mountNentry();
            expect(widget.setState({ value: 3 })).toBe(false);
            expect(widget.setState({ value: 3, label: "n" })).toBe(false);
            expect(widget.setState({ unknown: 1 } as any)).toBe(false);
            expect(widget.setState({ value: 4 })).toBe(true);
        });

        it("sends a value to the DSP only when it changes", () => {
            const { emitter } = mount([group("vgroup", "G", [nentry("n", 3)])]);
            const widget = emitter.componentMap["/n"][0] as Nentry;
            widget.setValue(3);
            widget.setValue(4);
            widget.setValue(4);
            expect(emitter.changes).toEqual([{ path: "/n", value: 4 }]);
        });
    });

    describe("of a group", () => {
        it("sets and emits the style after an unchanged key", async () => {
            const { root } = mount([group("vgroup", "G", [nentry("n")])]);
            const g = root.children[0] as Group;
            const events = record(g, ["label", "style"]);
            g.setState({ label: "G", style: { grid: 80 } });
            expect(events.map(([key]) => key)).toEqual(["style"]);
            await nextFrames();
            expect(g.container.style.width).toBe(`${g.state.style.width * 80}px`);
        });

        it("sets a label after an unknown key", () => {
            const { root } = mount([group("vgroup", "G", [])]);
            const g = root.children[0] as Group;
            g.setState({ unknown: 1, label: "Renamed" } as any);
            expect(g.state.label).toBe("Renamed");
        });
    });
});
