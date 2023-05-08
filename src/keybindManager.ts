import { Keybind } from "./interfaces";

export default class KeybindManager {
    keys: Set<string> = new Set();
    binds: Keybind[] = [];

    constructor() {
        this.addListeners()
    }

    addListeners() {
        window.addEventListener("keydown", (e) => {
            this.keys.add(e.key.toLowerCase())
            this.checkBinds(e)
        })

        window.addEventListener("keyup", (e) => {
            this.keys.delete(e.key.toLowerCase())
        })

        window.addEventListener("blur", () => {
            this.keys.clear()
        })
    }

    checkBinds(e: KeyboardEvent) {
        if(e.repeat) return

        for(let bind of this.binds) {
            if(!bind.keys.has(e.key.toLowerCase())) continue
            if(bind.keys.size == 0) continue

            // if the bind is exclusive, make sure no other keys are pressed
            if(bind.exclusive && bind.keys.size != this.keys.size) continue

            // check whether the keys in the bind are pressed
            if(Array.from(bind.keys).every(key => this.keys.has(key))) {
                bind.callback?.()   
            }
        }
    }

    registerBind(bind: Keybind) {
        if(this.binds.includes(bind)) return
        this.binds.push(bind)
    }

    removeBind(bind: Keybind) {
        if(!this.binds.includes(bind)) return
        this.binds.splice(this.binds.indexOf(bind), 1)
    }

    clearBinds() {
        this.binds = []
    }
}