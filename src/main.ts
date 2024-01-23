import { version } from '../package.json';
import cheat from './cheat';
import setupMutation from "./interceptors/mutationObserver";
import setupBeforeScriptExecute from "./interceptors/beforeScriptExecute";


if(navigator.userAgent.includes("Firefox")) {
	setupBeforeScriptExecute();
} else {
	setupMutation();
}

if(document.querySelector('script[src*="index.8f9b20a8.js"')) {
	alert("Something went wrong when intercepting a script. GimkitCheat is currently experiencing issues, so it may not work. Try refreshing the page, but this may persist.")
}

cheat.log("Loaded Gimkit Cheat version: " + version)
cheat.antifreeze();

// make sure the cheat is running
if(Object.isFrozen(WebSocket)) {
	alert("WebSocket object is still frozen. Please try refreshing the page. If this persists, open an issue on GitHub.")
}