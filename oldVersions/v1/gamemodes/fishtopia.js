(function() {
    let newStyles = new CSSStyleSheet();
    newStyles.replaceSync(`
        .gc-option {
            background-color: #1a1a1a;
            border: 1px solid #1a1a1a;
            border-radius: 5px;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            margin: 5px;
            padding: 5px;
            text-align: center;
            width: 10%;
        }
    
        .gc-option:hover {
            background-color: #2a2a2a;
            border: 1px solid #2a2a2a;
        }
    
        .gc-stop {
            position: absolute;
            top: 0;
            right: 0;
            z-index: 9999;
        }
    `);
    document.adoptedStyleSheets.push(newStyles);
    
    let fishingMode = "off";
    let fishing = false;
    let fishingCooldown = null;
    
    function fishingChecker() {
        window.requestAnimationFrame(fishingChecker);
    
        let fishingWindow = document.querySelector('.sc-dGzWME');

        if(fishingWindow) {
            fishing = true;
            if(fishingCooldown) clearTimeout(fishingCooldown);
            fishingCooldown = setTimeout(() => {
                document.querySelector('.gc-stop')?.remove?.();
                fishing = false;
            }, 1000);
        }

        if(fishingMode == "off") {
            if (fishingWindow) {
                if(fishingWindow.querySelector('.gc-option')) return;
                let buttons = ["Fish until full", "Fish until stopped"]
                for(let button of buttons) {
                    let newButton = document.createElement("button");
                    newButton.innerText = button;
                    newButton.classList.add("gc-option");
                    fishingWindow.append(newButton);
    
                    newButton.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
    
                        if (button == "Fish until full") fishingMode = "full";
                        else if (button == "Fish until stopped") fishingMode = "stopped";
                        // add the stop button
                        let stopButton = document.createElement("button");
                        stopButton.innerText = "Stop";
                        stopButton.classList.add("gc-stop");
                        stopButton.classList.add("gc-option");
                        document.body.append(stopButton);

                        stopButton.addEventListener("click", (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            fishingMode = "off";
                            stopButton.remove();
                        })
                    })
                }
            }
            return
        }
    
        let buttons = Array.from(document.querySelectorAll('button'));
        
        if(fishingMode == "full") {
            let text = document.querySelector('.sc-QlApj');
            if (text) {
                if (text.innerHTML.includes("your backpack cannot carry more")) {
                    for(let button of buttons) {
                        if (button.innerText == "Close") {
                            button.click();
                            fishingMode = "off";
                        }
                    }
                }
            }
        }
        
        for(let button of buttons) {
            if (button.innerText == "Fish Again") {
                button.click();
            }
        }
    }
    
    window.requestAnimationFrame(fishingChecker);
})()