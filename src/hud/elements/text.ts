import HudElement from "./element";
import { TextOptions } from "../../interfaces";

export default class Text extends HudElement {
	type: string = "text";

	constructor(group: any, options: TextOptions) {
		super(group, options);

		this.element = document.createElement("div");
		this.element.classList.add("text");
	
		this.element.innerText = this.options.text
	}

	set text(text: string) {
		this.element!.innerText = text;
	}

	get text(): string {
		return this.element!.innerText;
	}
}