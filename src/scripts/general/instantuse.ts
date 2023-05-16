import { HudObject } from "../../interfaces";

const hudAddition: HudObject = {
    menus: [
        {
            name: "General Cheats",
            elements: [
                {
                    type: "toggle",
                    options: {
                        textEnabled: "Stop instant use",
                        textDisabled: "Instant use",
                        default: true,
                        runFunction: "setInstantUse",
                        keybind: true,
                        keybindId: "instantUse"
                    }
                }
            ]
        }
    ]
}

class InstantuseClass {
	name: string = "Instantuse";
	hudAddition: HudObject = hudAddition;
	instantUseEnabled: boolean = true;
	funcs: Map<string, Function> = new Map([
		["setInstantUse", (enabled: boolean) => {
			this.instantUseEnabled = enabled;
		}]
	]);

	init(cheat: any) {
		let self = this

		cheat.keybindManager.registerBind({
			keys: new Set(["enter"]),
			exclusive: false,
			callback() {
				self.useNearest()
			}
		})
	}

	useNearest() {
		let devices = (unsafeWindow as any)?.stores?.phaser?.scene?.worldManager?.devices?.devicesInView
		let body = (unsafeWindow as any)?.stores?.phaser?.mainCharacter?.body

		if(!devices || !body) return

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

		if(!closest) return

		closest?.interactiveZones?.onInteraction?.()
	}
}

export function Instantuse() {
	return new InstantuseClass();
}