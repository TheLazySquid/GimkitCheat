import { getUnsafeWindow, parseChangePacket } from "../utils";
import blueboat from "./blueboat";
import * as msgpack from "../../node_modules/colyseus.js/lib/msgpack/index.js"
import { Protocol } from "../../node_modules/colyseus.js/dist/colyseus.js";
import { writable, get } from "svelte/store";
import { onMessage } from "./schemaDecode";

class SocketManager extends EventTarget {
    private socket: WebSocket | null = null;
    transportType = writable<"unknown" | "colyseus" | "blueboat">("unknown");
    blueboatRoomId: string | null = null;

    setup() {
        let manager = this;

        // override the default WebSocket
        class NewWebSocket extends WebSocket {
            constructor(url: string | URL, params?: string | string[]) {
                super(url, params)
                if(!manager.socket) {
                    manager.registerSocket(this);
                }
            }
        
            send(data: any) {
                manager.onSend(data);
                super.send(data);
            }
        }

        // override XMLHttpRequest to get the room id
        let nativeXMLSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function() {
            this.addEventListener('load', () => {
                if(!this.responseURL.endsWith("/matchmaker/join")) return;
                let response = JSON.parse(this.responseText);

                manager.blueboatRoomId = response.roomId;
                console.log("Got Blueboat Room Id: " + manager.blueboatRoomId)
            })
            nativeXMLSend.apply(this, arguments);
        }
        
        getUnsafeWindow().WebSocket = NewWebSocket;
    }

    registerSocket(socket: WebSocket) {
        this.socket = socket;

        // detect the transport type
        if('Phaser' in getUnsafeWindow()) {
            this.transportType.set("colyseus");
            this.addEventListener('colyseusMessage', (e: any) => {
                if(e.detail.type != "DEVICES_STATES_CHANGES") return;

                let changes = parseChangePacket(e.detail.message);
                this.dispatchEvent(new CustomEvent('deviceChanges', {
                    detail: changes
                }))
            })
        }
        else this.transportType.set("blueboat");

        // when we get a message, decode it and dispatch it
        socket.addEventListener('message', (e) => {
            let decoded: any;
            if(get(this.transportType) == 'colyseus') {
                decoded = onMessage(e);
                if(!decoded) return;

                this.dispatchEvent(new CustomEvent('colyseusMessage', {
                    detail: decoded
                }))
            } else {
                decoded = blueboat.decode(e.data);
                if(!decoded) return;

                this.dispatchEvent(new CustomEvent('blueboatMessage', {
                    detail: decoded
                }))
            }
        })
    }

    onSend(data: any) {
        // if we're already in a room, get the room id from the data
        if(get(this.transportType) == "blueboat" && !this.blueboatRoomId) {
            let decoded = blueboat.decode(data);

            if(decoded.roomId) this.blueboatRoomId = decoded.roomId;
            if(decoded.room) this.blueboatRoomId = decoded.room;

            if(this.blueboatRoomId) {
                console.log("Got Blueboat Room Id: " + this.blueboatRoomId)
            }
        }
    }

    sendMessage(channel: string, data: any) {
        if(!this.socket) return;
        if(!this.blueboatRoomId && get(this.transportType) == "blueboat") return;

        let encoded: any;
        if(get(this.transportType) == 'colyseus') {
            let header = [Protocol.ROOM_DATA]
            let channelEncoded = msgpack.encode(channel)
            let packetEncoded = msgpack.encode(data)
        
            // combine the arraybuffers
            encoded = new Uint8Array(channelEncoded.byteLength + packetEncoded.byteLength + header.length)
            encoded.set(header)
            encoded.set(new Uint8Array(channelEncoded), header.length)
            encoded.set(new Uint8Array(packetEncoded), header.length + channelEncoded.byteLength)
        }
        else encoded = blueboat.encode(channel, data, this.blueboatRoomId);

        this.socket.send(encoded);
    }
}

const socketManager = new SocketManager();
export default socketManager;