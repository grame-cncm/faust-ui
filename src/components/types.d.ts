import { FaustUI } from "../FaustUI";

declare interface FaustUIItemProps<T extends FaustUIItemStyle> {
    value?: number;
    active?: boolean;
    focus?: boolean;
    label?: string;
    address: string;
    min?: number;
    max?: number;
    step?: number;
    tooltip?: string;
    enums?: { [key: string]: number };
    type?: "enum" | "int" | "float";
    unitstyle?: "time" | "hertz" | "decibel" | "%" | "pan" | "semitones" | "midi" | "custom" | "native";
    units?: string;
    exponent?: number;
    style?: T;
    emitter?: FaustUI;
}
declare interface FaustUIItemStyle {
    width: number;
    height: number;
    left: number;
    top: number;
}
