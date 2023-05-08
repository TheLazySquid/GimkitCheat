(function() {
    class Cheat {
        constructor() {
            this.hud = new GCHud()
            this.version = "0.3.1"
            this.dev = true;
            
            this.loadCallbacks = []
            this.socket = null
            this.data = {}

            console.log(`Gimkit Cheat Override v${this.version} loaded!`);
            this.checkUpdate()
        }
        
        checkUpdate() {
            // check for an update to the script
            try {
                if (this.dev) return
                fetch("https://raw.githubusercontent.com/TheLazySquid/GimkitCheat/main/overrides/App.4382044d.js")
                // make sure the response is valid
                .then(res => {
                    if(!res.ok) return null
                    return res.text()
                })
                // check if the version is different
                .then(script => {        
                    if(!script) return
                    if(script.includes(`version = "${gc.version}"`)) return
                    alert(`A new version of Gimkit Cheat Override is available! Some scripts may not run properly unless you update.
                    Instructions on how to update can be found here: https://github.com/TheLazySquid/GimkitCheat#updating-the-script`)
                })
            } catch (e) {}
        }

        setSocket(socket) {
            this.socket = socket
            this.loadCallbacks.forEach(cb => cb())
        }

        addEventListener(event, callback) {
            switch(event) {
                case "load":
                    this.loadCallbacks.push(callback)
                    break
            }
        }

        setDevices(devices) {
            let devicesFixed = devices.addedDevices.devices.map(d => {
                let obj = {
                    id: d[0],
                    data: {}
                }
                for(let val of d[6]) {
                    let key1 = devices.addedDevices.values[val[0]];
                    let key2 = devices.addedDevices.values[val[1]];
                    obj.data[key1] = key2;
                }
                return obj
            })

            // merge/overwrite devices
            if(this.data.devices) {
                for(let device of devicesFixed) {
                    let existingDeviceIndex = this.data.devices.findIndex(d => d.id == device.id)
                    if(existingDeviceIndex != -1) {
                        this.data.devices[existingDeviceIndex] = device
                    } else {
                        this.data.devices.push(device)
                    }
                }
            } else {
                this.data.devices = devicesFixed
            }
        }

        getDevices(criteria) {
            if(!this.data.devices) return null
            let devices = this.data.devices
            devices = devices.filter(d => {
                if(criteria?.id) {
                    if(d.id != criteria.id) return false
                }
                if(criteria?.mustHave) {
                    for(let key in criteria.mustHave) {
                        if(d.data[key] != criteria.mustHave[key]) return false
                    }
                }
                return true
            })
            return devices
        }

        getDevice(criteria) {
            return this.getDevices(criteria)?.[0]
        }

        getUser() {
            let userId = stores.phaser.mainCharacter.id
            let characters = JSON.parse(JSON.stringify(gc.data.serializer.getState().characters))
            return characters[userId]
        }
    }

	// initalize standard stuff so multiple scripts can run simultaneously
	class GCHud {
		constructor() {
            // add the hud to the page
			this.hud = document.createElement("div")
			this.hud.classList.add("gc_hud")
			this.hud.innerHTML = `
				<div class="gc_todo" style="display: none;">
					<div class="gc_text">Please do the following:</div>
				</div>
				<div class="gc_groups"></div>
			`
			document.body.appendChild(this.hud)
			
			this.rootGroup = new HudGroup("root", this)
			
            this.enabled = false
			this.todos = []
			
			// make the hud draggable
			let drag = false
            let draggedEnough = false
			let dragX = 0
			let dragY = 0
            let dragStartX = 0
            let dragStartY = 0
			this.hud.addEventListener("mousedown", (e) => {
				drag = true
                draggedEnough = false
				dragX = e.clientX - this.hud.offsetLeft
				dragY = e.clientY - this.hud.offsetTop
                dragStartX = e.clientX
                dragStartY = e.clientY
			})
            let observer = new ResizeObserver(() => {
                drag = false
            })
            observer.observe(this.hud)
			window.addEventListener("mouseup", () => drag = false)
			window.addEventListener("mousemove", (e) => {
                if(Math.abs(e.clientX - dragStartX) > 10 || Math.abs(e.clientY - dragStartY) > 10) draggedEnough = true
				if(drag && draggedEnough) {
					this.hud.style.left = e.clientX - dragX + "px"
					this.hud.style.top = e.clientY - dragY + "px"
				}
			})
			
			// make the hud toggleable with triple shift
			let shiftCount = 0
			let shiftTimeout = null
			window.addEventListener("keydown", (e) => {
                if(!this.enabled) return
				if(e.key != "Shift") return;
				shiftCount++
				if(shiftTimeout) clearTimeout(shiftTimeout)
				shiftTimeout = setTimeout(() => shiftCount = 0, 500)
				if(shiftCount == 3) {
					this.hud.style.display = this.hud.style.display == "none" ? "flex" : "none"
					shiftCount = 0
				}
			})

			// add stylesheets
			let injectedCss = new CSSStyleSheet()
			injectedCss.replaceSync(`
			.gc_hud {
				background-color: rgba(0, 0, 0, 0.5) !important;
				position: absolute;
				top: 0;
				left: 0;
				width: 300px;
				height: 150px;
				z-index: 999999999;
				color: white;
				font-size: 1rem;
				font-family: Verdana, Geneva, Tahoma, sans-serif;
				display: none;
				flex-direction: column;
				align-items: center;
				margin: 1rem;
				border-radius: 0.5rem;
				overflow-x: hidden;
				overflow-y: auto;
                resize: both;
			}
			
			.gc_group {
				margin: 0px;
				padding: 0px;
				width: 100%;
				height: 100%;
				position: absolute;
				top: 0;
				left: 0;
			}
			
			.gc_btn {
				width: 100%;
				height: 2rem;
				margin: 0;
				padding: 0;
				background-color: rgba(0, 0, 0, 0.5);
				color: white;
				border: none;
				border-radius: 0.5rem;
			}
			
			.gc_btn:hover {
				border: 1px solid white;
			}
			
			.gc_group_opener {
				color: white;
				font-family: Verdana, Geneva, Tahoma, sans-serif;
				padding-left: 1rem;
				padding-right: 1rem;
			}
			
			.gc_left {
				float: left;
			}
			
			.gc_right {
				float: right;
			}
			
			.gc_text {
				width: 100%;
				text-align: center;
			}
			
			.gc_dropdown {
				display: flex;
				flex-direction: row;
				justify-content: space-between;
				align-items: center;
				width: 100%;
			}
			
			.gc_dropdown select {
				width: 60%;
				height: 2rem;
				margin: 0;
				padding: 0;
				background-color: rgba(0, 0, 0, 0.5);
				color: white;
				font-size: 1rem;
				font-family: Verdana, Geneva, Tahoma, sans-serif;
				border: none;
				border-radius: 0.5rem;
				margin: 0.35rem;
			}
			
			input.gc_input {
				width: 100%;
				height: 2rem;
				margin: 0;
				padding: 0;
				background-color: rgba(0, 0, 0, 0.5);
				color: white;
				font-size: 1rem;
				font-family: Verdana, Geneva, Tahoma, sans-serif;
				border: none;
				border-radius: 0.5rem;
			}
			
			.gc_groups {
				position: relative;
				width: 100%;
			}
			
			@keyframes gc_slide_out_left {
				0% {
					transform: translateX(0);
					opacity: 1;
					pointer-events: all;
				}
			
				100% {
					transform: translateX(-100%);
					opacity: 0;
					pointer-events: none;
				}
			}
			
			@keyframes gc_slide_out_right {
				0% {
					transform: translateX(0);
					opacity: 1;
					pointer-events: all;
				}
			
				100% {
					transform: translateX(100%);
					opacity: 0;
					pointer-events: none;
				}
			}
			
			@keyframes gc_slide_in_left {
				0% {
					transform: translateX(-100%);
					opacity: 0;
					pointer-events: none;
				}
			
				100% {
					transform: translateX(0);
					opacity: 1;
					pointer-events: all;
				}
			}
			
			@keyframes gc_slide_in_right {
				0% {
					transform: translateX(100%);
					opacity: 0;
					pointer-events: none;
				}
			
				100% {
					transform: translateX(0);
					opacity: 1;
					pointer-events: all;
				}
			}
			
			@keyframes gc_idle {}
			@keyframes gc_hidden {
				0% {
					opacity: 1;
					pointer-events: all;
				}
			
				100% {
					opacity: 0;
					pointer-events: none;
				}
			}

            @keyframes gc_pulse {
                0% {
                    border: 5px solid rgba(255, 255, 255, 0);
                }
                50% {
                    border: 5px solid rgba(255, 255, 255, 1);
                }
                100% {
                    border: 5px solid rgba(255, 255, 255, 0);
                }
            }

            .gc_pulse {
                animation: gc_pulse 1.5s infinite;
            }
			`)
			document.adoptedStyleSheets = [injectedCss]
            
            this.pressedKeys = []
            this.keybinds = []
            this.addListeners()
		}

        addListeners() {
            window.addEventListener("keydown", e => {
                if(this.pressedKeys.includes(e.key)) return
                this.pressedKeys.push(e.key)
                
                for(let bind of this.keybinds) {
                    if(!bind.keys.includes(e.key)) continue
                    if(bind.isPressed()) {
                        bind.callback()
                        e.preventDefault()
                    }
                }
            })

            window.addEventListener("keyup", e => {
                this.pressedKeys.splice(this.pressedKeys.indexOf(e.key), 1)
            })
        }

        addKeybind(keys, callback) {
            if(typeof keys == "string") keys = [keys]
            let bind = new Keybind(keys, callback, this)
            this.keybinds.push(bind)

            return bind
        }

		addTodo(text) {
			this.enable()
			this.hud.querySelector(".gc_todo").style.display = "block"
			this.hud.querySelector(".gc_todo").innerHTML += `<div class="gc_text gc_todo_option">${text}</div>`
			this.todos.push(text)
		}

		completeTodo(text) {
			if(!this.todos.includes(text)) return
			this.hud.querySelectorAll(".gc_todo_option").forEach(el => {
				if(el.innerHTML == text) el.remove()
			})
			this.todos.splice(this.todos.indexOf(text), 1)
			if(this.todos.length == 0) this.hud.querySelector(".gc_todo").style.display = "none"
		}

		enable() {
			this.hud.style.display = "flex"
			this.enabled = true
		}

        createGroup(name) {
			return this.rootGroup.createGroup(name)
		}

		group(name) {
			return this.rootGroup.group(name)
		}

		addBtn(text, callback) {
			return this.rootGroup.addBtn(text, callback)
		}

		addText(text) {
			return this.rootGroup.addText(text)
		}

		addToggleBtn(enabledText, disabledText, callback, startEnabled) {
			return this.rootGroup.addToggleBtn(enabledText, disabledText, callback, startEnabled)
		}

        addDropdownButton(options, buttonText, callback) {
            return this.rootGroup.addDropdownButton(options, buttonText, callback)
        }

		addInput(text, callback) {
			return this.rootGroup.addInput(text, callback)
		}

        addKeybindSetter(text, callback) {
            return this.rootGroup.addKeybindSetter(text, callback)
        }
	}

    class Keybind {
        constructor(keys, callback, hud) {
            this.setKeys(keys)
            this.callback = callback
            this.hud = hud
        }

        isPressed() {
            if(this.keys.length == 0) return false
            return this.keys.every(key => this.hud.pressedKeys.includes(key))
        }

        setKeys(keys) {
            if(typeof keys == "string") keys = [keys]
            this.keys = keys
        }

        remove() {
            let index = this.hud.keybinds.indexOf(this)
            if(index == -1) return
            this.hud.keybinds.splice(index, 1)
        }
    }

    class HudGroup {
        constructor(name, hud, parentGroup) {
            this.name = name
			this.hud = hud
			this.parentGroup = parentGroup
            this.elements = []

			this.subGroups = {}

			this.element = document.createElement("div")
			this.element.classList.add("gc_group")

            this.hideTimeout = null

			if(name != "root") {
                this.element.style.display = "none"
				this.element.style.animation = "gc_hidden 0s both"
				// add the button to go back one group
				let backBtn = document.createElement("button")
				backBtn.classList.add("gc_back_btn")
				backBtn.innerHTML = "< Back"
				backBtn.classList.add("gc_btn")
				backBtn.addEventListener("click", () => {
					this.slide("out", "right")
					this.parentGroup.slide("in", "left")
				})
				this.element.appendChild(backBtn)
			}

			this.hud.hud.querySelector(".gc_groups").appendChild(this.element)
        }

		createGroup(name) {
			if(name in this.subGroups) return this.subGroups[name]
			let group = new HudGroup(name, this.hud, this)
			this.subGroups[name] = group

			let opener = new GroupOpener(name, this, group)
			this.elements.push(opener)
			this.element.appendChild(opener.element)

			return group
		}

		group(name) {
			return this.subGroups[name] ?? null
		}

		addBtn(text, callback) {
			this.hud.enable()
			let button = new Button(text, callback, this)
			this.elements.push(button)
			this.element.appendChild(button.element)
			return button
		}

		addText(text) {
			this.hud.enable()
			let textElement = new Text(text, this)
			this.elements.push(textElement)
			this.element.appendChild(textElement.element)
			return textElement
		}

		addToggleBtn(enabledText, disabledText, callback, startEnabled) {
			this.hud.enable()
			let button = new ToggleButton(enabledText, disabledText, callback, startEnabled ?? false, this)
			this.elements.push(button)
			this.element.appendChild(button.element)
			return button
		}

		addDropdownButton(options, buttonText, callback) {
			this.hud.enable()
			let button = new DropdownButton(options, buttonText, callback, this)
			this.elements.push(button)
			this.element.appendChild(button.element)
			return button
		}

		addInput(text, callback) {
			this.hud.enable()
			let input = new Input(text, callback, this)
			this.elements.push(input)
			this.element.appendChild(input.element)
			return input
		}

        addKeybindSetter(text, callback) {
            this.hud.enable()
            let keybindSetter = new KeybindSetter(text, callback, this)
            this.elements.push(keybindSetter)
            this.element.appendChild(keybindSetter.element)
            return keybindSetter
        }

		slide(mode, direction) {
            if(this.hideTimeout) clearTimeout(this.hideTimeout)

			this.element.style.animation = `gc_slide_${mode}_${direction} both 0.5s`
            if(mode == "in") this.element.style.display = "block"
            else if(mode == "out") {
                this.hideTimeout = setTimeout(() => this.element.style.display = "none", 500)
            }
		}
    }

	class HudElement {
		constructor(element, type, group) {
			this.element = element
			this.type = type
			this.group = group
		}
		remove() {
			this.element.remove()
			this.group.elements.splice(this.group.elements.indexOf(this), 1)
		}
	}

	class Button extends HudElement {
		constructor(text, callback, group) {
			let element = document.createElement("button")
			element.classList.add("gc_btn")
			element.innerHTML = text
			element.addEventListener("click", callback)
			element.addEventListener("keydown", (e) => e.preventDefault())

			super(element, "button", group)
		}
		setEnabled(bool) {
			this.element.disabled = !bool
		}
		setText(text) {
			this.element.innerHTML = text
		}
        trigger() {
            this.element.click()
        }
	}

	class Text extends HudElement {
		constructor(text, group) {
			let element = document.createElement("div")
			element.classList.add("gc_text")
			element.innerHTML = text

			super(element, "text", group)
		}
		setText(text) {
			this.element.innerHTML = text
		}
	}

	class ToggleButton extends HudElement {
		constructor(textEnabled, textDisabled, callback, startEnabled, group) {
			let element = document.createElement("button")
			element.classList.add("gc_btn")
			element.addEventListener("keydown", (e) => e.preventDefault())

			super(element, "toggle_button", group)

			this.enabled = startEnabled
			this.element.innerHTML = this.enabled ? textEnabled : textDisabled

			element.addEventListener("click", () => {
				this.enabled = !this.enabled
				this.element.innerHTML = this.enabled ? textEnabled : textDisabled
				callback(this.enabled)
			})
		}

		setEnabled(bool) {
			this.enabled = bool
			this.element.innerHTML = this.enabled ? textEnabled : textDisabled
		}

        trigger() {
            this.element.click()
        }
	}

	class DropdownButton extends HudElement {
		constructor(options, buttonText, callback, group) {
			let element = document.createElement("div")
			element.classList.add("gc_dropdown")
			element.innerHTML = `
				<select>
					${options.map(option => `<option value="${option}">${option}</option>`).join("")}
				</select>
				<button class="gc_btn">${buttonText}</button>
			`
			element.querySelector("button").addEventListener("click", () => {
				callback(element.querySelector("select").value)
			})
			element.querySelector("button").addEventListener("keydown", (e) => e.preventDefault())
			
			super(element, "dropdown_button", group)
		}

		setEnabled(bool) {
			this.element.querySelector("button").disabled = !bool
		}

		setText(text) {
			this.element.querySelector("button").innerHTML = text
		}

		addOption(option) {
			let select = this.element.querySelector("select")
			select.innerHTML += `<option value="${option}">${option}</option>`
		}

		removeOption(option) {
			let select = this.element.querySelector("select")
			select.querySelector(`option[value="${option}"]`).remove()
		}

		setOptions(options) {
			let select = this.element.querySelector("select")
			select.innerHTML = options.map(option => `<option value="${option}">${option}</option>`).join("")
		}

		setSelected(option) {
			let select = this.element.querySelector("select")
			select.value = option
		}
	}

	class GroupOpener extends HudElement {
		constructor(text, group, groupToOpen) {
			let element = document.createElement("button")
			element.classList.add("gc_btn")
			element.classList.add("gc_group_opener")
			element.addEventListener("keydown", (e) => e.preventDefault())
			element.innerHTML = `
				<div class="gc_left">${text}</div>
				<div class="gc_right">></div>
			`
			element.classList.add("gc_group_opener")
			element.addEventListener("click", () => {
				group.slide("out", "left")
				groupToOpen.slide("in", "right")
				// scroll to top
				// groupToOpen.element.scrollIntoView({behavior: "smooth", block: "start"})
			})
			
			super(element, "group_opener", group)
		}
	}

	class Input extends HudElement {
		constructor(text, callback, group) {
			let element = document.createElement("input")
			element.classList.add("gc_input")
			element.value = text
			element.addEventListener("change", () => {
				callback(element.value)
			})
			
			super(element, "input", group)
		}

		get value() {
			return this.element.value
		}

		setEnabled(bool) {
			this.element.disabled = !bool
		}

		setText(text) {
			this.element.value = text
		}
	}

    class KeybindSetter extends HudElement {
        constructor(text, callback, group) {
            let element = document.createElement("div")
            element.innerHTML = `
                <div class="gc_text">${text}</div>
                <button class="gc_btn gc_keybind_setter"></button>
            `

            super(element, "keybind_setter", group)

            this.keys = []
            this.callback = callback
            this.bind = this.group.hud.addKeybind([], this.callback)
            this.addListeners()
        }
        
        addListeners() {
            let btn = this.element.querySelector("button")

            // register listeners
            const onKeyDown = (e) => {
                if(this.keys.includes(e.key)) return
                e.preventDefault()
                if(e.key == "Escape") {
                    endCapture()
                    return
                }
                this.keys.push(e.key)
                // replace any instances of a space with the text "Space"
                btn.innerHTML = this.keys.map(k => k == " " ? "Space" : k).join(" + ")
            }

            let capturing = false

            const endCapture = () => {
                capturing = false
                window.removeEventListener("keydown", onKeyDown, true)
                this.bind.setKeys(this.keys)
                btn.classList.remove("gc_pulse")
            }
    
            btn.addEventListener("click", () => {
                if(capturing) return
                capturing = true
                btn.innerHTML = ""
                this.keys = []
                // start setting keybind
                window.addEventListener("keydown", onKeyDown, true)
                btn.classList.add("gc_pulse")
            })

            window.addEventListener("mousedown", (e) => {
                if(capturing) {
                    endCapture()
                    return
                }
            })
        }
    }

    window.gc = new Cheat()
})()

var e = "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : "undefined" != typeof window ? window : "undefined" != typeof global ? global : {};
e.parcelRequire388b.register("kizyG", (function(t, n) {
    t.exports,
    function(t) {
        ArrayBuffer.isView || (ArrayBuffer.isView = function(e) {
            return null !== e && "object" == typeof e && e.buffer instanceof ArrayBuffer
        }
        ),
        "undefined" == typeof globalThis && "undefined" != typeof window && (window.globalThis = window)/*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
        ;
        var n = function(e, t) {
            return n = Object.setPrototypeOf || {
                __proto__: []
            }instanceof Array && function(e, t) {
                e.__proto__ = t
            }
            || function(e, t) {
                for (var n in t)
                    Object.prototype.hasOwnProperty.call(t, n) && (e[n] = t[n])
            }
            ,
            n(e, t)
        };
        function i(e, t) {
            if ("function" != typeof t && null !== t)
                throw new TypeError("Class extends value " + String(t) + " is not a constructor or null");
            function i() {
                this.constructor = e
            }
            n(e, t),
            e.prototype = null === t ? Object.create(t) : (i.prototype = t.prototype,
            new i)
        }
        function r(e, t, n, i) {
            function r(e) {
                return e instanceof n ? e : new n((function(t) {
                    t(e)
                }
                ))
            }
            return new (n || (n = Promise))((function(n, o) {
                function s(e) {
                    try {
                        h(i.next(e))
                    } catch (e) {
                        o(e)
                    }
                }
                function a(e) {
                    try {
                        h(i.throw(e))
                    } catch (e) {
                        o(e)
                    }
                }
                function h(e) {
                    e.done ? n(e.value) : r(e.value).then(s, a)
                }
                h((i = i.apply(e, t || [])).next())
            }
            ))
        }
        function o(e, t) {
            var n, i, r, o, s = {
                label: 0,
                sent: function() {
                    if (1 & r[0])
                        throw r[1];
                    return r[1]
                },
                trys: [],
                ops: []
            };
            return o = {
                next: a(0),
                throw: a(1),
                return: a(2)
            },
            "function" == typeof Symbol && (o[Symbol.iterator] = function() {
                return this
            }
            ),
            o;
            function a(e) {
                return function(t) {
                    return h([e, t])
                }
            }
            function h(o) {
                if (n)
                    throw new TypeError("Generator is already executing.");
                for (; s; )
                    try {
                        if (n = 1,
                        i && (r = 2 & o[0] ? i.return : o[0] ? i.throw || ((r = i.return) && r.call(i),
                        0) : i.next) && !(r = r.call(i, o[1])).done)
                            return r;
                        switch (i = 0,
                        r && (o = [2 & o[0], r.value]),
                        o[0]) {
                        case 0:
                        case 1:
                            r = o;
                            break;
                        case 4:
                            return s.label++,
                            {
                                value: o[1],
                                done: !1
                            };
                        case 5:
                            s.label++,
                            i = o[1],
                            o = [0];
                            continue;
                        case 7:
                            o = s.ops.pop(),
                            s.trys.pop();
                            continue;
                        default:
                            if (!((r = (r = s.trys).length > 0 && r[r.length - 1]) || 6 !== o[0] && 2 !== o[0])) {
                                s = 0;
                                continue
                            }
                            if (3 === o[0] && (!r || o[1] > r[0] && o[1] < r[3])) {
                                s.label = o[1];
                                break
                            }
                            if (6 === o[0] && s.label < r[1]) {
                                s.label = r[1],
                                r = o;
                                break
                            }
                            if (r && s.label < r[2]) {
                                s.label = r[2],
                                s.ops.push(o);
                                break
                            }
                            r[2] && s.ops.pop(),
                            s.trys.pop();
                            continue
                        }
                        o = t.call(e, s)
                    } catch (e) {
                        o = [6, e],
                        i = 0
                    } finally {
                        n = r = 0
                    }
                if (5 & o[0])
                    throw o[1];
                return {
                    value: o[0] ? o[1] : void 0,
                    done: !0
                }
            }
        }
        function s(e, t) {
            t.headers = e.headers || {},
            t.statusMessage = e.statusText,
            t.statusCode = e.status,
            t.data = e.response
        }
        function a(e, t, n) {
            return new Promise((function(i, r) {
                n = n || {};
                var o, a, h, f = new XMLHttpRequest, c = n.body, u = n.headers || {};
                for (o in n.timeout && (f.timeout = n.timeout),
                f.ontimeout = f.onerror = function(e) {
                    e.timeout = "timeout" == e.type,
                    r(e)
                }
                ,
                f.open(e, t.href || t),
                f.onload = function() {
                    for (h = f.getAllResponseHeaders().trim().split(/[\r\n]+/),
                    s(f, f); a = h.shift(); )
                        a = a.split(": "),
                        f.headers[a.shift().toLowerCase()] = a.join(": ");
                    if ((a = f.headers["content-type"]) && ~a.indexOf("application/json"))
                        try {
                            f.data = JSON.parse(f.data, n.reviver)
                        } catch (e) {
                            return s(f, e),
                            r(e)
                        }
                    (f.status >= 400 ? r : i)(f)
                }
                ,
                typeof FormData < "u" && c instanceof FormData || c && "object" == typeof c && (u["content-type"] = "application/json",
                c = JSON.stringify(c)),
                f.withCredentials = !!n.withCredentials,
                u)
                    f.setRequestHeader(o, u[o]);
                f.send(c)
            }
            ))
        }
        var h = a.bind(a, "GET")
          , f = a.bind(a, "POST")
          , c = a.bind(a, "PATCH")
          , u = a.bind(a, "DELETE")
          , d = h
          , p = c
          , l = f
          , v = a.bind(a, "PUT")
          , y = a
          , g = {
            del: u,
            get: d,
            patch: p,
            post: l,
            put: v,
            send: y
        }
          , m = Object.freeze(Object.assign(Object.create(null), g, {
            default: g,
            del: u,
            get: d,
            patch: p,
            post: l,
            put: v,
            send: y
        }))
          , _ = function(e) {
            function t(t, n) {
                var i = e.call(this, n) || this;
                return i.name = "ServerError",
                i.code = t,
                i
            }
            return i(t, e),
            t
        }(Error);
        function w(e, t) {
            if (this._offset = t,
            e instanceof ArrayBuffer)
                this._buffer = e,
                this._view = new DataView(this._buffer);
            else {
                if (!ArrayBuffer.isView(e))
                    throw new Error("Invalid argument");
                this._buffer = e.buffer,
                this._view = new DataView(this._buffer,e.byteOffset,e.byteLength)
            }
        }
        function A(e, t, n) {
            for (var i = "", r = 0, o = t, s = t + n; o < s; o++) {
                var a = e.getUint8(o);
                if (0 != (128 & a))
                    if (192 != (224 & a))
                        if (224 != (240 & a)) {
                            if (240 != (248 & a))
                                throw new Error("Invalid byte " + a.toString(16));
                            (r = (7 & a) << 18 | (63 & e.getUint8(++o)) << 12 | (63 & e.getUint8(++o)) << 6 | (63 & e.getUint8(++o)) << 0) >= 65536 ? (r -= 65536,
                            i += String.fromCharCode(55296 + (r >>> 10), 56320 + (1023 & r))) : i += String.fromCharCode(r)
                        } else
                            i += String.fromCharCode((15 & a) << 12 | (63 & e.getUint8(++o)) << 6 | (63 & e.getUint8(++o)) << 0);
                    else
                        i += String.fromCharCode((31 & a) << 6 | 63 & e.getUint8(++o));
                else
                    i += String.fromCharCode(a)
            }
            return i
        }
        function $(e, t) {
            void 0 === t && (t = 0);
            var n = new w(e,t)
            , i = n._parse();
            // inserted code
            try {
                let data = i
                if (typeof i === "string") {
                    data = JSON.parse(i)
                }
                if(data.changes) {
                    for(let callback of window.gc.socket.deviceChangeCallbacks) {
                        // convert to key-value pairs
                        let changes = data.changes.map(c => {
                            let returnObj = {
                                id: c[0],
                                data: {}
                            }
    
                            let keys = c[1].map(k => data.values[k])
    
                            for(let i = 0; i < keys.length; i++) {
                                returnObj.data[keys[i]] = c[2][i]
                            }

                            return returnObj
                        })
    
                        callback(changes)
                    }
                }
                if(data.devices) {
                    window.gc.setDevices(data.devices)
                }
                else if(data.changes) {
                    for(let change of data.changes) {
                        let keys = change[1].map(index => data.values[index])
                        
                        // check if we can find the questions
						for(let i = 0; i < keys.length; i++) {
                            let key = keys[i]
                            if(key == "GLOBAL_questions") {
                                let questions = change[2][i]
                                window.gc.data.questions = JSON.parse(questions)
                                console.log("Quesitons extracted!", window.gc.data.questions)

                                window.gc.data.questionDeviceId = change[0]
                            }
                        }

                        // check if the active question has been updated
                        for(let i = 0; i < keys.length; i++) {
                            let key = keys[i]
                            if(key.includes("currentQuestionId")) {
                                let questionId = change[2][i]
                                window.gc.data.currentQuestionId = questionId
                            }
                        }
					}

                }
            } catch(e) {
                console.log(e)
                // ignore it
            }
            if (n._offset !== e.byteLength)
            throw new Error(e.byteLength - n._offset + " trailing bytes");
            return i
        }
        function E(e, t, n) {
            for (var i = 0, r = 0, o = n.length; r < o; r++)
                (i = n.charCodeAt(r)) < 128 ? e.setUint8(t++, i) : i < 2048 ? (e.setUint8(t++, 192 | i >> 6),
                e.setUint8(t++, 128 | 63 & i)) : i < 55296 || i >= 57344 ? (e.setUint8(t++, 224 | i >> 12),
                e.setUint8(t++, 128 | i >> 6 & 63),
                e.setUint8(t++, 128 | 63 & i)) : (r++,
                i = 65536 + ((1023 & i) << 10 | 1023 & n.charCodeAt(r)),
                e.setUint8(t++, 240 | i >> 18),
                e.setUint8(t++, 128 | i >> 12 & 63),
                e.setUint8(t++, 128 | i >> 6 & 63),
                e.setUint8(t++, 128 | 63 & i))
        }
        function O(e) {
            for (var t = 0, n = 0, i = 0, r = e.length; i < r; i++)
                (t = e.charCodeAt(i)) < 128 ? n += 1 : t < 2048 ? n += 2 : t < 55296 || t >= 57344 ? n += 3 : (i++,
                n += 4);
            return n
        }
        function I(e, t, n) {
            var i = typeof n
              , r = 0
              , o = 0
              , s = 0
              , a = 0
              , h = 0
              , f = 0;
            if ("string" === i) {
                if ((h = O(n)) < 32)
                    e.push(160 | h),
                    f = 1;
                else if (h < 256)
                    e.push(217, h),
                    f = 2;
                else if (h < 65536)
                    e.push(218, h >> 8, h),
                    f = 3;
                else {
                    if (!(h < 4294967296))
                        throw new Error("String too long");
                    e.push(219, h >> 24, h >> 16, h >> 8, h),
                    f = 5
                }
                return t.push({
                    _str: n,
                    _length: h,
                    _offset: e.length
                }),
                f + h
            }
            if ("number" === i)
                return Math.floor(n) === n && isFinite(n) ? n >= 0 ? n < 128 ? (e.push(n),
                1) : n < 256 ? (e.push(204, n),
                2) : n < 65536 ? (e.push(205, n >> 8, n),
                3) : n < 4294967296 ? (e.push(206, n >> 24, n >> 16, n >> 8, n),
                5) : (s = n / Math.pow(2, 32) >> 0,
                a = n >>> 0,
                e.push(207, s >> 24, s >> 16, s >> 8, s, a >> 24, a >> 16, a >> 8, a),
                9) : n >= -32 ? (e.push(n),
                1) : n >= -128 ? (e.push(208, n),
                2) : n >= -32768 ? (e.push(209, n >> 8, n),
                3) : n >= -2147483648 ? (e.push(210, n >> 24, n >> 16, n >> 8, n),
                5) : (s = Math.floor(n / Math.pow(2, 32)),
                a = n >>> 0,
                e.push(211, s >> 24, s >> 16, s >> 8, s, a >> 24, a >> 16, a >> 8, a),
                9) : (e.push(203),
                t.push({
                    _float: n,
                    _length: 8,
                    _offset: e.length
                }),
                9);
            if ("object" === i) {
                if (null === n)
                    return e.push(192),
                    1;
                if (Array.isArray(n)) {
                    if ((h = n.length) < 16)
                        e.push(144 | h),
                        f = 1;
                    else if (h < 65536)
                        e.push(220, h >> 8, h),
                        f = 3;
                    else {
                        if (!(h < 4294967296))
                            throw new Error("Array too large");
                        e.push(221, h >> 24, h >> 16, h >> 8, h),
                        f = 5
                    }
                    for (r = 0; r < h; r++)
                        f += I(e, t, n[r]);
                    return f
                }
                if (n instanceof Date) {
                    var c = n.getTime();
                    return s = Math.floor(c / Math.pow(2, 32)),
                    a = c >>> 0,
                    e.push(215, 0, s >> 24, s >> 16, s >> 8, s, a >> 24, a >> 16, a >> 8, a),
                    10
                }
                if (n instanceof ArrayBuffer) {
                    if ((h = n.byteLength) < 256)
                        e.push(196, h),
                        f = 2;
                    else if (h < 65536)
                        e.push(197, h >> 8, h),
                        f = 3;
                    else {
                        if (!(h < 4294967296))
                            throw new Error("Buffer too large");
                        e.push(198, h >> 24, h >> 16, h >> 8, h),
                        f = 5
                    }
                    return t.push({
                        _bin: n,
                        _length: h,
                        _offset: e.length
                    }),
                    f + h
                }
                if ("function" == typeof n.toJSON)
                    return I(e, t, n.toJSON());
                var u = []
                  , d = ""
                  , p = Object.keys(n);
                for (r = 0,
                o = p.length; r < o; r++)
                    "function" != typeof n[d = p[r]] && u.push(d);
                if ((h = u.length) < 16)
                    e.push(128 | h),
                    f = 1;
                else if (h < 65536)
                    e.push(222, h >> 8, h),
                    f = 3;
                else {
                    if (!(h < 4294967296))
                        throw new Error("Object too large");
                    e.push(223, h >> 24, h >> 16, h >> 8, h),
                    f = 5
                }
                for (r = 0; r < h; r++)
                    f += I(e, t, d = u[r]),
                    f += I(e, t, n[d]);
                return f
            }
            if ("boolean" === i)
                return e.push(n ? 195 : 194),
                1;
            if ("undefined" === i)
                return e.push(212, 0, 0),
                3;
            throw new Error("Could not encode")
        }
        function b(e) {
            var t = []
              , n = []
              , i = I(t, n, e)
              , r = new ArrayBuffer(i)
              , o = new DataView(r)
              , s = 0
              , a = 0
              , h = -1;
            n.length > 0 && (h = n[0]._offset);
            for (var f, c = 0, u = 0, d = 0, p = t.length; d < p; d++)
                if (o.setUint8(a + d, t[d]),
                d + 1 === h) {
                    if (c = (f = n[s])._length,
                    u = a + h,
                    f._bin)
                        for (var l = new Uint8Array(f._bin), v = 0; v < c; v++)
                            o.setUint8(u + v, l[v]);
                    else
                        f._str ? E(o, u, f._str) : void 0 !== f._float && o.setFloat64(u, f._float);
                    a += c,
                    n[++s] && (h = n[s]._offset)
                }
            return r
        }
        w.prototype._array = function(e) {
            for (var t = new Array(e), n = 0; n < e; n++)
                t[n] = this._parse();
            return t
        }
        ,
        w.prototype._map = function(e) {
            for (var t = {}, n = 0; n < e; n++)
                t[this._parse()] = this._parse();
            return t
        }
        ,
        w.prototype._str = function(e) {
            var t = A(this._view, this._offset, e);
            return this._offset += e,
            t
        }
        ,
        w.prototype._bin = function(e) {
            var t = this._buffer.slice(this._offset, this._offset + e);
            return this._offset += e,
            t
        }
        ,
        w.prototype._parse = function() {
            var e, t = this._view.getUint8(this._offset++), n = 0, i = 0, r = 0, o = 0;
            if (t < 192)
                return t < 128 ? t : t < 144 ? this._map(15 & t) : t < 160 ? this._array(15 & t) : this._str(31 & t);
            if (t > 223)
                return -1 * (255 - t + 1);
            switch (t) {
            case 192:
                return null;
            case 194:
                return !1;
            case 195:
                return !0;
            case 196:
                return n = this._view.getUint8(this._offset),
                this._offset += 1,
                this._bin(n);
            case 197:
                return n = this._view.getUint16(this._offset),
                this._offset += 2,
                this._bin(n);
            case 198:
                return n = this._view.getUint32(this._offset),
                this._offset += 4,
                this._bin(n);
            case 199:
                return n = this._view.getUint8(this._offset),
                i = this._view.getInt8(this._offset + 1),
                this._offset += 2,
                [i, this._bin(n)];
            case 200:
                return n = this._view.getUint16(this._offset),
                i = this._view.getInt8(this._offset + 2),
                this._offset += 3,
                [i, this._bin(n)];
            case 201:
                return n = this._view.getUint32(this._offset),
                i = this._view.getInt8(this._offset + 4),
                this._offset += 5,
                [i, this._bin(n)];
            case 202:
                return e = this._view.getFloat32(this._offset),
                this._offset += 4,
                e;
            case 203:
                return e = this._view.getFloat64(this._offset),
                this._offset += 8,
                e;
            case 204:
                return e = this._view.getUint8(this._offset),
                this._offset += 1,
                e;
            case 205:
                return e = this._view.getUint16(this._offset),
                this._offset += 2,
                e;
            case 206:
                return e = this._view.getUint32(this._offset),
                this._offset += 4,
                e;
            case 207:
                return r = this._view.getUint32(this._offset) * Math.pow(2, 32),
                o = this._view.getUint32(this._offset + 4),
                this._offset += 8,
                r + o;
            case 208:
                return e = this._view.getInt8(this._offset),
                this._offset += 1,
                e;
            case 209:
                return e = this._view.getInt16(this._offset),
                this._offset += 2,
                e;
            case 210:
                return e = this._view.getInt32(this._offset),
                this._offset += 4,
                e;
            case 211:
                return r = this._view.getInt32(this._offset) * Math.pow(2, 32),
                o = this._view.getUint32(this._offset + 4),
                this._offset += 8,
                r + o;
            case 212:
                return i = this._view.getInt8(this._offset),
                this._offset += 1,
                0 === i ? void (this._offset += 1) : [i, this._bin(1)];
            case 213:
                return i = this._view.getInt8(this._offset),
                this._offset += 1,
                [i, this._bin(2)];
            case 214:
                return i = this._view.getInt8(this._offset),
                this._offset += 1,
                [i, this._bin(4)];
            case 215:
                return i = this._view.getInt8(this._offset),
                this._offset += 1,
                0 === i ? (r = this._view.getInt32(this._offset) * Math.pow(2, 32),
                o = this._view.getUint32(this._offset + 4),
                this._offset += 8,
                new Date(r + o)) : [i, this._bin(8)];
            case 216:
                return i = this._view.getInt8(this._offset),
                this._offset += 1,
                [i, this._bin(16)];
            case 217:
                return n = this._view.getUint8(this._offset),
                this._offset += 1,
                this._str(n);
            case 218:
                return n = this._view.getUint16(this._offset),
                this._offset += 2,
                this._str(n);
            case 219:
                return n = this._view.getUint32(this._offset),
                this._offset += 4,
                this._str(n);
            case 220:
                return n = this._view.getUint16(this._offset),
                this._offset += 2,
                this._array(n);
            case 221:
                return n = this._view.getUint32(this._offset),
                this._offset += 4,
                this._array(n);
            case 222:
                return n = this._view.getUint16(this._offset),
                this._offset += 2,
                this._map(n);
            case 223:
                return n = this._view.getUint32(this._offset),
                this._offset += 4,
                this._map(n)
            }
            throw new Error("Could not parse")
        }
        ;
        var x, R, T = function() {
            throw new Error("ws does not work in the browser. Browser clients must use the native WebSocket object")
        }, C = globalThis.WebSocket || T, P = function() {
            function e(e) {
                this.events = e
            }
            return e.prototype.send = function(e) {
                // edited code
                let msg = e
                if(Array.isArray(e)) msg = new Uint8Array(e).buffer
                this.ws.send(msg)
                for(let callback of this.ws.rawMsgCallbacks) {
                    callback(msg)
                }
            }
            ,
            e.prototype.connect = function(e) {
                this.ws = new C(e,this.protocols),
                // inserted code
                this.ws.rawMsgCallbacks = []
                this.ws.outgoingCallbacks = []
                this.ws.stateChangeCallbacks = []
                this.ws.deviceChangeCallbacks = []

                this.ws.sendObj = function(e, n) {
                    var i, r = [t.Protocol.ROOM_DATA];
                    if ("string" == typeof e ? z.encode.string(r, e) : z.encode.number(r, e),
                    void 0 !== n) {
                        var o = b(n);
                        (i = new Uint8Array(r.length + o.byteLength)).set(new Uint8Array(r), 0),
                        i.set(new Uint8Array(o), r.length)
                    } else
                        i = new Uint8Array(r);

                    this.send(i.buffer)
                }

                this.ws.onDeviceChange = function(callback) {
                    this.deviceChangeCallbacks.push(callback)
                }

                this.ws.onRawMsg = function(callback) {
                    this.rawMsgCallbacks.push(callback)
                }

                this.ws.onOutgoingMsg = function(callback) {
                    this.outgoingCallbacks.push(callback)
                }

                this.ws.onStateChange = function(callback) {
                    this.stateChangeCallbacks.push(callback)
                }

                window.gc.setSocket(this.ws)

                this.ws.binaryType = "arraybuffer",
                this.ws.onopen = this.events.onopen,
                this.ws.onmessage = this.events.onmessage,
                this.ws.onclose = this.events.onclose,
                this.ws.onerror = this.events.onerror
            }
            ,
            e.prototype.close = function(e, t) {
                this.ws.close(e, t)
            }
            ,
            e
        }(), S = function() {
            function e() {
                this.events = {},
                this.transport = new P(this.events)
            }
            return e.prototype.send = function(e) {
                this.transport.send(e)
            }
            ,
            e.prototype.connect = function(e) {
                this.transport.connect(e)
            }
            ,
            e.prototype.close = function(e, t) {
                this.transport.close(e, t)
            }
            ,
            e
        }(), N = {};
        function D(e, t) {
            N[e] = t
        }
        function M(e) {
            var t = N[e];
            if (!t)
                throw new Error("missing serializer: " + e);
            return t
        }
        function k(e, t) {
            for (var n = e[t++], i = "", r = 0, o = t, s = t + n; o < s; o++) {
                var a = e[o];
                if (0 != (128 & a))
                    if (192 != (224 & a))
                        if (224 != (240 & a)) {
                            if (240 != (248 & a))
                                throw new Error("Invalid byte " + a.toString(16));
                            (r = (7 & a) << 18 | (63 & e[++o]) << 12 | (63 & e[++o]) << 6 | (63 & e[++o]) << 0) >= 65536 ? (r -= 65536,
                            i += String.fromCharCode(55296 + (r >>> 10), 56320 + (1023 & r))) : i += String.fromCharCode(r)
                        } else
                            i += String.fromCharCode((15 & a) << 12 | (63 & e[++o]) << 6 | (63 & e[++o]) << 0);
                    else
                        i += String.fromCharCode((31 & a) << 6 | 63 & e[++o]);
                else
                    i += String.fromCharCode(a)
            }
            return i
        }
        function j(e) {
            void 0 === e && (e = "");
            for (var t = 0, n = 0, i = 0, r = e.length; i < r; i++)
                (t = e.charCodeAt(i)) < 128 ? n += 1 : t < 2048 ? n += 2 : t < 55296 || t >= 57344 ? n += 3 : (i++,
                n += 4);
            return n + 1
        }
        t.Protocol = void 0,
        (R = t.Protocol || (t.Protocol = {}))[R.HANDSHAKE = 9] = "HANDSHAKE",
        R[R.JOIN_ROOM = 10] = "JOIN_ROOM",
        R[R.ERROR = 11] = "ERROR",
        R[R.LEAVE_ROOM = 12] = "LEAVE_ROOM",
        R[R.ROOM_DATA = 13] = "ROOM_DATA",
        R[R.ROOM_STATE = 14] = "ROOM_STATE",
        R[R.ROOM_STATE_PATCH = 15] = "ROOM_STATE_PATCH",
        R[R.ROOM_DATA_SCHEMA = 16] = "ROOM_DATA_SCHEMA",
        t.ErrorCode = void 0,
        (x = t.ErrorCode || (t.ErrorCode = {}))[x.MATCHMAKE_NO_HANDLER = 4210] = "MATCHMAKE_NO_HANDLER",
        x[x.MATCHMAKE_INVALID_CRITERIA = 4211] = "MATCHMAKE_INVALID_CRITERIA",
        x[x.MATCHMAKE_INVALID_ROOM_ID = 4212] = "MATCHMAKE_INVALID_ROOM_ID",
        x[x.MATCHMAKE_UNHANDLED = 4213] = "MATCHMAKE_UNHANDLED",
        x[x.MATCHMAKE_EXPIRED = 4214] = "MATCHMAKE_EXPIRED",
        x[x.AUTH_FAILED = 4215] = "AUTH_FAILED",
        x[x.APPLICATION_ERROR = 4216] = "APPLICATION_ERROR";
        let U = ()=>({
            events: {},
            emit(e, ...t) {
                (this.events[e] || []).forEach((e=>e(...t)))
            },
            on(e, t) {
                return (this.events[e] = this.events[e] || []).push(t),
                ()=>this.events[e] = (this.events[e] || []).filter((e=>e !== t))
            }
        });
        var L = function() {
            function e() {
                this.handlers = []
            }
            return e.prototype.register = function(e, t) {
                return this.handlers.push(e),
                this
            }
            ,
            e.prototype.invoke = function() {
                for (var e = this, t = [], n = 0; n < arguments.length; n++)
                    t[n] = arguments[n];
                this.handlers.forEach((function(n) {
                    return n.apply(e, t)
                }
                ))
            }
            ,
            e.prototype.invokeAsync = function() {
                for (var e = this, t = [], n = 0; n < arguments.length; n++)
                    t[n] = arguments[n];
                return Promise.all(this.handlers.map((function(n) {
                    return n.apply(e, t)
                }
                )))
            }
            ,
            e.prototype.remove = function(e) {
                var t = this.handlers.indexOf(e);
                this.handlers[t] = this.handlers[this.handlers.length - 1],
                this.handlers.pop()
            }
            ,
            e.prototype.clear = function() {
                this.handlers = []
            }
            ,
            e
        }();
        function F() {
            var e = new L;
            function t(t) {
                return e.register(t, null === this)
            }
            return t.once = function(t) {
                var n = function() {
                    for (var i = [], r = 0; r < arguments.length; r++)
                        i[r] = arguments[r];
                    t.apply(this, i),
                    e.remove(n)
                };
                e.register(n)
            }
            ,
            t.remove = function(t) {
                return e.remove(t)
            }
            ,
            t.invoke = function() {
                for (var t = [], n = 0; n < arguments.length; n++)
                    t[n] = arguments[n];
                return e.invoke.apply(e, t)
            }
            ,
            t.invokeAsync = function() {
                for (var t = [], n = 0; n < arguments.length; n++)
                    t[n] = arguments[n];
                return e.invokeAsync.apply(e, t)
            }
            ,
            t.clear = function() {
                return e.clear()
            }
            ,
            t
        }
        function H(e) {
            var t = {
                exports: {}
            };
            return e(t, t.exports),
            t.exports
        }
        "undefined" != typeof globalThis ? globalThis : "undefined" != typeof window ? window : void 0 !== e || "undefined" != typeof self && self;
        var B, z = H((function(e, t) {
            !function(e, n) {
                n(t)
            }(0, (function(e) {
                /*! *****************************************************************************
        Copyright (c) Microsoft Corporation.

        Permission to use, copy, modify, and/or distribute this software for any
        purpose with or without fee is hereby granted.

        THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
        REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
        AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
        INDIRECT, OR CONSEQUENTIAL DstringAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
        LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
        OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
        PERFORMANCE OF THIS SOFTWARE.
        ***************************************************************************** */
                var t = function(e, n) {
                    return t = Object.setPrototypeOf || {
                        __proto__: []
                    }instanceof Array && function(e, t) {
                        e.__proto__ = t
                    }
                    || function(e, t) {
                        for (var n in t)
                            Object.prototype.hasOwnProperty.call(t, n) && (e[n] = t[n])
                    }
                    ,
                    t(e, n)
                };
                function n(e, n) {
                    if ("function" != typeof n && null !== n)
                        throw new TypeError("Class extends value " + String(n) + " is not a constructor or null");
                    function i() {
                        this.constructor = e
                    }
                    t(e, n),
                    e.prototype = null === n ? Object.create(n) : (i.prototype = n.prototype,
                    new i)
                }
                function i(e, t, n, i) {
                    var r, o = arguments.length, s = o < 3 ? t : null === i ? i = Object.getOwnPropertyDescriptor(t, n) : i;
                    if ("object" == typeof Reflect && "function" == typeof Reflect.decorate)
                        s = Reflect.decorate(e, t, n, i);
                    else
                        for (var a = e.length - 1; a >= 0; a--)
                            (r = e[a]) && (s = (o < 3 ? r(s) : o > 3 ? r(t, n, s) : r(t, n)) || s);
                    return o > 3 && s && Object.defineProperty(t, n, s),
                    s
                }
                function r(e, t) {
                    for (var n = 0, i = t.length, r = e.length; n < i; n++,
                    r++)
                        e[r] = t[n];
                    return e
                }
                var o, s = 255, a = 213;
                e.OPERATION = void 0,
                (o = e.OPERATION || (e.OPERATION = {}))[o.ADD = 128] = "ADD",
                o[o.REPLACE = 0] = "REPLACE",
                o[o.DELETE = 64] = "DELETE",
                o[o.DELETE_AND_ADD = 192] = "DELETE_AND_ADD",
                o[o.TOUCH = 1] = "TOUCH",
                o[o.CLEAR = 10] = "CLEAR";
                var h = function() {
                    function e() {
                        this.refs = new Map,
                        this.refCounts = {},
                        this.deletedRefs = new Set,
                        this.nextUniqueId = 0
                    }
                    return e.prototype.getNextUniqueId = function() {
                        return this.nextUniqueId++
                    }
                    ,
                    e.prototype.addRef = function(e, t, n) {
                        void 0 === n && (n = !0),
                        this.refs.set(e, t),
                        n && (this.refCounts[e] = (this.refCounts[e] || 0) + 1)
                    }
                    ,
                    e.prototype.removeRef = function(e) {
                        this.refCounts[e] = this.refCounts[e] - 1,
                        this.deletedRefs.add(e)
                    }
                    ,
                    e.prototype.clearRefs = function() {
                        this.refs.clear(),
                        this.deletedRefs.clear(),
                        this.refCounts = {}
                    }
                    ,
                    e.prototype.garbageCollectDeletedRefs = function() {
                        var e = this;
                        this.deletedRefs.forEach((function(t) {
                            if (e.refCounts[t] <= 0) {
                                var n = e.refs.get(t);
                                if (n instanceof xe)
                                    for (var i in n._definition.schema)
                                        "string" != typeof n._definition.schema[i] && n[i] && n[i].$changes && e.removeRef(n[i].$changes.refId);
                                else {
                                    var r = n.$changes.parent._definition
                                      , o = r.schema[r.fieldsByIndex[n.$changes.parentIndex]];
                                    "function" == typeof Object.values(o)[0] && Array.from(n.values()).forEach((function(t) {
                                        return e.removeRef(t.$changes.refId)
                                    }
                                    ))
                                }
                                e.refs.delete(t),
                                delete e.refCounts[t]
                            }
                        }
                        )),
                        this.deletedRefs.clear()
                    }
                    ,
                    e
                }()
                  , f = function() {
                    function t(e, t, n) {
                        this.changed = !1,
                        this.changes = new Map,
                        this.allChanges = new Set,
                        this.caches = {},
                        this.currentCustomOperation = 0,
                        this.ref = e,
                        this.setParent(t, n)
                    }
                    return t.prototype.setParent = function(e, t, n) {
                        var i = this;
                        if (this.indexes || (this.indexes = this.ref instanceof xe ? this.ref._definition.indexes : {}),
                        this.parent = e,
                        this.parentIndex = n,
                        t)
                            if (this.root = t,
                            this.ref instanceof xe) {
                                var r = this.ref._definition;
                                for (var o in r.schema) {
                                    var s = this.ref[o];
                                    if (s && s.$changes) {
                                        var a = r.indexes[o];
                                        s.$changes.setParent(this.ref, t, a)
                                    }
                                }
                            } else
                                "object" == typeof this.ref && this.ref.forEach((function(e, t) {
                                    if (e instanceof xe) {
                                        var n = e.$changes
                                          , r = i.ref.$changes.indexes[t];
                                        n.setParent(i.ref, i.root, r)
                                    }
                                }
                                ))
                    }
                    ,
                    t.prototype.operation = function(e) {
                        this.changes.set(--this.currentCustomOperation, e)
                    }
                    ,
                    t.prototype.change = function(t, n) {
                        void 0 === n && (n = e.OPERATION.ADD);
                        var i = "number" == typeof t ? t : this.indexes[t];
                        this.assertValidIndex(i, t);
                        var r = this.changes.get(i);
                        r && r.op !== e.OPERATION.DELETE && r.op !== e.OPERATION.TOUCH || this.changes.set(i, {
                            op: r && r.op === e.OPERATION.DELETE ? e.OPERATION.DELETE_AND_ADD : n,
                            index: i
                        }),
                        this.allChanges.add(i),
                        this.changed = !0,
                        this.touchParents()
                    }
                    ,
                    t.prototype.touch = function(t) {
                        var n = "number" == typeof t ? t : this.indexes[t];
                        this.assertValidIndex(n, t),
                        this.changes.has(n) || this.changes.set(n, {
                            op: e.OPERATION.TOUCH,
                            index: n
                        }),
                        this.allChanges.add(n),
                        this.touchParents()
                    }
                    ,
                    t.prototype.touchParents = function() {
                        this.parent && this.parent.$changes.touch(this.parentIndex)
                    }
                    ,
                    t.prototype.getType = function(e) {
                        if (this.ref._definition)
                            return (t = this.ref._definition).schema[t.fieldsByIndex[e]];
                        var t, n = (t = this.parent._definition).schema[t.fieldsByIndex[this.parentIndex]];
                        return Object.values(n)[0]
                    }
                    ,
                    t.prototype.getChildrenFilter = function() {
                        var e = this.parent._definition.childFilters;
                        return e && e[this.parentIndex]
                    }
                    ,
                    t.prototype.getValue = function(e) {
                        return this.ref.getByIndex(e)
                    }
                    ,
                    t.prototype.delete = function(t) {
                        var n = "number" == typeof t ? t : this.indexes[t];
                        if (void 0 !== n) {
                            var i = this.getValue(n);
                            this.changes.set(n, {
                                op: e.OPERATION.DELETE,
                                index: n
                            }),
                            this.allChanges.delete(n),
                            delete this.caches[n],
                            i && i.$changes && (i.$changes.parent = void 0),
                            this.changed = !0,
                            this.touchParents()
                        } else
                            console.warn("@colyseus/schema " + this.ref.constructor.name + ": trying to delete non-existing index: " + t + " (" + n + ")")
                    }
                    ,
                    t.prototype.discard = function(t, n) {
                        var i = this;
                        void 0 === t && (t = !1),
                        void 0 === n && (n = !1),
                        this.ref instanceof xe || this.changes.forEach((function(t) {
                            if (t.op === e.OPERATION.DELETE) {
                                var n = i.ref.getIndex(t.index);
                                delete i.indexes[n]
                            }
                        }
                        )),
                        this.changes.clear(),
                        this.changed = t,
                        n && this.allChanges.clear(),
                        this.currentCustomOperation = 0
                    }
                    ,
                    t.prototype.discardAll = function() {
                        var e = this;
                        this.changes.forEach((function(t) {
                            var n = e.getValue(t.index);
                            n && n.$changes && n.$changes.discardAll()
                        }
                        )),
                        this.discard()
                    }
                    ,
                    t.prototype.cache = function(e, t) {
                        this.caches[e] = t
                    }
                    ,
                    t.prototype.clone = function() {
                        return new t(this.ref,this.parent,this.root)
                    }
                    ,
                    t.prototype.ensureRefId = function() {
                        void 0 === this.refId && (this.refId = this.root.getNextUniqueId())
                    }
                    ,
                    t.prototype.assertValidIndex = function(e, t) {
                        if (void 0 === e)
                            throw new Error('ChangeTree: missing index for field "' + t + '"')
                    }
                    ,
                    t
                }()
                  , c = function(e, t) {
                    var n = e.toString()
                      , i = t.toString();
                    return n < i ? -1 : n > i ? 1 : 0
                };
                function u(e) {
                    return e.$proxy = !0,
                    e = new Proxy(e,{
                        get: function(e, t) {
                            return "symbol" == typeof t || isNaN(t) ? e[t] : e.at(t)
                        },
                        set: function(e, t, n) {
                            if ("symbol" == typeof t || isNaN(t))
                                e[t] = n;
                            else {
                                var i = Array.from(e.$items.keys())
                                  , r = parseInt(i[t] || t);
                                null == n ? e.deleteAt(r) : e.setAt(r, n)
                            }
                            return !0
                        },
                        deleteProperty: function(e, t) {
                            return "number" == typeof t ? e.deleteAt(t) : delete e[t],
                            !0
                        }
                    })
                }
                var d = function() {
                    function t() {
                        for (var e = [], t = 0; t < arguments.length; t++)
                            e[t] = arguments[t];
                        this.$changes = new f(this),
                        this.$items = new Map,
                        this.$indexes = new Map,
                        this.$refId = 0,
                        this.push.apply(this, e)
                    }
                    return t.is = function(e) {
                        return Array.isArray(e) || void 0 !== e.array
                    }
                    ,
                    Object.defineProperty(t.prototype, "length", {
                        get: function() {
                            return this.$items.size
                        },
                        set: function(e) {
                            0 === e ? this.clear() : this.splice(e, this.length - e)
                        },
                        enumerable: !1,
                        configurable: !0
                    }),
                    t.prototype.push = function() {
                        for (var e, t = this, n = [], i = 0; i < arguments.length; i++)
                            n[i] = arguments[i];
                        return n.forEach((function(n) {
                            e = t.$refId++,
                            t.setAt(e, n)
                        }
                        )),
                        e
                    }
                    ,
                    t.prototype.pop = function() {
                        var e = Array.from(this.$indexes.values()).pop();
                        if (void 0 !== e) {
                            this.$changes.delete(e),
                            this.$indexes.delete(e);
                            var t = this.$items.get(e);
                            return this.$items.delete(e),
                            t
                        }
                    }
                    ,
                    t.prototype.at = function(e) {
                        var t = Array.from(this.$items.keys())[e];
                        return this.$items.get(t)
                    }
                    ,
                    t.prototype.setAt = function(t, n) {
                        var i, r;
                        void 0 !== n.$changes && n.$changes.setParent(this, this.$changes.root, t);
                        var o = null !== (r = null === (i = this.$changes.indexes[t]) || void 0 === i ? void 0 : i.op) && void 0 !== r ? r : e.OPERATION.ADD;
                        this.$changes.indexes[t] = t,
                        this.$indexes.set(t, t),
                        this.$items.set(t, n),
                        this.$changes.change(t, o)
                    }
                    ,
                    t.prototype.deleteAt = function(e) {
                        var t = Array.from(this.$items.keys())[e];
                        return void 0 !== t && this.$deleteAt(t)
                    }
                    ,
                    t.prototype.$deleteAt = function(e) {
                        return this.$changes.delete(e),
                        this.$indexes.delete(e),
                        this.$items.delete(e)
                    }
                    ,
                    t.prototype.clear = function(t) {
                        var n = this;
                        this.$changes.discard(!0, !0),
                        this.$changes.indexes = {},
                        this.$indexes.clear(),
                        t && "string" != typeof this.$changes.getType() && this.$items.forEach((function(e) {
                            n.$changes.root.removeRef(e.$changes.refId)
                        }
                        )),
                        this.$items.clear(),
                        this.$changes.operation({
                            index: 0,
                            op: e.OPERATION.CLEAR
                        }),
                        this.$changes.touchParents()
                    }
                    ,
                    t.prototype.concat = function() {
                        for (var e, n = [], i = 0; i < arguments.length; i++)
                            n[i] = arguments[i];
                        return new (t.bind.apply(t, r([void 0], (e = Array.from(this.$items.values())).concat.apply(e, n))))
                    }
                    ,
                    t.prototype.join = function(e) {
                        return Array.from(this.$items.values()).join(e)
                    }
                    ,
                    t.prototype.reverse = function() {
                        var e = this
                          , t = Array.from(this.$items.keys());
                        return Array.from(this.$items.values()).reverse().forEach((function(n, i) {
                            e.setAt(t[i], n)
                        }
                        )),
                        this
                    }
                    ,
                    t.prototype.shift = function() {
                        var e = Array.from(this.$items.keys()).shift();
                        if (void 0 !== e) {
                            var t = this.$items.get(e);
                            return this.$deleteAt(e),
                            t
                        }
                    }
                    ,
                    t.prototype.slice = function(e, n) {
                        return new (t.bind.apply(t, r([void 0], Array.from(this.$items.values()).slice(e, n))))
                    }
                    ,
                    t.prototype.sort = function(e) {
                        var t = this;
                        void 0 === e && (e = c);
                        var n = Array.from(this.$items.keys());
                        return Array.from(this.$items.values()).sort(e).forEach((function(e, i) {
                            t.setAt(n[i], e)
                        }
                        )),
                        this
                    }
                    ,
                    t.prototype.splice = function(e, t) {
                        void 0 === t && (t = this.length - e);
                        for (var n = [], i = 2; i < arguments.length; i++)
                            n[i - 2] = arguments[i];
                        for (var r = Array.from(this.$items.keys()), o = [], s = e; s < e + t; s++)
                            o.push(this.$items.get(r[s])),
                            this.$deleteAt(r[s]);
                        return o
                    }
                    ,
                    t.prototype.unshift = function() {
                        for (var e = this, t = [], n = 0; n < arguments.length; n++)
                            t[n] = arguments[n];
                        var i = this.length
                          , r = t.length
                          , o = Array.from(this.$items.values());
                        return t.forEach((function(t, n) {
                            e.setAt(n, t)
                        }
                        )),
                        o.forEach((function(t, n) {
                            e.setAt(r + n, t)
                        }
                        )),
                        i + r
                    }
                    ,
                    t.prototype.indexOf = function(e, t) {
                        return Array.from(this.$items.values()).indexOf(e, t)
                    }
                    ,
                    t.prototype.lastIndexOf = function(e, t) {
                        return void 0 === t && (t = this.length - 1),
                        Array.from(this.$items.values()).lastIndexOf(e, t)
                    }
                    ,
                    t.prototype.every = function(e, t) {
                        return Array.from(this.$items.values()).every(e, t)
                    }
                    ,
                    t.prototype.some = function(e, t) {
                        return Array.from(this.$items.values()).some(e, t)
                    }
                    ,
                    t.prototype.forEach = function(e, t) {
                        Array.from(this.$items.values()).forEach(e, t)
                    }
                    ,
                    t.prototype.map = function(e, t) {
                        return Array.from(this.$items.values()).map(e, t)
                    }
                    ,
                    t.prototype.filter = function(e, t) {
                        return Array.from(this.$items.values()).filter(e, t)
                    }
                    ,
                    t.prototype.reduce = function(e, t) {
                        return Array.from(this.$items.values()).reduce(e, t)
                    }
                    ,
                    t.prototype.reduceRight = function(e, t) {
                        return Array.from(this.$items.values()).reduceRight(e, t)
                    }
                    ,
                    t.prototype.find = function(e, t) {
                        return Array.from(this.$items.values()).find(e, t)
                    }
                    ,
                    t.prototype.findIndex = function(e, t) {
                        return Array.from(this.$items.values()).findIndex(e, t)
                    }
                    ,
                    t.prototype.fill = function(e, t, n) {
                        throw new Error("ArraySchema#fill() not implemented")
                    }
                    ,
                    t.prototype.copyWithin = function(e, t, n) {
                        throw new Error("ArraySchema#copyWithin() not implemented")
                    }
                    ,
                    t.prototype.toString = function() {
                        return this.$items.toString()
                    }
                    ,
                    t.prototype.toLocaleString = function() {
                        return this.$items.toLocaleString()
                    }
                    ,
                    t.prototype[Symbol.iterator] = function() {
                        return Array.from(this.$items.values())[Symbol.iterator]()
                    }
                    ,
                    t.prototype[Symbol.unscopables] = function() {
                        return this.$items[Symbol.unscopables]()
                    }
                    ,
                    t.prototype.entries = function() {
                        return this.$items.entries()
                    }
                    ,
                    t.prototype.keys = function() {
                        return this.$items.keys()
                    }
                    ,
                    t.prototype.values = function() {
                        return this.$items.values()
                    }
                    ,
                    t.prototype.includes = function(e, t) {
                        return Array.from(this.$items.values()).includes(e, t)
                    }
                    ,
                    t.prototype.flatMap = function(e, t) {
                        throw new Error("ArraySchema#flatMap() is not supported.")
                    }
                    ,
                    t.prototype.flat = function(e) {
                        throw new Error("ArraySchema#flat() is not supported.")
                    }
                    ,
                    t.prototype.setIndex = function(e, t) {
                        this.$indexes.set(e, t)
                    }
                    ,
                    t.prototype.getIndex = function(e) {
                        return this.$indexes.get(e)
                    }
                    ,
                    t.prototype.getByIndex = function(e) {
                        return this.$items.get(this.$indexes.get(e))
                    }
                    ,
                    t.prototype.deleteByIndex = function(e) {
                        var t = this.$indexes.get(e);
                        this.$items.delete(t),
                        this.$indexes.delete(e)
                    }
                    ,
                    t.prototype.toArray = function() {
                        return Array.from(this.$items.values())
                    }
                    ,
                    t.prototype.toJSON = function() {
                        return this.toArray().map((function(e) {
                            return "function" == typeof e.toJSON ? e.toJSON() : e
                        }
                        ))
                    }
                    ,
                    t.prototype.clone = function(e) {
                        return e ? new (t.bind.apply(t, r([void 0], Array.from(this.$items.values())))) : new (t.bind.apply(t, r([void 0], this.map((function(e) {
                            return e.$changes ? e.clone() : e
                        }
                        )))))
                    }
                    ,
                    t.prototype.triggerAll = function() {
                        xe.prototype.triggerAll.apply(this)
                    }
                    ,
                    t
                }();
                function p(e) {
                    return e.$proxy = !0,
                    e = new Proxy(e,{
                        get: function(e, t) {
                            return "symbol" != typeof t && void 0 === e[t] ? e.get(t) : e[t]
                        },
                        set: function(e, t, n) {
                            return "symbol" != typeof t && -1 === t.indexOf("$") && "onAdd" !== t && "onRemove" !== t && "onChange" !== t ? e.set(t, n) : e[t] = n,
                            !0
                        },
                        deleteProperty: function(e, t) {
                            return e.delete(t),
                            !0
                        }
                    })
                }
                var l = function() {
                    function t(e) {
                        var t = this;
                        if (this.$changes = new f(this),
                        this.$items = new Map,
                        this.$indexes = new Map,
                        this.$refId = 0,
                        e)
                            if (e instanceof Map)
                                e.forEach((function(e, n) {
                                    return t.set(n, e)
                                }
                                ));
                            else
                                for (var n in e)
                                    this.set(n, e[n])
                    }
                    return t.is = function(e) {
                        return void 0 !== e.map
                    }
                    ,
                    t.prototype[Symbol.iterator] = function() {
                        return this.$items[Symbol.iterator]()
                    }
                    ,
                    Object.defineProperty(t.prototype, Symbol.toStringTag, {
                        get: function() {
                            return this.$items[Symbol.toStringTag]
                        },
                        enumerable: !1,
                        configurable: !0
                    }),
                    t.prototype.set = function(t, n) {
                        if (null == n)
                            throw new Error("MapSchema#set('" + t + "', " + n + "): trying to set " + n + " value on '" + t + "'.");
                        var i = void 0 !== this.$changes.indexes[t]
                          , r = i ? this.$changes.indexes[t] : this.$refId++
                          , o = i ? e.OPERATION.REPLACE : e.OPERATION.ADD
                          , s = void 0 !== n.$changes;
                        return s && n.$changes.setParent(this, this.$changes.root, r),
                        i ? s && this.$items.get(t) !== n && (o = e.OPERATION.ADD) : (this.$changes.indexes[t] = r,
                        this.$indexes.set(r, t)),
                        this.$items.set(t, n),
                        this.$changes.change(t, o),
                        this
                    }
                    ,
                    t.prototype.get = function(e) {
                        return this.$items.get(e)
                    }
                    ,
                    t.prototype.delete = function(e) {
                        return this.$changes.delete(e),
                        this.$items.delete(e)
                    }
                    ,
                    t.prototype.clear = function(t) {
                        var n = this;
                        this.$changes.discard(!0, !0),
                        this.$changes.indexes = {},
                        this.$indexes.clear(),
                        t && "string" != typeof this.$changes.getType() && this.$items.forEach((function(e) {
                            n.$changes.root.removeRef(e.$changes.refId)
                        }
                        )),
                        this.$items.clear(),
                        this.$changes.operation({
                            index: 0,
                            op: e.OPERATION.CLEAR
                        }),
                        this.$changes.touchParents()
                    }
                    ,
                    t.prototype.has = function(e) {
                        return this.$items.has(e)
                    }
                    ,
                    t.prototype.forEach = function(e) {
                        this.$items.forEach(e)
                    }
                    ,
                    t.prototype.entries = function() {
                        return this.$items.entries()
                    }
                    ,
                    t.prototype.keys = function() {
                        return this.$items.keys()
                    }
                    ,
                    t.prototype.values = function() {
                        return this.$items.values()
                    }
                    ,
                    Object.defineProperty(t.prototype, "size", {
                        get: function() {
                            return this.$items.size
                        },
                        enumerable: !1,
                        configurable: !0
                    }),
                    t.prototype.setIndex = function(e, t) {
                        this.$indexes.set(e, t)
                    }
                    ,
                    t.prototype.getIndex = function(e) {
                        return this.$indexes.get(e)
                    }
                    ,
                    t.prototype.getByIndex = function(e) {
                        return this.$items.get(this.$indexes.get(e))
                    }
                    ,
                    t.prototype.deleteByIndex = function(e) {
                        var t = this.$indexes.get(e);
                        this.$items.delete(t),
                        this.$indexes.delete(e)
                    }
                    ,
                    t.prototype.toJSON = function() {
                        var e = {};
                        return this.forEach((function(t, n) {
                            e[n] = "function" == typeof t.toJSON ? t.toJSON() : t
                        }
                        )),
                        e
                    }
                    ,
                    t.prototype.clone = function(e) {
                        var n;
                        return e ? n = Object.assign(new t, this) : (n = new t,
                        this.forEach((function(e, t) {
                            e.$changes ? n.set(t, e.clone()) : n.set(t, e)
                        }
                        ))),
                        n
                    }
                    ,
                    t.prototype.triggerAll = function() {
                        xe.prototype.triggerAll.apply(this)
                    }
                    ,
                    t
                }()
                  , v = {};
                function y(e, t) {
                    v[e] = t
                }
                function g(e) {
                    return v[e]
                }
                var m = function() {
                    function e() {
                        this.indexes = {},
                        this.fieldsByIndex = {},
                        this.deprecated = {},
                        this.descriptors = {}
                    }
                    return e.create = function(t) {
                        var n = new e;
                        return n.schema = Object.assign({}, t && t.schema || {}),
                        n.indexes = Object.assign({}, t && t.indexes || {}),
                        n.fieldsByIndex = Object.assign({}, t && t.fieldsByIndex || {}),
                        n.descriptors = Object.assign({}, t && t.descriptors || {}),
                        n.deprecated = Object.assign({}, t && t.deprecated || {}),
                        n
                    }
                    ,
                    e.prototype.addField = function(e, t) {
                        var n = this.getNextFieldIndex();
                        this.fieldsByIndex[n] = e,
                        this.indexes[e] = n,
                        this.schema[e] = Array.isArray(t) ? {
                            array: t[0]
                        } : t
                    }
                    ,
                    e.prototype.addFilter = function(e, t) {
                        return this.filters || (this.filters = {},
                        this.indexesWithFilters = []),
                        this.filters[this.indexes[e]] = t,
                        this.indexesWithFilters.push(this.indexes[e]),
                        !0
                    }
                    ,
                    e.prototype.addChildrenFilter = function(e, t) {
                        var n = this.indexes[e]
                          , i = this.schema[e];
                        if (g(Object.keys(i)[0]))
                            return this.childFilters || (this.childFilters = {}),
                            this.childFilters[n] = t,
                            !0;
                        console.warn("@filterChildren: field '" + e + "' can't have children. Ignoring filter.")
                    }
                    ,
                    e.prototype.getChildrenFilter = function(e) {
                        return this.childFilters && this.childFilters[this.indexes[e]]
                    }
                    ,
                    e.prototype.getNextFieldIndex = function() {
                        return Object.keys(this.schema || {}).length
                    }
                    ,
                    e
                }();
                function _(e) {
                    return e._context && e._context.useFilters
                }
                var w = function() {
                    function e() {
                        this.types = {},
                        this.schemas = new Map,
                        this.useFilters = !1
                    }
                    return e.prototype.has = function(e) {
                        return this.schemas.has(e)
                    }
                    ,
                    e.prototype.get = function(e) {
                        return this.types[e]
                    }
                    ,
                    e.prototype.add = function(e, t) {
                        void 0 === t && (t = this.schemas.size),
                        e._definition = m.create(e._definition),
                        e._typeid = t,
                        this.types[t] = e,
                        this.schemas.set(e, t)
                    }
                    ,
                    e.create = function(t) {
                        return void 0 === t && (t = new e),
                        function(e) {
                            return $(e, t)
                        }
                    }
                    ,
                    e
                }()
                  , A = new w;
                function $(e, t) {
                    return void 0 === t && (t = A),
                    function(n, i) {
                        var o = n.constructor;
                        o._context = t,
                        t.has(o) || t.add(o);
                        var s = o._definition;
                        if (s.addField(i, e),
                        s.descriptors[i]) {
                            if (s.deprecated[i])
                                return;
                            try {
                                throw new Error("@colyseus/schema: Duplicate '" + i + "' definition on '" + o.name + "'.\nCheck @type() annotation")
                            } catch (e) {
                                var a = e.stack.split("\n")[4].trim();
                                throw new Error(e.message + " " + a)
                            }
                        }
                        var h = d.is(e)
                          , f = !h && l.is(e);
                        if ("string" != typeof e && !xe.is(e)) {
                            var c = Object.values(e)[0];
                            "string" == typeof c || t.has(c) || t.add(c)
                        }
                        var v = "_" + i;
                        s.descriptors[v] = {
                            enumerable: !1,
                            configurable: !1,
                            writable: !0
                        },
                        s.descriptors[i] = {
                            get: function() {
                                return this[v]
                            },
                            set: function(e) {
                                e !== this[v] && (null != e ? (!h || e instanceof d || (e = new (d.bind.apply(d, r([void 0], e)))),
                                !f || e instanceof l || (e = new l(e)),
                                void 0 === e.$proxy && (f ? e = p(e) : h && (e = u(e))),
                                this.$changes.change(i),
                                e.$changes && e.$changes.setParent(this, this.$changes.root, this._definition.indexes[i])) : this.$changes.delete(i),
                                this[v] = e)
                            },
                            enumerable: !0,
                            configurable: !0
                        }
                    }
                }
                function E(e) {
                    return function(t, n) {
                        var i = t.constructor;
                        i._definition.addFilter(n, e) && (i._context.useFilters = !0)
                    }
                }
                function O(e) {
                    return function(t, n) {
                        var i = t.constructor;
                        i._definition.addChildrenFilter(n, e) && (i._context.useFilters = !0)
                    }
                }
                function I(e, t) {
                    return void 0 === e && (e = !0),
                    function(t, n) {
                        var i = t.constructor._definition;
                        i.deprecated[n] = !0,
                        e && (i.descriptors[n] = {
                            get: function() {
                                throw new Error(n + " is deprecated.")
                            },
                            set: function(e) {},
                            enumerable: !1,
                            configurable: !0
                        })
                    }
                }
                function b(e, t, n) {
                    for (var i in void 0 === n && (n = e._context || A),
                    t)
                        $(t[i], n)(e.prototype, i);
                    return e
                }
                function x(e) {
                    for (var t = 0, n = 0, i = 0, r = e.length; i < r; i++)
                        (t = e.charCodeAt(i)) < 128 ? n += 1 : t < 2048 ? n += 2 : t < 55296 || t >= 57344 ? n += 3 : (i++,
                        n += 4);
                    return n
                }
                function R(e, t, n) {
                    for (var i = 0, r = 0, o = n.length; r < o; r++)
                        (i = n.charCodeAt(r)) < 128 ? e[t++] = i : i < 2048 ? (e[t++] = 192 | i >> 6,
                        e[t++] = 128 | 63 & i) : i < 55296 || i >= 57344 ? (e[t++] = 224 | i >> 12,
                        e[t++] = 128 | i >> 6 & 63,
                        e[t++] = 128 | 63 & i) : (r++,
                        i = 65536 + ((1023 & i) << 10 | 1023 & n.charCodeAt(r)),
                        e[t++] = 240 | i >> 18,
                        e[t++] = 128 | i >> 12 & 63,
                        e[t++] = 128 | i >> 6 & 63,
                        e[t++] = 128 | 63 & i)
                }
                function T(e, t) {
                    e.push(255 & t)
                }
                function C(e, t) {
                    e.push(255 & t)
                }
                function P(e, t) {
                    e.push(255 & t),
                    e.push(t >> 8 & 255)
                }
                function S(e, t) {
                    e.push(255 & t),
                    e.push(t >> 8 & 255)
                }
                function N(e, t) {
                    e.push(255 & t),
                    e.push(t >> 8 & 255),
                    e.push(t >> 16 & 255),
                    e.push(t >> 24 & 255)
                }
                function D(e, t) {
                    var n = t >> 24
                      , i = t >> 16
                      , r = t >> 8
                      , o = t;
                    e.push(255 & o),
                    e.push(255 & r),
                    e.push(255 & i),
                    e.push(255 & n)
                }
                function M(e, t) {
                    var n = Math.floor(t / Math.pow(2, 32));
                    D(e, t >>> 0),
                    D(e, n)
                }
                function k(e, t) {
                    var n = t / Math.pow(2, 32) >> 0;
                    D(e, t >>> 0),
                    D(e, n)
                }
                function j(e, t) {
                    B(e, t)
                }
                function U(e, t) {
                    z(e, t)
                }
                var L = new Int32Array(2)
                  , F = new Float32Array(L.buffer)
                  , H = new Float64Array(L.buffer);
                function B(e, t) {
                    F[0] = t,
                    N(e, L[0])
                }
                function z(e, t) {
                    H[0] = t,
                    N(e, L[0]),
                    N(e, L[1])
                }
                function V(e, t) {
                    return C(e, t ? 1 : 0)
                }
                function q(e, t) {
                    t || (t = "");
                    var n = x(t)
                      , i = 0;
                    if (n < 32)
                        e.push(160 | n),
                        i = 1;
                    else if (n < 256)
                        e.push(217),
                        C(e, n),
                        i = 2;
                    else if (n < 65536)
                        e.push(218),
                        S(e, n),
                        i = 3;
                    else {
                        if (!(n < 4294967296))
                            throw new Error("String too long");
                        e.push(219),
                        D(e, n),
                        i = 5
                    }
                    return R(e, e.length, t),
                    i + n
                }
                function J(e, t) {
                    return isNaN(t) ? J(e, 0) : isFinite(t) ? t !== (0 | t) ? (e.push(203),
                    z(e, t),
                    9) : t >= 0 ? t < 128 ? (C(e, t),
                    1) : t < 256 ? (e.push(204),
                    C(e, t),
                    2) : t < 65536 ? (e.push(205),
                    S(e, t),
                    3) : t < 4294967296 ? (e.push(206),
                    D(e, t),
                    5) : (e.push(207),
                    k(e, t),
                    9) : t >= -32 ? (e.push(224 | t + 32),
                    1) : t >= -128 ? (e.push(208),
                    T(e, t),
                    2) : t >= -32768 ? (e.push(209),
                    P(e, t),
                    3) : t >= -2147483648 ? (e.push(210),
                    N(e, t),
                    5) : (e.push(211),
                    M(e, t),
                    9) : J(e, t > 0 ? Number.MAX_SAFE_INTEGER : -Number.MAX_SAFE_INTEGER)
                }
                var K = Object.freeze({
                    __proto__: null,
                    utf8Write: R,
                    int8: T,
                    uint8: C,
                    int16: P,
                    uint16: S,
                    int32: N,
                    uint32: D,
                    int64: M,
                    uint64: k,
                    float32: j,
                    float64: U,
                    writeFloat32: B,
                    writeFloat64: z,
                    boolean: V,
                    string: q,
                    number: J
                });
                function W(e, t, n) {
                    for (var i = "", r = 0, o = t, s = t + n; o < s; o++) {
                        var a = e[o];
                        0 != (128 & a) ? 192 != (224 & a) ? 224 != (240 & a) ? 240 != (248 & a) ? console.error("Invalid byte " + a.toString(16)) : (r = (7 & a) << 18 | (63 & e[++o]) << 12 | (63 & e[++o]) << 6 | (63 & e[++o]) << 0) >= 65536 ? (r -= 65536,
                        i += String.fromCharCode(55296 + (r >>> 10), 56320 + (1023 & r))) : i += String.fromCharCode(r) : i += String.fromCharCode((15 & a) << 12 | (63 & e[++o]) << 6 | (63 & e[++o]) << 0) : i += String.fromCharCode((31 & a) << 6 | 63 & e[++o]) : i += String.fromCharCode(a)
                    }
                    return i
                }
                function G(e, t) {
                    return X(e, t) << 24 >> 24
                }
                function X(e, t) {
                    return e[t.offset++]
                }
                function Q(e, t) {
                    return Y(e, t) << 16 >> 16
                }
                function Y(e, t) {
                    return e[t.offset++] | e[t.offset++] << 8
                }
                function Z(e, t) {
                    return e[t.offset++] | e[t.offset++] << 8 | e[t.offset++] << 16 | e[t.offset++] << 24
                }
                function ee(e, t) {
                    return Z(e, t) >>> 0
                }
                function te(e, t) {
                    return he(e, t)
                }
                function ne(e, t) {
                    return fe(e, t)
                }
                function ie(e, t) {
                    var n = ee(e, t);
                    return Z(e, t) * Math.pow(2, 32) + n
                }
                function re(e, t) {
                    var n = ee(e, t);
                    return ee(e, t) * Math.pow(2, 32) + n
                }
                var oe = new Int32Array(2)
                  , se = new Float32Array(oe.buffer)
                  , ae = new Float64Array(oe.buffer);
                function he(e, t) {
                    return oe[0] = Z(e, t),
                    se[0]
                }
                function fe(e, t) {
                    return oe[0] = Z(e, t),
                    oe[1] = Z(e, t),
                    ae[0]
                }
                function ce(e, t) {
                    return X(e, t) > 0
                }
                function ue(e, t) {
                    var n, i = e[t.offset++];
                    i < 192 ? n = 31 & i : 217 === i ? n = X(e, t) : 218 === i ? n = Y(e, t) : 219 === i && (n = ee(e, t));
                    var r = W(e, t.offset, n);
                    return t.offset += n,
                    r
                }
                function de(e, t) {
                    var n = e[t.offset];
                    return n < 192 && n > 160 || 217 === n || 218 === n || 219 === n
                }
                function pe(e, t) {
                    var n = e[t.offset++];
                    return n < 128 ? n : 202 === n ? he(e, t) : 203 === n ? fe(e, t) : 204 === n ? X(e, t) : 205 === n ? Y(e, t) : 206 === n ? ee(e, t) : 207 === n ? re(e, t) : 208 === n ? G(e, t) : 209 === n ? Q(e, t) : 210 === n ? Z(e, t) : 211 === n ? ie(e, t) : n > 223 ? -1 * (255 - n + 1) : void 0
                }
                function le(e, t) {
                    var n = e[t.offset];
                    return n < 128 || n >= 202 && n <= 211
                }
                function ve(e, t) {
                    return e[t.offset] < 160
                }
                function ye(e, t) {
                    return e[t.offset - 1] === s && (e[t.offset] < 128 || e[t.offset] >= 202 && e[t.offset] <= 211)
                }
                var ge = Object.freeze({
                    __proto__: null,
                    int8: G,
                    uint8: X,
                    int16: Q,
                    uint16: Y,
                    int32: Z,
                    uint32: ee,
                    float32: te,
                    float64: ne,
                    int64: ie,
                    uint64: re,
                    readFloat32: he,
                    readFloat64: fe,
                    boolean: ce,
                    string: ue,
                    stringCheck: de,
                    number: pe,
                    numberCheck: le,
                    arrayCheck: ve,
                    switchStructureCheck: ye
                })
                  , me = function() {
                    function t(e) {
                        var t = this;
                        this.$changes = new f(this),
                        this.$items = new Map,
                        this.$indexes = new Map,
                        this.$refId = 0,
                        e && e.forEach((function(e) {
                            return t.add(e)
                        }
                        ))
                    }
                    return t.is = function(e) {
                        return void 0 !== e.collection
                    }
                    ,
                    t.prototype.add = function(e) {
                        var t = this.$refId++;
                        return void 0 !== e.$changes && e.$changes.setParent(this, this.$changes.root, t),
                        this.$changes.indexes[t] = t,
                        this.$indexes.set(t, t),
                        this.$items.set(t, e),
                        this.$changes.change(t),
                        t
                    }
                    ,
                    t.prototype.at = function(e) {
                        var t = Array.from(this.$items.keys())[e];
                        return this.$items.get(t)
                    }
                    ,
                    t.prototype.entries = function() {
                        return this.$items.entries()
                    }
                    ,
                    t.prototype.delete = function(e) {
                        for (var t, n, i = this.$items.entries(); (n = i.next()) && !n.done; )
                            if (e === n.value[1]) {
                                t = n.value[0];
                                break
                            }
                        return void 0 !== t && (this.$changes.delete(t),
                        this.$indexes.delete(t),
                        this.$items.delete(t))
                    }
                    ,
                    t.prototype.clear = function(t) {
                        var n = this;
                        this.$changes.discard(!0, !0),
                        this.$changes.indexes = {},
                        this.$indexes.clear(),
                        t && "string" != typeof this.$changes.getType() && this.$items.forEach((function(e) {
                            n.$changes.root.removeRef(e.$changes.refId)
                        }
                        )),
                        this.$items.clear(),
                        this.$changes.operation({
                            index: 0,
                            op: e.OPERATION.CLEAR
                        }),
                        this.$changes.touchParents()
                    }
                    ,
                    t.prototype.has = function(e) {
                        return Array.from(this.$items.values()).some((function(t) {
                            return t === e
                        }
                        ))
                    }
                    ,
                    t.prototype.forEach = function(e) {
                        var t = this;
                        this.$items.forEach((function(n, i, r) {
                            return e(n, i, t)
                        }
                        ))
                    }
                    ,
                    t.prototype.values = function() {
                        return this.$items.values()
                    }
                    ,
                    Object.defineProperty(t.prototype, "size", {
                        get: function() {
                            return this.$items.size
                        },
                        enumerable: !1,
                        configurable: !0
                    }),
                    t.prototype.setIndex = function(e, t) {
                        this.$indexes.set(e, t)
                    }
                    ,
                    t.prototype.getIndex = function(e) {
                        return this.$indexes.get(e)
                    }
                    ,
                    t.prototype.getByIndex = function(e) {
                        return this.$items.get(this.$indexes.get(e))
                    }
                    ,
                    t.prototype.deleteByIndex = function(e) {
                        var t = this.$indexes.get(e);
                        this.$items.delete(t),
                        this.$indexes.delete(e)
                    }
                    ,
                    t.prototype.toArray = function() {
                        return Array.from(this.$items.values())
                    }
                    ,
                    t.prototype.toJSON = function() {
                        var e = [];
                        return this.forEach((function(t, n) {
                            e.push("function" == typeof t.toJSON ? t.toJSON() : t)
                        }
                        )),
                        e
                    }
                    ,
                    t.prototype.clone = function(e) {
                        var n;
                        return e ? n = Object.assign(new t, this) : (n = new t,
                        this.forEach((function(e) {
                            e.$changes ? n.add(e.clone()) : n.add(e)
                        }
                        ))),
                        n
                    }
                    ,
                    t.prototype.triggerAll = function() {
                        xe.prototype.triggerAll.apply(this)
                    }
                    ,
                    t
                }()
                  , _e = function() {
                    function t(e) {
                        var t = this;
                        this.$changes = new f(this),
                        this.$items = new Map,
                        this.$indexes = new Map,
                        this.$refId = 0,
                        e && e.forEach((function(e) {
                            return t.add(e)
                        }
                        ))
                    }
                    return t.is = function(e) {
                        return void 0 !== e.set
                    }
                    ,
                    t.prototype.add = function(t) {
                        var n, i;
                        if (this.has(t))
                            return !1;
                        var r = this.$refId++;
                        void 0 !== t.$changes && t.$changes.setParent(this, this.$changes.root, r);
                        var o = null !== (i = null === (n = this.$changes.indexes[r]) || void 0 === n ? void 0 : n.op) && void 0 !== i ? i : e.OPERATION.ADD;
                        return this.$changes.indexes[r] = r,
                        this.$indexes.set(r, r),
                        this.$items.set(r, t),
                        this.$changes.change(r, o),
                        r
                    }
                    ,
                    t.prototype.entries = function() {
                        return this.$items.entries()
                    }
                    ,
                    t.prototype.delete = function(e) {
                        for (var t, n, i = this.$items.entries(); (n = i.next()) && !n.done; )
                            if (e === n.value[1]) {
                                t = n.value[0];
                                break
                            }
                        return void 0 !== t && (this.$changes.delete(t),
                        this.$indexes.delete(t),
                        this.$items.delete(t))
                    }
                    ,
                    t.prototype.clear = function(t) {
                        var n = this;
                        this.$changes.discard(!0, !0),
                        this.$changes.indexes = {},
                        this.$indexes.clear(),
                        t && "string" != typeof this.$changes.getType() && this.$items.forEach((function(e) {
                            n.$changes.root.removeRef(e.$changes.refId)
                        }
                        )),
                        this.$items.clear(),
                        this.$changes.operation({
                            index: 0,
                            op: e.OPERATION.CLEAR
                        }),
                        this.$changes.touchParents()
                    }
                    ,
                    t.prototype.has = function(e) {
                        for (var t, n = this.$items.values(), i = !1; (t = n.next()) && !t.done; )
                            if (e === t.value) {
                                i = !0;
                                break
                            }
                        return i
                    }
                    ,
                    t.prototype.forEach = function(e) {
                        var t = this;
                        this.$items.forEach((function(n, i, r) {
                            return e(n, i, t)
                        }
                        ))
                    }
                    ,
                    t.prototype.values = function() {
                        return this.$items.values()
                    }
                    ,
                    Object.defineProperty(t.prototype, "size", {
                        get: function() {
                            return this.$items.size
                        },
                        enumerable: !1,
                        configurable: !0
                    }),
                    t.prototype.setIndex = function(e, t) {
                        this.$indexes.set(e, t)
                    }
                    ,
                    t.prototype.getIndex = function(e) {
                        return this.$indexes.get(e)
                    }
                    ,
                    t.prototype.getByIndex = function(e) {
                        return this.$items.get(this.$indexes.get(e))
                    }
                    ,
                    t.prototype.deleteByIndex = function(e) {
                        var t = this.$indexes.get(e);
                        this.$items.delete(t),
                        this.$indexes.delete(e)
                    }
                    ,
                    t.prototype.toArray = function() {
                        return Array.from(this.$items.values())
                    }
                    ,
                    t.prototype.toJSON = function() {
                        var e = [];
                        return this.forEach((function(t, n) {
                            e.push("function" == typeof t.toJSON ? t.toJSON() : t)
                        }
                        )),
                        e
                    }
                    ,
                    t.prototype.clone = function(e) {
                        var n;
                        return e ? n = Object.assign(new t, this) : (n = new t,
                        this.forEach((function(e) {
                            e.$changes ? n.add(e.clone()) : n.add(e)
                        }
                        ))),
                        n
                    }
                    ,
                    t.prototype.triggerAll = function() {
                        xe.prototype.triggerAll.apply(this)
                    }
                    ,
                    t
                }()
                  , we = function() {
                    function e() {
                        this.handlers = []
                    }
                    return e.prototype.register = function(e, t) {
                        return this.handlers.push(e),
                        this
                    }
                    ,
                    e.prototype.invoke = function() {
                        for (var e = [], t = 0; t < arguments.length; t++)
                            e[t] = arguments[t];
                        this.handlers.forEach((function(t) {
                            return t.apply(void 0, e)
                        }
                        ))
                    }
                    ,
                    e.prototype.invokeAsync = function() {
                        for (var e = [], t = 0; t < arguments.length; t++)
                            e[t] = arguments[t];
                        return Promise.all(this.handlers.map((function(t) {
                            return t.apply(void 0, e)
                        }
                        )))
                    }
                    ,
                    e.prototype.remove = function(e) {
                        var t = this.handlers.indexOf(e);
                        this.handlers[t] = this.handlers[this.handlers.length - 1],
                        this.handlers.pop()
                    }
                    ,
                    e.prototype.clear = function() {
                        this.handlers = []
                    }
                    ,
                    e
                }()
                  , Ae = function() {
                    function e() {
                        this.refIds = new WeakSet,
                        this.containerIndexes = new WeakMap
                    }
                    return e.prototype.addRefId = function(e) {
                        this.refIds.has(e) || (this.refIds.add(e),
                        this.containerIndexes.set(e, new Set))
                    }
                    ,
                    e.get = function(t) {
                        return void 0 === t.$filterState && (t.$filterState = new e),
                        t.$filterState
                    }
                    ,
                    e
                }()
                  , $e = function(e) {
                    function t() {
                        return null !== e && e.apply(this, arguments) || this
                    }
                    return n(t, e),
                    t
                }(Error);
                function Ee(e, t, n, i) {
                    var r, o = !1;
                    switch (t) {
                    case "number":
                    case "int8":
                    case "uint8":
                    case "int16":
                    case "uint16":
                    case "int32":
                    case "uint32":
                    case "int64":
                    case "uint64":
                    case "float32":
                    case "float64":
                        r = "number",
                        isNaN(e) && console.log('trying to encode "NaN" in ' + n.constructor.name + "#" + i);
                        break;
                    case "string":
                        r = "string",
                        o = !0;
                        break;
                    case "boolean":
                        return
                    }
                    if (typeof e !== r && (!o || o && null !== e)) {
                        var s = "'" + JSON.stringify(e) + "'" + (e && e.constructor && " (" + e.constructor.name + ")" || "");
                        throw new $e("a '" + r + "' was expected, but " + s + " was provided in " + n.constructor.name + "#" + i)
                    }
                }
                function Oe(e, t, n, i) {
                    if (!(e instanceof t))
                        throw new $e("a '" + t.name + "' was expected, but '" + e.constructor.name + "' was provided in " + n.constructor.name + "#" + i)
                }
                function Ie(e, t, n, i, r) {
                    Ee(n, e, i, r);
                    var o = K[e];
                    if (!o)
                        throw new $e("a '" + e + "' was expected, but " + n + " was provided in " + i.constructor.name + "#" + r);
                    o(t, n)
                }
                function be(e, t, n) {
                    return ge[e](t, n)
                }
                var xe = function() {
                    function t() {
                        for (var e = [], t = 0; t < arguments.length; t++)
                            e[t] = arguments[t];
                        Object.defineProperties(this, {
                            $changes: {
                                value: new f(this,void 0,new h),
                                enumerable: !1,
                                writable: !0
                            },
                            $listeners: {
                                value: {},
                                enumerable: !1,
                                writable: !0
                            }
                        });
                        var n = this._definition.descriptors;
                        n && Object.defineProperties(this, n),
                        e[0] && this.assign(e[0])
                    }
                    return t.onError = function(e) {
                        console.error(e)
                    }
                    ,
                    t.is = function(e) {
                        return e._definition && void 0 !== e._definition.schema
                    }
                    ,
                    t.prototype.assign = function(e) {
                        return Object.assign(this, e),
                        this
                    }
                    ,
                    Object.defineProperty(t.prototype, "_definition", {
                        get: function() {
                            return this.constructor._definition
                        },
                        enumerable: !1,
                        configurable: !0
                    }),
                    t.prototype.listen = function(e, t) {
                        var n = this;
                        return this.$listeners[e] || (this.$listeners[e] = new we),
                        this.$listeners[e].register(t),
                        function() {
                            return n.$listeners[e].remove(t)
                        }
                    }
                    ,
                    t.prototype.decode = function(n, i, r, o) {
                        void 0 === i && (i = {
                            offset: 0
                        }),
                        void 0 === r && (r = this),
                        void 0 === o && (o = new Map);
                        var a = this.$changes.root
                          , h = n.length
                          , f = 0
                          , c = [];
                        for (a.refs.set(f, this),
                        o.set(f, c); i.offset < h; ) {
                            var u = n[i.offset++];
                            if (u != s) {
                                var p = r.$changes
                                  , v = void 0 !== r._definition
                                  , y = v ? u >> 6 << 6 : u;
                                if (y !== e.OPERATION.CLEAR) {
                                    var m = v ? u % (y || 255) : pe(n, i)
                                      , _ = v ? r._definition.fieldsByIndex[m] : ""
                                      , w = p.getType(m)
                                      , A = void 0
                                      , $ = void 0
                                      , E = void 0;
                                    if (v ? $ = r["_" + _] : ($ = r.getByIndex(m),
                                    (y & e.OPERATION.ADD) === e.OPERATION.ADD ? (E = r instanceof l ? ue(n, i) : m,
                                    r.setIndex(m, E)) : E = r.getIndex(m)),
                                    (y & e.OPERATION.DELETE) === e.OPERATION.DELETE && (y !== e.OPERATION.DELETE_AND_ADD && r.deleteByIndex(m),
                                    $ && $.$changes && a.removeRef($.$changes.refId),
                                    A = null),
                                    void 0 !== _) {
                                        if (y === e.OPERATION.DELETE)
                                            ;
                                        else if (t.is(w)) {
                                            var O = pe(n, i);
                                            if (A = a.refs.get(O),
                                            y !== e.OPERATION.REPLACE) {
                                                var I = this.getSchemaType(n, i, w);
                                                A || ((A = this.createTypeInstance(I)).$changes.refId = O,
                                                $ && (A.onChange = $.onChange,
                                                A.onRemove = $.onRemove,
                                                A.$listeners = $.$listeners,
                                                $.$changes.refId && O !== $.$changes.refId && a.removeRef($.$changes.refId))),
                                                a.addRef(O, A, A !== $)
                                            }
                                        } else if ("string" == typeof w)
                                            A = be(w, n, i);
                                        else {
                                            var b = g(Object.keys(w)[0])
                                              , x = pe(n, i)
                                              , R = a.refs.has(x) ? $ || a.refs.get(x) : new b.constructor;
                                            if ((A = R.clone(!0)).$changes.refId = x,
                                            $ && (A.onAdd = $.onAdd,
                                            A.onRemove = $.onRemove,
                                            A.onChange = $.onChange,
                                            $.$changes.refId && x !== $.$changes.refId)) {
                                                a.removeRef($.$changes.refId);
                                                for (var T = [], C = $.entries(), P = void 0; (P = C.next()) && !P.done; ) {
                                                    var S = P.value
                                                      , N = S[0]
                                                      , D = S[1];
                                                    T.push({
                                                        op: e.OPERATION.DELETE,
                                                        field: N,
                                                        value: void 0,
                                                        previousValue: D
                                                    })
                                                }
                                                o.set($.$changes.refId, T)
                                            }
                                            a.addRef(x, A, R !== $),
                                            b.getProxy && (A = b.getProxy(A))
                                        }
                                        var M = $ !== A;
                                        if (null != A)
                                            if (A.$changes && A.$changes.setParent(p.ref, p.root, m),
                                            r instanceof t)
                                                r[_] = A;
                                            else if (r instanceof l)
                                                N = E,
                                                r.$items.set(N, A);
                                            else if (r instanceof d)
                                                r.setAt(m, A);
                                            else if (r instanceof me) {
                                                var k = r.add(A);
                                                r.setIndex(m, k)
                                            } else
                                                r instanceof _e && !1 !== (k = r.add(A)) && r.setIndex(m, k);
                                        M && c.push({
                                            op: y,
                                            field: _,
                                            dynamicIndex: E,
                                            value: A,
                                            previousValue: $
                                        })
                                    } else {
                                        console.warn("@colyseus/schema: definition mismatch");
                                        for (var j = {
                                            offset: i.offset
                                        }; i.offset < h && (!ye(n, i) || (j.offset = i.offset + 1,
                                        !a.refs.has(pe(n, j)))); )
                                            i.offset++
                                    }
                                } else
                                    r.clear(!0)
                            } else {
                                f = pe(n, i);
                                var U = a.refs.get(f);
                                if (!U)
                                    throw new Error('"refId" not found: ' + f);
                                r = U,
                                c = [],
                                o.set(f, c)
                            }
                        }
                        return this._triggerChanges(o),
                        a.garbageCollectDeletedRefs(),
                        o
                    }
                    ,
                    t.prototype.encode = function(n, i, r) {
                        void 0 === n && (n = !1),
                        void 0 === i && (i = []),
                        void 0 === r && (r = !1);
                        for (var o = this.$changes, a = new WeakSet, h = [o], f = 1, c = 0; c < f; c++) {
                            var u = h[c]
                              , d = u.ref
                              , p = d instanceof t;
                            u.ensureRefId(),
                            a.add(u),
                            u !== o && (u.changed || n) && (C(i, s),
                            J(i, u.refId));
                            for (var v = n ? Array.from(u.allChanges) : Array.from(u.changes.values()), y = 0, m = v.length; y < m; y++) {
                                var _ = n ? {
                                    op: e.OPERATION.ADD,
                                    index: v[y]
                                } : v[y]
                                  , w = _.index
                                  , A = p ? d._definition.fieldsByIndex && d._definition.fieldsByIndex[w] : w
                                  , $ = i.length;
                                if (_.op !== e.OPERATION.TOUCH)
                                    if (p)
                                        C(i, w | _.op);
                                    else {
                                        if (C(i, _.op),
                                        _.op === e.OPERATION.CLEAR)
                                            continue;
                                        J(i, w)
                                    }
                                if (p || (_.op & e.OPERATION.ADD) != e.OPERATION.ADD || d instanceof l && q(i, u.ref.$indexes.get(w)),
                                _.op !== e.OPERATION.DELETE) {
                                    var E = u.getType(w)
                                      , O = u.getValue(w);
                                    if (O && O.$changes && !a.has(O.$changes) && (h.push(O.$changes),
                                    O.$changes.ensureRefId(),
                                    f++),
                                    _.op !== e.OPERATION.TOUCH) {
                                        if (t.is(E))
                                            Oe(O, E, d, A),
                                            J(i, O.$changes.refId),
                                            (_.op & e.OPERATION.ADD) === e.OPERATION.ADD && this.tryEncodeTypeId(i, E, O.constructor);
                                        else if ("string" == typeof E)
                                            Ie(E, i, O, d, A);
                                        else {
                                            var I = g(Object.keys(E)[0]);
                                            Oe(d["_" + A], I.constructor, d, A),
                                            J(i, O.$changes.refId)
                                        }
                                        r && u.cache(w, i.slice($))
                                    }
                                }
                            }
                            n || r || u.discard()
                        }
                        return i
                    }
                    ,
                    t.prototype.encodeAll = function(e) {
                        return this.encode(!0, [], e)
                    }
                    ,
                    t.prototype.applyFilters = function(n, i) {
                        var r, o;
                        void 0 === i && (i = !1);
                        for (var a = this, h = new Set, f = Ae.get(n), c = [this.$changes], u = 1, d = [], p = function(p) {
                            var v = c[p];
                            if (h.has(v.refId))
                                return "continue";
                            var y = v.ref
                              , g = y instanceof t;
                            C(d, s),
                            J(d, v.refId);
                            var m = f.refIds.has(v)
                              , _ = i || !m;
                            f.addRefId(v);
                            var w = f.containerIndexes.get(v)
                              , A = _ ? Array.from(v.allChanges) : Array.from(v.changes.values());
                            !i && g && y._definition.indexesWithFilters && y._definition.indexesWithFilters.forEach((function(t) {
                                !w.has(t) && v.allChanges.has(t) && (_ ? A.push(t) : A.push({
                                    op: e.OPERATION.ADD,
                                    index: t
                                }))
                            }
                            ));
                            for (var $ = 0, E = A.length; $ < E; $++) {
                                var O = _ ? {
                                    op: e.OPERATION.ADD,
                                    index: A[$]
                                } : A[$];
                                if (O.op !== e.OPERATION.CLEAR) {
                                    var I = O.index;
                                    if (O.op !== e.OPERATION.DELETE) {
                                        var b = v.getValue(I)
                                          , x = v.getType(I);
                                        if (g) {
                                            if ((R = y._definition.filters && y._definition.filters[I]) && !R.call(y, n, b, a)) {
                                                b && b.$changes && h.add(b.$changes.refId);
                                                continue
                                            }
                                        } else {
                                            var R, T = v.parent;
                                            if ((R = v.getChildrenFilter()) && !R.call(T, n, y.$indexes.get(I), b, a)) {
                                                b && b.$changes && h.add(b.$changes.refId);
                                                continue
                                            }
                                        }
                                        if (b.$changes && (c.push(b.$changes),
                                        u++),
                                        O.op !== e.OPERATION.TOUCH)
                                            if (O.op === e.OPERATION.ADD || g)
                                                d.push.apply(d, null !== (r = v.caches[I]) && void 0 !== r ? r : []),
                                                w.add(I);
                                            else if (w.has(I))
                                                d.push.apply(d, null !== (o = v.caches[I]) && void 0 !== o ? o : []);
                                            else {
                                                if (w.add(I),
                                                C(d, e.OPERATION.ADD),
                                                J(d, I),
                                                y instanceof l) {
                                                    var P = v.ref.$indexes.get(I);
                                                    q(d, P)
                                                }
                                                b.$changes ? J(d, b.$changes.refId) : K[x](d, b)
                                            }
                                        else
                                            b.$changes && !g && (C(d, e.OPERATION.ADD),
                                            J(d, I),
                                            y instanceof l && (P = v.ref.$indexes.get(I),
                                            q(d, P)),
                                            J(d, b.$changes.refId))
                                    } else
                                        g ? C(d, O.op | I) : (C(d, O.op),
                                        J(d, I))
                                } else
                                    C(d, O.op)
                            }
                        }, v = 0; v < u; v++)
                            p(v);
                        return d
                    }
                    ,
                    t.prototype.clone = function() {
                        var e = new this.constructor
                          , t = this._definition.schema;
                        for (var n in t)
                            "object" == typeof this[n] && "function" == typeof this[n].clone ? e[n] = this[n].clone() : e[n] = this[n];
                        return e
                    }
                    ,
                    t.prototype.triggerAll = function() {
                        if (0 !== this.$changes.root.refs.size) {
                            var e = new Map;
                            t.prototype._triggerAllFillChanges.call(this, this, e);
                            try {
                                t.prototype._triggerChanges.call(this, e)
                            } catch (e) {
                                t.onError(e)
                            }
                        }
                    }
                    ,
                    t.prototype.toJSON = function() {
                        var e = this._definition.schema
                          , t = this._definition.deprecated
                          , n = {};
                        for (var i in e)
                            t[i] || null === this[i] || void 0 === this[i] || (n[i] = "function" == typeof this[i].toJSON ? this[i].toJSON() : this["_" + i]);
                        return n
                    }
                    ,
                    t.prototype.discardAllChanges = function() {
                        this.$changes.discardAll()
                    }
                    ,
                    t.prototype.getByIndex = function(e) {
                        return this[this._definition.fieldsByIndex[e]]
                    }
                    ,
                    t.prototype.deleteByIndex = function(e) {
                        this[this._definition.fieldsByIndex[e]] = void 0
                    }
                    ,
                    t.prototype.tryEncodeTypeId = function(e, t, n) {
                        t._typeid !== n._typeid && (C(e, a),
                        J(e, n._typeid))
                    }
                    ,
                    t.prototype.getSchemaType = function(e, t, n) {
                        var i;
                        return e[t.offset] === a && (t.offset++,
                        i = this.constructor._context.get(pe(e, t))),
                        i || n
                    }
                    ,
                    t.prototype.createTypeInstance = function(e) {
                        var t = new e;
                        return t.$changes.root = this.$changes.root,
                        t
                    }
                    ,
                    t.prototype._triggerAllFillChanges = function(n, i) {
                        if (!i.has(n.$changes.refId)) {
                            var r = [];
                            if (i.set(n.$changes.refId || 0, r),
                            n instanceof t) {
                                var o = n._definition.schema;
                                for (var s in o)
                                    void 0 !== (u = n["_" + s]) && (r.push({
                                        op: e.OPERATION.ADD,
                                        field: s,
                                        value: u,
                                        previousValue: void 0
                                    }),
                                    void 0 !== u.$changes && t.prototype._triggerAllFillChanges.call(this, u, i))
                            } else
                                for (var a = n.entries(), h = void 0; (h = a.next()) && !h.done; ) {
                                    var f = h.value
                                      , c = f[0]
                                      , u = f[1];
                                    r.push({
                                        op: e.OPERATION.ADD,
                                        field: c,
                                        dynamicIndex: c,
                                        value: u,
                                        previousValue: void 0
                                    }),
                                    void 0 !== u.$changes && t.prototype._triggerAllFillChanges.call(this, u, i)
                                }
                        }
                    }
                    ,
                    t.prototype._triggerChanges = function(n) {
                        var i = this;
                        if(!window.gc.data.refs) window.gc.data.refs = this.$changes.root.refs                        
                        // this.$changes.root.refs.get(134).$listeners.skinId.invoke("character_clown", "character_obama_Fortnite")
                        n.forEach((function(n, r) {
                            var o, s, a, h, f, c, u, d, p, l, v, y;
                            if (n.length > 0) {
                                for (var g = i.$changes.root.refs.get(r), m = g instanceof t, _ = 0; _ < n.length; _++) {
                                    var w = n[_]
                                    , A = g.$listeners && g.$listeners[w.field];
                                    if (m || (w.op === e.OPERATION.ADD && void 0 === w.previousValue ? null === (s = (o = g).onAdd) || void 0 === s || s.call(o, w.value, null !== (a = w.dynamicIndex) && void 0 !== a ? a : w.field) : w.op === e.OPERATION.DELETE ? void 0 !== w.previousValue && (null === (f = (h = g).onRemove) || void 0 === f || f.call(h, w.previousValue, null !== (c = w.dynamicIndex) && void 0 !== c ? c : w.field)) : w.op === e.OPERATION.DELETE_AND_ADD ? (void 0 !== w.previousValue && (null === (d = (u = g).onRemove) || void 0 === d || d.call(u, w.previousValue, w.dynamicIndex)),
                                    null === (l = (p = g).onAdd) || void 0 === l || l.call(p, w.value, w.dynamicIndex)) : w.op !== e.OPERATION.REPLACE && w.value === w.previousValue || null === (y = (v = g).onChange) || void 0 === y || y.call(v, w.value, w.dynamicIndex)),
                                    (w.op & e.OPERATION.DELETE) === e.OPERATION.DELETE && w.previousValue instanceof t && w.previousValue.onRemove && w.previousValue.onRemove(),
                                    A)
                                        try {
                                            // console.log(w)
                                            A.invoke(w.value, w.previousValue)
                                        } catch (e) {
                                            t.onError(e)
                                        }
                                }
                                if (m && g.onChange)
                                    try {
                                        g.onChange(n)
                                    } catch (e) {
                                        t.onError(e)
                                    }
                            }
                        }
                        ))
                    }
                    ,
                    t._definition = m.create(),
                    t
                }();
                function Re(e) {
                    for (var t = [e.$changes], n = 1, i = {}, r = i, o = function(e) {
                        var n = t[e];
                        n.changes.forEach((function(e) {
                            var t = n.ref
                              , i = e.index
                              , o = t._definition ? t._definition.fieldsByIndex[i] : t.$indexes.get(i);
                            r[o] = n.getValue(i)
                        }
                        ))
                    }, s = 0; s < n; s++)
                        o(s);
                    return i
                }
                var Te = new w
                  , Ce = function(e) {
                    function t() {
                        return null !== e && e.apply(this, arguments) || this
                    }
                    return n(t, e),
                    i([$("string", Te)], t.prototype, "name", void 0),
                    i([$("string", Te)], t.prototype, "type", void 0),
                    i([$("number", Te)], t.prototype, "referencedType", void 0),
                    t
                }(xe)
                  , Pe = function(e) {
                    function t() {
                        var t = null !== e && e.apply(this, arguments) || this;
                        return t.fields = new d,
                        t
                    }
                    return n(t, e),
                    i([$("number", Te)], t.prototype, "id", void 0),
                    i([$([Ce], Te)], t.prototype, "fields", void 0),
                    t
                }(xe)
                  , Se = function(e) {
                    function t() {
                        var t = null !== e && e.apply(this, arguments) || this;
                        return t.types = new d,
                        t
                    }
                    return n(t, e),
                    t.encode = function(e) {
                        var n = e.constructor
                          , i = new t;
                        i.rootType = n._typeid;
                        var r = function(e, t) {
                            for (var n in t) {
                                var r = new Ce;
                                r.name = n;
                                var o = void 0;
                                if ("string" == typeof t[n])
                                    o = t[n];
                                else {
                                    var s = t[n]
                                      , a = void 0;
                                    xe.is(s) ? (o = "ref",
                                    a = t[n]) : "string" == typeof s[o = Object.keys(s)[0]] ? o += ":" + s[o] : a = s[o],
                                    r.referencedType = a ? a._typeid : -1
                                }
                                r.type = o,
                                e.fields.push(r)
                            }
                            i.types.push(e)
                        }
                          , o = n._context.types;
                        for (var s in o) {
                            var a = new Pe;
                            a.id = Number(s),
                            r(a, o[s]._definition.schema)
                        }
                        return i.encodeAll()
                    }
                    ,
                    t.decode = function(e, i) {
                        var r = new w
                          , o = new t;
                        o.decode(e, i);
                        
                        var s = o.types.reduce((function(e, t) {
                            var i = function(e) {
                                function t() {
                                    return null !== e && e.apply(this, arguments) || this
                                }
                                return n(t, e),
                                t
                            }(xe)
                              , o = t.id;
                            return e[o] = i,
                            r.add(i, o),
                            e
                        }
                        ), {});
                        o.types.forEach((function(e) {
                            var t = s[e.id];
                            e.fields.forEach((function(e) {
                                var n;
                                if (void 0 !== e.referencedType) {
                                    var i = e.type
                                      , o = s[e.referencedType];
                                    if (!o) {
                                        var a = e.type.split(":");
                                        i = a[0],
                                        o = a[1]
                                    }
                                    "ref" === i ? $(o, r)(t.prototype, e.name) : $(((n = {})[i] = o,
                                    n), r)(t.prototype, e.name)
                                } else
                                    $(e.type, r)(t.prototype, e.name)
                            }
                            ))
                        }
                        ));
                        var a = s[o.rootType]
                          , h = new a;
                        for (var f in a._definition.schema) {
                            var c = a._definition.schema[f];
                            "string" != typeof c && (h[f] = "function" == typeof c ? new c : new (g(Object.keys(c)[0]).constructor))
                        }
                        return h
                    }
                    ,
                    i([$([Pe], Te)], t.prototype, "types", void 0),
                    i([$("number", Te)], t.prototype, "rootType", void 0),
                    t
                }(xe);
                y("map", {
                    constructor: l,
                    getProxy: p
                }),
                y("array", {
                    constructor: d,
                    getProxy: u
                }),
                y("set", {
                    constructor: _e
                }),
                y("collection", {
                    constructor: me
                }),
                e.ArraySchema = d,
                e.CollectionSchema = me,
                e.Context = w,
                e.MapSchema = l,
                e.Reflection = Se,
                e.ReflectionField = Ce,
                e.ReflectionType = Pe,
                e.Schema = xe,
                e.SchemaDefinition = m,
                e.SetSchema = _e,
                e.decode = ge,
                e.defineTypes = b,
                e.deprecated = I,
                e.dumpChanges = Re,
                e.encode = K,
                e.filter = E,
                e.filterChildren = O,
                e.hasFilter = _,
                e.registerType = y,
                e.type = $,
                Object.defineProperty(e, "__esModule", {
                    value: !0
                })
            }
            ))
        }
        )), V = function() {
            function e(e, t) {
                var n = this;
                this.onStateChange = F(),
                this.onError = F(),
                this.onLeave = F(),
                this.onJoin = F(),
                this.hasJoined = !1,
                this.onMessageHandlers = U(),
                this.id = null,
                this.name = e,
                t && (this.serializer = new (M("schema")),
                this.rootSchema = t,
                this.serializer.state = new t),
                this.onError((function(e, t) {
                    return console.warn("colyseus.js - onError => (" + e + ") " + t)
                }
                )),
                this.onLeave((function() {
                    return n.removeAllListeners()
                }
                ))
            }
            return e.prototype.connect = function(e) {
                var t = this;
                this.connection = new S,
                this.connection.events.onmessage = this.onMessageCallback.bind(this),
                this.connection.events.onclose = function(e) {
                    if (!t.hasJoined)
                        return console.warn("Room connection was closed unexpectedly (" + e.code + "): " + e.reason),
                        void t.onError.invoke(e.code, e.reason);
                    t.onLeave.invoke(e.code),
                    t.destroy()
                }
                ,
                this.connection.events.onerror = function(e) {
                    console.warn("Room, onError (" + e.code + "): " + e.reason),
                    t.onError.invoke(e.code, e.reason)
                }
                ,
                this.connection.connect(e)
            }
            ,
            e.prototype.leave = function(e) {
                var n = this;
                return void 0 === e && (e = !0),
                new Promise((function(i) {
                    n.onLeave((function(e) {
                        return i(e)
                    }
                    )),
                    n.connection ? e ? n.connection.send([t.Protocol.LEAVE_ROOM]) : n.connection.close() : n.onLeave.invoke(4e3)
                }
                ))
            }
            ,
            e.prototype.onMessage = function(e, t) {
                return this.onMessageHandlers.on(this.getMessageHandlerKey(e), t)
            }
            ,
            e.prototype.send = function(e, n) {
                var i, r = [t.Protocol.ROOM_DATA];
                // edited code
                if(e == "MOVED") {
                    window.gc.data.playerPos = n;
                }
                if ("string" == typeof e ? z.encode.string(r, e) : z.encode.number(r, e),
                void 0 !== n) {
                    for(let callback of window.gc.socket.outgoingCallbacks) {
                        callback(e, n);
                    }
                    var o = b(n);
                    (i = new Uint8Array(r.length + o.byteLength)).set(new Uint8Array(r), 0),
                    i.set(new Uint8Array(o), r.length)
                } else
                    i = new Uint8Array(r);
                this.connection.send(i.buffer)
            }
            ,
            Object.defineProperty(e.prototype, "state", {
                get: function() {
                    return this.serializer.getState()
                },
                enumerable: !1,
                configurable: !0
            }),
            e.prototype.removeAllListeners = function() {
                this.onJoin.clear(),
                this.onStateChange.clear(),
                this.onError.clear(),
                this.onLeave.clear(),
                this.onMessageHandlers.events = {}
            }
            ,
            e.prototype.onMessageCallback = function(e) {
                var n = Array.from(new Uint8Array(e.data))
                  , i = n[0];
                if (i === t.Protocol.JOIN_ROOM) {
                    var r = 1;
                    if (this.serializerId = k(n, r),
                    r += j(this.serializerId),
                    !this.serializer) {
                        var o = M(this.serializerId);
                        this.serializer = new o
                    }
                    n.length > r && this.serializer.handshake && this.serializer.handshake(n, {
                        offset: r
                    }),
                    this.hasJoined = !0,
                    this.onJoin.invoke(),
                    this.connection.send([t.Protocol.JOIN_ROOM])
                } else if (i === t.Protocol.ERROR) {
                    var s = {
                        offset: 1
                    }
                      , a = z.decode.number(n, s)
                      , h = z.decode.string(n, s);
                    this.onError.invoke(a, h)
                } else if (i === t.Protocol.LEAVE_ROOM)
                    this.leave();
                else if (i === t.Protocol.ROOM_DATA_SCHEMA) {
                    var f = {
                        offset: 1
                    };
                    (h = new (u = this.serializer.getState().constructor._context.get(z.decode.number(n, f)))).decode(n, f),
                    this.dispatchMessage(u, h)
                } else if (i === t.Protocol.ROOM_STATE)
                    n.shift(),
                    this.setState(n);
                else if (i === t.Protocol.ROOM_STATE_PATCH)
                    n.shift(),
                    this.patch(n);
                else if (i === t.Protocol.ROOM_DATA) {
                    var c = {
                        offset: 1
                    }
                      , u = z.decode.stringCheck(n, c) ? z.decode.string(n, c) : z.decode.number(n, c);
                    h = n.length > c.offset ? $(e.data, c.offset) : void 0,
                    this.dispatchMessage(u, h)
                }
            }
            ,
            e.prototype.setState = function(e) {
                // let text = new TextDecoder().decode(new Uint8Array(e))

                // find any indexes of char_leprechaun and replace it with character_default_graybrown
                // let indexes = []
                // let index = text.indexOf("character_leprechaun")
                // while(index != -1) {
                //     indexes.push(index)
                //     index = text.indexOf("character_leprechaun", index + 1)
                // }

                // console.log(indexes)
        
                // let newBytes = new TextDecoder().encode("character_default_graybrown")
                // for(let index of indexes) {
                //     // splice out the char_leprechaun
                //     e.splice(index, "character_leprechaun".length)
                //     // insert character_default_graybrown
                //     e.splice(index, 0, ...newBytes)
                // }

                this.serializer.setState(e)
                let state = this.serializer.getState();
                // inserted code
                window.gc.data.serializer = this.serializer;
                this.onStateChange.invoke(state)
            }
            ,
            e.prototype.patch = function(e) {
                this.serializer.patch(e)
                let newState = this.serializer.getState();
                for(let callback of window.gc.socket.stateChangeCallbacks) {
                    callback(newState);
                }
                this.onStateChange.invoke(newState)
            }
            ,
            e.prototype.dispatchMessage = function(e, t) {
                var n = this.getMessageHandlerKey(e);
                this.onMessageHandlers.events[n] ? this.onMessageHandlers.emit(n, t) : this.onMessageHandlers.events["*"] ? this.onMessageHandlers.emit("*", e, t) : console.warn("colyseus.js: onMessage() not registered for type '" + e + "'.")
            }
            ,
            e.prototype.destroy = function() {
                this.serializer && this.serializer.teardown()
            }
            ,
            e.prototype.getMessageHandlerKey = function(e) {
                switch (typeof e) {
                case "function":
                    return "$" + e._typeid;
                case "string":
                    return e;
                case "number":
                    return "i" + e;
                default:
                    throw new Error("invalid message type.")
                }
            }
            ,
            e
        }();
        function q() {
            return B || (B = "undefined" != typeof cc && cc.sys && cc.sys.localStorage ? cc.sys.localStorage : "undefined" != typeof window && window.localStorage ? window.localStorage : {
                cache: {},
                setItem: function(e, t) {
                    this.cache[e] = t
                },
                getItem: function(e) {
                    this.cache[e]
                },
                removeItem: function(e) {
                    delete this.cache[e]
                }
            }),
            B
        }
        function J(e, t) {
            q().setItem(e, t)
        }
        function K(e) {
            q().removeItem(e)
        }
        function W(e, t) {
            var n = q().getItem(e);
            "undefined" != typeof Promise && n instanceof Promise ? n.then((function(e) {
                return t(e)
            }
            )) : t(n)
        }
        var G, X = "colyseus-auth-token";
        t.Platform = void 0,
        (G = t.Platform || (t.Platform = {})).ios = "ios",
        G.android = "android";
        var Q, Y = function() {
            function e(e) {
                var t = this;
                this._id = void 0,
                this.username = void 0,
                this.displayName = void 0,
                this.avatarUrl = void 0,
                this.isAnonymous = void 0,
                this.email = void 0,
                this.lang = void 0,
                this.location = void 0,
                this.timezone = void 0,
                this.metadata = void 0,
                this.devices = void 0,
                this.facebookId = void 0,
                this.twitterId = void 0,
                this.googleId = void 0,
                this.gameCenterId = void 0,
                this.steamId = void 0,
                this.friendIds = void 0,
                this.blockedUserIds = void 0,
                this.createdAt = void 0,
                this.updatedAt = void 0,
                this.token = void 0,
                this.endpoint = e.replace("ws", "http"),
                W(X, (function(e) {
                    return t.token = e
                }
                ))
            }
            return Object.defineProperty(e.prototype, "hasToken", {
                get: function() {
                    return !!this.token
                },
                enumerable: !1,
                configurable: !0
            }),
            e.prototype.login = function(e) {
                return void 0 === e && (e = {}),
                r(this, void 0, void 0, (function() {
                    var t, n, i;
                    return o(this, (function(r) {
                        switch (r.label) {
                        case 0:
                            return t = Object.assign({}, e),
                            this.hasToken && (t.token = this.token),
                            [4, this.request("post", "/auth", t)];
                        case 1:
                            for (i in n = r.sent(),
                            this.token = n.token,
                            J(X, this.token),
                            n)
                                this.hasOwnProperty(i) && (this[i] = n[i]);
                            return this.registerPingService(),
                            [2, this]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.save = function() {
                return r(this, void 0, void 0, (function() {
                    return o(this, (function(e) {
                        switch (e.label) {
                        case 0:
                            return [4, this.request("put", "/auth", {}, {
                                username: this.username,
                                displayName: this.displayName,
                                avatarUrl: this.avatarUrl,
                                lang: this.lang,
                                location: this.location,
                                timezone: this.timezone
                            })];
                        case 1:
                            return e.sent(),
                            [2, this]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.getFriends = function() {
                return r(this, void 0, void 0, (function() {
                    return o(this, (function(e) {
                        switch (e.label) {
                        case 0:
                            return [4, this.request("get", "/friends/all")];
                        case 1:
                            return [2, e.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.getOnlineFriends = function() {
                return r(this, void 0, void 0, (function() {
                    return o(this, (function(e) {
                        switch (e.label) {
                        case 0:
                            return [4, this.request("get", "/friends/online")];
                        case 1:
                            return [2, e.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.getFriendRequests = function() {
                return r(this, void 0, void 0, (function() {
                    return o(this, (function(e) {
                        switch (e.label) {
                        case 0:
                            return [4, this.request("get", "/friends/requests")];
                        case 1:
                            return [2, e.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.sendFriendRequest = function(e) {
                return r(this, void 0, void 0, (function() {
                    return o(this, (function(t) {
                        switch (t.label) {
                        case 0:
                            return [4, this.request("post", "/friends/requests", {
                                userId: e
                            })];
                        case 1:
                            return [2, t.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.acceptFriendRequest = function(e) {
                return r(this, void 0, void 0, (function() {
                    return o(this, (function(t) {
                        switch (t.label) {
                        case 0:
                            return [4, this.request("put", "/friends/requests", {
                                userId: e
                            })];
                        case 1:
                            return [2, t.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.declineFriendRequest = function(e) {
                return r(this, void 0, void 0, (function() {
                    return o(this, (function(t) {
                        switch (t.label) {
                        case 0:
                            return [4, this.request("del", "/friends/requests", {
                                userId: e
                            })];
                        case 1:
                            return [2, t.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.blockUser = function(e) {
                return r(this, void 0, void 0, (function() {
                    return o(this, (function(t) {
                        switch (t.label) {
                        case 0:
                            return [4, this.request("post", "/friends/block", {
                                userId: e
                            })];
                        case 1:
                            return [2, t.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.unblockUser = function(e) {
                return r(this, void 0, void 0, (function() {
                    return o(this, (function(t) {
                        switch (t.label) {
                        case 0:
                            return [4, this.request("put", "/friends/block", {
                                userId: e
                            })];
                        case 1:
                            return [2, t.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.request = function(e, t, n, i, s) {
                return void 0 === n && (n = {}),
                void 0 === s && (s = {}),
                r(this, void 0, void 0, (function() {
                    var r, a, h, f;
                    return o(this, (function(o) {
                        switch (o.label) {
                        case 0:
                            for (a in s.Accept = "application/json",
                            this.hasToken && (s.Authorization = "Bearer " + this.token),
                            r = [],
                            n)
                                r.push(a + "=" + n[a]);
                            return h = r.length > 0 ? "?" + r.join("&") : "",
                            f = {
                                headers: s
                            },
                            i && (f.body = i),
                            [4, m[e]("" + this.endpoint + t + h, f)];
                        case 1:
                            return [2, o.sent().data]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.logout = function() {
                this.token = void 0,
                K(X),
                this.unregisterPingService()
            }
            ,
            e.prototype.registerPingService = function(e) {
                var t = this;
                void 0 === e && (e = 15e3),
                this.unregisterPingService(),
                this.keepOnlineInterval = setInterval((function() {
                    return t.request("get", "/auth")
                }
                ), e)
            }
            ,
            e.prototype.unregisterPingService = function() {
                clearInterval(this.keepOnlineInterval)
            }
            ,
            e
        }(), Z = function(e) {
            function t(n, i) {
                var r = e.call(this, n) || this;
                return r.code = i,
                Object.setPrototypeOf(r, t.prototype),
                r
            }
            return i(t, e),
            t
        }(Error), ee = "undefined" != typeof window && void 0 !== (null === (Q = null === window || void 0 === window ? void 0 : window.location) || void 0 === Q ? void 0 : Q.hostname) ? window.location.protocol.replace("http", "ws") + "//" + window.location.hostname + (window.location.port && ":" + window.location.port) : "ws://127.0.0.1:2567", te = function() {
            function e(e) {
                void 0 === e && (e = ee),
                this.endpoint = e
            }
            return Object.defineProperty(e.prototype, "auth", {
                get: function() {
                    return this._auth || (this._auth = new Y(this.endpoint)),
                    this._auth
                },
                enumerable: !1,
                configurable: !0
            }),
            e.prototype.joinOrCreate = function(e, t, n) {
                return void 0 === t && (t = {}),
                r(this, void 0, void 0, (function() {
                    return o(this, (function(i) {
                        switch (i.label) {
                        case 0:
                            return [4, this.createMatchMakeRequest("joinOrCreate", e, t, n)];
                        case 1:
                            return [2, i.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.create = function(e, t, n) {
                return void 0 === t && (t = {}),
                r(this, void 0, void 0, (function() {
                    return o(this, (function(i) {
                        switch (i.label) {
                        case 0:
                            return [4, this.createMatchMakeRequest("create", e, t, n)];
                        case 1:
                            return [2, i.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.join = function(e, t, n) {
                return void 0 === t && (t = {}),
                r(this, void 0, void 0, (function() {
                    return o(this, (function(i) {
                        switch (i.label) {
                        case 0:
                            return [4, this.createMatchMakeRequest("join", e, t, n)];
                        case 1:
                            return [2, i.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.joinById = function(e, t, n) {
                return void 0 === t && (t = {}),
                r(this, void 0, void 0, (function() {
                    return o(this, (function(i) {
                        switch (i.label) {
                        case 0:
                            return [4, this.createMatchMakeRequest("joinById", e, t, n)];
                        case 1:
                            return [2, i.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.reconnect = function(e, t, n) {
                return r(this, void 0, void 0, (function() {
                    return o(this, (function(i) {
                        switch (i.label) {
                        case 0:
                            return [4, this.createMatchMakeRequest("joinById", e, {
                                sessionId: t
                            }, n)];
                        case 1:
                            return [2, i.sent()]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.getAvailableRooms = function(e) {
                return void 0 === e && (e = ""),
                r(this, void 0, void 0, (function() {
                    var t;
                    return o(this, (function(n) {
                        switch (n.label) {
                        case 0:
                            return t = this.endpoint.replace("ws", "http") + "/matchmake/" + e,
                            [4, d(t, {
                                headers: {
                                    Accept: "application/json"
                                }
                            })];
                        case 1:
                            return [2, n.sent().data]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.consumeSeatReservation = function(e, t) {
                return r(this, void 0, void 0, (function() {
                    var n;
                    return o(this, (function(i) {
                        return (n = this.createRoom(e.room.name, t)).id = e.room.roomId,
                        n.sessionId = e.sessionId,
                        n.connect(this.buildEndpoint(e.room, {
                            sessionId: n.sessionId
                        })),
                        [2, new Promise((function(e, t) {
                            var i = function(e, n) {
                                return t(new _(e,n))
                            };
                            n.onError.once(i),
                            n.onJoin.once((function() {
                                n.onError.remove(i),
                                e(n)
                            }
                            ))
                        }
                        ))]
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.createMatchMakeRequest = function(e, t, n, i) {
                return void 0 === n && (n = {}),
                r(this, void 0, void 0, (function() {
                    var r, s;
                    return o(this, (function(o) {
                        switch (o.label) {
                        case 0:
                            return r = this.endpoint.replace("ws", "http") + "/matchmake/" + e + "/" + t,
                            this._auth && this._auth.hasToken && (n.token = this._auth.token),
                            [4, l(r, {
                                headers: {
                                    Accept: "application/json",
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify(n)
                            })];
                        case 1:
                            if ((s = o.sent().data).error)
                                throw new Z(s.error,s.code);
                            return [2, this.consumeSeatReservation(s, i)]
                        }
                    }
                    ))
                }
                ))
            }
            ,
            e.prototype.createRoom = function(e, t) {
                return new V(e,t)
            }
            ,
            e.prototype.buildEndpoint = function(e, t) {
                void 0 === t && (t = {});
                var n = [];
                for (var i in t)
                    t.hasOwnProperty(i) && n.push(i + "=" + t[i]);
                return this.endpoint + "/" + e.processId + "/" + e.roomId + "?" + n.join("&")
            }
            ,
            e
        }(), ne = function() {
            function e() {}
            return e.prototype.setState = function(e) {
                this.state.decode(e)
            }
            ,
            e.prototype.getState = function() {
                return this.state
            }
            ,
            e.prototype.patch = function(e) {
                return this.state.decode(e)
            }
            ,
            e.prototype.teardown = function() {
                var e, t;
                null === (t = null === (e = this.state) || void 0 === e ? void 0 : e.$changes) || void 0 === t || t.root.clearRefs()
            }
            ,
            e.prototype.handshake = function(e, t) {
                this.state ? (new z.Reflection).decode(e, t) : this.state = z.Reflection.decode(e, t)
            }
            ,
            e
        }(), ie = function() {
            function e() {}
            return e.prototype.setState = function(e) {}
            ,
            e.prototype.getState = function() {
                return null
            }
            ,
            e.prototype.patch = function(e) {}
            ,
            e.prototype.teardown = function() {}
            ,
            e.prototype.handshake = function(e) {}
            ,
            e
        }();
        D("schema", ne),
        D("none", ie),
        t.Auth = Y,
        t.Client = te,
        t.Room = V,
        t.SchemaSerializer = ne,
        t.registerSerializer = D,
        Object.defineProperty(t, "__esModule", {
            value: !0
        })
    }(t.exports)
}
));