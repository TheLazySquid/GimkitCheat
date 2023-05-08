(function () {
	if(!window.gc) return alert(`You need to set up the override to use this script. Find instructions here:
	https://github.com/TheLazySquid/GimkitCheat#setting-up-the-overrides
	If you have it set up, try reloading this page with the console open.`)

	let keybinds = gc.hud.createGroup("Keybinds")
	let purchases = gc.hud.createGroup("Purchase")

	const purchasables = {
		"Shield Can": { grantedItemId: "shield-can" },
		"Medpack": { grantedItemId: "medpack" },
		"Stage 2 Checkpoint": { grantedItemName: "Stage 2 Checkpoint" },
		"Stage 3 Checkpoint": { grantedItemName: "Stage 3 Checkpoint" },
		"Stage 2 Bridge": { purchaseChannel: "stage 2 bridge" },
		"Stage 3 Bridge": { purchaseChannel: "stage 3 bridge" }
	}

	for(let purchasable in purchasables) {
		let selector = { mustHave: purchasables[purchasable] }
		let buyDevice = gc.getDevice(selector)
		let buyPacket = {
			key: "purchase",
			data: undefined,
			deviceId: buyDevice.id
		}

		purchases.addBtn(purchasable, () => {
			gc.socket.sendObj("MESSAGE_FOR_DEVICE", buyPacket)
		})
	}

	let lastPos = {
		x: null,
		y: null
	}

	gc.socket.onOutgoingMsg((type, msg) => {
		if(type != "MOVED") return
		lastPos = msg
	})

	let autoAttacking = false
	let attackBtn = gc.hud.addToggleBtn("Stop auto attacking", "Auto Attack", (state) => {
		autoAttacking = state
	}, false)

	keybinds.addKeybindSetter("Auto Attack", () => {
		attackBtn.trigger()
	})
	
	setInterval(() => {
		if(!autoAttacking) return
		let characters = JSON.parse(JSON.stringify(gc.data.serializer.getState().characters))

		// calculate the closest sentry to the last position we were at
		let target
		let shortedDistance = Infinity
		for(let id in characters) {
			let character = characters[id]
			if(character.type != "sentry" || character.isRespawning) continue
			let distance = Math.sqrt(Math.pow(character.x - lastPos.x, 2) + Math.pow(character.y - lastPos.y, 2))
			if(distance < shortedDistance) {
				target = character
				shortedDistance = distance
			}
		}

		if(!target) return
		gc.socket.sendObj("FIRE", {
			angle: 0,
			x: target.x,
			y: target.y
		})
	}, 100)
})()