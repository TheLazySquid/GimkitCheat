(function() {
	if(!window.gc) return alert(`You need to set up the override to use this script. Find instructions here:
	https://github.com/TheLazySquid/GimkitCheat#setting-up-the-overrides
	If you have it set up, try reloading this page with the console open.`)

	const upgradeOrder = [ // taken from https://github.com/Noble-Mushtak/Gimkit-Strategy/
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

	const prefixes = { // the upgrades are always prefixed by this byte, don't ask me why
		"Money Per Question": 178,
		"Streak Bonus": 172,
		"Multiplier": 170,
		"Insurance": 169
	}

	function u8tobuff(array) {
	    return array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset)
	}

	gc.hud.addTodo("Answer a question")
	gc.hud.addTodo("Purchase an upgrade")	
	
	let lastMessage = null;
	let purchaseMessage = null;
	let correctAnswers = [];
	let active = false;

	gc.hud.addToggleBtn("Pause", "Resume", (enabled) => {
		active = enabled
	})

	gc.socket.outgoing(function(data) {
		// decode the data from an ArrayBuffer to a string
		let str = new TextDecoder("utf-8").decode(data)
		if(str.includes("UPGRADE_PURCHASED")) {
			purchaseMessage = data
			gc.hud.completeTodo("Purchase an upgrade")
		}
		if(str.toLowerCase().includes("answered")) {
			lastMessage = data
		}
	})

	let observer = new MutationObserver(function() {
		let greenBgExists = Array.from(document.querySelectorAll("div")).some(e => getComputedStyle(e).backgroundColor == "rgb(56, 142, 60)") 
		if(greenBgExists) {
			// make sure the answer was unique
			if(correctAnswers.some(e => e == lastMessage)) return
			// we answered correctly, so this is a new correct answer
			correctAnswers.push(lastMessage)
			gc.hud.completeTodo("Answer a question")
		}
		// attempt to purchase upgrades
		let moneyElement = document.querySelector(".MuiButtonBase-root.MuiIconButton-root ~ div > div > div > div")
		if(moneyElement && purchaseMessage && active) {
			let money = moneyElement.innerHTML.replace("$", "").replaceAll(",", "")
			for(let upgrade of upgradeOrder) {
				if(money > upgrade[2]) {
					// we can purchase the upgrade
					let arr = Array.from(new Uint8Array(purchaseMessage))
					let text = new TextDecoder("utf-8").decode(purchaseMessage)
					// splice everything between "upgradeName" and "level" in the array
					let startIndex = text.indexOf("upgradeName") + 11
					let endIndex = text.indexOf("level") - 1
					let message = new TextEncoder().encode(upgrade[0])
					let prefix = prefixes[upgrade[0]]
					let swapEncoded = [prefix, ...message]
					arr.splice(startIndex, endIndex - startIndex, ...swapEncoded)
					text = new TextDecoder("utf-8").decode(new Uint8Array(arr))
					// set the level
					let levelIndex = text.indexOf("level") + 5
					arr[levelIndex] = upgrade[1]
					// dispatch the event
					gc.socket.send(u8tobuff(new Uint8Array(arr)))
					console.log("Purchased upgrade", upgrade[0], "at level", upgrade[1])
					// remove the upgrade from the list
					upgradeOrder.splice(upgradeOrder.indexOf(upgrade), 1)
					break;
				}
			}
		} 
	})

	observer.observe(document.body, {
		childList: true,
		subtree: true,
		characterData: true
	})

	const answerQuestion = () => {
		// sleep for 600-1350ms (these numbers are arbitrary)
		setTimeout(answerQuestion, Math.floor(Math.random() * 750) + 600)
		if(!active) return
		// send a random answer
		let randomAnswer = correctAnswers[Math.floor(Math.random() * correctAnswers.length)]
		if(randomAnswer) gc.socket.send(randomAnswer)
	}
	answerQuestion()

	console.log("Gimkit Cheat Loaded")
})();