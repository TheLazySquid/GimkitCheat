import SocketHandler from './network/socket';
import KeybindManager from './keybindManager';
import Hud from './hud/hud';
import DeviceManager from './deviceManager';
import { Script } from './interfaces';

import { Devtools } from './scripts/general/devtools';
import { Autoanswer } from './scripts/general/autoanswer';
import { Cosmeticpicker } from './scripts/general/cosmeticpicker';
import { Playerhighlighter } from './scripts/general/playerhighlighter';
import { Freecam } from './scripts/general/freecam';
import { Classic } from './scripts/gamemodes/classic';
import { RichMode } from './scripts/gamemodes/superrichmode';

class Cheat extends EventTarget {
    socketHandler: SocketHandler;
    keybindManager: KeybindManager = new KeybindManager();
    deviceManager: DeviceManager;
    hud: Hud;
    funcs: Map<string, Function> = new Map();
    scripts: Script[] = [];

    constructor() {
        super();

        // add cheat to the global scope
        (window as any).cheat = this;

        this.socketHandler = new SocketHandler(this);
        this.deviceManager = new DeviceManager(this);

        this.socketHandler.addEventListener("socket", (e) => {
            cheat.log("Socket connected", e)
        })

        this.socketHandler.getSocket();

        this.hud = new Hud(this);

        // initialize any scripts
        this.scripts = [
            Devtools(),
            Autoanswer(),
            Cosmeticpicker(),
            Playerhighlighter(),
            Freecam(),
            Classic(),
            RichMode()
        ]

        this.initScripts();
    }

    initScripts() {
        for(let script of this.scripts) {
            // add functions
            if(script.funcs) {
                for(let [name, func] of script.funcs) {
                    this.funcs.set(name, func);
                }
            }

            // add hud additions
            if(script.hudAddition) {
                this.hud.loadFromObject(script.hudAddition);
            }

            // initialize the script
            if(script.init) {
                script.init(this);
            }
        }
    }

    antifreeze() {
        let nativeFreeze = Object.freeze
        Object.freeze = (obj: any) => {
            if(obj.constructor?.name == "WebSocket" || obj.name == "WebSocket") return obj
            return nativeFreeze(obj)
        }
        
        // ignore any attempts to modify WebSocket.prototype.send
        var originalSend = WebSocket.prototype.send;
        Object.defineProperty(WebSocket.prototype, 'send', {
            configurable: false,
            enumerable: false,
            get: function () {
                return originalSend;
            },
            set: function (value) {
                if (value === originalSend) {
                    return; // allow setting to the original value
                }
                console.log("Attempted to modify WebSocket.prototype.send")
            }
        });
    }

    log(...args: any[]) {
        console.log("[GC]", ...args);
    }

    getScript(name: string) {
        for(let script of this.scripts) {
            if(script.name == name) return script;
        }
        return null;
    }
}

const cheat = new Cheat();

export default cheat