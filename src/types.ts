import { Writable } from 'svelte/store';

export interface IMenuTransform {
    minimized: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface IColyseusMessage {
    type: string;
    message: any;
}

// should probably extend this to use globalThis somehow
export interface IGimkitWindow extends Window {
    stores: any;
    storesLoaded: Writable<boolean>;
    WebSocket: typeof WebSocket;
    Phaser: any;
}

export interface IColors {
    background: string;
    text: string;
}

export interface ITheme {
    question: IColors;
    palette: IColors[];
    custom: boolean;
}

export interface ChangePacket {
	changes: any[];
	values: string[];
}

export interface IDeviceChange {
    id: string;
    data: Record<string, string>;
}