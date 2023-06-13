import HudElement from "./element";
import { KeybindEditorOptions, ToggleOptions } from "../../interfaces";
import KeybindEditor from "./keybindEditor";

export default class Toggle extends HudElement {
	enabled?: boolean;
	button: HTMLButtonElement;
	_textEnabled: string;
	_textDisabled: string;
	type: string = "toggle";

	constructor(group: any, options: ToggleOptions) {
		super(group, options);

		// create the element
		let element = document.createElement("div");

		element.innerHTML = `
			<button class="toggle"></button>
		`
		element.classList.add("toggle_wrapper");

		// add a keybind if needed
		if(options.keybind) {
			let editorOptions: KeybindEditorOptions = {
				title: options.title ?? "Set keybind for toggle",
				keys: options.defaultKeybind ?? new Set(),
				exclusive: false,
				callback: () => {
					this.toggle()
				}
			}

			if(options.keybindId) editorOptions.id = options.keybindId;

			let keybindEditor = new KeybindEditor(editorOptions);
			keybindEditor.attachTo(element)
		}

		this.enabled = this.options.default ?? false;
		this.element = element;
		this.button = element.querySelector("button")!;

		this._textEnabled = this.options.textEnabled;
		this._textDisabled = this.options.textDisabled;

		this.updateButton();

		// prevent the menu from being activated with enter
		this.button.addEventListener("keydown", (e) => e.preventDefault())
		this.button.addEventListener("click", () => {
			this.toggle();
		})
	}

	updateButton() {
		this.button!.innerHTML = this.enabled ? this._textEnabled : this._textDisabled;

		this.button!.classList.toggle("enabled", this.enabled);
	}

	toggle() {
		this.enabled = !this.enabled;
		this.updateButton();

		if(this.options.runFunction) (window as any).cheat.funcs.get(this.options.runFunction)(this.enabled);
		this.dispatchEvent(new CustomEvent("change", {
			detail: this.enabled
		}))
	}

	get value() {
		return this.enabled ?? false;
	}

	set value(value: boolean) {
		this.enabled = value;
		this.updateButton();
	}

	get textEnabled() {
		return this._textEnabled;
	}

	set textEnabled(text: string) {
		this._textEnabled = text;
		this.updateButton();
	}

	get textDisabled() {
		return this._textDisabled;
	}

	set textDisabled(text: string) {
		this._textDisabled = text;
		this.updateButton();
	}
}