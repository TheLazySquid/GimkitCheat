import { HudObject } from "../../interfaces";

const hudAddition: HudObject = {
    menus: [
        {
            name: "Cheats for gamemodes",
            groups: [
                {
                    name: "The Floor is Lava",
                    elements: [
                        {
                            type: "toggle",
                            options: {
                                textEnabled: "Stop Auto Building",
                                textDisabled: "Start Auto Building",
                                default: false,
                                runFunction: "setAutoBuilding",
                                keybind: true,
                                keybindId: "autoBuilding"
                            }
                        },
                        {
                            type: "toggle",
                            options: {
                                textEnabled: "Stop Hiding Popups",
                                textDisabled: "Start Hiding Popups",
                                default: false,
                                runFunction: "setHidingPopups",
                                keybind: true,
                                keybindId: "hidingPopups"
                            }
                        }
                    ]
                }
            ]   
        }
    ]
}

class LavaClass {
    name: string = "Floor is Lava";
    cheat: any;
    hudAddition: HudObject = hudAddition;
    money: number = 0;

    autoPurchasing: boolean = false;
    hidingPopups: boolean = false;

    funcs: Map<string, Function> = new Map([
        ["setAutoBuilding", (enabled: boolean) => {
            this.autoPurchasing = enabled;
            if(this.autoPurchasing) this.checkAutoBuy();
        }], ["setHidingPopups", (enabled: boolean) => {
            this.hidingPopups = enabled;
            if(enabled) document.querySelectorAll(".Toastify__toast").forEach((e: any) => e.remove());
        }]
    ]);

    structures: [string, number][] = [
        ["spaceElevator", 5e7],
        ["mountain", 5e6],
        ["skyscaper", 5e5], // not a typo, it's actually called "skyscaper"
        ["shoppingMall", 5e4],
        ["house", 5e3],
        ["wall", 5e2], // called "staircase" ingame
        ["brick", 50],
        ["plank", 5]
    ]

    init(cheat: any) {
        this.cheat = cheat;

        // get the amount of money
        this.cheat.socketHandler.addEventListener("recieveMessage", (e: any) => {
            if(this.cheat.socketHandler.transportType != "blueboat") return;
            
            if(e.detail.data?.type == "BALANCE") {
                this.money = e.detail.data.value;
                this.checkAutoBuy();
            }
        })

        let observer = new MutationObserver((mutations) => {
            if(!this.hidingPopups) return;
            for(let mutation of mutations) {
                for(let node of mutation.addedNodes) {
                    if(!(node instanceof HTMLElement)) continue;
                    if(node.matches(".Toastify__toast")) node.remove();
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

    checkAutoBuy() {
        if(!this.autoPurchasing) return;
        
        for(let structure of this.structures) {
            if(this.money >= structure[1]) {
                this.buyStructure(structure[0]);
                break;
            }
        }
    }

    buyStructure(type: string) {
        this.cheat.socketHandler.sendData("LAVA_PURCHASE_PIECE", {
            type
        })
    }
}

export function Lava() {
    return new LavaClass();
}