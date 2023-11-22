import { HudObject } from "../../interfaces";
import StegCloak from 'stegcloak';
// @ts-ignore
import blueboat from '../../network/blueboat';

class GimkitRoom {
    roomId: string;
    roomInfo: any;
    roomInfoReady: Promise<void>;
    resolveRoomInfo?: Function;

    constructor(roomId: string) {
        this.roomId = roomId;
        this.roomInfoReady = new Promise((resolve, reject) => {
            this.resolveRoomInfo = resolve;
        });

        // get info about the room
        this.getRoomInfo();
    }

    private async getRoomInfo() {
        let infoRes = await fetch('https://www.gimkit.com/api/matchmaker/find-info-from-code', {
            method: 'POST',
            body: JSON.stringify({code: this.roomId}),
            headers: {
                'Content-Type': 'application/json'
            }
        })
        let info: any = await infoRes.json();
    
        if(info.code === 404) throw new Error('Game not found');

        this.roomInfo = info;
        this.resolveRoomInfo?.();
    }

    async spawn(name: string = Math.random().toString(36).substring(7)) {
        // wait until we have the room info
        await this.roomInfoReady;

        // load the page
        let pageRes = await fetch('https://www.gimkit.com/join');
        let page = await pageRes.text();
        
        // extract the jid
        const parser = new DOMParser();
        const root = parser.parseFromString(page, "text/html");
        const jid = root.querySelector("meta[property='int:jid']")!.getAttribute("content")!.split("").reverse().join("")
        
        // let clientType = "Gimkit Web Client V3.1"
        let clientType = new StegCloak(true, false).hide(jid, "BSKA", "Gimkit Web Client V3.1");

        // join the game
        let joinRes = await fetch("https://www.gimkit.com/api/matchmaker/join", {
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                clientType: clientType,
                name: name,
                roomId: this.roomInfo.roomId
            }),
            method: "POST"
        });
        let join: any = await joinRes.json();

        if(join.source == 'original') {
            // we are connecting using blueboat
            const wsUrl = `wss${join.serverUrl.substr(5)}/blueboat/?id=&EIO=3&transport=websocket`
            let ws = new WebSocket(wsUrl);

            ws.addEventListener('open', () => {
                // send a join packet
                let packet = blueboat.encode(['blueboat_JOIN_ROOM', {
                    roomId: join.roomId,
                    options: { intent: join.intentId }
                }])

                ws.send(packet);

                // periodically send a heartbeat packet
                let heartbeat = setInterval(() => {
                    ws.send('2');
                }, 25000);

                // stop the heartbeat when the connection closes
                ws.addEventListener('close', () => {
                    clearInterval(heartbeat);
                })
            })

            return ws;
        }
        
        const joinIdUrl = `${join.serverUrl}/matchmake/joinById/${join.roomId}`;
        
        let roomRes = await fetch(joinIdUrl, {
            headers: {
                'Content-Type': 'application/json'
            },
            method: "POST",
            body: JSON.stringify({
                intentId: join.intentId
            })
        });
        let room: any = await roomRes.json();
        
        const wsUrl = `wss${join.serverUrl.substr(5)}/${room.room.processId}/${room.room.roomId}?sessionId=${room.sessionId}`;
        
        return new WebSocket(wsUrl);
    }
}

const hudAddition: HudObject = {
    menus: [
        {
            name: "General Cheats",
            groups: [
                {
                    name: "Account Spawner (beta)",
                    elements: [
                        {
                            type: "text",
                            options: {
                                text: "Spawn an account in your game with any name."
                            }
                        },
                        {
                            type: "button",
                            options: {
                                text: "Disconnect All",
                                runFunction: "disconnect"
                            }
                        }
                    ]
                }
            ]
        }
    ]
}

class SpawnerClass {
    name: string = "Account Spawner";
    hudAddition: HudObject = hudAddition;
    accountName: string = "My Epic Bot";

    funcs: Map<string, Function> = new Map([
        ["disconnect", () => {
            this.removeAll();
        }]
    ]);
    connections: WebSocket[] = [];

    room?: GimkitRoom;
    cheat?: any;

    init(cheat: any) {
        this.cheat = cheat;
        let accountNameInput = cheat.hud.menu("General Cheats")?.group("Account Spawner (beta)")?.addElement("textinput", {
            text: "Account Name"
        })
        accountNameInput?.addEventListener("input", (e: any) => {
            this.accountName = e.detail;
        })
        let applyButton = cheat.hud.menu("General Cheats")?.group("Account Spawner (beta)")?.addElement("button", {
            text: "Spawn Account"
        })
        applyButton?.addEventListener("click", () => {
            this.spawnAccount();
        })
    }

    async spawnAccount() {
        if(!this.cheat.gameId) return;
        if(!this.room) this.room = new GimkitRoom(this.cheat.gameId);

        this.connections.push(await this.room.spawn(this.accountName));
    }

    removeAll() {
        for(let connection of this.connections) {
            connection.close();
        }
        this.connections = [];
    }
}

export function Spawner() {
    return new SpawnerClass();
}