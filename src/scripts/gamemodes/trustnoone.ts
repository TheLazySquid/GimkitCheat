export class TrustNoOneClass {
    name: string = "Trust No One Script";
    cheat: any;
	people = [];

    init(cheat: any) {
		this.cheat = cheat;

		// add the imposter display
		let group = cheat.hud.createMenu("Cheats for gamemodes").createGroup("Trust No One")
		let text = group.addElement("text", {
			text: "Imposters: Waiting... (only works if you don't join mid-game)"
		})


		cheat.socketHandler.addEventListener("recieveMessage", (e: any) => {
			if(this.cheat.socketHandler.transportType != "blueboat") return;

			if(e.detail.key == "IMPOSTER_MODE_PEOPLE") {
				this.people = e.detail.data;
				let imposters = this.people.filter((person: any) => person.role == "imposter");
				text.text = `Imposter(s): ${imposters.map((person: any) => person.name).join(", ")}`
			}
		});
    }
}

export function TrustNoOne() {
    return new TrustNoOneClass();
}