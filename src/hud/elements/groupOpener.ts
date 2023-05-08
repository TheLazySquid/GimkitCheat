import HudElement from "./element";
import { GroupOpenerOptions } from "../../interfaces";

export default class GroupOpener extends HudElement {
	constructor(group: any, options: GroupOpenerOptions) {
		super(group, options);

		this.element = document.createElement("button");
		this.element.classList.add("group_opener");
	
		this.element.innerText = this.options.text
	
		this.element.addEventListener("click", () => {
			let direction = this.options.direction ?? "right";
			let oppositeDirection = direction == "right" ? "left" : "right";
			
			// open the group
			this.group.slide("out", direction);
			let groupToOpen = this.group.menu.getAnyGroup(this.options.openGroup)
			if(!groupToOpen) return;
			groupToOpen.slide("in", oppositeDirection)
		})
	}

	set text(text: string) {
		this.element!.innerText = text;
	}

	get text(): string {
		return this.element!.innerText;
	}
}