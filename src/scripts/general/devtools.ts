import { HudObject } from "../../interfaces";

const hudAddition: HudObject = {
    menus: [
        {
            name: "Devtools",
            elements: [
                {
                    type: "toggle",
                    options: {
                        textEnabled: "Stop logging incoming messages",
                        textDisabled: "Log incoming messages",
                        default: false,
                        runFunction: "logIncomingMessages"
                    }
                }
            ]
        }
    ]
}

class DevtoolsClass {
    name: string = "Gimkit Cheat Devtools";
    hudAddition: HudObject = hudAddition;
    loggingIncomingMessages: boolean = false;
    funcs: Map<string, Function> = new Map([
        ["logIncomingMessages", (enabled: boolean) => {
            this.loggingIncomingMessages = enabled;
        }]
    ]);

    init(cheat: any) {
        cheat.socketHandler.addEventListener("recieveMessage", (e: CustomEvent) => {
            if(!this.loggingIncomingMessages) return;
            cheat.log("Incoming message", e.detail)
        })
    }
}

export function Devtools() {
    return new DevtoolsClass();
}