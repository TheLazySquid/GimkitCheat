import { Purchase, PurchaseMenu } from "../../interfaces";

import purchases from "./purchaseList";

class InstapurchasersClass {
    name = "Purchasers";

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
            this.createGamemodeButtons(gamemode, purchases[gamemode], cheat.hud.createMenu("Cheats for gamemodes"))
        }
    }

    createGamemodeButtons(gamemode: string, content: PurchaseMenu | Purchase[], rootGroup: any) {
        let devices = (unsafeWindow as any)?.stores?.phaser?.scene?.worldManager?.devices?.allDevices
        let group = rootGroup.createGroup(gamemode);

        if(!Array.isArray(content)) {
            for(let [name, menu] of Object.entries(content)) {
                this.createGamemodeButtons(name, menu, group)
            }
            return
        }
        
        for(let purchase of content) {
            let { selector, displayName, reusable } = purchase;

            // filter devices by selector
            let purchaseDevices = devices.filter((device: any) => {
                let matches = true;
                for(let [key, value] of Object.entries(selector)) {
                    if(device.options?.[key] != value) {
                        matches = false;
                        break
                    }
                }
                return matches
            })

            if(purchaseDevices.length == 0) continue

            // sort them by price
            purchaseDevices.sort((a: any, b: any) => a?.options?.amountOfRequiredItem - b?.options?.amountOfRequiredItem)

            let buttonText = `Purchase ${displayName} (${purchaseDevices[0]?.options?.amountOfRequiredItem})`;
            let button = group.addElement('button', {
                text: buttonText
            })

            button.addEventListener('click', async () => {
                if(!purchaseDevices[0]?.interactiveZones?.onInteraction) {
                    // this happened to me a few times and I don't know why, just re-get the devices
                    purchaseDevices = purchaseDevices.map((device: any) => {
                        return devices.find((d: any) => d.id == device.id)
                    })
                    return
                }

                purchaseDevices[0]?.interactiveZones?.onInteraction?.()

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

export function Instapurchasers() {
    return new InstapurchasersClass();
}