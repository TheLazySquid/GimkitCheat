import OverlayCanvas from "../../hud/overlayCanvas";
import { HudObject } from "../../interfaces";

const hudAddition: HudObject = {
    menus: [
        {
            name: "General Cheats",
            groups: [
                {
                    name: "Player Highlighter",
                    elements: [
                        {
							type: "toggle",
							options: {
								textEnabled: "Stop Highlighting Teammates",
								textDisabled: "Highlight Teammates",
								runFunction: "highlightTeammates",
								keybind: true,
								keybindId: "highlightTeammates"
							}
						},
                        {
							type: "toggle",
							options: {
								textEnabled: "Stop Highlighting Enemies",
								textDisabled: "Highlight Enemies",
								runFunction: "highlightEnemies",
								keybind: true,
								keybindId: "highlightEnemies"
							}
						},
						{
							type: "slider",
							options: {
								text: "Arrow Distance",
								min: 20,
								max: 750,
								default: 200,
								runFunction: "setArrowDistance"
							}
						}
                    ]
                }
            ]
        }
    ]
}

class PlayerhighlighterClass {
    name: string = "Player Highlighter";
    hudAddition: HudObject = hudAddition;
    funcs: Map<string, (value: any) => void> = new Map([
		["highlightTeammates", (value: any) => {
			this.highlightingTeammates = value as boolean;
		}],
		["highlightEnemies", (value: any) => {
			this.highlightingEnemies = value as boolean;
		}],
		["setArrowDistance", (value: any) => {
			this.arrowDistance = value as number;
		}]
	]);
	highlightingTeammates: boolean = false;
	highlightingEnemies: boolean = false;
	ctx: CanvasRenderingContext2D | null = null;
	canvas: OverlayCanvas | null = null;
	arrowDistance: number = 200;

	init(cheat: any) {
		setInterval(() => {
			if(!(unsafeWindow as any)?.stores?.phaser?.scene) return;

			if(this.canvas == null) {
				this.canvas = cheat.hud.createOverlayCanvas() as OverlayCanvas;
				this.ctx = this.canvas.context;
			}

			this.render();
		}, 100)
	}

	render() {
		this.ctx?.clearRect(0, 0, this.canvas?.canvas.width ?? 1920, this.canvas?.canvas.height ?? 1080);

		let phaser = (unsafeWindow as any).stores.phaser;

		let characters = phaser.scene.characterManager.characters;
		let user = phaser.mainCharacter;

		for(let [id, data] of characters) {
			if(id == user.id) continue;

			let isEnemy = data.teamId != user.teamId;
			if(isEnemy && !this.highlightingEnemies) continue;
			if(!isEnemy && !this.highlightingTeammates) continue;

			this.ctx!.strokeStyle = isEnemy ? "red" : "green";
			this.ctx!.lineWidth = 5;
			
			// render an arrow pointing to the player
			let angle = Math.atan2(data.body.y - user.body.y, data.body.x - user.body.x);
			let distance = Math.sqrt(Math.pow(data.body.x - user.body.x, 2) + Math.pow(data.body.y - user.body.y, 2));

			let arrowDistance = Math.min(distance, this.arrowDistance);

			let arrowTip = {
				x: Math.cos(angle) * arrowDistance + this.canvas!.canvas.width / 2,
				y: Math.sin(angle) * arrowDistance + this.canvas!.canvas.height / 2
			}

			let leftTipAngle = angle - Math.PI / 4 * 3;
			let rightTipAngle = angle + Math.PI / 4 * 3;

			// draw a line from the center to both tips
			this.ctx?.beginPath();
			this.ctx?.moveTo(arrowTip.x, arrowTip.y);
			
			this.ctx?.lineTo(
				Math.cos(leftTipAngle) * 50 + arrowTip.x,
				Math.sin(leftTipAngle) * 50 + arrowTip.y
			);
				
			this.ctx?.moveTo(arrowTip.x, arrowTip.y);

			this.ctx?.lineTo(
				Math.cos(rightTipAngle) * 50 + arrowTip.x,
				Math.sin(rightTipAngle) * 50 + arrowTip.y
			);

			this.ctx?.stroke();
			// write the user's name and distance
			this.ctx!.fillStyle = "black";
			this.ctx!.font = "20px Verdana";
			this.ctx!.textAlign = "center";
			this.ctx!.textBaseline = "middle";

			this.ctx!.fillText(`${data.nametag.name} (${Math.round(distance)})`, arrowTip.x, arrowTip.y);
		}
	}
}

export function Playerhighlighter() {
    return new PlayerhighlighterClass();
}