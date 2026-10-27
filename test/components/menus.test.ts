// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FaustUIItem } from "@grame/faustwasm";
import Group from "../../src/components/Group";
import type Menu from "../../src/components/Menu";
import type Radio from "../../src/components/Radio";
import { fakeContext2D, group, mount } from "../helpers";

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fakeContext2D() as any);
});
afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
});

const enumsOf = (style: string) => Group.parseMeta([{ style }]).enums;

describe("Group.parseMeta", () => {
    it.each([
        ["menu{'a':0;'b':1}", { a: 0, b: 1 }],
        ["menu{'a':0}", { a: 0 }],
        ["radio{'a':0}", { a: 0 }],
        ["menu{'a':0;'b':1;}", { a: 0, b: 1 }],
        ["menu{'a':0;}", { a: 0 }],
        ["menu{ 'a' : 0 ; 'b' : 1 ; }", { a: 0, b: 1 }],
        ["menu{'Low pass':0;'High pass':1;'Band':2}", { "Low pass": 0, "High pass": 1, Band: 2 }],
        ["radio{'-6 dB':-6;'0 dB':0;'half':0.5;'up':+1}", { "-6 dB": -6, "0 dB": 0, half: 0.5, up: 1 }]
    ])("reads the entries of %s", (style, expected) => {
        expect(enumsOf(style)).toEqual(expected);
    });

    it.each(["knob", "menu", "menu{}", "menu{'a'}", "menu{'a':}", "led"])("reads no entries in %s", (style) => {
        expect(enumsOf(style)).toBeUndefined();
    });

    it("merges the meta objects", () => {
        const { metaObject, enums } = Group.parseMeta([{ style: "menu{'a':0}" }, { tooltip: "Mode" }, { unit: "Hz" }]);
        expect(metaObject).toEqual({ style: "menu{'a':0}", tooltip: "Mode", unit: "Hz" });
        expect(enums).toEqual({ a: 0 });
    });

    it("reads nothing without meta", () => {
        expect(Group.parseMeta(undefined)).toEqual({ metaObject: {} });
    });
});

const widget = (style: string): FaustUIItem => ({ type: "nentry", label: "w", address: "/w", index: 0, init: 0, min: 0, max: 3, step: 1, meta: [{ style }] } as FaustUIItem);
const mountWidget = <T>(style: string) => mount([group("vgroup", "G", [widget(style)])]).emitter.componentMap["/w"][0] as T;

describe("menu", () => {
    it.each([
        ["menu{'a':0}", ["a"]],
        ["menu{'a':0;'b':1;}", ["a", "b"]],
        ["menu{'a':0;'b':1;'c':3}", ["a", "b", "c"]]
    ])("shows the options of %s", (style, labels) => {
        const menu = mountWidget<Menu>(style);
        expect(Array.from(menu.select.options).map(o => o.text)).toEqual(labels);
    });

    it("sends the value of the option chosen", () => {
        const { emitter } = mount([group("vgroup", "G", [widget("menu{'a':0;'b':1;'c':3;}")])]);
        const menu = emitter.componentMap["/w"][0] as Menu;
        menu.select.value = "3";
        menu.select.dispatchEvent(new Event("change"));
        expect(emitter.changes).toEqual([{ path: "/w", value: 3 }]);
    });
});

describe("radio", () => {
    it.each([
        ["radio{'a':0}", ["a"]],
        ["radio{'a':0;'b':1;}", ["a", "b"]]
    ])("shows the buttons of %s", (style, labels) => {
        const radio = mountWidget<Radio>(style);
        const buttons = Array.from(radio.group.children);
        expect(buttons.map(b => b.textContent)).toEqual(labels);
        expect(buttons.every(b => b.querySelector("input[type=radio]"))).toBe(true);
    });

    it("sends the value of the button checked", () => {
        const { emitter } = mount([group("vgroup", "G", [widget("radio{'a':0;'b':2;}")])]);
        const radio = emitter.componentMap["/w"][0] as Radio;
        const input = radio.group.children[1].querySelector("input");
        input.checked = true;
        input.dispatchEvent(new Event("change"));
        expect(emitter.changes).toEqual([{ path: "/w", value: 2 }]);
    });
});
