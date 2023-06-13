export default class HudElement extends EventTarget {
	group: any = null;
	options: any = null;
	element: HTMLElement | null = null;
	type: string = 'element';

	// any is used to avoid circular dependencies
	constructor(group: any, options: any) {
		super();

		this.group = group;
		this.options = options;
	}

	remove() {
		this.element?.remove();
		this.group.elements.splice(this.group.elements.indexOf(this), 1);
	}
}