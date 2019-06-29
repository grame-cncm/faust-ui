/* eslint-disable @typescript-eslint/no-unused-vars */
import { toMIDI } from "./utils";
import { FaustUIItemStyle, FaustUIItemProps } from "./types";
import "./Base.scss";
import { Component } from "./Component";

export class FaustUIItem<T extends FaustUIItemStyle> extends Component<FaustUIItemProps<T>> {
    static defaultProps: FaustUIItemProps<FaustUIItemStyle> = {
        value: 0,
        active: true,
        focus: false,
        label: "",
        address: "",
        min: 0,
        max: 1,
        enums: {},
        type: "float",
        unitstyle: "native",
        units: "",
        exponent: 1,
        step: 0.01,
        style: { width: 45, height: 15, left: 0, top: 0 }
    }
    container: HTMLDivElement;
    className: string;
    handleKeyDown = (e: KeyboardEvent) => {};
    handleKeyUp = (e: KeyboardEvent) => {};
    handleTouchStart = (e: TouchEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        let prevX = e.touches[0].pageX;
        let prevY = e.touches[0].pageY;
        const fromX = prevX - rect.left;
        const fromY = prevY - rect.top;
        const prevValue = this.state.value;
        this.handlePointerDown({ x: fromX, y: fromY, originalEvent: e });
        const handleTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            const pageX = e.changedTouches[0].pageX;
            const pageY = e.changedTouches[0].pageY;
            const movementX = pageX - prevX;
            const movementY = pageY - prevY;
            prevX = pageX;
            prevY = pageY;
            const x = pageX - rect.left;
            const y = pageY - rect.top;
            this.handlePointerDrag({ prevValue, x, y, fromX, fromY, movementX, movementY, originalEvent: e });
        };
        const handleTouchEnd = (e: TouchEvent) => {
            e.preventDefault();
            const x = e.changedTouches[0].pageX - rect.left;
            const y = e.changedTouches[0].pageY - rect.top;
            this.handlePointerUp({ x, y, originalEvent: e });
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleTouchEnd);
        };
        document.addEventListener("touchmove", handleTouchMove, { passive: false });
        document.addEventListener("touchend", handleTouchEnd, { passive: false });
    };
    handleWheel = (e: WheelEvent) => {};
    handleClick = (e: MouseEvent) => {};
    handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).focus();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const fromX = e.pageX - rect.left;
        const fromY = e.pageY - rect.top;
        const prevValue = this.state.value;
        this.handlePointerDown({ x: fromX, y: fromY, originalEvent: e });
        const handleMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            const x = e.pageX - rect.left;
            const y = e.pageY - rect.top;
            this.handlePointerDrag({ prevValue, x, y, fromX, fromY, movementX: e.movementX, movementY: e.movementY, originalEvent: e });
        };
        const handleMouseUp = (e: MouseEvent) => {
            e.preventDefault();
            const x = e.pageX - rect.left;
            const y = e.pageY - rect.top;
            this.handlePointerUp({ x, y, originalEvent: e });
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };
    handleMouseOver = (e: MouseEvent) => {};
    handleMouseOut = (e: MouseEvent) => {};
    handleContextMenu = (e: MouseEvent) => {};
    handlePointerDown = (e: PointerDownEvent) => {};
    handlePointerDrag = (e: PointerDragEvent) => {};
    handlePointerUp = (e: PointerUpEvent) => {};
    handleFocusIn = (e: FocusEvent) => this.setState({ focus: true });
    handleFocusOut = (e: FocusEvent) => this.setState({ focus: false });
    get displayValue() {
        const { value, type, unitstyle, units } = this.state;
        if (type === "enum") return Object.keys(this.state.enums).find(key => this.state.enums[key] === value) || "";
        if (type === "int") return value.toFixed(0);
        if (type === "float") return value.toFixed(2);
        if (unitstyle === "time") return value.toFixed(type === "int" ? 0 : 2) + " ms";
        if (unitstyle === "hertz") return value.toFixed(type === "int" ? 0 : 2) + " Hz";
        if (unitstyle === "decibel") return value.toFixed(type === "int" ? 0 : 2) + " dB";
        if (unitstyle === "%") return value.toFixed(type === "int" ? 0 : 2) + " %";
        if (unitstyle === "pan") return value === 0 ? "C" : (type === "int" ? Math.abs(value) : Math.abs(value).toFixed(2)) + (value < 0 ? " L" : " R");
        if (unitstyle === "semitones") return value.toFixed(type === "int" ? 0 : 2) + " st";
        if (unitstyle === "midi") return toMIDI(value);
        if (unitstyle === "custom") return value.toFixed(type === "int" ? 0 : 2) + " " + units;
        if (unitstyle === "native") return value.toFixed(type === "int" ? 0 : 2);
        return "N/A";
    }
    setValue(value: number) {
        this.setState({ value });
        this.change(value);
    }
    change(valueIn?: number) {
        if (this.state.emitter) this.state.emitter.emit("paramChangeByUI", { value: typeof valueIn === "number" ? valueIn : this.state.value, path: this.state.address });
    }
    setState(newState: { [key in keyof FaustUIItemProps<T>]?: FaustUIItemProps<T>[key] }) {
        let shouldUpdate = false;
        for (const key in newState) {
            const stateKey = key as keyof FaustUIItemProps<T>;
            const stateValue = newState[stateKey];
            if (stateKey === "style") {
                if (this.state.style) {
                    for (const styleKey in newState.style) {
                        if (styleKey in this.state.style && this.state.style[styleKey] !== newState.style[styleKey]) {
                            this.state.style[styleKey] = newState.style[styleKey];
                            shouldUpdate = true;
                        }
                    }
                } else {
                    this.state.style = newState.style;
                    shouldUpdate = true;
                }
            } else if (stateKey in this.state && this.state[stateKey] !== stateValue) {
                (this.state as any)[stateKey] = stateValue;
                shouldUpdate = true;
            } else return;
            if (shouldUpdate) this.emit(stateKey, this.state[stateKey]);
        }
    }
    componentWillMount() {
        this.container = document.createElement("div");
        this.container.className = ["faust-ui-component", "faust-ui-component-" + this.className].join(" ");
        this.container.tabIndex = 1;
        this.container.title = this.state.tooltip;
    }
    resize() {
        const style = this.state ? { ...this.defaultProps.style, ...this.state.style } : this.defaultProps.style;
        this.container.style.width = `${style.width}px`;
        this.container.style.height = `${style.height}px`;
        this.container.style.left = `${style.left}px`;
        this.container.style.top = `${style.top}px`;
    }
    componentDidMount() {
        this.paint();
        this.state.emitter.on("paramChangeByDSP", (e) => {
            if (e.path === this.state.address) {
                this.setState({ value: e.value });
                this.paint();
            }
        });
        this.state.emitter.on("layoutChange", () => {
            const style = this.state.style;
            this.setState({ style });
            this.paint();
        });
        this.state.emitter.on("uiChange", () => {
            this.setState(this.state);
            this.paint();
        });
        this.on("style", () => this.resize());
    }
    paint() {}
    mount() {
        this.resize();
        return super.mount();
    }
}