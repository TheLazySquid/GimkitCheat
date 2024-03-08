import { Reflection, type Iterator, decode } from "@colyseus/schema";
import { Protocol } from "../../node_modules/colyseus.js/dist/colyseus.js";
import { utf8Read, utf8Length } from "../../node_modules/colyseus.js/lib/Protocol.js";
import * as msgpack from '../../node_modules/colyseus.js/lib/msgpack/index.js';

class SchemaSerializer extends EventTarget {
    state: any;

    setState(rawState: any) {
        this.state.decode(rawState);
        this.dispatchEvent(new CustomEvent('patch', { detail: null }))
        this.dispatchEvent(new Event('load'))
    }

    getState() {
        return this.state;
    }

    patch(patches) {
        let res = this.state.decode(patches);
        for (let change of res) {
            if(change.field != 'gameTime') {
                this.dispatchEvent(new CustomEvent('patch', { detail: res }));
                break;
            }
        }
    }

    teardown() {
        this.state?.['$changes']?.root.clearRefs();
    }

    handshake(bytes: number[], it?: Iterator) {
        if (this.state) {
            const reflection = new Reflection();
            reflection.decode(bytes, it);
        } else {
            // initialize reflected state from server
            this.state = Reflection.decode(bytes, it) as any;
        }
        this.dispatchEvent(new CustomEvent('patch', { detail: null }));
    }
}

export const serializer = new SchemaSerializer();

export function onMessage(event: MessageEvent) {
    const bytes = Array.from(new Uint8Array(event.data));
    const code = bytes[0];
    
    if (code === Protocol.JOIN_ROOM) {
        let offset = 1;

        const reconnectionToken = utf8Read(bytes, offset);
        offset += utf8Length(reconnectionToken);
        
        const serializerId = utf8Read(bytes, offset);
        offset += utf8Length(serializerId);

        console.log(reconnectionToken, serializerId, offset)

        if (bytes.length > offset) {
            serializer.handshake(bytes, { offset });
        }
    } else if (code === Protocol.ROOM_DATA_SCHEMA) {
        // don't think this matters
        // const it = { offset: 1 };

        // const context = (this.serializer.getState() as any).constructor._context;
        // const type = context.get(decode.number(bytes, it));

        // const message = new (type as any)();
        // message.decode(bytes, it);

        // this.dispatchMessage(type, message);
    } else if (code === Protocol.ROOM_STATE) {
        bytes.shift(); // drop `code` byte
        serializer.setState(bytes);
    } else if (code === Protocol.ROOM_STATE_PATCH) {
        bytes.shift(); // drop `code` byte
        serializer.patch(bytes);
    } else if (code === Protocol.ROOM_DATA) {
        const it: decode.Iterator = { offset: 1 };

        const type = (decode.stringCheck(bytes, it))
            ? decode.string(bytes, it)
            : decode.number(bytes, it);

        const message = (bytes.length > it.offset)
            ? msgpack.decode(event.data, it.offset)
            : undefined;

        return { type, message }
    } else if (code === Protocol.ROOM_DATA_BYTES) {
        const it: decode.Iterator = { offset: 1 };

        const type = (decode.stringCheck(bytes, it))
            ? decode.string(bytes, it)
            : decode.number(bytes, it);

        return { type, message: new Uint8Array(bytes.slice(it.offset)) }
    }

    return null;
}