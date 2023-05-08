import { HudObject, Keybind, MenuTransform } from "../interfaces"

export const DefaultCss: Map<string, string> = new Map([
	["menu-bg-color", "rgba(0, 0, 0, 0.5)"],
	["menu-border-color", "rgba(0, 0, 0, 0)"],
	["text-color", "rgba(255, 255, 255, 1)"],
	["button-bg-color", "rgba(0, 0, 0, 0.5)"],
	["button-border-color", "rgba(255, 255, 255, 1)"],
	["menu-controls-bg-color", "rgba(0, 0, 255, 0.5)"],
	["menu-controls-text-color", "rgba(255, 255, 255, 1)"],
	["textinput-border-color", "rgba(255, 255, 255, 1)"],
	["textinput-bg-color", "rgba(0, 0, 0, 0.5)"],
	["toggle-bg-color", "rgba(0, 0, 0, 0.5)"],
	["toggle-border-color", "rgba(255, 255, 255, 1)"],
	["dropdown-bg-color", "rgba(0, 0, 0, 0.5)"],
	["dropdown-border-color", "rgba(255, 255, 255, 1)"],
	["keybind-editor-bg-color", "rgba(0, 0, 0, 0.75)"],
	["keybind-editor-border-color", "rgba(255, 255, 255, 1)"]
])

export const DefaultMenuTransforms: Map<string, MenuTransform> = new Map([
	["HUD Customization", {
		top: 10,
		left: 10,
		width: Math.min(window.innerWidth / 4, 350),
		height: window.innerHeight / 2,
		minimized: false
	}],
	["Devtools", {
		top: window.innerHeight / 2 + 10,
		left: 10,
		width: Math.min(window.innerWidth / 4, 350),
		height: window.innerHeight / 2,
		minimized: true
	}],
	["General Cheats", {
		top: 10,
		left: window.innerWidth / 3 + 20,
		width: Math.min(window.innerWidth / 4, 350),
		height: window.innerHeight / 2,
		minimized: false
	}],
	["Cheats for gamemodes", {
		top: 10,
		left: window.innerWidth / 3 * 2 + 30,
		width: Math.min(window.innerWidth / 4, 350),
		height: window.innerHeight / 2,
		minimized: false
	}]
])

export const DefaultKeybinds: Map<string, Keybind> = new Map([])

export const  HudCustomizerMenu: HudObject = {
	menus: [
		{
			name: "HUD Customization",
			groups: [
				{
					name: "General",
					order: "elementsFirst",
					elements: [
						{
							type: "colorpicker",
							options: {
								text: "Text Color",
								bindVar: "text-color"
							}
						}
					],
					groups: [
						{
							name: "Menu Appearance",
							elements: [
								{
									type: "colorpicker",
									options: {
										text: "Menu Background Color",
										bindVar: "menu-bg-color"
									}
								},
								{
									type: "colorpicker",
									options: {
										text: "Menu Border Color",
										bindVar: "menu-border-color"
									}
								}
							]
						},
						{
							name: "Menu Controls Appearance",
							elements: [
								{
									type: "colorpicker",
									options: {
										text: "Menu Controls Background Color",
										bindVar: "menu-controls-bg-color"
									}
								},
								{
									type: "colorpicker",
									options: {
										text: "Menu Controls Text Color",
										bindVar: "menu-controls-text-color"
									}
								}
							]
						},
						{
							name: "Keybind Editor Appearance",
							elements: [
								{
									type: "colorpicker",
									options: {
										text: "Keybind Editor Background Color",
										bindVar: "keybind-editor-bg-color"
									}
								},
								{
									type: "colorpicker",
									options: {
										text: "Keybind Editor Border Color",
										bindVar: "keybind-editor-border-color"
									}
								}
							]
						}
					]
				},
				{
					name: "Elements",
					groups: [
						{
							name: "Buttons",
							elements: [
								{
									type: "colorpicker",
									options: {
										text: "Button Background Color",
										bindVar: "button-bg-color"
									}
								},
								{
									type: "colorpicker",
									options: {
										text: "Button Border Color",
										bindVar: "button-border-color"
									}
								}
							]
						},
						{
							name: "Text Inputs",
							elements: [
								{
									type: "colorpicker",
									options: {
										text: "Text Input Background Color",
										bindVar: "textinput-bg-color"
									}
								},
								{
									type: "colorpicker",
									options: {
										text: "Text Input Border Color",
										bindVar: "textinput-border-color"
									}
								}
							]
						},
						{
							name: "Toggles",
							elements: [
								{
									type: "colorpicker",
									options: {
										text: "Toggle Background Color",
										bindVar: "toggle-bg-color"
									}
								},
								{
									type: "colorpicker",
									options: {
										text: "Toggle Border Color",
										bindVar: "toggle-border-color"
									}
								}
							]
						},
						{
							name: "Dropdowns",
							elements: [
								{
									type: "colorpicker",
									options: {
										text: "Dropdown Background Color",
										bindVar: "dropdown-bg-color"
									}
								},
								{
									type: "colorpicker",
									options: {
										text: "Dropdown Border Color",
										bindVar: "dropdown-border-color"
									}
								}
							]
						}
					]
				}
			],
			elements: [
				{
					type: "button",
					options: {
						text: "Reset settings",
						runFunction: "resetSettings"
					}
				}
			]
		}
	]
}