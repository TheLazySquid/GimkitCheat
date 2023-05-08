import { ChangePacket } from "./interfaces";

export function HexAlphaToRGBA(hex: string, alpha: number): string {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function RGBAtoHexAlpha(rgba: string): [string, number] {
    let [r, g, b, a] = rgba.slice(5, -1).split(",").map(x => parseFloat(x.trim()));

    let hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

    return [hex, a];
}

export function parseChangePacket(packet: ChangePacket) {
    let returnVar = []

    for(let change of packet.changes) {
        let data: { [index: string]: any } = {}

        let keys = change[1].map((index: number) => packet.values[index])
        for(let i = 0; i < keys.length; i++) {
            data[keys[i]] = change[2][i]
        }

        returnVar.push({
            id: change[0],
            data
        })
    }

    return returnVar;
}