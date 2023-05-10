import { HudObject } from "../../interfaces";
import { ClassicClass } from "./classic";

const hudAddition: HudObject = {
    menus: [
        {
            name: "Cheats for gamemodes",
            groups: [
                {
                    name: "Super Rich Mode",
                    elements: [
                        {
                            type: "toggle",
                            options: {
                                textEnabled: "Stop Auto Purchasing",
                                textDisabled: "Start Auto Purchasing",
                                default: false,
                                runFunction: "setAutoPurchasingRichMode",
                                keybind: true,
                                keybindId: "autoPurchasingRichMode"
                            }
                        }
                    ]
                }
            ]   
        }
    ]
}

class RichModeClass extends ClassicClass {
    name: string = "Rich Mode Script";
    hudAddition: HudObject = hudAddition;
    funcs: Map<string, Function> = new Map([
        ["setAutoPurchasingRichMode", (enabled: boolean) => {
            this.autoPurchasing = enabled;
            if(this.autoPurchasing) this.checkAutoBuy();
        }]
    ]);
    upgradesToGet = [ // taken from https://github.com/Noble-Mushtak/Gimkit-Strategy/
        ["Streak Bonus", 2, 10000],
        ["Money Per Question", 3, 5000],
        ["Streak Bonus", 3, 100000],
        ["Multiplier", 3, 150000],
        ["Streak Bonus", 4, 1000000],
        ["Multiplier", 4, 1000000],
        ["Money Per Question", 5, 5000000],
        ["Streak Bonus", 5, 10000000],
        ["Multiplier", 5, 6000000],
        ["Money Per Question", 6, 37500000],
        ["Multiplier", 6, 42500000],
        ["Streak Bonus", 6, 100000000],
        ["Streak Bonus", 7, 1000000000],
        ["Streak Bonus", 8, 10000000000],
        ["Multiplier", 7, 350000000],
        ["Money Per Question", 9, 5000000000],
        ["Multiplier", 8, 3250000000],
        ["Streak Bonus", 9, 100000000000],
        ["Multiplier", 9, 32500000000],
        ["Streak Bonus", 10, 1000000000000],
        ["Money Per Question", 10, 50000000000],
        ["Multiplier", 10, 500000000000]
    ]
}

export function RichMode() {
    return new RichModeClass();
}