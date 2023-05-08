export default class OverlayCanvas {
	canvas: HTMLCanvasElement

	constructor() {
		this.canvas = document.createElement("canvas");
		this.canvas.classList.add("gc_overlay_canvas");

		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;

		// keep the canvas scaled to the window size
		window.addEventListener("resize", () => {
			this.canvas.width = window.innerWidth;
			this.canvas.height = window.innerHeight;
		})
	}

	get context() {
		return this.canvas.getContext("2d")!;
	}
}