// @ts-ignore
import css from "./hud.css";
import Menu from "./menu"
import { DefaultCss, HudCustomizerMenu, DefaultKeybinds, DefaultMenuTransforms } from "./defaults";
import { HudObject, Keybind, MenuTransform } from "../interfaces";
import OverlayCanvas from "./overlayCanvas";

export default class Hud {
    element: HTMLElement | null = null;
    cheat: any;
    menus: Menu[] = [];
    cssVarsSheet: CSSStyleSheet | null = null;
    
    syncedVars: Map<string, Map<string, any>>;

    constructor(cheat: any) {
        // so we can access this globally while it's being constructed
        (window as any).cheat.hud = this;
        this.syncedVars = new Map();

        this.cheat = cheat;
        this.cheat.funcs.set("resetSettings", this.resetSettings.bind(this));

        this.loadSyncedVar("cssVars", DefaultCss);
        this.loadSyncedVar("menuTransforms", DefaultMenuTransforms);
        this.loadSyncedVar("keybinds", DefaultKeybinds);
        this.updateCssVars();

        this.init()

        // load the customizer menu by default
        this.loadFromObject(HudCustomizerMenu);

        this.addToggle();
    }

    resetSettings() {
        if(!confirm("Setting updates will only take place after you reload the page, are you sure you want to reset settings?")) return

        GM_deleteValue("cssVars");
        GM_deleteValue("menuTransforms");
        GM_deleteValue("keybinds");
    }

    addToggle() {
        this.cheat.keybindManager.registerBind({
            keys: new Set(["\\"]),
            exclusive: false,
            callback: () => {
                if(this.element) {
                    this.element.style.display = this.element.style.display == "none" ? "" : "none";
                }
            }
        })
    }

    createMenu(name: string): Menu {
        let existingMenu = this.menu(name);
        if(existingMenu) return existingMenu;

        let menuTransform = this.syncedVars.get("menuTransforms")?.get(name)

        let menu = new Menu(this, name, menuTransform);
        this.menus.push(menu);
        return menu;
    }

    menu(name: string): Menu | null {
        for (let i = 0; i < this.menus.length; i++) {
            if (this.menus[i].name == name) {
                return this.menus[i];
            }
        }
        return null;
    }

    loadSyncedVar(name: string, defaultValue: any) {
        let loadedValue = GM_getValue(name, "{}");
        let storedValue = JSON.parse(loadedValue) as { [index: string]: any }

        for(let [key, value] of defaultValue) {
            if(!storedValue[key]) storedValue[key] = value;
        }

        this.syncedVars.set(name, new Map(Object.entries(storedValue)));
    }

    updateCssVar(key: string, value: string) {
        this.syncedVars.get("cssVars")?.set(key, value);
        this.updateCssVars();

        // save the css vars
        let cssVars = JSON.stringify(Object.fromEntries(this.syncedVars.get("cssVars") ?? []));
        GM_setValue("cssVars", cssVars);
    }

    updateMenuTransform(name: string, transform: MenuTransform) {
        this.syncedVars.get("menuTransforms")?.set(name, transform);

        // save the menu transforms
        let menuTransforms = JSON.stringify(Object.fromEntries(this.syncedVars.get("menuTransforms") ?? []));
        GM_setValue("menuTransforms", menuTransforms);
    }

    updateKeybind(id: string, value: Keybind) {
        console.log(id, value)
        this.syncedVars.get("keybinds")?.set(id, value);

        // save the keybinds
        let keybinds = JSON.stringify(Object.fromEntries(this.syncedVars.get("keybinds") ?? []));
        GM_setValue("keybinds", keybinds);
    }

    updateCssVars() {
        if(!this.cssVarsSheet) {
            this.cssVarsSheet = new CSSStyleSheet();
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.cssVarsSheet];
        }

        let cssVars = ":root {\n";
        for (let [key, value] of this.syncedVars.get("cssVars") ?? []) {
            cssVars += `\t--${key}: ${value};\n`;
        }
        cssVars += "}";

        this.cssVarsSheet.replaceSync(cssVars);
    }

    init() {
        let style = new CSSStyleSheet();
        style.replaceSync(css);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, style];

        let hud = document.createElement("div");
        hud.id = "gc_hud";

        this.element = hud;

        // the body is not loaded yet, so we have to wait
        document.addEventListener("DOMContentLoaded", () => {
            document.body.appendChild(hud);
        })

        this.updateCssVars();
    }

    loadFromObject(obj: HudObject) {
        for(let menu of obj.menus) {
            let newMenu = this.createMenu(menu.name);
            newMenu.loadFromObject(menu);
        }
    }

    createOverlayCanvas() {
        let canvas = new OverlayCanvas();
        document.body?.appendChild(canvas.canvas);

        return canvas;
    }
}