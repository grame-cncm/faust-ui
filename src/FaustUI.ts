import { EventEmitter } from "events";
import { Layout } from "./layout/Layout";
import { FaustUIRoot } from "./FaustUIRoot";
import "./index.scss";

type TOptions = {
    root: HTMLDivElement;
    ui?: TFaustUI;
}

export class FaustUI extends EventEmitter {
    on<K extends keyof FaustUIEventMap>(type: K, listener: (e: FaustUIEventMap[K]) => void) {
        return super.on(type, listener);
    }
    once<K extends keyof FaustUIEventMap>(type: K, listener: (e: FaustUIEventMap[K]) => void) {
        return super.once(type, listener);
    }
    off<K extends keyof FaustUIEventMap>(type: K, listener: (e: FaustUIEventMap[K]) => void) {
        return super.off(type, listener);
    }
    removeAllListeners<K extends keyof FaustUIEventMap>(type: K) {
        return super.removeAllListeners(type);
    }
    emit<K extends keyof FaustUIEventMap>(type: K, e?: FaustUIEventMap[K]) {
        return super.emit(type, e);
    }
    root: HTMLDivElement;
    faustUIRoot: FaustUIRoot;
    private _ui: TFaustUI;
    constructor(options: TOptions) {
        super();
        this.setMaxListeners(128);
        const { root, ui: uiIn } = options;
        this.root = root;
        this.ui = uiIn || [];
        this.render();
        window.addEventListener("resize", () => {
            this.faustUIRoot.setState(this.calc());
            this.emit("layoutChange");
        });
    }
    calc() {
        const { width, height } = this.root.getBoundingClientRect();
        const { items, layout } = Layout.calc(this.ui);
        this._ui = items;
        return { width, height, layout };
    }
    render() {
        const { width, height, layout } = this.calc();
        this.faustUIRoot = new FaustUIRoot({ width, height, layout, ui: this.ui, emitter: this });
        const children = this.faustUIRoot.render();
        children.forEach(e => this.root.appendChild(e));
        this.emit("uiConnected", this.ui);
    }
    get ui() {
        return this._ui;
    }
    set ui(uiIn) {
        this._ui = uiIn;
        const state = this.calc();
        this.emit("uiWillChange", this._ui);
        if (this.faustUIRoot) this.faustUIRoot.setState({ ...state, ui: this.ui });
        this.emit("uiChanged", this._ui);
        this.emit("uiConnected", this.ui);
    }
    changeParamByUI(path: string, value: number) {
        this.emit("paramChangeByUI", { path, value });
    }
    changeParamByDSP(path: string, value: number) {
        this.emit("paramChangeByDSP", { path, value });
    }
}
