import Parcel from "./parcelIntercept";
import { getUnsafeWindow } from "./utils";
import { storesLoaded } from "./stores";
import { writable } from "svelte/store";

export let physicsConsts = writable<any | null>(null);

export function exposeValues(parcel: Parcel) {
    // get the stores object
    parcel.interceptRequire(exports => exports?.default?.characters, exports => {
        getUnsafeWindow().stores = exports.default;
        storesLoaded.set(true);
        console.log("GC: Stores loaded via parcel")
    })

    // get the physics constants
    parcel.interceptRequire(exports => exports?.CharacterPhysicsConsts, exports => {
        physicsConsts.set(exports.CharacterPhysicsConsts);
        console.log("GC: Physics constants loaded")
    })
}