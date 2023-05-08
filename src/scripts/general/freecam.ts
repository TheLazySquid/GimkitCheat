import Dropdown from "../../hud/elements/dropdown";
import Toggle from "../../hud/elements/toggle";
import { HudObject } from "../../interfaces";

class FreecamClass {
    name: string = "Cosmetic Picker";
	freecamming: boolean = false;
	camHelper: any;
	freeCamPos = {x: 0, y: 0};
	toggleFreecam: Toggle | null = null;
	spectateMenu: Dropdown | null = null;

	init(cheat: any) {
		let camGroup = cheat.hud.createMenu("General Cheats").createGroup("Freecam")

		// initialize all the elements
		let toggleFreecam = camGroup.addElement("toggle", {
			textEnabled: "Stop Freecamming",
			textDisabled: "Unbind Camera",
			keybind: true,
			keybindId: "toggleFreecam"
		})

		toggleFreecam.addEventListener("change", (e: CustomEvent) => {
			if(!this.camHelper) {
				toggleFreecam.value = false
				return
			}
			this.enableFreecam(e.detail);
		})

		let dropdown = camGroup.addElement("dropdown", {
			text: "Spectate Player",
			options: ["None"]
		})

		dropdown.addEventListener("change", (e: CustomEvent) => {
			this.spectatePlayer(e.detail)
		})

		this.toggleFreecam = toggleFreecam
		this.spectateMenu = dropdown

		let loadCheck = setInterval(() => {
			// wait until the camera has loaded
			if(!(unsafeWindow as any)?.stores?.phaser?.scene?.cameraHelper) return

			this.camHelper = (unsafeWindow as any).stores.phaser.scene.cameraHelper

			// add in the update loop
			setInterval(() => {
				this.update()
			}, 1000 / 60)
			clearInterval(loadCheck)
		}, 100)
	}

	enableFreecam(value: boolean) {
		let phaser = (unsafeWindow as any).stores.phaser
		let camera = phaser.scene.cameras.cameras[0]

		if(value) {
			this.camHelper.stopFollow()
			this.freeCamPos.x = camera.midPoint.x
			this.freeCamPos.y = camera.midPoint.y
		} else {
			let charObj = phaser.scene.characterManager.characters.get(phaser.mainCharacter.id).body
			this.camHelper.startFollowingObject({object: charObj})
		}

		this.freecamming = value
	}

	spectatePlayer(name: string) {
		if(name == "None") {
			this.enableFreecam(false)
			return
		}

		this.toggleFreecam!.value = true

		let phaser = (unsafeWindow as any).stores.phaser
		let players = phaser.scene.characterManager.characters

		for(let [id, player] of players) {
			if(player.nametag.name == name) {
				this.camHelper.startFollowingObject({object: player.body})
				break
			}
		}
	}

	update() {
		this.updateSpectatablePlayers()

		if(!this.freecamming) return;
		// move the camera
		let keys = (window as any).cheat.keybindManager.keys
		if(keys.has("u")) this.freeCamPos.y -= 20
		if(keys.has("h")) this.freeCamPos.x -= 20
		if(keys.has("j")) this.freeCamPos.y += 20
		if(keys.has("k")) this.freeCamPos.x += 20

		this.camHelper.goTo(this.freeCamPos)
	}

	updateSpectatablePlayers() {
		let phaser = (unsafeWindow as any).stores.phaser
		let players = phaser.scene.characterManager.characters
		let options = ["None"]

		for(let [id, player] of players) {
			if(id == phaser.mainCharacter.id) continue

			options.push(player.nametag.name)
		}

		this.spectateMenu?.setOptions(options)
	}
}

export function Freecam() {
    return new FreecamClass();
}