import { GCSocket } from "../interfaces";
// @ts-ignore (can't be bothered to figure out how to import this)
import colyseus from "./colyseus"
// @ts-ignore
import blueboat from "./blueboat"

class SocketHandler extends EventTarget {
	socket: GCSocket | null = null;
	hasFired: boolean = false;
	transportType: string = "unknown";
	blueboatRoomId: string | null = null;
	cheat: any;

	constructor(cheat: any) {
		super();

		this.cheat = cheat;
	}

	getSocket() {
		let handlerThis = this;
		if(!Object.isFrozen(WebSocket)) {
			// intercept any outgoing socket connections
			(WebSocket.prototype as GCSocket)._send = WebSocket.prototype.send;
			WebSocket.prototype.send = function(data) {
				// if the url is a local url, don't intercept it
				if(this.url.startsWith("ws://localhost")) return (this as GCSocket)._send(data);

				handlerThis.registerSocket(this as GCSocket);

				if(!handlerThis.socket) return
				handlerThis.socket._send(data);

				// attempt to get the room id
				if(handlerThis.transportType == "blueboat") {
					let decoded = blueboat.decode(data);

					if(decoded.roomId) handlerThis.blueboatRoomId = decoded.roomId;
					if(decoded.room) handlerThis.blueboatRoomId = decoded.room;
					if(!handlerThis.blueboatRoomId) handlerThis.cheat.log("Room ID: ", handlerThis.blueboatRoomId);
				}
			}
		} else {
			// periodically attempt to extract the socket, in case something failed
			let tryGetSocket = setInterval(() => {
				let gotSocket = (window as any)?.stores?.network?.room?.connection?.transport?.ws
				if(gotSocket) {
					handlerThis.registerSocket(gotSocket);
					clearInterval(tryGetSocket);
				}
			}, 100)
		}
	}

	registerSocket(socket: GCSocket) {
		if(this.hasFired) return;
		this.socket = socket;
		this.hasFired = true;
		this.dispatchEvent(new CustomEvent("socket", { detail: socket }));
		
		// detect the transport type
		if("stores" in unsafeWindow) this.transportType = "colyseus";
		else this.transportType = "blueboat";

		let handlerThis = this;

		socket.addEventListener("message", (e) => {
			// decode the message
			let decoded
			if(this.transportType == "colyseus") decoded = colyseus.decode(e.data);
			else decoded = blueboat.decode(e.data);

			if(!decoded) return;

			handlerThis.dispatchEvent(new CustomEvent("recieveMessage", { detail: decoded }));
		})
	}

	sendData(channel: string, data: any) {
		if(!this.socket) return
		if(!this.blueboatRoomId && this.transportType == "blueboat") return this.cheat.log("Room ID not found, can't send data");

		let encoded
		if(this.transportType == "colyseus") encoded = colyseus.encode(channel, data);
		else encoded = blueboat.encode(channel, data, this.blueboatRoomId);

		this.socket.send(encoded);
	}
}

export default SocketHandler;