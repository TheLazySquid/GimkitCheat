import Hud from './Hud.svelte';
import { addVars } from './hudVarsManager';

export default async function createHud() {
    if(!document.body) {
        await new Promise(res => window.addEventListener('DOMContentLoaded', res))
    }
    
    new Hud({
        target: document.body
    });

    addVars();
}