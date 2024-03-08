import { getValue, setValue } from '../persist';
import type { IMenuTransform } from '../types';
import { defaultCss, defaultMenuTransforms } from './defaultVars';

let cssVarsString = getValue('cssVars')
let cssVars: Record<string, string> = {};
if(cssVarsString) cssVars = JSON.parse(cssVarsString);

// merge default css vars with saved vars
cssVars = Object.assign({}, defaultCss, cssVars);

export async function addVars() {
    if(!document.documentElement) {
        await new Promise(res => window.addEventListener('DOMContentLoaded', res))
    }
    for(let [key, value] of Object.entries(cssVars)) {
        document.documentElement.style.setProperty(`--${key}`, value);
    }
}

export function getCssVar(key: string) {
    return cssVars[key];
}

export function setCssVar(key: string, value: string) {
    cssVars[key] = value;
    setValue('cssVars', JSON.stringify(cssVars));
}

export function setCssVars(vars: Record<string, string>) {
    cssVars = Object.assign({}, cssVars, vars);
    setValue('cssVars', JSON.stringify(cssVars));
}

let menuTransformsString = getValue('menuTransforms');
let menuTransforms: Record<string, IMenuTransform> = {};
if(menuTransformsString) menuTransforms = JSON.parse(menuTransformsString);

// merge default menu transforms with saved transforms
menuTransforms = Object.assign({}, defaultMenuTransforms, menuTransforms);

export function getMenuTransform(menuName: string) {
    return menuTransforms[menuName];
}

export function setMenuTransform(menuName: string, transform: IMenuTransform) {
    menuTransforms[menuName] = transform;
    setValue('menuTransforms', JSON.stringify(menuTransforms));
}

let hotkeysString = getValue('hotkeys');
let hotkeys: Record<string, string[]> = {};
if(hotkeysString) hotkeys = JSON.parse(hotkeysString);

export function getHotkey(menuName: string) {
    return hotkeys[menuName];
}

export function setHotkey(menuName: string, keys: string[]) {
    hotkeys[menuName] = keys;
    setValue('hotkeys', JSON.stringify(hotkeys));
}