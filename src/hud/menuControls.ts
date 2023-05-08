export default class MenuControls {
    menu: any = null;
    element: HTMLElement | null = null;

    constructor(menu: any) {
        this.menu = menu;
        this.init();
    }

    init() {
        let element = document.createElement("div");
        element.classList.add("menu_controls");
        element.innerHTML = this.menu.name;

        // create the minimizer
        let minimizer = document.createElement("div");
        minimizer.classList.add("menu_minimizer");
        
        this.element = element;
        this.element.appendChild(minimizer);
        
        this.menu?.element?.appendChild(element);
        
        this.updateMinimizer();

        minimizer.addEventListener("click", () => {
            this.menu?.minimize();
            this.updateMinimizer()
        });
    }

    updateMinimizer() {
        if(!this.element) return;

        let minimizer = this.element.querySelector(".menu_minimizer");
        if(!minimizer) return;

        minimizer.innerHTML = this.menu?.minimized ? "+" : "-";
    }
}