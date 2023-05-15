import Text from "./elements/text";
import GroupOpener from "./elements/groupOpener";
import ColorPicker from "./elements/colorPicker";
import Button from "./elements/button";
import TextInput from "./elements/textInput";
import Toggle from "./elements/toggle";
import Dropdown from "./elements/dropdown";
import Slider from "./elements/slider";
import { GroupObject } from "../interfaces";

export default class Group {
	name: string = "";
	hideTimeout: any = null;
	element: HTMLElement | null = null;
	isRoot: boolean = false;
	groups: Group[] = [];
	parentGroup: Group | null = null;
	elements: Element[] = [];
	menu: any = null;

	constructor(menu: any, parentGroup: Group | null, name: string, isRoot: boolean = false) {
		this.menu = menu;
		this.parentGroup = parentGroup;
		this.name = name;
		this.isRoot = isRoot;
		this.init()
	}

	init() {
		let element = document.createElement("div");
		element.classList.add("group");

		if(!this.isRoot) element.style.display = "none"

		this.element = element;
		this.menu?.element?.appendChild(element);

		// add a back button if this isn't the root group
		if(!this.isRoot) {
			this.addElement("groupopener", {
				text: "Back",
				openGroup: this.parentGroup!.name,
				direction: "right"
			})
		}
	}

	addElement(type: string, options: any) {
		let element
		switch(type.toLowerCase()) {
			case "text":
				element = new Text(this, options);
				break;
			case "groupopener":
				element = new GroupOpener(this, options);
				break;
			case "colorpicker":
				element = new ColorPicker(this, options);
				break;
			case "button":
				element = new Button(this, options);
				break;
			case "textinput":
				element = new TextInput(this, options);
				break;
			case "toggle":
				element = new Toggle(this, options);
				break;
			case "dropdown":
				element = new Dropdown(this, options);
				break;
			case "slider":
				element = new Slider(this, options);
				break;
			default:
				console.error(`Unknown element type: ${type}`)
		}

		if(!element) return null;
		this.element?.appendChild(element.element!)


		return element;
	}

	slide(mode: string, direction: string) {
		if(this.hideTimeout) clearTimeout(this.hideTimeout)

		this.element!.style.animation = `slide_${mode}_${direction} both 0.5s`
		if(mode == "in") this.element!.style.display = "flex"
		else if(mode == "out") {
			this.hideTimeout = setTimeout(() => this.element!.style.display = "none", 500)
		}
	}

	createGroup(name: string): Group {
		let existingGroup = this.menu.getAnyGroup(name)
		if(existingGroup) return existingGroup;

		let group = new Group(this.menu, this, name);
        this.groups.push(group);
		this.menu.groups.push(group);

		// add a button to open the group
		this.addElement("groupopener", {
			text: name,
			openGroup: name,
			direction: "left"
		})

        return group;
    }

    group(name: string): Group | null {
        for (let i = 0; i < this.groups.length; i++) {
            if (this.groups[i].name == name) {
                return this.groups[i];
            }
        }
        return null;
    }

	remove() {
		this.element?.remove();
		this.parentGroup?.groups.splice(this.parentGroup.groups.indexOf(this), 1);
		this.menu.groups.splice(this.menu.groups.indexOf(this), 1);
	}

	clearElements() {
		this.elements = [];
		if(!this.element) return;
		this.element.innerHTML = "";
	}

	loadFromObject(object: GroupObject) {
		const loadGroups = () => {
			if(object.groups) {
				for(let group of object.groups) {
					let newGroup = this.createGroup(group.name);
					newGroup.loadFromObject(group);
				}
			}
		}

		const loadElements = () => {
			if(object.elements) {
				for(let element of object.elements) {
					this.addElement(element.type, element.options);
				}
			}
		}

		if(object.order == "elementsFirst") {
			loadElements();
			loadGroups();
		} else {
			loadGroups();
			loadElements();
		}
	}
}