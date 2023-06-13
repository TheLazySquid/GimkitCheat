import HudElement from "./element";
import { ColorPickerOptions } from "../../interfaces";
import { HexAlphaToRGBA, RGBAtoHexAlpha } from "../../utils";
    
export default class ColorPicker extends HudElement {
    opacitySlider: HTMLInputElement | null = null;
    colorPicker: HTMLInputElement | null = null;
    preview: HTMLElement | null = null;
    type: string = "colorpicker";

    constructor(group: any, options: ColorPickerOptions) {
        super(group, options);

        // create the element
        let element = document.createElement("div");
    
        element.innerHTML = `
            <div class="text">${this.options.text}</div>
            <div class="colorpicker_wrapper">
                <div class="colorpicker_opacity_wrapper">
                    <div class="text">Opacity</div>
                    <input type="range" min="0" max="255" value="255" class="colorpicker_opacity">
                </div>
                <input type="color" value="#ffffff" class="colorpicker_color">
                <div class="colorpicker_preview"></div>
            </div>
        `;
    
        element.classList.add("colorpicker");
    
        this.opacitySlider = element.querySelector(".colorpicker_opacity") as HTMLInputElement;
        this.colorPicker = element.querySelector(".colorpicker_color") as HTMLInputElement;
        this.preview = element.querySelector(".colorpicker_preview") as HTMLElement;
    
        if(this.options.bindVar) this.color = (window as any).cheat.hud.syncedVars.get("cssVars").get(this.options.bindVar);
        else if(this.options.color) this.color = this.options.color;
    
        // prevent the menu from being dragged when the slider is moved
        this.opacitySlider.addEventListener("mousedown", (e) => {e.stopPropagation()})
    
        this.opacitySlider?.addEventListener("input", () => {this.updatePreview()})
        this.colorPicker?.addEventListener("input", () => {this.updatePreview()})
    
        this.element = element;
    
        this.updatePreview();
    }

    updatePreview() {
        let color = this.colorPicker!.value;
        let opacity = parseInt(this.opacitySlider!.value);

        this.preview!.style.backgroundColor = color;
        this.preview!.style.opacity = `${opacity / 255}`;

        if(this.options.bindVar) {
            (window as any).cheat.hud.updateCssVar(this.options.bindVar, this.color);
        }

        this.dispatchEvent(new CustomEvent("change", {
            detail: this.color
        }))
    }

    set color(color: string) {
        let [hex, alpha] = RGBAtoHexAlpha(color);
        this.colorPicker!.value = hex;
        this.opacitySlider!.value = `${255 * alpha}`;

        this.updatePreview();
    }

    get color(): string {
        let color = this.colorPicker!.value;
        let opacity = parseInt(this.opacitySlider!.value);

        let rgba = HexAlphaToRGBA(color, opacity / 255);

        return rgba;
    }
}