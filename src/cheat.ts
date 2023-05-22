import SocketHandler from './network/socket';
import KeybindManager from './keybindManager';
import Hud from './hud/hud';
import { Script } from './interfaces';

import { Devtools } from './scripts/general/devtools';
import { Autoanswer } from './scripts/general/autoanswer';
import { Cosmeticpicker } from './scripts/general/cosmeticpicker';
import { Playerhighlighter } from './scripts/general/playerhighlighter';
import { Freecam } from './scripts/general/freecam';
import { Classic } from './scripts/gamemodes/classic';
import { RichMode } from './scripts/gamemodes/superrichmode';
import { TrustNoOne } from './scripts/gamemodes/trustnoone';
import { Instantuse } from './scripts/general/instantuse';
import { Instapurchasers } from './scripts/gamemodes/purchasers';
import { Farmchain } from './scripts/gamemodes/farmchain';
// import { BotCreator } from './scripts/general/botcreator';

class Cheat extends EventTarget {
    socketHandler: SocketHandler;
    keybindManager: KeybindManager = new KeybindManager();
    hud: Hud;
    funcs: Map<string, Function> = new Map();
    scripts: Script[] = [];

    constructor() {
        super();

        // add cheat to the global scope
        (window as any).cheat = this;

        this.socketHandler = new SocketHandler(this);

        this.socketHandler.addEventListener("socket", (e) => {
            cheat.log("Socket connected", e)
        })

        this.socketHandler.getSocket();

        this.hud = new Hud(this);

        // initialize any scripts
        this.scripts = [
            Devtools(),
            Instantuse(),
            Autoanswer(),
            Cosmeticpicker(),
            Playerhighlighter(),
            Freecam(),
            
            Classic(),
            RichMode(),
            TrustNoOne(),
            Farmchain(),
            Instapurchasers()

            // BotCreator()
        ]

        this.initScripts();
        this.waitForLoad();
    }

    waitForLoad() {
        // colyseus exclusive
        let loadInterval = setInterval(() => {
            let loadedData = (unsafeWindow as any)?.stores?.loading
            let loaded = loadedData?.percentageAssetsLoaded >= 100 && loadedData?.completedInitialLoad
                && loadedData?.loadedInitialDevices && loadedData?.loadedInitialTerrain

            if(!loaded) return;
            // check whether we've been assigned to a team
            let team = (unsafeWindow as any)?.stores?.phaser?.mainCharacter?.teamId

            if(team == "__NO_TEAM_ID") return

            clearInterval(loadInterval)
            this.log("Game Loaded")
            this.dispatchEvent(new CustomEvent("gameLoaded"))
        }, 1000 / 60)

        // TODO: Add blueboat load detection
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