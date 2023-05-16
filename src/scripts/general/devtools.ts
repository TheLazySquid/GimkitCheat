import { HudObject } from "../../interfaces";

const hudAddition: HudObject = {
    menus: [
        {
            name: "Devtools",
            elements: [
                {
                    type: "toggle",
                    options: {
                        textEnabled: "Stop logging incoming messages",
                        textDisabled: "Log incoming messages",
                        default: false,
                        runFunction: "logIncomingMessages"
                    }
                },
                {
                    type: "button",
                    options: {
                        text: "Log closest device",
                        runFunction: "logClosestDevice"
                    }
                }
            ]
        }
    ]
}

class DevtoolsClass {
    name: string = "Gimkit Cheat Devtools";
    hudAddition: HudObject = hudAddition;
    loggingIncomingMessages: boolean = false;
    funcs: Map<string, Function> = new Map([
        ["logIncomingMessages", (enabled: boolean) => {
            this.loggingIncomingMessages = enabled;
        }],
        ["logClosestDevice", () => {
            this.logClosestDevice();
        }]
    ]);

    init(cheat: any) {
        cheat.socketHandler.addEventListener("recieveMessage", (e: CustomEvent) => {
            if(!this.loggingIncomingMessages) return;
            cheat.log("Incoming message", e.detail)
        })
    }

    logClosestDevice() {
        let devices = (unsafeWindow as any)?.stores?.phaser?.scene?.worldManager?.devices?.devicesInView
		let body = (unsafeWindow as any)?.stores?.phaser?.mainCharacter?.body

        let closest = null
		let closestDistance = Infinity

		for(let device of devices) {
			if(device.interactiveZones.zones.length == 0) continue
			let distance = Math.sqrt(Math.pow(device.x - body.x, 2) + Math.pow(device.y - body.y, 2))
			
			if(distance < closestDistance) {
				closest = device
				closestDistance = distance
			}
		}

        console.log(closest)
    }
}

export function Devtools() {
    return new DevtoolsClass();
}