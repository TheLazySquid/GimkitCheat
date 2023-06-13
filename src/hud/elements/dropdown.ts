import HudElement from "./element";
import { DropdownOptions } from "../../interfaces";

export default class Dropdown extends HudElement {
	select: HTMLSelectElement;
	type: string = "dropdown";

	constructor(group: any, options: DropdownOptions) {
		super(group, options);

		// create the element
		this.element = document.createElement("div");
		this.element.classList.add("dropdown_wrapper");

		this.element.innerHTML = `
			<div class="text">${options.text}</div>
			<select class="dropdown">
				${options.options.map((option: string) => {
					return `<option value="${option}" ${option === options.default ? "selected" : ""}>
						${option}
					</option>`
				}).join("")}
			</select>
		`

		this.select = this.element.querySelector(".dropdown")!;
		// prevent accidental navigation with arrows
		this.select.addEventListener("keydown", (e) => e.preventDefault())

		// add the event listener
		this.select.addEventListener("change", () => {
			if(options.runFunction) {
				(window as any).cheat.funcs.get(this.options.runFunction)(this.select.value);
			}
			this.dispatchEvent(new CustomEvent("change", {
				detail: this.select.value
			}))	
		})
	}

	addOption(option: string) {
		let optionElement = document.createElement("option");
		optionElement.value = option;
		optionElement.innerText = option;

		this.select.appendChild(optionElement);
	}

	removeOption(option: string) {
		let optionElement = this.select.querySelector(`option[value="${option}"]`);

		if(optionElement) {
			this.select.removeChild(optionElement);
		}

		if(this.select.value === option) {
			this.select.value = this.select.options[0].value;
		}
	}

	setOptions(options: string[]) {
		this.select.innerHTML = "";

		options.forEach((option: string) => {
			this.addOption(option);
		})
	}

	get value() {
		return this.select.value;
	}

	set value(value: string) {
		this.select.value = value;
	}
}