(function() {
	if(!window.gc) return alert(`You need to set up the override to use this script. Find instructions here:
	https://github.com/TheLazySquid/GimkitCheat#setting-up-the-overrides
	If you have it set up, try reloading this page with the console open.`)

	let binds = gc.hud.createGroup("Keybinds")

	let autoSelling = true
	let autoFishing = false
	let autoSellBtn = gc.hud.addToggleBtn("Stop auto selling", "Auto Sell", (state) => {
		autoSelling = state
	}, true)
	let autoFishBtn = gc.hud.addToggleBtn("Stop fishing", "Start fishing", (state) => {
		autoFishing = state
	}, false)
	let purchases = gc.hud.createGroup("Purchase")
	let travels = gc.hud.createGroup("Travel")

	// initialize keybinds
	binds.addKeybindSetter("Auto Sell", () => {
		autoSellBtn.trigger()
	})

	binds.addKeybindSetter("Auto Fish", () => {
		autoFishBtn.trigger()
	})

	// create the neccesary packets
	let sellDevice = gc.getDevices({ mustHave: { activateChannel: "sell fish" }})[0]
	let fishDevice = gc.getDevices({ mustHave: { channel: "attempt to fish" }})[0]

	let sellPacket = {
		key: "interacted",
		data: undefined,
		deviceId: sellDevice.id
	}

	let fishPacket = {
		key: "interacted",
		data: undefined,
		deviceId: fishDevice.id
	}

	setInterval(() => {
		if(autoSelling) {
			gc.socket.sendObj("MESSAGE_FOR_DEVICE", sellPacket)
		}
		if(autoFishing) {
			gc.socket.sendObj("MESSAGE_FOR_DEVICE", fishPacket)
		}
	}, 1000)

	const tryRefish = () => {
		window.requestAnimationFrame(tryRefish)
		if(!autoFishing) return
		// hit the fish again button if it exists
		let buttons = document.querySelectorAll("button.ant-btn")
		for(let button of buttons) {
			if(button.innerText == "Close") {
				button.click()
				break
			}
		}
	}
	tryRefish()

	// create the purchase menu
	const purchasables = {
		"Purple Pond Ticket - $10": "purple pond boat ticket",
		"Sandy Shores Ticket - $85": "sandy shores boat ticket",
		"Cosmic Cove Ticket - $250": "cosmic cove boat ticket",
		"Lucky Lake Ticket - $1000": "lucky lake ticket",
		"Expert Rod - $75": "upgraded fishing rod",
		"Medium Backpack - $20": "medium backpack",
		"Large Backpack - $60": "large backpack",
		"Bolt - $30": "bolt",
		"No Wait - $40": "no wait",
		"Cash in - $70": "cash in"
	}
	let purchaseBtns = {}

	const travelLocations = {
		"Fishtopia": "fishtopia",
		"Purple Pond": "purple pond",
		"Sandy Shores": "sandy shores",
		"Cosmic Cove": "cosmic cove",
		"Lucky Lake": "lucky lake"
	}

	for(let name in purchasables) {
		let item = purchasables[name]
		let btn = purchases.addBtn(name, () => {
			let purchaseDevice = gc.getDevices({ mustHave: { channel: `attempt purchase ${item}` }})[0]

			let purchasePacket = {
				key: "interacted",
				data: undefined,
				deviceId: purchaseDevice.id
			}

			gc.socket.sendObj("MESSAGE_FOR_DEVICE", purchasePacket)
		})
		purchaseBtns[item] = btn
	}

	for(let name in travelLocations) {
		let item = travelLocations[name]
		let btn = travels.addBtn(name, () => {
			let travelDevice = gc.getDevices({ mustHave: { channel: `attempt travel ${item}` }})[0]

			let travelPacket = {
				key: "interacted",
				data: undefined,
				deviceId: travelDevice.id
			}

			gc.socket.sendObj("MESSAGE_FOR_DEVICE", travelPacket)
		})
		binds.addKeybindSetter(`Travel to ${name}`, () => {
			btn.trigger()
		})
	}

	gc.socket.onOutgoingMsg((msgType, msg) => {
		if(msgType != "UPDATE_DEVICE_UI_PRESENCE") return
		if(!msg.deviceId) return
		let device = gc.getDevice({ id: msg.deviceId })
		if(!device?.data?.openWhenReceivingFrom?.includes?.("purchase")) return
		let purchasedItem = device.data.openWhenReceivingFrom.replace("purchase ", "").trim()
		if(purchasedItem == "lucky lake ticket") return // this is purchaseable multiple times
		if(purchaseBtns[purchasedItem]) {
			purchaseBtns[purchasedItem].remove()
		}
	})

	console.log("Gimkit Cheat Loaded")
})();