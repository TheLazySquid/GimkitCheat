import { SliderOptions } from "../../interfaces";
import HudElement from "./element";

export default class Slider extends HudElement {
	slider: HTMLInputElement

    constructor(group: any, options: SliderOptions) {
        super(group, options);

		let element = document.createElement("div");
		element.classList.add("slider_wrapper")

		element.innerHTML = `
			<div class = "text">${options.text}</div>
			<input type = "range" min = "${options.min}" max = "${options.max}" value = "${options.default ?? 0}" class = "slider">
		`

		this.slider = element.querySelector(".slider") as HTMLInputElement;
		this.element = element;

		// prevent the slider from dragging the menu when clicked
		this.slider.addEventListener("mousedown", (e) => {
			e.stopPropagation();
		})

		// listen for changes
		this.slider.addEventListener("input", () => {
			if(this.options.runFunction) (window as any).cheat.funcs.get(this.options.runFunction)(this.slider.value);
			this.dispatchEvent(new CustomEvent("change", {
				detail: this.slider.value
			}))
		})
    }

    set value(value: number) {
		this.slider.value = value.toString();
    }

    get value() {
		return Number(this.slider.value);
    }
}