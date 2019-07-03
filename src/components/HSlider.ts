import "./HSlider.scss";
import { fillRoundedRect } from "./utils";
import { FaustUIVSlider } from "./VSlider";

export class FaustUIHSlider extends FaustUIVSlider {
    className = "hslider";

    setStyle() {
        const style = { ...this.defaultProps.style, ...this.state.style };
        this.input.style.fontSize = `${style.fontsize || style.height * 0.2}px`;
        this.input.style.color = style.textcolor;
        this.label.style.fontSize = `${style.height * 0.2}px`;
        this.label.style.color = style.labelcolor;
        this.container.style.backgroundColor = style.bgcolor;
        this.container.style.borderColor = style.bordercolor;
        this.paint();
    }
    paint() {
        const { sliderwidth, sliderbgcolor, sliderbgoncolor, slidercolor } = { ...this.defaultProps.style, ...this.state.style };
        const ctx = this.ctx;
        const canvas = this.canvas;
        const distance = this.distance;
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = width;
        canvas.height = height;

        const drawWidth = width * 0.9;
        const drawHeight = sliderwidth || Math.min(height / 3, drawWidth * 0.05);
        const left = width * 0.05;
        const top = (height - drawHeight) * 0.5;
        const borderRadius = drawHeight * 0.25;
        this.interactionRect = [left, 0, drawWidth, height];
        const grd = ctx.createLinearGradient(left, 0, left + drawWidth, 0);
        grd.addColorStop(Math.max(0, Math.min(1, distance)), sliderbgoncolor);
        grd.addColorStop(Math.max(0, Math.min(1, distance)), sliderbgcolor);
        ctx.fillStyle = grd;
        fillRoundedRect(ctx, left, top, drawWidth, drawHeight, borderRadius);
        // draw slider
        ctx.fillStyle = slidercolor;
        fillRoundedRect(ctx, left + drawWidth * distance - drawHeight, top - drawHeight, drawHeight * 2, drawHeight * 3, borderRadius);
    }
}
