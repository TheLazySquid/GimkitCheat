// @ts-ignore
import keyboard from '../../assets/keyboard.svg'
import { Keybind, KeybindEditorOptions } from '../../interfaces';

export default class KeybindEditor {
	keybindOpener: SVGElement;
	keybindEditor: HTMLDialogElement;
	capturing: boolean = false;
	keys: Set<string> = new Set();
	actionState: string = "start";
	bind: Keybind;
	options: KeybindEditorOptions;

	constructor(options: KeybindEditorOptions) {
		this.options = options;

		this.keybindOpener = keyboard();
		this.keybindOpener.classList.add("keybind_opener");

		this.keybindEditor = document.createElement("dialog");
		this.keybindEditor.classList.add("keybind_editor_wrapper");

		this.keybindEditor.innerHTML = `
			<div class="keybind_editor">
				<div class="close">x</div>
				<h1 class="keybind_title">${options.title}</h1>
				<div class="keybind_controls">
					<div class="keybind_display"></div>
					<div class="keybind_exclusive">
						<div class="text">Exclusive?</div>
						<input type="checkbox" class="exclusive" />
					</div>
					<div class="action">Start Capture</div>
				</div>
			</div>
		`

		let bindExclusive = options.exclusive ?? false;

		let existingKeybind = (window as any).cheat.hud.syncedVars.get("keybinds").get(options.id);
		if (existingKeybind) {
			this.keys = new Set(existingKeybind.keys);
			bindExclusive = existingKeybind.exclusive;
		}
		else if(options.keys) this.keys = options.keys;

		if(bindExclusive) this.keybindEditor.querySelector(".exclusive")!.setAttribute("checked", "true");

		this.bind = {
			keys: this.keys,
			exclusive: bindExclusive,
			callback: options.callback
		};
		
		(window as any).cheat.keybindManager.registerBind(this.bind)

		this.updateAction();
		this.updateDisplay()
		this.addEventListeners();
	}

	addEventListeners() {
		let action = this.keybindEditor.querySelector(".action")!;
		let close = this.keybindEditor.querySelector(".close")!;
		let display = this.keybindEditor.querySelector(".keybind_display")!;
		let exclusive = this.keybindEditor.querySelector(".exclusive")! as HTMLInputElement;

		this.keybindOpener.addEventListener("click", () => {
			this.keybindEditor.showModal();
		})

		// prevent the menu from being dragged by the dialog
		this.keybindEditor.addEventListener("mousedown", (e) => {
			e.stopPropagation()
			if(!this.capturing) return
			if(e.target == action) return
			this.endCapture()
		})
		
		display.addEventListener("mousedown", (e) => {
			e.stopPropagation()
			this.beginCapture()
		})

		close.addEventListener("click", () => {
			this.keybindEditor.close();
		})

		action.addEventListener("click", () => {
			if(this.actionState == "Start Capture") this.beginCapture();
			else if(this.actionState == "End Capture") this.endCapture();
			else if(this.actionState == "Reset") {
				this.keys.clear()
				this.updateDisplay();
				this.updateAction();
			}
		})

		exclusive.addEventListener("change", () => {
			this.bind.exclusive = exclusive.checked;
			this.syncBind();
		})
	}

	beginCapture() {
		this.capturing = true;
		this.keys.clear()
		
		this.keybindEditor.querySelector(".keybind_display")!.innerHTML = "Press any key...";

		document.addEventListener("keydown", this.keybindCapture.bind(this));

		this.updateAction();
	}

	keybindCapture(e: KeyboardEvent) {
		if (!this.capturing) return;
		e.preventDefault();

		if (e.key === "Escape" || e.key === "Enter") {
			this.endCapture();
			return;
		}

		this.keys.add(e.key.toLowerCase());
		this.updateDisplay();
	}

	endCapture() {
		this.capturing = false;
		document.removeEventListener("keydown", this.keybindCapture.bind(this));

		this.updateAction();
		this.syncBind();
	}

	updateDisplay() {
		let keybindDisplay = this.keybindEditor.querySelector(".keybind_display")!;

		let keys = Array.from(this.keys);
		// replace space with "space"
		keys = keys.map((key) => key === " " ? "space" : key);

		keybindDisplay.innerHTML = keys.join(" + ");
	}

	updateAction() {
		let action = this.keybindEditor.querySelector(".action")!;
		
		if(this.capturing) this.actionState = "End Capture";
		else if(this.keys.size == 0) this.actionState = "Start Capture"
		else this.actionState = "Reset";

		action.innerHTML = this.actionState;
	}

	attachTo(element: HTMLElement) {
		element.appendChild(this.keybindOpener);
		element.appendChild(this.keybindEditor);
	}

	syncBind() {
		if(!this.options.id) return
		(window as any).cheat.hud.updateKeybind(this.options.id, {
			keys: Array.from(this.keys),
			exclusive: this.bind.exclusive
		})
	}
}