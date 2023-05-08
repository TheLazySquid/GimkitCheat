import HudElement from "./element";
import { TextInputOptions } from "../../interfaces";

export default class TextInput extends HudElement {
    input: HTMLInputElement | null = null;

    constructor(group: any, options: TextInputOptions) {
        super(group, options);

        let element = document.createElement("div");

        element.innerHTML = `
            <div class="text">${this.options.text}</div>
            <input type="text" class="textinput" placeholder="${this.options.placeholder ?? ""}">
        `

        element.classList.add("textinput_wrapper");

        this.element = element;
        this.input = element.querySelector("input");

        this.input!.addEventListener("input", () => {
            this.dispatchEvent(new CustomEvent("input", {
                detail: this.text
            }))
        })
    }

    set text(text: string) {
        this.input!.value = text;
    }

    get text() {
        return this.input!.value;
    }
}