import { HudObject } from "../../interfaces";

const hudAddition: HudObject = {
    menus: [
        {
            name: "Cheats for gamemodes",
            groups: [
                {
                    name: "Farmchain",
                    elements: [
                        {
                            type: "toggle",
                            options: {
                                textEnabled: "Stop auto harvesting",
                                textDisabled: "Start auto harvesting",
                                keybind: true,
                                keybindId: "autoHarvesting",
                                default: true,
                                runFunction: "setAutoHarvest"
                            }
                        },
                        {
                            type: "toggle",
                            options: {
                                textEnabled: "Stop auto planting",
                                textDisabled: "Start auto planting",
                                keybind: true,
                                keybindId: "autoPlanting",
                                default: false,
                                runFunction: "setAutoPlant"
                            }
                        }
                    ]
                }
            ]
        }
    ]
}

const seedRanking = [
    'yellow-seed',
    'tan-seed',
    'brown-seed',
    'purple-seed',
    'magenta-seed',
    'green-seed',
    'bronze-seed',
    'orange-seed',
    'gold-seed',
    'dark-green-seed',
    'red-seed',
    'blue-seed',
    'teal-seed'
]

class FarmchainClass {
    name = "Farmchain";
    hudAddition = hudAddition;
    autoHarvesting = true;
    autoPlanting = false;

    funcs: Map<string, Function> = new Map([
        ["setAutoHarvest", (enabled: boolean) => {
            this.autoHarvesting = enabled;
        }],
        ["setAutoPlant", (enabled: boolean) => {
            this.autoPlanting = enabled;
        }]
    ]);

    init(cheat: any) {
        // set up auto harvest
        cheat.socketHandler.addEventListener("recieveChanges", (e: CustomEvent) => {
            let changes: any[] = e.detail;

            for(let change of changes) {
                for(let key in change.data) {
                    if(!key.endsWith("status") || change.data[key] != "availableForCollection") continue
    
                    // harvest it
                    let packet = {
                        key: "collect",
                        deviceId: change.id,
                        data: undefined
                    }
    
                    cheat.socketHandler.sendData("MESSAGE_FOR_DEVICE", packet)
                }
            }
        })

        cheat.addEventListener("gameLoaded", () => {
            let devices = (unsafeWindow as any)?.stores?.phaser?.scene?.worldManager?.devices?.allDevices
            let plots = devices.filter((device: any) => device.options.style == "plant")

            let recipieDevices: { [index: string]: any } = {}
            for(let device of devices) {
                if(!seedRanking.includes(device.options?.ingredient1Item)) continue
                recipieDevices[device.options?.ingredient1Item] = device
            }

            // set up auto plant
            setInterval(() => {
                if(!this.autoPlanting) return

                let inventory = (unsafeWindow as any)?.stores?.me?.inventory?.slots as Map<string, any>
                if(!inventory) return
    
                // find the most valuable seed in the inventory
                let mostValuableSeed = undefined
                for(let seed of seedRanking) {
                    if(inventory.has(seed)) {
                        mostValuableSeed = seed
                        break
                    }
                }
    
                if(!mostValuableSeed) return
    
                // plant the seed in the last idle plot
                let plantPlot = plots.findLast((plot: any) => plot.state.status == "idle")

                cheat.socketHandler.sendData("MESSAGE_FOR_DEVICE", {
                    key: "craft",
                    deviceId: plantPlot.id,
                    data: {
                        recipe: recipieDevices[mostValuableSeed].id
                    }
                })
            }, 50)
        })
    }
}

export function Farmchain() {
    return new FarmchainClass();
}