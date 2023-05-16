import { HudObject, Purchase } from "../../interfaces";

const purchases: { [index: string]: Purchase[] } = {
    "Capture The Flag": [
        {
            displayName: "Speed Upgrade",
            id: "Speed Upgrade",
            reusable: false
        },
        {
            displayName: "Efficiency Upgrade",
            id: "Efficiency Upgrade",
            reusable: false
        },
        {
            displayName: "Energy Per Question Upgrade",
            id: "Energy Per Question Upgrade",
            reusable: false
        },
        {
            displayName: "InvisaBits",
            id: "silver-ore",
            reusable: true
        }
    ],
    "Tag": [
        {
            displayName: "Speed Upgrade",
            id: "Speed Upgrade",
            reusable: false
        },
        {
            displayName: "Efficiency Upgrade",
            id: "Efficiency Upgrade",
            reusable: false
        },
        {
            displayName: "Energy Per Question Upgrade",
            id: "Energy Per Question Upgrade",
            reusable: false
        },
        {
            displayName: "Endurance Upgrade",
            id: "Endurance Upgrade",
            reusable: false
        }
    ],
    "Snowbrawl": [
        {
            displayName: "Med Pack",
            id: "medpack",
            reusable: true
        },
        {
            displayName: "Shield Can",
            id: "shield-can",
            reusable: true
        }
    ]
};

class InstapurchasersClass {
    name = "Instapurchasers";

    init(cheat: any) {
        cheat.addEventListener("gameLoaded", () => {
            this.createButtons(cheat)
        })
    }

    createButtons(cheat: any) {
        let devices = (unsafeWindow as any)?.stores?.phaser?.scene?.worldManager?.devices?.allDevices
        if(!devices) {
            setTimeout(() => this.createButtons(cheat), 1000) // try again in case something went wrong
            return
        }

        for(let gamemode in purchases) {
            let group = cheat.hud.createMenu("Cheats for gamemodes").createGroup(gamemode);

            for(let purchase of purchases[gamemode]) {
                let { id, displayName, reusable } = purchase;
                let purchaseDevices = devices.filter((device: any) => {
                    return device?.options?.grantedItemName == id ||
                        device?.options?.grantedItemId == id
                })

                if(purchaseDevices.length == 0) continue

                // sort them by price
                purchaseDevices.sort((a: any, b: any) => a?.options?.amountOfRequiredItem - b?.options?.amountOfRequiredItem)
 
                let buttonText = `Purchase ${displayName} (${purchaseDevices[0]?.options?.amountOfRequiredItem})`;
                let button = group.addElement('button', {
                    text: buttonText
                })

                button.addEventListener('click', async () => {
                    purchaseDevices[0]?.interactiveZones?.onInteraction()

                    if(reusable) return

                    // check whether it was successfully purchased
                    // wait 500ms for the purchase to go through
                    await new Promise((resolve) => setTimeout(resolve, 500))

                    if(purchaseDevices[0].state.active) return // it wasn't purchased
                    purchaseDevices.shift()

                    if(purchaseDevices.length == 0) {
                        button.remove()
                        return
                    }

                    // update the button text
                    buttonText = `Purchase ${displayName} (${purchaseDevices[0]?.options?.amountOfRequiredItem})`;

                    button.text = buttonText
                })
            }
        }
    }
}

export function Instapurchasers() {
    return new InstapurchasersClass();
}