import HudElement from "./element";
import { ButtonOptions } from "../../interfaces";
import KeybindEditor from "./keybindEditor";

export default class Button extends HudElement {
    button: HTMLButtonElement;

    constructor(group: any, options: ButtonOptions) {
        super(group, options);

        let element = document.createElement("div");
        element.classList.add("button_wrapper");
        element.innerHTML = `
            <button class="button">${this.options.text}</button>
        `

        this.element = element;
        this.button = element.querySelector("button")!;

        this.button.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("click"))
            if(this.options.runFunction) (window as any).cheat.funcs.get(this.options.runFunction)?.call(this)
        })

        if (this.options.keybind) {
            let keybindEditor = new KeybindEditor({
				title: options.title ?? `Set keybind for ${this.button.innerText}`,
				keys: options.defaultKeybind ?? new Set(),
				exclusive: false,
				callback: () => {
                    this.dispatchEvent(new CustomEvent("click"))
				}
			});
			keybindEditor.attachTo(element)
        }
    }

    set text(text: string) {
        this.button!.innerText = text;
    }

    get text() {
        return this.button!.innerText;
    }
}