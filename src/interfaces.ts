interface KeybindHaver {
	keybind?: boolean;
	keybindId?: string; // required for keybind to save
	defaultKeybind?: Set<string>;
	title?: string;
}

export interface GCSocket extends WebSocket {
	_send: (data: any) => void;
}

export interface TextOptions {
	text: string;
}

export interface GroupOpenerOptions {
	text: string;
	openGroup: string;
	direction?: string;
}

export interface ColorPickerOptions {
	text: string;
	color?: string;
	bindVar?: string;
}

export interface ButtonOptions extends KeybindHaver {
	text: string;
	runFunction?: string;
}

export interface TextInputOptions {
	text: string;
	placeholder?: string;
}

export interface ToggleOptions extends KeybindHaver {
	textEnabled: string;
	textDisabled: string;
	runFunction?: string;
	default?: boolean;
}

export interface DropdownOptions {
	text: string;
	options: string[];
	default?: string;
	runFunction?: string;
}

export interface SliderOptions {
	text: string;
	min: number;
	max: number;
	default?: number;
	runFunction?: string;
}

export interface Keybind {
	keys: Set<string>;
	exclusive: boolean;
	callback?: () => void;
}

export interface KeybindEditorOptions {
	title: string;
	keys?: Set<string>;
	exclusive?: boolean;
	id?: string;
	callback?: () => void;
}

export interface TextElementObject {
	type: "text";
	options: TextOptions;
}

export interface GroupOpenerElementObject {
	type: "groupopener";
	options: GroupOpenerOptions;
}

export interface ColorPickerElementObject {
	type: "colorpicker";
	options: ColorPickerOptions;
}

export interface ButtonElementObject {
	type: "button";
	options: ButtonOptions;
}

export interface TextInputElementObject {
	type: "textInput";
	options: TextInputOptions;
}

export interface ToggleElementObject {
	type: "toggle";
	options: ToggleOptions;
}

export interface DropdownElementObject {
	type: "dropdown";
	options: DropdownOptions;
}

export interface SliderElementObject {
	type: "slider";
	options: SliderOptions;
}

// this is why I shouldn't be allowed to use typescript
type HudElementObject = TextElementObject | GroupOpenerElementObject | ColorPickerElementObject | ButtonElementObject | TextInputElementObject | ToggleElementObject | DropdownElementObject | SliderElementObject;

export interface GroupObject {
	name: string;
	order?: "groupsFirst" | "elementsFirst";
	elements?: HudElementObject[];
	groups?: GroupObject[];
}

export interface MenuObject {
	name: string;
	order?: "groupsFirst" | "elementsFirst";
	elements?: HudElementObject[];
	groups?: GroupObject[];
}

export interface HudObject {
	menus: MenuObject[];
}

export interface MenuTransform {
	top: number;
	left: number;
	width: number;
	height: number;
	minimized: boolean;
}

export interface Script {
	name: string;
	funcs?: Map<string, Function>;
	hudAddition?: HudObject;
	init?: (cheat: any) => void;
}

export interface ChangePacket {
	changes: any[];
	values: String[];
}

export interface BotInfo {
	id: string;
	type: string;
}

export interface Purchase {
	displayName: string;
	id: string;
	reusable: boolean
}