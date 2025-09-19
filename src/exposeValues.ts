import { getUnsafeWindow } from "./utils";
import { storesLoaded } from "./stores";

export async function exposeValues() {
    if(!document.body) {
        await new Promise((res) => document.addEventListener('DOMContentLoaded', res));
    }

    const script = document.querySelector<HTMLScriptElement>("script[src][type='module']");
    if(!script) throw new Error("Failed to find script");

    const res = await fetch(script.src);
    const text = await res.text();
    const gameScriptUrl = text.match(/FixSpinePlugin-[^.]+\.js/)?.[0];
    if(!gameScriptUrl) throw new Error("Failed to find game script URL");

    const gameScript = await import(`/assets/${gameScriptUrl}`);
    const stores = Object.values<any>(gameScript).find(v => v.assignment);

    getUnsafeWindow().stores = stores;
    storesLoaded.set(true);
    console.log("GC: Stores loaded");
}