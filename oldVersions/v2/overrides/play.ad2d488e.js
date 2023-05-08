window.gc = window.gc || {
	version: "0.1.0"
};

console.log(`Gimkit Cheat Override v${gc.version} loaded!`);

(function() {
    // check for an update to the script
    try {
        fetch("https://raw.githubusercontent.com/TheLazySquid/GimkitCheat/main/overrides/play.ad2d488e.js")
        // make sure the response is valid
        .then(res => {
            if(!res.ok) return null
            return res.text()
        })
        // check if the version is different
        .then(script => {        
            if(!script) return
            if(script.includes(`version: "${gc.version}"`)) return
            alert(`A new version of Gimkit Cheat Override is available! Some scripts may not run properly unless you update.
            Instructions on how to update can be found here: https://github.com/TheLazySquid/GimkitCheat#updating-the-script`)
        })
    } catch (e) {
        // ignore errors
    }
	// initalize standard stuff so multiple scripts can run simultaneously
	class GCHud {
		constructor() {
			this.todos = []
			
            this.enabled = false

			this.hud = document.createElement("div")
			this.hud.classList.add("gc_hud")
			this.hud.innerHTML = `
				<div class="gc_todo_msg" style="display:none;">Please do the following:</div>
			`
			document.body.appendChild(this.hud)

			// make the hud draggable
			let drag = false
			let dragX = 0
			let dragY = 0
			this.hud.addEventListener("mousedown", (e) => {
				drag = true
				dragX = e.clientX - this.hud.offsetLeft
				dragY = e.clientY - this.hud.offsetTop
			})
			window.addEventListener("mouseup", () => drag = false)
			window.addEventListener("mousemove", (e) => {
				if(drag) {
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
				justify-content: space-around;
				align-items: center;
				margin: 1rem;
				border-radius: 0.5rem;
			}

			.gc_hud button {
				width: 100%;
				height: 2rem;
				margin: 0;
				padding: 0;
				background-color: rgba(0, 0, 0, 0.5);
				border: none;
				border-radius: 0.5rem;
			}

			.gc_hud button:hover {
				border: 1px solid white;
			}

			.gc_todo .gc_todo_msg {
				width: 100%;
			}

			.gc_drop_group {
				display: flex;
				flex-direction: row;
				justify-content: space-between;
				align-items: center;
				width: 100%;
			}

			.gc_drop {
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
			`)
			document.adoptedStyleSheets = [injectedCss]			
		}
        enableHud() {
            this.enabled = true
            this.hud.style.display = "flex"
        }
        addBtn(text, callback) {
            this.enableHud()
            let btn = document.createElement("button")
            btn.classList.add("gc_btn")
            btn.innerHTML = text
            btn.addEventListener("click", callback)
            btn.addEventListener("keydown", (e) => {
                e.preventDefault()
            })
            this.hud.appendChild(btn)
        }
		addToggleBtn(on, off, callback) {
            this.enableHud()
			let enabled = false
			let btn = document.createElement("button")
			btn.classList.add("gc_toggle")
			btn.innerHTML = off
			btn.addEventListener("click", function() {
				enabled = !enabled
				this.innerHTML = enabled ? on : off
				callback(enabled)
			})
			btn.addEventListener("keydown", (e) => {
				e.preventDefault()
			})
			this.hud.appendChild(btn)
            return {
				setEnabled: (bool) => {
					enabled = bool
					btn.innerHTML = enabled ? on : off
					callback(enabled)
				}
			}
		}
		addTodo(text) {
            this.enableHud()
			this.todos.push(text)
			let todo = document.createElement("div")
			todo.classList.add("gc_todo")
			todo.innerHTML = text
			this.hud.querySelector(".gc_todo_msg").after(todo)
			this.hud.querySelector(".gc_todo_msg").style.display = "block"
		}
		completeTodo(text) {
			if(this.todos.indexOf(text) == -1) return
			this.hud.querySelectorAll(".gc_todo").forEach((todo) => {
				if(todo.innerHTML == text) {
					todo.remove()
				}
			})
			this.todos.splice(this.todos.indexOf(text), 1)
			if(this.todos.length == 0) this.hud.querySelector(".gc_todo_msg").style.display = "none"
		}
		addDropButton(values, callback, btnMsg = "Go") {
            this.enableHud()
			let group = document.createElement("div")
			group.classList.add("gc_drop_group")
			let drop = document.createElement("select")
			drop.classList.add("gc_drop")
			values.forEach((value) => {
				let option = document.createElement("option")
				option.innerHTML = value
				drop.appendChild(option)
			})
			group.appendChild(drop)
			let btn = document.createElement("button")
			btn.classList.add("gc_drop_btn")
			btn.innerHTML = btnMsg
			btn.addEventListener("click", () => callback(drop.value))
			btn.addEventListener("keydown", (e) => {
				e.preventDefault()
			})
			group.appendChild(btn)
			this.hud.appendChild(group)
			return {
				addOption: (value) => {
					let option = document.createElement("option")
					option.innerHTML = value
					drop.appendChild(option)
				},
				removeOption: (value) => {
					drop.querySelectorAll("option").forEach((option) => {
						if(option.innerHTML == value) option.remove()
					})
				}
			}
		}
	}

	if(!window.gc.hud) {
		let hud = new GCHud()
		window.gc.hud = hud
	}
})()

function t(t, e, n, r) {
    Object.defineProperty(t, e, {
        get: n,
        set: r,
        enumerable: !0,
        configurable: !0
    })
}
function e(t) {
    return t && t.__esModule ? t.default : t
}
var n = ("undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : "undefined" != typeof window ? window : "undefined" != typeof global ? global : {}).parcelRequire388b;
n.register("giIit", (function(e, r) {
    t(e.exports, "default", (function() {
        return a
    }
    ));
    var o = n("ddCrx");
    let i;
    var s;
    (s = i || (i = {})).propertyUpdate = "pU",
    s.fullValue = "fV";
    var a = class {
        constructor() {
            (0,
            o.default)(this, "value", {}),
            (0,
            o.default)(this, "propListeners", []),
            (0,
            o.default)(this, "onPropChange", ((t,e)=>{
                const n = Math.random().toString(36).substring(3);
                return this.propListeners.push({
                    id: n,
                    prop: t,
                    callback: e
                }),
                ()=>this.disposeListener(n)
            }
            )),
            (0,
            o.default)(this, "applyPatches", (t=>{
                t.forEach((t=>{
                    if (t.type !== i.propertyUpdate)
                        if (t.type !== i.fullValue)
                            ;
                        else {
                            const e = t;
                            Object.keys(e.value).forEach((t=>{
                                this.updateProperty(t, e.value[t])
                            }
                            ))
                        }
                    else {
                        const e = t;
                        this.updateProperty(e.value.key, e.value.value)
                    }
                }
                ))
            }
            )),
            (0,
            o.default)(this, "disposeListener", (t=>{
                this.propListeners = this.propListeners.filter((e=>e.id !== t))
            }
            )),
            (0,
            o.default)(this, "onPropertyChanged", ((t,e)=>{
                this.propListeners.filter((e=>e.prop === t)).forEach((t=>t.callback(e)))
            }
            )),
            (0,
            o.default)(this, "updateProperty", ((t,e)=>{
                void 0 !== this.value[t] ? this.value[t] !== e && (this.value[t] = e,
                this.onPropertyChanged(t, e)) : (this.value[t] = e,
                this.onPropertyChanged(t, e))
            }
            ))
        }
    }
}
)),
n.register("ducRl", (function(r, o) {
    t(r.exports, "default", (function() {
        return l
    }
    ));
    var i = n("4E2dX")
      , s = n("h5GuL")
      , a = n("e0E4T")
      , c = n("2ls1e")
      , u = n("g8i9X");
    const h = ()=>window.devicePixelRatio || 1
      , f = t=>{
        t.preventDefault();
        const e = t.changedTouches[0]
          , n = document.createEvent("MouseEvent")
          , r = {
            touchstart: "mousedown",
            touchmove: "mousemove",
            touchend: "mouseup"
        }[t.type];
        r && (n.initMouseEvent(r, !0, !0, window, 1, e.screenX, e.screenY, e.clientX, e.clientY, !1, !1, !1, !1, 0, null),
        e.target.dispatchEvent(n))
    }
      , p = t=>{
        var e, n;
        return {
            x: (null == t || null === (e = t.nativeEvent) || void 0 === e ? void 0 : e.offsetX) || 0,
            y: (null == t || null === (n = t.nativeEvent) || void 0 === n ? void 0 : n.offsetY) || 0
        }
    }
    ;
    var l = c.forwardRef(((t,n)=>{
        const [r,o] = c.useState("")
          , l = c.useRef(!1)
          , d = c.useRef(!1)
          , y = c.useRef(null)
          , g = c.useRef(null)
          , m = c.useRef([])
          , v = c.useRef(-1)
          , C = c.useRef({
            x: 0,
            y: 0
        })
          , b = c.useRef(t.color || s.default.Black)
          , w = c.useRef(t.strokeWidth || 2)
          , x = c.useRef(null)
          , k = c.useRef(null)
          , _ = ()=>{
            d.current = !0
        }
          , F = ()=>{
            d.current = !1
        }
          , E = c.useMemo((()=>{
            const e = (0,
            a.throttle)((t=>{
                if (!l.current)
                    return;
                if (!d.current)
                    return;
                const {x: e, y: n} = p(t);
                A({
                    xStart: C.current.x,
                    yStart: C.current.y,
                    xEnd: e,
                    yEnd: n,
                    color: b.current,
                    width: w.current
                }, !0),
                C.current = {
                    x: e,
                    y: n
                }
            }
            ), 10);
            return n=>{
                t.canEdit && (n.persist(),
                e(n))
            }
        }
        ), [t.canEdit])
          , A = (e,n)=>{
            const {xStart: r, yStart: o, xEnd: i, yEnd: s, color: a, width: c} = e
              , u = g.current
              , h = y.current;
            if (u.beginPath(),
            u.moveTo(r, o),
            u.lineTo(i, s),
            u.strokeStyle = a,
            u.lineWidth = c,
            u.stroke(),
            u.closePath(),
            n && t.emitLine) {
                const n = e;
                e.xStart /= h.clientWidth,
                e.yStart /= h.clientHeight,
                e.xEnd /= h.clientWidth,
                e.yEnd /= h.clientHeight,
                e.width /= (h.clientWidth + h.clientHeight) / 2,
                t.emitLine(n)
            }
        }
          , S = ()=>{
            const t = g.current
              , e = y.current;
            m.current = [...m.current, t.getImageData(0, 0, e.width, e.height)],
            v.current = v.current + 1,
            B()
        }
          , B = ()=>{
            const e = y.current;
            t.onLatestImage && (null == e ? void 0 : e.toDataURL) && t.onLatestImage(e.toDataURL("image/jpeg"))
        }
          , R = ()=>{
            const t = g.current
              , e = y.current;
            t.clearRect(0, 0, e.width, e.height),
            t.fillStyle = "white",
            t.fillRect(0, 0, e.width, e.height),
            S()
        }
          , O = ()=>{
            v.current <= 0 ? R() : (v.current = v.current - 1,
            m.current = [...m.current.slice(0, m.current.length - 1)],
            g.current.putImageData(m.current[v.current], 0, 0),
            B())
        }
          , j = t=>{
            const e = y.current
              , n = t;
            t.xStart *= e.clientWidth,
            t.yStart *= e.clientHeight,
            t.xEnd *= e.clientWidth,
            t.yEnd *= e.clientHeight,
            t.width *= (e.clientWidth + e.clientHeight) / 2,
            A(n, !1)
        }
          , T = t=>{
            const e = g.current
              , n = y.current
              , r = new Image;
            r.onload = ()=>{
                e.drawImage(r, 0, 0, n.width / h(), n.height / h())
            }
            ,
            r.src = t
        }
        ;
        return e(u)((()=>{
            const t = y.current
              , e = g.current;
            if (!t || !e)
                return;
            const n = t.toDataURL()
              , r = t.getBoundingClientRect();
            t.width = r.width * h(),
            t.height = r.height * h(),
            e.scale(h(), h()),
            e.lineCap = "round",
            e.lineJoin = "round",
            m.current = [],
            v.current = -1,
            T(n)
        }
        ), 100, [t.width, t.height]),
        c.useImperativeHandle(n, (()=>({
            clear: R,
            undo: O,
            addLine: j,
            drawImage: T
        }))),
        c.useEffect((()=>{
            const e = y.current
              , n = x.current
              , r = e.getBoundingClientRect();
            e.width = r.width * h(),
            e.height = r.height * h();
            const o = e.getContext("2d");
            o.scale(h(), h()),
            o.fillStyle = "white",
            o.fillRect(0, 0, e.width, e.height),
            o.lineCap = "round",
            o.lineJoin = "round",
            g.current = o,
            t.initialImage && T(t.initialImage);
            const i = n.getContext("2d");
            k.current = i,
            document.addEventListener("mousedown", _),
            document.addEventListener("mouseup", F)
        }
        ), []),
        c.useEffect((()=>{
            const e = x.current
              , n = k.current;
            if (!e || !n)
                return;
            const r = t.strokeWidth;
            e.width = r,
            e.height = r,
            n.clearRect(0, 0, e.width, e.height),
            n.beginPath(),
            n.arc(e.width / 2, e.height / 2, r / 2, 0, 2 * Math.PI),
            n.fillStyle = t.color,
            n.fill();
            const i = e.toDataURL("image");
            o(i)
        }
        ), [t.color, t.strokeWidth]),
        c.useEffect((()=>{
            b.current = t.color
        }
        ), [t.color]),
        c.useEffect((()=>{
            w.current = t.strokeWidth
        }
        ), [t.strokeWidth]),
        c.useEffect((()=>{
            !t.canEdit && l.current && B()
        }
        ), [t.canEdit]),
        c.useEffect((()=>()=>{
            t.canEdit && l.current && B()
        }
        ), []),
        (0,
        i.jsxs)(i.Fragment, {
            children: [(0,
            i.jsx)("canvas", {
                style: {
                    width: t.width,
                    height: t.height,
                    cursor: t.canEdit ? `url(${r}) ${w.current / 2} ${w.current / 2}, auto` : "auto",
                    background: s.default.White
                },
                ref: y,
                onMouseDown: e=>{
                    if (!t.canEdit)
                        return;
                    const {x: n, y: r} = p(e);
                    C.current = {
                        x: n,
                        y: r
                    },
                    l.current = !0
                }
                ,
                onMouseUp: e=>{
                    if (!t.canEdit)
                        return;
                    const {x: n, y: r} = p(e);
                    l.current && (l.current = !1,
                    A({
                        xStart: C.current.x,
                        yStart: C.current.y,
                        xEnd: n,
                        yEnd: r,
                        color: b.current,
                        width: w.current
                    }, !0),
                    S())
                }
                ,
                onMouseMove: E,
                onTouchStart: f,
                onTouchEnd: f,
                onTouchCancel: f,
                onTouchMove: f
            }), (0,
            i.jsx)("canvas", {
                style: {
                    display: "none"
                },
                ref: x
            })]
        })
    }
    ))
}
)),
n.register("g8i9X", (function(t, e) {
    Object.defineProperty(t.exports, "__esModule", {
        value: !0
    }),
    t.exports.useThrottledEffect = void 0;
    var r = n("2ls1e");
    function o(t) {
        if (Array.isArray(t)) {
            for (var e = 0, n = Array(t.length); e < t.length; e++)
                n[e] = t[e];
            return n
        }
        return Array.from(t)
    }
    var i = t.exports.useThrottledEffect = function(t, e) {
        var n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : []
          , i = (0,
        r.useRef)(Date.now());
        (0,
        r.useEffect)((function() {
            var n = setTimeout((function() {
                Date.now() - i.current >= e && (t(),
                i.current = Date.now())
            }
            ), e - (Date.now() - i.current));
            return function() {
                clearTimeout(n)
            }
        }
        ), [e].concat(o(n)))
    }
    ;
    t.exports.default = i
}
)),
n.register("4jXfN", (function(e, r) {
    t(e.exports, "default", (function() {
        return u
    }
    ));
    var o = n("4E2dX");
    n("2ls1e");
    var i = n("58cop");
    let s, a, c = t=>t;
    var u = t=>(0,
    o.jsxs)(h, {
        children: [(0,
        o.jsx)("div", {
            className: "area",
            children: (0,
            o.jsxs)("ul", {
                className: "circles",
                children: [(0,
                o.jsx)("li", {}), (0,
                o.jsx)("li", {}), (0,
                o.jsx)("li", {}), (0,
                o.jsx)("li", {}), (0,
                o.jsx)("li", {}), (0,
                o.jsx)("li", {}), (0,
                o.jsx)("li", {}), (0,
                o.jsx)("li", {}), (0,
                o.jsx)("li", {}), (0,
                o.jsx)("li", {})]
            })
        }), (0,
        o.jsx)(f, {
            children: t.children
        })]
    });
    const h = i.default.div(s || (s = c`
  flex: 1;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  position: relative;

  .area {
    background: #060ce9;
    background: linear-gradient(to left, #4527a0, #1565c0);
    width: 100%;
    height: 100%;
  }

  .circles {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .circles li {
    position: absolute;
    display: block;
    list-style: none;
    width: 20px;
    height: 20px;
    background: rgba(255, 255, 255, 0.2);
    animation: animate 25s linear infinite;
    bottom: -150px;
  }

  .circles li:nth-child(1) {
    left: 25%;
    width: 80px;
    height: 80px;
    animation-delay: 0s;
  }

  .circles li:nth-child(2) {
    left: 10%;
    width: 20px;
    height: 20px;
    animation-delay: 2s;
    animation-duration: 12s;
  }

  .circles li:nth-child(3) {
    left: 70%;
    width: 20px;
    height: 20px;
    animation-delay: 4s;
  }

  .circles li:nth-child(4) {
    left: 40%;
    width: 60px;
    height: 60px;
    animation-delay: 0s;
    animation-duration: 18s;
  }

  .circles li:nth-child(5) {
    left: 65%;
    width: 20px;
    height: 20px;
    animation-delay: 0s;
  }

  .circles li:nth-child(6) {
    left: 75%;
    width: 110px;
    height: 110px;
    animation-delay: 3s;
  }

  .circles li:nth-child(7) {
    left: 35%;
    width: 150px;
    height: 150px;
    animation-delay: 7s;
  }

  .circles li:nth-child(8) {
    left: 50%;
    width: 25px;
    height: 25px;
    animation-delay: 15s;
    animation-duration: 45s;
  }

  .circles li:nth-child(9) {
    left: 20%;
    width: 15px;
    height: 15px;
    animation-delay: 2s;
    animation-duration: 35s;
  }

  .circles li:nth-child(10) {
    left: 85%;
    width: 150px;
    height: 150px;
    animation-delay: 0s;
    animation-duration: 11s;
  }

  @keyframes animate {
    0% {
      transform: translateY(0) rotate(0deg);
      opacity: 1;
      border-radius: 0;
    }

    100% {
      transform: translateY(-1000px) rotate(720deg);
      opacity: 0;
      border-radius: 50%;
    }
  }
`))
      , f = i.default.div.attrs({
        className: "maxAll"
    })(a || (a = c`
  position: absolute;
  top: 0;
  left: 0;
`))
}
)),
n.register("eY7Xf", (function(t, e) {
    var r = t.exports && t.exports.__importDefault || function(t) {
        return t && t.__esModule ? t : {
            default: t
        }
    }
    ;
    Object.defineProperty(t.exports, "__esModule", {
        value: !0
    });
    const o = r(n("551b1"));
    t.exports.Client = o.default;
    const i = r(n("5MVc0"));
    t.exports.Room = i.default
}
)),
n.register("551b1", (function(t, e) {
    var r = t.exports && t.exports.__importDefault || function(t) {
        return t && t.__esModule ? t : {
            default: t
        }
    }
    ;
    Object.defineProperty(t.exports, "__esModule", {
        value: !0
    });
    const o = r(n("eZGpi"))
      , i = r(n("fcOKg"))
      , s = r(n("2ppBl"))
      , a = r(n("gooHl"));
    var c = n("iXPWM");
    const u = r(n("dccKP"))
      , h = r(n("5MVc0"));
    t.exports.default = class {
        createRoom(t, e) {
            const n = Math.random().toString();
            this.socket.emit(a.default.createNewRoom, {
                type: t,
                options: e,
                uniqueRequestId: n
            });
            const r = new h.default(this.socket,e);
            return this.socket.on(`${n}-create`, (t=>{
                r._setRoomId(t),
                r.onCreate.call(t),
                this.joinRoom(t, e, r)
            }
            )),
            this.socket.on(`${n}-error`, (t=>{
                r.onJoinError.call(t)
            }
            )),
            r
        }
        joinRoom(t, e, n) {
            const r = n || new h.default(this.socket,e,t);
            return r.onJoinAttempt.call(),
            r.joined || this.socket.emit(a.default.joinRoom, {
                roomId: t,
                options: e
            }),
            this.rooms.some((e=>e.id === t)) || this.rooms.push(r),
            r
        }
        constructor(t, e) {
            this.rooms = [],
            this.onConnect = new s.default,
            this.onConnectError = new s.default,
            this.onDisconnect = new s.default,
            this.onReconnect = new s.default,
            this.onReconnectAttempt = new s.default,
            this.latency = 0,
            this.useClientIdSaving = !0,
            this.disconnect = ()=>{
                this.socket.disconnect()
            }
            ,
            this.connect = ()=>{
                this.socket.connect()
            }
            ,
            e && e.blockClientIdSaving && (this.useClientIdSaving = !1),
            this.socket = o.default(t, {
                path: "/blueboat",
                parser: i.default,
                transports: e.transports || ["websocket"],
                query: {
                    id: localStorage && this.useClientIdSaving && localStorage.getItem(c.BLUEBOAT_ID + (e && e.clientIdSuffix ? e.clientIdSuffix : "")) || ""
                },
                reconnectionDelay: 500,
                reconnectionDelayMax: 1500,
                randomizationFactor: 0
            }),
            this.socket.on("connect_error", (t=>this.onConnectError.call(t))),
            this.socket.on("error", (t=>this.onConnectError.call(t))),
            this.socket.on(u.default.clientIdSet, (t=>{
                localStorage && this.useClientIdSaving && localStorage.setItem(c.BLUEBOAT_ID + (e && e.clientIdSuffix ? e.clientIdSuffix : ""), t),
                this.socket.io.opts.query.id = t,
                this.id = t,
                this.sessionId = this.socket.id,
                this.rooms.length && this.rooms.forEach((t=>this.joinRoom(t.id, t.initialJoinOptions, t))),
                this.onConnect.call()
            }
            )),
            this.socket.on("pong", (t=>{
                this.latency = t
            }
            )),
            this.socket.on("reconnect", (t=>this.onReconnect.call(t))),
            this.socket.on("reconnect_attempt", (t=>{
                this.onReconnectAttempt.call(t)
            }
            )),
            this.socket.on("disconnect", (t=>{
                this.onDisconnect.call(t),
                this.rooms.forEach((e=>{
                    e.joined = !1,
                    e.onLeave.call(t)
                }
                ))
            }
            ))
        }
    }
}
)),
n.register("eZGpi", (function(t, e) {
    var r = n("hMJkj")
      , o = n("7fUpH")
      , i = n("a8kz7")("socket.io-client");
    t.exports = e = a;
    var s = e.managers = {};
    function a(t, e) {
        "object" == typeof t && (e = t,
        t = void 0),
        e = e || {};
        var o, a = r(t), c = a.source, u = a.id, h = a.path, f = s[u] && h in s[u].nsps;
        return e.forceNew || e["force new connection"] || !1 === e.multiplex || f ? (i("ignoring socket cache for %s", c),
        o = n("8vQo5")(c, e)) : (s[u] || (i("new io instance for %s", c),
        s[u] = n("8vQo5")(c, e)),
        o = s[u]),
        a.query && !e.query && (e.query = a.query),
        o.socket(a.path, e)
    }
    e.protocol = o.protocol,
    e.connect = a,
    e.Manager = n("8vQo5"),
    e.Socket = n("ipyCf")
}
)),
n.register("hMJkj", (function(t, e) {
    var r = n("jiXNb")
      , o = n("a8kz7")("socket.io-client:url");
    t.exports = function(t, e) {
        var n = t;
        e = e || "undefined" != typeof location && location,
        null == t && (t = e.protocol + "//" + e.host);
        "string" == typeof t && ("/" === t.charAt(0) && (t = "/" === t.charAt(1) ? e.protocol + t : e.host + t),
        /^(https?|wss?):\/\//.test(t) || (o("protocol-less url %s", t),
        t = void 0 !== e ? e.protocol + "//" + t : "https://" + t),
        o("parse %s", t),
        n = r(t));
        n.port || (/^(http|ws)$/.test(n.protocol) ? n.port = "80" : /^(http|ws)s$/.test(n.protocol) && (n.port = "443"));
        n.path = n.path || "/";
        var i = -1 !== n.host.indexOf(":") ? "[" + n.host + "]" : n.host;
        return n.id = n.protocol + "://" + i + ":" + n.port,
        n.href = n.protocol + "://" + i + (e && e.port === n.port ? "" : ":" + n.port),
        n
    }
}
)),
n.register("jiXNb", (function(t, e) {
    var n = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
      , r = ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"];
    t.exports = function(t) {
        var e = t
          , o = t.indexOf("[")
          , i = t.indexOf("]");
        -1 != o && -1 != i && (t = t.substring(0, o) + t.substring(o, i).replace(/:/g, ";") + t.substring(i, t.length));
        for (var s, a, c = n.exec(t || ""), u = {}, h = 14; h--; )
            u[r[h]] = c[h] || "";
        return -1 != o && -1 != i && (u.source = e,
        u.host = u.host.substring(1, u.host.length - 1).replace(/;/g, ":"),
        u.authority = u.authority.replace("[", "").replace("]", "").replace(/;/g, ":"),
        u.ipv6uri = !0),
        u.pathNames = function(t, e) {
            var n = /\/{2,9}/g
              , r = e.replace(n, "/").split("/");
            "/" != e.substr(0, 1) && 0 !== e.length || r.splice(0, 1);
            "/" == e.substr(e.length - 1, 1) && r.splice(r.length - 1, 1);
            return r
        }(0, u.path),
        u.queryKey = (s = u.query,
        a = {},
        s.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, (function(t, e, n) {
            e && (a[e] = n)
        }
        )),
        a),
        u
    }
}
)),
n.register("a8kz7", (function(t, e) {
    var r = n("jz2MG");
    function o() {
        var t;
        try {
            t = e.storage.debug
        } catch (t) {}
        return !t && void 0 !== r && "env"in r && (t = void 0),
        t
    }
    (e = t.exports = n("5ES3i")).log = function() {
        return "object" == typeof console && console.log && Function.prototype.apply.call(console.log, console, arguments)
    }
    ,
    e.formatArgs = function(t) {
        var n = this.useColors;
        if (t[0] = (n ? "%c" : "") + this.namespace + (n ? " %c" : " ") + t[0] + (n ? "%c " : " ") + "+" + e.humanize(this.diff),
        !n)
            return;
        var r = "color: " + this.color;
        t.splice(1, 0, r, "color: inherit");
        var o = 0
          , i = 0;
        t[0].replace(/%[a-zA-Z%]/g, (function(t) {
            "%%" !== t && (o++,
            "%c" === t && (i = o))
        }
        )),
        t.splice(i, 0, r)
    }
    ,
    e.save = function(t) {
        try {
            null == t ? e.storage.removeItem("debug") : e.storage.debug = t
        } catch (t) {}
    }
    ,
    e.load = o,
    e.useColors = function() {
        return !("undefined" == typeof window || !window.process || "renderer" !== window.process.type) || ("undefined" == typeof navigator || !navigator.userAgent || !navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) && ("undefined" != typeof document && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || "undefined" != typeof window && window.console && (window.console.firebug || window.console.exception && window.console.table) || "undefined" != typeof navigator && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31 || "undefined" != typeof navigator && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
    }
    ,
    e.storage = "undefined" != typeof chrome && void 0 !== chrome.storage ? chrome.storage.local : function() {
        try {
            return window.localStorage
        } catch (t) {}
    }(),
    e.colors = ["#0000CC", "#0000FF", "#0033CC", "#0033FF", "#0066CC", "#0066FF", "#0099CC", "#0099FF", "#00CC00", "#00CC33", "#00CC66", "#00CC99", "#00CCCC", "#00CCFF", "#3300CC", "#3300FF", "#3333CC", "#3333FF", "#3366CC", "#3366FF", "#3399CC", "#3399FF", "#33CC00", "#33CC33", "#33CC66", "#33CC99", "#33CCCC", "#33CCFF", "#6600CC", "#6600FF", "#6633CC", "#6633FF", "#66CC00", "#66CC33", "#9900CC", "#9900FF", "#9933CC", "#9933FF", "#99CC00", "#99CC33", "#CC0000", "#CC0033", "#CC0066", "#CC0099", "#CC00CC", "#CC00FF", "#CC3300", "#CC3333", "#CC3366", "#CC3399", "#CC33CC", "#CC33FF", "#CC6600", "#CC6633", "#CC9900", "#CC9933", "#CCCC00", "#CCCC33", "#FF0000", "#FF0033", "#FF0066", "#FF0099", "#FF00CC", "#FF00FF", "#FF3300", "#FF3333", "#FF3366", "#FF3399", "#FF33CC", "#FF33FF", "#FF6600", "#FF6633", "#FF9900", "#FF9933", "#FFCC00", "#FFCC33"],
    e.formatters.j = function(t) {
        try {
            return JSON.stringify(t)
        } catch (t) {
            return "[UnexpectedJSONParseError]: " + t.message
        }
    }
    ,
    e.enable(o())
}
)),
n.register("5ES3i", (function(t, e) {
    function r(t) {
        var n;
        function r() {
            if (r.enabled) {
                var t = r
                  , o = +new Date
                  , i = o - (n || o);
                t.diff = i,
                t.prev = n,
                t.curr = o,
                n = o;
                for (var s = new Array(arguments.length), a = 0; a < s.length; a++)
                    s[a] = arguments[a];
                s[0] = e.coerce(s[0]),
                "string" != typeof s[0] && s.unshift("%O");
                var c = 0;
                s[0] = s[0].replace(/%([a-zA-Z%])/g, (function(n, r) {
                    if ("%%" === n)
                        return n;
                    c++;
                    var o = e.formatters[r];
                    if ("function" == typeof o) {
                        var i = s[c];
                        n = o.call(t, i),
                        s.splice(c, 1),
                        c--
                    }
                    return n
                }
                )),
                e.formatArgs.call(t, s);
                var u = r.log || e.log || console.log.bind(console);
                u.apply(t, s)
            }
        }
        return r.namespace = t,
        r.enabled = e.enabled(t),
        r.useColors = e.useColors(),
        r.color = function(t) {
            var n, r = 0;
            for (n in t)
                r = (r << 5) - r + t.charCodeAt(n),
                r |= 0;
            return e.colors[Math.abs(r) % e.colors.length]
        }(t),
        r.destroy = o,
        "function" == typeof e.init && e.init(r),
        e.instances.push(r),
        r
    }
    function o() {
        var t = e.instances.indexOf(this);
        return -1 !== t && (e.instances.splice(t, 1),
        !0)
    }
    (e = t.exports = r.debug = r.default = r).coerce = function(t) {
        return t instanceof Error ? t.stack || t.message : t
    }
    ,
    e.disable = function() {
        e.enable("")
    }
    ,
    e.enable = function(t) {
        var n;
        e.save(t),
        e.names = [],
        e.skips = [];
        var r = ("string" == typeof t ? t : "").split(/[\s,]+/)
          , o = r.length;
        for (n = 0; n < o; n++)
            r[n] && ("-" === (t = r[n].replace(/\*/g, ".*?"))[0] ? e.skips.push(new RegExp("^" + t.substr(1) + "$")) : e.names.push(new RegExp("^" + t + "$")));
        for (n = 0; n < e.instances.length; n++) {
            var i = e.instances[n];
            i.enabled = e.enabled(i.namespace)
        }
    }
    ,
    e.enabled = function(t) {
        if ("*" === t[t.length - 1])
            return !0;
        var n, r;
        for (n = 0,
        r = e.skips.length; n < r; n++)
            if (e.skips[n].test(t))
                return !1;
        for (n = 0,
        r = e.names.length; n < r; n++)
            if (e.names[n].test(t))
                return !0;
        return !1
    }
    ,
    e.humanize = n("7FZxD"),
    e.instances = [],
    e.names = [],
    e.skips = [],
    e.formatters = {}
}
)),
n.register("7FZxD", (function(t, e) {
    var n = 1e3
      , r = 6e4
      , o = 36e5
      , i = 864e5
      , s = 315576e5;
    function a(t, e, n) {
        if (!(t < e))
            return t < 1.5 * e ? Math.floor(t / e) + " " + n : Math.ceil(t / e) + " " + n + "s"
    }
    t.exports = function(t, e) {
        e = e || {};
        var c, u = typeof t;
        if ("string" === u && t.length > 0)
            return function(t) {
                if ((t = String(t)).length > 100)
                    return;
                var e = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(t);
                if (!e)
                    return;
                var a = parseFloat(e[1]);
                switch ((e[2] || "ms").toLowerCase()) {
                case "years":
                case "year":
                case "yrs":
                case "yr":
                case "y":
                    return a * s;
                case "days":
                case "day":
                case "d":
                    return a * i;
                case "hours":
                case "hour":
                case "hrs":
                case "hr":
                case "h":
                    return a * o;
                case "minutes":
                case "minute":
                case "mins":
                case "min":
                case "m":
                    return a * r;
                case "seconds":
                case "second":
                case "secs":
                case "sec":
                case "s":
                    return a * n;
                case "milliseconds":
                case "millisecond":
                case "msecs":
                case "msec":
                case "ms":
                    return a;
                default:
                    return
                }
            }(t);
        if ("number" === u && !1 === isNaN(t))
            return e.long ? a(c = t, i, "day") || a(c, o, "hour") || a(c, r, "minute") || a(c, n, "second") || c + " ms" : function(t) {
                return t >= i ? Math.round(t / i) + "d" : t >= o ? Math.round(t / o) + "h" : t >= r ? Math.round(t / r) + "m" : t >= n ? Math.round(t / n) + "s" : t + "ms"
            }(t);
        throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(t))
    }
}
)),
n.register("7fUpH", (function(e, r) {
    var o, i, s, a, c, u, h, f, p, l, d;
    t(e.exports, "protocol", (function() {
        return o
    }
    ), (function(t) {
        return o = t
    }
    )),
    t(e.exports, "types", (function() {
        return i
    }
    ), (function(t) {
        return i = t
    }
    )),
    t(e.exports, "CONNECT", (function() {
        return s
    }
    ), (function(t) {
        return s = t
    }
    )),
    t(e.exports, "DISCONNECT", (function() {
        return a
    }
    ), (function(t) {
        return a = t
    }
    )),
    t(e.exports, "EVENT", (function() {
        return c
    }
    ), (function(t) {
        return c = t
    }
    )),
    t(e.exports, "ACK", (function() {
        return u
    }
    ), (function(t) {
        return u = t
    }
    )),
    t(e.exports, "ERROR", (function() {
        return h
    }
    ), (function(t) {
        return h = t
    }
    )),
    t(e.exports, "BINARY_EVENT", (function() {
        return f
    }
    ), (function(t) {
        return f = t
    }
    )),
    t(e.exports, "BINARY_ACK", (function() {
        return p
    }
    ), (function(t) {
        return p = t
    }
    )),
    t(e.exports, "Encoder", (function() {
        return l
    }
    ), (function(t) {
        return l = t
    }
    )),
    t(e.exports, "Decoder", (function() {
        return d
    }
    ), (function(t) {
        return d = t
    }
    ));
    var y = n("5wzbU")("socket.io-parser")
      , g = n("6nrxU")
      , m = n("1VmW2")
      , v = n("2qvaj")
      , C = n("7xI2w");
    function b() {}
    o = 4,
    i = ["CONNECT", "DISCONNECT", "EVENT", "ACK", "ERROR", "BINARY_EVENT", "BINARY_ACK"],
    s = 0,
    a = 1,
    c = 2,
    u = 3,
    f = 5,
    p = 6,
    l = b,
    d = k;
    var w = (h = 4) + '"encode error"';
    function x(t) {
        var e = "" + t.type;
        if (f !== t.type && p !== t.type || (e += t.attachments + "-"),
        t.nsp && "/" !== t.nsp && (e += t.nsp + ","),
        null != t.id && (e += t.id),
        null != t.data) {
            var n = function(t) {
                try {
                    return JSON.stringify(t)
                } catch (t) {
                    return !1
                }
            }(t.data);
            if (!1 === n)
                return w;
            e += n
        }
        return y("encoded %j as %s", t, e),
        e
    }
    function k() {
        this.reconstructor = null
    }
    function _(t) {
        this.reconPack = t,
        this.buffers = []
    }
    function F(t) {
        return {
            type: h,
            data: "parser error: " + t
        }
    }
    b.prototype.encode = function(t, e) {
        (y("encoding packet %j", t),
        f === t.type || p === t.type) ? function(t, e) {
            function n(t) {
                var n = m.deconstructPacket(t)
                  , r = x(n.packet)
                  , o = n.buffers;
                o.unshift(r),
                e(o)
            }
            m.removeBlobs(t, n)
        }(t, e) : e([x(t)])
    }
    ,
    g(k.prototype),
    k.prototype.add = function(t) {
        var e;
        if ("string" == typeof t)
            e = function(t) {
                var e = 0
                  , n = {
                    type: Number(t.charAt(0))
                };
                if (null == i[n.type])
                    return F("unknown packet type " + n.type);
                if (f === n.type || p === n.type) {
                    for (var r = ""; "-" !== t.charAt(++e) && (r += t.charAt(e),
                    e != t.length); )
                        ;
                    if (r != Number(r) || "-" !== t.charAt(e))
                        throw new Error("Illegal attachments");
                    n.attachments = Number(r)
                }
                if ("/" === t.charAt(e + 1))
                    for (n.nsp = ""; ++e; ) {
                        if ("," === (s = t.charAt(e)))
                            break;
                        if (n.nsp += s,
                        e === t.length)
                            break
                    }
                else
                    n.nsp = "/";
                var o = t.charAt(e + 1);
                if ("" !== o && Number(o) == o) {
                    for (n.id = ""; ++e; ) {
                        var s;
                        if (null == (s = t.charAt(e)) || Number(s) != s) {
                            --e;
                            break
                        }
                        if (n.id += t.charAt(e),
                        e === t.length)
                            break
                    }
                    n.id = Number(n.id)
                }
                if (t.charAt(++e)) {
                    var a = function(t) {
                        try {
                            return JSON.parse(t)
                        } catch (t) {
                            return !1
                        }
                    }(t.substr(e));
                    if (!(!1 !== a && (n.type === h || v(a))))
                        return F("invalid payload");
                    n.data = a
                }
                return y("decoded %s as %j", t, n),
                n
            }(t),
            f === e.type || p === e.type ? (this.reconstructor = new _(e),
            0 === this.reconstructor.reconPack.attachments && this.emit("decoded", e)) : this.emit("decoded", e);
        else {
            if (!C(t) && !t.base64)
                throw new Error("Unknown type: " + t);
            if (!this.reconstructor)
                throw new Error("got binary data when not reconstructing a packet");
            (e = this.reconstructor.takeBinaryData(t)) && (this.reconstructor = null,
            this.emit("decoded", e))
        }
    }
    ,
    k.prototype.destroy = function() {
        this.reconstructor && this.reconstructor.finishedReconstruction()
    }
    ,
    _.prototype.takeBinaryData = function(t) {
        if (this.buffers.push(t),
        this.buffers.length === this.reconPack.attachments) {
            var e = m.reconstructPacket(this.reconPack, this.buffers);
            return this.finishedReconstruction(),
            e
        }
        return null
    }
    ,
    _.prototype.finishedReconstruction = function() {
        this.reconPack = null,
        this.buffers = []
    }
}
)),
n.register("5wzbU", (function(t, e) {
    var r = n("jz2MG");
    function o() {
        var t;
        try {
            t = e.storage.debug
        } catch (t) {}
        return !t && void 0 !== r && "env"in r && (t = void 0),
        t
    }
    (e = t.exports = n("fL4yw")).log = function() {
        return "object" == typeof console && console.log && Function.prototype.apply.call(console.log, console, arguments)
    }
    ,
    e.formatArgs = function(t) {
        var n = this.useColors;
        if (t[0] = (n ? "%c" : "") + this.namespace + (n ? " %c" : " ") + t[0] + (n ? "%c " : " ") + "+" + e.humanize(this.diff),
        !n)
            return;
        var r = "color: " + this.color;
        t.splice(1, 0, r, "color: inherit");
        var o = 0
          , i = 0;
        t[0].replace(/%[a-zA-Z%]/g, (function(t) {
            "%%" !== t && (o++,
            "%c" === t && (i = o))
        }
        )),
        t.splice(i, 0, r)
    }
    ,
    e.save = function(t) {
        try {
            null == t ? e.storage.removeItem("debug") : e.storage.debug = t
        } catch (t) {}
    }
    ,
    e.load = o,
    e.useColors = function() {
        return !("undefined" == typeof window || !window.process || "renderer" !== window.process.type) || ("undefined" == typeof navigator || !navigator.userAgent || !navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) && ("undefined" != typeof document && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || "undefined" != typeof window && window.console && (window.console.firebug || window.console.exception && window.console.table) || "undefined" != typeof navigator && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31 || "undefined" != typeof navigator && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
    }
    ,
    e.storage = "undefined" != typeof chrome && void 0 !== chrome.storage ? chrome.storage.local : function() {
        try {
            return window.localStorage
        } catch (t) {}
    }(),
    e.colors = ["#0000CC", "#0000FF", "#0033CC", "#0033FF", "#0066CC", "#0066FF", "#0099CC", "#0099FF", "#00CC00", "#00CC33", "#00CC66", "#00CC99", "#00CCCC", "#00CCFF", "#3300CC", "#3300FF", "#3333CC", "#3333FF", "#3366CC", "#3366FF", "#3399CC", "#3399FF", "#33CC00", "#33CC33", "#33CC66", "#33CC99", "#33CCCC", "#33CCFF", "#6600CC", "#6600FF", "#6633CC", "#6633FF", "#66CC00", "#66CC33", "#9900CC", "#9900FF", "#9933CC", "#9933FF", "#99CC00", "#99CC33", "#CC0000", "#CC0033", "#CC0066", "#CC0099", "#CC00CC", "#CC00FF", "#CC3300", "#CC3333", "#CC3366", "#CC3399", "#CC33CC", "#CC33FF", "#CC6600", "#CC6633", "#CC9900", "#CC9933", "#CCCC00", "#CCCC33", "#FF0000", "#FF0033", "#FF0066", "#FF0099", "#FF00CC", "#FF00FF", "#FF3300", "#FF3333", "#FF3366", "#FF3399", "#FF33CC", "#FF33FF", "#FF6600", "#FF6633", "#FF9900", "#FF9933", "#FFCC00", "#FFCC33"],
    e.formatters.j = function(t) {
        try {
            return JSON.stringify(t)
        } catch (t) {
            return "[UnexpectedJSONParseError]: " + t.message
        }
    }
    ,
    e.enable(o())
}
)),
n.register("fL4yw", (function(t, e) {
    function r(t) {
        var n;
        function r() {
            if (r.enabled) {
                var t = r
                  , o = +new Date
                  , i = o - (n || o);
                t.diff = i,
                t.prev = n,
                t.curr = o,
                n = o;
                for (var s = new Array(arguments.length), a = 0; a < s.length; a++)
                    s[a] = arguments[a];
                s[0] = e.coerce(s[0]),
                "string" != typeof s[0] && s.unshift("%O");
                var c = 0;
                s[0] = s[0].replace(/%([a-zA-Z%])/g, (function(n, r) {
                    if ("%%" === n)
                        return n;
                    c++;
                    var o = e.formatters[r];
                    if ("function" == typeof o) {
                        var i = s[c];
                        n = o.call(t, i),
                        s.splice(c, 1),
                        c--
                    }
                    return n
                }
                )),
                e.formatArgs.call(t, s);
                var u = r.log || e.log || console.log.bind(console);
                u.apply(t, s)
            }
        }
        return r.namespace = t,
        r.enabled = e.enabled(t),
        r.useColors = e.useColors(),
        r.color = function(t) {
            var n, r = 0;
            for (n in t)
                r = (r << 5) - r + t.charCodeAt(n),
                r |= 0;
            return e.colors[Math.abs(r) % e.colors.length]
        }(t),
        r.destroy = o,
        "function" == typeof e.init && e.init(r),
        e.instances.push(r),
        r
    }
    function o() {
        var t = e.instances.indexOf(this);
        return -1 !== t && (e.instances.splice(t, 1),
        !0)
    }
    (e = t.exports = r.debug = r.default = r).coerce = function(t) {
        return t instanceof Error ? t.stack || t.message : t
    }
    ,
    e.disable = function() {
        e.enable("")
    }
    ,
    e.enable = function(t) {
        var n;
        e.save(t),
        e.names = [],
        e.skips = [];
        var r = ("string" == typeof t ? t : "").split(/[\s,]+/)
          , o = r.length;
        for (n = 0; n < o; n++)
            r[n] && ("-" === (t = r[n].replace(/\*/g, ".*?"))[0] ? e.skips.push(new RegExp("^" + t.substr(1) + "$")) : e.names.push(new RegExp("^" + t + "$")));
        for (n = 0; n < e.instances.length; n++) {
            var i = e.instances[n];
            i.enabled = e.enabled(i.namespace)
        }
    }
    ,
    e.enabled = function(t) {
        if ("*" === t[t.length - 1])
            return !0;
        var n, r;
        for (n = 0,
        r = e.skips.length; n < r; n++)
            if (e.skips[n].test(t))
                return !1;
        for (n = 0,
        r = e.names.length; n < r; n++)
            if (e.names[n].test(t))
                return !0;
        return !1
    }
    ,
    e.humanize = n("7ByzO"),
    e.instances = [],
    e.names = [],
    e.skips = [],
    e.formatters = {}
}
)),
n.register("7ByzO", (function(t, e) {
    var n = 1e3
      , r = 6e4
      , o = 36e5
      , i = 864e5
      , s = 315576e5;
    function a(t, e, n) {
        if (!(t < e))
            return t < 1.5 * e ? Math.floor(t / e) + " " + n : Math.ceil(t / e) + " " + n + "s"
    }
    t.exports = function(t, e) {
        e = e || {};
        var c, u = typeof t;
        if ("string" === u && t.length > 0)
            return function(t) {
                if ((t = String(t)).length > 100)
                    return;
                var e = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(t);
                if (!e)
                    return;
                var a = parseFloat(e[1]);
                switch ((e[2] || "ms").toLowerCase()) {
                case "years":
                case "year":
                case "yrs":
                case "yr":
                case "y":
                    return a * s;
                case "days":
                case "day":
                case "d":
                    return a * i;
                case "hours":
                case "hour":
                case "hrs":
                case "hr":
                case "h":
                    return a * o;
                case "minutes":
                case "minute":
                case "mins":
                case "min":
                case "m":
                    return a * r;
                case "seconds":
                case "second":
                case "secs":
                case "sec":
                case "s":
                    return a * n;
                case "milliseconds":
                case "millisecond":
                case "msecs":
                case "msec":
                case "ms":
                    return a;
                default:
                    return
                }
            }(t);
        if ("number" === u && !1 === isNaN(t))
            return e.long ? a(c = t, i, "day") || a(c, o, "hour") || a(c, r, "minute") || a(c, n, "second") || c + " ms" : function(t) {
                return t >= i ? Math.round(t / i) + "d" : t >= o ? Math.round(t / o) + "h" : t >= r ? Math.round(t / r) + "m" : t >= n ? Math.round(t / n) + "s" : t + "ms"
            }(t);
        throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(t))
    }
}
)),
n.register("6nrxU", (function(t, e) {
    function n(t) {
        if (t)
            return function(t) {
                for (var e in n.prototype)
                    t[e] = n.prototype[e];
                return t
            }(t)
    }
    t.exports = n,
    n.prototype.on = n.prototype.addEventListener = function(t, e) {
        return this._callbacks = this._callbacks || {},
        (this._callbacks["$" + t] = this._callbacks["$" + t] || []).push(e),
        this
    }
    ,
    n.prototype.once = function(t, e) {
        function n() {
            this.off(t, n),
            e.apply(this, arguments)
        }
        return n.fn = e,
        this.on(t, n),
        this
    }
    ,
    n.prototype.off = n.prototype.removeListener = n.prototype.removeAllListeners = n.prototype.removeEventListener = function(t, e) {
        if (this._callbacks = this._callbacks || {},
        0 == arguments.length)
            return this._callbacks = {},
            this;
        var n, r = this._callbacks["$" + t];
        if (!r)
            return this;
        if (1 == arguments.length)
            return delete this._callbacks["$" + t],
            this;
        for (var o = 0; o < r.length; o++)
            if ((n = r[o]) === e || n.fn === e) {
                r.splice(o, 1);
                break
            }
        return 0 === r.length && delete this._callbacks["$" + t],
        this
    }
    ,
    n.prototype.emit = function(t) {
        this._callbacks = this._callbacks || {};
        for (var e = new Array(arguments.length - 1), n = this._callbacks["$" + t], r = 1; r < arguments.length; r++)
            e[r - 1] = arguments[r];
        if (n) {
            r = 0;
            for (var o = (n = n.slice(0)).length; r < o; ++r)
                n[r].apply(this, e)
        }
        return this
    }
    ,
    n.prototype.listeners = function(t) {
        return this._callbacks = this._callbacks || {},
        this._callbacks["$" + t] || []
    }
    ,
    n.prototype.hasListeners = function(t) {
        return !!this.listeners(t).length
    }
}
)),
n.register("1VmW2", (function(e, r) {
    var o, i, s;
    t(e.exports, "deconstructPacket", (function() {
        return o
    }
    ), (function(t) {
        return o = t
    }
    )),
    t(e.exports, "reconstructPacket", (function() {
        return i
    }
    ), (function(t) {
        return i = t
    }
    )),
    t(e.exports, "removeBlobs", (function() {
        return s
    }
    ), (function(t) {
        return s = t
    }
    ));
    var a = n("2qvaj")
      , c = n("7xI2w")
      , u = Object.prototype.toString
      , h = "function" == typeof Blob || "undefined" != typeof Blob && "[object BlobConstructor]" === u.call(Blob)
      , f = "function" == typeof File || "undefined" != typeof File && "[object FileConstructor]" === u.call(File);
    function p(t, e) {
        if (!t)
            return t;
        if (c(t)) {
            var n = {
                _placeholder: !0,
                num: e.length
            };
            return e.push(t),
            n
        }
        if (a(t)) {
            for (var r = new Array(t.length), o = 0; o < t.length; o++)
                r[o] = p(t[o], e);
            return r
        }
        if ("object" == typeof t && !(t instanceof Date)) {
            r = {};
            for (var i in t)
                r[i] = p(t[i], e);
            return r
        }
        return t
    }
    function l(t, e) {
        if (!t)
            return t;
        if (t && t._placeholder)
            return e[t.num];
        if (a(t))
            for (var n = 0; n < t.length; n++)
                t[n] = l(t[n], e);
        else if ("object" == typeof t)
            for (var r in t)
                t[r] = l(t[r], e);
        return t
    }
    o = function(t) {
        var e = []
          , n = t.data
          , r = t;
        return r.data = p(n, e),
        r.attachments = e.length,
        {
            packet: r,
            buffers: e
        }
    }
    ,
    i = function(t, e) {
        return t.data = l(t.data, e),
        t.attachments = void 0,
        t
    }
    ,
    s = function(t, e) {
        var n = 0
          , r = t;
        !function t(o, i, s) {
            if (!o)
                return o;
            if (h && o instanceof Blob || f && o instanceof File) {
                n++;
                var u = new FileReader;
                u.onload = function() {
                    s ? s[i] = this.result : r = this.result,
                    --n || e(r)
                }
                ,
                u.readAsArrayBuffer(o)
            } else if (a(o))
                for (var p = 0; p < o.length; p++)
                    t(o[p], p, o);
            else if ("object" == typeof o && !c(o))
                for (var l in o)
                    t(o[l], l, o)
        }(r),
        n || e(r)
    }
}
)),
n.register("2qvaj", (function(t, e) {
    var n = {}.toString;
    t.exports = Array.isArray || function(t) {
        return "[object Array]" == n.call(t)
    }
}
)),
n.register("7xI2w", (function(t, e) {
    var r = n("c01sx").Buffer;
    t.exports = function(t) {
        return o && r.isBuffer(t) || i && (t instanceof ArrayBuffer || function(t) {
            return "function" == typeof ArrayBuffer.isView ? ArrayBuffer.isView(t) : t.buffer instanceof ArrayBuffer
        }(t))
    }
    ;
    var o = "function" == typeof r && "function" == typeof r.isBuffer
      , i = "function" == typeof ArrayBuffer
}
)),
n.register("8vQo5", (function(t, e) {
    var r = n("3QRhs")
      , o = n("ipyCf")
      , i = n("6nrxU")
      , s = n("7fUpH")
      , a = n("exeLP")
      , c = n("7zHTY")
      , u = n("a8kz7")("socket.io-client:manager")
      , h = n("4ENQa")
      , f = n("l98mf")
      , p = Object.prototype.hasOwnProperty;
    function l(t, e) {
        if (!(this instanceof l))
            return new l(t,e);
        t && "object" == typeof t && (e = t,
        t = void 0),
        (e = e || {}).path = e.path || "/socket.io",
        this.nsps = {},
        this.subs = [],
        this.opts = e,
        this.reconnection(!1 !== e.reconnection),
        this.reconnectionAttempts(e.reconnectionAttempts || 1 / 0),
        this.reconnectionDelay(e.reconnectionDelay || 1e3),
        this.reconnectionDelayMax(e.reconnectionDelayMax || 5e3),
        this.randomizationFactor(e.randomizationFactor || .5),
        this.backoff = new f({
            min: this.reconnectionDelay(),
            max: this.reconnectionDelayMax(),
            jitter: this.randomizationFactor()
        }),
        this.timeout(null == e.timeout ? 2e4 : e.timeout),
        this.readyState = "closed",
        this.uri = t,
        this.connecting = [],
        this.lastPing = null,
        this.encoding = !1,
        this.packetBuffer = [];
        var n = e.parser || s;
        this.encoder = new n.Encoder,
        this.decoder = new n.Decoder,
        this.autoConnect = !1 !== e.autoConnect,
        this.autoConnect && this.open()
    }
    t.exports = l,
    l.prototype.emitAll = function() {
        for (var t in this.emit.apply(this, arguments),
        this.nsps)
            p.call(this.nsps, t) && this.nsps[t].emit.apply(this.nsps[t], arguments)
    }
    ,
    l.prototype.updateSocketIds = function() {
        for (var t in this.nsps)
            p.call(this.nsps, t) && (this.nsps[t].id = this.generateId(t))
    }
    ,
    l.prototype.generateId = function(t) {
        return ("/" === t ? "" : t + "#") + this.engine.id
    }
    ,
    i(l.prototype),
    l.prototype.reconnection = function(t) {
        return arguments.length ? (this._reconnection = !!t,
        this) : this._reconnection
    }
    ,
    l.prototype.reconnectionAttempts = function(t) {
        return arguments.length ? (this._reconnectionAttempts = t,
        this) : this._reconnectionAttempts
    }
    ,
    l.prototype.reconnectionDelay = function(t) {
        return arguments.length ? (this._reconnectionDelay = t,
        this.backoff && this.backoff.setMin(t),
        this) : this._reconnectionDelay
    }
    ,
    l.prototype.randomizationFactor = function(t) {
        return arguments.length ? (this._randomizationFactor = t,
        this.backoff && this.backoff.setJitter(t),
        this) : this._randomizationFactor
    }
    ,
    l.prototype.reconnectionDelayMax = function(t) {
        return arguments.length ? (this._reconnectionDelayMax = t,
        this.backoff && this.backoff.setMax(t),
        this) : this._reconnectionDelayMax
    }
    ,
    l.prototype.timeout = function(t) {
        return arguments.length ? (this._timeout = t,
        this) : this._timeout
    }
    ,
    l.prototype.maybeReconnectOnOpen = function() {
        !this.reconnecting && this._reconnection && 0 === this.backoff.attempts && this.reconnect()
    }
    ,
    l.prototype.open = l.prototype.connect = function(t, e) {
        if (u("readyState %s", this.readyState),
        ~this.readyState.indexOf("open"))
            return this;
        u("opening %s", this.uri),
        this.engine = r(this.uri, this.opts);
        var n = this.engine
          , o = this;
        this.readyState = "opening",
        this.skipReconnect = !1;
        var i = a(n, "open", (function() {
            o.onopen(),
            t && t()
        }
        ))
          , s = a(n, "error", (function(e) {
            if (u("connect_error"),
            o.cleanup(),
            o.readyState = "closed",
            o.emitAll("connect_error", e),
            t) {
                var n = new Error("Connection error");
                n.data = e,
                t(n)
            } else
                o.maybeReconnectOnOpen()
        }
        ));
        if (!1 !== this._timeout) {
            var c = this._timeout;
            u("connect attempt will timeout after %d", c),
            0 === c && i.destroy();
            var h = setTimeout((function() {
                u("connect attempt timed out after %d", c),
                i.destroy(),
                n.close(),
                n.emit("error", "timeout"),
                o.emitAll("connect_timeout", c)
            }
            ), c);
            this.subs.push({
                destroy: function() {
                    clearTimeout(h)
                }
            })
        }
        return this.subs.push(i),
        this.subs.push(s),
        this
    }
    ,
    l.prototype.onopen = function() {
        u("open"),
        this.cleanup(),
        this.readyState = "open",
        this.emit("open");
        var t = this.engine;
        this.subs.push(a(t, "data", c(this, "ondata"))),
        this.subs.push(a(t, "ping", c(this, "onping"))),
        this.subs.push(a(t, "pong", c(this, "onpong"))),
        this.subs.push(a(t, "error", c(this, "onerror"))),
        this.subs.push(a(t, "close", c(this, "onclose"))),
        this.subs.push(a(this.decoder, "decoded", c(this, "ondecoded")))
    }
    ,
    l.prototype.onping = function() {
        this.lastPing = new Date,
        this.emitAll("ping")
    }
    ,
    l.prototype.onpong = function() {
        this.emitAll("pong", new Date - this.lastPing)
    }
    ,
    l.prototype.ondata = function(t) {
        this.decoder.add(t)
    }
    ,
    l.prototype.ondecoded = function(t) {
        this.emit("packet", t)
    }
    ,
    l.prototype.onerror = function(t) {
        u("error", t),
        this.emitAll("error", t)
    }
    ,
    l.prototype.socket = function(t, e) {
        var n = this.nsps[t];
        if (!n) {
            n = new o(this,t,e),
            this.nsps[t] = n;
            var r = this;
            n.on("connecting", i),
            n.on("connect", (function() {
                n.id = r.generateId(t)
            }
            )),
            this.autoConnect && i()
        }
        function i() {
            ~h(r.connecting, n) || r.connecting.push(n)
        }
        return n
    }
    ,
    l.prototype.destroy = function(t) {
        var e = h(this.connecting, t);
        ~e && this.connecting.splice(e, 1),
        this.connecting.length || this.close()
    }
    ,
    l.prototype.packet = function(t) {
        u("writing packet %j", t);
        var e = this;
        t.query && 0 === t.type && (t.nsp += "?" + t.query),
        e.encoding ? e.packetBuffer.push(t) : (e.encoding = !0,
        this.encoder.encode(t, (function(n) {
            for (var r = 0; r < n.length; r++)
                e.engine.write(n[r], t.options);
            e.encoding = !1,
            e.processPacketQueue()
        }
        )))
    }
    ,
    l.prototype.processPacketQueue = function() {
        if (this.packetBuffer.length > 0 && !this.encoding) {
            var t = this.packetBuffer.shift();
            this.packet(t)
        }
    }
    ,
    l.prototype.cleanup = function() {
        u("cleanup");
        for (var t = this.subs.length, e = 0; e < t; e++) {
            this.subs.shift().destroy()
        }
        this.packetBuffer = [],
        this.encoding = !1,
        this.lastPing = null,
        this.decoder.destroy()
    }
    ,
    l.prototype.close = l.prototype.disconnect = function() {
        u("disconnect"),
        this.skipReconnect = !0,
        this.reconnecting = !1,
        "opening" === this.readyState && this.cleanup(),
        this.backoff.reset(),
        this.readyState = "closed",
        this.engine && this.engine.close()
    }
    ,
    l.prototype.onclose = function(t) {
        u("onclose"),
        this.cleanup(),
        this.backoff.reset(),
        this.readyState = "closed",
        this.emit("close", t),
        this._reconnection && !this.skipReconnect && this.reconnect()
    }
    ,
    l.prototype.reconnect = function() {
        if (this.reconnecting || this.skipReconnect)
            return this;
        var t = this;
        if (this.backoff.attempts >= this._reconnectionAttempts)
            u("reconnect failed"),
            this.backoff.reset(),
            this.emitAll("reconnect_failed"),
            this.reconnecting = !1;
        else {
            var e = this.backoff.duration();
            u("will wait %dms before reconnect attempt", e),
            this.reconnecting = !0;
            var n = setTimeout((function() {
                t.skipReconnect || (u("attempting reconnect"),
                t.emitAll("reconnect_attempt", t.backoff.attempts),
                t.emitAll("reconnecting", t.backoff.attempts),
                t.skipReconnect || t.open((function(e) {
                    e ? (u("reconnect attempt error"),
                    t.reconnecting = !1,
                    t.reconnect(),
                    t.emitAll("reconnect_error", e.data)) : (u("reconnect success"),
                    t.onreconnect())
                }
                )))
            }
            ), e);
            this.subs.push({
                destroy: function() {
                    clearTimeout(n)
                }
            })
        }
    }
    ,
    l.prototype.onreconnect = function() {
        var t = this.backoff.attempts;
        this.reconnecting = !1,
        this.backoff.reset(),
        this.updateSocketIds(),
        this.emitAll("reconnect", t)
    }
}
)),
n.register("3QRhs", (function(t, e) {
    t.exports = n("fjfnR"),
    t.exports.parser = n("fpvHl")
}
)),
n.register("fjfnR", (function(t, e) {
    var r = n("6nrxU")
      , o = n("86aOL")("engine.io-client:socket")
      , i = n("4ENQa")
      , s = n("jiXNb")
      , a = n("87Zdq");
    function c(t, e) {
        if (!(this instanceof c))
            return new c(t,e);
        e = e || {},
        t && "object" == typeof t && (e = t,
        t = null),
        t ? (t = s(t),
        e.hostname = t.host,
        e.secure = "https" === t.protocol || "wss" === t.protocol,
        e.port = t.port,
        t.query && (e.query = t.query)) : e.host && (e.hostname = s(e.host).host),
        this.secure = null != e.secure ? e.secure : "undefined" != typeof location && "https:" === location.protocol,
        e.hostname && !e.port && (e.port = this.secure ? "443" : "80"),
        this.agent = e.agent || !1,
        this.hostname = e.hostname || ("undefined" != typeof location ? location.hostname : "localhost"),
        this.port = e.port || ("undefined" != typeof location && location.port ? location.port : this.secure ? 443 : 80),
        this.query = e.query || {},
        "string" == typeof this.query && (this.query = a.decode(this.query)),
        this.upgrade = !1 !== e.upgrade,
        this.path = (e.path || "/engine.io").replace(/\/$/, "") + "/",
        this.forceJSONP = !!e.forceJSONP,
        this.jsonp = !1 !== e.jsonp,
        this.forceBase64 = !!e.forceBase64,
        this.enablesXDR = !!e.enablesXDR,
        this.withCredentials = !1 !== e.withCredentials,
        this.timestampParam = e.timestampParam || "t",
        this.timestampRequests = e.timestampRequests,
        this.transports = e.transports || ["polling", "websocket"],
        this.transportOptions = e.transportOptions || {},
        this.readyState = "",
        this.writeBuffer = [],
        this.prevBufferLen = 0,
        this.policyPort = e.policyPort || 843,
        this.rememberUpgrade = e.rememberUpgrade || !1,
        this.binaryType = null,
        this.onlyBinaryUpgrades = e.onlyBinaryUpgrades,
        this.perMessageDeflate = !1 !== e.perMessageDeflate && (e.perMessageDeflate || {}),
        !0 === this.perMessageDeflate && (this.perMessageDeflate = {}),
        this.perMessageDeflate && null == this.perMessageDeflate.threshold && (this.perMessageDeflate.threshold = 1024),
        this.pfx = e.pfx || null,
        this.key = e.key || null,
        this.passphrase = e.passphrase || null,
        this.cert = e.cert || null,
        this.ca = e.ca || null,
        this.ciphers = e.ciphers || null,
        this.rejectUnauthorized = void 0 === e.rejectUnauthorized || e.rejectUnauthorized,
        this.forceNode = !!e.forceNode,
        this.isReactNative = "undefined" != typeof navigator && "string" == typeof navigator.product && "reactnative" === navigator.product.toLowerCase(),
        ("undefined" == typeof self || this.isReactNative) && (e.extraHeaders && Object.keys(e.extraHeaders).length > 0 && (this.extraHeaders = e.extraHeaders),
        e.localAddress && (this.localAddress = e.localAddress)),
        this.id = null,
        this.upgrades = null,
        this.pingInterval = null,
        this.pingTimeout = null,
        this.pingIntervalTimer = null,
        this.pingTimeoutTimer = null,
        this.open()
    }
    t.exports = c,
    c.priorWebsocketSuccess = !1,
    r(c.prototype),
    c.protocol = n("fpvHl").protocol,
    c.Socket = c,
    c.Transport = n("3CdbG"),
    c.transports = n("4FXoL"),
    c.parser = n("fpvHl"),
    c.prototype.createTransport = function(t) {
        o('creating transport "%s"', t);
        var e = function(t) {
            var e = {};
            for (var n in t)
                t.hasOwnProperty(n) && (e[n] = t[n]);
            return e
        }(this.query);
        e.EIO = n("fpvHl").protocol,
        e.transport = t;
        var r = this.transportOptions[t] || {};
        return this.id && (e.sid = this.id),
        new (n("4FXoL")[t])({
            query: e,
            socket: this,
            agent: r.agent || this.agent,
            hostname: r.hostname || this.hostname,
            port: r.port || this.port,
            secure: r.secure || this.secure,
            path: r.path || this.path,
            forceJSONP: r.forceJSONP || this.forceJSONP,
            jsonp: r.jsonp || this.jsonp,
            forceBase64: r.forceBase64 || this.forceBase64,
            enablesXDR: r.enablesXDR || this.enablesXDR,
            withCredentials: r.withCredentials || this.withCredentials,
            timestampRequests: r.timestampRequests || this.timestampRequests,
            timestampParam: r.timestampParam || this.timestampParam,
            policyPort: r.policyPort || this.policyPort,
            pfx: r.pfx || this.pfx,
            key: r.key || this.key,
            passphrase: r.passphrase || this.passphrase,
            cert: r.cert || this.cert,
            ca: r.ca || this.ca,
            ciphers: r.ciphers || this.ciphers,
            rejectUnauthorized: r.rejectUnauthorized || this.rejectUnauthorized,
            perMessageDeflate: r.perMessageDeflate || this.perMessageDeflate,
            extraHeaders: r.extraHeaders || this.extraHeaders,
            forceNode: r.forceNode || this.forceNode,
            localAddress: r.localAddress || this.localAddress,
            requestTimeout: r.requestTimeout || this.requestTimeout,
            protocols: r.protocols || void 0,
            isReactNative: this.isReactNative
        })
    }
    ,
    c.prototype.open = function() {
        var t;
        if (this.rememberUpgrade && c.priorWebsocketSuccess && -1 !== this.transports.indexOf("websocket"))
            t = "websocket";
        else {
            if (0 === this.transports.length) {
                var e = this;
                return void setTimeout((function() {
                    e.emit("error", "No transports available")
                }
                ), 0)
            }
            t = this.transports[0]
        }
        this.readyState = "opening";
        try {
            t = this.createTransport(t)
        } catch (t) {
            return this.transports.shift(),
            void this.open()
        }
        t.open(),
        this.setTransport(t)
    }
    ,
    c.prototype.setTransport = function(t) {
        o("setting transport %s", t.name);
        var e = this;
        this.transport && (o("clearing existing transport %s", this.transport.name),
        this.transport.removeAllListeners()),
        this.transport = t,
        t.on("drain", (function() {
            e.onDrain()
        }
        )).on("packet", (function(t) {
            e.onPacket(t)
        }
        )).on("error", (function(t) {
            e.onError(t)
        }
        )).on("close", (function() {
            e.onClose("transport close")
        }
        ))
    }
    ,
    c.prototype.probe = function(t) {
        o('probing transport "%s"', t);
        var e = this.createTransport(t, {
            probe: 1
        })
          , n = !1
          , r = this;
        function i() {
            if (r.onlyBinaryUpgrades) {
                var i = !this.supportsBinary && r.transport.supportsBinary;
                n = n || i
            }
            n || (o('probe transport "%s" opened', t),
            e.send([{
                type: "ping",
                data: "probe"
            }]),
            e.once("packet", (function(i) {
                if (!n)
                    if ("pong" === i.type && "probe" === i.data) {
                        if (o('probe transport "%s" pong', t),
                        r.upgrading = !0,
                        r.emit("upgrading", e),
                        !e)
                            return;
                        c.priorWebsocketSuccess = "websocket" === e.name,
                        o('pausing current transport "%s"', r.transport.name),
                        r.transport.pause((function() {
                            n || "closed" !== r.readyState && (o("changing transport and sending upgrade packet"),
                            p(),
                            r.setTransport(e),
                            e.send([{
                                type: "upgrade"
                            }]),
                            r.emit("upgrade", e),
                            e = null,
                            r.upgrading = !1,
                            r.flush())
                        }
                        ))
                    } else {
                        o('probe transport "%s" failed', t);
                        var s = new Error("probe error");
                        s.transport = e.name,
                        r.emit("upgradeError", s)
                    }
            }
            )))
        }
        function s() {
            n || (n = !0,
            p(),
            e.close(),
            e = null)
        }
        function a(n) {
            var i = new Error("probe error: " + n);
            i.transport = e.name,
            s(),
            o('probe transport "%s" failed because of error: %s', t, n),
            r.emit("upgradeError", i)
        }
        function u() {
            a("transport closed")
        }
        function h() {
            a("socket closed")
        }
        function f(t) {
            e && t.name !== e.name && (o('"%s" works - aborting "%s"', t.name, e.name),
            s())
        }
        function p() {
            e.removeListener("open", i),
            e.removeListener("error", a),
            e.removeListener("close", u),
            r.removeListener("close", h),
            r.removeListener("upgrading", f)
        }
        c.priorWebsocketSuccess = !1,
        e.once("open", i),
        e.once("error", a),
        e.once("close", u),
        this.once("close", h),
        this.once("upgrading", f),
        e.open()
    }
    ,
    c.prototype.onOpen = function() {
        if (o("socket open"),
        this.readyState = "open",
        c.priorWebsocketSuccess = "websocket" === this.transport.name,
        this.emit("open"),
        this.flush(),
        "open" === this.readyState && this.upgrade && this.transport.pause) {
            o("starting upgrade probes");
            for (var t = 0, e = this.upgrades.length; t < e; t++)
                this.probe(this.upgrades[t])
        }
    }
    ,
    c.prototype.onPacket = function(t) {
        if ("opening" === this.readyState || "open" === this.readyState || "closing" === this.readyState)
            switch (o('socket receive: type "%s", data "%s"', t.type, t.data),
            this.emit("packet", t),
            this.emit("heartbeat"),
            t.type) {
            case "open":
                this.onHandshake(JSON.parse(t.data));
                break;
            case "pong":
                this.setPing(),
                this.emit("pong");
                break;
            case "error":
                var e = new Error("server error");
                e.code = t.data,
                this.onError(e);
                break;
            case "message":
                this.emit("data", t.data),
                this.emit("message", t.data)
            }
        else
            o('packet received with socket readyState "%s"', this.readyState)
    }
    ,
    c.prototype.onHandshake = function(t) {
        this.emit("handshake", t),
        this.id = t.sid,
        this.transport.query.sid = t.sid,
        this.upgrades = this.filterUpgrades(t.upgrades),
        this.pingInterval = t.pingInterval,
        this.pingTimeout = t.pingTimeout,
        this.onOpen(),
        "closed" !== this.readyState && (this.setPing(),
        this.removeListener("heartbeat", this.onHeartbeat),
        this.on("heartbeat", this.onHeartbeat))
    }
    ,
    c.prototype.onHeartbeat = function(t) {
        clearTimeout(this.pingTimeoutTimer);
        var e = this;
        e.pingTimeoutTimer = setTimeout((function() {
            "closed" !== e.readyState && e.onClose("ping timeout")
        }
        ), t || e.pingInterval + e.pingTimeout)
    }
    ,
    c.prototype.setPing = function() {
        var t = this;
        clearTimeout(t.pingIntervalTimer),
        t.pingIntervalTimer = setTimeout((function() {
            o("writing ping packet - expecting pong within %sms", t.pingTimeout),
            t.ping(),
            t.onHeartbeat(t.pingTimeout)
        }
        ), t.pingInterval)
    }
    ,
    c.prototype.ping = function() {
        var t = this;
        this.sendPacket("ping", (function() {
            t.emit("ping")
        }
        ))
    }
    ,
    c.prototype.onDrain = function() {
        this.writeBuffer.splice(0, this.prevBufferLen),
        this.prevBufferLen = 0,
        0 === this.writeBuffer.length ? this.emit("drain") : this.flush()
    }
    ,
    c.prototype.flush = function() {
        "closed" !== this.readyState && this.transport.writable && !this.upgrading && this.writeBuffer.length && (o("flushing %d packets in socket", this.writeBuffer.length),
        this.transport.send(this.writeBuffer),
        this.prevBufferLen = this.writeBuffer.length,
        this.emit("flush"))
    }
    ,
    c.prototype.write = c.prototype.send = function(t, e, n) {
        return this.sendPacket("message", t, e, n),
        this
    }
    ,
    c.prototype.sendPacket = function(t, e, n, r) {
        if ("function" == typeof e && (r = e,
        e = void 0),
        "function" == typeof n && (r = n,
        n = null),
        "closing" !== this.readyState && "closed" !== this.readyState) {
            (n = n || {}).compress = !1 !== n.compress;
            var o = {
                type: t,
                data: e,
                options: n
            };
            this.emit("packetCreate", o),
            this.writeBuffer.push(o),
            r && this.once("flush", r),
            this.flush()
        }
    }
    ,
    c.prototype.close = function() {
        if ("opening" === this.readyState || "open" === this.readyState) {
            this.readyState = "closing";
            var t = this;
            this.writeBuffer.length ? this.once("drain", (function() {
                this.upgrading ? r() : e()
            }
            )) : this.upgrading ? r() : e()
        }
        function e() {
            t.onClose("forced close"),
            o("socket closing - telling transport to close"),
            t.transport.close()
        }
        function n() {
            t.removeListener("upgrade", n),
            t.removeListener("upgradeError", n),
            e()
        }
        function r() {
            t.once("upgrade", n),
            t.once("upgradeError", n)
        }
        return this
    }
    ,
    c.prototype.onError = function(t) {
        o("socket error %j", t),
        c.priorWebsocketSuccess = !1,
        this.emit("error", t),
        this.onClose("transport error", t)
    }
    ,
    c.prototype.onClose = function(t, e) {
        if ("opening" === this.readyState || "open" === this.readyState || "closing" === this.readyState) {
            o('socket close with reason: "%s"', t);
            clearTimeout(this.pingIntervalTimer),
            clearTimeout(this.pingTimeoutTimer),
            this.transport.removeAllListeners("close"),
            this.transport.close(),
            this.transport.removeAllListeners(),
            this.readyState = "closed",
            this.id = null,
            this.emit("close", t, e),
            this.writeBuffer = [],
            this.prevBufferLen = 0
        }
    }
    ,
    c.prototype.filterUpgrades = function(t) {
        for (var e = [], n = 0, r = t.length; n < r; n++)
            ~i(this.transports, t[n]) && e.push(t[n]);
        return e
    }
}
)),
n.register("4FXoL", (function(e, r) {
    var o, i;
    t(e.exports, "polling", (function() {
        return o
    }
    ), (function(t) {
        return o = t
    }
    )),
    t(e.exports, "websocket", (function() {
        return i
    }
    ), (function(t) {
        return i = t
    }
    ));
    var s = n("3knpA")
      , a = n("7yNU4")
      , c = n("eMlmW")
      , u = n("bjCCY");
    o = function(t) {
        var e = !1
          , n = !1
          , r = !1 !== t.jsonp;
        if ("undefined" != typeof location) {
            var o = "https:" === location.protocol
              , i = location.port;
            i || (i = o ? 443 : 80),
            e = t.hostname !== location.hostname || i !== t.port,
            n = t.secure !== o
        }
        if (t.xdomain = e,
        t.xscheme = n,
        "open"in new s(t) && !t.forceJSONP)
            return new a(t);
        if (!r)
            throw new Error("JSONP disabled");
        return new c(t)
    }
    ,
    i = u
}
)),
n.register("3knpA", (function(t, e) {
    var r = n("aA9hP")
      , o = n("hTF2u");
    t.exports = function(t) {
        var e = t.xdomain
          , n = t.xscheme
          , i = t.enablesXDR;
        try {
            if ("undefined" != typeof XMLHttpRequest && (!e || r))
                return new XMLHttpRequest
        } catch (t) {}
        try {
            if ("undefined" != typeof XDomainRequest && !n && i)
                return new XDomainRequest
        } catch (t) {}
        if (!e)
            try {
                return new (o[["Active"].concat("Object").join("X")])("Microsoft.XMLHTTP")
            } catch (t) {}
    }
}
)),
n.register("aA9hP", (function(t, e) {
    try {
        t.exports = "undefined" != typeof XMLHttpRequest && "withCredentials"in new XMLHttpRequest
    } catch (e) {
        t.exports = !1
    }
}
)),
n.register("hTF2u", (function(t, e) {
    t.exports = "undefined" != typeof self ? self : "undefined" != typeof window ? window : Function("return this")()
}
)),
n.register("7yNU4", (function(t, e) {
    var r = n("3knpA")
      , o = n("l1nQY")
      , i = n("6nrxU")
      , s = n("5S1ru")
      , a = n("86aOL")("engine.io-client:polling-xhr")
      , c = n("hTF2u");
    function u() {}
    function h(t) {
        if (o.call(this, t),
        this.requestTimeout = t.requestTimeout,
        this.extraHeaders = t.extraHeaders,
        "undefined" != typeof location) {
            var e = "https:" === location.protocol
              , n = location.port;
            n || (n = e ? 443 : 80),
            this.xd = "undefined" != typeof location && t.hostname !== location.hostname || n !== t.port,
            this.xs = t.secure !== e
        }
    }
    function f(t) {
        this.method = t.method || "GET",
        this.uri = t.uri,
        this.xd = !!t.xd,
        this.xs = !!t.xs,
        this.async = !1 !== t.async,
        this.data = void 0 !== t.data ? t.data : null,
        this.agent = t.agent,
        this.isBinary = t.isBinary,
        this.supportsBinary = t.supportsBinary,
        this.enablesXDR = t.enablesXDR,
        this.withCredentials = t.withCredentials,
        this.requestTimeout = t.requestTimeout,
        this.pfx = t.pfx,
        this.key = t.key,
        this.passphrase = t.passphrase,
        this.cert = t.cert,
        this.ca = t.ca,
        this.ciphers = t.ciphers,
        this.rejectUnauthorized = t.rejectUnauthorized,
        this.extraHeaders = t.extraHeaders,
        this.create()
    }
    if (t.exports = h,
    t.exports.Request = f,
    s(h, o),
    h.prototype.supportsBinary = !0,
    h.prototype.request = function(t) {
        return (t = t || {}).uri = this.uri(),
        t.xd = this.xd,
        t.xs = this.xs,
        t.agent = this.agent || !1,
        t.supportsBinary = this.supportsBinary,
        t.enablesXDR = this.enablesXDR,
        t.withCredentials = this.withCredentials,
        t.pfx = this.pfx,
        t.key = this.key,
        t.passphrase = this.passphrase,
        t.cert = this.cert,
        t.ca = this.ca,
        t.ciphers = this.ciphers,
        t.rejectUnauthorized = this.rejectUnauthorized,
        t.requestTimeout = this.requestTimeout,
        t.extraHeaders = this.extraHeaders,
        new f(t)
    }
    ,
    h.prototype.doWrite = function(t, e) {
        var n = "string" != typeof t && void 0 !== t
          , r = this.request({
            method: "POST",
            data: t,
            isBinary: n
        })
          , o = this;
        r.on("success", e),
        r.on("error", (function(t) {
            o.onError("xhr post error", t)
        }
        )),
        this.sendXhr = r
    }
    ,
    h.prototype.doPoll = function() {
        a("xhr poll");
        var t = this.request()
          , e = this;
        t.on("data", (function(t) {
            e.onData(t)
        }
        )),
        t.on("error", (function(t) {
            e.onError("xhr poll error", t)
        }
        )),
        this.pollXhr = t
    }
    ,
    i(f.prototype),
    f.prototype.create = function() {
        var t = {
            agent: this.agent,
            xdomain: this.xd,
            xscheme: this.xs,
            enablesXDR: this.enablesXDR
        };
        t.pfx = this.pfx,
        t.key = this.key,
        t.passphrase = this.passphrase,
        t.cert = this.cert,
        t.ca = this.ca,
        t.ciphers = this.ciphers,
        t.rejectUnauthorized = this.rejectUnauthorized;
        var e = this.xhr = new r(t)
          , n = this;
        try {
            a("xhr open %s: %s", this.method, this.uri),
            e.open(this.method, this.uri, this.async);
            try {
                if (this.extraHeaders)
                    for (var o in e.setDisableHeaderCheck && e.setDisableHeaderCheck(!0),
                    this.extraHeaders)
                        this.extraHeaders.hasOwnProperty(o) && e.setRequestHeader(o, this.extraHeaders[o])
            } catch (t) {}
            if ("POST" === this.method)
                try {
                    this.isBinary ? e.setRequestHeader("Content-type", "application/octet-stream") : e.setRequestHeader("Content-type", "text/plain;charset=UTF-8")
                } catch (t) {}
            try {
                e.setRequestHeader("Accept", "*/*")
            } catch (t) {}
            "withCredentials"in e && (e.withCredentials = this.withCredentials),
            this.requestTimeout && (e.timeout = this.requestTimeout),
            this.hasXDR() ? (e.onload = function() {
                n.onLoad()
            }
            ,
            e.onerror = function() {
                n.onError(e.responseText)
            }
            ) : e.onreadystatechange = function() {
                if (2 === e.readyState)
                    try {
                        var t = e.getResponseHeader("Content-Type");
                        (n.supportsBinary && "application/octet-stream" === t || "application/octet-stream; charset=UTF-8" === t) && (e.responseType = "arraybuffer")
                    } catch (t) {}
                4 === e.readyState && (200 === e.status || 1223 === e.status ? n.onLoad() : setTimeout((function() {
                    n.onError("number" == typeof e.status ? e.status : 0)
                }
                ), 0))
            }
            ,
            a("xhr data %s", this.data),
            e.send(this.data)
        } catch (t) {
            return void setTimeout((function() {
                n.onError(t)
            }
            ), 0)
        }
        "undefined" != typeof document && (this.index = f.requestsCount++,
        f.requests[this.index] = this)
    }
    ,
    f.prototype.onSuccess = function() {
        this.emit("success"),
        this.cleanup()
    }
    ,
    f.prototype.onData = function(t) {
        this.emit("data", t),
        this.onSuccess()
    }
    ,
    f.prototype.onError = function(t) {
        this.emit("error", t),
        this.cleanup(!0)
    }
    ,
    f.prototype.cleanup = function(t) {
        if (void 0 !== this.xhr && null !== this.xhr) {
            if (this.hasXDR() ? this.xhr.onload = this.xhr.onerror = u : this.xhr.onreadystatechange = u,
            t)
                try {
                    this.xhr.abort()
                } catch (t) {}
            "undefined" != typeof document && delete f.requests[this.index],
            this.xhr = null
        }
    }
    ,
    f.prototype.onLoad = function() {
        var t;
        try {
            var e;
            try {
                e = this.xhr.getResponseHeader("Content-Type")
            } catch (t) {}
            t = ("application/octet-stream" === e || "application/octet-stream; charset=UTF-8" === e) && this.xhr.response || this.xhr.responseText
        } catch (t) {
            this.onError(t)
        }
        null != t && this.onData(t)
    }
    ,
    f.prototype.hasXDR = function() {
        return "undefined" != typeof XDomainRequest && !this.xs && this.enablesXDR
    }
    ,
    f.prototype.abort = function() {
        this.cleanup()
    }
    ,
    f.requestsCount = 0,
    f.requests = {},
    "undefined" != typeof document)
        if ("function" == typeof attachEvent)
            attachEvent("onunload", p);
        else if ("function" == typeof addEventListener) {
            addEventListener("onpagehide"in c ? "pagehide" : "unload", p, !1)
        }
    function p() {
        for (var t in f.requests)
            f.requests.hasOwnProperty(t) && f.requests[t].abort()
    }
}
)),
n.register("l1nQY", (function(t, e) {
    var r = n("3CdbG")
      , o = n("87Zdq")
      , i = n("fpvHl")
      , s = n("5S1ru")
      , a = n("dSClT")
      , c = n("86aOL")("engine.io-client:polling");
    t.exports = h;
    var u = null != new (n("3knpA"))({
        xdomain: !1
    }).responseType;
    function h(t) {
        var e = t && t.forceBase64;
        u && !e || (this.supportsBinary = !1),
        r.call(this, t)
    }
    s(h, r),
    h.prototype.name = "polling",
    h.prototype.doOpen = function() {
        this.poll()
    }
    ,
    h.prototype.pause = function(t) {
        var e = this;
        function n() {
            c("paused"),
            e.readyState = "paused",
            t()
        }
        if (this.readyState = "pausing",
        this.polling || !this.writable) {
            var r = 0;
            this.polling && (c("we are currently polling - waiting to pause"),
            r++,
            this.once("pollComplete", (function() {
                c("pre-pause polling complete"),
                --r || n()
            }
            ))),
            this.writable || (c("we are currently writing - waiting to pause"),
            r++,
            this.once("drain", (function() {
                c("pre-pause writing complete"),
                --r || n()
            }
            )))
        } else
            n()
    }
    ,
    h.prototype.poll = function() {
        c("polling"),
        this.polling = !0,
        this.doPoll(),
        this.emit("poll")
    }
    ,
    h.prototype.onData = function(t) {
        var e = this;
        c("polling got data %s", t);
        i.decodePayload(t, this.socket.binaryType, (function(t, n, r) {
            if ("opening" === e.readyState && e.onOpen(),
            "close" === t.type)
                return e.onClose(),
                !1;
            e.onPacket(t)
        }
        )),
        "closed" !== this.readyState && (this.polling = !1,
        this.emit("pollComplete"),
        "open" === this.readyState ? this.poll() : c('ignoring poll - transport state "%s"', this.readyState))
    }
    ,
    h.prototype.doClose = function() {
        var t = this;
        function e() {
            c("writing close packet"),
            t.write([{
                type: "close"
            }])
        }
        "open" === this.readyState ? (c("transport open - closing"),
        e()) : (c("transport not open - deferring close"),
        this.once("open", e))
    }
    ,
    h.prototype.write = function(t) {
        var e = this;
        this.writable = !1;
        var n = function() {
            e.writable = !0,
            e.emit("drain")
        };
        i.encodePayload(t, this.supportsBinary, (function(t) {
            e.doWrite(t, n)
        }
        ))
    }
    ,
    h.prototype.uri = function() {
        var t = this.query || {}
          , e = this.secure ? "https" : "http"
          , n = "";
        return !1 !== this.timestampRequests && (t[this.timestampParam] = a()),
        this.supportsBinary || t.sid || (t.b64 = 1),
        t = o.encode(t),
        this.port && ("https" === e && 443 !== Number(this.port) || "http" === e && 80 !== Number(this.port)) && (n = ":" + this.port),
        t.length && (t = "?" + t),
        e + "://" + (-1 !== this.hostname.indexOf(":") ? "[" + this.hostname + "]" : this.hostname) + n + this.path + t
    }
}
)),
n.register("3CdbG", (function(t, e) {
    var r = n("fpvHl")
      , o = n("6nrxU");
    function i(t) {
        this.path = t.path,
        this.hostname = t.hostname,
        this.port = t.port,
        this.secure = t.secure,
        this.query = t.query,
        this.timestampParam = t.timestampParam,
        this.timestampRequests = t.timestampRequests,
        this.readyState = "",
        this.agent = t.agent || !1,
        this.socket = t.socket,
        this.enablesXDR = t.enablesXDR,
        this.withCredentials = t.withCredentials,
        this.pfx = t.pfx,
        this.key = t.key,
        this.passphrase = t.passphrase,
        this.cert = t.cert,
        this.ca = t.ca,
        this.ciphers = t.ciphers,
        this.rejectUnauthorized = t.rejectUnauthorized,
        this.forceNode = t.forceNode,
        this.isReactNative = t.isReactNative,
        this.extraHeaders = t.extraHeaders,
        this.localAddress = t.localAddress
    }
    t.exports = i,
    o(i.prototype),
    i.prototype.onError = function(t, e) {
        var n = new Error(t);
        return n.type = "TransportError",
        n.description = e,
        this.emit("error", n),
        this
    }
    ,
    i.prototype.open = function() {
        return "closed" !== this.readyState && "" !== this.readyState || (this.readyState = "opening",
        this.doOpen()),
        this
    }
    ,
    i.prototype.close = function() {
        return "opening" !== this.readyState && "open" !== this.readyState || (this.doClose(),
        this.onClose()),
        this
    }
    ,
    i.prototype.send = function(t) {
        if ("open" !== this.readyState)
            throw new Error("Transport not open");
        this.write(t)
    }
    ,
    i.prototype.onOpen = function() {
        this.readyState = "open",
        this.writable = !0,
        this.emit("open")
    }
    ,
    i.prototype.onData = function(t) {
        var e = r.decodePacket(t, this.socket.binaryType);
        this.onPacket(e)
    }
    ,
    i.prototype.onPacket = function(t) {
        this.emit("packet", t)
    }
    ,
    i.prototype.onClose = function() {
        this.readyState = "closed",
        this.emit("close")
    }
}
)),
n.register("fpvHl", (function(e, r) {
    var o, i, s, a, c, u, h, f, p, l, d;
    t(e.exports, "protocol", (function() {
        return o
    }
    ), (function(t) {
        return o = t
    }
    )),
    t(e.exports, "packets", (function() {
        return i
    }
    ), (function(t) {
        return i = t
    }
    )),
    t(e.exports, "encodePacket", (function() {
        return s
    }
    ), (function(t) {
        return s = t
    }
    )),
    t(e.exports, "encodeBase64Packet", (function() {
        return a
    }
    ), (function(t) {
        return a = t
    }
    )),
    t(e.exports, "decodePacket", (function() {
        return c
    }
    ), (function(t) {
        return c = t
    }
    )),
    t(e.exports, "decodeBase64Packet", (function() {
        return u
    }
    ), (function(t) {
        return u = t
    }
    )),
    t(e.exports, "encodePayload", (function() {
        return h
    }
    ), (function(t) {
        return h = t
    }
    )),
    t(e.exports, "encodePayloadAsBlob", (function() {
        return l
    }
    ), (function(t) {
        return l = t
    }
    )),
    t(e.exports, "encodePayloadAsArrayBuffer", (function() {
        return p
    }
    ), (function(t) {
        return p = t
    }
    )),
    t(e.exports, "decodePayload", (function() {
        return f
    }
    ), (function(t) {
        return f = t
    }
    )),
    t(e.exports, "decodePayloadAsBinary", (function() {
        return d
    }
    ), (function(t) {
        return d = t
    }
    ));
    var y, g = n("jjVug"), m = n("G1YHh"), v = n("dEiuh"), C = n("36qZm"), b = n("aaYcF");
    "undefined" != typeof ArrayBuffer && (y = n("lf1i8"));
    var w = "undefined" != typeof navigator && /Android/i.test(navigator.userAgent)
      , x = "undefined" != typeof navigator && /PhantomJS/i.test(navigator.userAgent)
      , k = w || x;
    o = 3;
    var _ = i = {
        open: 0,
        close: 1,
        ping: 2,
        pong: 3,
        message: 4,
        upgrade: 5,
        noop: 6
    }
      , F = g(_)
      , E = {
        type: "error",
        data: "parser error"
    }
      , A = n("lib57");
    function S(t, e, n) {
        for (var r = new Array(t.length), o = C(t.length, n), i = function(t, n, o) {
            e(n, (function(e, n) {
                r[t] = n,
                o(e, r)
            }
            ))
        }, s = 0; s < t.length; s++)
            i(s, t[s], o)
    }
    s = function(t, e, n, r) {
        "function" == typeof e && (r = e,
        e = !1),
        "function" == typeof n && (r = n,
        n = null);
        var o = void 0 === t.data ? void 0 : t.data.buffer || t.data;
        if ("undefined" != typeof ArrayBuffer && o instanceof ArrayBuffer)
            return function(t, e, n) {
                if (!e)
                    return a(t, n);
                var r = t.data
                  , o = new Uint8Array(r)
                  , i = new Uint8Array(1 + r.byteLength);
                i[0] = _[t.type];
                for (var s = 0; s < o.length; s++)
                    i[s + 1] = o[s];
                return n(i.buffer)
            }(t, e, r);
        if (void 0 !== A && o instanceof A)
            return function(t, e, n) {
                if (!e)
                    return a(t, n);
                if (k)
                    return function(t, e, n) {
                        if (!e)
                            return a(t, n);
                        var r = new FileReader;
                        return r.onload = function() {
                            s({
                                type: t.type,
                                data: r.result
                            }, e, !0, n)
                        }
                        ,
                        r.readAsArrayBuffer(t.data)
                    }(t, e, n);
                var r = new Uint8Array(1);
                r[0] = _[t.type];
                var o = new A([r.buffer, t.data]);
                return n(o)
            }(t, e, r);
        if (o && o.base64)
            return function(t, e) {
                var n = "b" + i[t.type] + t.data.data;
                return e(n)
            }(t, r);
        var c = _[t.type];
        return void 0 !== t.data && (c += n ? b.encode(String(t.data), {
            strict: !1
        }) : String(t.data)),
        r("" + c)
    }
    ,
    a = function(t, e) {
        var n, r = "b" + i[t.type];
        if (void 0 !== A && t.data instanceof A) {
            var o = new FileReader;
            return o.onload = function() {
                var t = o.result.split(",")[1];
                e(r + t)
            }
            ,
            o.readAsDataURL(t.data)
        }
        try {
            n = String.fromCharCode.apply(null, new Uint8Array(t.data))
        } catch (e) {
            for (var s = new Uint8Array(t.data), a = new Array(s.length), c = 0; c < s.length; c++)
                a[c] = s[c];
            n = String.fromCharCode.apply(null, a)
        }
        return r += btoa(n),
        e(r)
    }
    ,
    c = function(t, e, n) {
        if (void 0 === t)
            return E;
        if ("string" == typeof t) {
            if ("b" === t.charAt(0))
                return u(t.substr(1), e);
            if (n && !1 === (t = function(t) {
                try {
                    t = b.decode(t, {
                        strict: !1
                    })
                } catch (t) {
                    return !1
                }
                return t
            }(t)))
                return E;
            var r = t.charAt(0);
            return Number(r) == r && F[r] ? t.length > 1 ? {
                type: F[r],
                data: t.substring(1)
            } : {
                type: F[r]
            } : E
        }
        r = new Uint8Array(t)[0];
        var o = v(t, 1);
        return A && "blob" === e && (o = new A([o])),
        {
            type: F[r],
            data: o
        }
    }
    ,
    u = function(t, e) {
        var n = F[t.charAt(0)];
        if (!y)
            return {
                type: n,
                data: {
                    base64: !0,
                    data: t.substr(1)
                }
            };
        var r = y.decode(t.substr(1));
        return "blob" === e && A && (r = new A([r])),
        {
            type: n,
            data: r
        }
    }
    ,
    h = function(t, e, n) {
        "function" == typeof e && (n = e,
        e = null);
        var r = m(t);
        if (e && r)
            return A && !k ? l(t, n) : p(t, n);
        if (!t.length)
            return n("0:");
        S(t, (function(t, n) {
            s(t, !!r && e, !1, (function(t) {
                n(null, function(t) {
                    return t.length + ":" + t
                }(t))
            }
            ))
        }
        ), (function(t, e) {
            return n(e.join(""))
        }
        ))
    }
    ,
    f = function(t, e, n) {
        if ("string" != typeof t)
            return d(t, e, n);
        var r;
        if ("function" == typeof e && (n = e,
        e = null),
        "" === t)
            return n(E, 0, 1);
        for (var o, i, s = "", a = 0, u = t.length; a < u; a++) {
            var h = t.charAt(a);
            if (":" === h) {
                if ("" === s || s != (o = Number(s)))
                    return n(E, 0, 1);
                if (s != (i = t.substr(a + 1, o)).length)
                    return n(E, 0, 1);
                if (i.length) {
                    if (r = c(i, e, !1),
                    E.type === r.type && E.data === r.data)
                        return n(E, 0, 1);
                    if (!1 === n(r, a + o, u))
                        return
                }
                a += o,
                s = ""
            } else
                s += h
        }
        return "" !== s ? n(E, 0, 1) : void 0
    }
    ,
    p = function(t, e) {
        if (!t.length)
            return e(new ArrayBuffer(0));
        S(t, (function(t, e) {
            s(t, !0, !0, (function(t) {
                return e(null, t)
            }
            ))
        }
        ), (function(t, n) {
            var r = n.reduce((function(t, e) {
                var n;
                return t + (n = "string" == typeof e ? e.length : e.byteLength).toString().length + n + 2
            }
            ), 0)
              , o = new Uint8Array(r)
              , i = 0;
            return n.forEach((function(t) {
                var e = "string" == typeof t
                  , n = t;
                if (e) {
                    for (var r = new Uint8Array(t.length), s = 0; s < t.length; s++)
                        r[s] = t.charCodeAt(s);
                    n = r.buffer
                }
                o[i++] = e ? 0 : 1;
                var a = n.byteLength.toString();
                for (s = 0; s < a.length; s++)
                    o[i++] = parseInt(a[s]);
                o[i++] = 255;
                for (r = new Uint8Array(n),
                s = 0; s < r.length; s++)
                    o[i++] = r[s]
            }
            )),
            e(o.buffer)
        }
        ))
    }
    ,
    l = function(t, e) {
        S(t, (function(t, e) {
            s(t, !0, !0, (function(t) {
                var n = new Uint8Array(1);
                if (n[0] = 1,
                "string" == typeof t) {
                    for (var r = new Uint8Array(t.length), o = 0; o < t.length; o++)
                        r[o] = t.charCodeAt(o);
                    t = r.buffer,
                    n[0] = 0
                }
                var i = (t instanceof ArrayBuffer ? t.byteLength : t.size).toString()
                  , s = new Uint8Array(i.length + 1);
                for (o = 0; o < i.length; o++)
                    s[o] = parseInt(i[o]);
                if (s[i.length] = 255,
                A) {
                    var a = new A([n.buffer, s.buffer, t]);
                    e(null, a)
                }
            }
            ))
        }
        ), (function(t, n) {
            return e(new A(n))
        }
        ))
    }
    ,
    d = function(t, e, n) {
        "function" == typeof e && (n = e,
        e = null);
        for (var r = t, o = []; r.byteLength > 0; ) {
            for (var i = new Uint8Array(r), s = 0 === i[0], a = "", u = 1; 255 !== i[u]; u++) {
                if (a.length > 310)
                    return n(E, 0, 1);
                a += i[u]
            }
            r = v(r, 2 + a.length),
            a = parseInt(a);
            var h = v(r, 0, a);
            if (s)
                try {
                    h = String.fromCharCode.apply(null, new Uint8Array(h))
                } catch (t) {
                    var f = new Uint8Array(h);
                    h = "";
                    for (u = 0; u < f.length; u++)
                        h += String.fromCharCode(f[u])
                }
            o.push(h),
            r = v(r, a)
        }
        var p = o.length;
        o.forEach((function(t, r) {
            n(c(t, e, !0), r, p)
        }
        ))
    }
}
)),
n.register("jjVug", (function(t, e) {
    t.exports = Object.keys || function(t) {
        var e = []
          , n = Object.prototype.hasOwnProperty;
        for (var r in t)
            n.call(t, r) && e.push(r);
        return e
    }
}
)),
n.register("G1YHh", (function(t, e) {
    var r = n("c01sx").Buffer
      , o = n("2GeKO")
      , i = Object.prototype.toString
      , s = "function" == typeof Blob || "undefined" != typeof Blob && "[object BlobConstructor]" === i.call(Blob)
      , a = "function" == typeof File || "undefined" != typeof File && "[object FileConstructor]" === i.call(File);
    t.exports = function t(e) {
        if (!e || "object" != typeof e)
            return !1;
        if (o(e)) {
            for (var n = 0, i = e.length; n < i; n++)
                if (t(e[n]))
                    return !0;
            return !1
        }
        if ("function" == typeof r && r.isBuffer && r.isBuffer(e) || "function" == typeof ArrayBuffer && e instanceof ArrayBuffer || s && e instanceof Blob || a && e instanceof File)
            return !0;
        if (e.toJSON && "function" == typeof e.toJSON && 1 === arguments.length)
            return t(e.toJSON(), !0);
        for (var c in e)
            if (Object.prototype.hasOwnProperty.call(e, c) && t(e[c]))
                return !0;
        return !1
    }
}
)),
n.register("2GeKO", (function(t, e) {
    var n = {}.toString;
    t.exports = Array.isArray || function(t) {
        return "[object Array]" == n.call(t)
    }
}
)),
n.register("dEiuh", (function(t, e) {
    t.exports = function(t, e, n) {
        var r = t.byteLength;
        if (e = e || 0,
        n = n || r,
        t.slice)
            return t.slice(e, n);
        if (e < 0 && (e += r),
        n < 0 && (n += r),
        n > r && (n = r),
        e >= r || e >= n || 0 === r)
            return new ArrayBuffer(0);
        for (var o = new Uint8Array(t), i = new Uint8Array(n - e), s = e, a = 0; s < n; s++,
        a++)
            i[a] = o[s];
        return i.buffer
    }
}
)),
n.register("36qZm", (function(t, e) {
    function n() {}
    t.exports = function(t, e, r) {
        var o = !1;
        return r = r || n,
        i.count = t,
        0 === t ? e() : i;
        function i(t, n) {
            if (i.count <= 0)
                throw new Error("after called too many times");
            --i.count,
            t ? (o = !0,
            e(t),
            e = r) : 0 !== i.count || o || e(null, n)
        }
    }
}
)),
n.register("aaYcF", (function(t, e) {
    /*! https://mths.be/utf8js v2.1.2 by @mathias */
    var n, r, o, i = String.fromCharCode;
    function s(t) {
        for (var e, n, r = [], o = 0, i = t.length; o < i; )
            (e = t.charCodeAt(o++)) >= 55296 && e <= 56319 && o < i ? 56320 == (64512 & (n = t.charCodeAt(o++))) ? r.push(((1023 & e) << 10) + (1023 & n) + 65536) : (r.push(e),
            o--) : r.push(e);
        return r
    }
    function a(t, e) {
        if (t >= 55296 && t <= 57343) {
            if (e)
                throw Error("Lone surrogate U+" + t.toString(16).toUpperCase() + " is not a scalar value");
            return !1
        }
        return !0
    }
    function c(t, e) {
        return i(t >> e & 63 | 128)
    }
    function u(t, e) {
        if (0 == (4294967168 & t))
            return i(t);
        var n = "";
        return 0 == (4294965248 & t) ? n = i(t >> 6 & 31 | 192) : 0 == (4294901760 & t) ? (a(t, e) || (t = 65533),
        n = i(t >> 12 & 15 | 224),
        n += c(t, 6)) : 0 == (4292870144 & t) && (n = i(t >> 18 & 7 | 240),
        n += c(t, 12),
        n += c(t, 6)),
        n += i(63 & t | 128)
    }
    function h() {
        if (o >= r)
            throw Error("Invalid byte index");
        var t = 255 & n[o];
        if (o++,
        128 == (192 & t))
            return 63 & t;
        throw Error("Invalid continuation byte")
    }
    function f(t) {
        var e, i;
        if (o > r)
            throw Error("Invalid byte index");
        if (o == r)
            return !1;
        if (e = 255 & n[o],
        o++,
        0 == (128 & e))
            return e;
        if (192 == (224 & e)) {
            if ((i = (31 & e) << 6 | h()) >= 128)
                return i;
            throw Error("Invalid continuation byte")
        }
        if (224 == (240 & e)) {
            if ((i = (15 & e) << 12 | h() << 6 | h()) >= 2048)
                return a(i, t) ? i : 65533;
            throw Error("Invalid continuation byte")
        }
        if (240 == (248 & e) && (i = (7 & e) << 18 | h() << 12 | h() << 6 | h()) >= 65536 && i <= 1114111)
            return i;
        throw Error("Invalid UTF-8 detected")
    }
    t.exports = {
        version: "2.1.2",
        encode: function(t, e) {
            for (var n = !1 !== (e = e || {}).strict, r = s(t), o = r.length, i = -1, a = ""; ++i < o; )
                a += u(r[i], n);
            return a
        },
        decode: function(t, e) {
            var a = !1 !== (e = e || {}).strict;
            n = s(t),
            r = n.length,
            o = 0;
            for (var c, u = []; !1 !== (c = f(a)); )
                u.push(c);
            return function(t) {
                for (var e, n = t.length, r = -1, o = ""; ++r < n; )
                    (e = t[r]) > 65535 && (o += i((e -= 65536) >>> 10 & 1023 | 55296),
                    e = 56320 | 1023 & e),
                    o += i(e);
                return o
            }(u)
        }
    }
}
)),
n.register("lf1i8", (function(e, n) {
    var r, o, i;
    t(e.exports, "encode", (function() {
        return r
    }
    ), (function(t) {
        return r = t
    }
    )),
    t(e.exports, "decode", (function() {
        return o
    }
    ), (function(t) {
        return o = t
    }
    )),
    i = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
    r = function(t) {
        var e, n = new Uint8Array(t), r = n.length, o = "";
        for (e = 0; e < r; e += 3)
            o += i[n[e] >> 2],
            o += i[(3 & n[e]) << 4 | n[e + 1] >> 4],
            o += i[(15 & n[e + 1]) << 2 | n[e + 2] >> 6],
            o += i[63 & n[e + 2]];
        return r % 3 == 2 ? o = o.substring(0, o.length - 1) + "=" : r % 3 == 1 && (o = o.substring(0, o.length - 2) + "=="),
        o
    }
    ,
    o = function(t) {
        var e, n, r, o, s, a = .75 * t.length, c = t.length, u = 0;
        "=" === t[t.length - 1] && (a--,
        "=" === t[t.length - 2] && a--);
        var h = new ArrayBuffer(a)
          , f = new Uint8Array(h);
        for (e = 0; e < c; e += 4)
            n = i.indexOf(t[e]),
            r = i.indexOf(t[e + 1]),
            o = i.indexOf(t[e + 2]),
            s = i.indexOf(t[e + 3]),
            f[u++] = n << 2 | r >> 4,
            f[u++] = (15 & r) << 4 | o >> 2,
            f[u++] = (3 & o) << 6 | 63 & s;
        return h
    }
}
)),
n.register("lib57", (function(t, e) {
    var n = void 0 !== n ? n : "undefined" != typeof WebKitBlobBuilder ? WebKitBlobBuilder : "undefined" != typeof MSBlobBuilder ? MSBlobBuilder : "undefined" != typeof MozBlobBuilder && MozBlobBuilder
      , r = function() {
        try {
            return 2 === new Blob(["hi"]).size
        } catch (t) {
            return !1
        }
    }()
      , o = r && function() {
        try {
            return 2 === new Blob([new Uint8Array([1, 2])]).size
        } catch (t) {
            return !1
        }
    }()
      , i = n && n.prototype.append && n.prototype.getBlob;
    function s(t) {
        return t.map((function(t) {
            if (t.buffer instanceof ArrayBuffer) {
                var e = t.buffer;
                if (t.byteLength !== e.byteLength) {
                    var n = new Uint8Array(t.byteLength);
                    n.set(new Uint8Array(e,t.byteOffset,t.byteLength)),
                    e = n.buffer
                }
                return e
            }
            return t
        }
        ))
    }
    function a(t, e) {
        e = e || {};
        var r = new n;
        return s(t).forEach((function(t) {
            r.append(t)
        }
        )),
        e.type ? r.getBlob(e.type) : r.getBlob()
    }
    function c(t, e) {
        return new Blob(s(t),e || {})
    }
    "undefined" != typeof Blob && (a.prototype = Blob.prototype,
    c.prototype = Blob.prototype),
    t.exports = r ? o ? Blob : c : i ? a : void 0
}
)),
n.register("87Zdq", (function(e, n) {
    var r, o;
    t(e.exports, "encode", (function() {
        return r
    }
    ), (function(t) {
        return r = t
    }
    )),
    t(e.exports, "decode", (function() {
        return o
    }
    ), (function(t) {
        return o = t
    }
    )),
    r = function(t) {
        var e = "";
        for (var n in t)
            t.hasOwnProperty(n) && (e.length && (e += "&"),
            e += encodeURIComponent(n) + "=" + encodeURIComponent(t[n]));
        return e
    }
    ,
    o = function(t) {
        for (var e = {}, n = t.split("&"), r = 0, o = n.length; r < o; r++) {
            var i = n[r].split("=");
            e[decodeURIComponent(i[0])] = decodeURIComponent(i[1])
        }
        return e
    }
}
)),
n.register("5S1ru", (function(t, e) {
    t.exports = function(t, e) {
        var n = function() {};
        n.prototype = e.prototype,
        t.prototype = new n,
        t.prototype.constructor = t
    }
}
)),
n.register("dSClT", (function(t, e) {
    var n, r = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_".split(""), o = {}, i = 0, s = 0;
    function a(t) {
        var e = "";
        do {
            e = r[t % 64] + e,
            t = Math.floor(t / 64)
        } while (t > 0);
        return e
    }
    function c() {
        var t = a(+new Date);
        return t !== n ? (i = 0,
        n = t) : t + "." + a(i++)
    }
    for (; s < 64; s++)
        o[r[s]] = s;
    c.encode = a,
    c.decode = function(t) {
        var e = 0;
        for (s = 0; s < t.length; s++)
            e = 64 * e + o[t.charAt(s)];
        return e
    }
    ,
    t.exports = c
}
)),
n.register("86aOL", (function(t, e) {
    var r = n("jz2MG");
    function o() {
        var t;
        try {
            t = e.storage.debug
        } catch (t) {}
        return !t && void 0 !== r && "env"in r && (t = void 0),
        t
    }
    (e = t.exports = n("l8IWv")).log = function() {
        return "object" == typeof console && console.log && Function.prototype.apply.call(console.log, console, arguments)
    }
    ,
    e.formatArgs = function(t) {
        var n = this.useColors;
        if (t[0] = (n ? "%c" : "") + this.namespace + (n ? " %c" : " ") + t[0] + (n ? "%c " : " ") + "+" + e.humanize(this.diff),
        !n)
            return;
        var r = "color: " + this.color;
        t.splice(1, 0, r, "color: inherit");
        var o = 0
          , i = 0;
        t[0].replace(/%[a-zA-Z%]/g, (function(t) {
            "%%" !== t && (o++,
            "%c" === t && (i = o))
        }
        )),
        t.splice(i, 0, r)
    }
    ,
    e.save = function(t) {
        try {
            null == t ? e.storage.removeItem("debug") : e.storage.debug = t
        } catch (t) {}
    }
    ,
    e.load = o,
    e.useColors = function() {
        return !("undefined" == typeof window || !window.process || "renderer" !== window.process.type) || ("undefined" == typeof navigator || !navigator.userAgent || !navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) && ("undefined" != typeof document && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || "undefined" != typeof window && window.console && (window.console.firebug || window.console.exception && window.console.table) || "undefined" != typeof navigator && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31 || "undefined" != typeof navigator && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
    }
    ,
    e.storage = "undefined" != typeof chrome && void 0 !== chrome.storage ? chrome.storage.local : function() {
        try {
            return window.localStorage
        } catch (t) {}
    }(),
    e.colors = ["#0000CC", "#0000FF", "#0033CC", "#0033FF", "#0066CC", "#0066FF", "#0099CC", "#0099FF", "#00CC00", "#00CC33", "#00CC66", "#00CC99", "#00CCCC", "#00CCFF", "#3300CC", "#3300FF", "#3333CC", "#3333FF", "#3366CC", "#3366FF", "#3399CC", "#3399FF", "#33CC00", "#33CC33", "#33CC66", "#33CC99", "#33CCCC", "#33CCFF", "#6600CC", "#6600FF", "#6633CC", "#6633FF", "#66CC00", "#66CC33", "#9900CC", "#9900FF", "#9933CC", "#9933FF", "#99CC00", "#99CC33", "#CC0000", "#CC0033", "#CC0066", "#CC0099", "#CC00CC", "#CC00FF", "#CC3300", "#CC3333", "#CC3366", "#CC3399", "#CC33CC", "#CC33FF", "#CC6600", "#CC6633", "#CC9900", "#CC9933", "#CCCC00", "#CCCC33", "#FF0000", "#FF0033", "#FF0066", "#FF0099", "#FF00CC", "#FF00FF", "#FF3300", "#FF3333", "#FF3366", "#FF3399", "#FF33CC", "#FF33FF", "#FF6600", "#FF6633", "#FF9900", "#FF9933", "#FFCC00", "#FFCC33"],
    e.formatters.j = function(t) {
        try {
            return JSON.stringify(t)
        } catch (t) {
            return "[UnexpectedJSONParseError]: " + t.message
        }
    }
    ,
    e.enable(o())
}
)),
n.register("l8IWv", (function(t, e) {
    function r(t) {
        var n;
        function r() {
            if (r.enabled) {
                var t = r
                  , o = +new Date
                  , i = o - (n || o);
                t.diff = i,
                t.prev = n,
                t.curr = o,
                n = o;
                for (var s = new Array(arguments.length), a = 0; a < s.length; a++)
                    s[a] = arguments[a];
                s[0] = e.coerce(s[0]),
                "string" != typeof s[0] && s.unshift("%O");
                var c = 0;
                s[0] = s[0].replace(/%([a-zA-Z%])/g, (function(n, r) {
                    if ("%%" === n)
                        return n;
                    c++;
                    var o = e.formatters[r];
                    if ("function" == typeof o) {
                        var i = s[c];
                        n = o.call(t, i),
                        s.splice(c, 1),
                        c--
                    }
                    return n
                }
                )),
                e.formatArgs.call(t, s);
                var u = r.log || e.log || console.log.bind(console);
                u.apply(t, s)
            }
        }
        return r.namespace = t,
        r.enabled = e.enabled(t),
        r.useColors = e.useColors(),
        r.color = function(t) {
            var n, r = 0;
            for (n in t)
                r = (r << 5) - r + t.charCodeAt(n),
                r |= 0;
            return e.colors[Math.abs(r) % e.colors.length]
        }(t),
        r.destroy = o,
        "function" == typeof e.init && e.init(r),
        e.instances.push(r),
        r
    }
    function o() {
        var t = e.instances.indexOf(this);
        return -1 !== t && (e.instances.splice(t, 1),
        !0)
    }
    (e = t.exports = r.debug = r.default = r).coerce = function(t) {
        return t instanceof Error ? t.stack || t.message : t
    }
    ,
    e.disable = function() {
        e.enable("")
    }
    ,
    e.enable = function(t) {
        var n;
        e.save(t),
        e.names = [],
        e.skips = [];
        var r = ("string" == typeof t ? t : "").split(/[\s,]+/)
          , o = r.length;
        for (n = 0; n < o; n++)
            r[n] && ("-" === (t = r[n].replace(/\*/g, ".*?"))[0] ? e.skips.push(new RegExp("^" + t.substr(1) + "$")) : e.names.push(new RegExp("^" + t + "$")));
        for (n = 0; n < e.instances.length; n++) {
            var i = e.instances[n];
            i.enabled = e.enabled(i.namespace)
        }
    }
    ,
    e.enabled = function(t) {
        if ("*" === t[t.length - 1])
            return !0;
        var n, r;
        for (n = 0,
        r = e.skips.length; n < r; n++)
            if (e.skips[n].test(t))
                return !1;
        for (n = 0,
        r = e.names.length; n < r; n++)
            if (e.names[n].test(t))
                return !0;
        return !1
    }
    ,
    e.humanize = n("eG6o0"),
    e.instances = [],
    e.names = [],
    e.skips = [],
    e.formatters = {}
}
)),
n.register("eG6o0", (function(t, e) {
    var n = 1e3
      , r = 6e4
      , o = 36e5
      , i = 864e5
      , s = 315576e5;
    function a(t, e, n) {
        if (!(t < e))
            return t < 1.5 * e ? Math.floor(t / e) + " " + n : Math.ceil(t / e) + " " + n + "s"
    }
    t.exports = function(t, e) {
        e = e || {};
        var c, u = typeof t;
        if ("string" === u && t.length > 0)
            return function(t) {
                if ((t = String(t)).length > 100)
                    return;
                var e = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(t);
                if (!e)
                    return;
                var a = parseFloat(e[1]);
                switch ((e[2] || "ms").toLowerCase()) {
                case "years":
                case "year":
                case "yrs":
                case "yr":
                case "y":
                    return a * s;
                case "days":
                case "day":
                case "d":
                    return a * i;
                case "hours":
                case "hour":
                case "hrs":
                case "hr":
                case "h":
                    return a * o;
                case "minutes":
                case "minute":
                case "mins":
                case "min":
                case "m":
                    return a * r;
                case "seconds":
                case "second":
                case "secs":
                case "sec":
                case "s":
                    return a * n;
                case "milliseconds":
                case "millisecond":
                case "msecs":
                case "msec":
                case "ms":
                    return a;
                default:
                    return
                }
            }(t);
        if ("number" === u && !1 === isNaN(t))
            return e.long ? a(c = t, i, "day") || a(c, o, "hour") || a(c, r, "minute") || a(c, n, "second") || c + " ms" : function(t) {
                return t >= i ? Math.round(t / i) + "d" : t >= o ? Math.round(t / o) + "h" : t >= r ? Math.round(t / r) + "m" : t >= n ? Math.round(t / n) + "s" : t + "ms"
            }(t);
        throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(t))
    }
}
)),
n.register("eMlmW", (function(t, e) {
    var r = n("l1nQY")
      , o = n("5S1ru")
      , i = n("hTF2u");
    t.exports = h;
    var s, a = /\n/g, c = /\\n/g;
    function u() {}
    function h(t) {
        r.call(this, t),
        this.query = this.query || {},
        s || (s = i.___eio = i.___eio || []),
        this.index = s.length;
        var e = this;
        s.push((function(t) {
            e.onData(t)
        }
        )),
        this.query.j = this.index,
        "function" == typeof addEventListener && addEventListener("beforeunload", (function() {
            e.script && (e.script.onerror = u)
        }
        ), !1)
    }
    o(h, r),
    h.prototype.supportsBinary = !1,
    h.prototype.doClose = function() {
        this.script && (this.script.parentNode.removeChild(this.script),
        this.script = null),
        this.form && (this.form.parentNode.removeChild(this.form),
        this.form = null,
        this.iframe = null),
        r.prototype.doClose.call(this)
    }
    ,
    h.prototype.doPoll = function() {
        var t = this
          , e = document.createElement("script");
        this.script && (this.script.parentNode.removeChild(this.script),
        this.script = null),
        e.async = !0,
        e.src = this.uri(),
        e.onerror = function(e) {
            t.onError("jsonp poll error", e)
        }
        ;
        var n = document.getElementsByTagName("script")[0];
        n ? n.parentNode.insertBefore(e, n) : (document.head || document.body).appendChild(e),
        this.script = e,
        "undefined" != typeof navigator && /gecko/i.test(navigator.userAgent) && setTimeout((function() {
            var t = document.createElement("iframe");
            document.body.appendChild(t),
            document.body.removeChild(t)
        }
        ), 100)
    }
    ,
    h.prototype.doWrite = function(t, e) {
        var n = this;
        if (!this.form) {
            var r, o = document.createElement("form"), i = document.createElement("textarea"), s = this.iframeId = "eio_iframe_" + this.index;
            o.className = "socketio",
            o.style.position = "absolute",
            o.style.top = "-1000px",
            o.style.left = "-1000px",
            o.target = s,
            o.method = "POST",
            o.setAttribute("accept-charset", "utf-8"),
            i.name = "d",
            o.appendChild(i),
            document.body.appendChild(o),
            this.form = o,
            this.area = i
        }
        function u() {
            h(),
            e()
        }
        function h() {
            if (n.iframe)
                try {
                    n.form.removeChild(n.iframe)
                } catch (t) {
                    n.onError("jsonp polling iframe removal error", t)
                }
            try {
                var t = '<iframe src="javascript:0" name="' + n.iframeId + '">';
                r = document.createElement(t)
            } catch (t) {
                (r = document.createElement("iframe")).name = n.iframeId,
                r.src = "javascript:0"
            }
            r.id = n.iframeId,
            n.form.appendChild(r),
            n.iframe = r
        }
        this.form.action = this.uri(),
        h(),
        t = t.replace(c, "\\\n"),
        this.area.value = t.replace(a, "\\n");
        try {
            this.form.submit()
        } catch (t) {}
        this.iframe.attachEvent ? this.iframe.onreadystatechange = function() {
            "complete" === n.iframe.readyState && u()
        }
        : this.iframe.onload = u
    }
}
)),
n.register("bjCCY", (function(t, e) {
    var r, o, i = n("c01sx").Buffer, s = n("3CdbG"), a = n("fpvHl"), c = n("87Zdq"), u = n("5S1ru"), h = n("dSClT"), f = n("86aOL")("engine.io-client:websocket");
    if ("undefined" != typeof WebSocket ? r = WebSocket : "undefined" != typeof self && (r = self.WebSocket || self.MozWebSocket),
    "undefined" == typeof window)
        try {
            o = n("90ipy")
        } catch (t) {}
    var p = r || o;
    function l(t) {
        t && t.forceBase64 && (this.supportsBinary = !1),
        this.perMessageDeflate = t.perMessageDeflate,
        this.usingBrowserWebSocket = r && !t.forceNode,
        this.protocols = t.protocols,
        this.usingBrowserWebSocket || (p = o),
        s.call(this, t)
    }
    t.exports = l,
    u(l, s),
    l.prototype.name = "websocket",
    l.prototype.supportsBinary = !0,
    l.prototype.doOpen = function() {
        if (this.check()) {
            var t = this.uri()
              , e = this.protocols
              , n = {};
            this.isReactNative || (n.agent = this.agent,
            n.perMessageDeflate = this.perMessageDeflate,
            n.pfx = this.pfx,
            n.key = this.key,
            n.passphrase = this.passphrase,
            n.cert = this.cert,
            n.ca = this.ca,
            n.ciphers = this.ciphers,
            n.rejectUnauthorized = this.rejectUnauthorized),
            this.extraHeaders && (n.headers = this.extraHeaders),
            this.localAddress && (n.localAddress = this.localAddress);
            try {
                this.ws = this.usingBrowserWebSocket && !this.isReactNative ? e ? new p(t,e) : new p(t) : new p(t,e,n)

				// inserted code
				this.ws.outgoing = function(callback) {
                    if(!this.outgoingCallbacks) {
                        this.outgoingCallbacks = []
                    }
                    this.outgoingCallbacks.push(callback)
                }

				window.gc.socket = this.ws;
            } catch (t) {
                return this.emit("error", t)
            }
            void 0 === this.ws.binaryType && (this.supportsBinary = !1),
            this.ws.supports && this.ws.supports.binary ? (this.supportsBinary = !0,
            this.ws.binaryType = "nodebuffer") : this.ws.binaryType = "arraybuffer",
            this.addEventListeners()
        }
    }
    ,
    l.prototype.addEventListeners = function() {
        var t = this;
        this.ws.onopen = function() {
            t.onOpen()
        }
        ,
        this.ws.onclose = function() {
            t.onClose()
        }
        ,
        this.ws.onmessage = function(e) {
            t.onData(e.data)
        }
        ,
        this.ws.onerror = function(e) {
            t.onError("websocket error", e)
        }
    }
    ,
    l.prototype.write = function(t) {
        var e = this;
        this.writable = !1;
        for (var n = t.length, r = 0, o = n; r < o; r++)
            !function(t) {
                a.encodePacket(t, e.supportsBinary, (function(r) {
                    if (!e.usingBrowserWebSocket) {
                        var o = {};
                        if (t.options && (o.compress = t.options.compress),
                        e.perMessageDeflate)
                            ("string" == typeof r ? i.byteLength(r) : r.length) < e.perMessageDeflate.threshold && (o.compress = !1)
                    }
                    try {
						// inserted code
						if(e.ws.outgoingCallbacks && typeof r != "number") {
							for(let callback of e.ws.outgoingCallbacks) {
								callback(r);
							}
						}
                        e.usingBrowserWebSocket ? e.ws.send(r) : e.ws.send(r, o)
                    } catch (t) {
                        f("websocket closed before onclose event")
                    }
                    --n || s()
                }
                ))
            }(t[r]);
        function s() {
            e.emit("flush"),
            setTimeout((function() {
                e.writable = !0,
                e.emit("drain")
            }
            ), 0)
        }
    }
    ,
    l.prototype.onClose = function() {
        s.prototype.onClose.call(this)
    }
    ,
    l.prototype.doClose = function() {
        void 0 !== this.ws && this.ws.close()
    }
    ,
    l.prototype.uri = function() {
        var t = this.query || {}
          , e = this.secure ? "wss" : "ws"
          , n = "";
        return this.port && ("wss" === e && 443 !== Number(this.port) || "ws" === e && 80 !== Number(this.port)) && (n = ":" + this.port),
        this.timestampRequests && (t[this.timestampParam] = h()),
        this.supportsBinary || (t.b64 = 1),
        (t = c.encode(t)).length && (t = "?" + t),
        e + "://" + (-1 !== this.hostname.indexOf(":") ? "[" + this.hostname + "]" : this.hostname) + n + this.path + t
    }
    ,
    l.prototype.check = function() {
        return !(!p || "__initialize"in p && this.name === l.prototype.name)
    }
}
)),
n.register("4ENQa", (function(t, e) {
    var n = [].indexOf;
    t.exports = function(t, e) {
        if (n)
            return t.indexOf(e);
        for (var r = 0; r < t.length; ++r)
            if (t[r] === e)
                return r;
        return -1
    }
}
)),
n.register("ipyCf", (function(t, e) {
    var r = n("7fUpH")
      , o = n("6nrxU")
      , i = n("9JPPb")
      , s = n("exeLP")
      , a = n("7zHTY")
      , c = n("a8kz7")("socket.io-client:socket")
      , u = n("87Zdq")
      , h = n("G1YHh");
    t.exports = l;
    var f = {
        connect: 1,
        connect_error: 1,
        connect_timeout: 1,
        connecting: 1,
        disconnect: 1,
        error: 1,
        reconnect: 1,
        reconnect_attempt: 1,
        reconnect_failed: 1,
        reconnect_error: 1,
        reconnecting: 1,
        ping: 1,
        pong: 1
    }
      , p = o.prototype.emit;
    function l(t, e, n) {
        this.io = t,
        this.nsp = e,
        this.json = this,
        this.ids = 0,
        this.acks = {},
        this.receiveBuffer = [],
        this.sendBuffer = [],
        this.connected = !1,
        this.disconnected = !0,
        this.flags = {},
        n && n.query && (this.query = n.query),
        this.io.autoConnect && this.open()
    }
    o(l.prototype),
    l.prototype.subEvents = function() {
        if (!this.subs) {
            var t = this.io;
            this.subs = [s(t, "open", a(this, "onopen")), s(t, "packet", a(this, "onpacket")), s(t, "close", a(this, "onclose"))]
        }
    }
    ,
    l.prototype.open = l.prototype.connect = function() {
        return this.connected || (this.subEvents(),
        this.io.reconnecting || this.io.open(),
        "open" === this.io.readyState && this.onopen(),
        this.emit("connecting")),
        this
    }
    ,
    l.prototype.send = function() {
        var t = i(arguments);
        return t.unshift("message"),
        this.emit.apply(this, t),
        this
    }
    ,
    l.prototype.emit = function(t) {
        if (f.hasOwnProperty(t))
            return p.apply(this, arguments),
            this;
        var e = i(arguments)
          , n = {
            type: (void 0 !== this.flags.binary ? this.flags.binary : h(e)) ? r.BINARY_EVENT : r.EVENT,
            data: e,
            options: {}
        };
        return n.options.compress = !this.flags || !1 !== this.flags.compress,
        "function" == typeof e[e.length - 1] && (c("emitting packet with ack id %d", this.ids),
        this.acks[this.ids] = e.pop(),
        n.id = this.ids++),
        this.connected ? this.packet(n) : this.sendBuffer.push(n),
        this.flags = {},
        this
    }
    ,
    l.prototype.packet = function(t) {
        t.nsp = this.nsp,
        this.io.packet(t)
    }
    ,
    l.prototype.onopen = function() {
        if (c("transport is open - connecting"),
        "/" !== this.nsp)
            if (this.query) {
                var t = "object" == typeof this.query ? u.encode(this.query) : this.query;
                c("sending connect packet with query %s", t),
                this.packet({
                    type: r.CONNECT,
                    query: t
                })
            } else
                this.packet({
                    type: r.CONNECT
                })
    }
    ,
    l.prototype.onclose = function(t) {
        c("close (%s)", t),
        this.connected = !1,
        this.disconnected = !0,
        delete this.id,
        this.emit("disconnect", t)
    }
    ,
    l.prototype.onpacket = function(t) {
        var e = t.nsp === this.nsp
          , n = t.type === r.ERROR && "/" === t.nsp;
        if (e || n)
            switch (t.type) {
            case r.CONNECT:
                this.onconnect();
                break;
            case r.EVENT:
            case r.BINARY_EVENT:
                this.onevent(t);
                break;
            case r.ACK:
            case r.BINARY_ACK:
                this.onack(t);
                break;
            case r.DISCONNECT:
                this.ondisconnect();
                break;
            case r.ERROR:
                this.emit("error", t.data)
            }
    }
    ,
    l.prototype.onevent = function(t) {
        var e = t.data || [];
        c("emitting event %j", e),
        null != t.id && (c("attaching ack callback to event"),
        e.push(this.ack(t.id))),
        this.connected ? p.apply(this, e) : this.receiveBuffer.push(e)
    }
    ,
    l.prototype.ack = function(t) {
        var e = this
          , n = !1;
        return function() {
            if (!n) {
                n = !0;
                var o = i(arguments);
                c("sending ack %j", o),
                e.packet({
                    type: h(o) ? r.BINARY_ACK : r.ACK,
                    id: t,
                    data: o
                })
            }
        }
    }
    ,
    l.prototype.onack = function(t) {
        var e = this.acks[t.id];
        "function" == typeof e ? (c("calling ack %s with %j", t.id, t.data),
        e.apply(this, t.data),
        delete this.acks[t.id]) : c("bad ack %s", t.id)
    }
    ,
    l.prototype.onconnect = function() {
        this.connected = !0,
        this.disconnected = !1,
        this.emit("connect"),
        this.emitBuffered()
    }
    ,
    l.prototype.emitBuffered = function() {
        var t;
        for (t = 0; t < this.receiveBuffer.length; t++)
            p.apply(this, this.receiveBuffer[t]);
        for (this.receiveBuffer = [],
        t = 0; t < this.sendBuffer.length; t++)
            this.packet(this.sendBuffer[t]);
        this.sendBuffer = []
    }
    ,
    l.prototype.ondisconnect = function() {
        c("server disconnect (%s)", this.nsp),
        this.destroy(),
        this.onclose("io server disconnect")
    }
    ,
    l.prototype.destroy = function() {
        if (this.subs) {
            for (var t = 0; t < this.subs.length; t++)
                this.subs[t].destroy();
            this.subs = null
        }
        this.io.destroy(this)
    }
    ,
    l.prototype.close = l.prototype.disconnect = function() {
        return this.connected && (c("performing disconnect (%s)", this.nsp),
        this.packet({
            type: r.DISCONNECT
        })),
        this.destroy(),
        this.connected && this.onclose("io client disconnect"),
        this
    }
    ,
    l.prototype.compress = function(t) {
        return this.flags.compress = t,
        this
    }
    ,
    l.prototype.binary = function(t) {
        return this.flags.binary = t,
        this
    }
}
)),
n.register("9JPPb", (function(t, e) {
    t.exports = function(t, e) {
        for (var n = [], r = (e = e || 0) || 0; r < t.length; r++)
            n[r - e] = t[r];
        return n
    }
}
)),
n.register("exeLP", (function(t, e) {
    t.exports = function(t, e, n) {
        return t.on(e, n),
        {
            destroy: function() {
                t.removeListener(e, n)
            }
        }
    }
}
)),
n.register("7zHTY", (function(t, e) {
    var n = [].slice;
    t.exports = function(t, e) {
        if ("string" == typeof e && (e = t[e]),
        "function" != typeof e)
            throw new Error("bind() requires a function");
        var r = n.call(arguments, 2);
        return function() {
            return e.apply(t, r.concat(n.call(arguments)))
        }
    }
}
)),
n.register("l98mf", (function(t, e) {
    function n(t) {
        t = t || {},
        this.ms = t.min || 100,
        this.max = t.max || 1e4,
        this.factor = t.factor || 2,
        this.jitter = t.jitter > 0 && t.jitter <= 1 ? t.jitter : 0,
        this.attempts = 0
    }
    t.exports = n,
    n.prototype.duration = function() {
        var t = this.ms * Math.pow(this.factor, this.attempts++);
        if (this.jitter) {
            var e = Math.random()
              , n = Math.floor(e * this.jitter * t);
            t = 0 == (1 & Math.floor(10 * e)) ? t - n : t + n
        }
        return 0 | Math.min(t, this.max)
    }
    ,
    n.prototype.reset = function() {
        this.attempts = 0
    }
    ,
    n.prototype.setMin = function(t) {
        this.ms = t
    }
    ,
    n.prototype.setMax = function(t) {
        this.max = t
    }
    ,
    n.prototype.setJitter = function(t) {
        this.jitter = t
    }
}
)),
n.register("fcOKg", (function(e, r) {
    var o, i, s, a, c, u, h, f, p;
    t(e.exports, "CONNECT", (function() {
        return o
    }
    ), (function(t) {
        return o = t
    }
    )),
    t(e.exports, "DISCONNECT", (function() {
        return i
    }
    ), (function(t) {
        return i = t
    }
    )),
    t(e.exports, "EVENT", (function() {
        return s
    }
    ), (function(t) {
        return s = t
    }
    )),
    t(e.exports, "ACK", (function() {
        return a
    }
    ), (function(t) {
        return a = t
    }
    )),
    t(e.exports, "ERROR", (function() {
        return c
    }
    ), (function(t) {
        return c = t
    }
    )),
    t(e.exports, "BINARY_EVENT", (function() {
        return u
    }
    ), (function(t) {
        return u = t
    }
    )),
    t(e.exports, "BINARY_ACK", (function() {
        return h
    }
    ), (function(t) {
        return h = t
    }
    )),
    t(e.exports, "Encoder", (function() {
        return f
    }
    ), (function(t) {
        return f = t
    }
    )),
    t(e.exports, "Decoder", (function() {
        return p
    }
    ), (function(t) {
        return p = t
    }
    ));
    var l = n("lrF2s")
      , d = n("6nrxU");
    o = 0,
    i = 1,
    s = 2,
    a = 3,
    c = 4,
    u = 5,
    h = 6;
    var y = Number.isInteger || function(t) {
        return "number" == typeof t && isFinite(t) && Math.floor(t) === t
    }
      , g = function(t) {
        return "string" == typeof t
    };
    function m() {}
    function v() {}
    m.prototype.encode = function(t, e) {
        switch (t.type) {
        case o:
        case i:
        case c:
            return e([JSON.stringify(t)]);
        default:
            return e([l.encode(t)])
        }
    }
    ,
    d(v.prototype),
    v.prototype.add = function(t) {
        "string" == typeof t ? this.parseJSON(t) : this.parseBinary(t)
    }
    ,
    v.prototype.parseJSON = function(t) {
        var e = JSON.parse(t);
        this.checkPacket(e),
        this.emit("decoded", e)
    }
    ,
    v.prototype.parseBinary = function(t) {
        var e = l.decode(t);
        this.checkPacket(e),
        this.emit("decoded", e)
    }
    ,
    v.prototype.checkPacket = function(t) {
        if (!(y(t.type) && t.type >= o && t.type <= h))
            throw new Error("invalid packet type");
        if (!g(t.nsp))
            throw new Error("invalid namespace");
        if (!function(t) {
            switch (t.type) {
            case o:
            case i:
                return void 0 === t.data;
            case c:
                return g(t.data);
            default:
                return Array.isArray(t.data)
            }
        }(t))
            throw new Error("invalid payload");
        if (!(void 0 === t.id || y(t.id)))
            throw new Error("invalid packet id")
    }
    ,
    v.prototype.destroy = function() {}
    ,
    f = m,
    p = v
}
)),
n.register("lrF2s", (function(e, r) {
    var o, i;
    t(e.exports, "encode", (function() {
        return o
    }
    ), (function(t) {
        return o = t
    }
    )),
    t(e.exports, "decode", (function() {
        return i
    }
    ), (function(t) {
        return i = t
    }
    )),
    o = n("eMpV6"),
    i = n("5ErPW")
}
)),
n.register("eMpV6", (function(t, e) {
    function n(t, e, n) {
        for (var r = 0, o = 0, i = n.length; o < i; o++)
            (r = n.charCodeAt(o)) < 128 ? t.setUint8(e++, r) : r < 2048 ? (t.setUint8(e++, 192 | r >> 6),
            t.setUint8(e++, 128 | 63 & r)) : r < 55296 || r >= 57344 ? (t.setUint8(e++, 224 | r >> 12),
            t.setUint8(e++, 128 | r >> 6 & 63),
            t.setUint8(e++, 128 | 63 & r)) : (o++,
            r = 65536 + ((1023 & r) << 10 | 1023 & n.charCodeAt(o)),
            t.setUint8(e++, 240 | r >> 18),
            t.setUint8(e++, 128 | r >> 12 & 63),
            t.setUint8(e++, 128 | r >> 6 & 63),
            t.setUint8(e++, 128 | 63 & r))
    }
    function r(t, e, n) {
        var o = typeof n
          , i = 0
          , s = 0
          , a = 0
          , c = 0
          , u = 0
          , h = 0;
        if ("string" === o) {
            if (u = function(t) {
                for (var e = 0, n = 0, r = 0, o = t.length; r < o; r++)
                    (e = t.charCodeAt(r)) < 128 ? n += 1 : e < 2048 ? n += 2 : e < 55296 || e >= 57344 ? n += 3 : (r++,
                    n += 4);
                return n
            }(n),
            u < 32)
                t.push(160 | u),
                h = 1;
            else if (u < 256)
                t.push(217, u),
                h = 2;
            else if (u < 65536)
                t.push(218, u >> 8, u),
                h = 3;
            else {
                if (!(u < 4294967296))
                    throw new Error("String too long");
                t.push(219, u >> 24, u >> 16, u >> 8, u),
                h = 5
            }
            return e.push({
                _str: n,
                _length: u,
                _offset: t.length
            }),
            h + u
        }
        if ("number" === o)
            return Math.floor(n) === n && isFinite(n) ? n >= 0 ? n < 128 ? (t.push(n),
            1) : n < 256 ? (t.push(204, n),
            2) : n < 65536 ? (t.push(205, n >> 8, n),
            3) : n < 4294967296 ? (t.push(206, n >> 24, n >> 16, n >> 8, n),
            5) : (a = n / Math.pow(2, 32) >> 0,
            c = n >>> 0,
            t.push(207, a >> 24, a >> 16, a >> 8, a, c >> 24, c >> 16, c >> 8, c),
            9) : n >= -32 ? (t.push(n),
            1) : n >= -128 ? (t.push(208, n),
            2) : n >= -32768 ? (t.push(209, n >> 8, n),
            3) : n >= -2147483648 ? (t.push(210, n >> 24, n >> 16, n >> 8, n),
            5) : (a = Math.floor(n / Math.pow(2, 32)),
            c = n >>> 0,
            t.push(211, a >> 24, a >> 16, a >> 8, a, c >> 24, c >> 16, c >> 8, c),
            9) : (t.push(203),
            e.push({
                _float: n,
                _length: 8,
                _offset: t.length
            }),
            9);
        if ("object" === o) {
            if (null === n)
                return t.push(192),
                1;
            if (Array.isArray(n)) {
                if ((u = n.length) < 16)
                    t.push(144 | u),
                    h = 1;
                else if (u < 65536)
                    t.push(220, u >> 8, u),
                    h = 3;
                else {
                    if (!(u < 4294967296))
                        throw new Error("Array too large");
                    t.push(221, u >> 24, u >> 16, u >> 8, u),
                    h = 5
                }
                for (i = 0; i < u; i++)
                    h += r(t, e, n[i]);
                return h
            }
            if (n instanceof Date) {
                var f = n.getTime();
                return a = Math.floor(f / Math.pow(2, 32)),
                c = f >>> 0,
                t.push(215, 0, a >> 24, a >> 16, a >> 8, a, c >> 24, c >> 16, c >> 8, c),
                10
            }
            if (n instanceof ArrayBuffer) {
                if ((u = n.byteLength) < 256)
                    t.push(196, u),
                    h = 2;
                else if (u < 65536)
                    t.push(197, u >> 8, u),
                    h = 3;
                else {
                    if (!(u < 4294967296))
                        throw new Error("Buffer too large");
                    t.push(198, u >> 24, u >> 16, u >> 8, u),
                    h = 5
                }
                return e.push({
                    _bin: n,
                    _length: u,
                    _offset: t.length
                }),
                h + u
            }
            if ("function" == typeof n.toJSON)
                return r(t, e, n.toJSON());
            var p = []
              , l = ""
              , d = Object.keys(n);
            for (i = 0,
            s = d.length; i < s; i++)
                "function" != typeof n[l = d[i]] && p.push(l);
            if ((u = p.length) < 16)
                t.push(128 | u),
                h = 1;
            else if (u < 65536)
                t.push(222, u >> 8, u),
                h = 3;
            else {
                if (!(u < 4294967296))
                    throw new Error("Object too large");
                t.push(223, u >> 24, u >> 16, u >> 8, u),
                h = 5
            }
            for (i = 0; i < u; i++)
                h += r(t, e, l = p[i]),
                h += r(t, e, n[l]);
            return h
        }
        if ("boolean" === o)
            return t.push(n ? 195 : 194),
            1;
        if ("undefined" === o)
            return t.push(212, 0, 0),
            3;
        throw new Error("Could not encode")
    }
    t.exports = function(t) {
        var e = []
          , o = []
          , i = r(e, o, t)
          , s = new ArrayBuffer(i)
          , a = new DataView(s)
          , c = 0
          , u = 0
          , h = -1;
        o.length > 0 && (h = o[0]._offset);
        for (var f, p = 0, l = 0, d = 0, y = e.length; d < y; d++)
            if (a.setUint8(u + d, e[d]),
            d + 1 === h) {
                if (p = (f = o[c])._length,
                l = u + h,
                f._bin)
                    for (var g = new Uint8Array(f._bin), m = 0; m < p; m++)
                        a.setUint8(l + m, g[m]);
                else
                    f._str ? n(a, l, f._str) : void 0 !== f._float && a.setFloat64(l, f._float);
                u += p,
                o[++c] && (h = o[c]._offset)
            }
        return s
    }
}
)),
n.register("5ErPW", (function(t, e) {
    function n(t) {
        if (this._offset = 0,
        t instanceof ArrayBuffer)
            this._buffer = t,
            this._view = new DataView(this._buffer);
        else {
            if (!ArrayBuffer.isView(t))
                throw new Error("Invalid argument");
            this._buffer = t.buffer,
            this._view = new DataView(this._buffer,t.byteOffset,t.byteLength)
        }
    }
    n.prototype._array = function(t) {
        for (var e = new Array(t), n = 0; n < t; n++)
            e[n] = this._parse();
        return e
    }
    ,
    n.prototype._map = function(t) {
        for (var e = {}, n = 0; n < t; n++)
            e[this._parse()] = this._parse();
        return e
    }
    ,
    n.prototype._str = function(t) {
        var e = function(t, e, n) {
            for (var r = "", o = 0, i = e, s = e + n; i < s; i++) {
                var a = t.getUint8(i);
                if (0 != (128 & a))
                    if (192 != (224 & a))
                        if (224 != (240 & a)) {
                            if (240 != (248 & a))
                                throw new Error("Invalid byte " + a.toString(16));
                            (o = (7 & a) << 18 | (63 & t.getUint8(++i)) << 12 | (63 & t.getUint8(++i)) << 6 | (63 & t.getUint8(++i)) << 0) >= 65536 ? (o -= 65536,
                            r += String.fromCharCode(55296 + (o >>> 10), 56320 + (1023 & o))) : r += String.fromCharCode(o)
                        } else
                            r += String.fromCharCode((15 & a) << 12 | (63 & t.getUint8(++i)) << 6 | (63 & t.getUint8(++i)) << 0);
                    else
                        r += String.fromCharCode((31 & a) << 6 | 63 & t.getUint8(++i));
                else
                    r += String.fromCharCode(a)
            }
            return r
        }(this._view, this._offset, t);
        return this._offset += t,
        e
    }
    ,
    n.prototype._bin = function(t) {
        var e = this._buffer.slice(this._offset, this._offset + t);
        return this._offset += t,
        e
    }
    ,
    n.prototype._parse = function() {
        var t, e = this._view.getUint8(this._offset++), n = 0, r = 0, o = 0, i = 0;
        if (e < 192)
            return e < 128 ? e : e < 144 ? this._map(15 & e) : e < 160 ? this._array(15 & e) : this._str(31 & e);
        if (e > 223)
            return -1 * (255 - e + 1);
        switch (e) {
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
            r = this._view.getInt8(this._offset + 1),
            this._offset += 2,
            [r, this._bin(n)];
        case 200:
            return n = this._view.getUint16(this._offset),
            r = this._view.getInt8(this._offset + 2),
            this._offset += 3,
            [r, this._bin(n)];
        case 201:
            return n = this._view.getUint32(this._offset),
            r = this._view.getInt8(this._offset + 4),
            this._offset += 5,
            [r, this._bin(n)];
        case 202:
            return t = this._view.getFloat32(this._offset),
            this._offset += 4,
            t;
        case 203:
            return t = this._view.getFloat64(this._offset),
            this._offset += 8,
            t;
        case 204:
            return t = this._view.getUint8(this._offset),
            this._offset += 1,
            t;
        case 205:
            return t = this._view.getUint16(this._offset),
            this._offset += 2,
            t;
        case 206:
            return t = this._view.getUint32(this._offset),
            this._offset += 4,
            t;
        case 207:
            return o = this._view.getUint32(this._offset) * Math.pow(2, 32),
            i = this._view.getUint32(this._offset + 4),
            this._offset += 8,
            o + i;
        case 208:
            return t = this._view.getInt8(this._offset),
            this._offset += 1,
            t;
        case 209:
            return t = this._view.getInt16(this._offset),
            this._offset += 2,
            t;
        case 210:
            return t = this._view.getInt32(this._offset),
            this._offset += 4,
            t;
        case 211:
            return o = this._view.getInt32(this._offset) * Math.pow(2, 32),
            i = this._view.getUint32(this._offset + 4),
            this._offset += 8,
            o + i;
        case 212:
            return r = this._view.getInt8(this._offset),
            this._offset += 1,
            0 === r ? void (this._offset += 1) : [r, this._bin(1)];
        case 213:
            return r = this._view.getInt8(this._offset),
            this._offset += 1,
            [r, this._bin(2)];
        case 214:
            return r = this._view.getInt8(this._offset),
            this._offset += 1,
            [r, this._bin(4)];
        case 215:
            return r = this._view.getInt8(this._offset),
            this._offset += 1,
            0 === r ? (o = this._view.getInt32(this._offset) * Math.pow(2, 32),
            i = this._view.getUint32(this._offset + 4),
            this._offset += 8,
            new Date(o + i)) : [r, this._bin(8)];
        case 216:
            return r = this._view.getInt8(this._offset),
            this._offset += 1,
            [r, this._bin(16)];
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
    ,
    t.exports = function(t) {
        var e = new n(t)
          , r = e._parse();
        if (e._offset !== t.byteLength)
            throw new Error(t.byteLength - e._offset + " trailing bytes");
        return r
    }
}
)),
n.register("2ppBl", (function(t, e) {
    Object.defineProperty(t.exports, "__esModule", {
        value: !0
    });
    t.exports.default = class {
        add(t, e) {
            const n = Math.random().toString();
            return this.callbacks.push({
                callback: t,
                timesCalled: 0,
                canCallMultipleTimes: !e,
                id: n
            }),
            ()=>this.removeCallback(n)
        }
        clear() {
            this.callbacks.splice(0, this.callbacks.length)
        }
        call(t, e) {
            this.callbacks = this.callbacks.map((n=>n.timesCalled > 0 && !n.canCallMultipleTimes ? n : (n.callback(t, e),
            Object.assign({}, n, {
                timesCalled: n.timesCalled + 1
            }))))
        }
        constructor() {
            this.callbacks = [],
            this.removeCallback = t=>{
                this.callbacks = this.callbacks.filter((e=>e.id !== t))
            }
        }
    }
}
)),
n.register("gooHl", (function(t, e) {
    Object.defineProperty(t.exports, "__esModule", {
        value: !0
    });
    t.exports.default = {
        createNewRoom: "blueboat_CREATE_NEW_ROOM",
        joinRoom: "blueboat_JOIN_ROOM",
        sendMessage: "blueboat_SEND_MESSAGE",
        listen: "blueboat_LISTEN_STATE",
        requestAvailableRooms: "blueboat_AVAILABLE_ROOMS",
        ping: "blueboat-ping"
    }
}
)),
n.register("iXPWM", (function(t, e) {
    Object.defineProperty(t.exports, "__esModule", {
        value: !0
    }),
    t.exports.BLUEBOAT_ID = "blueboat-id"
}
)),
n.register("dccKP", (function(t, e) {
    Object.defineProperty(t.exports, "__esModule", {
        value: !0
    });
    t.exports.default = {
        clientIdSet: "CLIENT_ID_SET",
        joinedRoom: "blueboat_JOINED_ROOM",
        statePatch: "STATE_PATCH",
        removedFromRoom: "blueboat_REMOVED_FROM_ROOM",
        availableRooms: "blueboat_AVAILABLE_ROOMS"
    }
}
)),
n.register("5MVc0", (function(t, e) {
    var r = t.exports && t.exports.__importDefault || function(t) {
        return t && t.__esModule ? t : {
            default: t
        }
    }
    ;
    Object.defineProperty(t.exports, "__esModule", {
        value: !0
    });
    const o = r(n("dccKP"))
      , i = r(n("2ppBl"))
      , s = r(n("gooHl"));
    t.exports.default = class {
        _setRoomId(t) {
            this.id = t,
            this.socketListener()
        }
        socketListener() {
            const t = this.socket;
            t.on(`${this.id}-error`, (t=>this.onJoinError.call(t))),
            t.on(`message-${this.id}`, (t=>{
                const {key: e, data: n} = t;
                if (e)
                    return e === o.default.joinedRoom ? (this.joined = !0,
                    void this.onJoin.call()) : e === o.default.removedFromRoom ? (this.onLeave.call(),
                    void (this.joined = !1)) : void this.onMessage.call(e, n)
            }
            ))
        }
        constructor(t, e, n) {
            this.joined = !1,
            this.initialJoinOptions = {},
            this.onJoinAttempt = new i.default,
            this.onCreate = new i.default,
            this.onJoin = new i.default,
            this.onJoinError = new i.default,
            this.onMessage = new i.default,
            this.onLeave = new i.default,
            this.send = (t,e)=>{
                this.socket.emit(s.default.sendMessage, {
                    room: this.id,
                    key: t,
                    data: e
                })
            }
            ,
            n && (this.id = n),
            e && (this.initialJoinOptions = e),
            t && (this.socket = t,
            n && this.socketListener())
        }
    }
}
));
