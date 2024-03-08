import type { IMenuTransform } from "../types"

export const defaultCss = {
    textColor: "rgba(255, 255, 255, 1)",
    menuBackgroundColor: "rgba(0, 0, 0, 0.5)",
    menuOutlineColor: "rgba(255, 255, 255, 0)",
    menuHeaderBackgroundColor: "rgba(0, 0, 255, 0.5)",
    menuHeaderTextColor: "rgba(255, 255, 255, 1)",
    buttonBackgroundColor: "rgba(0, 0, 0, 0.5)",
    buttonBorderColor: "rgba(255, 255, 255, 1)"
}

export const defaultMenuTransforms: Record<string, IMenuTransform> = {
    "General Cheats": {
        x: 0,
        y: 0,
        width: window.innerWidth / 4,
        height: window.innerHeight / 3 * 2,
        minimized: false
    },
    "Gamemode Specific Cheats": {
        x: window.innerWidth / 8 * 3,
        y: 0,
        width: window.innerWidth / 4,
        height: window.innerHeight / 3 * 2,
        minimized: false
    },
    "Customization": {
        x: window.innerWidth / 4 * 3,
        y: 0,
        width: window.innerWidth / 4,
        height: window.innerHeight / 3 * 2,
        minimized: false
    }
}