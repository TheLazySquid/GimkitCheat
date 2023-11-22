import { HudObject } from "../../interfaces";

const hudAddition: HudObject = {
    menus: [
        {
            name: "General Cheats",
            elements: [
                {
                    type: "toggle",
                    options: {
                        textEnabled: "Show Energy Popup",
                        textDisabled: "Hide Energy Popup",
                        runFunction: "toggleEnergyPopup"
                    }
                }
            ]
        }
    ]
}

class HideEnergyClass {
    name: string = "Hide Energy";
    hudAddition: HudObject = hudAddition;
    enabled: boolean = false;
    popupElement?: HTMLElement;

    funcs: Map<string, Function> = new Map([
        ["toggleEnergyPopup", (event: any) => {
            this.enabled = event;
            console.log(this.popupElement, this.enabled);
            if(!this.popupElement) return;
            if(this.enabled) {
                this.popupElement.style.display = "none";
            } else {
                this.popupElement.style.display = "";
            }
        }]
    ]);

    init() {
        let observer = new MutationObserver((mutations) => {
            for(let mutation of mutations) {
                for(let node of mutation.addedNodes) {
                    if(node.nodeType != Node.ELEMENT_NODE) continue;

                    // check that the element is the energy popup
                    if(
                        (node as HTMLElement).matches(".maxAll.flex.hc") &&
                        (node as HTMLElement).querySelector("img[src='/assets/map/inventory/resources/energy.png']")
                    ) {
                        this.popupElement = node as HTMLElement;
                        if(!this.enabled) return;
                        // hide the popup
                        this.popupElement.style.display = "none";
                    }
                }
            }
        })

        window.addEventListener("load", () => {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            })
        })
    }
}

export function HideEnergy() {
    return new HideEnergyClass();
}