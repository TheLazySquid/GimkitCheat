import Dropdown from "../../hud/elements/dropdown";
import Toggle from "../../hud/elements/toggle";

class FreecamClass {
    name: string = "Freecam";
	freecamming: boolean = false;
	camHelper: any;
	freeCamPos = {x: 0, y: 0};
	toggleFreecam: Toggle | null = null;
	spectateMenu: Dropdown | null = null;
	keys: Set<string> = new Set();
	lastPlayers: string[] = [];

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

		cheat.addEventListener('gameLoaded', () => {
			this.camHelper = (unsafeWindow as any).stores.phaser.scene.cameraHelper

			// add in the update loop
			setInterval(() => {
				this.update()
			}, 1000 / 60)
		})

		window.addEventListener("keydown", (e) => {	
			if(!this.freecamming) return;
			if(!e.key.includes("Arrow")) return
			e.stopImmediatePropagation()

			this.keys.add(e.key)
		})

		window.addEventListener("keyup", (e) => {
			this.keys.delete(e.key)
		})
	}

	enableFreecam(value: boolean) {
		let phaser = (unsafeWindow as any).stores.phaser
		let camera = phaser.scene.cameras.cameras[0]

		if(value) {
			this.camHelper.stopFollow()
			this.freeCamPos.x = camera.midPoint.x
			this.freeCamPos.y = camera.midPoint.y
			camera.useBounds = false
		} else {
			let charObj = phaser.scene.characterManager.characters.get(phaser.mainCharacter.id).body
			this.camHelper.startFollowingObject({object: charObj})
			camera.useBounds = true
		}

		this.freecamming = value
	}

	spectatePlayer(name: string) {
		// prevent freecamming if we already are
		this.enableFreecam(false)
		
		if(name == "None") return

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
		if(this.keys.has("ArrowUp")) this.freeCamPos.y -= 20
		if(this.keys.has("ArrowDown")) this.freeCamPos.y += 20
		if(this.keys.has("ArrowLeft")) this.freeCamPos.x -= 20
		if(this.keys.has("ArrowRight")) this.freeCamPos.x += 20

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

		// make sure the list of players has changed
		let same = true
		if(this.lastPlayers.length != options.length) same = false;
		else {
			for(let i = 0; i < this.lastPlayers.length; i++) {
				if(this.lastPlayers[i] != options[i]) {
					same = false
					break
				}
			}
		}

		if(same) return

		this.lastPlayers = options

		this.spectateMenu?.setOptions(options)
	}
}

export function Freecam() {
    return new FreecamClass();
}