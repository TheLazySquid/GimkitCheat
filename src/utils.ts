import { ChangePacket, IDeviceChange, IGimkitWindow } from "./types"

export function findMatchingParent(node: Element, selector: string) {
    if (node.matches(selector)) {
        return node
    }
    if (node.parentElement) {
        return findMatchingParent(node.parentElement, selector)
    }
    return null
}

export function parseRGBA(string: string) {
    let [r, g, b, a] = string
        .replace('rgba(', '')
        .replace(')', '')
        .split(',')
        .map(value => parseFloat(value.trim()))
    return { r, g, b, a }
}

export function parseHex(string: string) {
    let [r, g, b] = string
        .replace('#', '')
        .match(/.{1,2}/g)!
        .map(value => parseInt(value, 16))
    return { r, g, b }
}

export function rgbToHex(r: number, g: number, b: number) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b)
}

function componentToHex(c: number) {
    var hex = Math.round(c).toString(16)
    return hex.length == 1 ? "0" + hex : hex
}

export function getUnsafeWindow(): IGimkitWindow {
    if (typeof unsafeWindow === 'undefined') {
        return window as unknown as IGimkitWindow
    }
    return unsafeWindow as unknown as IGimkitWindow
}

export function parseChangePacket(packet: ChangePacket) {
    let returnVar: IDeviceChange[] = []

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