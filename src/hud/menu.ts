import Group from "./group";
import MenuControls from "./menuControls";
import { MenuObject, MenuTransform } from "../interfaces";

export default class Menu {
    hud: any = null;
    element: HTMLElement | null = null;
    rootGroup: Group | null = null;
    name: string = "";
    groups: Group[] = [];
    minimized: boolean = false;
    transform: MenuTransform = {
        top: 0,
        left: 0,
        width: 300,
        height: 200,
        minimized: false
    }

    // any is used to avoid circular dependencies
    constructor(hud: any, name: string, transform?: MenuTransform) {
        this.hud = hud;  
        this.name = name;
        if(transform) this.transform = transform;

        this.init()
    }

    applyTransform(transform: MenuTransform) {
        if(!this.element) return;

        if(transform.height < 50) transform.height = 50;
        if(transform.width < 50) transform.width = 50;

        this.element.style.top = `${transform.top}px`;
        this.element.style.left = `${transform.left}px`;
        this.element.style.width = `${transform.width}px`;
        this.element.style.height = `${transform.height}px`;
        this.minimize(transform.minimized ?? false);
    }

    init() {
        let element = document.createElement("div");
        element.classList.add("menu");

        this.element = element;
        this.hud?.element.appendChild(element);

        this.applyTransform(this.transform);

        // create the menu controls
        let menuControls = new MenuControls(this);

        // create the root group
        let rootGroup = new Group(this, null, "root", true);
        this.rootGroup = rootGroup;
        this.groups.push(rootGroup);

        // add the root group to the menu
        if(rootGroup.element) {
            this.element.appendChild(rootGroup.element);
        }

        this.addListeners();
    }

    addListeners() {
        if(!this.element) return;

        let dragging = false;
        let dragStart = {x: 0, y: 0};
        let dragDistance = 0;

        this.element.addEventListener("mousedown", (e) => {
            dragging = true;
            dragStart.x = e.clientX;
            dragStart.y = e.clientY;
            dragDistance = 0;
        });

        // cancel dragging if it's being resized
        window.addEventListener("mouseup", () => {dragging = false});

        let observer = new ResizeObserver((e) => {
            // if the element is invisible ignore it
            if(e[0].contentRect.width == 0 || e[0].contentRect.height == 0) return;

            dragging = false
            this.transform.width = e[0].contentRect.width;
            if(!this.minimized) this.transform.height = e[0].contentRect.height;

            this.syncTransform();
        });
        observer.observe(this.element);

        window.addEventListener("mousemove", (e) => {
            if(!dragging) return;
            dragDistance += Math.abs(e.clientX - dragStart.x) + Math.abs(e.clientY - dragStart.y);

            if(dragDistance < 10) return;

            let x = e.clientX - dragStart.x;
            let y = e.clientY - dragStart.y;

            this.element!.style.left = `${this.element!.offsetLeft + x}px`;
            this.element!.style.top = `${this.element!.offsetTop + y}px`;

            // sync the transform
            this.transform.top = this.element!.offsetTop;
            this.transform.left = this.element!.offsetLeft;

            this.syncTransform();

            // prevent the menu from going off screen
            if(this.element!.offsetLeft < 0) this.element!.style.left = "0px";
            if(this.element!.offsetTop < 0) this.element!.style.top = "0px";
            if(this.element!.offsetLeft + this.element!.offsetWidth > window.innerWidth) this.element!.style.left = `${window.innerWidth - this.element!.offsetWidth}px`;
            if(this.element!.offsetTop + this.element!.offsetHeight > window.innerHeight) this.element!.style.top = `${window.innerHeight - this.element!.offsetHeight}px`;

            dragStart.x = e.clientX;
            dragStart.y = e.clientY;
        });
    }

    syncTransform() {
        this.hud.updateMenuTransform(this.name, this.transform);
    }

    // adding a group to the menu instead places it in the root group
    createGroup(name: string): Group {
        return this.rootGroup!.createGroup(name);
    }

    group(name: string): Group | null {
        return this.rootGroup!.group(name);
    }

    addElement(type: string, options: any) {
        return this.rootGroup!.addElement(type, options);   
    }

    getAnyGroup(name: string): Group | null {
        for(let group of this.groups) {
            if(group.name == name) return group;
        }
        return null;
    }

    remove() {
        this.element?.remove();
        this.hud.menus.splice(this.hud.menus.indexOf(this), 1);
    }

    minimize(force: boolean | null = null) {
        if(force == null) this.minimized = !this.minimized;
        else this.minimized = force;

        this.element!.classList.toggle("minimized", this.minimized);

        this.transform.minimized = this.minimized;
        this.syncTransform();
    }

    loadFromObject(object: MenuObject) {
        this.rootGroup!.loadFromObject(object);
    }
}