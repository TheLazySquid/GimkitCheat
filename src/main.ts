import { version } from '../package.json';
import cheat from './cheat';

cheat.log("Loaded Gimkit Cheat version: " + version)
cheat.antifreeze();

// make sure the cheat is running
if(Object.isFrozen(WebSocket)) {
	alert("WebSocket object is still frozen. Please try refreshing the page. If this persists, open an issue on GitHub.")
}