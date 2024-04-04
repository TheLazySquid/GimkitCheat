import createHud from "./hud/core";
import socketManager from './network/socketManager'
import modifyScripts from './modifyScripts'
import Parcel from "./parcelIntercept";
import { exposeValues } from "./exposeValues";

// confirm that no amplitude.com script exists
let gameLoaded = document.querySelector('script[src*="amplitude.com"]') !== null;

if(gameLoaded) {
    alert("This script can only be run before you join the game. Please reload the page and try again.")
} else {
    if(!window["parcelRequire388b"]) {
        // add in the parcel intercept as a backup
        let parcel = new Parcel();
        exposeValues(parcel);
    } else {
        modifyScripts();
    }

    socketManager.setup();
    createHud();
}