import {  writable } from 'svelte/store';
import { getUnsafeWindow } from './utils';
import socketManager from './network/socketManager';
import { IColyseusMessage } from './types';

export const showHud = writable(true);
export const storesLoaded = writable(false);

getUnsafeWindow().storesLoaded = storesLoaded;

export const playerId = writable<null | string>(null);

socketManager.addEventListener('colyseusMessage', ((event: CustomEvent<IColyseusMessage>) => {
    if(event.detail.type !== 'AUTH_ID') return;
        
    playerId.set(event.detail.message);
    console.log("[GC] Got player id: " + event.detail.message)
}) as any);

export const devicesLoaded = writable(false);

socketManager.addEventListener('colyseusMessage', (e: any) => {
    if(e.detail.type === 'DEVICES_STATES_CHANGES') {
        // it takes a sec for the devices to get applied, for some reason?
        let checkInterval = setInterval(() => {
            let devices = getUnsafeWindow()?.stores?.phaser?.scene?.worldManager?.devices?.allDevices;
            if(!devices) return;
            if(devices.length >= e.detail.message.changes.length) {
                clearInterval(checkInterval);
                devicesLoaded.set(true);
            }
        }, 100)
    }
})