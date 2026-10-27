import type { FaustUIItem } from "@grame/faustwasm";
import { button, checkbox, group, hbargraph, hslider, knob, menu, nentry, radio, vbargraph, vslider } from "./helpers";

/**
 * The UI faustwasm gives a polyphonic DSP with an effect: the voice and the effect UIs
 * under the Instrument and Effect tabs of a tgroup (see `FaustWebAudioDsp.getMeta`).
 * The effect has its own tgroup, and its tabs are wider than the instrument.
 */
export const sequencer = (): FaustUIItem[] => [
    group("tgroup", "Sequencer", [
        group("vgroup", "Instrument", [
            group("hgroup", "Voice", [menu("wave"), knob("cutoff", 0.5)]),
            group("tgroup", "Envelope", [
                group("hgroup", "Amp", [vslider("attack"), vslider("release", 0.3)]),
                group("hgroup", "Filter", [vslider("fattack"), vslider("frelease")])
            ]),
            hslider("gain", 0.5),
            button("gate")
        ]),
        group("vgroup", "Effect", [
            group("tgroup", "FX", [
                group("hgroup", "Reverb", [menu("room"), hslider("wet", 0.2)]),
                group("hgroup", "Echo", [hslider("time", 0.25), hslider("feedback", 0.4), hslider("mix", 0.1), checkbox("sync")]),
                group("vgroup", "Meters", [hbargraph("level"), vbargraph("peak")])
            ]),
            radio("routing"),
            nentry("voices", 4)
        ])
    ])
];
