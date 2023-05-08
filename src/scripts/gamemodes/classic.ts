import { HudObject } from "../../interfaces";

enum UpgradeType {
    "Insurance" = "insurance",
    "Money Per Question" = "moneyPerQuestion",
    "Multiplier" = "multiplier",
    "Streak Bonus" = "streakBonus"
}

const hudAddition: HudObject = {
    menus: [
        {
            name: "Cheats for gamemodes",
            groups: [
                {
                    name: "Classic",
                    elements: [
                        {
                            type: "toggle",
                            options: {
                                textEnabled: "Stop Auto Purchasing",
                                textDisabled: "Start Auto Purchasing",
                                default: false,
                                runFunction: "setAutoPurchasing",
                                keybind: true,
                                keybindId: "autoPurchasing"
                            }
                        }
                    ]
                }
            ]   
        }
    ]
}

class ClassicClass {
    name: string = "Classic Script";
    cheat: any;
    money: number = 0;
    upgradeLevels: { [key: string]: number } = {
        insurance: 1,
        moneyPerQuestion: 1,
        multiplier: 1,
        streakBonus: 1
    };
    hudAddition: HudObject = hudAddition;
    autoPurchasing: boolean = false;
    funcs: Map<string, Function> = new Map([
        ["setAutoPurchasing", (enabled: boolean) => {
            this.autoPurchasing = enabled;
            if(this.autoPurchasing) this.checkAutoBuy();
        }]
    ]);
    upgradesToGet = [ // taken from https://github.com/Noble-Mushtak/Gimkit-Strategy/
        ["Streak Bonus", 2, 20],
        ["Money Per Question", 3, 100],
        ["Streak Bonus", 3, 200],
        ["Multiplier", 3, 300],
        ["Streak Bonus", 4, 2000],
        ["Multiplier", 4, 2000],
        ["Money Per Question", 5, 10000],
        ["Streak Bonus", 5, 20000],
        ["Multiplier", 5, 12000],
        ["Money Per Question", 6, 75000],
        ["Multiplier", 6, 85000],
        ["Streak Bonus", 6, 200000],
        ["Streak Bonus", 7, 2000000],
        ["Streak Bonus", 8, 20000000],
        ["Multiplier", 7, 700000],
        ["Money Per Question", 9, 10000000],
        ["Multiplier", 8, 6500000],
        ["Streak Bonus", 9, 200000000],
        ["Multiplier", 9, 65000000],
        ["Streak Bonus", 10, 2000000000],
        ["Money Per Question", 10, 100000000],
        ["Multiplier", 10, 1000000000]
    ]

    init(cheat: any) {
        this.cheat = cheat;

        // get the amount of money
        this.cheat.socketHandler.addEventListener("recieveMessage", (e: any) => {
            if(this.cheat.socketHandler.transportType != "blueboat") return;

            
            if(e.detail.data?.type == "UPGRADE_LEVELS") {
                this.upgradeLevels = e.detail.data.value;
                // delete any upgrades that we already have
                for(let i = 0; i < this.upgradesToGet.length; i++) {
                    let upgrade = this.upgradesToGet[i];
                    // check if we have the upgrade
                    let upgradeAmount = this.upgradeLevels[UpgradeType[upgrade[0] as keyof typeof UpgradeType]];
                    if(upgradeAmount >= (upgrade[1] as number)) {
                        this.upgradesToGet.splice(i, 1);
                        i--;
                    }
                }
            }

            if(e.detail.data?.type == "BALANCE") {
                this.money = e.detail.data.value;
                this.checkAutoBuy();
            }
        })
    }

    checkAutoBuy() {
        if(!this.autoPurchasing) return;
        
        let upgrade = this.upgradesToGet[0];
        if(!upgrade) return;
        if(this.money >= (upgrade[2] as number)) {
            this.purchaseUpgrade(upgrade[0] as string, upgrade[1] as number);
        }
    }

	purchaseUpgrade(name: string, level: number) {
        this.cheat.log("Purchasing upgrade", name, level);

        this.cheat.socketHandler.sendData("UPGRADE_PURCHASED", {
            upgradeName: name,
            level
        });
    }
}

export function Classic() {
    return new ClassicClass();
}