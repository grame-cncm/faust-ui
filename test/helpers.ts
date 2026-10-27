import type { FaustUIItem } from "@grame/faustwasm";
import Layout from "../src/layout/Layout";
import Group from "../src/components/Group";
import type FaustUI from "../src/FaustUI";

type GroupType = "vgroup" | "hgroup" | "tgroup";

/**
 * Builders of the UI items the Faust compiler gives
 */
export const hslider = (label: string, init = 0): FaustUIItem => ({ type: "hslider", label, address: `/${label}`, index: 0, init, min: 0, max: 1, step: 0.01 } as FaustUIItem);
export const vslider = (label: string, init = 0): FaustUIItem => ({ type: "vslider", label, address: `/${label}`, index: 0, init, min: 0, max: 1, step: 0.01 } as FaustUIItem);
export const nentry = (label: string, init = 0): FaustUIItem => ({ type: "nentry", label, address: `/${label}`, index: 0, init, min: 0, max: 10, step: 1 } as FaustUIItem);
export const knob = (label: string, init = 0): FaustUIItem => ({ type: "hslider", label, address: `/${label}`, index: 0, init, min: 0, max: 1, step: 0.01, meta: [{ style: "knob" }] } as FaustUIItem);
export const menu = (label: string, init = 0): FaustUIItem => ({ type: "nentry", label, address: `/${label}`, index: 0, init, min: 0, max: 2, step: 1, meta: [{ style: "menu{'a':0;'b':1;'c':2}" }] } as FaustUIItem);
export const radio = (label: string, init = 0): FaustUIItem => ({ type: "nentry", label, address: `/${label}`, index: 0, init, min: 0, max: 2, step: 1, meta: [{ style: "radio{'a':0;'b':1;'c':2}" }] } as FaustUIItem);
export const button = (label: string): FaustUIItem => ({ type: "button", label, address: `/${label}`, index: 0 } as FaustUIItem);
export const checkbox = (label: string): FaustUIItem => ({ type: "checkbox", label, address: `/${label}`, index: 0 } as FaustUIItem);
export const hbargraph = (label: string): FaustUIItem => ({ type: "hbargraph", label, address: `/${label}`, index: 0, min: 0, max: 1 } as FaustUIItem);
export const vbargraph = (label: string): FaustUIItem => ({ type: "vbargraph", label, address: `/${label}`, index: 0, min: 0, max: 1 } as FaustUIItem);
export const group = (type: GroupType, label: string, items: FaustUIItem[]): FaustUIItem => ({ type, label, items } as FaustUIItem);

/**
 * A 2D context that draws nothing, for jsdom which has no canvas
 */
export const fakeContext2D = () => new Proxy({} as Record<string | symbol, unknown>, {
    // Methods return what gradients and image data need: a color stop to add, and pixels
    get: (target, key) => (key in target ? target[key] : () => ({ addColorStop: () => undefined, data: new Uint8ClampedArray(4) })),
    set: (target, key, value) => {
        target[key] = value;
        return true;
    }
}) as unknown as CanvasRenderingContext2D;

/**
 * An emitter that records what the components send, as FaustUI would receive it
 */
export const fakeEmitter = () => {
    const componentMap: Record<string, any[]> = {};
    const changes: { path: string; value: number }[] = [];
    return {
        componentMap,
        changes,
        register: (path: string, item: any) => (componentMap[path] = componentMap[path] || []).push(item),
        unregister: (path: string, item: any) => {
            const remaining = (componentMap[path] || []).filter(i => i !== item);
            if (remaining.length) componentMap[path] = remaining;
            else delete componentMap[path];
        },
        paramChangeByUI: (path: string, value: number) => changes.push({ path, value })
    };
};

/**
 * Lays out `ui` and mounts it as `FaustUI.mount` does
 */
export const mount = (ui: FaustUIItem[], { grid = 40, emitter = fakeEmitter(), parent = document.body } = {}) => {
    const { items, layout } = Layout.calc(ui);
    const root = new Group({
        label: "",
        type: "vgroup",
        items,
        style: { grid, width: layout.width, height: layout.height, left: layout.offsetLeft, top: layout.offsetTop },
        isRoot: true,
        emitter: emitter as unknown as FaustUI
    });
    root.componentWillMount();
    root.mount();
    parent.appendChild(root.container);
    root.componentDidMount();
    return { root, emitter, layout };
};

/**
 * The tab headers and the tab containers of a mounted tgroup
 */
export const parts = (tgroup: Group) => ({
    headers: Array.from(tgroup.tabs.children) as HTMLSpanElement[],
    tabs: tgroup.children.map(c => c.container)
});

/**
 * Whether an element is shown, following CSS visibility inheritance of inline styles up to the document
 */
export const isShown = (element: HTMLElement) => {
    for (let e: HTMLElement = element; e; e = e.parentElement) {
        const { visibility } = e.style;
        if (visibility === "hidden") return false;
        if (visibility === "visible") return true;
    }
    return true;
};

/**
 * Waits for the components to run the tasks they scheduled (widgets render every 3 frames)
 */
export const nextFrames = async (count = 4) => {
    for (let i = 0; i < count; i++) await new Promise(resolve => window.requestAnimationFrame(resolve));
};
