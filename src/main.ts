import createHud from "./hud/core";
import socketManager from './network/socketManager'
import modifyScripts from './modifyScripts'

// confirm that no amplitude.com script exists
let gameLoaded = document.querySelector('script[src*="amplitude.com"]') !== null;

if(gameLoaded) {
    alert("This script can only be run before you join the game. Please reload the page and try again.")
} else {
    modifyScripts();
    socketManager.setup();
    createHud();
}