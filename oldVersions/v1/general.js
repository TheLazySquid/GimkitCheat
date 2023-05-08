(function(){
	// migrate from the old save/load system
	let kits = localStorage.getItem("gc_cheat_kits")
	if(kits){
		kits = JSON.parse(kits);
		let answers = {}
		for(let key of Object.keys(kits)){
			answers = {...answers, ...kits[key]}
		}
		localStorage.setItem("gc_cheat_answers", JSON.stringify(answers))
		localStorage.removeItem("gc_cheat_kits")
	}

	let answers = JSON.parse(localStorage.getItem('gc_cheat_answers') ?? "{}");

	let color = prompt("Would you like to color in the answers? (Y/n)", "Y").toLowerCase() == "y";
	
	const save = () => {
		localStorage.setItem("gc_cheat_answers", JSON.stringify(answers));
	}

	const stripStyles = (str) => {
		// remove all text after style=" and before "
		return str.replace(/style=".*?"/g, "");
	}

	var listenedButtons = [];
	let lastQuestion = null;
	let lastAnswer = null;
	let lastAnswerType = null;
	var newAnswers = 0;
	const selector = '.notranslate, img[alt="Answer Choice"], img[alt="Question"]';

	let active = true;

	let customStyles = new CSSStyleSheet();
	customStyles.replaceSync(`
		.answer-hover {
			transition: filter 0.18s ease-in-out;
		}
		.answer-hover:hover {
			filter: brightness(1.2);
		}
	`);
	// add it to the document
	document.adoptedStyleSheets.push(customStyles);

	function pageChange() {
		if(!active) return;
		// the menu was probably opened
		let items = Array.from(document.querySelectorAll(selector))

		if(items.length > 0){
			if(items.length == 1 && (document.querySelector("input") == null)){
				// this is an incorrect answer
				if(!lastQuestion) return;
				newAnswers++;
				if(!answers[lastQuestion]) answers[lastQuestion] = {};
				if(lastAnswerType == "text"){
					answers[lastQuestion].textAnswer = items[0].innerHTML;
				}else{
					answers[lastQuestion].correct = items[0].parentElement.innerHTML;
				}
				save();
				console.log(`Total answers stored: ${Object.keys(answers).length}\nNew answers this session: ${newAnswers}`)
				return;
			}
			lastQuestion = stripStyles(items[0].parentElement.innerHTML);

			// remove the question text
			if(items.length == 6) items = items.slice(2);
			else items = items.slice(1);

			// if the question was already answered, highlight the correct answer
			if(lastQuestion in answers){
				let answer = answers[lastQuestion];

				if(answer.textAnswer){
					if(items[0].parentElement.querySelector(".correct-answer") != null) return;
					let answerText = answer.textAnswer;
					let answerNode = document.createElement("div");
					answerNode.innerHTML = `Correct answer: ${answerText}`;
					answerNode.classList.add("correct-answer");
					answerNode.style.fontSize = "16px";
					items[0].parentElement.append(answerNode);
					let input = document.querySelector("input");
					input.value = answerText.slice(0, -1);
					return;
				}

				// get the colors of the options
				let colors = [];
				for(let i = 0; i < items.length; i++) {
					let item = items[i];

					let parentAmount = 5;
					if(item.nodeName == "IMG") parentAmount = 1;

					let checkNode = item.nthparent(parentAmount);
					let bgColor = getComputedStyle(checkNode).background;
					colors.push(bgColor);
				}

				let correctSeen = false;
				let correctExists = false;
				for(let i = 0; i < items.length; i++){
					let item = items[i];
					if(item.nodeName == "IMG") parentAmount = 1;
					if(stripStyles(item.parentElement.innerHTML) == stripStyles(answer.correct)){
						correctExists = true;
						break;
					}
				}
				if(!correctExists) {
					// remove the question from the answers
					delete answers[lastQuestion];
					return;
				}
				for(let i = 0; i < items.length && answer.correct; i++){
					// color and move answers
					let item = items[i]
					let parentAmount = 3;
					if(item.nodeName == 'IMG') parentAmount = 1;
					if(stripStyles(item.parentElement.innerHTML) == stripStyles(answer.correct)){
						// color in and move the correct answer to the bottom
						if(color) item.nthparent(parentAmount).style.backgroundColor = "green";
						else{
							let changeItem = item.nthparent(5);
							if(item.nodeName == "IMG") changeItem = item.parentElement;
							
							// swap the item's background color to match the one it's supposed to be
							changeItem.style.background = colors[3];

							changeItem.classList.add("answer-hover");
						}
						let outer = item.nthparent(parentAmount*2);
						let buttonParent = document.querySelectorAll(selector)[2]
						if(buttonParent.nodeName == "IMG") buttonParent = buttonParent.nthparent(3);
						else buttonParent = buttonParent.nthparent(7);
						let buttons = Array.from(buttonParent.children)
						if(buttons.indexOf(outer) != buttons.length-1){
							buttonParent.append(outer);
						}
						correctSeen = true;
					}else{
						// color incorrect answers
						if(color) item.nthparent(parentAmount).style.backgroundColor = "red";
						else if(correctSeen){
							let changeItem = item.nthparent(5);
							if(item.nodeName == "IMG") changeItem = item.parentElement;
							
							// swap the item's background color to match the one it's supposed to be
							changeItem.style.background = colors[i-1];

							changeItem.classList.add("answer-hover");
						}
					}
				}
			}

			// check if the question is a text input
			let input = document.querySelector(".sc-RpuvT");
			if(input != null){
				lastAnswerType = "text";
				input.addEventListener("input", (e) => {
					lastAnswer = e.target.value;
				})
				return;
			}

			lastAnswerType = "button";
			for(let i = 0; i < items.length; i++){
				let button = items[i].nthparent(6);
				if(items[i].nodeName == "IMG") button = items[i].nthparent(2);

				if(listenedButtons.indexOf(button) == -1){
					listenedButtons.push(button);
				}

				button.addEventListener("click", function(){
					lastAnswer = this.querySelector(selector).parentElement.innerHTML;
				})
			}
		}else{
			if(answers[lastQuestion]?.correct != undefined) return;
			// figure out whether it was right or not
			let greenBgExists = Array.from(document.querySelectorAll("div")).some(e => getComputedStyle(e).backgroundColor == "rgb(56, 142, 60)") 

			if(greenBgExists){
				newAnswers++;
				if(lastAnswerType == "text"){
					// answer was text
					if(!answers[lastQuestion]) answers[lastQuestion] = {};
					answers[lastQuestion].textAnswer = lastAnswer;
				}else{
					// answer was a button
					if(!answers[lastQuestion]) answers[lastQuestion] = {};
					answers[lastQuestion].correct = stripStyles(lastAnswer);
				}
				console.log(`Total answers stored: ${Object.keys(answers).length}\nNew answers this session: ${newAnswers}`)
				save();
			}
		}
	}

	let observer = new MutationObserver(pageChange);
	observer.observe(document.body, {subtree: true, childList: true});

	HTMLElement.prototype.nthparent = function(n) {
		let parent = this;
		while (n-- && parent) parent = parent.parentElement;
		return parent;
	}

	// check if the questions are open when the script is loaded
	pageChange();

	// When shift is hit three times in quick succession, toggle active
	let shiftCount = 0;
	let shiftTimeout = null;
	document.addEventListener("keydown", (e) => {
		if(e.key == "Shift"){
			shiftCount++;
			if(shiftTimeout != null) clearTimeout(shiftTimeout);
			shiftTimeout = setTimeout(() => {
				shiftCount = 0;
			}, 1000);
			if(shiftCount == 3){
				active = !active;
				if(active) {
					console.log("Active");
					pageChange();
				}
				else console.log("Inactive");
				shiftCount = 0;
			}
		}
	})
})();