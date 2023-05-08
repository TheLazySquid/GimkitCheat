(function() {
	if(!window.gc) return alert(`You need to set up the override to use this script. Find instructions here:
	https://github.com/TheLazySquid/GimkitCheat#setting-up-an-override
	If you have it set up, try reloading this page with the console open.`)

	let active = true

	gc.hud.addToggleBtn("Stop Auto Answering", "Auto Answer Questions", (state) => {
		active = state
	}, true)

	setInterval(() => {
		if(!active) return

		let correctQuestion = gc.data.questions.find(q => q._id == gc.data.currentQuestionId)
		let correctAnswerId = correctQuestion.answers.find(a => a.correct)._id

		let packet = {
			key: 'answered',
			deviceId: gc.data.questionDeviceId,
			data: {
				answer: correctAnswerId
			}
		}

		gc.socket.sendObj("MESSAGE_FOR_DEVICE", packet)
	}, 1000)
})()