import { getUnsafeWindow } from "./utils";
import { storesLoaded } from "./stores";

function isStores(value: any) {
    return value && typeof value === "object" && "assignment" in value && "phaser" in value;
}

async function tryModule(url: string) {
    try {
        const mod = await import(/* @vite-ignore */ url);
        return Object.values<any>(mod).find(isStores) ?? null;
    } catch {
        return null;
    }
}

export async function exposeValues() {
    if(!document.body) {
        await new Promise((res) => document.addEventListener('DOMContentLoaded', res));
    }

    const script = document.querySelector<HTMLScriptElement>("script[src][type='module']");
    if(!script) throw new Error("Failed to find script");

    const res = await fetch(script.src);
    const text = await res.text();

    // Chunk names are hashed and change between Gimkit builds, so look for the
    // chunk(s) named "stores-*" first, falling back to the old chunk name.
    const chunks = [...new Set(text.match(/(?:stores|FixSpinePlugin)-[\w-]+\.js/g) ?? [])];
    if(chunks.length === 0) throw new Error("Failed to find stores chunk");

    for(const chunk of chunks) {
        const stores = await tryModule(new URL(chunk, script.src).href);
        if(!stores) continue;

        getUnsafeWindow().stores = stores;
        storesLoaded.set(true);
        console.log("GC: Stores loaded");
        return;
    }

    throw new Error("Failed to find stores object");
}
