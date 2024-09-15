// ==UserScript==
// @name        Gimkit Cheat
// @description A userscript that allows you to cheat across various gimkit games
// @namespace   https://www.github.com/TheLazySquid/GimkitCheat/
// @match       https://www.gimkit.com/join*
// @run-at      document-start
// @iconURL     https://www.gimkit.com/favicon.png
// @author      TheLazySquid
// @updateURL   https://raw.githubusercontent.com/TheLazySquid/GimkitCheat/main/build/bundle.user.js
// @downloadURL https://raw.githubusercontent.com/TheLazySquid/GimkitCheat/main/build/bundle.user.js
// @version     1.2.1
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// ==/UserScript==
(function () {
	'use strict';

	/** @returns {void} */
	function noop() {}

	/**
	 * @template T
	 * @template S
	 * @param {T} tar
	 * @param {S} src
	 * @returns {T & S}
	 */
	function assign(tar, src) {
		// @ts-ignore
		for (const k in src) tar[k] = src[k];
		return /** @type {T & S} */ (tar);
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	/**
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function run_all(fns) {
		fns.forEach(run);
	}

	/**
	 * @param {any} thing
	 * @returns {thing is Function}
	 */
	function is_function(thing) {
		return typeof thing === 'function';
	}

	/** @returns {boolean} */
	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
	}

	/** @returns {boolean} */
	function is_empty(obj) {
		return Object.keys(obj).length === 0;
	}

	function subscribe(store, ...callbacks) {
		if (store == null) {
			for (const callback of callbacks) {
				callback(undefined);
			}
			return noop;
		}
		const unsub = store.subscribe(...callbacks);
		return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
	}

	/**
	 * Get the current value from a store by subscribing and immediately unsubscribing.
	 *
	 * https://svelte.dev/docs/svelte-store#get
	 * @template T
	 * @param {import('../store/public.js').Readable<T>} store
	 * @returns {T}
	 */
	function get_store_value(store) {
		let value;
		subscribe(store, (_) => (value = _))();
		return value;
	}

	/** @returns {void} */
	function component_subscribe(component, store, callback) {
		component.$$.on_destroy.push(subscribe(store, callback));
	}

	function create_slot(definition, ctx, $$scope, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, $$scope, fn) {
		return definition[1] && fn ? assign($$scope.ctx.slice(), definition[1](fn(ctx))) : $$scope.ctx;
	}

	function get_slot_changes(definition, $$scope, dirty, fn) {
		if (definition[2] && fn) {
			const lets = definition[2](fn(dirty));
			if ($$scope.dirty === undefined) {
				return lets;
			}
			if (typeof lets === 'object') {
				const merged = [];
				const len = Math.max($$scope.dirty.length, lets.length);
				for (let i = 0; i < len; i += 1) {
					merged[i] = $$scope.dirty[i] | lets[i];
				}
				return merged;
			}
			return $$scope.dirty | lets;
		}
		return $$scope.dirty;
	}

	/** @returns {void} */
	function update_slot_base(
		slot,
		slot_definition,
		ctx,
		$$scope,
		slot_changes,
		get_slot_context_fn
	) {
		if (slot_changes) {
			const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
			slot.p(slot_context, slot_changes);
		}
	}

	/** @returns {any[] | -1} */
	function get_all_dirty_from_scope($$scope) {
		if ($$scope.ctx.length > 32) {
			const dirty = [];
			const length = $$scope.ctx.length / 32;
			for (let i = 0; i < length; i++) {
				dirty[i] = -1;
			}
			return dirty;
		}
		return -1;
	}

	function set_store_value(store, ret, value) {
		store.set(value);
		return ret;
	}

	const is_client = typeof window !== 'undefined';

	/** @type {() => number} */
	let now = is_client ? () => window.performance.now() : () => Date.now();

	let raf = is_client ? (cb) => requestAnimationFrame(cb) : noop;

	const tasks = new Set();

	/**
	 * @param {number} now
	 * @returns {void}
	 */
	function run_tasks(now) {
		tasks.forEach((task) => {
			if (!task.c(now)) {
				tasks.delete(task);
				task.f();
			}
		});
		if (tasks.size !== 0) raf(run_tasks);
	}

	/**
	 * Creates a new task that runs on each raf frame
	 * until it returns a falsy value or is aborted
	 * @param {import('./private.js').TaskCallback} callback
	 * @returns {import('./private.js').Task}
	 */
	function loop(callback) {
		/** @type {import('./private.js').TaskEntry} */
		let task;
		if (tasks.size === 0) raf(run_tasks);
		return {
			promise: new Promise((fulfill) => {
				tasks.add((task = { c: callback, f: fulfill }));
			}),
			abort() {
				tasks.delete(task);
			}
		};
	}

	/** @type {typeof globalThis} */
	const globals =
		typeof window !== 'undefined'
			? window
			: typeof globalThis !== 'undefined'
			? globalThis
			: // @ts-ignore Node typings have this
			  global;

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @returns {void}
	 */
	function append(target, node) {
		target.appendChild(node);
	}

	/**
	 * @param {Node} target
	 * @param {string} style_sheet_id
	 * @param {string} styles
	 * @returns {void}
	 */
	function append_styles(target, style_sheet_id, styles) {
		const append_styles_to = get_root_for_style(target);
		if (!append_styles_to.getElementById(style_sheet_id)) {
			const style = element('style');
			style.id = style_sheet_id;
			style.textContent = styles;
			append_stylesheet(append_styles_to, style);
		}
	}

	/**
	 * @param {Node} node
	 * @returns {ShadowRoot | Document}
	 */
	function get_root_for_style(node) {
		if (!node) return document;
		const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
		if (root && /** @type {ShadowRoot} */ (root).host) {
			return /** @type {ShadowRoot} */ (root);
		}
		return node.ownerDocument;
	}

	/**
	 * @param {ShadowRoot | Document} node
	 * @param {HTMLStyleElement} style
	 * @returns {CSSStyleSheet}
	 */
	function append_stylesheet(node, style) {
		append(/** @type {Document} */ (node).head || node, style);
		return style.sheet;
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @param {Node} [anchor]
	 * @returns {void}
	 */
	function insert(target, node, anchor) {
		target.insertBefore(node, anchor || null);
	}

	/**
	 * @param {Node} node
	 * @returns {void}
	 */
	function detach(node) {
		if (node.parentNode) {
			node.parentNode.removeChild(node);
		}
	}

	/**
	 * @returns {void} */
	function destroy_each(iterations, detaching) {
		for (let i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detaching);
		}
	}

	/**
	 * @template {keyof HTMLElementTagNameMap} K
	 * @param {K} name
	 * @returns {HTMLElementTagNameMap[K]}
	 */
	function element(name) {
		return document.createElement(name);
	}

	/**
	 * @template {keyof SVGElementTagNameMap} K
	 * @param {K} name
	 * @returns {SVGElement}
	 */
	function svg_element(name) {
		return document.createElementNS('http://www.w3.org/2000/svg', name);
	}

	/**
	 * @param {string} data
	 * @returns {Text}
	 */
	function text(data) {
		return document.createTextNode(data);
	}

	/**
	 * @returns {Text} */
	function space() {
		return text(' ');
	}

	/**
	 * @returns {Text} */
	function empty() {
		return text('');
	}

	/**
	 * @param {EventTarget} node
	 * @param {string} event
	 * @param {EventListenerOrEventListenerObject} handler
	 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
	 * @returns {() => void}
	 */
	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	/**
	 * @returns {(event: any) => any} */
	function prevent_default(fn) {
		return function (event) {
			event.preventDefault();
			// @ts-ignore
			return fn.call(this, event);
		};
	}

	/**
	 * @returns {(event: any) => any} */
	function stop_propagation(fn) {
		return function (event) {
			event.stopPropagation();
			// @ts-ignore
			return fn.call(this, event);
		};
	}

	/**
	 * @param {Element} node
	 * @param {string} attribute
	 * @param {string} [value]
	 * @returns {void}
	 */
	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
	}

	/** @returns {number} */
	function to_number(value) {
		return value === '' ? null : +value;
	}

	/**
	 * @param {Element} element
	 * @returns {ChildNode[]}
	 */
	function children(element) {
		return Array.from(element.childNodes);
	}

	/**
	 * @param {Text} text
	 * @param {unknown} data
	 * @returns {void}
	 */
	function set_data(text, data) {
		data = '' + data;
		if (text.data === data) return;
		text.data = /** @type {string} */ (data);
	}

	/**
	 * @returns {void} */
	function set_input_value(input, value) {
		input.value = value == null ? '' : value;
	}

	/**
	 * @returns {void} */
	function set_style(node, key, value, important) {
		if (value == null) {
			node.style.removeProperty(key);
		} else {
			node.style.setProperty(key, value, important ? 'important' : '');
		}
	}

	/**
	 * @returns {void} */
	function toggle_class(element, name, toggle) {
		// The `!!` is required because an `undefined` flag means flipping the current state.
		element.classList.toggle(name, !!toggle);
	}

	/**
	 * @template T
	 * @param {string} type
	 * @param {T} [detail]
	 * @param {{ bubbles?: boolean, cancelable?: boolean }} [options]
	 * @returns {CustomEvent<T>}
	 */
	function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
		return new CustomEvent(type, { detail, bubbles, cancelable });
	}

	/**
	 * @typedef {Node & {
	 * 	claim_order?: number;
	 * 	hydrate_init?: true;
	 * 	actual_end_child?: NodeEx;
	 * 	childNodes: NodeListOf<NodeEx>;
	 * }} NodeEx
	 */

	/** @typedef {ChildNode & NodeEx} ChildNodeEx */

	/** @typedef {NodeEx & { claim_order: number }} NodeEx2 */

	/**
	 * @typedef {ChildNodeEx[] & {
	 * 	claim_info?: {
	 * 		last_index: number;
	 * 		total_claimed: number;
	 * 	};
	 * }} ChildNodeArray
	 */

	let current_component;

	/** @returns {void} */
	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error('Function called outside component initialization');
		return current_component;
	}

	/**
	 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
	 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
	 * it can be called from an external module).
	 *
	 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
	 *
	 * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
	 *
	 * https://svelte.dev/docs/svelte#onmount
	 * @template T
	 * @param {() => import('./private.js').NotFunction<T> | Promise<import('./private.js').NotFunction<T>> | (() => any)} fn
	 * @returns {void}
	 */
	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	/**
	 * Schedules a callback to run immediately before the component is unmounted.
	 *
	 * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
	 * only one that runs inside a server-side component.
	 *
	 * https://svelte.dev/docs/svelte#ondestroy
	 * @param {() => any} fn
	 * @returns {void}
	 */
	function onDestroy(fn) {
		get_current_component().$$.on_destroy.push(fn);
	}

	/**
	 * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
	 * Event dispatchers are functions that can take two arguments: `name` and `detail`.
	 *
	 * Component events created with `createEventDispatcher` create a
	 * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
	 * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
	 * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
	 * property and can contain any type of data.
	 *
	 * The event dispatcher can be typed to narrow the allowed event names and the type of the `detail` argument:
	 * ```ts
	 * const dispatch = createEventDispatcher<{
	 *  loaded: never; // does not take a detail argument
	 *  change: string; // takes a detail argument of type string, which is required
	 *  optional: number | null; // takes an optional detail argument of type number
	 * }>();
	 * ```
	 *
	 * https://svelte.dev/docs/svelte#createeventdispatcher
	 * @template {Record<string, any>} [EventMap=any]
	 * @returns {import('./public.js').EventDispatcher<EventMap>}
	 */
	function createEventDispatcher() {
		const component = get_current_component();
		return (type, detail, { cancelable = false } = {}) => {
			const callbacks = component.$$.callbacks[type];
			if (callbacks) {
				// TODO are there situations where events could be dispatched
				// in a server (non-DOM) environment?
				const event = custom_event(/** @type {string} */ (type), detail, { cancelable });
				callbacks.slice().forEach((fn) => {
					fn.call(component, event);
				});
				return !event.defaultPrevented;
			}
			return true;
		};
	}

	// TODO figure out if we still want to support
	// shorthand events, or if we want to implement
	// a real bubbling mechanism
	/**
	 * @param component
	 * @param event
	 * @returns {void}
	 */
	function bubble(component, event) {
		const callbacks = component.$$.callbacks[event.type];
		if (callbacks) {
			// @ts-ignore
			callbacks.slice().forEach((fn) => fn.call(this, event));
		}
	}

	const dirty_components = [];
	const binding_callbacks = [];

	let render_callbacks = [];

	const flush_callbacks = [];

	const resolved_promise = /* @__PURE__ */ Promise.resolve();

	let update_scheduled = false;

	/** @returns {void} */
	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	/** @returns {void} */
	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	/** @returns {void} */
	function add_flush_callback(fn) {
		flush_callbacks.push(fn);
	}

	// flush() calls callbacks in this order:
	// 1. All beforeUpdate callbacks, in order: parents before children
	// 2. All bind:this callbacks, in reverse order: children before parents.
	// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
	//    for afterUpdates called during the initial onMount, which are called in
	//    reverse order: children before parents.
	// Since callbacks might update component values, which could trigger another
	// call to flush(), the following steps guard against this:
	// 1. During beforeUpdate, any updated components will be added to the
	//    dirty_components array and will cause a reentrant call to flush(). Because
	//    the flush index is kept outside the function, the reentrant call will pick
	//    up where the earlier call left off and go through all dirty components. The
	//    current_component value is saved and restored so that the reentrant call will
	//    not interfere with the "parent" flush() call.
	// 2. bind:this callbacks cannot trigger new flush() calls.
	// 3. During afterUpdate, any updated components will NOT have their afterUpdate
	//    callback called a second time; the seen_callbacks set, outside the flush()
	//    function, guarantees this behavior.
	const seen_callbacks = new Set();

	let flushidx = 0; // Do *not* move this inside the flush() function

	/** @returns {void} */
	function flush() {
		// Do not reenter flush while dirty components are updated, as this can
		// result in an infinite loop. Instead, let the inner flush handle it.
		// Reentrancy is ok afterwards for bindings etc.
		if (flushidx !== 0) {
			return;
		}
		const saved_component = current_component;
		do {
			// first, call beforeUpdate functions
			// and update components
			try {
				while (flushidx < dirty_components.length) {
					const component = dirty_components[flushidx];
					flushidx++;
					set_current_component(component);
					update(component.$$);
				}
			} catch (e) {
				// reset dirty state to not end up in a deadlocked state and then rethrow
				dirty_components.length = 0;
				flushidx = 0;
				throw e;
			}
			set_current_component(null);
			dirty_components.length = 0;
			flushidx = 0;
			while (binding_callbacks.length) binding_callbacks.pop()();
			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			for (let i = 0; i < render_callbacks.length; i += 1) {
				const callback = render_callbacks[i];
				if (!seen_callbacks.has(callback)) {
					// ...so guard against infinite loops
					seen_callbacks.add(callback);
					callback();
				}
			}
			render_callbacks.length = 0;
		} while (dirty_components.length);
		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}
		update_scheduled = false;
		seen_callbacks.clear();
		set_current_component(saved_component);
	}

	/** @returns {void} */
	function update($$) {
		if ($$.fragment !== null) {
			$$.update();
			run_all($$.before_update);
			const dirty = $$.dirty;
			$$.dirty = [-1];
			$$.fragment && $$.fragment.p($$.ctx, dirty);
			$$.after_update.forEach(add_render_callback);
		}
	}

	/**
	 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function flush_render_callbacks(fns) {
		const filtered = [];
		const targets = [];
		render_callbacks.forEach((c) => (fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c)));
		targets.forEach((c) => c());
		render_callbacks = filtered;
	}

	const outroing = new Set();

	/**
	 * @type {Outro}
	 */
	let outros;

	/**
	 * @returns {void} */
	function group_outros() {
		outros = {
			r: 0,
			c: [],
			p: outros // parent group
		};
	}

	/**
	 * @returns {void} */
	function check_outros() {
		if (!outros.r) {
			run_all(outros.c);
		}
		outros = outros.p;
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} [local]
	 * @returns {void}
	 */
	function transition_in(block, local) {
		if (block && block.i) {
			outroing.delete(block);
			block.i(local);
		}
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} local
	 * @param {0 | 1} [detach]
	 * @param {() => void} [callback]
	 * @returns {void}
	 */
	function transition_out(block, local, detach, callback) {
		if (block && block.o) {
			if (outroing.has(block)) return;
			outroing.add(block);
			outros.c.push(() => {
				outroing.delete(block);
				if (callback) {
					if (detach) block.d(1);
					callback();
				}
			});
			block.o(local);
		} else if (callback) {
			callback();
		}
	}

	/** @typedef {1} INTRO */
	/** @typedef {0} OUTRO */
	/** @typedef {{ direction: 'in' | 'out' | 'both' }} TransitionOptions */
	/** @typedef {(node: Element, params: any, options: TransitionOptions) => import('../transition/public.js').TransitionConfig} TransitionFn */

	/**
	 * @typedef {Object} Outro
	 * @property {number} r
	 * @property {Function[]} c
	 * @property {Object} p
	 */

	/**
	 * @typedef {Object} PendingProgram
	 * @property {number} start
	 * @property {INTRO|OUTRO} b
	 * @property {Outro} [group]
	 */

	/**
	 * @typedef {Object} Program
	 * @property {number} a
	 * @property {INTRO|OUTRO} b
	 * @property {1|-1} d
	 * @property {number} duration
	 * @property {number} start
	 * @property {number} end
	 * @property {Outro} [group]
	 */

	// general each functions:

	function ensure_array_like(array_like_or_iterator) {
		return array_like_or_iterator?.length !== undefined
			? array_like_or_iterator
			: Array.from(array_like_or_iterator);
	}

	/** @returns {void} */
	function bind(component, name, callback) {
		const index = component.$$.props[name];
		if (index !== undefined) {
			component.$$.bound[index] = callback;
			callback(component.$$.ctx[index]);
		}
	}

	/** @returns {void} */
	function create_component(block) {
		block && block.c();
	}

	/** @returns {void} */
	function mount_component(component, target, anchor) {
		const { fragment, after_update } = component.$$;
		fragment && fragment.m(target, anchor);
		// onMount happens before the initial afterUpdate
		add_render_callback(() => {
			const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
			// if the component was destroyed immediately
			// it will update the `$$.on_destroy` reference to `null`.
			// the destructured on_destroy may still reference to the old array
			if (component.$$.on_destroy) {
				component.$$.on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});
		after_update.forEach(add_render_callback);
	}

	/** @returns {void} */
	function destroy_component(component, detaching) {
		const $$ = component.$$;
		if ($$.fragment !== null) {
			flush_render_callbacks($$.after_update);
			run_all($$.on_destroy);
			$$.fragment && $$.fragment.d(detaching);
			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			$$.on_destroy = $$.fragment = null;
			$$.ctx = [];
		}
	}

	/** @returns {void} */
	function make_dirty(component, i) {
		if (component.$$.dirty[0] === -1) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty.fill(0);
		}
		component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
	}

	// TODO: Document the other params
	/**
	 * @param {SvelteComponent} component
	 * @param {import('./public.js').ComponentConstructorOptions} options
	 *
	 * @param {import('./utils.js')['not_equal']} not_equal Used to compare props and state values.
	 * @param {(target: Element | ShadowRoot) => void} [append_styles] Function that appends styles to the DOM when the component is first initialised.
	 * This will be the `add_css` function from the compiled component.
	 *
	 * @returns {void}
	 */
	function init(
		component,
		options,
		instance,
		create_fragment,
		not_equal,
		props,
		append_styles = null,
		dirty = [-1]
	) {
		const parent_component = current_component;
		set_current_component(component);
		/** @type {import('./private.js').T$$} */
		const $$ = (component.$$ = {
			fragment: null,
			ctx: [],
			// state
			props,
			update: noop,
			not_equal,
			bound: blank_object(),
			// lifecycle
			on_mount: [],
			on_destroy: [],
			on_disconnect: [],
			before_update: [],
			after_update: [],
			context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
			// everything else
			callbacks: blank_object(),
			dirty,
			skip_bound: false,
			root: options.target || parent_component.$$.root
		});
		append_styles && append_styles($$.root);
		let ready = false;
		$$.ctx = instance
			? instance(component, options.props || {}, (i, ret, ...rest) => {
					const value = rest.length ? rest[0] : ret;
					if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
						if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
						if (ready) make_dirty(component, i);
					}
					return ret;
			  })
			: [];
		$$.update();
		ready = true;
		run_all($$.before_update);
		// `false` as a special case of no DOM component
		$$.fragment = create_fragment ? create_fragment($$.ctx) : false;
		if (options.target) {
			if (options.hydrate) {
				// TODO: what is the correct type here?
				// @ts-expect-error
				const nodes = children(options.target);
				$$.fragment && $$.fragment.l(nodes);
				nodes.forEach(detach);
			} else {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				$$.fragment && $$.fragment.c();
			}
			if (options.intro) transition_in(component.$$.fragment);
			mount_component(component, options.target, options.anchor);
			flush();
		}
		set_current_component(parent_component);
	}

	/**
	 * Base class for Svelte components. Used when dev=false.
	 *
	 * @template {Record<string, any>} [Props=any]
	 * @template {Record<string, any>} [Events=any]
	 */
	class SvelteComponent {
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$ = undefined;
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$set = undefined;

		/** @returns {void} */
		$destroy() {
			destroy_component(this, 1);
			this.$destroy = noop;
		}

		/**
		 * @template {Extract<keyof Events, string>} K
		 * @param {K} type
		 * @param {((e: Events[K]) => void) | null | undefined} callback
		 * @returns {() => void}
		 */
		$on(type, callback) {
			if (!is_function(callback)) {
				return noop;
			}
			const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
			callbacks.push(callback);
			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		/**
		 * @param {Partial<Props>} props
		 * @returns {void}
		 */
		$set(props) {
			if (this.$$set && !is_empty(props)) {
				this.$$.skip_bound = true;
				this.$$set(props);
				this.$$.skip_bound = false;
			}
		}
	}

	/**
	 * @typedef {Object} CustomElementPropDefinition
	 * @property {string} [attribute]
	 * @property {boolean} [reflect]
	 * @property {'String'|'Boolean'|'Number'|'Array'|'Object'} [type]
	 */

	// generated during release, do not modify

	const PUBLIC_VERSION = '4';

	if (typeof window !== 'undefined')
		// @ts-ignore
		(window.__svelte || (window.__svelte = { v: new Set() })).v.add(PUBLIC_VERSION);

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function getDefaultExportFromCjs (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	var debounce$2 = {exports: {}};

	function debounce(function_, wait = 100, options = {}) {
		if (typeof function_ !== 'function') {
			throw new TypeError(`Expected the first parameter to be a function, got \`${typeof function_}\`.`);
		}

		if (wait < 0) {
			throw new RangeError('`wait` must not be negative.');
		}

		// TODO: Deprecate the boolean parameter at some point.
		const {immediate} = typeof options === 'boolean' ? {immediate: options} : options;

		let storedContext;
		let storedArguments;
		let timeoutId;
		let timestamp;
		let result;

		function later() {
			const last = Date.now() - timestamp;

			if (last < wait && last >= 0) {
				timeoutId = setTimeout(later, wait - last);
			} else {
				timeoutId = undefined;

				if (!immediate) {
					const callContext = storedContext;
					const callArguments = storedArguments;
					storedContext = undefined;
					storedArguments = undefined;
					result = function_.apply(callContext, callArguments);
				}
			}
		}

		const debounced = function (...arguments_) {
			if (storedContext && this !== storedContext) {
				throw new Error('Debounced method called with different contexts.');
			}

			storedContext = this; // eslint-disable-line unicorn/no-this-assignment
			storedArguments = arguments_;
			timestamp = Date.now();

			const callNow = immediate && !timeoutId;

			if (!timeoutId) {
				timeoutId = setTimeout(later, wait);
			}

			if (callNow) {
				const callContext = storedContext;
				const callArguments = storedArguments;
				storedContext = undefined;
				storedArguments = undefined;
				result = function_.apply(callContext, callArguments);
			}

			return result;
		};

		debounced.clear = () => {
			if (!timeoutId) {
				return;
			}

			clearTimeout(timeoutId);
			timeoutId = undefined;
		};

		debounced.flush = () => {
			if (!timeoutId) {
				return;
			}

			const callContext = storedContext;
			const callArguments = storedArguments;
			storedContext = undefined;
			storedArguments = undefined;
			result = function_.apply(callContext, callArguments);

			clearTimeout(timeoutId);
			timeoutId = undefined;
		};

		return debounced;
	}

	// Adds compatibility for ES modules
	debounce$2.exports.debounce = debounce;

	debounce$2.exports = debounce;

	var debounceExports = debounce$2.exports;
	var debounce$1 = /*@__PURE__*/getDefaultExportFromCjs(debounceExports);

	const subscriber_queue = [];

	/**
	 * Create a `Writable` store that allows both updating and reading by subscription.
	 *
	 * https://svelte.dev/docs/svelte-store#writable
	 * @template T
	 * @param {T} [value] initial value
	 * @param {import('./public.js').StartStopNotifier<T>} [start]
	 * @returns {import('./public.js').Writable<T>}
	 */
	function writable(value, start = noop) {
		/** @type {import('./public.js').Unsubscriber} */
		let stop;
		/** @type {Set<import('./private.js').SubscribeInvalidateTuple<T>>} */
		const subscribers = new Set();
		/** @param {T} new_value
		 * @returns {void}
		 */
		function set(new_value) {
			if (safe_not_equal(value, new_value)) {
				value = new_value;
				if (stop) {
					// store is ready
					const run_queue = !subscriber_queue.length;
					for (const subscriber of subscribers) {
						subscriber[1]();
						subscriber_queue.push(subscriber, value);
					}
					if (run_queue) {
						for (let i = 0; i < subscriber_queue.length; i += 2) {
							subscriber_queue[i][0](subscriber_queue[i + 1]);
						}
						subscriber_queue.length = 0;
					}
				}
			}
		}

		/**
		 * @param {import('./public.js').Updater<T>} fn
		 * @returns {void}
		 */
		function update(fn) {
			set(fn(value));
		}

		/**
		 * @param {import('./public.js').Subscriber<T>} run
		 * @param {import('./private.js').Invalidator<T>} [invalidate]
		 * @returns {import('./public.js').Unsubscriber}
		 */
		function subscribe(run, invalidate = noop) {
			/** @type {import('./private.js').SubscribeInvalidateTuple<T>} */
			const subscriber = [run, invalidate];
			subscribers.add(subscriber);
			if (subscribers.size === 1) {
				stop = start(set, update) || noop;
			}
			run(value);
			return () => {
				subscribers.delete(subscriber);
				if (subscribers.size === 0 && stop) {
					stop();
					stop = null;
				}
			};
		}
		return { set, update, subscribe };
	}

	/**
	 * @param {any} obj
	 * @returns {boolean}
	 */
	function is_date(obj) {
		return Object.prototype.toString.call(obj) === '[object Date]';
	}

	/**
	 * @template T
	 * @param {import('./private.js').TickContext<T>} ctx
	 * @param {T} last_value
	 * @param {T} current_value
	 * @param {T} target_value
	 * @returns {T}
	 */
	function tick_spring(ctx, last_value, current_value, target_value) {
		if (typeof current_value === 'number' || is_date(current_value)) {
			// @ts-ignore
			const delta = target_value - current_value;
			// @ts-ignore
			const velocity = (current_value - last_value) / (ctx.dt || 1 / 60); // guard div by 0
			const spring = ctx.opts.stiffness * delta;
			const damper = ctx.opts.damping * velocity;
			const acceleration = (spring - damper) * ctx.inv_mass;
			const d = (velocity + acceleration) * ctx.dt;
			if (Math.abs(d) < ctx.opts.precision && Math.abs(delta) < ctx.opts.precision) {
				return target_value; // settled
			} else {
				ctx.settled = false; // signal loop to keep ticking
				// @ts-ignore
				return is_date(current_value) ? new Date(current_value.getTime() + d) : current_value + d;
			}
		} else if (Array.isArray(current_value)) {
			// @ts-ignore
			return current_value.map((_, i) =>
				tick_spring(ctx, last_value[i], current_value[i], target_value[i])
			);
		} else if (typeof current_value === 'object') {
			const next_value = {};
			for (const k in current_value) {
				// @ts-ignore
				next_value[k] = tick_spring(ctx, last_value[k], current_value[k], target_value[k]);
			}
			// @ts-ignore
			return next_value;
		} else {
			throw new Error(`Cannot spring ${typeof current_value} values`);
		}
	}

	/**
	 * The spring function in Svelte creates a store whose value is animated, with a motion that simulates the behavior of a spring. This means when the value changes, instead of transitioning at a steady rate, it "bounces" like a spring would, depending on the physics parameters provided. This adds a level of realism to the transitions and can enhance the user experience.
	 *
	 * https://svelte.dev/docs/svelte-motion#spring
	 * @template [T=any]
	 * @param {T} [value]
	 * @param {import('./private.js').SpringOpts} [opts]
	 * @returns {import('./public.js').Spring<T>}
	 */
	function spring(value, opts = {}) {
		const store = writable(value);
		const { stiffness = 0.15, damping = 0.8, precision = 0.01 } = opts;
		/** @type {number} */
		let last_time;
		/** @type {import('../internal/private.js').Task} */
		let task;
		/** @type {object} */
		let current_token;
		/** @type {T} */
		let last_value = value;
		/** @type {T} */
		let target_value = value;
		let inv_mass = 1;
		let inv_mass_recovery_rate = 0;
		let cancel_task = false;
		/**
		 * @param {T} new_value
		 * @param {import('./private.js').SpringUpdateOpts} opts
		 * @returns {Promise<void>}
		 */
		function set(new_value, opts = {}) {
			target_value = new_value;
			const token = (current_token = {});
			if (value == null || opts.hard || (spring.stiffness >= 1 && spring.damping >= 1)) {
				cancel_task = true; // cancel any running animation
				last_time = now();
				last_value = new_value;
				store.set((value = target_value));
				return Promise.resolve();
			} else if (opts.soft) {
				const rate = opts.soft === true ? 0.5 : +opts.soft;
				inv_mass_recovery_rate = 1 / (rate * 60);
				inv_mass = 0; // infinite mass, unaffected by spring forces
			}
			if (!task) {
				last_time = now();
				cancel_task = false;
				task = loop((now) => {
					if (cancel_task) {
						cancel_task = false;
						task = null;
						return false;
					}
					inv_mass = Math.min(inv_mass + inv_mass_recovery_rate, 1);
					const ctx = {
						inv_mass,
						opts: spring,
						settled: true,
						dt: ((now - last_time) * 60) / 1000
					};
					const next_value = tick_spring(ctx, last_value, value, target_value);
					last_time = now;
					last_value = value;
					store.set((value = next_value));
					if (ctx.settled) {
						task = null;
					}
					return !ctx.settled;
				});
			}
			return new Promise((fulfil) => {
				task.promise.then(() => {
					if (token === current_token) fulfil();
				});
			});
		}
		/** @type {import('./public.js').Spring<T>} */
		const spring = {
			set,
			update: (fn, opts) => set(fn(target_value, value), opts),
			subscribe: store.subscribe,
			stiffness,
			damping,
			precision
		};
		return spring;
	}

	const useGM = typeof GM_getValue !== 'undefined';
	function setValue(key, value) {
	    if (useGM) {
	        GM_setValue(key, value);
	    }
	    else {
	        localStorage.setItem(`gc-${key}`, value);
	    }
	}
	function getValue(key, defaultValue) {
	    if (useGM) {
	        return GM_getValue(key, defaultValue);
	    }
	    else {
	        return localStorage.getItem(`gc-${key}`) ?? defaultValue;
	    }
	}

	const defaultCss = {
	    textColor: "rgba(255, 255, 255, 1)",
	    menuBackgroundColor: "rgba(0, 0, 0, 0.5)",
	    menuOutlineColor: "rgba(255, 255, 255, 0)",
	    menuHeaderBackgroundColor: "rgba(0, 0, 255, 0.5)",
	    menuHeaderTextColor: "rgba(255, 255, 255, 1)",
	    buttonBackgroundColor: "rgba(0, 0, 0, 0.5)",
	    buttonBorderColor: "rgba(255, 255, 255, 1)"
	};
	const defaultMenuTransforms = {
	    "General Cheats": {
	        x: 0,
	        y: 0,
	        width: window.innerWidth / 4,
	        height: window.innerHeight / 3 * 2,
	        minimized: false
	    },
	    "Gamemode Specific Cheats": {
	        x: window.innerWidth / 8 * 3,
	        y: 0,
	        width: window.innerWidth / 4,
	        height: window.innerHeight / 3 * 2,
	        minimized: false
	    },
	    "Customization": {
	        x: window.innerWidth / 4 * 3,
	        y: 0,
	        width: window.innerWidth / 4,
	        height: window.innerHeight / 3 * 2,
	        minimized: false
	    }
	};

	let cssVarsString = getValue('cssVars');
	let cssVars = {};
	if (cssVarsString)
	    cssVars = JSON.parse(cssVarsString);
	// merge default css vars with saved vars
	cssVars = Object.assign({}, defaultCss, cssVars);
	async function addVars() {
	    if (!document.documentElement) {
	        await new Promise(res => window.addEventListener('DOMContentLoaded', res));
	    }
	    for (let [key, value] of Object.entries(cssVars)) {
	        document.documentElement.style.setProperty(`--${key}`, value);
	    }
	}
	function getCssVar(key) {
	    return cssVars[key];
	}
	function setCssVar(key, value) {
	    cssVars[key] = value;
	    setValue('cssVars', JSON.stringify(cssVars));
	}
	function setCssVars(vars) {
	    cssVars = Object.assign({}, cssVars, vars);
	    setValue('cssVars', JSON.stringify(cssVars));
	}
	let menuTransformsString = getValue('menuTransforms');
	let menuTransforms = {};
	if (menuTransformsString)
	    menuTransforms = JSON.parse(menuTransformsString);
	// merge default menu transforms with saved transforms
	menuTransforms = Object.assign({}, defaultMenuTransforms, menuTransforms);
	function getMenuTransform(menuName) {
	    return menuTransforms[menuName];
	}
	function setMenuTransform(menuName, transform) {
	    menuTransforms[menuName] = transform;
	    setValue('menuTransforms', JSON.stringify(menuTransforms));
	}
	let hotkeysString = getValue('hotkeys');
	let hotkeys = {};
	if (hotkeysString)
	    hotkeys = JSON.parse(hotkeysString);
	function getHotkey(menuName) {
	    return hotkeys[menuName];
	}
	function setHotkey(menuName, keys) {
	    hotkeys[menuName] = keys;
	    setValue('hotkeys', JSON.stringify(hotkeys));
	}

	function findMatchingParent(node, selector) {
	    if (node.matches(selector)) {
	        return node;
	    }
	    if (node.parentElement) {
	        return findMatchingParent(node.parentElement, selector);
	    }
	    return null;
	}
	function parseRGBA(string) {
	    let [r, g, b, a] = string
	        .replace('rgba(', '')
	        .replace(')', '')
	        .split(',')
	        .map(value => parseFloat(value.trim()));
	    return { r, g, b, a };
	}
	function parseHex(string) {
	    let [r, g, b] = string
	        .replace('#', '')
	        .match(/.{1,2}/g)
	        .map(value => parseInt(value, 16));
	    return { r, g, b };
	}
	function rgbToHex(r, g, b) {
	    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
	}
	function componentToHex(c) {
	    var hex = Math.round(c).toString(16);
	    return hex.length == 1 ? "0" + hex : hex;
	}
	function getUnsafeWindow() {
	    if (typeof unsafeWindow === 'undefined') {
	        return window;
	    }
	    return unsafeWindow;
	}
	function parseChangePacket(packet) {
	    let returnVar = [];
	    for (let change of packet.changes) {
	        let data = {};
	        let keys = change[1].map((index) => packet.values[index]);
	        for (let i = 0; i < keys.length; i++) {
	            data[keys[i]] = change[2][i];
	        }
	        returnVar.push({
	            id: change[0],
	            data
	        });
	    }
	    return returnVar;
	}

	// this code was stolen from the original Gimkit Util extension
	function n(t, e, n) {
	    for (var i = 0, s = 0, o = n.length; s < o; s++)(i = n.charCodeAt(s)) < 128 ? t.setUint8(e++, i) : (i < 2048 ? t.setUint8(e++, 192 | i >> 6) : (i < 55296 || 57344 <= i ? t.setUint8(e++, 224 | i >> 12) : (s++, i = 65536 + ((1023 & i) << 10 | 1023 & n.charCodeAt(s)), t.setUint8(e++, 240 | i >> 18), t.setUint8(e++, 128 | i >> 12 & 63)), t.setUint8(e++, 128 | i >> 6 & 63)), t.setUint8(e++, 128 | 63 & i));
	}

	function encode$1(t, e, s) {
	    let o;

	    if(Array.isArray(t)) {
	        o = {
	            type: 2,
	            data: t,
	            options: {
	                compress: !0
	            },
	            nsp: "/"
	        };
	    } else {
	        o = {
	            type: 2,
	            data: ["blueboat_SEND_MESSAGE", {
	                room: s,
	                key: t,
	                data: e
	            }],
	            options: {
	                compress: !0
	            },
	            nsp: "/"
	        };
	    }

	    return function(t) {
	        var e = [],
	            i = [],
	            s = function t(e, n, i) {
	                var s = typeof i,
	                    o = 0,
	                    r = 0,
	                    a = 0,
	                    c = 0,
	                    l = 0,
	                    u = 0;
	                if ("string" === s) {
	                    if ((l = function(t) {
	                            for (var e = 0, n = 0, i = 0, s = t.length; i < s; i++)(e = t.charCodeAt(i)) < 128 ? n += 1 : e < 2048 ? n += 2 : e < 55296 || 57344 <= e ? n += 3 : (i++, n += 4);
	                            return n
	                        }(i)) < 32) e.push(160 | l), u = 1;
	                    else if (l < 256) e.push(217, l), u = 2;
	                    else if (l < 65536) e.push(218, l >> 8, l), u = 3;
	                    else {
	                        if (!(l < 4294967296)) throw new Error("String too long");
	                        e.push(219, l >> 24, l >> 16, l >> 8, l), u = 5;
	                    }
	                    return n.push({
	                        h: i,
	                        u: l,
	                        t: e.length
	                    }), u + l
	                }
	                if ("number" === s) return Math.floor(i) === i && isFinite(i) ? 0 <= i ? i < 128 ? (e.push(i), 1) : i < 256 ? (e.push(204, i), 2) : i < 65536 ? (e.push(205, i >> 8, i), 3) : i < 4294967296 ? (e.push(206, i >> 24, i >> 16, i >> 8, i), 5) : (a = i / Math.pow(2, 32) >> 0, c = i >>> 0, e.push(207, a >> 24, a >> 16, a >> 8, a, c >> 24, c >> 16, c >> 8, c), 9) : -32 <= i ? (e.push(i), 1) : -128 <= i ? (e.push(208, i), 2) : -32768 <= i ? (e.push(209, i >> 8, i), 3) : -2147483648 <= i ? (e.push(210, i >> 24, i >> 16, i >> 8, i), 5) : (a = Math.floor(i / Math.pow(2, 32)), c = i >>> 0, e.push(211, a >> 24, a >> 16, a >> 8, a, c >> 24, c >> 16, c >> 8, c), 9) : (e.push(203), n.push({
	                    o: i,
	                    u: 8,
	                    t: e.length
	                }), 9);
	                if ("object" === s) {
	                    if (null === i) return e.push(192), 1;
	                    if (Array.isArray(i)) {
	                        if ((l = i.length) < 16) e.push(144 | l), u = 1;
	                        else if (l < 65536) e.push(220, l >> 8, l), u = 3;
	                        else {
	                            if (!(l < 4294967296)) throw new Error("Array too large");
	                            e.push(221, l >> 24, l >> 16, l >> 8, l), u = 5;
	                        }
	                        for (o = 0; o < l; o++) u += t(e, n, i[o]);
	                        return u
	                    }
	                    if (i instanceof Date) {
	                        var h = i.getTime();
	                        return a = Math.floor(h / Math.pow(2, 32)), c = h >>> 0, e.push(215, 0, a >> 24, a >> 16, a >> 8, a, c >> 24, c >> 16, c >> 8, c), 10
	                    }
	                    if (i instanceof ArrayBuffer) {
	                        if ((l = i.byteLength) < 256) e.push(196, l), u = 2;
	                        else if (l < 65536) e.push(197, l >> 8, l), u = 3;
	                        else {
	                            if (!(l < 4294967296)) throw new Error("Buffer too large");
	                            e.push(198, l >> 24, l >> 16, l >> 8, l), u = 5;
	                        }
	                        return n.push({
	                            l: i,
	                            u: l,
	                            t: e.length
	                        }), u + l
	                    }
	                    if ("function" == typeof i.toJSON) return t(e, n, i.toJSON());
	                    var d = [],
	                        f = "",
	                        p = Object.keys(i);
	                    for (o = 0, r = p.length; o < r; o++) "function" != typeof i[f = p[o]] && d.push(f);
	                    if ((l = d.length) < 16) e.push(128 | l), u = 1;
	                    else if (l < 65536) e.push(222, l >> 8, l), u = 3;
	                    else {
	                        if (!(l < 4294967296)) throw new Error("Object too large");
	                        e.push(223, l >> 24, l >> 16, l >> 8, l), u = 5;
	                    }
	                    for (o = 0; o < l; o++) u += t(e, n, f = d[o]), u += t(e, n, i[f]);
	                    return u
	                }
	                if ("boolean" === s) return e.push(i ? 195 : 194), 1;
	                if ("undefined" === s) return e.push(212, 0, 0), 3;
	                throw new Error("Could not encode")
	            }(e, i, t),
	            o = new ArrayBuffer(s),
	            r = new DataView(o),
	            a = 0,
	            c = 0,
	            l = -1;
	        0 < i.length && (l = i[0].t);
	        for (var u, h = 0, d = 0, f = 0, p = e.length; f < p; f++)
	            if (r.setUint8(c + f, e[f]), f + 1 === l) {
	                if (h = (u = i[a]).u, d = c + l, u.l)
	                    for (var g = new Uint8Array(u.l), E = 0; E < h; E++) r.setUint8(d + E, g[E]);
	                else u.h ? n(r, d, u.h) : void 0 !== u.o && r.setFloat64(d, u.o);
	                c += h, i[++a] && (l = i[a].t);
	            } let y = Array.from(new Uint8Array(o));
	        y.unshift(4);
	        return new Uint8Array(y).buffer 
	    }(o)
	}

	function decode$1(packet) {
	    function e(t) {
	        if (this.t = 0, t instanceof ArrayBuffer) this.i = t, this.s = new DataView(this.i);
	        else {
	            if (!ArrayBuffer.isView(t)) return null;
	            this.i = t.buffer, this.s = new DataView(this.i, t.byteOffset, t.byteLength);
	        }
	    }

	    e.prototype.g = function(t) {
	        for (var e = new Array(t), n = 0; n < t; n++) e[n] = this.v();
	        return e
	    }, e.prototype.M = function(t) {
	        for (var e = {}, n = 0; n < t; n++) e[this.v()] = this.v();
	        return e
	    }, e.prototype.h = function(t) {
	        var e = function(t, e, n) {
	            for (var i = "", s = 0, o = e, r = e + n; o < r; o++) {
	                var a = t.getUint8(o);
	                if (0 != (128 & a))
	                    if (192 != (224 & a))
	                        if (224 != (240 & a)) {
	                            if (240 != (248 & a)) throw new Error("Invalid byte " + a.toString(16));
	                            65536 <= (s = (7 & a) << 18 | (63 & t.getUint8(++o)) << 12 | (63 & t.getUint8(++o)) << 6 | (63 & t.getUint8(++o)) << 0) ? (s -= 65536, i += String.fromCharCode(55296 + (s >>> 10), 56320 + (1023 & s))) : i += String.fromCharCode(s);
	                        } else i += String.fromCharCode((15 & a) << 12 | (63 & t.getUint8(++o)) << 6 | (63 & t.getUint8(++o)) << 0);
	                else i += String.fromCharCode((31 & a) << 6 | 63 & t.getUint8(++o));
	                else i += String.fromCharCode(a);
	            }
	            return i
	        }(this.s, this.t, t);
	        return this.t += t, e
	    }, e.prototype.l = function(t) {
	        var e = this.i.slice(this.t, this.t + t);
	        return this.t += t, e
	    }, e.prototype.v = function() {
	        if(!this.s) return null;
	        var t, e = this.s.getUint8(this.t++),
	            n = 0,
	            i = 0,
	            s = 0,
	            o = 0;
	        if (e < 192) return e < 128 ? e : e < 144 ? this.M(15 & e) : e < 160 ? this.g(15 & e) : this.h(31 & e);
	        if (223 < e) return -1 * (255 - e + 1);
	        switch (e) {
	            case 192:
	                return null;
	            case 194:
	                return !1;
	            case 195:
	                return !0;
	            case 196:
	                return n = this.s.getUint8(this.t), this.t += 1, this.l(n);
	            case 197:
	                return n = this.s.getUint16(this.t), this.t += 2, this.l(n);
	            case 198:
	                return n = this.s.getUint32(this.t), this.t += 4, this.l(n);
	            case 199:
	                return n = this.s.getUint8(this.t), i = this.s.getInt8(this.t + 1), this.t += 2, [i, this.l(n)];
	            case 200:
	                return n = this.s.getUint16(this.t), i = this.s.getInt8(this.t + 2), this.t += 3, [i, this.l(n)];
	            case 201:
	                return n = this.s.getUint32(this.t), i = this.s.getInt8(this.t + 4), this.t += 5, [i, this.l(n)];
	            case 202:
	                return t = this.s.getFloat32(this.t), this.t += 4, t;
	            case 203:
	                return t = this.s.getFloat64(this.t), this.t += 8, t;
	            case 204:
	                return t = this.s.getUint8(this.t), this.t += 1, t;
	            case 205:
	                return t = this.s.getUint16(this.t), this.t += 2, t;
	            case 206:
	                return t = this.s.getUint32(this.t), this.t += 4, t;
	            case 207:
	                return s = this.s.getUint32(this.t) * Math.pow(2, 32), o = this.s.getUint32(this.t + 4), this.t += 8, s + o;
	            case 208:
	                return t = this.s.getInt8(this.t), this.t += 1, t;
	            case 209:
	                return t = this.s.getInt16(this.t), this.t += 2, t;
	            case 210:
	                return t = this.s.getInt32(this.t), this.t += 4, t;
	            case 211:
	                return s = this.s.getInt32(this.t) * Math.pow(2, 32), o = this.s.getUint32(this.t + 4), this.t += 8, s + o;
	            case 212:
	                return i = this.s.getInt8(this.t), this.t += 1, 0 === i ? void(this.t += 1) : [i, this.l(1)];
	            case 213:
	                return i = this.s.getInt8(this.t), this.t += 1, [i, this.l(2)];
	            case 214:
	                return i = this.s.getInt8(this.t), this.t += 1, [i, this.l(4)];
	            case 215:
	                return i = this.s.getInt8(this.t), this.t += 1, 0 === i ? (s = this.s.getInt32(this.t) * Math.pow(2, 32), o = this.s.getUint32(this.t + 4), this.t += 8, new Date(s + o)) : [i, this.l(8)];
	            case 216:
	                return i = this.s.getInt8(this.t), this.t += 1, [i, this.l(16)];
	            case 217:
	                return n = this.s.getUint8(this.t), this.t += 1, this.h(n);
	            case 218:
	                return n = this.s.getUint16(this.t), this.t += 2, this.h(n);
	            case 219:
	                return n = this.s.getUint32(this.t), this.t += 4, this.h(n);
	            case 220:
	                return n = this.s.getUint16(this.t), this.t += 2, this.g(n);
	            case 221:
	                return n = this.s.getUint32(this.t), this.t += 4, this.g(n);
	            case 222:
	                return n = this.s.getUint16(this.t), this.t += 2, this.M(n);
	            case 223:
	                return n = this.s.getUint32(this.t), this.t += 4, this.M(n)
	        }
	        throw new Error("Could not parse")
	    };

	    const q = function(t) {
	        var n = new e(t = t.slice(1)),
	            i = n.v();
	        if (n.t === t.byteLength) return i;
	        return null
	    }(packet);

	    return q?.data?.[1];
	}

	var blueboat = {
	    encode: encode$1,
	    decode: decode$1
	};

	var msgpack = {};

	/**
	 * Copyright (c) 2014 Ion Drive Software Ltd.
	 * https://github.com/darrachequesne/notepack/
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in all
	 * copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	 * SOFTWARE.
	 */
	Object.defineProperty(msgpack, "__esModule", { value: true });
	var decode_1 = msgpack.decode = encode_1 = msgpack.encode = void 0;
	/**
	 * Patch for Colyseus:
	 * -------------------
	 * notepack.io@3.0.1
	 *
	 * added `offset` on Decoder constructor, for messages arriving with a code
	 * before actual msgpack data
	 */
	//
	// DECODER
	//
	function Decoder(buffer, offset) {
	    this._offset = offset;
	    if (buffer instanceof ArrayBuffer) {
	        this._buffer = buffer;
	        this._view = new DataView(this._buffer);
	    }
	    else if (ArrayBuffer.isView(buffer)) {
	        this._buffer = buffer.buffer;
	        this._view = new DataView(this._buffer, buffer.byteOffset, buffer.byteLength);
	    }
	    else {
	        throw new Error('Invalid argument');
	    }
	}
	function utf8Read(view, offset, length) {
	    var string = '', chr = 0;
	    for (var i = offset, end = offset + length; i < end; i++) {
	        var byte = view.getUint8(i);
	        if ((byte & 0x80) === 0x00) {
	            string += String.fromCharCode(byte);
	            continue;
	        }
	        if ((byte & 0xe0) === 0xc0) {
	            string += String.fromCharCode(((byte & 0x1f) << 6) |
	                (view.getUint8(++i) & 0x3f));
	            continue;
	        }
	        if ((byte & 0xf0) === 0xe0) {
	            string += String.fromCharCode(((byte & 0x0f) << 12) |
	                ((view.getUint8(++i) & 0x3f) << 6) |
	                ((view.getUint8(++i) & 0x3f) << 0));
	            continue;
	        }
	        if ((byte & 0xf8) === 0xf0) {
	            chr = ((byte & 0x07) << 18) |
	                ((view.getUint8(++i) & 0x3f) << 12) |
	                ((view.getUint8(++i) & 0x3f) << 6) |
	                ((view.getUint8(++i) & 0x3f) << 0);
	            if (chr >= 0x010000) { // surrogate pair
	                chr -= 0x010000;
	                string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
	            }
	            else {
	                string += String.fromCharCode(chr);
	            }
	            continue;
	        }
	        throw new Error('Invalid byte ' + byte.toString(16));
	    }
	    return string;
	}
	Decoder.prototype._array = function (length) {
	    var value = new Array(length);
	    for (var i = 0; i < length; i++) {
	        value[i] = this._parse();
	    }
	    return value;
	};
	Decoder.prototype._map = function (length) {
	    var key = '', value = {};
	    for (var i = 0; i < length; i++) {
	        key = this._parse();
	        value[key] = this._parse();
	    }
	    return value;
	};
	Decoder.prototype._str = function (length) {
	    var value = utf8Read(this._view, this._offset, length);
	    this._offset += length;
	    return value;
	};
	Decoder.prototype._bin = function (length) {
	    var value = this._buffer.slice(this._offset, this._offset + length);
	    this._offset += length;
	    return value;
	};
	Decoder.prototype._parse = function () {
	    var prefix = this._view.getUint8(this._offset++);
	    var value, length = 0, type = 0, hi = 0, lo = 0;
	    if (prefix < 0xc0) {
	        // positive fixint
	        if (prefix < 0x80) {
	            return prefix;
	        }
	        // fixmap
	        if (prefix < 0x90) {
	            return this._map(prefix & 0x0f);
	        }
	        // fixarray
	        if (prefix < 0xa0) {
	            return this._array(prefix & 0x0f);
	        }
	        // fixstr
	        return this._str(prefix & 0x1f);
	    }
	    // negative fixint
	    if (prefix > 0xdf) {
	        return (0xff - prefix + 1) * -1;
	    }
	    switch (prefix) {
	        // nil
	        case 0xc0:
	            return null;
	        // false
	        case 0xc2:
	            return false;
	        // true
	        case 0xc3:
	            return true;
	        // bin
	        case 0xc4:
	            length = this._view.getUint8(this._offset);
	            this._offset += 1;
	            return this._bin(length);
	        case 0xc5:
	            length = this._view.getUint16(this._offset);
	            this._offset += 2;
	            return this._bin(length);
	        case 0xc6:
	            length = this._view.getUint32(this._offset);
	            this._offset += 4;
	            return this._bin(length);
	        // ext
	        case 0xc7:
	            length = this._view.getUint8(this._offset);
	            type = this._view.getInt8(this._offset + 1);
	            this._offset += 2;
	            if (type === -1) {
	                // timestamp 96
	                var ns = this._view.getUint32(this._offset);
	                hi = this._view.getInt32(this._offset + 4);
	                lo = this._view.getUint32(this._offset + 8);
	                this._offset += 12;
	                return new Date((hi * 0x100000000 + lo) * 1e3 + ns / 1e6);
	            }
	            return [type, this._bin(length)];
	        case 0xc8:
	            length = this._view.getUint16(this._offset);
	            type = this._view.getInt8(this._offset + 2);
	            this._offset += 3;
	            return [type, this._bin(length)];
	        case 0xc9:
	            length = this._view.getUint32(this._offset);
	            type = this._view.getInt8(this._offset + 4);
	            this._offset += 5;
	            return [type, this._bin(length)];
	        // float
	        case 0xca:
	            value = this._view.getFloat32(this._offset);
	            this._offset += 4;
	            return value;
	        case 0xcb:
	            value = this._view.getFloat64(this._offset);
	            this._offset += 8;
	            return value;
	        // uint
	        case 0xcc:
	            value = this._view.getUint8(this._offset);
	            this._offset += 1;
	            return value;
	        case 0xcd:
	            value = this._view.getUint16(this._offset);
	            this._offset += 2;
	            return value;
	        case 0xce:
	            value = this._view.getUint32(this._offset);
	            this._offset += 4;
	            return value;
	        case 0xcf:
	            hi = this._view.getUint32(this._offset) * Math.pow(2, 32);
	            lo = this._view.getUint32(this._offset + 4);
	            this._offset += 8;
	            return hi + lo;
	        // int
	        case 0xd0:
	            value = this._view.getInt8(this._offset);
	            this._offset += 1;
	            return value;
	        case 0xd1:
	            value = this._view.getInt16(this._offset);
	            this._offset += 2;
	            return value;
	        case 0xd2:
	            value = this._view.getInt32(this._offset);
	            this._offset += 4;
	            return value;
	        case 0xd3:
	            hi = this._view.getInt32(this._offset) * Math.pow(2, 32);
	            lo = this._view.getUint32(this._offset + 4);
	            this._offset += 8;
	            return hi + lo;
	        // fixext
	        case 0xd4:
	            type = this._view.getInt8(this._offset);
	            this._offset += 1;
	            if (type === 0x00) {
	                // custom encoding for 'undefined' (kept for backward-compatibility)
	                this._offset += 1;
	                return void 0;
	            }
	            return [type, this._bin(1)];
	        case 0xd5:
	            type = this._view.getInt8(this._offset);
	            this._offset += 1;
	            return [type, this._bin(2)];
	        case 0xd6:
	            type = this._view.getInt8(this._offset);
	            this._offset += 1;
	            if (type === -1) {
	                // timestamp 32
	                value = this._view.getUint32(this._offset);
	                this._offset += 4;
	                return new Date(value * 1e3);
	            }
	            return [type, this._bin(4)];
	        case 0xd7:
	            type = this._view.getInt8(this._offset);
	            this._offset += 1;
	            if (type === 0x00) {
	                // custom date encoding (kept for backward-compatibility)
	                hi = this._view.getInt32(this._offset) * Math.pow(2, 32);
	                lo = this._view.getUint32(this._offset + 4);
	                this._offset += 8;
	                return new Date(hi + lo);
	            }
	            if (type === -1) {
	                // timestamp 64
	                hi = this._view.getUint32(this._offset);
	                lo = this._view.getUint32(this._offset + 4);
	                this._offset += 8;
	                var s = (hi & 0x3) * 0x100000000 + lo;
	                return new Date(s * 1e3 + (hi >>> 2) / 1e6);
	            }
	            return [type, this._bin(8)];
	        case 0xd8:
	            type = this._view.getInt8(this._offset);
	            this._offset += 1;
	            return [type, this._bin(16)];
	        // str
	        case 0xd9:
	            length = this._view.getUint8(this._offset);
	            this._offset += 1;
	            return this._str(length);
	        case 0xda:
	            length = this._view.getUint16(this._offset);
	            this._offset += 2;
	            return this._str(length);
	        case 0xdb:
	            length = this._view.getUint32(this._offset);
	            this._offset += 4;
	            return this._str(length);
	        // array
	        case 0xdc:
	            length = this._view.getUint16(this._offset);
	            this._offset += 2;
	            return this._array(length);
	        case 0xdd:
	            length = this._view.getUint32(this._offset);
	            this._offset += 4;
	            return this._array(length);
	        // map
	        case 0xde:
	            length = this._view.getUint16(this._offset);
	            this._offset += 2;
	            return this._map(length);
	        case 0xdf:
	            length = this._view.getUint32(this._offset);
	            this._offset += 4;
	            return this._map(length);
	    }
	    throw new Error('Could not parse');
	};
	function decode(buffer, offset = 0) {
	    var decoder = new Decoder(buffer, offset);
	    var value = decoder._parse();
	    if (decoder._offset !== buffer.byteLength) {
	        throw new Error((buffer.byteLength - decoder._offset) + ' trailing bytes');
	    }
	    return value;
	}
	decode_1 = msgpack.decode = decode;
	//
	// ENCODER
	//
	var TIMESTAMP32_MAX_SEC = 0x100000000 - 1; // 32-bit unsigned int
	var TIMESTAMP64_MAX_SEC = 0x400000000 - 1; // 34-bit unsigned int
	function utf8Write(view, offset, str) {
	    var c = 0;
	    for (var i = 0, l = str.length; i < l; i++) {
	        c = str.charCodeAt(i);
	        if (c < 0x80) {
	            view.setUint8(offset++, c);
	        }
	        else if (c < 0x800) {
	            view.setUint8(offset++, 0xc0 | (c >> 6));
	            view.setUint8(offset++, 0x80 | (c & 0x3f));
	        }
	        else if (c < 0xd800 || c >= 0xe000) {
	            view.setUint8(offset++, 0xe0 | (c >> 12));
	            view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
	            view.setUint8(offset++, 0x80 | (c & 0x3f));
	        }
	        else {
	            i++;
	            c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
	            view.setUint8(offset++, 0xf0 | (c >> 18));
	            view.setUint8(offset++, 0x80 | (c >> 12) & 0x3f);
	            view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
	            view.setUint8(offset++, 0x80 | (c & 0x3f));
	        }
	    }
	}
	function utf8Length(str) {
	    var c = 0, length = 0;
	    for (var i = 0, l = str.length; i < l; i++) {
	        c = str.charCodeAt(i);
	        if (c < 0x80) {
	            length += 1;
	        }
	        else if (c < 0x800) {
	            length += 2;
	        }
	        else if (c < 0xd800 || c >= 0xe000) {
	            length += 3;
	        }
	        else {
	            i++;
	            length += 4;
	        }
	    }
	    return length;
	}
	function _encode(bytes, defers, value) {
	    var type = typeof value, i = 0, l = 0, hi = 0, lo = 0, length = 0, size = 0;
	    if (type === 'string') {
	        length = utf8Length(value);
	        // fixstr
	        if (length < 0x20) {
	            bytes.push(length | 0xa0);
	            size = 1;
	        }
	        // str 8
	        else if (length < 0x100) {
	            bytes.push(0xd9, length);
	            size = 2;
	        }
	        // str 16
	        else if (length < 0x10000) {
	            bytes.push(0xda, length >> 8, length);
	            size = 3;
	        }
	        // str 32
	        else if (length < 0x100000000) {
	            bytes.push(0xdb, length >> 24, length >> 16, length >> 8, length);
	            size = 5;
	        }
	        else {
	            throw new Error('String too long');
	        }
	        defers.push({ _str: value, _length: length, _offset: bytes.length });
	        return size + length;
	    }
	    if (type === 'number') {
	        // TODO: encode to float 32?
	        // float 64
	        if (Math.floor(value) !== value || !isFinite(value)) {
	            bytes.push(0xcb);
	            defers.push({ _float: value, _length: 8, _offset: bytes.length });
	            return 9;
	        }
	        if (value >= 0) {
	            // positive fixnum
	            if (value < 0x80) {
	                bytes.push(value);
	                return 1;
	            }
	            // uint 8
	            if (value < 0x100) {
	                bytes.push(0xcc, value);
	                return 2;
	            }
	            // uint 16
	            if (value < 0x10000) {
	                bytes.push(0xcd, value >> 8, value);
	                return 3;
	            }
	            // uint 32
	            if (value < 0x100000000) {
	                bytes.push(0xce, value >> 24, value >> 16, value >> 8, value);
	                return 5;
	            }
	            // uint 64
	            hi = (value / Math.pow(2, 32)) >> 0;
	            lo = value >>> 0;
	            bytes.push(0xcf, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
	            return 9;
	        }
	        else {
	            // negative fixnum
	            if (value >= -0x20) {
	                bytes.push(value);
	                return 1;
	            }
	            // int 8
	            if (value >= -0x80) {
	                bytes.push(0xd0, value);
	                return 2;
	            }
	            // int 16
	            if (value >= -0x8000) {
	                bytes.push(0xd1, value >> 8, value);
	                return 3;
	            }
	            // int 32
	            if (value >= -0x80000000) {
	                bytes.push(0xd2, value >> 24, value >> 16, value >> 8, value);
	                return 5;
	            }
	            // int 64
	            hi = Math.floor(value / Math.pow(2, 32));
	            lo = value >>> 0;
	            bytes.push(0xd3, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
	            return 9;
	        }
	    }
	    if (type === 'object') {
	        // nil
	        if (value === null) {
	            bytes.push(0xc0);
	            return 1;
	        }
	        if (Array.isArray(value)) {
	            length = value.length;
	            // fixarray
	            if (length < 0x10) {
	                bytes.push(length | 0x90);
	                size = 1;
	            }
	            // array 16
	            else if (length < 0x10000) {
	                bytes.push(0xdc, length >> 8, length);
	                size = 3;
	            }
	            // array 32
	            else if (length < 0x100000000) {
	                bytes.push(0xdd, length >> 24, length >> 16, length >> 8, length);
	                size = 5;
	            }
	            else {
	                throw new Error('Array too large');
	            }
	            for (i = 0; i < length; i++) {
	                size += _encode(bytes, defers, value[i]);
	            }
	            return size;
	        }
	        if (value instanceof Date) {
	            var ms = value.getTime();
	            var s = Math.floor(ms / 1e3);
	            var ns = (ms - s * 1e3) * 1e6;
	            if (s >= 0 && ns >= 0 && s <= TIMESTAMP64_MAX_SEC) {
	                if (ns === 0 && s <= TIMESTAMP32_MAX_SEC) {
	                    // timestamp 32
	                    bytes.push(0xd6, 0xff, s >> 24, s >> 16, s >> 8, s);
	                    return 6;
	                }
	                else {
	                    // timestamp 64
	                    hi = s / 0x100000000;
	                    lo = s & 0xffffffff;
	                    bytes.push(0xd7, 0xff, ns >> 22, ns >> 14, ns >> 6, hi, lo >> 24, lo >> 16, lo >> 8, lo);
	                    return 10;
	                }
	            }
	            else {
	                // timestamp 96
	                hi = Math.floor(s / 0x100000000);
	                lo = s >>> 0;
	                bytes.push(0xc7, 0x0c, 0xff, ns >> 24, ns >> 16, ns >> 8, ns, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
	                return 15;
	            }
	        }
	        if (value instanceof ArrayBuffer) {
	            length = value.byteLength;
	            // bin 8
	            if (length < 0x100) {
	                bytes.push(0xc4, length);
	                size = 2;
	            }
	            else 
	            // bin 16
	            if (length < 0x10000) {
	                bytes.push(0xc5, length >> 8, length);
	                size = 3;
	            }
	            else 
	            // bin 32
	            if (length < 0x100000000) {
	                bytes.push(0xc6, length >> 24, length >> 16, length >> 8, length);
	                size = 5;
	            }
	            else {
	                throw new Error('Buffer too large');
	            }
	            defers.push({ _bin: value, _length: length, _offset: bytes.length });
	            return size + length;
	        }
	        if (typeof value.toJSON === 'function') {
	            return _encode(bytes, defers, value.toJSON());
	        }
	        var keys = [], key = '';
	        var allKeys = Object.keys(value);
	        for (i = 0, l = allKeys.length; i < l; i++) {
	            key = allKeys[i];
	            if (value[key] !== undefined && typeof value[key] !== 'function') {
	                keys.push(key);
	            }
	        }
	        length = keys.length;
	        // fixmap
	        if (length < 0x10) {
	            bytes.push(length | 0x80);
	            size = 1;
	        }
	        // map 16
	        else if (length < 0x10000) {
	            bytes.push(0xde, length >> 8, length);
	            size = 3;
	        }
	        // map 32
	        else if (length < 0x100000000) {
	            bytes.push(0xdf, length >> 24, length >> 16, length >> 8, length);
	            size = 5;
	        }
	        else {
	            throw new Error('Object too large');
	        }
	        for (i = 0; i < length; i++) {
	            key = keys[i];
	            size += _encode(bytes, defers, key);
	            size += _encode(bytes, defers, value[key]);
	        }
	        return size;
	    }
	    // false/true
	    if (type === 'boolean') {
	        bytes.push(value ? 0xc3 : 0xc2);
	        return 1;
	    }
	    if (type === 'undefined') {
	        bytes.push(0xc0);
	        return 1;
	    }
	    // custom types like BigInt (typeof value === 'bigint')
	    if (typeof value.toJSON === 'function') {
	        return _encode(bytes, defers, value.toJSON());
	    }
	    throw new Error('Could not encode');
	}
	function encode(value) {
	    var bytes = [];
	    var defers = [];
	    var size = _encode(bytes, defers, value);
	    var buf = new ArrayBuffer(size);
	    var view = new DataView(buf);
	    var deferIndex = 0;
	    var deferWritten = 0;
	    var nextOffset = -1;
	    if (defers.length > 0) {
	        nextOffset = defers[0]._offset;
	    }
	    var defer, deferLength = 0, offset = 0;
	    for (var i = 0, l = bytes.length; i < l; i++) {
	        view.setUint8(deferWritten + i, bytes[i]);
	        if (i + 1 !== nextOffset) {
	            continue;
	        }
	        defer = defers[deferIndex];
	        deferLength = defer._length;
	        offset = deferWritten + nextOffset;
	        if (defer._bin) {
	            var bin = new Uint8Array(defer._bin);
	            for (var j = 0; j < deferLength; j++) {
	                view.setUint8(offset + j, bin[j]);
	            }
	        }
	        else if (defer._str) {
	            utf8Write(view, offset, defer._str);
	        }
	        else if (defer._float !== undefined) {
	            view.setFloat64(offset, defer._float);
	        }
	        deferIndex++;
	        deferWritten += deferLength;
	        if (defers[deferIndex]) {
	            nextOffset = defers[deferIndex]._offset;
	        }
	    }
	    return buf;
	}
	var encode_1 = msgpack.encode = encode;

	var colyseus = {exports: {}};

	(function (module, exports) {
		// colyseus.js@0.15.17 (@colyseus/schema 2.0.9)
		(function (global, factory) {
		    factory(exports) ;
		})(commonjsGlobal, (function (exports) {
		    function _mergeNamespaces(n, m) {
		        m.forEach(function (e) {
		            e && typeof e !== 'string' && !Array.isArray(e) && Object.keys(e).forEach(function (k) {
		                if (k !== 'default' && !(k in n)) {
		                    var d = Object.getOwnPropertyDescriptor(e, k);
		                    Object.defineProperty(n, k, d.get ? d : {
		                        enumerable: true,
		                        get: function () { return e[k]; }
		                    });
		                }
		            });
		        });
		        return Object.freeze(n);
		    }

		    //
		    // Polyfills for legacy environments
		    //
		    /*
		     * Support Android 4.4.x
		     */
		    if (!ArrayBuffer.isView) {
		        ArrayBuffer.isView = function (a) {
		            return a !== null && typeof (a) === 'object' && a.buffer instanceof ArrayBuffer;
		        };
		    }
		    // Define globalThis if not available.
		    // https://github.com/colyseus/colyseus.js/issues/86
		    if (typeof (globalThis) === "undefined" &&
		        typeof (window) !== "undefined") {
		        // @ts-ignore
		        window['globalThis'] = window;
		    }

		    /******************************************************************************
		    Copyright (c) Microsoft Corporation.

		    Permission to use, copy, modify, and/or distribute this software for any
		    purpose with or without fee is hereby granted.

		    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
		    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
		    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
		    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
		    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
		    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
		    PERFORMANCE OF THIS SOFTWARE.
		    ***************************************************************************** */
		    /* global Reflect, Promise */

		    var extendStatics = function(d, b) {
		        extendStatics = Object.setPrototypeOf ||
		            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
		            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
		        return extendStatics(d, b);
		    };

		    function __extends(d, b) {
		        if (typeof b !== "function" && b !== null)
		            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
		        extendStatics(d, b);
		        function __() { this.constructor = d; }
		        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
		    }

		    var __assign = function() {
		        __assign = Object.assign || function __assign(t) {
		            for (var s, i = 1, n = arguments.length; i < n; i++) {
		                s = arguments[i];
		                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
		            }
		            return t;
		        };
		        return __assign.apply(this, arguments);
		    };

		    function __awaiter(thisArg, _arguments, P, generator) {
		        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
		        return new (P || (P = Promise))(function (resolve, reject) {
		            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
		            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
		            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
		            step((generator = generator.apply(thisArg, _arguments || [])).next());
		        });
		    }

		    function __generator(thisArg, body) {
		        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
		        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
		        function verb(n) { return function (v) { return step([n, v]); }; }
		        function step(op) {
		            if (f) throw new TypeError("Generator is already executing.");
		            while (g && (g = 0, op[0] && (_ = 0)), _) try {
		                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
		                if (y = 0, t) op = [op[0] & 2, t.value];
		                switch (op[0]) {
		                    case 0: case 1: t = op; break;
		                    case 4: _.label++; return { value: op[1], done: false };
		                    case 5: _.label++; y = op[1]; op = [0]; continue;
		                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
		                    default:
		                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
		                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
		                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
		                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
		                        if (t[2]) _.ops.pop();
		                        _.trys.pop(); continue;
		                }
		                op = body.call(thisArg, _);
		            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
		            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
		        }
		    }

		    function __classPrivateFieldGet(receiver, state, kind, f) {
		        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
		        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
		        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
		    }

		    function __classPrivateFieldSet(receiver, state, value, kind, f) {
		        if (kind === "m") throw new TypeError("Private method is not writable");
		        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
		        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
		        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
		    }

		    var CloseCode;
		    (function (CloseCode) {
		        CloseCode[CloseCode["CONSENTED"] = 4000] = "CONSENTED";
		        CloseCode[CloseCode["DEVMODE_RESTART"] = 4010] = "DEVMODE_RESTART";
		    })(CloseCode || (CloseCode = {}));
		    var ServerError = /** @class */ (function (_super) {
		        __extends(ServerError, _super);
		        function ServerError(code, message) {
		            var _this = _super.call(this, message) || this;
		            _this.name = "ServerError";
		            _this.code = code;
		            return _this;
		        }
		        return ServerError;
		    }(Error));

		    /**
		     * Copyright (c) 2014 Ion Drive Software Ltd.
		     * https://github.com/darrachequesne/notepack/
		     *
		     * Permission is hereby granted, free of charge, to any person obtaining a copy
		     * of this software and associated documentation files (the "Software"), to deal
		     * in the Software without restriction, including without limitation the rights
		     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
		     * copies of the Software, and to permit persons to whom the Software is
		     * furnished to do so, subject to the following conditions:
		     *
		     * The above copyright notice and this permission notice shall be included in all
		     * copies or substantial portions of the Software.
		     *
		     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
		     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
		     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
		     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
		     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
		     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
		     * SOFTWARE.
		     */
		    /**
		     * Patch for Colyseus:
		     * -------------------
		     * notepack.io@3.0.1
		     *
		     * added `offset` on Decoder constructor, for messages arriving with a code
		     * before actual msgpack data
		     */
		    //
		    // DECODER
		    //
		    function Decoder(buffer, offset) {
		        this._offset = offset;
		        if (buffer instanceof ArrayBuffer) {
		            this._buffer = buffer;
		            this._view = new DataView(this._buffer);
		        }
		        else if (ArrayBuffer.isView(buffer)) {
		            this._buffer = buffer.buffer;
		            this._view = new DataView(this._buffer, buffer.byteOffset, buffer.byteLength);
		        }
		        else {
		            throw new Error('Invalid argument');
		        }
		    }
		    function utf8Read$1(view, offset, length) {
		        var string = '', chr = 0;
		        for (var i = offset, end = offset + length; i < end; i++) {
		            var byte = view.getUint8(i);
		            if ((byte & 0x80) === 0x00) {
		                string += String.fromCharCode(byte);
		                continue;
		            }
		            if ((byte & 0xe0) === 0xc0) {
		                string += String.fromCharCode(((byte & 0x1f) << 6) |
		                    (view.getUint8(++i) & 0x3f));
		                continue;
		            }
		            if ((byte & 0xf0) === 0xe0) {
		                string += String.fromCharCode(((byte & 0x0f) << 12) |
		                    ((view.getUint8(++i) & 0x3f) << 6) |
		                    ((view.getUint8(++i) & 0x3f) << 0));
		                continue;
		            }
		            if ((byte & 0xf8) === 0xf0) {
		                chr = ((byte & 0x07) << 18) |
		                    ((view.getUint8(++i) & 0x3f) << 12) |
		                    ((view.getUint8(++i) & 0x3f) << 6) |
		                    ((view.getUint8(++i) & 0x3f) << 0);
		                if (chr >= 0x010000) { // surrogate pair
		                    chr -= 0x010000;
		                    string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
		                }
		                else {
		                    string += String.fromCharCode(chr);
		                }
		                continue;
		            }
		            throw new Error('Invalid byte ' + byte.toString(16));
		        }
		        return string;
		    }
		    Decoder.prototype._array = function (length) {
		        var value = new Array(length);
		        for (var i = 0; i < length; i++) {
		            value[i] = this._parse();
		        }
		        return value;
		    };
		    Decoder.prototype._map = function (length) {
		        var key = '', value = {};
		        for (var i = 0; i < length; i++) {
		            key = this._parse();
		            value[key] = this._parse();
		        }
		        return value;
		    };
		    Decoder.prototype._str = function (length) {
		        var value = utf8Read$1(this._view, this._offset, length);
		        this._offset += length;
		        return value;
		    };
		    Decoder.prototype._bin = function (length) {
		        var value = this._buffer.slice(this._offset, this._offset + length);
		        this._offset += length;
		        return value;
		    };
		    Decoder.prototype._parse = function () {
		        var prefix = this._view.getUint8(this._offset++);
		        var value, length = 0, type = 0, hi = 0, lo = 0;
		        if (prefix < 0xc0) {
		            // positive fixint
		            if (prefix < 0x80) {
		                return prefix;
		            }
		            // fixmap
		            if (prefix < 0x90) {
		                return this._map(prefix & 0x0f);
		            }
		            // fixarray
		            if (prefix < 0xa0) {
		                return this._array(prefix & 0x0f);
		            }
		            // fixstr
		            return this._str(prefix & 0x1f);
		        }
		        // negative fixint
		        if (prefix > 0xdf) {
		            return (0xff - prefix + 1) * -1;
		        }
		        switch (prefix) {
		            // nil
		            case 0xc0:
		                return null;
		            // false
		            case 0xc2:
		                return false;
		            // true
		            case 0xc3:
		                return true;
		            // bin
		            case 0xc4:
		                length = this._view.getUint8(this._offset);
		                this._offset += 1;
		                return this._bin(length);
		            case 0xc5:
		                length = this._view.getUint16(this._offset);
		                this._offset += 2;
		                return this._bin(length);
		            case 0xc6:
		                length = this._view.getUint32(this._offset);
		                this._offset += 4;
		                return this._bin(length);
		            // ext
		            case 0xc7:
		                length = this._view.getUint8(this._offset);
		                type = this._view.getInt8(this._offset + 1);
		                this._offset += 2;
		                if (type === -1) {
		                    // timestamp 96
		                    var ns = this._view.getUint32(this._offset);
		                    hi = this._view.getInt32(this._offset + 4);
		                    lo = this._view.getUint32(this._offset + 8);
		                    this._offset += 12;
		                    return new Date((hi * 0x100000000 + lo) * 1e3 + ns / 1e6);
		                }
		                return [type, this._bin(length)];
		            case 0xc8:
		                length = this._view.getUint16(this._offset);
		                type = this._view.getInt8(this._offset + 2);
		                this._offset += 3;
		                return [type, this._bin(length)];
		            case 0xc9:
		                length = this._view.getUint32(this._offset);
		                type = this._view.getInt8(this._offset + 4);
		                this._offset += 5;
		                return [type, this._bin(length)];
		            // float
		            case 0xca:
		                value = this._view.getFloat32(this._offset);
		                this._offset += 4;
		                return value;
		            case 0xcb:
		                value = this._view.getFloat64(this._offset);
		                this._offset += 8;
		                return value;
		            // uint
		            case 0xcc:
		                value = this._view.getUint8(this._offset);
		                this._offset += 1;
		                return value;
		            case 0xcd:
		                value = this._view.getUint16(this._offset);
		                this._offset += 2;
		                return value;
		            case 0xce:
		                value = this._view.getUint32(this._offset);
		                this._offset += 4;
		                return value;
		            case 0xcf:
		                hi = this._view.getUint32(this._offset) * Math.pow(2, 32);
		                lo = this._view.getUint32(this._offset + 4);
		                this._offset += 8;
		                return hi + lo;
		            // int
		            case 0xd0:
		                value = this._view.getInt8(this._offset);
		                this._offset += 1;
		                return value;
		            case 0xd1:
		                value = this._view.getInt16(this._offset);
		                this._offset += 2;
		                return value;
		            case 0xd2:
		                value = this._view.getInt32(this._offset);
		                this._offset += 4;
		                return value;
		            case 0xd3:
		                hi = this._view.getInt32(this._offset) * Math.pow(2, 32);
		                lo = this._view.getUint32(this._offset + 4);
		                this._offset += 8;
		                return hi + lo;
		            // fixext
		            case 0xd4:
		                type = this._view.getInt8(this._offset);
		                this._offset += 1;
		                if (type === 0x00) {
		                    // custom encoding for 'undefined' (kept for backward-compatibility)
		                    this._offset += 1;
		                    return void 0;
		                }
		                return [type, this._bin(1)];
		            case 0xd5:
		                type = this._view.getInt8(this._offset);
		                this._offset += 1;
		                return [type, this._bin(2)];
		            case 0xd6:
		                type = this._view.getInt8(this._offset);
		                this._offset += 1;
		                if (type === -1) {
		                    // timestamp 32
		                    value = this._view.getUint32(this._offset);
		                    this._offset += 4;
		                    return new Date(value * 1e3);
		                }
		                return [type, this._bin(4)];
		            case 0xd7:
		                type = this._view.getInt8(this._offset);
		                this._offset += 1;
		                if (type === 0x00) {
		                    // custom date encoding (kept for backward-compatibility)
		                    hi = this._view.getInt32(this._offset) * Math.pow(2, 32);
		                    lo = this._view.getUint32(this._offset + 4);
		                    this._offset += 8;
		                    return new Date(hi + lo);
		                }
		                if (type === -1) {
		                    // timestamp 64
		                    hi = this._view.getUint32(this._offset);
		                    lo = this._view.getUint32(this._offset + 4);
		                    this._offset += 8;
		                    var s = (hi & 0x3) * 0x100000000 + lo;
		                    return new Date(s * 1e3 + (hi >>> 2) / 1e6);
		                }
		                return [type, this._bin(8)];
		            case 0xd8:
		                type = this._view.getInt8(this._offset);
		                this._offset += 1;
		                return [type, this._bin(16)];
		            // str
		            case 0xd9:
		                length = this._view.getUint8(this._offset);
		                this._offset += 1;
		                return this._str(length);
		            case 0xda:
		                length = this._view.getUint16(this._offset);
		                this._offset += 2;
		                return this._str(length);
		            case 0xdb:
		                length = this._view.getUint32(this._offset);
		                this._offset += 4;
		                return this._str(length);
		            // array
		            case 0xdc:
		                length = this._view.getUint16(this._offset);
		                this._offset += 2;
		                return this._array(length);
		            case 0xdd:
		                length = this._view.getUint32(this._offset);
		                this._offset += 4;
		                return this._array(length);
		            // map
		            case 0xde:
		                length = this._view.getUint16(this._offset);
		                this._offset += 2;
		                return this._map(length);
		            case 0xdf:
		                length = this._view.getUint32(this._offset);
		                this._offset += 4;
		                return this._map(length);
		        }
		        throw new Error('Could not parse');
		    };
		    function decode(buffer, offset) {
		        if (offset === void 0) { offset = 0; }
		        var decoder = new Decoder(buffer, offset);
		        var value = decoder._parse();
		        if (decoder._offset !== buffer.byteLength) {
		            throw new Error((buffer.byteLength - decoder._offset) + ' trailing bytes');
		        }
		        return value;
		    }
		    //
		    // ENCODER
		    //
		    var TIMESTAMP32_MAX_SEC = 0x100000000 - 1; // 32-bit unsigned int
		    var TIMESTAMP64_MAX_SEC = 0x400000000 - 1; // 34-bit unsigned int
		    function utf8Write(view, offset, str) {
		        var c = 0;
		        for (var i = 0, l = str.length; i < l; i++) {
		            c = str.charCodeAt(i);
		            if (c < 0x80) {
		                view.setUint8(offset++, c);
		            }
		            else if (c < 0x800) {
		                view.setUint8(offset++, 0xc0 | (c >> 6));
		                view.setUint8(offset++, 0x80 | (c & 0x3f));
		            }
		            else if (c < 0xd800 || c >= 0xe000) {
		                view.setUint8(offset++, 0xe0 | (c >> 12));
		                view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
		                view.setUint8(offset++, 0x80 | (c & 0x3f));
		            }
		            else {
		                i++;
		                c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
		                view.setUint8(offset++, 0xf0 | (c >> 18));
		                view.setUint8(offset++, 0x80 | (c >> 12) & 0x3f);
		                view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
		                view.setUint8(offset++, 0x80 | (c & 0x3f));
		            }
		        }
		    }
		    function utf8Length$1(str) {
		        var c = 0, length = 0;
		        for (var i = 0, l = str.length; i < l; i++) {
		            c = str.charCodeAt(i);
		            if (c < 0x80) {
		                length += 1;
		            }
		            else if (c < 0x800) {
		                length += 2;
		            }
		            else if (c < 0xd800 || c >= 0xe000) {
		                length += 3;
		            }
		            else {
		                i++;
		                length += 4;
		            }
		        }
		        return length;
		    }
		    function _encode(bytes, defers, value) {
		        var type = typeof value, i = 0, l = 0, hi = 0, lo = 0, length = 0, size = 0;
		        if (type === 'string') {
		            length = utf8Length$1(value);
		            // fixstr
		            if (length < 0x20) {
		                bytes.push(length | 0xa0);
		                size = 1;
		            }
		            // str 8
		            else if (length < 0x100) {
		                bytes.push(0xd9, length);
		                size = 2;
		            }
		            // str 16
		            else if (length < 0x10000) {
		                bytes.push(0xda, length >> 8, length);
		                size = 3;
		            }
		            // str 32
		            else if (length < 0x100000000) {
		                bytes.push(0xdb, length >> 24, length >> 16, length >> 8, length);
		                size = 5;
		            }
		            else {
		                throw new Error('String too long');
		            }
		            defers.push({ _str: value, _length: length, _offset: bytes.length });
		            return size + length;
		        }
		        if (type === 'number') {
		            // TODO: encode to float 32?
		            // float 64
		            if (Math.floor(value) !== value || !isFinite(value)) {
		                bytes.push(0xcb);
		                defers.push({ _float: value, _length: 8, _offset: bytes.length });
		                return 9;
		            }
		            if (value >= 0) {
		                // positive fixnum
		                if (value < 0x80) {
		                    bytes.push(value);
		                    return 1;
		                }
		                // uint 8
		                if (value < 0x100) {
		                    bytes.push(0xcc, value);
		                    return 2;
		                }
		                // uint 16
		                if (value < 0x10000) {
		                    bytes.push(0xcd, value >> 8, value);
		                    return 3;
		                }
		                // uint 32
		                if (value < 0x100000000) {
		                    bytes.push(0xce, value >> 24, value >> 16, value >> 8, value);
		                    return 5;
		                }
		                // uint 64
		                hi = (value / Math.pow(2, 32)) >> 0;
		                lo = value >>> 0;
		                bytes.push(0xcf, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
		                return 9;
		            }
		            else {
		                // negative fixnum
		                if (value >= -0x20) {
		                    bytes.push(value);
		                    return 1;
		                }
		                // int 8
		                if (value >= -0x80) {
		                    bytes.push(0xd0, value);
		                    return 2;
		                }
		                // int 16
		                if (value >= -0x8000) {
		                    bytes.push(0xd1, value >> 8, value);
		                    return 3;
		                }
		                // int 32
		                if (value >= -0x80000000) {
		                    bytes.push(0xd2, value >> 24, value >> 16, value >> 8, value);
		                    return 5;
		                }
		                // int 64
		                hi = Math.floor(value / Math.pow(2, 32));
		                lo = value >>> 0;
		                bytes.push(0xd3, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
		                return 9;
		            }
		        }
		        if (type === 'object') {
		            // nil
		            if (value === null) {
		                bytes.push(0xc0);
		                return 1;
		            }
		            if (Array.isArray(value)) {
		                length = value.length;
		                // fixarray
		                if (length < 0x10) {
		                    bytes.push(length | 0x90);
		                    size = 1;
		                }
		                // array 16
		                else if (length < 0x10000) {
		                    bytes.push(0xdc, length >> 8, length);
		                    size = 3;
		                }
		                // array 32
		                else if (length < 0x100000000) {
		                    bytes.push(0xdd, length >> 24, length >> 16, length >> 8, length);
		                    size = 5;
		                }
		                else {
		                    throw new Error('Array too large');
		                }
		                for (i = 0; i < length; i++) {
		                    size += _encode(bytes, defers, value[i]);
		                }
		                return size;
		            }
		            if (value instanceof Date) {
		                var ms = value.getTime();
		                var s = Math.floor(ms / 1e3);
		                var ns = (ms - s * 1e3) * 1e6;
		                if (s >= 0 && ns >= 0 && s <= TIMESTAMP64_MAX_SEC) {
		                    if (ns === 0 && s <= TIMESTAMP32_MAX_SEC) {
		                        // timestamp 32
		                        bytes.push(0xd6, 0xff, s >> 24, s >> 16, s >> 8, s);
		                        return 6;
		                    }
		                    else {
		                        // timestamp 64
		                        hi = s / 0x100000000;
		                        lo = s & 0xffffffff;
		                        bytes.push(0xd7, 0xff, ns >> 22, ns >> 14, ns >> 6, hi, lo >> 24, lo >> 16, lo >> 8, lo);
		                        return 10;
		                    }
		                }
		                else {
		                    // timestamp 96
		                    hi = Math.floor(s / 0x100000000);
		                    lo = s >>> 0;
		                    bytes.push(0xc7, 0x0c, 0xff, ns >> 24, ns >> 16, ns >> 8, ns, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
		                    return 15;
		                }
		            }
		            if (value instanceof ArrayBuffer) {
		                length = value.byteLength;
		                // bin 8
		                if (length < 0x100) {
		                    bytes.push(0xc4, length);
		                    size = 2;
		                }
		                else 
		                // bin 16
		                if (length < 0x10000) {
		                    bytes.push(0xc5, length >> 8, length);
		                    size = 3;
		                }
		                else 
		                // bin 32
		                if (length < 0x100000000) {
		                    bytes.push(0xc6, length >> 24, length >> 16, length >> 8, length);
		                    size = 5;
		                }
		                else {
		                    throw new Error('Buffer too large');
		                }
		                defers.push({ _bin: value, _length: length, _offset: bytes.length });
		                return size + length;
		            }
		            if (typeof value.toJSON === 'function') {
		                return _encode(bytes, defers, value.toJSON());
		            }
		            var keys = [], key = '';
		            var allKeys = Object.keys(value);
		            for (i = 0, l = allKeys.length; i < l; i++) {
		                key = allKeys[i];
		                if (value[key] !== undefined && typeof value[key] !== 'function') {
		                    keys.push(key);
		                }
		            }
		            length = keys.length;
		            // fixmap
		            if (length < 0x10) {
		                bytes.push(length | 0x80);
		                size = 1;
		            }
		            // map 16
		            else if (length < 0x10000) {
		                bytes.push(0xde, length >> 8, length);
		                size = 3;
		            }
		            // map 32
		            else if (length < 0x100000000) {
		                bytes.push(0xdf, length >> 24, length >> 16, length >> 8, length);
		                size = 5;
		            }
		            else {
		                throw new Error('Object too large');
		            }
		            for (i = 0; i < length; i++) {
		                key = keys[i];
		                size += _encode(bytes, defers, key);
		                size += _encode(bytes, defers, value[key]);
		            }
		            return size;
		        }
		        // false/true
		        if (type === 'boolean') {
		            bytes.push(value ? 0xc3 : 0xc2);
		            return 1;
		        }
		        if (type === 'undefined') {
		            bytes.push(0xc0);
		            return 1;
		        }
		        // custom types like BigInt (typeof value === 'bigint')
		        if (typeof value.toJSON === 'function') {
		            return _encode(bytes, defers, value.toJSON());
		        }
		        throw new Error('Could not encode');
		    }
		    function encode(value) {
		        var bytes = [];
		        var defers = [];
		        var size = _encode(bytes, defers, value);
		        var buf = new ArrayBuffer(size);
		        var view = new DataView(buf);
		        var deferIndex = 0;
		        var deferWritten = 0;
		        var nextOffset = -1;
		        if (defers.length > 0) {
		            nextOffset = defers[0]._offset;
		        }
		        var defer, deferLength = 0, offset = 0;
		        for (var i = 0, l = bytes.length; i < l; i++) {
		            view.setUint8(deferWritten + i, bytes[i]);
		            if (i + 1 !== nextOffset) {
		                continue;
		            }
		            defer = defers[deferIndex];
		            deferLength = defer._length;
		            offset = deferWritten + nextOffset;
		            if (defer._bin) {
		                var bin = new Uint8Array(defer._bin);
		                for (var j = 0; j < deferLength; j++) {
		                    view.setUint8(offset + j, bin[j]);
		                }
		            }
		            else if (defer._str) {
		                utf8Write(view, offset, defer._str);
		            }
		            else if (defer._float !== undefined) {
		                view.setFloat64(offset, defer._float);
		            }
		            deferIndex++;
		            deferWritten += deferLength;
		            if (defers[deferIndex]) {
		                nextOffset = defers[deferIndex]._offset;
		            }
		        }
		        return buf;
		    }

		    var browser = function () {
		      throw new Error(
		        'ws does not work in the browser. Browser clients must use the native ' +
		          'WebSocket object'
		      );
		    };

		    var WebSocket = globalThis.WebSocket || browser;
		    var WebSocketTransport = /** @class */ (function () {
		        function WebSocketTransport(events) {
		            this.events = events;
		        }
		        WebSocketTransport.prototype.send = function (data) {
		            if (data instanceof ArrayBuffer) {
		                this.ws.send(data);
		            }
		            else if (Array.isArray(data)) {
		                this.ws.send((new Uint8Array(data)).buffer);
		            }
		        };
		        WebSocketTransport.prototype.connect = function (url) {
		            this.ws = new WebSocket(url, this.protocols);
		            this.ws.binaryType = 'arraybuffer';
		            this.ws.onopen = this.events.onopen;
		            this.ws.onmessage = this.events.onmessage;
		            this.ws.onclose = this.events.onclose;
		            this.ws.onerror = this.events.onerror;
		        };
		        WebSocketTransport.prototype.close = function (code, reason) {
		            this.ws.close(code, reason);
		        };
		        Object.defineProperty(WebSocketTransport.prototype, "isOpen", {
		            get: function () {
		                return this.ws.readyState === WebSocket.OPEN;
		            },
		            enumerable: false,
		            configurable: true
		        });
		        return WebSocketTransport;
		    }());

		    var Connection = /** @class */ (function () {
		        function Connection() {
		            this.events = {};
		            this.transport = new WebSocketTransport(this.events);
		        }
		        Connection.prototype.send = function (data) {
		            this.transport.send(data);
		        };
		        Connection.prototype.connect = function (url) {
		            this.transport.connect(url);
		        };
		        Connection.prototype.close = function (code, reason) {
		            this.transport.close(code, reason);
		        };
		        Object.defineProperty(Connection.prototype, "isOpen", {
		            get: function () {
		                return this.transport.isOpen;
		            },
		            enumerable: false,
		            configurable: true
		        });
		        return Connection;
		    }());

		    // Use codes between 0~127 for lesser throughput (1 byte)
		    exports.Protocol = void 0;
		    (function (Protocol) {
		        // Room-related (10~19)
		        Protocol[Protocol["HANDSHAKE"] = 9] = "HANDSHAKE";
		        Protocol[Protocol["JOIN_ROOM"] = 10] = "JOIN_ROOM";
		        Protocol[Protocol["ERROR"] = 11] = "ERROR";
		        Protocol[Protocol["LEAVE_ROOM"] = 12] = "LEAVE_ROOM";
		        Protocol[Protocol["ROOM_DATA"] = 13] = "ROOM_DATA";
		        Protocol[Protocol["ROOM_STATE"] = 14] = "ROOM_STATE";
		        Protocol[Protocol["ROOM_STATE_PATCH"] = 15] = "ROOM_STATE_PATCH";
		        Protocol[Protocol["ROOM_DATA_SCHEMA"] = 16] = "ROOM_DATA_SCHEMA";
		        Protocol[Protocol["ROOM_DATA_BYTES"] = 17] = "ROOM_DATA_BYTES";
		    })(exports.Protocol || (exports.Protocol = {}));
		    exports.ErrorCode = void 0;
		    (function (ErrorCode) {
		        ErrorCode[ErrorCode["MATCHMAKE_NO_HANDLER"] = 4210] = "MATCHMAKE_NO_HANDLER";
		        ErrorCode[ErrorCode["MATCHMAKE_INVALID_CRITERIA"] = 4211] = "MATCHMAKE_INVALID_CRITERIA";
		        ErrorCode[ErrorCode["MATCHMAKE_INVALID_ROOM_ID"] = 4212] = "MATCHMAKE_INVALID_ROOM_ID";
		        ErrorCode[ErrorCode["MATCHMAKE_UNHANDLED"] = 4213] = "MATCHMAKE_UNHANDLED";
		        ErrorCode[ErrorCode["MATCHMAKE_EXPIRED"] = 4214] = "MATCHMAKE_EXPIRED";
		        ErrorCode[ErrorCode["AUTH_FAILED"] = 4215] = "AUTH_FAILED";
		        ErrorCode[ErrorCode["APPLICATION_ERROR"] = 4216] = "APPLICATION_ERROR";
		    })(exports.ErrorCode || (exports.ErrorCode = {}));
		    function utf8Read(view, offset) {
		        var length = view[offset++];
		        var string = '', chr = 0;
		        for (var i = offset, end = offset + length; i < end; i++) {
		            var byte = view[i];
		            if ((byte & 0x80) === 0x00) {
		                string += String.fromCharCode(byte);
		                continue;
		            }
		            if ((byte & 0xe0) === 0xc0) {
		                string += String.fromCharCode(((byte & 0x1f) << 6) |
		                    (view[++i] & 0x3f));
		                continue;
		            }
		            if ((byte & 0xf0) === 0xe0) {
		                string += String.fromCharCode(((byte & 0x0f) << 12) |
		                    ((view[++i] & 0x3f) << 6) |
		                    ((view[++i] & 0x3f) << 0));
		                continue;
		            }
		            if ((byte & 0xf8) === 0xf0) {
		                chr = ((byte & 0x07) << 18) |
		                    ((view[++i] & 0x3f) << 12) |
		                    ((view[++i] & 0x3f) << 6) |
		                    ((view[++i] & 0x3f) << 0);
		                if (chr >= 0x010000) { // surrogate pair
		                    chr -= 0x010000;
		                    string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
		                }
		                else {
		                    string += String.fromCharCode(chr);
		                }
		                continue;
		            }
		            throw new Error('Invalid byte ' + byte.toString(16));
		        }
		        return string;
		    }
		    // Faster for short strings than Buffer.byteLength
		    function utf8Length(str) {
		        if (str === void 0) { str = ''; }
		        var c = 0;
		        var length = 0;
		        for (var i = 0, l = str.length; i < l; i++) {
		            c = str.charCodeAt(i);
		            if (c < 0x80) {
		                length += 1;
		            }
		            else if (c < 0x800) {
		                length += 2;
		            }
		            else if (c < 0xd800 || c >= 0xe000) {
		                length += 3;
		            }
		            else {
		                i++;
		                length += 4;
		            }
		        }
		        return length + 1;
		    }

		    var serializers = {};
		    function registerSerializer(id, serializer) {
		        serializers[id] = serializer;
		    }
		    function getSerializer(id) {
		        var serializer = serializers[id];
		        if (!serializer) {
		            throw new Error("missing serializer: " + id);
		        }
		        return serializer;
		    }

		    /**
		     * The MIT License (MIT)
		     *
		     * Copyright 2016 Andrey Sitnik <andrey@sitnik.ru>
		     *
		     * Permission is hereby granted, free of charge, to any person obtaining a copy of
		     * this software and associated documentation files (the "Software"), to deal in
		     * the Software without restriction, including without limitation the rights to
		     * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
		     * the Software, and to permit persons to whom the Software is furnished to do so,
		     * subject to the following conditions:
		     *
		     * The above copyright notice and this permission notice shall be included in all
		     * copies or substantial portions of the Software.
		     *
		     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
		     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
		     * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
		     * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
		     * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
		     * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
		     */
		    var createNanoEvents = function () { return ({
		        emit: function (event) {
		            var args = [];
		            for (var _i = 1; _i < arguments.length; _i++) {
		                args[_i - 1] = arguments[_i];
		            }
		            var callbacks = this.events[event] || [];
		            for (var i = 0, length_1 = callbacks.length; i < length_1; i++) {
		                callbacks[i].apply(callbacks, args);
		            }
		        },
		        events: {},
		        on: function (event, cb) {
		            var _this = this;
		            var _a;
		            ((_a = this.events[event]) === null || _a === void 0 ? void 0 : _a.push(cb)) || (this.events[event] = [cb]);
		            return function () {
		                var _a;
		                _this.events[event] = (_a = _this.events[event]) === null || _a === void 0 ? void 0 : _a.filter(function (i) { return cb !== i; });
		            };
		        }
		    }); };

		    var EventEmitter = /** @class */ (function () {
		        function EventEmitter() {
		            this.handlers = [];
		        }
		        EventEmitter.prototype.register = function (cb, once) {
		            this.handlers.push(cb);
		            return this;
		        };
		        EventEmitter.prototype.invoke = function () {
		            var _this = this;
		            var args = [];
		            for (var _i = 0; _i < arguments.length; _i++) {
		                args[_i] = arguments[_i];
		            }
		            this.handlers.forEach(function (handler) { return handler.apply(_this, args); });
		        };
		        EventEmitter.prototype.invokeAsync = function () {
		            var _this = this;
		            var args = [];
		            for (var _i = 0; _i < arguments.length; _i++) {
		                args[_i] = arguments[_i];
		            }
		            return Promise.all(this.handlers.map(function (handler) { return handler.apply(_this, args); }));
		        };
		        EventEmitter.prototype.remove = function (cb) {
		            var index = this.handlers.indexOf(cb);
		            this.handlers[index] = this.handlers[this.handlers.length - 1];
		            this.handlers.pop();
		        };
		        EventEmitter.prototype.clear = function () {
		            this.handlers = [];
		        };
		        return EventEmitter;
		    }());
		    function createSignal() {
		        var emitter = new EventEmitter();
		        function register(cb) {
		            return emitter.register(cb, this === null);
		        }
		        register.once = function (cb) {
		            var callback = function () {
		                var args = [];
		                for (var _i = 0; _i < arguments.length; _i++) {
		                    args[_i] = arguments[_i];
		                }
		                cb.apply(this, args);
		                emitter.remove(callback);
		            };
		            emitter.register(callback);
		        };
		        register.remove = function (cb) { return emitter.remove(cb); };
		        register.invoke = function () {
		            var args = [];
		            for (var _i = 0; _i < arguments.length; _i++) {
		                args[_i] = arguments[_i];
		            }
		            return emitter.invoke.apply(emitter, args);
		        };
		        register.invokeAsync = function () {
		            var args = [];
		            for (var _i = 0; _i < arguments.length; _i++) {
		                args[_i] = arguments[_i];
		            }
		            return emitter.invokeAsync.apply(emitter, args);
		        };
		        register.clear = function () { return emitter.clear(); };
		        return register;
		    }

		    var commonjsGlobal$1 = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof commonjsGlobal !== 'undefined' ? commonjsGlobal : typeof self !== 'undefined' ? self : {};

		    function createCommonjsModule(fn) {
		      var module = { exports: {} };
		    	return fn(module, module.exports), module.exports;
		    }

		    var umd = createCommonjsModule(function (module, exports) {
		    (function (global, factory) {
		        factory(exports) ;
		    })(commonjsGlobal$1, (function (exports) {
		        /******************************************************************************
		        Copyright (c) Microsoft Corporation.

		        Permission to use, copy, modify, and/or distribute this software for any
		        purpose with or without fee is hereby granted.

		        THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
		        REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
		        AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
		        INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
		        LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
		        OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
		        PERFORMANCE OF THIS SOFTWARE.
		        ***************************************************************************** */
		        /* global Reflect, Promise */

		        var extendStatics = function(d, b) {
		            extendStatics = Object.setPrototypeOf ||
		                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
		                function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
		            return extendStatics(d, b);
		        };

		        function __extends(d, b) {
		            if (typeof b !== "function" && b !== null)
		                throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
		            extendStatics(d, b);
		            function __() { this.constructor = d; }
		            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
		        }

		        function __decorate(decorators, target, key, desc) {
		            var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		            if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		            else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		            return c > 3 && r && Object.defineProperty(target, key, r), r;
		        }

		        function __spreadArray(to, from, pack) {
		            if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
		                if (ar || !(i in from)) {
		                    if (!ar) ar = Array.prototype.slice.call(from, 0, i);
		                    ar[i] = from[i];
		                }
		            }
		            return to.concat(ar || Array.prototype.slice.call(from));
		        }

		        // export const SWITCH_TO_STRUCTURE = 193; (easily collides with DELETE_AND_ADD + fieldIndex = 2)
		        var SWITCH_TO_STRUCTURE = 255; // (decoding collides with DELETE_AND_ADD + fieldIndex = 63)
		        var TYPE_ID = 213;
		        /**
		         * Encoding Schema field operations.
		         */
		        exports.OPERATION = void 0;
		        (function (OPERATION) {
		            // add new structure/primitive
		            OPERATION[OPERATION["ADD"] = 128] = "ADD";
		            // replace structure/primitive
		            OPERATION[OPERATION["REPLACE"] = 0] = "REPLACE";
		            // delete field
		            OPERATION[OPERATION["DELETE"] = 64] = "DELETE";
		            // DELETE field, followed by an ADD
		            OPERATION[OPERATION["DELETE_AND_ADD"] = 192] = "DELETE_AND_ADD";
		            // TOUCH is used to determine hierarchy of nested Schema structures during serialization.
		            // touches are NOT encoded.
		            OPERATION[OPERATION["TOUCH"] = 1] = "TOUCH";
		            // MapSchema Operations
		            OPERATION[OPERATION["CLEAR"] = 10] = "CLEAR";
		        })(exports.OPERATION || (exports.OPERATION = {}));
		        // export enum OPERATION {
		        //     // add new structure/primitive
		        //     // (128)
		        //     ADD = 128, // 10000000,
		        //     // replace structure/primitive
		        //     REPLACE = 1,// 00000001
		        //     // delete field
		        //     DELETE = 192, // 11000000
		        //     // DELETE field, followed by an ADD
		        //     DELETE_AND_ADD = 224, // 11100000
		        //     // TOUCH is used to determine hierarchy of nested Schema structures during serialization.
		        //     // touches are NOT encoded.
		        //     TOUCH = 0, // 00000000
		        //     // MapSchema Operations
		        //     CLEAR = 10,
		        // }

		        var ChangeTree = /** @class */ (function () {
		            function ChangeTree(ref, parent, root) {
		                this.changed = false;
		                this.changes = new Map();
		                this.allChanges = new Set();
		                // cached indexes for filtering
		                this.caches = {};
		                this.currentCustomOperation = 0;
		                this.ref = ref;
		                this.setParent(parent, root);
		            }
		            ChangeTree.prototype.setParent = function (parent, root, parentIndex) {
		                var _this = this;
		                if (!this.indexes) {
		                    this.indexes = (this.ref instanceof Schema)
		                        ? this.ref['_definition'].indexes
		                        : {};
		                }
		                this.parent = parent;
		                this.parentIndex = parentIndex;
		                // avoid setting parents with empty `root`
		                if (!root) {
		                    return;
		                }
		                this.root = root;
		                //
		                // assign same parent on child structures
		                //
		                if (this.ref instanceof Schema) {
		                    var definition = this.ref['_definition'];
		                    for (var field in definition.schema) {
		                        var value = this.ref[field];
		                        if (value && value['$changes']) {
		                            var parentIndex_1 = definition.indexes[field];
		                            value['$changes'].setParent(this.ref, root, parentIndex_1);
		                        }
		                    }
		                }
		                else if (typeof (this.ref) === "object") {
		                    this.ref.forEach(function (value, key) {
		                        if (value instanceof Schema) {
		                            var changeTreee = value['$changes'];
		                            var parentIndex_2 = _this.ref['$changes'].indexes[key];
		                            changeTreee.setParent(_this.ref, _this.root, parentIndex_2);
		                        }
		                    });
		                }
		            };
		            ChangeTree.prototype.operation = function (op) {
		                this.changes.set(--this.currentCustomOperation, op);
		            };
		            ChangeTree.prototype.change = function (fieldName, operation) {
		                if (operation === void 0) { operation = exports.OPERATION.ADD; }
		                var index = (typeof (fieldName) === "number")
		                    ? fieldName
		                    : this.indexes[fieldName];
		                this.assertValidIndex(index, fieldName);
		                var previousChange = this.changes.get(index);
		                if (!previousChange ||
		                    previousChange.op === exports.OPERATION.DELETE ||
		                    previousChange.op === exports.OPERATION.TOUCH // (mazmorra.io's BattleAction issue)
		                ) {
		                    this.changes.set(index, {
		                        op: (!previousChange)
		                            ? operation
		                            : (previousChange.op === exports.OPERATION.DELETE)
		                                ? exports.OPERATION.DELETE_AND_ADD
		                                : operation,
		                        // : OPERATION.REPLACE,
		                        index: index
		                    });
		                }
		                this.allChanges.add(index);
		                this.changed = true;
		                this.touchParents();
		            };
		            ChangeTree.prototype.touch = function (fieldName) {
		                var index = (typeof (fieldName) === "number")
		                    ? fieldName
		                    : this.indexes[fieldName];
		                this.assertValidIndex(index, fieldName);
		                if (!this.changes.has(index)) {
		                    this.changes.set(index, { op: exports.OPERATION.TOUCH, index: index });
		                }
		                this.allChanges.add(index);
		                // ensure touch is placed until the $root is found.
		                this.touchParents();
		            };
		            ChangeTree.prototype.touchParents = function () {
		                if (this.parent) {
		                    this.parent['$changes'].touch(this.parentIndex);
		                }
		            };
		            ChangeTree.prototype.getType = function (index) {
		                if (this.ref['_definition']) {
		                    var definition = this.ref['_definition'];
		                    return definition.schema[definition.fieldsByIndex[index]];
		                }
		                else {
		                    var definition = this.parent['_definition'];
		                    var parentType = definition.schema[definition.fieldsByIndex[this.parentIndex]];
		                    //
		                    // Get the child type from parent structure.
		                    // - ["string"] => "string"
		                    // - { map: "string" } => "string"
		                    // - { set: "string" } => "string"
		                    //
		                    return Object.values(parentType)[0];
		                }
		            };
		            ChangeTree.prototype.getChildrenFilter = function () {
		                var childFilters = this.parent['_definition'].childFilters;
		                return childFilters && childFilters[this.parentIndex];
		            };
		            //
		            // used during `.encode()`
		            //
		            ChangeTree.prototype.getValue = function (index) {
		                return this.ref['getByIndex'](index);
		            };
		            ChangeTree.prototype.delete = function (fieldName) {
		                var index = (typeof (fieldName) === "number")
		                    ? fieldName
		                    : this.indexes[fieldName];
		                if (index === undefined) {
		                    console.warn("@colyseus/schema ".concat(this.ref.constructor.name, ": trying to delete non-existing index: ").concat(fieldName, " (").concat(index, ")"));
		                    return;
		                }
		                var previousValue = this.getValue(index);
		                // console.log("$changes.delete =>", { fieldName, index, previousValue });
		                this.changes.set(index, { op: exports.OPERATION.DELETE, index: index });
		                this.allChanges.delete(index);
		                // delete cache
		                delete this.caches[index];
		                // remove `root` reference
		                if (previousValue && previousValue['$changes']) {
		                    previousValue['$changes'].parent = undefined;
		                }
		                this.changed = true;
		                this.touchParents();
		            };
		            ChangeTree.prototype.discard = function (changed, discardAll) {
		                var _this = this;
		                if (changed === void 0) { changed = false; }
		                if (discardAll === void 0) { discardAll = false; }
		                //
		                // Map, Array, etc:
		                // Remove cached key to ensure ADD operations is unsed instead of
		                // REPLACE in case same key is used on next patches.
		                //
		                // TODO: refactor this. this is not relevant for Collection and Set.
		                //
		                if (!(this.ref instanceof Schema)) {
		                    this.changes.forEach(function (change) {
		                        if (change.op === exports.OPERATION.DELETE) {
		                            var index = _this.ref['getIndex'](change.index);
		                            delete _this.indexes[index];
		                        }
		                    });
		                }
		                this.changes.clear();
		                this.changed = changed;
		                if (discardAll) {
		                    this.allChanges.clear();
		                }
		                // re-set `currentCustomOperation`
		                this.currentCustomOperation = 0;
		            };
		            /**
		             * Recursively discard all changes from this, and child structures.
		             */
		            ChangeTree.prototype.discardAll = function () {
		                var _this = this;
		                this.changes.forEach(function (change) {
		                    var value = _this.getValue(change.index);
		                    if (value && value['$changes']) {
		                        value['$changes'].discardAll();
		                    }
		                });
		                this.discard();
		            };
		            // cache(field: number, beginIndex: number, endIndex: number) {
		            ChangeTree.prototype.cache = function (field, cachedBytes) {
		                this.caches[field] = cachedBytes;
		            };
		            ChangeTree.prototype.clone = function () {
		                return new ChangeTree(this.ref, this.parent, this.root);
		            };
		            ChangeTree.prototype.ensureRefId = function () {
		                // skip if refId is already set.
		                if (this.refId !== undefined) {
		                    return;
		                }
		                this.refId = this.root.getNextUniqueId();
		            };
		            ChangeTree.prototype.assertValidIndex = function (index, fieldName) {
		                if (index === undefined) {
		                    throw new Error("ChangeTree: missing index for field \"".concat(fieldName, "\""));
		                }
		            };
		            return ChangeTree;
		        }());

		        function addCallback($callbacks, op, callback, existing) {
		            // initialize list of callbacks
		            if (!$callbacks[op]) {
		                $callbacks[op] = [];
		            }
		            $callbacks[op].push(callback);
		            //
		            // Trigger callback for existing elements
		            // - OPERATION.ADD
		            // - OPERATION.REPLACE
		            //
		            existing === null || existing === void 0 ? void 0 : existing.forEach(function (item, key) { return callback(item, key); });
		            return function () { return spliceOne($callbacks[op], $callbacks[op].indexOf(callback)); };
		        }
		        function removeChildRefs(changes) {
		            var _this = this;
		            var needRemoveRef = (typeof (this.$changes.getType()) !== "string");
		            this.$items.forEach(function (item, key) {
		                changes.push({
		                    refId: _this.$changes.refId,
		                    op: exports.OPERATION.DELETE,
		                    field: key,
		                    value: undefined,
		                    previousValue: item
		                });
		                if (needRemoveRef) {
		                    _this.$changes.root.removeRef(item['$changes'].refId);
		                }
		            });
		        }
		        function spliceOne(arr, index) {
		            // manually splice an array
		            if (index === -1 || index >= arr.length) {
		                return false;
		            }
		            var len = arr.length - 1;
		            for (var i = index; i < len; i++) {
		                arr[i] = arr[i + 1];
		            }
		            arr.length = len;
		            return true;
		        }

		        var DEFAULT_SORT = function (a, b) {
		            var A = a.toString();
		            var B = b.toString();
		            if (A < B)
		                return -1;
		            else if (A > B)
		                return 1;
		            else
		                return 0;
		        };
		        function getArrayProxy(value) {
		            value['$proxy'] = true;
		            //
		            // compatibility with @colyseus/schema 0.5.x
		            // - allow `map["key"]`
		            // - allow `map["key"] = "xxx"`
		            // - allow `delete map["key"]`
		            //
		            value = new Proxy(value, {
		                get: function (obj, prop) {
		                    if (typeof (prop) !== "symbol" &&
		                        !isNaN(prop) // https://stackoverflow.com/a/175787/892698
		                    ) {
		                        return obj.at(prop);
		                    }
		                    else {
		                        return obj[prop];
		                    }
		                },
		                set: function (obj, prop, setValue) {
		                    if (typeof (prop) !== "symbol" &&
		                        !isNaN(prop)) {
		                        var indexes = Array.from(obj['$items'].keys());
		                        var key = parseInt(indexes[prop] || prop);
		                        if (setValue === undefined || setValue === null) {
		                            obj.deleteAt(key);
		                        }
		                        else {
		                            obj.setAt(key, setValue);
		                        }
		                    }
		                    else {
		                        obj[prop] = setValue;
		                    }
		                    return true;
		                },
		                deleteProperty: function (obj, prop) {
		                    if (typeof (prop) === "number") {
		                        obj.deleteAt(prop);
		                    }
		                    else {
		                        delete obj[prop];
		                    }
		                    return true;
		                },
		            });
		            return value;
		        }
		        var ArraySchema = /** @class */ (function () {
		            function ArraySchema() {
		                var items = [];
		                for (var _i = 0; _i < arguments.length; _i++) {
		                    items[_i] = arguments[_i];
		                }
		                this.$changes = new ChangeTree(this);
		                this.$items = new Map();
		                this.$indexes = new Map();
		                this.$refId = 0;
		                this.push.apply(this, items);
		            }
		            ArraySchema.prototype.onAdd = function (callback, triggerAll) {
		                if (triggerAll === void 0) { triggerAll = true; }
		                return addCallback((this.$callbacks || (this.$callbacks = [])), exports.OPERATION.ADD, callback, (triggerAll)
		                    ? this.$items
		                    : undefined);
		            };
		            ArraySchema.prototype.onRemove = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = []), exports.OPERATION.DELETE, callback); };
		            ArraySchema.prototype.onChange = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = []), exports.OPERATION.REPLACE, callback); };
		            ArraySchema.is = function (type) {
		                return (
		                // type format: ["string"]
		                Array.isArray(type) ||
		                    // type format: { array: "string" }
		                    (type['array'] !== undefined));
		            };
		            Object.defineProperty(ArraySchema.prototype, "length", {
		                get: function () {
		                    return this.$items.size;
		                },
		                set: function (value) {
		                    if (value === 0) {
		                        this.clear();
		                    }
		                    else {
		                        this.splice(value, this.length - value);
		                    }
		                },
		                enumerable: false,
		                configurable: true
		            });
		            ArraySchema.prototype.push = function () {
		                var _this = this;
		                var values = [];
		                for (var _i = 0; _i < arguments.length; _i++) {
		                    values[_i] = arguments[_i];
		                }
		                var lastIndex;
		                values.forEach(function (value) {
		                    // set "index" for reference.
		                    lastIndex = _this.$refId++;
		                    _this.setAt(lastIndex, value);
		                });
		                return lastIndex;
		            };
		            /**
		             * Removes the last element from an array and returns it.
		             */
		            ArraySchema.prototype.pop = function () {
		                var key = Array.from(this.$indexes.values()).pop();
		                if (key === undefined) {
		                    return undefined;
		                }
		                this.$changes.delete(key);
		                this.$indexes.delete(key);
		                var value = this.$items.get(key);
		                this.$items.delete(key);
		                return value;
		            };
		            ArraySchema.prototype.at = function (index) {
		                //
		                // FIXME: this should be O(1)
		                //
		                var key = Array.from(this.$items.keys())[index];
		                return this.$items.get(key);
		            };
		            ArraySchema.prototype.setAt = function (index, value) {
		                var _a, _b;
		                if (value['$changes'] !== undefined) {
		                    value['$changes'].setParent(this, this.$changes.root, index);
		                }
		                var operation = (_b = (_a = this.$changes.indexes[index]) === null || _a === void 0 ? void 0 : _a.op) !== null && _b !== void 0 ? _b : exports.OPERATION.ADD;
		                this.$changes.indexes[index] = index;
		                this.$indexes.set(index, index);
		                this.$items.set(index, value);
		                this.$changes.change(index, operation);
		            };
		            ArraySchema.prototype.deleteAt = function (index) {
		                var key = Array.from(this.$items.keys())[index];
		                if (key === undefined) {
		                    return false;
		                }
		                return this.$deleteAt(key);
		            };
		            ArraySchema.prototype.$deleteAt = function (index) {
		                // delete at internal index
		                this.$changes.delete(index);
		                this.$indexes.delete(index);
		                return this.$items.delete(index);
		            };
		            ArraySchema.prototype.clear = function (changes) {
		                // discard previous operations.
		                this.$changes.discard(true, true);
		                this.$changes.indexes = {};
		                // clear previous indexes
		                this.$indexes.clear();
		                //
		                // When decoding:
		                // - enqueue items for DELETE callback.
		                // - flag child items for garbage collection.
		                //
		                if (changes) {
		                    removeChildRefs.call(this, changes);
		                }
		                // clear items
		                this.$items.clear();
		                this.$changes.operation({ index: 0, op: exports.OPERATION.CLEAR });
		                // touch all structures until reach root
		                this.$changes.touchParents();
		            };
		            /**
		             * Combines two or more arrays.
		             * @param items Additional items to add to the end of array1.
		             */
		            // @ts-ignore
		            ArraySchema.prototype.concat = function () {
		                var _a;
		                var items = [];
		                for (var _i = 0; _i < arguments.length; _i++) {
		                    items[_i] = arguments[_i];
		                }
		                return new (ArraySchema.bind.apply(ArraySchema, __spreadArray([void 0], (_a = Array.from(this.$items.values())).concat.apply(_a, items), false)))();
		            };
		            /**
		             * Adds all the elements of an array separated by the specified separator string.
		             * @param separator A string used to separate one element of an array from the next in the resulting String. If omitted, the array elements are separated with a comma.
		             */
		            ArraySchema.prototype.join = function (separator) {
		                return Array.from(this.$items.values()).join(separator);
		            };
		            /**
		             * Reverses the elements in an Array.
		             */
		            // @ts-ignore
		            ArraySchema.prototype.reverse = function () {
		                var _this = this;
		                var indexes = Array.from(this.$items.keys());
		                var reversedItems = Array.from(this.$items.values()).reverse();
		                reversedItems.forEach(function (item, i) {
		                    _this.setAt(indexes[i], item);
		                });
		                return this;
		            };
		            /**
		             * Removes the first element from an array and returns it.
		             */
		            ArraySchema.prototype.shift = function () {
		                var indexes = Array.from(this.$items.keys());
		                var shiftAt = indexes.shift();
		                if (shiftAt === undefined) {
		                    return undefined;
		                }
		                var value = this.$items.get(shiftAt);
		                this.$deleteAt(shiftAt);
		                return value;
		            };
		            /**
		             * Returns a section of an array.
		             * @param start The beginning of the specified portion of the array.
		             * @param end The end of the specified portion of the array. This is exclusive of the element at the index 'end'.
		             */
		            ArraySchema.prototype.slice = function (start, end) {
		                var sliced = new ArraySchema();
		                sliced.push.apply(sliced, Array.from(this.$items.values()).slice(start, end));
		                return sliced;
		            };
		            /**
		             * Sorts an array.
		             * @param compareFn Function used to determine the order of the elements. It is expected to return
		             * a negative value if first argument is less than second argument, zero if they're equal and a positive
		             * value otherwise. If omitted, the elements are sorted in ascending, ASCII character order.
		             * ```ts
		             * [11,2,22,1].sort((a, b) => a - b)
		             * ```
		             */
		            ArraySchema.prototype.sort = function (compareFn) {
		                var _this = this;
		                if (compareFn === void 0) { compareFn = DEFAULT_SORT; }
		                var indexes = Array.from(this.$items.keys());
		                var sortedItems = Array.from(this.$items.values()).sort(compareFn);
		                sortedItems.forEach(function (item, i) {
		                    _this.setAt(indexes[i], item);
		                });
		                return this;
		            };
		            /**
		             * Removes elements from an array and, if necessary, inserts new elements in their place, returning the deleted elements.
		             * @param start The zero-based location in the array from which to start removing elements.
		             * @param deleteCount The number of elements to remove.
		             * @param items Elements to insert into the array in place of the deleted elements.
		             */
		            ArraySchema.prototype.splice = function (start, deleteCount) {
		                if (deleteCount === void 0) { deleteCount = this.length - start; }
		                var indexes = Array.from(this.$items.keys());
		                var removedItems = [];
		                for (var i = start; i < start + deleteCount; i++) {
		                    removedItems.push(this.$items.get(indexes[i]));
		                    this.$deleteAt(indexes[i]);
		                }
		                return removedItems;
		            };
		            /**
		             * Inserts new elements at the start of an array.
		             * @param items  Elements to insert at the start of the Array.
		             */
		            ArraySchema.prototype.unshift = function () {
		                var _this = this;
		                var items = [];
		                for (var _i = 0; _i < arguments.length; _i++) {
		                    items[_i] = arguments[_i];
		                }
		                var length = this.length;
		                var addedLength = items.length;
		                // const indexes = Array.from(this.$items.keys());
		                var previousValues = Array.from(this.$items.values());
		                items.forEach(function (item, i) {
		                    _this.setAt(i, item);
		                });
		                previousValues.forEach(function (previousValue, i) {
		                    _this.setAt(addedLength + i, previousValue);
		                });
		                return length + addedLength;
		            };
		            /**
		             * Returns the index of the first occurrence of a value in an array.
		             * @param searchElement The value to locate in the array.
		             * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
		             */
		            ArraySchema.prototype.indexOf = function (searchElement, fromIndex) {
		                return Array.from(this.$items.values()).indexOf(searchElement, fromIndex);
		            };
		            /**
		             * Returns the index of the last occurrence of a specified value in an array.
		             * @param searchElement The value to locate in the array.
		             * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at the last index in the array.
		             */
		            ArraySchema.prototype.lastIndexOf = function (searchElement, fromIndex) {
		                if (fromIndex === void 0) { fromIndex = this.length - 1; }
		                return Array.from(this.$items.values()).lastIndexOf(searchElement, fromIndex);
		            };
		            /**
		             * Determines whether all the members of an array satisfy the specified test.
		             * @param callbackfn A function that accepts up to three arguments. The every method calls
		             * the callbackfn function for each element in the array until the callbackfn returns a value
		             * which is coercible to the Boolean value false, or until the end of the array.
		             * @param thisArg An object to which the this keyword can refer in the callbackfn function.
		             * If thisArg is omitted, undefined is used as the this value.
		             */
		            ArraySchema.prototype.every = function (callbackfn, thisArg) {
		                return Array.from(this.$items.values()).every(callbackfn, thisArg);
		            };
		            /**
		             * Determines whether the specified callback function returns true for any element of an array.
		             * @param callbackfn A function that accepts up to three arguments. The some method calls
		             * the callbackfn function for each element in the array until the callbackfn returns a value
		             * which is coercible to the Boolean value true, or until the end of the array.
		             * @param thisArg An object to which the this keyword can refer in the callbackfn function.
		             * If thisArg is omitted, undefined is used as the this value.
		             */
		            ArraySchema.prototype.some = function (callbackfn, thisArg) {
		                return Array.from(this.$items.values()).some(callbackfn, thisArg);
		            };
		            /**
		             * Performs the specified action for each element in an array.
		             * @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
		             * @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
		             */
		            ArraySchema.prototype.forEach = function (callbackfn, thisArg) {
		                Array.from(this.$items.values()).forEach(callbackfn, thisArg);
		            };
		            /**
		             * Calls a defined callback function on each element of an array, and returns an array that contains the results.
		             * @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
		             * @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
		             */
		            ArraySchema.prototype.map = function (callbackfn, thisArg) {
		                return Array.from(this.$items.values()).map(callbackfn, thisArg);
		            };
		            ArraySchema.prototype.filter = function (callbackfn, thisArg) {
		                return Array.from(this.$items.values()).filter(callbackfn, thisArg);
		            };
		            /**
		             * Calls the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
		             * @param callbackfn A function that accepts up to four arguments. The reduce method calls the callbackfn function one time for each element in the array.
		             * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
		             */
		            ArraySchema.prototype.reduce = function (callbackfn, initialValue) {
		                return Array.prototype.reduce.apply(Array.from(this.$items.values()), arguments);
		            };
		            /**
		             * Calls the specified callback function for all the elements in an array, in descending order. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
		             * @param callbackfn A function that accepts up to four arguments. The reduceRight method calls the callbackfn function one time for each element in the array.
		             * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
		             */
		            ArraySchema.prototype.reduceRight = function (callbackfn, initialValue) {
		                return Array.prototype.reduceRight.apply(Array.from(this.$items.values()), arguments);
		            };
		            /**
		             * Returns the value of the first element in the array where predicate is true, and undefined
		             * otherwise.
		             * @param predicate find calls predicate once for each element of the array, in ascending
		             * order, until it finds one where predicate returns true. If such an element is found, find
		             * immediately returns that element value. Otherwise, find returns undefined.
		             * @param thisArg If provided, it will be used as the this value for each invocation of
		             * predicate. If it is not provided, undefined is used instead.
		             */
		            ArraySchema.prototype.find = function (predicate, thisArg) {
		                return Array.from(this.$items.values()).find(predicate, thisArg);
		            };
		            /**
		             * Returns the index of the first element in the array where predicate is true, and -1
		             * otherwise.
		             * @param predicate find calls predicate once for each element of the array, in ascending
		             * order, until it finds one where predicate returns true. If such an element is found,
		             * findIndex immediately returns that element index. Otherwise, findIndex returns -1.
		             * @param thisArg If provided, it will be used as the this value for each invocation of
		             * predicate. If it is not provided, undefined is used instead.
		             */
		            ArraySchema.prototype.findIndex = function (predicate, thisArg) {
		                return Array.from(this.$items.values()).findIndex(predicate, thisArg);
		            };
		            /**
		             * Returns the this object after filling the section identified by start and end with value
		             * @param value value to fill array section with
		             * @param start index to start filling the array at. If start is negative, it is treated as
		             * length+start where length is the length of the array.
		             * @param end index to stop filling the array at. If end is negative, it is treated as
		             * length+end.
		             */
		            ArraySchema.prototype.fill = function (value, start, end) {
		                //
		                // TODO
		                //
		                throw new Error("ArraySchema#fill() not implemented");
		            };
		            /**
		             * Returns the this object after copying a section of the array identified by start and end
		             * to the same array starting at position target
		             * @param target If target is negative, it is treated as length+target where length is the
		             * length of the array.
		             * @param start If start is negative, it is treated as length+start. If end is negative, it
		             * is treated as length+end.
		             * @param end If not specified, length of the this object is used as its default value.
		             */
		            ArraySchema.prototype.copyWithin = function (target, start, end) {
		                //
		                // TODO
		                //
		                throw new Error("ArraySchema#copyWithin() not implemented");
		            };
		            /**
		             * Returns a string representation of an array.
		             */
		            ArraySchema.prototype.toString = function () { return this.$items.toString(); };
		            /**
		             * Returns a string representation of an array. The elements are converted to string using their toLocalString methods.
		             */
		            ArraySchema.prototype.toLocaleString = function () { return this.$items.toLocaleString(); };
		            /** Iterator */
		            ArraySchema.prototype[Symbol.iterator] = function () {
		                return Array.from(this.$items.values())[Symbol.iterator]();
		            };
		            /**
		             * Returns an iterable of key, value pairs for every entry in the array
		             */
		            ArraySchema.prototype.entries = function () { return this.$items.entries(); };
		            /**
		             * Returns an iterable of keys in the array
		             */
		            ArraySchema.prototype.keys = function () { return this.$items.keys(); };
		            /**
		             * Returns an iterable of values in the array
		             */
		            ArraySchema.prototype.values = function () { return this.$items.values(); };
		            /**
		             * Determines whether an array includes a certain element, returning true or false as appropriate.
		             * @param searchElement The element to search for.
		             * @param fromIndex The position in this array at which to begin searching for searchElement.
		             */
		            ArraySchema.prototype.includes = function (searchElement, fromIndex) {
		                return Array.from(this.$items.values()).includes(searchElement, fromIndex);
		            };
		            /**
		             * Calls a defined callback function on each element of an array. Then, flattens the result into
		             * a new array.
		             * This is identical to a map followed by flat with depth 1.
		             *
		             * @param callback A function that accepts up to three arguments. The flatMap method calls the
		             * callback function one time for each element in the array.
		             * @param thisArg An object to which the this keyword can refer in the callback function. If
		             * thisArg is omitted, undefined is used as the this value.
		             */
		            // @ts-ignore
		            ArraySchema.prototype.flatMap = function (callback, thisArg) {
		                // @ts-ignore
		                throw new Error("ArraySchema#flatMap() is not supported.");
		            };
		            /**
		             * Returns a new array with all sub-array elements concatenated into it recursively up to the
		             * specified depth.
		             *
		             * @param depth The maximum recursion depth
		             */
		            // @ts-ignore
		            ArraySchema.prototype.flat = function (depth) {
		                throw new Error("ArraySchema#flat() is not supported.");
		            };
		            ArraySchema.prototype.findLast = function () {
		                var arr = Array.from(this.$items.values());
		                // @ts-ignore
		                return arr.findLast.apply(arr, arguments);
		            };
		            ArraySchema.prototype.findLastIndex = function () {
		                var arr = Array.from(this.$items.values());
		                // @ts-ignore
		                return arr.findLastIndex.apply(arr, arguments);
		            };
		            // get size () {
		            //     return this.$items.size;
		            // }
		            ArraySchema.prototype.setIndex = function (index, key) {
		                this.$indexes.set(index, key);
		            };
		            ArraySchema.prototype.getIndex = function (index) {
		                return this.$indexes.get(index);
		            };
		            ArraySchema.prototype.getByIndex = function (index) {
		                return this.$items.get(this.$indexes.get(index));
		            };
		            ArraySchema.prototype.deleteByIndex = function (index) {
		                var key = this.$indexes.get(index);
		                this.$items.delete(key);
		                this.$indexes.delete(index);
		            };
		            ArraySchema.prototype.toArray = function () {
		                return Array.from(this.$items.values());
		            };
		            ArraySchema.prototype.toJSON = function () {
		                return this.toArray().map(function (value) {
		                    return (typeof (value['toJSON']) === "function")
		                        ? value['toJSON']()
		                        : value;
		                });
		            };
		            //
		            // Decoding utilities
		            //
		            ArraySchema.prototype.clone = function (isDecoding) {
		                var cloned;
		                if (isDecoding) {
		                    cloned = new (ArraySchema.bind.apply(ArraySchema, __spreadArray([void 0], Array.from(this.$items.values()), false)))();
		                }
		                else {
		                    cloned = new (ArraySchema.bind.apply(ArraySchema, __spreadArray([void 0], this.map(function (item) { return ((item['$changes'])
		                        ? item.clone()
		                        : item); }), false)))();
		                }
		                return cloned;
		            };
		            return ArraySchema;
		        }());

		        function getMapProxy(value) {
		            value['$proxy'] = true;
		            value = new Proxy(value, {
		                get: function (obj, prop) {
		                    if (typeof (prop) !== "symbol" && // accessing properties
		                        typeof (obj[prop]) === "undefined") {
		                        return obj.get(prop);
		                    }
		                    else {
		                        return obj[prop];
		                    }
		                },
		                set: function (obj, prop, setValue) {
		                    if (typeof (prop) !== "symbol" &&
		                        (prop.indexOf("$") === -1 &&
		                            prop !== "onAdd" &&
		                            prop !== "onRemove" &&
		                            prop !== "onChange")) {
		                        obj.set(prop, setValue);
		                    }
		                    else {
		                        obj[prop] = setValue;
		                    }
		                    return true;
		                },
		                deleteProperty: function (obj, prop) {
		                    obj.delete(prop);
		                    return true;
		                },
		            });
		            return value;
		        }
		        var MapSchema = /** @class */ (function () {
		            function MapSchema(initialValues) {
		                var _this = this;
		                this.$changes = new ChangeTree(this);
		                this.$items = new Map();
		                this.$indexes = new Map();
		                this.$refId = 0;
		                if (initialValues) {
		                    if (initialValues instanceof Map ||
		                        initialValues instanceof MapSchema) {
		                        initialValues.forEach(function (v, k) { return _this.set(k, v); });
		                    }
		                    else {
		                        for (var k in initialValues) {
		                            this.set(k, initialValues[k]);
		                        }
		                    }
		                }
		            }
		            MapSchema.prototype.onAdd = function (callback, triggerAll) {
		                if (triggerAll === void 0) { triggerAll = true; }
		                return addCallback((this.$callbacks || (this.$callbacks = [])), exports.OPERATION.ADD, callback, (triggerAll)
		                    ? this.$items
		                    : undefined);
		            };
		            MapSchema.prototype.onRemove = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = []), exports.OPERATION.DELETE, callback); };
		            MapSchema.prototype.onChange = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = []), exports.OPERATION.REPLACE, callback); };
		            MapSchema.is = function (type) {
		                return type['map'] !== undefined;
		            };
		            /** Iterator */
		            MapSchema.prototype[Symbol.iterator] = function () { return this.$items[Symbol.iterator](); };
		            Object.defineProperty(MapSchema.prototype, Symbol.toStringTag, {
		                get: function () { return this.$items[Symbol.toStringTag]; },
		                enumerable: false,
		                configurable: true
		            });
		            MapSchema.prototype.set = function (key, value) {
		                if (value === undefined || value === null) {
		                    throw new Error("MapSchema#set('".concat(key, "', ").concat(value, "): trying to set ").concat(value, " value on '").concat(key, "'."));
		                }
		                // get "index" for this value.
		                var hasIndex = typeof (this.$changes.indexes[key]) !== "undefined";
		                var index = (hasIndex)
		                    ? this.$changes.indexes[key]
		                    : this.$refId++;
		                var operation = (hasIndex)
		                    ? exports.OPERATION.REPLACE
		                    : exports.OPERATION.ADD;
		                var isRef = (value['$changes']) !== undefined;
		                if (isRef) {
		                    value['$changes'].setParent(this, this.$changes.root, index);
		                }
		                //
		                // (encoding)
		                // set a unique id to relate directly with this key/value.
		                //
		                if (!hasIndex) {
		                    this.$changes.indexes[key] = index;
		                    this.$indexes.set(index, key);
		                }
		                else if (isRef && // if is schema, force ADD operation if value differ from previous one.
		                    this.$items.get(key) !== value) {
		                    operation = exports.OPERATION.ADD;
		                }
		                this.$items.set(key, value);
		                this.$changes.change(key, operation);
		                return this;
		            };
		            MapSchema.prototype.get = function (key) {
		                return this.$items.get(key);
		            };
		            MapSchema.prototype.delete = function (key) {
		                //
		                // TODO: add a "purge" method after .encode() runs, to cleanup removed `$indexes`
		                //
		                // We don't remove $indexes to allow setting the same key in the same patch
		                // (See "should allow to remove and set an item in the same place" test)
		                //
		                // // const index = this.$changes.indexes[key];
		                // // this.$indexes.delete(index);
		                this.$changes.delete(key);
		                return this.$items.delete(key);
		            };
		            MapSchema.prototype.clear = function (changes) {
		                // discard previous operations.
		                this.$changes.discard(true, true);
		                this.$changes.indexes = {};
		                // clear previous indexes
		                this.$indexes.clear();
		                //
		                // When decoding:
		                // - enqueue items for DELETE callback.
		                // - flag child items for garbage collection.
		                //
		                if (changes) {
		                    removeChildRefs.call(this, changes);
		                }
		                // clear items
		                this.$items.clear();
		                this.$changes.operation({ index: 0, op: exports.OPERATION.CLEAR });
		                // touch all structures until reach root
		                this.$changes.touchParents();
		            };
		            MapSchema.prototype.has = function (key) {
		                return this.$items.has(key);
		            };
		            MapSchema.prototype.forEach = function (callbackfn) {
		                this.$items.forEach(callbackfn);
		            };
		            MapSchema.prototype.entries = function () {
		                return this.$items.entries();
		            };
		            MapSchema.prototype.keys = function () {
		                return this.$items.keys();
		            };
		            MapSchema.prototype.values = function () {
		                return this.$items.values();
		            };
		            Object.defineProperty(MapSchema.prototype, "size", {
		                get: function () {
		                    return this.$items.size;
		                },
		                enumerable: false,
		                configurable: true
		            });
		            MapSchema.prototype.setIndex = function (index, key) {
		                this.$indexes.set(index, key);
		            };
		            MapSchema.prototype.getIndex = function (index) {
		                return this.$indexes.get(index);
		            };
		            MapSchema.prototype.getByIndex = function (index) {
		                return this.$items.get(this.$indexes.get(index));
		            };
		            MapSchema.prototype.deleteByIndex = function (index) {
		                var key = this.$indexes.get(index);
		                this.$items.delete(key);
		                this.$indexes.delete(index);
		            };
		            MapSchema.prototype.toJSON = function () {
		                var map = {};
		                this.forEach(function (value, key) {
		                    map[key] = (typeof (value['toJSON']) === "function")
		                        ? value['toJSON']()
		                        : value;
		                });
		                return map;
		            };
		            //
		            // Decoding utilities
		            //
		            MapSchema.prototype.clone = function (isDecoding) {
		                var cloned;
		                if (isDecoding) {
		                    // client-side
		                    cloned = Object.assign(new MapSchema(), this);
		                }
		                else {
		                    // server-side
		                    cloned = new MapSchema();
		                    this.forEach(function (value, key) {
		                        if (value['$changes']) {
		                            cloned.set(key, value['clone']());
		                        }
		                        else {
		                            cloned.set(key, value);
		                        }
		                    });
		                }
		                return cloned;
		            };
		            return MapSchema;
		        }());

		        var registeredTypes = {};
		        function registerType(identifier, definition) {
		            registeredTypes[identifier] = definition;
		        }
		        function getType(identifier) {
		            return registeredTypes[identifier];
		        }

		        var SchemaDefinition = /** @class */ (function () {
		            function SchemaDefinition() {
		                //
		                // TODO: use a "field" structure combining all these properties per-field.
		                //
		                this.indexes = {};
		                this.fieldsByIndex = {};
		                this.deprecated = {};
		                this.descriptors = {};
		            }
		            SchemaDefinition.create = function (parent) {
		                var definition = new SchemaDefinition();
		                // support inheritance
		                definition.schema = Object.assign({}, parent && parent.schema || {});
		                definition.indexes = Object.assign({}, parent && parent.indexes || {});
		                definition.fieldsByIndex = Object.assign({}, parent && parent.fieldsByIndex || {});
		                definition.descriptors = Object.assign({}, parent && parent.descriptors || {});
		                definition.deprecated = Object.assign({}, parent && parent.deprecated || {});
		                return definition;
		            };
		            SchemaDefinition.prototype.addField = function (field, type) {
		                var index = this.getNextFieldIndex();
		                this.fieldsByIndex[index] = field;
		                this.indexes[field] = index;
		                this.schema[field] = (Array.isArray(type))
		                    ? { array: type[0] }
		                    : type;
		            };
		            SchemaDefinition.prototype.hasField = function (field) {
		                return this.indexes[field] !== undefined;
		            };
		            SchemaDefinition.prototype.addFilter = function (field, cb) {
		                if (!this.filters) {
		                    this.filters = {};
		                    this.indexesWithFilters = [];
		                }
		                this.filters[this.indexes[field]] = cb;
		                this.indexesWithFilters.push(this.indexes[field]);
		                return true;
		            };
		            SchemaDefinition.prototype.addChildrenFilter = function (field, cb) {
		                var index = this.indexes[field];
		                var type = this.schema[field];
		                if (getType(Object.keys(type)[0])) {
		                    if (!this.childFilters) {
		                        this.childFilters = {};
		                    }
		                    this.childFilters[index] = cb;
		                    return true;
		                }
		                else {
		                    console.warn("@filterChildren: field '".concat(field, "' can't have children. Ignoring filter."));
		                }
		            };
		            SchemaDefinition.prototype.getChildrenFilter = function (field) {
		                return this.childFilters && this.childFilters[this.indexes[field]];
		            };
		            SchemaDefinition.prototype.getNextFieldIndex = function () {
		                return Object.keys(this.schema || {}).length;
		            };
		            return SchemaDefinition;
		        }());
		        function hasFilter(klass) {
		            return klass._context && klass._context.useFilters;
		        }
		        var Context = /** @class */ (function () {
		            function Context() {
		                this.types = {};
		                this.schemas = new Map();
		                this.useFilters = false;
		            }
		            Context.prototype.has = function (schema) {
		                return this.schemas.has(schema);
		            };
		            Context.prototype.get = function (typeid) {
		                return this.types[typeid];
		            };
		            Context.prototype.add = function (schema, typeid) {
		                if (typeid === void 0) { typeid = this.schemas.size; }
		                // FIXME: move this to somewhere else?
		                // support inheritance
		                schema._definition = SchemaDefinition.create(schema._definition);
		                schema._typeid = typeid;
		                this.types[typeid] = schema;
		                this.schemas.set(schema, typeid);
		            };
		            Context.create = function (options) {
		                if (options === void 0) { options = {}; }
		                return function (definition) {
		                    if (!options.context) {
		                        options.context = new Context();
		                    }
		                    return type(definition, options);
		                };
		            };
		            return Context;
		        }());
		        var globalContext = new Context();
		        /**
		         * [See documentation](https://docs.colyseus.io/state/schema/)
		         *
		         * Annotate a Schema property to be serializeable.
		         * \@type()'d fields are automatically flagged as "dirty" for the next patch.
		         *
		         * @example Standard usage, with automatic change tracking.
		         * ```
		         * \@type("string") propertyName: string;
		         * ```
		         *
		         * @example You can provide the "manual" option if you'd like to manually control your patches via .setDirty().
		         * ```
		         * \@type("string", { manual: true })
		         * ```
		         */
		        function type(type, options) {
		            if (options === void 0) { options = {}; }
		            return function (target, field) {
		                var context = options.context || globalContext;
		                var constructor = target.constructor;
		                constructor._context = context;
		                if (!type) {
		                    throw new Error("".concat(constructor.name, ": @type() reference provided for \"").concat(field, "\" is undefined. Make sure you don't have any circular dependencies."));
		                }
		                /*
		                 * static schema
		                 */
		                if (!context.has(constructor)) {
		                    context.add(constructor);
		                }
		                var definition = constructor._definition;
		                definition.addField(field, type);
		                /**
		                 * skip if descriptor already exists for this field (`@deprecated()`)
		                 */
		                if (definition.descriptors[field]) {
		                    if (definition.deprecated[field]) {
		                        // do not create accessors for deprecated properties.
		                        return;
		                    }
		                    else {
		                        // trying to define same property multiple times across inheritance.
		                        // https://github.com/colyseus/colyseus-unity3d/issues/131#issuecomment-814308572
		                        try {
		                            throw new Error("@colyseus/schema: Duplicate '".concat(field, "' definition on '").concat(constructor.name, "'.\nCheck @type() annotation"));
		                        }
		                        catch (e) {
		                            var definitionAtLine = e.stack.split("\n")[4].trim();
		                            throw new Error("".concat(e.message, " ").concat(definitionAtLine));
		                        }
		                    }
		                }
		                var isArray = ArraySchema.is(type);
		                var isMap = !isArray && MapSchema.is(type);
		                // TODO: refactor me.
		                // Allow abstract intermediary classes with no fields to be serialized
		                // (See "should support an inheritance with a Schema type without fields" test)
		                if (typeof (type) !== "string" && !Schema.is(type)) {
		                    var childType = Object.values(type)[0];
		                    if (typeof (childType) !== "string" && !context.has(childType)) {
		                        context.add(childType);
		                    }
		                }
		                if (options.manual) {
		                    // do not declare getter/setter descriptor
		                    definition.descriptors[field] = {
		                        enumerable: true,
		                        configurable: true,
		                        writable: true,
		                    };
		                    return;
		                }
		                var fieldCached = "_".concat(field);
		                definition.descriptors[fieldCached] = {
		                    enumerable: false,
		                    configurable: false,
		                    writable: true,
		                };
		                definition.descriptors[field] = {
		                    get: function () {
		                        return this[fieldCached];
		                    },
		                    set: function (value) {
		                        /**
		                         * Create Proxy for array or map items
		                         */
		                        // skip if value is the same as cached.
		                        if (value === this[fieldCached]) {
		                            return;
		                        }
		                        if (value !== undefined &&
		                            value !== null) {
		                            // automaticallty transform Array into ArraySchema
		                            if (isArray && !(value instanceof ArraySchema)) {
		                                value = new (ArraySchema.bind.apply(ArraySchema, __spreadArray([void 0], value, false)))();
		                            }
		                            // automaticallty transform Map into MapSchema
		                            if (isMap && !(value instanceof MapSchema)) {
		                                value = new MapSchema(value);
		                            }
		                            // try to turn provided structure into a Proxy
		                            if (value['$proxy'] === undefined) {
		                                if (isMap) {
		                                    value = getMapProxy(value);
		                                }
		                                else if (isArray) {
		                                    value = getArrayProxy(value);
		                                }
		                            }
		                            // flag the change for encoding.
		                            this.$changes.change(field);
		                            //
		                            // call setParent() recursively for this and its child
		                            // structures.
		                            //
		                            if (value['$changes']) {
		                                value['$changes'].setParent(this, this.$changes.root, this._definition.indexes[field]);
		                            }
		                        }
		                        else if (this[fieldCached]) {
		                            //
		                            // Setting a field to `null` or `undefined` will delete it.
		                            //
		                            this.$changes.delete(field);
		                        }
		                        this[fieldCached] = value;
		                    },
		                    enumerable: true,
		                    configurable: true
		                };
		            };
		        }
		        /**
		         * `@filter()` decorator for defining data filters per client
		         */
		        function filter(cb) {
		            return function (target, field) {
		                var constructor = target.constructor;
		                var definition = constructor._definition;
		                if (definition.addFilter(field, cb)) {
		                    constructor._context.useFilters = true;
		                }
		            };
		        }
		        function filterChildren(cb) {
		            return function (target, field) {
		                var constructor = target.constructor;
		                var definition = constructor._definition;
		                if (definition.addChildrenFilter(field, cb)) {
		                    constructor._context.useFilters = true;
		                }
		            };
		        }
		        /**
		         * `@deprecated()` flag a field as deprecated.
		         * The previous `@type()` annotation should remain along with this one.
		         */
		        function deprecated(throws) {
		            if (throws === void 0) { throws = true; }
		            return function (target, field) {
		                var constructor = target.constructor;
		                var definition = constructor._definition;
		                definition.deprecated[field] = true;
		                if (throws) {
		                    definition.descriptors[field] = {
		                        get: function () { throw new Error("".concat(field, " is deprecated.")); },
		                        set: function (value) { },
		                        enumerable: false,
		                        configurable: true
		                    };
		                }
		            };
		        }
		        function defineTypes(target, fields, options) {
		            if (options === void 0) { options = {}; }
		            if (!options.context) {
		                options.context = target._context || options.context || globalContext;
		            }
		            for (var field in fields) {
		                type(fields[field], options)(target.prototype, field);
		            }
		            return target;
		        }

		        /**
		         * Copyright (c) 2018 Endel Dreyer
		         * Copyright (c) 2014 Ion Drive Software Ltd.
		         *
		         * Permission is hereby granted, free of charge, to any person obtaining a copy
		         * of this software and associated documentation files (the "Software"), to deal
		         * in the Software without restriction, including without limitation the rights
		         * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
		         * copies of the Software, and to permit persons to whom the Software is
		         * furnished to do so, subject to the following conditions:
		         *
		         * The above copyright notice and this permission notice shall be included in all
		         * copies or substantial portions of the Software.
		         *
		         * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
		         * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
		         * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
		         * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
		         * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
		         * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
		         * SOFTWARE
		         */
		        /**
		         * msgpack implementation highly based on notepack.io
		         * https://github.com/darrachequesne/notepack
		         */
		        function utf8Length(str) {
		            var c = 0, length = 0;
		            for (var i = 0, l = str.length; i < l; i++) {
		                c = str.charCodeAt(i);
		                if (c < 0x80) {
		                    length += 1;
		                }
		                else if (c < 0x800) {
		                    length += 2;
		                }
		                else if (c < 0xd800 || c >= 0xe000) {
		                    length += 3;
		                }
		                else {
		                    i++;
		                    length += 4;
		                }
		            }
		            return length;
		        }
		        function utf8Write(view, offset, str) {
		            var c = 0;
		            for (var i = 0, l = str.length; i < l; i++) {
		                c = str.charCodeAt(i);
		                if (c < 0x80) {
		                    view[offset++] = c;
		                }
		                else if (c < 0x800) {
		                    view[offset++] = 0xc0 | (c >> 6);
		                    view[offset++] = 0x80 | (c & 0x3f);
		                }
		                else if (c < 0xd800 || c >= 0xe000) {
		                    view[offset++] = 0xe0 | (c >> 12);
		                    view[offset++] = 0x80 | (c >> 6 & 0x3f);
		                    view[offset++] = 0x80 | (c & 0x3f);
		                }
		                else {
		                    i++;
		                    c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
		                    view[offset++] = 0xf0 | (c >> 18);
		                    view[offset++] = 0x80 | (c >> 12 & 0x3f);
		                    view[offset++] = 0x80 | (c >> 6 & 0x3f);
		                    view[offset++] = 0x80 | (c & 0x3f);
		                }
		            }
		        }
		        function int8$1(bytes, value) {
		            bytes.push(value & 255);
		        }
		        function uint8$1(bytes, value) {
		            bytes.push(value & 255);
		        }
		        function int16$1(bytes, value) {
		            bytes.push(value & 255);
		            bytes.push((value >> 8) & 255);
		        }
		        function uint16$1(bytes, value) {
		            bytes.push(value & 255);
		            bytes.push((value >> 8) & 255);
		        }
		        function int32$1(bytes, value) {
		            bytes.push(value & 255);
		            bytes.push((value >> 8) & 255);
		            bytes.push((value >> 16) & 255);
		            bytes.push((value >> 24) & 255);
		        }
		        function uint32$1(bytes, value) {
		            var b4 = value >> 24;
		            var b3 = value >> 16;
		            var b2 = value >> 8;
		            var b1 = value;
		            bytes.push(b1 & 255);
		            bytes.push(b2 & 255);
		            bytes.push(b3 & 255);
		            bytes.push(b4 & 255);
		        }
		        function int64$1(bytes, value) {
		            var high = Math.floor(value / Math.pow(2, 32));
		            var low = value >>> 0;
		            uint32$1(bytes, low);
		            uint32$1(bytes, high);
		        }
		        function uint64$1(bytes, value) {
		            var high = (value / Math.pow(2, 32)) >> 0;
		            var low = value >>> 0;
		            uint32$1(bytes, low);
		            uint32$1(bytes, high);
		        }
		        function float32$1(bytes, value) {
		            writeFloat32(bytes, value);
		        }
		        function float64$1(bytes, value) {
		            writeFloat64(bytes, value);
		        }
		        var _int32$1 = new Int32Array(2);
		        var _float32$1 = new Float32Array(_int32$1.buffer);
		        var _float64$1 = new Float64Array(_int32$1.buffer);
		        function writeFloat32(bytes, value) {
		            _float32$1[0] = value;
		            int32$1(bytes, _int32$1[0]);
		        }
		        function writeFloat64(bytes, value) {
		            _float64$1[0] = value;
		            int32$1(bytes, _int32$1[0 ]);
		            int32$1(bytes, _int32$1[1 ]);
		        }
		        function boolean$1(bytes, value) {
		            return uint8$1(bytes, value ? 1 : 0);
		        }
		        function string$1(bytes, value) {
		            // encode `null` strings as empty.
		            if (!value) {
		                value = "";
		            }
		            var length = utf8Length(value);
		            var size = 0;
		            // fixstr
		            if (length < 0x20) {
		                bytes.push(length | 0xa0);
		                size = 1;
		            }
		            // str 8
		            else if (length < 0x100) {
		                bytes.push(0xd9);
		                uint8$1(bytes, length);
		                size = 2;
		            }
		            // str 16
		            else if (length < 0x10000) {
		                bytes.push(0xda);
		                uint16$1(bytes, length);
		                size = 3;
		            }
		            // str 32
		            else if (length < 0x100000000) {
		                bytes.push(0xdb);
		                uint32$1(bytes, length);
		                size = 5;
		            }
		            else {
		                throw new Error('String too long');
		            }
		            utf8Write(bytes, bytes.length, value);
		            return size + length;
		        }
		        function number$1(bytes, value) {
		            if (isNaN(value)) {
		                return number$1(bytes, 0);
		            }
		            else if (!isFinite(value)) {
		                return number$1(bytes, (value > 0) ? Number.MAX_SAFE_INTEGER : -Number.MAX_SAFE_INTEGER);
		            }
		            else if (value !== (value | 0)) {
		                bytes.push(0xcb);
		                writeFloat64(bytes, value);
		                return 9;
		                // TODO: encode float 32?
		                // is it possible to differentiate between float32 / float64 here?
		                // // float 32
		                // bytes.push(0xca);
		                // writeFloat32(bytes, value);
		                // return 5;
		            }
		            if (value >= 0) {
		                // positive fixnum
		                if (value < 0x80) {
		                    uint8$1(bytes, value);
		                    return 1;
		                }
		                // uint 8
		                if (value < 0x100) {
		                    bytes.push(0xcc);
		                    uint8$1(bytes, value);
		                    return 2;
		                }
		                // uint 16
		                if (value < 0x10000) {
		                    bytes.push(0xcd);
		                    uint16$1(bytes, value);
		                    return 3;
		                }
		                // uint 32
		                if (value < 0x100000000) {
		                    bytes.push(0xce);
		                    uint32$1(bytes, value);
		                    return 5;
		                }
		                // uint 64
		                bytes.push(0xcf);
		                uint64$1(bytes, value);
		                return 9;
		            }
		            else {
		                // negative fixnum
		                if (value >= -0x20) {
		                    bytes.push(0xe0 | (value + 0x20));
		                    return 1;
		                }
		                // int 8
		                if (value >= -0x80) {
		                    bytes.push(0xd0);
		                    int8$1(bytes, value);
		                    return 2;
		                }
		                // int 16
		                if (value >= -0x8000) {
		                    bytes.push(0xd1);
		                    int16$1(bytes, value);
		                    return 3;
		                }
		                // int 32
		                if (value >= -0x80000000) {
		                    bytes.push(0xd2);
		                    int32$1(bytes, value);
		                    return 5;
		                }
		                // int 64
		                bytes.push(0xd3);
		                int64$1(bytes, value);
		                return 9;
		            }
		        }

		        var encode = /*#__PURE__*/Object.freeze({
		            __proto__: null,
		            utf8Write: utf8Write,
		            int8: int8$1,
		            uint8: uint8$1,
		            int16: int16$1,
		            uint16: uint16$1,
		            int32: int32$1,
		            uint32: uint32$1,
		            int64: int64$1,
		            uint64: uint64$1,
		            float32: float32$1,
		            float64: float64$1,
		            writeFloat32: writeFloat32,
		            writeFloat64: writeFloat64,
		            boolean: boolean$1,
		            string: string$1,
		            number: number$1
		        });

		        /**
		         * Copyright (c) 2018 Endel Dreyer
		         * Copyright (c) 2014 Ion Drive Software Ltd.
		         *
		         * Permission is hereby granted, free of charge, to any person obtaining a copy
		         * of this software and associated documentation files (the "Software"), to deal
		         * in the Software without restriction, including without limitation the rights
		         * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
		         * copies of the Software, and to permit persons to whom the Software is
		         * furnished to do so, subject to the following conditions:
		         *
		         * The above copyright notice and this permission notice shall be included in all
		         * copies or substantial portions of the Software.
		         *
		         * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
		         * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
		         * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
		         * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
		         * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
		         * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
		         * SOFTWARE
		         */
		        function utf8Read(bytes, offset, length) {
		            var string = '', chr = 0;
		            for (var i = offset, end = offset + length; i < end; i++) {
		                var byte = bytes[i];
		                if ((byte & 0x80) === 0x00) {
		                    string += String.fromCharCode(byte);
		                    continue;
		                }
		                if ((byte & 0xe0) === 0xc0) {
		                    string += String.fromCharCode(((byte & 0x1f) << 6) |
		                        (bytes[++i] & 0x3f));
		                    continue;
		                }
		                if ((byte & 0xf0) === 0xe0) {
		                    string += String.fromCharCode(((byte & 0x0f) << 12) |
		                        ((bytes[++i] & 0x3f) << 6) |
		                        ((bytes[++i] & 0x3f) << 0));
		                    continue;
		                }
		                if ((byte & 0xf8) === 0xf0) {
		                    chr = ((byte & 0x07) << 18) |
		                        ((bytes[++i] & 0x3f) << 12) |
		                        ((bytes[++i] & 0x3f) << 6) |
		                        ((bytes[++i] & 0x3f) << 0);
		                    if (chr >= 0x010000) { // surrogate pair
		                        chr -= 0x010000;
		                        string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
		                    }
		                    else {
		                        string += String.fromCharCode(chr);
		                    }
		                    continue;
		                }
		                console.error('Invalid byte ' + byte.toString(16));
		                // (do not throw error to avoid server/client from crashing due to hack attemps)
		                // throw new Error('Invalid byte ' + byte.toString(16));
		            }
		            return string;
		        }
		        function int8(bytes, it) {
		            return uint8(bytes, it) << 24 >> 24;
		        }
		        function uint8(bytes, it) {
		            return bytes[it.offset++];
		        }
		        function int16(bytes, it) {
		            return uint16(bytes, it) << 16 >> 16;
		        }
		        function uint16(bytes, it) {
		            return bytes[it.offset++] | bytes[it.offset++] << 8;
		        }
		        function int32(bytes, it) {
		            return bytes[it.offset++] | bytes[it.offset++] << 8 | bytes[it.offset++] << 16 | bytes[it.offset++] << 24;
		        }
		        function uint32(bytes, it) {
		            return int32(bytes, it) >>> 0;
		        }
		        function float32(bytes, it) {
		            return readFloat32(bytes, it);
		        }
		        function float64(bytes, it) {
		            return readFloat64(bytes, it);
		        }
		        function int64(bytes, it) {
		            var low = uint32(bytes, it);
		            var high = int32(bytes, it) * Math.pow(2, 32);
		            return high + low;
		        }
		        function uint64(bytes, it) {
		            var low = uint32(bytes, it);
		            var high = uint32(bytes, it) * Math.pow(2, 32);
		            return high + low;
		        }
		        var _int32 = new Int32Array(2);
		        var _float32 = new Float32Array(_int32.buffer);
		        var _float64 = new Float64Array(_int32.buffer);
		        function readFloat32(bytes, it) {
		            _int32[0] = int32(bytes, it);
		            return _float32[0];
		        }
		        function readFloat64(bytes, it) {
		            _int32[0 ] = int32(bytes, it);
		            _int32[1 ] = int32(bytes, it);
		            return _float64[0];
		        }
		        function boolean(bytes, it) {
		            return uint8(bytes, it) > 0;
		        }
		        function string(bytes, it) {
		            var prefix = bytes[it.offset++];
		            var length;
		            if (prefix < 0xc0) {
		                // fixstr
		                length = prefix & 0x1f;
		            }
		            else if (prefix === 0xd9) {
		                length = uint8(bytes, it);
		            }
		            else if (prefix === 0xda) {
		                length = uint16(bytes, it);
		            }
		            else if (prefix === 0xdb) {
		                length = uint32(bytes, it);
		            }
		            var value = utf8Read(bytes, it.offset, length);
		            it.offset += length;
		            return value;
		        }
		        function stringCheck(bytes, it) {
		            var prefix = bytes[it.offset];
		            return (
		            // fixstr
		            (prefix < 0xc0 && prefix > 0xa0) ||
		                // str 8
		                prefix === 0xd9 ||
		                // str 16
		                prefix === 0xda ||
		                // str 32
		                prefix === 0xdb);
		        }
		        function number(bytes, it) {
		            var prefix = bytes[it.offset++];
		            if (prefix < 0x80) {
		                // positive fixint
		                return prefix;
		            }
		            else if (prefix === 0xca) {
		                // float 32
		                return readFloat32(bytes, it);
		            }
		            else if (prefix === 0xcb) {
		                // float 64
		                return readFloat64(bytes, it);
		            }
		            else if (prefix === 0xcc) {
		                // uint 8
		                return uint8(bytes, it);
		            }
		            else if (prefix === 0xcd) {
		                // uint 16
		                return uint16(bytes, it);
		            }
		            else if (prefix === 0xce) {
		                // uint 32
		                return uint32(bytes, it);
		            }
		            else if (prefix === 0xcf) {
		                // uint 64
		                return uint64(bytes, it);
		            }
		            else if (prefix === 0xd0) {
		                // int 8
		                return int8(bytes, it);
		            }
		            else if (prefix === 0xd1) {
		                // int 16
		                return int16(bytes, it);
		            }
		            else if (prefix === 0xd2) {
		                // int 32
		                return int32(bytes, it);
		            }
		            else if (prefix === 0xd3) {
		                // int 64
		                return int64(bytes, it);
		            }
		            else if (prefix > 0xdf) {
		                // negative fixint
		                return (0xff - prefix + 1) * -1;
		            }
		        }
		        function numberCheck(bytes, it) {
		            var prefix = bytes[it.offset];
		            // positive fixint - 0x00 - 0x7f
		            // float 32        - 0xca
		            // float 64        - 0xcb
		            // uint 8          - 0xcc
		            // uint 16         - 0xcd
		            // uint 32         - 0xce
		            // uint 64         - 0xcf
		            // int 8           - 0xd0
		            // int 16          - 0xd1
		            // int 32          - 0xd2
		            // int 64          - 0xd3
		            return (prefix < 0x80 ||
		                (prefix >= 0xca && prefix <= 0xd3));
		        }
		        function arrayCheck(bytes, it) {
		            return bytes[it.offset] < 0xa0;
		            // const prefix = bytes[it.offset] ;
		            // if (prefix < 0xa0) {
		            //   return prefix;
		            // // array
		            // } else if (prefix === 0xdc) {
		            //   it.offset += 2;
		            // } else if (0xdd) {
		            //   it.offset += 4;
		            // }
		            // return prefix;
		        }
		        function switchStructureCheck(bytes, it) {
		            return (
		            // previous byte should be `SWITCH_TO_STRUCTURE`
		            bytes[it.offset - 1] === SWITCH_TO_STRUCTURE &&
		                // next byte should be a number
		                (bytes[it.offset] < 0x80 || (bytes[it.offset] >= 0xca && bytes[it.offset] <= 0xd3)));
		        }

		        var decode = /*#__PURE__*/Object.freeze({
		            __proto__: null,
		            int8: int8,
		            uint8: uint8,
		            int16: int16,
		            uint16: uint16,
		            int32: int32,
		            uint32: uint32,
		            float32: float32,
		            float64: float64,
		            int64: int64,
		            uint64: uint64,
		            readFloat32: readFloat32,
		            readFloat64: readFloat64,
		            boolean: boolean,
		            string: string,
		            stringCheck: stringCheck,
		            number: number,
		            numberCheck: numberCheck,
		            arrayCheck: arrayCheck,
		            switchStructureCheck: switchStructureCheck
		        });

		        var CollectionSchema = /** @class */ (function () {
		            function CollectionSchema(initialValues) {
		                var _this = this;
		                this.$changes = new ChangeTree(this);
		                this.$items = new Map();
		                this.$indexes = new Map();
		                this.$refId = 0;
		                if (initialValues) {
		                    initialValues.forEach(function (v) { return _this.add(v); });
		                }
		            }
		            CollectionSchema.prototype.onAdd = function (callback, triggerAll) {
		                if (triggerAll === void 0) { triggerAll = true; }
		                return addCallback((this.$callbacks || (this.$callbacks = [])), exports.OPERATION.ADD, callback, (triggerAll)
		                    ? this.$items
		                    : undefined);
		            };
		            CollectionSchema.prototype.onRemove = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = []), exports.OPERATION.DELETE, callback); };
		            CollectionSchema.prototype.onChange = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = []), exports.OPERATION.REPLACE, callback); };
		            CollectionSchema.is = function (type) {
		                return type['collection'] !== undefined;
		            };
		            CollectionSchema.prototype.add = function (value) {
		                // set "index" for reference.
		                var index = this.$refId++;
		                var isRef = (value['$changes']) !== undefined;
		                if (isRef) {
		                    value['$changes'].setParent(this, this.$changes.root, index);
		                }
		                this.$changes.indexes[index] = index;
		                this.$indexes.set(index, index);
		                this.$items.set(index, value);
		                this.$changes.change(index);
		                return index;
		            };
		            CollectionSchema.prototype.at = function (index) {
		                var key = Array.from(this.$items.keys())[index];
		                return this.$items.get(key);
		            };
		            CollectionSchema.prototype.entries = function () {
		                return this.$items.entries();
		            };
		            CollectionSchema.prototype.delete = function (item) {
		                var entries = this.$items.entries();
		                var index;
		                var entry;
		                while (entry = entries.next()) {
		                    if (entry.done) {
		                        break;
		                    }
		                    if (item === entry.value[1]) {
		                        index = entry.value[0];
		                        break;
		                    }
		                }
		                if (index === undefined) {
		                    return false;
		                }
		                this.$changes.delete(index);
		                this.$indexes.delete(index);
		                return this.$items.delete(index);
		            };
		            CollectionSchema.prototype.clear = function (changes) {
		                // discard previous operations.
		                this.$changes.discard(true, true);
		                this.$changes.indexes = {};
		                // clear previous indexes
		                this.$indexes.clear();
		                //
		                // When decoding:
		                // - enqueue items for DELETE callback.
		                // - flag child items for garbage collection.
		                //
		                if (changes) {
		                    removeChildRefs.call(this, changes);
		                }
		                // clear items
		                this.$items.clear();
		                this.$changes.operation({ index: 0, op: exports.OPERATION.CLEAR });
		                // touch all structures until reach root
		                this.$changes.touchParents();
		            };
		            CollectionSchema.prototype.has = function (value) {
		                return Array.from(this.$items.values()).some(function (v) { return v === value; });
		            };
		            CollectionSchema.prototype.forEach = function (callbackfn) {
		                var _this = this;
		                this.$items.forEach(function (value, key, _) { return callbackfn(value, key, _this); });
		            };
		            CollectionSchema.prototype.values = function () {
		                return this.$items.values();
		            };
		            Object.defineProperty(CollectionSchema.prototype, "size", {
		                get: function () {
		                    return this.$items.size;
		                },
		                enumerable: false,
		                configurable: true
		            });
		            CollectionSchema.prototype.setIndex = function (index, key) {
		                this.$indexes.set(index, key);
		            };
		            CollectionSchema.prototype.getIndex = function (index) {
		                return this.$indexes.get(index);
		            };
		            CollectionSchema.prototype.getByIndex = function (index) {
		                return this.$items.get(this.$indexes.get(index));
		            };
		            CollectionSchema.prototype.deleteByIndex = function (index) {
		                var key = this.$indexes.get(index);
		                this.$items.delete(key);
		                this.$indexes.delete(index);
		            };
		            CollectionSchema.prototype.toArray = function () {
		                return Array.from(this.$items.values());
		            };
		            CollectionSchema.prototype.toJSON = function () {
		                var values = [];
		                this.forEach(function (value, key) {
		                    values.push((typeof (value['toJSON']) === "function")
		                        ? value['toJSON']()
		                        : value);
		                });
		                return values;
		            };
		            //
		            // Decoding utilities
		            //
		            CollectionSchema.prototype.clone = function (isDecoding) {
		                var cloned;
		                if (isDecoding) {
		                    // client-side
		                    cloned = Object.assign(new CollectionSchema(), this);
		                }
		                else {
		                    // server-side
		                    cloned = new CollectionSchema();
		                    this.forEach(function (value) {
		                        if (value['$changes']) {
		                            cloned.add(value['clone']());
		                        }
		                        else {
		                            cloned.add(value);
		                        }
		                    });
		                }
		                return cloned;
		            };
		            return CollectionSchema;
		        }());

		        var SetSchema = /** @class */ (function () {
		            function SetSchema(initialValues) {
		                var _this = this;
		                this.$changes = new ChangeTree(this);
		                this.$items = new Map();
		                this.$indexes = new Map();
		                this.$refId = 0;
		                if (initialValues) {
		                    initialValues.forEach(function (v) { return _this.add(v); });
		                }
		            }
		            SetSchema.prototype.onAdd = function (callback, triggerAll) {
		                if (triggerAll === void 0) { triggerAll = true; }
		                return addCallback((this.$callbacks || (this.$callbacks = [])), exports.OPERATION.ADD, callback, (triggerAll)
		                    ? this.$items
		                    : undefined);
		            };
		            SetSchema.prototype.onRemove = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = []), exports.OPERATION.DELETE, callback); };
		            SetSchema.prototype.onChange = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = []), exports.OPERATION.REPLACE, callback); };
		            SetSchema.is = function (type) {
		                return type['set'] !== undefined;
		            };
		            SetSchema.prototype.add = function (value) {
		                var _a, _b;
		                // immediatelly return false if value already added.
		                if (this.has(value)) {
		                    return false;
		                }
		                // set "index" for reference.
		                var index = this.$refId++;
		                if ((value['$changes']) !== undefined) {
		                    value['$changes'].setParent(this, this.$changes.root, index);
		                }
		                var operation = (_b = (_a = this.$changes.indexes[index]) === null || _a === void 0 ? void 0 : _a.op) !== null && _b !== void 0 ? _b : exports.OPERATION.ADD;
		                this.$changes.indexes[index] = index;
		                this.$indexes.set(index, index);
		                this.$items.set(index, value);
		                this.$changes.change(index, operation);
		                return index;
		            };
		            SetSchema.prototype.entries = function () {
		                return this.$items.entries();
		            };
		            SetSchema.prototype.delete = function (item) {
		                var entries = this.$items.entries();
		                var index;
		                var entry;
		                while (entry = entries.next()) {
		                    if (entry.done) {
		                        break;
		                    }
		                    if (item === entry.value[1]) {
		                        index = entry.value[0];
		                        break;
		                    }
		                }
		                if (index === undefined) {
		                    return false;
		                }
		                this.$changes.delete(index);
		                this.$indexes.delete(index);
		                return this.$items.delete(index);
		            };
		            SetSchema.prototype.clear = function (changes) {
		                // discard previous operations.
		                this.$changes.discard(true, true);
		                this.$changes.indexes = {};
		                // clear previous indexes
		                this.$indexes.clear();
		                //
		                // When decoding:
		                // - enqueue items for DELETE callback.
		                // - flag child items for garbage collection.
		                //
		                if (changes) {
		                    removeChildRefs.call(this, changes);
		                }
		                // clear items
		                this.$items.clear();
		                this.$changes.operation({ index: 0, op: exports.OPERATION.CLEAR });
		                // touch all structures until reach root
		                this.$changes.touchParents();
		            };
		            SetSchema.prototype.has = function (value) {
		                var values = this.$items.values();
		                var has = false;
		                var entry;
		                while (entry = values.next()) {
		                    if (entry.done) {
		                        break;
		                    }
		                    if (value === entry.value) {
		                        has = true;
		                        break;
		                    }
		                }
		                return has;
		            };
		            SetSchema.prototype.forEach = function (callbackfn) {
		                var _this = this;
		                this.$items.forEach(function (value, key, _) { return callbackfn(value, key, _this); });
		            };
		            SetSchema.prototype.values = function () {
		                return this.$items.values();
		            };
		            Object.defineProperty(SetSchema.prototype, "size", {
		                get: function () {
		                    return this.$items.size;
		                },
		                enumerable: false,
		                configurable: true
		            });
		            SetSchema.prototype.setIndex = function (index, key) {
		                this.$indexes.set(index, key);
		            };
		            SetSchema.prototype.getIndex = function (index) {
		                return this.$indexes.get(index);
		            };
		            SetSchema.prototype.getByIndex = function (index) {
		                return this.$items.get(this.$indexes.get(index));
		            };
		            SetSchema.prototype.deleteByIndex = function (index) {
		                var key = this.$indexes.get(index);
		                this.$items.delete(key);
		                this.$indexes.delete(index);
		            };
		            SetSchema.prototype.toArray = function () {
		                return Array.from(this.$items.values());
		            };
		            SetSchema.prototype.toJSON = function () {
		                var values = [];
		                this.forEach(function (value, key) {
		                    values.push((typeof (value['toJSON']) === "function")
		                        ? value['toJSON']()
		                        : value);
		                });
		                return values;
		            };
		            //
		            // Decoding utilities
		            //
		            SetSchema.prototype.clone = function (isDecoding) {
		                var cloned;
		                if (isDecoding) {
		                    // client-side
		                    cloned = Object.assign(new SetSchema(), this);
		                }
		                else {
		                    // server-side
		                    cloned = new SetSchema();
		                    this.forEach(function (value) {
		                        if (value['$changes']) {
		                            cloned.add(value['clone']());
		                        }
		                        else {
		                            cloned.add(value);
		                        }
		                    });
		                }
		                return cloned;
		            };
		            return SetSchema;
		        }());

		        var ClientState = /** @class */ (function () {
		            function ClientState() {
		                this.refIds = new WeakSet();
		                this.containerIndexes = new WeakMap();
		            }
		            // containerIndexes = new Map<ChangeTree, Set<number>>();
		            ClientState.prototype.addRefId = function (changeTree) {
		                if (!this.refIds.has(changeTree)) {
		                    this.refIds.add(changeTree);
		                    this.containerIndexes.set(changeTree, new Set());
		                }
		            };
		            ClientState.get = function (client) {
		                if (client.$filterState === undefined) {
		                    client.$filterState = new ClientState();
		                }
		                return client.$filterState;
		            };
		            return ClientState;
		        }());

		        var ReferenceTracker = /** @class */ (function () {
		            function ReferenceTracker() {
		                //
		                // Relation of refId => Schema structure
		                // For direct access of structures during decoding time.
		                //
		                this.refs = new Map();
		                this.refCounts = {};
		                this.deletedRefs = new Set();
		                this.nextUniqueId = 0;
		            }
		            ReferenceTracker.prototype.getNextUniqueId = function () {
		                return this.nextUniqueId++;
		            };
		            // for decoding
		            ReferenceTracker.prototype.addRef = function (refId, ref, incrementCount) {
		                if (incrementCount === void 0) { incrementCount = true; }
		                this.refs.set(refId, ref);
		                if (incrementCount) {
		                    this.refCounts[refId] = (this.refCounts[refId] || 0) + 1;
		                }
		            };
		            // for decoding
		            ReferenceTracker.prototype.removeRef = function (refId) {
		                this.refCounts[refId] = this.refCounts[refId] - 1;
		                this.deletedRefs.add(refId);
		            };
		            ReferenceTracker.prototype.clearRefs = function () {
		                this.refs.clear();
		                this.deletedRefs.clear();
		                this.refCounts = {};
		            };
		            // for decoding
		            ReferenceTracker.prototype.garbageCollectDeletedRefs = function () {
		                var _this = this;
		                this.deletedRefs.forEach(function (refId) {
		                    //
		                    // Skip active references.
		                    //
		                    if (_this.refCounts[refId] > 0) {
		                        return;
		                    }
		                    var ref = _this.refs.get(refId);
		                    //
		                    // Ensure child schema instances have their references removed as well.
		                    //
		                    if (ref instanceof Schema) {
		                        for (var fieldName in ref['_definition'].schema) {
		                            if (typeof (ref['_definition'].schema[fieldName]) !== "string" &&
		                                ref[fieldName] &&
		                                ref[fieldName]['$changes']) {
		                                _this.removeRef(ref[fieldName]['$changes'].refId);
		                            }
		                        }
		                    }
		                    else {
		                        var definition = ref['$changes'].parent._definition;
		                        var type = definition.schema[definition.fieldsByIndex[ref['$changes'].parentIndex]];
		                        if (typeof (Object.values(type)[0]) === "function") {
		                            Array.from(ref.values())
		                                .forEach(function (child) { return _this.removeRef(child['$changes'].refId); });
		                        }
		                    }
		                    _this.refs.delete(refId);
		                    delete _this.refCounts[refId];
		                });
		                // clear deleted refs.
		                this.deletedRefs.clear();
		            };
		            return ReferenceTracker;
		        }());

		        var EncodeSchemaError = /** @class */ (function (_super) {
		            __extends(EncodeSchemaError, _super);
		            function EncodeSchemaError() {
		                return _super !== null && _super.apply(this, arguments) || this;
		            }
		            return EncodeSchemaError;
		        }(Error));
		        function assertType(value, type, klass, field) {
		            var typeofTarget;
		            var allowNull = false;
		            switch (type) {
		                case "number":
		                case "int8":
		                case "uint8":
		                case "int16":
		                case "uint16":
		                case "int32":
		                case "uint32":
		                case "int64":
		                case "uint64":
		                case "float32":
		                case "float64":
		                    typeofTarget = "number";
		                    if (isNaN(value)) {
		                        console.log("trying to encode \"NaN\" in ".concat(klass.constructor.name, "#").concat(field));
		                    }
		                    break;
		                case "string":
		                    typeofTarget = "string";
		                    allowNull = true;
		                    break;
		                case "boolean":
		                    // boolean is always encoded as true/false based on truthiness
		                    return;
		            }
		            if (typeof (value) !== typeofTarget && (!allowNull || (allowNull && value !== null))) {
		                var foundValue = "'".concat(JSON.stringify(value), "'").concat((value && value.constructor && " (".concat(value.constructor.name, ")")) || '');
		                throw new EncodeSchemaError("a '".concat(typeofTarget, "' was expected, but ").concat(foundValue, " was provided in ").concat(klass.constructor.name, "#").concat(field));
		            }
		        }
		        function assertInstanceType(value, type, klass, field) {
		            if (!(value instanceof type)) {
		                throw new EncodeSchemaError("a '".concat(type.name, "' was expected, but '").concat(value.constructor.name, "' was provided in ").concat(klass.constructor.name, "#").concat(field));
		            }
		        }
		        function encodePrimitiveType(type, bytes, value, klass, field) {
		            assertType(value, type, klass, field);
		            var encodeFunc = encode[type];
		            if (encodeFunc) {
		                encodeFunc(bytes, value);
		            }
		            else {
		                throw new EncodeSchemaError("a '".concat(type, "' was expected, but ").concat(value, " was provided in ").concat(klass.constructor.name, "#").concat(field));
		            }
		        }
		        function decodePrimitiveType(type, bytes, it) {
		            return decode[type](bytes, it);
		        }
		        /**
		         * Schema encoder / decoder
		         */
		        var Schema = /** @class */ (function () {
		            // allow inherited classes to have a constructor
		            function Schema() {
		                var args = [];
		                for (var _i = 0; _i < arguments.length; _i++) {
		                    args[_i] = arguments[_i];
		                }
		                // fix enumerability of fields for end-user
		                Object.defineProperties(this, {
		                    $changes: {
		                        value: new ChangeTree(this, undefined, new ReferenceTracker()),
		                        enumerable: false,
		                        writable: true
		                    },
		                    // $listeners: {
		                    //     value: undefined,
		                    //     enumerable: false,
		                    //     writable: true
		                    // },
		                    $callbacks: {
		                        value: undefined,
		                        enumerable: false,
		                        writable: true
		                    },
		                });
		                var descriptors = this._definition.descriptors;
		                if (descriptors) {
		                    Object.defineProperties(this, descriptors);
		                }
		                //
		                // Assign initial values
		                //
		                if (args[0]) {
		                    this.assign(args[0]);
		                }
		            }
		            Schema.onError = function (e) {
		                console.error(e);
		            };
		            Schema.is = function (type) {
		                return (type['_definition'] &&
		                    type['_definition'].schema !== undefined);
		            };
		            Schema.prototype.onChange = function (callback) {
		                return addCallback((this.$callbacks || (this.$callbacks = [])), exports.OPERATION.REPLACE, callback);
		            };
		            Schema.prototype.onRemove = function (callback) {
		                return addCallback((this.$callbacks || (this.$callbacks = [])), exports.OPERATION.DELETE, callback);
		            };
		            Schema.prototype.assign = function (props) {
		                Object.assign(this, props);
		                return this;
		            };
		            Object.defineProperty(Schema.prototype, "_definition", {
		                get: function () { return this.constructor._definition; },
		                enumerable: false,
		                configurable: true
		            });
		            /**
		             * (Server-side): Flag a property to be encoded for the next patch.
		             * @param instance Schema instance
		             * @param property string representing the property name, or number representing the index of the property.
		             * @param operation OPERATION to perform (detected automatically)
		             */
		            Schema.prototype.setDirty = function (property, operation) {
		                this.$changes.change(property, operation);
		            };
		            /**
		             * Client-side: listen for changes on property.
		             * @param prop the property name
		             * @param callback callback to be triggered on property change
		             * @param immediate trigger immediatelly if property has been already set.
		             */
		            Schema.prototype.listen = function (prop, callback, immediate) {
		                var _this = this;
		                if (immediate === void 0) { immediate = true; }
		                if (!this.$callbacks) {
		                    this.$callbacks = {};
		                }
		                if (!this.$callbacks[prop]) {
		                    this.$callbacks[prop] = [];
		                }
		                this.$callbacks[prop].push(callback);
		                if (immediate && this[prop] !== undefined) {
		                    callback(this[prop], undefined);
		                }
		                // return un-register callback.
		                return function () { return spliceOne(_this.$callbacks[prop], _this.$callbacks[prop].indexOf(callback)); };
		            };
		            Schema.prototype.decode = function (bytes, it, ref) {
		                var _a;
		                if (it === void 0) { it = { offset: 0 }; }
		                if (ref === void 0) { ref = this; }
		                var allChanges = [];
		                var $root = this.$changes.root;
		                var totalBytes = bytes.length;
		                var refId = 0;
		                $root.refs.set(refId, this);
		                while (it.offset < totalBytes) {
		                    var byte = bytes[it.offset++];
		                    if (byte == SWITCH_TO_STRUCTURE) {
		                        refId = number(bytes, it);
		                        var nextRef = $root.refs.get(refId);
		                        //
		                        // Trying to access a reference that haven't been decoded yet.
		                        //
		                        if (!nextRef) {
		                            throw new Error("\"refId\" not found: ".concat(refId));
		                        }
		                        ref = nextRef;
		                        continue;
		                    }
		                    var changeTree = ref['$changes'];
		                    var isSchema = (ref['_definition'] !== undefined);
		                    var operation = (isSchema)
		                        ? (byte >> 6) << 6 // "compressed" index + operation
		                        : byte; // "uncompressed" index + operation (array/map items)
		                    if (operation === exports.OPERATION.CLEAR) {
		                        //
		                        // TODO: refactor me!
		                        // The `.clear()` method is calling `$root.removeRef(refId)` for
		                        // each item inside this collection
		                        //
		                        ref.clear(allChanges);
		                        continue;
		                    }
		                    var fieldIndex = (isSchema)
		                        ? byte % (operation || 255) // if "REPLACE" operation (0), use 255
		                        : number(bytes, it);
		                    var fieldName = (isSchema)
		                        ? (ref['_definition'].fieldsByIndex[fieldIndex])
		                        : "";
		                    var type = changeTree.getType(fieldIndex);
		                    var value = void 0;
		                    var previousValue = void 0;
		                    var dynamicIndex = void 0;
		                    if (!isSchema) {
		                        previousValue = ref['getByIndex'](fieldIndex);
		                        if ((operation & exports.OPERATION.ADD) === exports.OPERATION.ADD) { // ADD or DELETE_AND_ADD
		                            dynamicIndex = (ref instanceof MapSchema)
		                                ? string(bytes, it)
		                                : fieldIndex;
		                            ref['setIndex'](fieldIndex, dynamicIndex);
		                        }
		                        else {
		                            // here
		                            dynamicIndex = ref['getIndex'](fieldIndex);
		                        }
		                    }
		                    else {
		                        previousValue = ref["_".concat(fieldName)];
		                    }
		                    //
		                    // Delete operations
		                    //
		                    if ((operation & exports.OPERATION.DELETE) === exports.OPERATION.DELETE) {
		                        if (operation !== exports.OPERATION.DELETE_AND_ADD) {
		                            ref['deleteByIndex'](fieldIndex);
		                        }
		                        // Flag `refId` for garbage collection.
		                        if (previousValue && previousValue['$changes']) {
		                            $root.removeRef(previousValue['$changes'].refId);
		                        }
		                        value = null;
		                    }
		                    if (fieldName === undefined) {
		                        console.warn("@colyseus/schema: definition mismatch");
		                        //
		                        // keep skipping next bytes until reaches a known structure
		                        // by local decoder.
		                        //
		                        var nextIterator = { offset: it.offset };
		                        while (it.offset < totalBytes) {
		                            if (switchStructureCheck(bytes, it)) {
		                                nextIterator.offset = it.offset + 1;
		                                if ($root.refs.has(number(bytes, nextIterator))) {
		                                    break;
		                                }
		                            }
		                            it.offset++;
		                        }
		                        continue;
		                    }
		                    else if (operation === exports.OPERATION.DELETE) ;
		                    else if (Schema.is(type)) {
		                        var refId_1 = number(bytes, it);
		                        value = $root.refs.get(refId_1);
		                        if (operation !== exports.OPERATION.REPLACE) {
		                            var childType = this.getSchemaType(bytes, it, type);
		                            if (!value) {
		                                value = this.createTypeInstance(childType);
		                                value.$changes.refId = refId_1;
		                                if (previousValue) {
		                                    value.$callbacks = previousValue.$callbacks;
		                                    // value.$listeners = previousValue.$listeners;
		                                    if (previousValue['$changes'].refId &&
		                                        refId_1 !== previousValue['$changes'].refId) {
		                                        $root.removeRef(previousValue['$changes'].refId);
		                                    }
		                                }
		                            }
		                            $root.addRef(refId_1, value, (value !== previousValue));
		                        }
		                    }
		                    else if (typeof (type) === "string") {
		                        //
		                        // primitive value (number, string, boolean, etc)
		                        //
		                        value = decodePrimitiveType(type, bytes, it);
		                    }
		                    else {
		                        var typeDef = getType(Object.keys(type)[0]);
		                        var refId_2 = number(bytes, it);
		                        var valueRef = ($root.refs.has(refId_2))
		                            ? previousValue || $root.refs.get(refId_2)
		                            : new typeDef.constructor();
		                        value = valueRef.clone(true);
		                        value.$changes.refId = refId_2;
		                        // preserve schema callbacks
		                        if (previousValue) {
		                            value['$callbacks'] = previousValue['$callbacks'];
		                            if (previousValue['$changes'].refId &&
		                                refId_2 !== previousValue['$changes'].refId) {
		                                $root.removeRef(previousValue['$changes'].refId);
		                                //
		                                // Trigger onRemove if structure has been replaced.
		                                //
		                                var entries = previousValue.entries();
		                                var iter = void 0;
		                                while ((iter = entries.next()) && !iter.done) {
		                                    var key = (_a = iter.value, _a[0]), value_1 = _a[1];
		                                    allChanges.push({
		                                        refId: refId_2,
		                                        op: exports.OPERATION.DELETE,
		                                        field: key,
		                                        value: undefined,
		                                        previousValue: value_1,
		                                    });
		                                }
		                            }
		                        }
		                        $root.addRef(refId_2, value, (valueRef !== previousValue));
		                    }
		                    if (value !== null &&
		                        value !== undefined) {
		                        if (value['$changes']) {
		                            value['$changes'].setParent(changeTree.ref, changeTree.root, fieldIndex);
		                        }
		                        if (ref instanceof Schema) {
		                            ref[fieldName] = value;
		                            // ref[`_${fieldName}`] = value;
		                        }
		                        else if (ref instanceof MapSchema) {
		                            // const key = ref['$indexes'].get(field);
		                            var key = dynamicIndex;
		                            // ref.set(key, value);
		                            ref['$items'].set(key, value);
		                            ref['$changes'].allChanges.add(fieldIndex);
		                        }
		                        else if (ref instanceof ArraySchema) {
		                            // const key = ref['$indexes'][field];
		                            // console.log("SETTING FOR ArraySchema =>", { field, key, value });
		                            // ref[key] = value;
		                            ref.setAt(fieldIndex, value);
		                        }
		                        else if (ref instanceof CollectionSchema) {
		                            var index = ref.add(value);
		                            ref['setIndex'](fieldIndex, index);
		                        }
		                        else if (ref instanceof SetSchema) {
		                            var index = ref.add(value);
		                            if (index !== false) {
		                                ref['setIndex'](fieldIndex, index);
		                            }
		                        }
		                    }
		                    if (previousValue !== value) {
		                        allChanges.push({
		                            refId: refId,
		                            op: operation,
		                            field: fieldName,
		                            dynamicIndex: dynamicIndex,
		                            value: value,
		                            previousValue: previousValue,
		                        });
		                    }
		                }
		                this._triggerChanges(allChanges);
		                // drop references of unused schemas
		                $root.garbageCollectDeletedRefs();
		                return allChanges;
		            };
		            Schema.prototype.encode = function (encodeAll, bytes, useFilters) {
		                if (encodeAll === void 0) { encodeAll = false; }
		                if (bytes === void 0) { bytes = []; }
		                if (useFilters === void 0) { useFilters = false; }
		                var rootChangeTree = this.$changes;
		                var refIdsVisited = new WeakSet();
		                var changeTrees = [rootChangeTree];
		                var numChangeTrees = 1;
		                for (var i = 0; i < numChangeTrees; i++) {
		                    var changeTree = changeTrees[i];
		                    var ref = changeTree.ref;
		                    var isSchema = (ref instanceof Schema);
		                    // Generate unique refId for the ChangeTree.
		                    changeTree.ensureRefId();
		                    // mark this ChangeTree as visited.
		                    refIdsVisited.add(changeTree);
		                    // root `refId` is skipped.
		                    if (changeTree !== rootChangeTree &&
		                        (changeTree.changed || encodeAll)) {
		                        uint8$1(bytes, SWITCH_TO_STRUCTURE);
		                        number$1(bytes, changeTree.refId);
		                    }
		                    var changes = (encodeAll)
		                        ? Array.from(changeTree.allChanges)
		                        : Array.from(changeTree.changes.values());
		                    for (var j = 0, cl = changes.length; j < cl; j++) {
		                        var operation = (encodeAll)
		                            ? { op: exports.OPERATION.ADD, index: changes[j] }
		                            : changes[j];
		                        var fieldIndex = operation.index;
		                        var field = (isSchema)
		                            ? ref['_definition'].fieldsByIndex && ref['_definition'].fieldsByIndex[fieldIndex]
		                            : fieldIndex;
		                        // cache begin index if `useFilters`
		                        var beginIndex = bytes.length;
		                        // encode field index + operation
		                        if (operation.op !== exports.OPERATION.TOUCH) {
		                            if (isSchema) {
		                                //
		                                // Compress `fieldIndex` + `operation` into a single byte.
		                                // This adds a limitaion of 64 fields per Schema structure
		                                //
		                                uint8$1(bytes, (fieldIndex | operation.op));
		                            }
		                            else {
		                                uint8$1(bytes, operation.op);
		                                // custom operations
		                                if (operation.op === exports.OPERATION.CLEAR) {
		                                    continue;
		                                }
		                                // indexed operations
		                                number$1(bytes, fieldIndex);
		                            }
		                        }
		                        //
		                        // encode "alias" for dynamic fields (maps)
		                        //
		                        if (!isSchema &&
		                            (operation.op & exports.OPERATION.ADD) == exports.OPERATION.ADD // ADD or DELETE_AND_ADD
		                        ) {
		                            if (ref instanceof MapSchema) {
		                                //
		                                // MapSchema dynamic key
		                                //
		                                var dynamicIndex = changeTree.ref['$indexes'].get(fieldIndex);
		                                string$1(bytes, dynamicIndex);
		                            }
		                        }
		                        if (operation.op === exports.OPERATION.DELETE) {
		                            //
		                            // TODO: delete from filter cache data.
		                            //
		                            // if (useFilters) {
		                            //     delete changeTree.caches[fieldIndex];
		                            // }
		                            continue;
		                        }
		                        // const type = changeTree.childType || ref._schema[field];
		                        var type = changeTree.getType(fieldIndex);
		                        // const type = changeTree.getType(fieldIndex);
		                        var value = changeTree.getValue(fieldIndex);
		                        // Enqueue ChangeTree to be visited
		                        if (value &&
		                            value['$changes'] &&
		                            !refIdsVisited.has(value['$changes'])) {
		                            changeTrees.push(value['$changes']);
		                            value['$changes'].ensureRefId();
		                            numChangeTrees++;
		                        }
		                        if (operation.op === exports.OPERATION.TOUCH) {
		                            continue;
		                        }
		                        if (Schema.is(type)) {
		                            assertInstanceType(value, type, ref, field);
		                            //
		                            // Encode refId for this instance.
		                            // The actual instance is going to be encoded on next `changeTree` iteration.
		                            //
		                            number$1(bytes, value.$changes.refId);
		                            // Try to encode inherited TYPE_ID if it's an ADD operation.
		                            if ((operation.op & exports.OPERATION.ADD) === exports.OPERATION.ADD) {
		                                this.tryEncodeTypeId(bytes, type, value.constructor);
		                            }
		                        }
		                        else if (typeof (type) === "string") {
		                            //
		                            // Primitive values
		                            //
		                            encodePrimitiveType(type, bytes, value, ref, field);
		                        }
		                        else {
		                            //
		                            // Custom type (MapSchema, ArraySchema, etc)
		                            //
		                            var definition = getType(Object.keys(type)[0]);
		                            //
		                            // ensure a ArraySchema has been provided
		                            //
		                            assertInstanceType(ref["_".concat(field)], definition.constructor, ref, field);
		                            //
		                            // Encode refId for this instance.
		                            // The actual instance is going to be encoded on next `changeTree` iteration.
		                            //
		                            number$1(bytes, value.$changes.refId);
		                        }
		                        if (useFilters) {
		                            // cache begin / end index
		                            changeTree.cache(fieldIndex, bytes.slice(beginIndex));
		                        }
		                    }
		                    if (!encodeAll && !useFilters) {
		                        changeTree.discard();
		                    }
		                }
		                return bytes;
		            };
		            Schema.prototype.encodeAll = function (useFilters) {
		                return this.encode(true, [], useFilters);
		            };
		            Schema.prototype.applyFilters = function (client, encodeAll) {
		                var _a, _b;
		                if (encodeAll === void 0) { encodeAll = false; }
		                var root = this;
		                var refIdsDissallowed = new Set();
		                var $filterState = ClientState.get(client);
		                var changeTrees = [this.$changes];
		                var numChangeTrees = 1;
		                var filteredBytes = [];
		                var _loop_1 = function (i) {
		                    var changeTree = changeTrees[i];
		                    if (refIdsDissallowed.has(changeTree.refId)) {
		                        return "continue";
		                    }
		                    var ref = changeTree.ref;
		                    var isSchema = ref instanceof Schema;
		                    uint8$1(filteredBytes, SWITCH_TO_STRUCTURE);
		                    number$1(filteredBytes, changeTree.refId);
		                    var clientHasRefId = $filterState.refIds.has(changeTree);
		                    var isEncodeAll = (encodeAll || !clientHasRefId);
		                    // console.log("REF:", ref.constructor.name);
		                    // console.log("Encode all?", isEncodeAll);
		                    //
		                    // include `changeTree` on list of known refIds by this client.
		                    //
		                    $filterState.addRefId(changeTree);
		                    var containerIndexes = $filterState.containerIndexes.get(changeTree);
		                    var changes = (isEncodeAll)
		                        ? Array.from(changeTree.allChanges)
		                        : Array.from(changeTree.changes.values());
		                    //
		                    // WORKAROUND: tries to re-evaluate previously not included @filter() attributes
		                    // - see "DELETE a field of Schema" test case.
		                    //
		                    if (!encodeAll &&
		                        isSchema &&
		                        ref._definition.indexesWithFilters) {
		                        var indexesWithFilters = ref._definition.indexesWithFilters;
		                        indexesWithFilters.forEach(function (indexWithFilter) {
		                            if (!containerIndexes.has(indexWithFilter) &&
		                                changeTree.allChanges.has(indexWithFilter)) {
		                                if (isEncodeAll) {
		                                    changes.push(indexWithFilter);
		                                }
		                                else {
		                                    changes.push({ op: exports.OPERATION.ADD, index: indexWithFilter, });
		                                }
		                            }
		                        });
		                    }
		                    for (var j = 0, cl = changes.length; j < cl; j++) {
		                        var change = (isEncodeAll)
		                            ? { op: exports.OPERATION.ADD, index: changes[j] }
		                            : changes[j];
		                        // custom operations
		                        if (change.op === exports.OPERATION.CLEAR) {
		                            uint8$1(filteredBytes, change.op);
		                            continue;
		                        }
		                        var fieldIndex = change.index;
		                        //
		                        // Deleting fields: encode the operation + field index
		                        //
		                        if (change.op === exports.OPERATION.DELETE) {
		                            //
		                            // DELETE operations also need to go through filtering.
		                            //
		                            // TODO: cache the previous value so we can access the value (primitive or `refId`)
		                            // (check against `$filterState.refIds`)
		                            //
		                            if (isSchema) {
		                                uint8$1(filteredBytes, change.op | fieldIndex);
		                            }
		                            else {
		                                uint8$1(filteredBytes, change.op);
		                                number$1(filteredBytes, fieldIndex);
		                            }
		                            continue;
		                        }
		                        // indexed operation
		                        var value = changeTree.getValue(fieldIndex);
		                        var type = changeTree.getType(fieldIndex);
		                        if (isSchema) {
		                            // Is a Schema!
		                            var filter = (ref._definition.filters &&
		                                ref._definition.filters[fieldIndex]);
		                            if (filter && !filter.call(ref, client, value, root)) {
		                                if (value && value['$changes']) {
		                                    refIdsDissallowed.add(value['$changes'].refId);
		                                }
		                                continue;
		                            }
		                        }
		                        else {
		                            // Is a collection! (map, array, etc.)
		                            var parent = changeTree.parent;
		                            var filter = changeTree.getChildrenFilter();
		                            if (filter && !filter.call(parent, client, ref['$indexes'].get(fieldIndex), value, root)) {
		                                if (value && value['$changes']) {
		                                    refIdsDissallowed.add(value['$changes'].refId);
		                                }
		                                continue;
		                            }
		                        }
		                        // visit child ChangeTree on further iteration.
		                        if (value['$changes']) {
		                            changeTrees.push(value['$changes']);
		                            numChangeTrees++;
		                        }
		                        //
		                        // Copy cached bytes
		                        //
		                        if (change.op !== exports.OPERATION.TOUCH) {
		                            //
		                            // TODO: refactor me!
		                            //
		                            if (change.op === exports.OPERATION.ADD || isSchema) {
		                                //
		                                // use cached bytes directly if is from Schema type.
		                                //
		                                filteredBytes.push.apply(filteredBytes, (_a = changeTree.caches[fieldIndex]) !== null && _a !== void 0 ? _a : []);
		                                containerIndexes.add(fieldIndex);
		                            }
		                            else {
		                                if (containerIndexes.has(fieldIndex)) {
		                                    //
		                                    // use cached bytes if already has the field
		                                    //
		                                    filteredBytes.push.apply(filteredBytes, (_b = changeTree.caches[fieldIndex]) !== null && _b !== void 0 ? _b : []);
		                                }
		                                else {
		                                    //
		                                    // force ADD operation if field is not known by this client.
		                                    //
		                                    containerIndexes.add(fieldIndex);
		                                    uint8$1(filteredBytes, exports.OPERATION.ADD);
		                                    number$1(filteredBytes, fieldIndex);
		                                    if (ref instanceof MapSchema) {
		                                        //
		                                        // MapSchema dynamic key
		                                        //
		                                        var dynamicIndex = changeTree.ref['$indexes'].get(fieldIndex);
		                                        string$1(filteredBytes, dynamicIndex);
		                                    }
		                                    if (value['$changes']) {
		                                        number$1(filteredBytes, value['$changes'].refId);
		                                    }
		                                    else {
		                                        // "encodePrimitiveType" without type checking.
		                                        // the type checking has been done on the first .encode() call.
		                                        encode[type](filteredBytes, value);
		                                    }
		                                }
		                            }
		                        }
		                        else if (value['$changes'] && !isSchema) {
		                            //
		                            // TODO:
		                            // - track ADD/REPLACE/DELETE instances on `$filterState`
		                            // - do NOT always encode dynamicIndex for MapSchema.
		                            //   (If client already has that key, only the first index is necessary.)
		                            //
		                            uint8$1(filteredBytes, exports.OPERATION.ADD);
		                            number$1(filteredBytes, fieldIndex);
		                            if (ref instanceof MapSchema) {
		                                //
		                                // MapSchema dynamic key
		                                //
		                                var dynamicIndex = changeTree.ref['$indexes'].get(fieldIndex);
		                                string$1(filteredBytes, dynamicIndex);
		                            }
		                            number$1(filteredBytes, value['$changes'].refId);
		                        }
		                    }
		                };
		                for (var i = 0; i < numChangeTrees; i++) {
		                    _loop_1(i);
		                }
		                return filteredBytes;
		            };
		            Schema.prototype.clone = function () {
		                var _a;
		                var cloned = new (this.constructor);
		                var schema = this._definition.schema;
		                for (var field in schema) {
		                    if (typeof (this[field]) === "object" &&
		                        typeof ((_a = this[field]) === null || _a === void 0 ? void 0 : _a.clone) === "function") {
		                        // deep clone
		                        cloned[field] = this[field].clone();
		                    }
		                    else {
		                        // primitive values
		                        cloned[field] = this[field];
		                    }
		                }
		                return cloned;
		            };
		            Schema.prototype.toJSON = function () {
		                var schema = this._definition.schema;
		                var deprecated = this._definition.deprecated;
		                var obj = {};
		                for (var field in schema) {
		                    if (!deprecated[field] && this[field] !== null && typeof (this[field]) !== "undefined") {
		                        obj[field] = (typeof (this[field]['toJSON']) === "function")
		                            ? this[field]['toJSON']()
		                            : this["_".concat(field)];
		                    }
		                }
		                return obj;
		            };
		            Schema.prototype.discardAllChanges = function () {
		                this.$changes.discardAll();
		            };
		            Schema.prototype.getByIndex = function (index) {
		                return this[this._definition.fieldsByIndex[index]];
		            };
		            Schema.prototype.deleteByIndex = function (index) {
		                this[this._definition.fieldsByIndex[index]] = undefined;
		            };
		            Schema.prototype.tryEncodeTypeId = function (bytes, type, targetType) {
		                if (type._typeid !== targetType._typeid) {
		                    uint8$1(bytes, TYPE_ID);
		                    number$1(bytes, targetType._typeid);
		                }
		            };
		            Schema.prototype.getSchemaType = function (bytes, it, defaultType) {
		                var type;
		                if (bytes[it.offset] === TYPE_ID) {
		                    it.offset++;
		                    type = this.constructor._context.get(number(bytes, it));
		                }
		                return type || defaultType;
		            };
		            Schema.prototype.createTypeInstance = function (type) {
		                var instance = new type();
		                // assign root on $changes
		                instance.$changes.root = this.$changes.root;
		                return instance;
		            };
		            Schema.prototype._triggerChanges = function (changes) {
		                var _a, _b, _c, _d, _e, _f, _g, _h, _j;
		                var uniqueRefIds = new Set();
		                var $refs = this.$changes.root.refs;
		                var _loop_2 = function (i) {
		                    var change = changes[i];
		                    var refId = change.refId;
		                    var ref = $refs.get(refId);
		                    var $callbacks = ref['$callbacks'];
		                    //
		                    // trigger onRemove on child structure.
		                    //
		                    if ((change.op & exports.OPERATION.DELETE) === exports.OPERATION.DELETE &&
		                        change.previousValue instanceof Schema) {
		                        (_b = (_a = change.previousValue['$callbacks']) === null || _a === void 0 ? void 0 : _a[exports.OPERATION.DELETE]) === null || _b === void 0 ? void 0 : _b.forEach(function (callback) { return callback(); });
		                    }
		                    // no callbacks defined, skip this structure!
		                    if (!$callbacks) {
		                        return "continue";
		                    }
		                    if (ref instanceof Schema) {
		                        if (!uniqueRefIds.has(refId)) {
		                            try {
		                                // trigger onChange
		                                (_c = $callbacks === null || $callbacks === void 0 ? void 0 : $callbacks[exports.OPERATION.REPLACE]) === null || _c === void 0 ? void 0 : _c.forEach(function (callback) {
		                                    return callback(changes);
		                                });
		                            }
		                            catch (e) {
		                                Schema.onError(e);
		                            }
		                        }
		                        try {
		                            if ($callbacks.hasOwnProperty(change.field)) {
		                                (_d = $callbacks[change.field]) === null || _d === void 0 ? void 0 : _d.forEach(function (callback) {
		                                    return callback(change.value, change.previousValue);
		                                });
		                            }
		                        }
		                        catch (e) {
		                            Schema.onError(e);
		                        }
		                    }
		                    else {
		                        // is a collection of items
		                        if (change.op === exports.OPERATION.ADD && change.previousValue === undefined) {
		                            // triger onAdd
		                            (_e = $callbacks[exports.OPERATION.ADD]) === null || _e === void 0 ? void 0 : _e.forEach(function (callback) { var _a; return callback(change.value, (_a = change.dynamicIndex) !== null && _a !== void 0 ? _a : change.field); });
		                        }
		                        else if (change.op === exports.OPERATION.DELETE) {
		                            //
		                            // FIXME: `previousValue` should always be available.
		                            // ADD + DELETE operations are still encoding DELETE operation.
		                            //
		                            if (change.previousValue !== undefined) {
		                                // triger onRemove
		                                (_f = $callbacks[exports.OPERATION.DELETE]) === null || _f === void 0 ? void 0 : _f.forEach(function (callback) { var _a; return callback(change.previousValue, (_a = change.dynamicIndex) !== null && _a !== void 0 ? _a : change.field); });
		                            }
		                        }
		                        else if (change.op === exports.OPERATION.DELETE_AND_ADD) {
		                            // triger onRemove
		                            if (change.previousValue !== undefined) {
		                                (_g = $callbacks[exports.OPERATION.DELETE]) === null || _g === void 0 ? void 0 : _g.forEach(function (callback) { var _a; return callback(change.previousValue, (_a = change.dynamicIndex) !== null && _a !== void 0 ? _a : change.field); });
		                            }
		                            // triger onAdd
		                            (_h = $callbacks[exports.OPERATION.ADD]) === null || _h === void 0 ? void 0 : _h.forEach(function (callback) { var _a; return callback(change.value, (_a = change.dynamicIndex) !== null && _a !== void 0 ? _a : change.field); });
		                        }
		                        // trigger onChange
		                        if (change.value !== change.previousValue) {
		                            (_j = $callbacks[exports.OPERATION.REPLACE]) === null || _j === void 0 ? void 0 : _j.forEach(function (callback) { var _a; return callback(change.value, (_a = change.dynamicIndex) !== null && _a !== void 0 ? _a : change.field); });
		                        }
		                    }
		                    uniqueRefIds.add(refId);
		                };
		                for (var i = 0; i < changes.length; i++) {
		                    _loop_2(i);
		                }
		            };
		            Schema._definition = SchemaDefinition.create();
		            return Schema;
		        }());

		        function dumpChanges(schema) {
		            var changeTrees = [schema['$changes']];
		            var numChangeTrees = 1;
		            var dump = {};
		            var currentStructure = dump;
		            var _loop_1 = function (i) {
		                var changeTree = changeTrees[i];
		                changeTree.changes.forEach(function (change) {
		                    var ref = changeTree.ref;
		                    var fieldIndex = change.index;
		                    var field = (ref['_definition'])
		                        ? ref['_definition'].fieldsByIndex[fieldIndex]
		                        : ref['$indexes'].get(fieldIndex);
		                    currentStructure[field] = changeTree.getValue(fieldIndex);
		                });
		            };
		            for (var i = 0; i < numChangeTrees; i++) {
		                _loop_1(i);
		            }
		            return dump;
		        }

		        var reflectionContext = { context: new Context() };
		        /**
		         * Reflection
		         */
		        var ReflectionField = /** @class */ (function (_super) {
		            __extends(ReflectionField, _super);
		            function ReflectionField() {
		                return _super !== null && _super.apply(this, arguments) || this;
		            }
		            __decorate([
		                type("string", reflectionContext)
		            ], ReflectionField.prototype, "name", void 0);
		            __decorate([
		                type("string", reflectionContext)
		            ], ReflectionField.prototype, "type", void 0);
		            __decorate([
		                type("number", reflectionContext)
		            ], ReflectionField.prototype, "referencedType", void 0);
		            return ReflectionField;
		        }(Schema));
		        var ReflectionType = /** @class */ (function (_super) {
		            __extends(ReflectionType, _super);
		            function ReflectionType() {
		                var _this = _super !== null && _super.apply(this, arguments) || this;
		                _this.fields = new ArraySchema();
		                return _this;
		            }
		            __decorate([
		                type("number", reflectionContext)
		            ], ReflectionType.prototype, "id", void 0);
		            __decorate([
		                type([ReflectionField], reflectionContext)
		            ], ReflectionType.prototype, "fields", void 0);
		            return ReflectionType;
		        }(Schema));
		        var Reflection = /** @class */ (function (_super) {
		            __extends(Reflection, _super);
		            function Reflection() {
		                var _this = _super !== null && _super.apply(this, arguments) || this;
		                _this.types = new ArraySchema();
		                return _this;
		            }
		            Reflection.encode = function (instance) {
		                var rootSchemaType = instance.constructor;
		                var reflection = new Reflection();
		                reflection.rootType = rootSchemaType._typeid;
		                var buildType = function (currentType, schema) {
		                    for (var fieldName in schema) {
		                        var field = new ReflectionField();
		                        field.name = fieldName;
		                        var fieldType = void 0;
		                        if (typeof (schema[fieldName]) === "string") {
		                            fieldType = schema[fieldName];
		                        }
		                        else {
		                            var type_1 = schema[fieldName];
		                            var childTypeSchema = void 0;
		                            //
		                            // TODO: refactor below.
		                            //
		                            if (Schema.is(type_1)) {
		                                fieldType = "ref";
		                                childTypeSchema = schema[fieldName];
		                            }
		                            else {
		                                fieldType = Object.keys(type_1)[0];
		                                if (typeof (type_1[fieldType]) === "string") {
		                                    fieldType += ":" + type_1[fieldType]; // array:string
		                                }
		                                else {
		                                    childTypeSchema = type_1[fieldType];
		                                }
		                            }
		                            field.referencedType = (childTypeSchema)
		                                ? childTypeSchema._typeid
		                                : -1;
		                        }
		                        field.type = fieldType;
		                        currentType.fields.push(field);
		                    }
		                    reflection.types.push(currentType);
		                };
		                var types = rootSchemaType._context.types;
		                for (var typeid in types) {
		                    var type_2 = new ReflectionType();
		                    type_2.id = Number(typeid);
		                    buildType(type_2, types[typeid]._definition.schema);
		                }
		                return reflection.encodeAll();
		            };
		            Reflection.decode = function (bytes, it) {
		                var context = new Context();
		                var reflection = new Reflection();
		                reflection.decode(bytes, it);
		                var schemaTypes = reflection.types.reduce(function (types, reflectionType) {
		                    var schema = /** @class */ (function (_super) {
		                        __extends(_, _super);
		                        function _() {
		                            return _super !== null && _super.apply(this, arguments) || this;
		                        }
		                        return _;
		                    }(Schema));
		                    var typeid = reflectionType.id;
		                    types[typeid] = schema;
		                    context.add(schema, typeid);
		                    return types;
		                }, {});
		                reflection.types.forEach(function (reflectionType) {
		                    var schemaType = schemaTypes[reflectionType.id];
		                    reflectionType.fields.forEach(function (field) {
		                        var _a;
		                        if (field.referencedType !== undefined) {
		                            var fieldType = field.type;
		                            var refType = schemaTypes[field.referencedType];
		                            // map or array of primitive type (-1)
		                            if (!refType) {
		                                var typeInfo = field.type.split(":");
		                                fieldType = typeInfo[0];
		                                refType = typeInfo[1];
		                            }
		                            if (fieldType === "ref") {
		                                type(refType, { context: context })(schemaType.prototype, field.name);
		                            }
		                            else {
		                                type((_a = {}, _a[fieldType] = refType, _a), { context: context })(schemaType.prototype, field.name);
		                            }
		                        }
		                        else {
		                            type(field.type, { context: context })(schemaType.prototype, field.name);
		                        }
		                    });
		                });
		                var rootType = schemaTypes[reflection.rootType];
		                var rootInstance = new rootType();
		                /**
		                 * auto-initialize referenced types on root type
		                 * to allow registering listeners immediatelly on client-side
		                 */
		                for (var fieldName in rootType._definition.schema) {
		                    var fieldType = rootType._definition.schema[fieldName];
		                    if (typeof (fieldType) !== "string") {
		                        rootInstance[fieldName] = (typeof (fieldType) === "function")
		                            ? new fieldType() // is a schema reference
		                            : new (getType(Object.keys(fieldType)[0])).constructor(); // is a "collection"
		                    }
		                }
		                return rootInstance;
		            };
		            __decorate([
		                type([ReflectionType], reflectionContext)
		            ], Reflection.prototype, "types", void 0);
		            __decorate([
		                type("number", reflectionContext)
		            ], Reflection.prototype, "rootType", void 0);
		            return Reflection;
		        }(Schema));

		        registerType("map", { constructor: MapSchema });
		        registerType("array", { constructor: ArraySchema });
		        registerType("set", { constructor: SetSchema });
		        registerType("collection", { constructor: CollectionSchema, });

		        exports.ArraySchema = ArraySchema;
		        exports.CollectionSchema = CollectionSchema;
		        exports.Context = Context;
		        exports.MapSchema = MapSchema;
		        exports.Reflection = Reflection;
		        exports.ReflectionField = ReflectionField;
		        exports.ReflectionType = ReflectionType;
		        exports.Schema = Schema;
		        exports.SchemaDefinition = SchemaDefinition;
		        exports.SetSchema = SetSchema;
		        exports.decode = decode;
		        exports.defineTypes = defineTypes;
		        exports.deprecated = deprecated;
		        exports.dumpChanges = dumpChanges;
		        exports.encode = encode;
		        exports.filter = filter;
		        exports.filterChildren = filterChildren;
		        exports.hasFilter = hasFilter;
		        exports.registerType = registerType;
		        exports.type = type;

		        Object.defineProperty(exports, '__esModule', { value: true });

		    }));
		    });

		    var Room = /** @class */ (function () {
		        function Room(name, rootSchema) {
		            var _this = this;
		            // Public signals
		            this.onStateChange = createSignal();
		            this.onError = createSignal();
		            this.onLeave = createSignal();
		            this.onJoin = createSignal();
		            this.hasJoined = false;
		            this.onMessageHandlers = createNanoEvents();
		            this.roomId = null;
		            this.name = name;
		            if (rootSchema) {
		                this.serializer = new (getSerializer("schema"));
		                this.rootSchema = rootSchema;
		                this.serializer.state = new rootSchema();
		            }
		            this.onError(function (code, message) { var _a; return (_a = console.warn) === null || _a === void 0 ? void 0 : _a.call(console, "colyseus.js - onError => (".concat(code, ") ").concat(message)); });
		            this.onLeave(function () { return _this.removeAllListeners(); });
		        }
		        Object.defineProperty(Room.prototype, "id", {
		            // TODO: deprecate me on version 1.0
		            get: function () { return this.roomId; },
		            enumerable: false,
		            configurable: true
		        });
		        Room.prototype.connect = function (endpoint, devModeCloseCallback, room // when reconnecting on devMode, re-use previous room intance for handling events.
		        ) {
		            if (room === void 0) { room = this; }
		            var connection = new Connection();
		            room.connection = connection;
		            connection.events.onmessage = Room.prototype.onMessageCallback.bind(room);
		            connection.events.onclose = function (e) {
		                var _a;
		                if (!room.hasJoined) {
		                    (_a = console.warn) === null || _a === void 0 ? void 0 : _a.call(console, "Room connection was closed unexpectedly (".concat(e.code, "): ").concat(e.reason));
		                    room.onError.invoke(e.code, e.reason);
		                    return;
		                }
		                if (e.code === CloseCode.DEVMODE_RESTART && devModeCloseCallback) {
		                    devModeCloseCallback();
		                }
		                else {
		                    room.onLeave.invoke(e.code);
		                    room.destroy();
		                }
		            };
		            connection.events.onerror = function (e) {
		                var _a;
		                (_a = console.warn) === null || _a === void 0 ? void 0 : _a.call(console, "Room, onError (".concat(e.code, "): ").concat(e.reason));
		                room.onError.invoke(e.code, e.reason);
		            };
		            connection.connect(endpoint);
		        };
		        Room.prototype.leave = function (consented) {
		            var _this = this;
		            if (consented === void 0) { consented = true; }
		            return new Promise(function (resolve) {
		                _this.onLeave(function (code) { return resolve(code); });
		                if (_this.connection) {
		                    if (consented) {
		                        _this.connection.send([exports.Protocol.LEAVE_ROOM]);
		                    }
		                    else {
		                        _this.connection.close();
		                    }
		                }
		                else {
		                    _this.onLeave.invoke(CloseCode.CONSENTED);
		                }
		            });
		        };
		        Room.prototype.onMessage = function (type, callback) {
		            return this.onMessageHandlers.on(this.getMessageHandlerKey(type), callback);
		        };
		        Room.prototype.send = function (type, message) {
		            var initialBytes = [exports.Protocol.ROOM_DATA];
		            if (typeof (type) === "string") {
		                umd.encode.string(initialBytes, type);
		            }
		            else {
		                umd.encode.number(initialBytes, type);
		            }
		            var arr;
		            if (message !== undefined) {
		                var encoded = encode(message);
		                arr = new Uint8Array(initialBytes.length + encoded.byteLength);
		                arr.set(new Uint8Array(initialBytes), 0);
		                arr.set(new Uint8Array(encoded), initialBytes.length);
		            }
		            else {
		                arr = new Uint8Array(initialBytes);
		            }
		            this.connection.send(arr.buffer);
		        };
		        Room.prototype.sendBytes = function (type, bytes) {
		            var initialBytes = [exports.Protocol.ROOM_DATA_BYTES];
		            if (typeof (type) === "string") {
		                umd.encode.string(initialBytes, type);
		            }
		            else {
		                umd.encode.number(initialBytes, type);
		            }
		            var arr;
		            arr = new Uint8Array(initialBytes.length + (bytes.byteLength || bytes.length));
		            arr.set(new Uint8Array(initialBytes), 0);
		            arr.set(new Uint8Array(bytes), initialBytes.length);
		            this.connection.send(arr.buffer);
		        };
		        Object.defineProperty(Room.prototype, "state", {
		            get: function () {
		                return this.serializer.getState();
		            },
		            enumerable: false,
		            configurable: true
		        });
		        Room.prototype.removeAllListeners = function () {
		            this.onJoin.clear();
		            this.onStateChange.clear();
		            this.onError.clear();
		            this.onLeave.clear();
		            this.onMessageHandlers.events = {};
		        };
		        Room.prototype.onMessageCallback = function (event) {
		            var bytes = Array.from(new Uint8Array(event.data));
		            var code = bytes[0];
		            if (code === exports.Protocol.JOIN_ROOM) {
		                var offset = 1;
		                var reconnectionToken = utf8Read(bytes, offset);
		                offset += utf8Length(reconnectionToken);
		                this.serializerId = utf8Read(bytes, offset);
		                offset += utf8Length(this.serializerId);
		                // Instantiate serializer if not locally available.
		                if (!this.serializer) {
		                    var serializer = getSerializer(this.serializerId);
		                    this.serializer = new serializer();
		                }
		                if (bytes.length > offset && this.serializer.handshake) {
		                    this.serializer.handshake(bytes, { offset: offset });
		                }
		                this.reconnectionToken = "".concat(this.roomId, ":").concat(reconnectionToken);
		                this.hasJoined = true;
		                this.onJoin.invoke();
		                // acknowledge successfull JOIN_ROOM
		                this.connection.send([exports.Protocol.JOIN_ROOM]);
		            }
		            else if (code === exports.Protocol.ERROR) {
		                var it_1 = { offset: 1 };
		                var code_1 = umd.decode.number(bytes, it_1);
		                var message = umd.decode.string(bytes, it_1);
		                this.onError.invoke(code_1, message);
		            }
		            else if (code === exports.Protocol.LEAVE_ROOM) {
		                this.leave();
		            }
		            else if (code === exports.Protocol.ROOM_DATA_SCHEMA) {
		                var it_2 = { offset: 1 };
		                var context_1 = this.serializer.getState().constructor._context;
		                var type = context_1.get(umd.decode.number(bytes, it_2));
		                var message = new type();
		                message.decode(bytes, it_2);
		                this.dispatchMessage(type, message);
		            }
		            else if (code === exports.Protocol.ROOM_STATE) {
		                bytes.shift(); // drop `code` byte
		                this.setState(bytes);
		            }
		            else if (code === exports.Protocol.ROOM_STATE_PATCH) {
		                bytes.shift(); // drop `code` byte
		                this.patch(bytes);
		            }
		            else if (code === exports.Protocol.ROOM_DATA) {
		                var it_3 = { offset: 1 };
		                var type = (umd.decode.stringCheck(bytes, it_3))
		                    ? umd.decode.string(bytes, it_3)
		                    : umd.decode.number(bytes, it_3);
		                var message = (bytes.length > it_3.offset)
		                    ? decode(event.data, it_3.offset)
		                    : undefined;
		                this.dispatchMessage(type, message);
		            }
		            else if (code === exports.Protocol.ROOM_DATA_BYTES) {
		                var it_4 = { offset: 1 };
		                var type = (umd.decode.stringCheck(bytes, it_4))
		                    ? umd.decode.string(bytes, it_4)
		                    : umd.decode.number(bytes, it_4);
		                this.dispatchMessage(type, new Uint8Array(bytes.slice(it_4.offset)));
		            }
		        };
		        Room.prototype.setState = function (encodedState) {
		            this.serializer.setState(encodedState);
		            this.onStateChange.invoke(this.serializer.getState());
		        };
		        Room.prototype.patch = function (binaryPatch) {
		            this.serializer.patch(binaryPatch);
		            this.onStateChange.invoke(this.serializer.getState());
		        };
		        Room.prototype.dispatchMessage = function (type, message) {
		            var _a;
		            var messageType = this.getMessageHandlerKey(type);
		            if (this.onMessageHandlers.events[messageType]) {
		                this.onMessageHandlers.emit(messageType, message);
		            }
		            else if (this.onMessageHandlers.events['*']) {
		                this.onMessageHandlers.emit('*', type, message);
		            }
		            else {
		                (_a = console.warn) === null || _a === void 0 ? void 0 : _a.call(console, "colyseus.js: onMessage() not registered for type '".concat(type, "'."));
		            }
		        };
		        Room.prototype.destroy = function () {
		            if (this.serializer) {
		                this.serializer.teardown();
		            }
		        };
		        Room.prototype.getMessageHandlerKey = function (type) {
		            switch (typeof (type)) {
		                // typeof Schema
		                case "function": return "$".concat(type._typeid);
		                // string
		                case "string": return type;
		                // number
		                case "number": return "i".concat(type);
		                default: throw new Error("invalid message type.");
		            }
		        };
		        return Room;
		    }());

		    function apply(src, tar) {
		    	tar.statusMessage = src.statusText;
		    	tar.statusCode = src.status;
		    	tar.data = src.body;
		    }

		    function send(method, uri, opts) {
		    	opts = opts || {};
		    	var timer, ctrl, tmp=opts.body;

		    	opts.method = method;
		    	opts.headers = opts.headers || {};

		    	if (tmp instanceof FormData) ; else if (tmp && typeof tmp == 'object') {
		    		opts.headers['content-type'] = 'application/json';
		    		opts.body = JSON.stringify(tmp);
		    	}

		    	if (opts.withCredentials) {
		    		opts.credentials = 'include';
		    	}

		    	if (opts.timeout) {
		    		ctrl = new AbortController;
		    		opts.signal = ctrl.signal;
		    		timer = setTimeout(ctrl.abort, opts.timeout);
		    	}

		    	return new Promise((res, rej) => {
		    		fetch(uri, opts).then((rr, reply) => {
		    			clearTimeout(timer);

		    			apply(rr, rr); //=> rr.headers
		    			reply = rr.status >= 400 ? rej : res;

		    			tmp = rr.headers.get('content-type');
		    			if (!tmp || !~tmp.indexOf('application/json')) {
		    				reply(rr);
		    			} else {
		    				rr.text().then(str => {
		    					try {
		    						rr.data = JSON.parse(str, opts.reviver);
		    						reply(rr);
		    					} catch (err) {
		    						err.headers = rr.headers;
		    						apply(rr, err);
		    						rej(err);
		    					}
		    				});
		    			}
		    		}).catch(err => {
		    			err.timeout = ctrl && ctrl.signal.aborted;
		    			rej(err);
		    		});
		    	});
		    }

		    var get = /*#__PURE__*/ send.bind(send, 'GET');
		    var post = /*#__PURE__*/ send.bind(send, 'POST');
		    var patch = /*#__PURE__*/ send.bind(send, 'PATCH');
		    var del = /*#__PURE__*/ send.bind(send, 'DELETE');
		    var put = /*#__PURE__*/ send.bind(send, 'PUT');

		    var del_1 = del;
		    var get_1 = get;
		    var patch_1 = patch;
		    var post_1 = post;
		    var put_1 = put;
		    var send_1 = send;

		    var fetch_1 = {
		    	del: del_1,
		    	get: get_1,
		    	patch: patch_1,
		    	post: post_1,
		    	put: put_1,
		    	send: send_1
		    };

		    var httpie = /*#__PURE__*/_mergeNamespaces({
		        __proto__: null,
		        'default': fetch_1,
		        del: del_1,
		        get: get_1,
		        patch: patch_1,
		        post: post_1,
		        put: put_1,
		        send: send_1
		    }, [fetch_1]);

		    var HTTP = /** @class */ (function () {
		        function HTTP(client) {
		            this.client = client;
		        }
		        HTTP.prototype.get = function (path, options) {
		            if (options === void 0) { options = {}; }
		            return this.request("get", path, options);
		        };
		        HTTP.prototype.post = function (path, options) {
		            if (options === void 0) { options = {}; }
		            return this.request("post", path, options);
		        };
		        HTTP.prototype.del = function (path, options) {
		            if (options === void 0) { options = {}; }
		            return this.request("del", path, options);
		        };
		        HTTP.prototype.put = function (path, options) {
		            if (options === void 0) { options = {}; }
		            return this.request("put", path, options);
		        };
		        HTTP.prototype.request = function (method, path, options) {
		            if (options === void 0) { options = {}; }
		            return httpie[method](this.client['getHttpEndpoint'](path), this.getOptions(options)).catch(function (e) {
		                var _a;
		                throw new ServerError(e.statusCode || -1, ((_a = e.data) === null || _a === void 0 ? void 0 : _a.error) || e.statusMessage || e.message || "offline");
		            });
		        };
		        HTTP.prototype.getOptions = function (options) {
		            if (this.authToken) {
		                if (!options.headers) {
		                    options.headers = {};
		                }
		                options.headers['Authorization'] = "Bearer ".concat(this.authToken);
		                options.withCredentials = true;
		            }
		            return options;
		        };
		        return HTTP;
		    }());

		    /// <reference path="../typings/cocos-creator.d.ts" />
		    /**
		     * We do not assign 'storage' to window.localStorage immediatelly for React
		     * Native compatibility. window.localStorage is not present when this module is
		     * loaded.
		     */
		    var storage;
		    function getStorage() {
		        if (!storage) {
		            storage = (typeof (cc) !== 'undefined' && cc.sys && cc.sys.localStorage)
		                ? cc.sys.localStorage // compatibility with cocos creator
		                : typeof (window) !== "undefined" && window.localStorage //RN does have window object at this point, but localStorage is not defined
		                    ? window.localStorage // regular browser environment
		                    : {
		                        cache: {},
		                        setItem: function (key, value) { this.cache[key] = value; },
		                        getItem: function (key) { this.cache[key]; },
		                        removeItem: function (key) { delete this.cache[key]; },
		                    };
		        }
		        return storage;
		    }
		    function setItem(key, value) {
		        getStorage().setItem(key, value);
		    }
		    function removeItem(key) {
		        getStorage().removeItem(key);
		    }
		    function getItem(key, callback) {
		        var value = getStorage().getItem(key);
		        if (typeof (Promise) === 'undefined' || // old browsers
		            !(value instanceof Promise)) {
		            // browser has synchronous return
		            callback(value);
		        }
		        else {
		            // react-native is asynchronous
		            value.then(function (id) { return callback(id); });
		        }
		    }

		    var _Auth__initialized, _Auth__initializationPromise, _Auth__signInWindow, _Auth__events;
		    var Auth = /** @class */ (function () {
		        function Auth(http) {
		            var _this = this;
		            this.http = http;
		            this.settings = {
		                path: "/auth",
		                key: "colyseus-auth-token",
		            };
		            _Auth__initialized.set(this, false);
		            _Auth__initializationPromise.set(this, void 0);
		            _Auth__signInWindow.set(this, undefined);
		            _Auth__events.set(this, createNanoEvents());
		            getItem(this.settings.key, function (token) { return _this.token = token; });
		        }
		        Object.defineProperty(Auth.prototype, "token", {
		            get: function () {
		                return this.http.authToken;
		            },
		            set: function (token) {
		                this.http.authToken = token;
		            },
		            enumerable: false,
		            configurable: true
		        });
		        Auth.prototype.onChange = function (callback) {
		            var _this = this;
		            var unbindChange = __classPrivateFieldGet(this, _Auth__events, "f").on("change", callback);
		            if (!__classPrivateFieldGet(this, _Auth__initialized, "f")) {
		                __classPrivateFieldSet(this, _Auth__initializationPromise, new Promise(function (resolve, reject) {
		                    _this.getUserData().then(function (userData) {
		                        _this.emitChange(__assign(__assign({}, userData), { token: _this.token }));
		                    }).catch(function (e) {
		                        // user is not logged in, or service is down
		                        _this.emitChange({ user: null, token: undefined });
		                    }).finally(function () {
		                        resolve();
		                    });
		                }), "f");
		            }
		            __classPrivateFieldSet(this, _Auth__initialized, true, "f");
		            return unbindChange;
		        };
		        Auth.prototype.getUserData = function () {
		            return __awaiter(this, void 0, void 0, function () {
		                return __generator(this, function (_a) {
		                    switch (_a.label) {
		                        case 0:
		                            if (!this.token) return [3 /*break*/, 2];
		                            return [4 /*yield*/, this.http.get("".concat(this.settings.path, "/userdata"))];
		                        case 1: return [2 /*return*/, (_a.sent()).data];
		                        case 2: throw new Error("missing auth.token");
		                    }
		                });
		            });
		        };
		        Auth.prototype.registerWithEmailAndPassword = function (email, password, options) {
		            return __awaiter(this, void 0, void 0, function () {
		                var data;
		                return __generator(this, function (_a) {
		                    switch (_a.label) {
		                        case 0: return [4 /*yield*/, this.http.post("".concat(this.settings.path, "/register"), {
		                                body: { email: email, password: password, options: options, },
		                            })];
		                        case 1:
		                            data = (_a.sent()).data;
		                            this.emitChange(data);
		                            return [2 /*return*/, data];
		                    }
		                });
		            });
		        };
		        Auth.prototype.signInWithEmailAndPassword = function (email, password) {
		            return __awaiter(this, void 0, void 0, function () {
		                var data;
		                return __generator(this, function (_a) {
		                    switch (_a.label) {
		                        case 0: return [4 /*yield*/, this.http.post("".concat(this.settings.path, "/login"), {
		                                body: { email: email, password: password, },
		                            })];
		                        case 1:
		                            data = (_a.sent()).data;
		                            this.emitChange(data);
		                            return [2 /*return*/, data];
		                    }
		                });
		            });
		        };
		        Auth.prototype.signInAnonymously = function (options) {
		            return __awaiter(this, void 0, void 0, function () {
		                var data;
		                return __generator(this, function (_a) {
		                    switch (_a.label) {
		                        case 0: return [4 /*yield*/, this.http.post("".concat(this.settings.path, "/anonymous"), {
		                                body: { options: options, }
		                            })];
		                        case 1:
		                            data = (_a.sent()).data;
		                            this.emitChange(data);
		                            return [2 /*return*/, data];
		                    }
		                });
		            });
		        };
		        Auth.prototype.sendPasswordResetEmail = function (email) {
		            return __awaiter(this, void 0, void 0, function () {
		                return __generator(this, function (_a) {
		                    switch (_a.label) {
		                        case 0: return [4 /*yield*/, this.http.post("".concat(this.settings.path, "/forgot-password"), {
		                                body: { email: email, }
		                            })];
		                        case 1: return [2 /*return*/, (_a.sent()).data];
		                    }
		                });
		            });
		        };
		        Auth.prototype.signInWithProvider = function (providerName, settings) {
		            if (settings === void 0) { settings = {}; }
		            return __awaiter(this, void 0, void 0, function () {
		                var _this = this;
		                return __generator(this, function (_a) {
		                    return [2 /*return*/, new Promise(function (resolve, reject) {
		                            var w = settings.width || 480;
		                            var h = settings.height || 768;
		                            // forward existing token for upgrading
		                            var upgradingToken = _this.token ? "?token=".concat(_this.token) : "";
		                            // Capitalize first letter of providerName
		                            var title = "Login with ".concat((providerName[0].toUpperCase() + providerName.substring(1)));
		                            var url = _this.http['client']['getHttpEndpoint']("".concat((settings.prefix || "".concat(_this.settings.path, "/provider")), "/").concat(providerName).concat(upgradingToken));
		                            var left = (screen.width / 2) - (w / 2);
		                            var top = (screen.height / 2) - (h / 2);
		                            __classPrivateFieldSet(_this, _Auth__signInWindow, window.open(url, title, 'toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=' + w + ', height=' + h + ', top=' + top + ', left=' + left), "f");
		                            var onMessage = function (event) {
		                                // TODO: it is a good idea to check if event.origin can be trusted!
		                                // if (event.origin.indexOf(window.location.hostname) === -1) { return; }
		                                // require 'user' and 'token' inside received data.
		                                if (event.data.user === undefined && event.data.token === undefined) {
		                                    return;
		                                }
		                                clearInterval(rejectionChecker);
		                                __classPrivateFieldGet(_this, _Auth__signInWindow, "f").close();
		                                __classPrivateFieldSet(_this, _Auth__signInWindow, undefined, "f");
		                                window.removeEventListener("message", onMessage);
		                                if (event.data.error !== undefined) {
		                                    reject(event.data.error);
		                                }
		                                else {
		                                    resolve(event.data);
		                                    _this.emitChange(event.data);
		                                }
		                            };
		                            var rejectionChecker = setInterval(function () {
		                                if (!__classPrivateFieldGet(_this, _Auth__signInWindow, "f") || __classPrivateFieldGet(_this, _Auth__signInWindow, "f").closed) {
		                                    __classPrivateFieldSet(_this, _Auth__signInWindow, undefined, "f");
		                                    reject("cancelled");
		                                    window.removeEventListener("message", onMessage);
		                                }
		                            }, 200);
		                            window.addEventListener("message", onMessage);
		                        })];
		                });
		            });
		        };
		        Auth.prototype.signOut = function () {
		            return __awaiter(this, void 0, void 0, function () {
		                return __generator(this, function (_a) {
		                    this.emitChange({ user: null, token: null });
		                    return [2 /*return*/];
		                });
		            });
		        };
		        Auth.prototype.emitChange = function (authData) {
		            if (authData.token !== undefined) {
		                this.token = authData.token;
		                if (authData.token === null) {
		                    removeItem(this.settings.key);
		                }
		                else {
		                    // store key in localStorage
		                    setItem(this.settings.key, authData.token);
		                }
		            }
		            __classPrivateFieldGet(this, _Auth__events, "f").emit("change", authData);
		        };
		        return Auth;
		    }());
		    _Auth__initialized = new WeakMap(), _Auth__initializationPromise = new WeakMap(), _Auth__signInWindow = new WeakMap(), _Auth__events = new WeakMap();

		    var _a;
		    var MatchMakeError = /** @class */ (function (_super) {
		        __extends(MatchMakeError, _super);
		        function MatchMakeError(message, code) {
		            var _this = _super.call(this, message) || this;
		            _this.code = code;
		            Object.setPrototypeOf(_this, MatchMakeError.prototype);
		            return _this;
		        }
		        return MatchMakeError;
		    }(Error));
		    // - React Native does not provide `window.location`
		    // - Cocos Creator (Native) does not provide `window.location.hostname`
		    var DEFAULT_ENDPOINT = (typeof (window) !== "undefined" && typeof ((_a = window === null || window === void 0 ? void 0 : window.location) === null || _a === void 0 ? void 0 : _a.hostname) !== "undefined")
		        ? "".concat(window.location.protocol.replace("http", "ws"), "//").concat(window.location.hostname).concat((window.location.port && ":".concat(window.location.port)))
		        : "ws://127.0.0.1:2567";
		    var Client = /** @class */ (function () {
		        function Client(settings) {
		            if (settings === void 0) { settings = DEFAULT_ENDPOINT; }
		            if (typeof (settings) === "string") {
		                //
		                // endpoint by url
		                //
		                var url = new URL(settings);
		                var secure = (url.protocol === "https:" || url.protocol === "wss:");
		                var port = Number(url.port || (secure ? 443 : 80));
		                this.settings = {
		                    hostname: url.hostname,
		                    pathname: url.pathname,
		                    port: port,
		                    secure: secure
		                };
		            }
		            else {
		                //
		                // endpoint by settings
		                //
		                if (settings.port === undefined) {
		                    settings.port = (settings.secure) ? 443 : 80;
		                }
		                if (settings.pathname === undefined) {
		                    settings.pathname = "";
		                }
		                this.settings = settings;
		            }
		            // make sure pathname does not end with "/"
		            if (this.settings.pathname.endsWith("/")) {
		                this.settings.pathname = this.settings.pathname.slice(0, -1);
		            }
		            this.http = new HTTP(this);
		            this.auth = new Auth(this.http);
		        }
		        Client.prototype.joinOrCreate = function (roomName, options, rootSchema) {
		            if (options === void 0) { options = {}; }
		            return __awaiter(this, void 0, void 0, function () {
		                return __generator(this, function (_a) {
		                    switch (_a.label) {
		                        case 0: return [4 /*yield*/, this.createMatchMakeRequest('joinOrCreate', roomName, options, rootSchema)];
		                        case 1: return [2 /*return*/, _a.sent()];
		                    }
		                });
		            });
		        };
		        Client.prototype.create = function (roomName, options, rootSchema) {
		            if (options === void 0) { options = {}; }
		            return __awaiter(this, void 0, void 0, function () {
		                return __generator(this, function (_a) {
		                    switch (_a.label) {
		                        case 0: return [4 /*yield*/, this.createMatchMakeRequest('create', roomName, options, rootSchema)];
		                        case 1: return [2 /*return*/, _a.sent()];
		                    }
		                });
		            });
		        };
		        Client.prototype.join = function (roomName, options, rootSchema) {
		            if (options === void 0) { options = {}; }
		            return __awaiter(this, void 0, void 0, function () {
		                return __generator(this, function (_a) {
		                    switch (_a.label) {
		                        case 0: return [4 /*yield*/, this.createMatchMakeRequest('join', roomName, options, rootSchema)];
		                        case 1: return [2 /*return*/, _a.sent()];
		                    }
		                });
		            });
		        };
		        Client.prototype.joinById = function (roomId, options, rootSchema) {
		            if (options === void 0) { options = {}; }
		            return __awaiter(this, void 0, void 0, function () {
		                return __generator(this, function (_a) {
		                    switch (_a.label) {
		                        case 0: return [4 /*yield*/, this.createMatchMakeRequest('joinById', roomId, options, rootSchema)];
		                        case 1: return [2 /*return*/, _a.sent()];
		                    }
		                });
		            });
		        };
		        /**
		         * Re-establish connection with a room this client was previously connected to.
		         *
		         * @param reconnectionToken The `room.reconnectionToken` from previously connected room.
		         * @param rootSchema (optional) Concrete root schema definition
		         * @returns Promise<Room>
		         */
		        Client.prototype.reconnect = function (reconnectionToken, rootSchema) {
		            return __awaiter(this, void 0, void 0, function () {
		                var _a, roomId, token;
		                return __generator(this, function (_b) {
		                    switch (_b.label) {
		                        case 0:
		                            if (typeof (reconnectionToken) === "string" && typeof (rootSchema) === "string") {
		                                throw new Error("DEPRECATED: .reconnect() now only accepts 'reconnectionToken' as argument.\nYou can get this token from previously connected `room.reconnectionToken`");
		                            }
		                            _a = reconnectionToken.split(":"), roomId = _a[0], token = _a[1];
		                            if (!roomId || !token) {
		                                throw new Error("Invalid reconnection token format.\nThe format should be roomId:reconnectionToken");
		                            }
		                            return [4 /*yield*/, this.createMatchMakeRequest('reconnect', roomId, { reconnectionToken: token }, rootSchema)];
		                        case 1: return [2 /*return*/, _b.sent()];
		                    }
		                });
		            });
		        };
		        Client.prototype.getAvailableRooms = function (roomName) {
		            if (roomName === void 0) { roomName = ""; }
		            return __awaiter(this, void 0, void 0, function () {
		                return __generator(this, function (_a) {
		                    switch (_a.label) {
		                        case 0: return [4 /*yield*/, this.http.get("matchmake/".concat(roomName), {
		                                headers: {
		                                    'Accept': 'application/json'
		                                }
		                            })];
		                        case 1: return [2 /*return*/, (_a.sent()).data];
		                    }
		                });
		            });
		        };
		        Client.prototype.consumeSeatReservation = function (response, rootSchema, reuseRoomInstance // used in devMode
		        ) {
		            return __awaiter(this, void 0, void 0, function () {
		                var room, options, targetRoom;
		                var _this = this;
		                return __generator(this, function (_a) {
		                    room = this.createRoom(response.room.name, rootSchema);
		                    room.roomId = response.room.roomId;
		                    room.sessionId = response.sessionId;
		                    options = { sessionId: room.sessionId };
		                    // forward "reconnection token" in case of reconnection.
		                    if (response.reconnectionToken) {
		                        options.reconnectionToken = response.reconnectionToken;
		                    }
		                    targetRoom = reuseRoomInstance || room;
		                    room.connect(this.buildEndpoint(response.room, options), response.devMode && (function () { return __awaiter(_this, void 0, void 0, function () {
		                        var retryCount, retryMaxRetries, retryReconnection;
		                        var _this = this;
		                        return __generator(this, function (_a) {
		                            console.info("[Colyseus devMode]: ".concat(String.fromCodePoint(0x1F504), " Re-establishing connection with room id '").concat(room.roomId, "'...")); // 🔄
		                            retryCount = 0;
		                            retryMaxRetries = 8;
		                            retryReconnection = function () { return __awaiter(_this, void 0, void 0, function () {
		                                return __generator(this, function (_a) {
		                                    switch (_a.label) {
		                                        case 0:
		                                            retryCount++;
		                                            _a.label = 1;
		                                        case 1:
		                                            _a.trys.push([1, 3, , 4]);
		                                            return [4 /*yield*/, this.consumeSeatReservation(response, rootSchema, targetRoom)];
		                                        case 2:
		                                            _a.sent();
		                                            console.info("[Colyseus devMode]: ".concat(String.fromCodePoint(0x2705), " Successfully re-established connection with room '").concat(room.roomId, "'")); // ✅
		                                            return [3 /*break*/, 4];
		                                        case 3:
		                                            _a.sent();
		                                            if (retryCount < retryMaxRetries) {
		                                                console.info("[Colyseus devMode]: ".concat(String.fromCodePoint(0x1F504), " retrying... (").concat(retryCount, " out of ").concat(retryMaxRetries, ")")); // 🔄
		                                                setTimeout(retryReconnection, 2000);
		                                            }
		                                            else {
		                                                console.info("[Colyseus devMode]: ".concat(String.fromCodePoint(0x274C), " Failed to reconnect. Is your server running? Please check server logs.")); // ❌
		                                            }
		                                            return [3 /*break*/, 4];
		                                        case 4: return [2 /*return*/];
		                                    }
		                                });
		                            }); };
		                            setTimeout(retryReconnection, 2000);
		                            return [2 /*return*/];
		                        });
		                    }); }), targetRoom);
		                    return [2 /*return*/, new Promise(function (resolve, reject) {
		                            var onError = function (code, message) { return reject(new ServerError(code, message)); };
		                            targetRoom.onError.once(onError);
		                            targetRoom['onJoin'].once(function () {
		                                targetRoom.onError.remove(onError);
		                                resolve(targetRoom);
		                            });
		                        })];
		                });
		            });
		        };
		        Client.prototype.createMatchMakeRequest = function (method, roomName, options, rootSchema, reuseRoomInstance) {
		            if (options === void 0) { options = {}; }
		            return __awaiter(this, void 0, void 0, function () {
		                var response;
		                return __generator(this, function (_a) {
		                    switch (_a.label) {
		                        case 0: return [4 /*yield*/, this.http.post("matchmake/".concat(method, "/").concat(roomName), {
		                                headers: {
		                                    'Accept': 'application/json',
		                                    'Content-Type': 'application/json'
		                                },
		                                body: JSON.stringify(options)
		                            })];
		                        case 1:
		                            response = (_a.sent()).data;
		                            // FIXME: HTTP class is already handling this as ServerError.
		                            if (response.error) {
		                                throw new MatchMakeError(response.error, response.code);
		                            }
		                            // forward reconnection token during "reconnect" methods.
		                            if (method === "reconnect") {
		                                response.reconnectionToken = options.reconnectionToken;
		                            }
		                            return [4 /*yield*/, this.consumeSeatReservation(response, rootSchema, reuseRoomInstance)];
		                        case 2: return [2 /*return*/, _a.sent()];
		                    }
		                });
		            });
		        };
		        Client.prototype.createRoom = function (roomName, rootSchema) {
		            return new Room(roomName, rootSchema);
		        };
		        Client.prototype.buildEndpoint = function (room, options) {
		            if (options === void 0) { options = {}; }
		            var params = [];
		            // append provided options
		            for (var name_1 in options) {
		                if (!options.hasOwnProperty(name_1)) {
		                    continue;
		                }
		                params.push("".concat(name_1, "=").concat(options[name_1]));
		            }
		            var endpoint = (this.settings.secure)
		                ? "wss://"
		                : "ws://";
		            if (room.publicAddress) {
		                endpoint += "".concat(room.publicAddress);
		            }
		            else {
		                endpoint += "".concat(this.settings.hostname).concat(this.getEndpointPort()).concat(this.settings.pathname);
		            }
		            return "".concat(endpoint, "/").concat(room.processId, "/").concat(room.roomId, "?").concat(params.join('&'));
		        };
		        Client.prototype.getHttpEndpoint = function (segments) {
		            if (segments === void 0) { segments = ''; }
		            var path = segments.startsWith("/") ? segments : "/".concat(segments);
		            return "".concat((this.settings.secure) ? "https" : "http", "://").concat(this.settings.hostname).concat(this.getEndpointPort()).concat(this.settings.pathname).concat(path);
		        };
		        Client.prototype.getEndpointPort = function () {
		            return (this.settings.port !== 80 && this.settings.port !== 443)
		                ? ":".concat(this.settings.port)
		                : "";
		        };
		        return Client;
		    }());

		    var SchemaSerializer = /** @class */ (function () {
		        function SchemaSerializer() {
		        }
		        SchemaSerializer.prototype.setState = function (rawState) {
		            return this.state.decode(rawState);
		        };
		        SchemaSerializer.prototype.getState = function () {
		            return this.state;
		        };
		        SchemaSerializer.prototype.patch = function (patches) {
		            return this.state.decode(patches);
		        };
		        SchemaSerializer.prototype.teardown = function () {
		            var _a, _b;
		            (_b = (_a = this.state) === null || _a === void 0 ? void 0 : _a['$changes']) === null || _b === void 0 ? void 0 : _b.root.clearRefs();
		        };
		        SchemaSerializer.prototype.handshake = function (bytes, it) {
		            if (this.state) {
		                // TODO: validate client/server definitinos
		                var reflection = new umd.Reflection();
		                reflection.decode(bytes, it);
		            }
		            else {
		                // initialize reflected state from server
		                this.state = umd.Reflection.decode(bytes, it);
		            }
		        };
		        return SchemaSerializer;
		    }());

		    var NoneSerializer = /** @class */ (function () {
		        function NoneSerializer() {
		        }
		        NoneSerializer.prototype.setState = function (rawState) { };
		        NoneSerializer.prototype.getState = function () { return null; };
		        NoneSerializer.prototype.patch = function (patches) { };
		        NoneSerializer.prototype.teardown = function () { };
		        NoneSerializer.prototype.handshake = function (bytes) { };
		        return NoneSerializer;
		    }());

		    registerSerializer('schema', SchemaSerializer);
		    registerSerializer('none', NoneSerializer);

		    exports.Auth = Auth;
		    exports.Client = Client;
		    exports.Room = Room;
		    exports.SchemaSerializer = SchemaSerializer;
		    exports.registerSerializer = registerSerializer;

		    Object.defineProperty(exports, '__esModule', { value: true });

		}));
		
	} (colyseus, colyseus.exports));

	var colyseusExports = colyseus.exports;

	var umd = {exports: {}};

	(function (module, exports) {
		(function (global, factory) {
		    factory(exports) ;
		})(commonjsGlobal, (function (exports) {
		    /******************************************************************************
		    Copyright (c) Microsoft Corporation.

		    Permission to use, copy, modify, and/or distribute this software for any
		    purpose with or without fee is hereby granted.

		    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
		    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
		    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
		    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
		    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
		    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
		    PERFORMANCE OF THIS SOFTWARE.
		    ***************************************************************************** */
		    /* global Reflect, Promise, SuppressedError, Symbol */

		    var extendStatics = function(d, b) {
		        extendStatics = Object.setPrototypeOf ||
		            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
		            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
		        return extendStatics(d, b);
		    };

		    function __extends(d, b) {
		        if (typeof b !== "function" && b !== null)
		            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
		        extendStatics(d, b);
		        function __() { this.constructor = d; }
		        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
		    }

		    function __decorate(decorators, target, key, desc) {
		        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		        return c > 3 && r && Object.defineProperty(target, key, r), r;
		    }

		    function __spreadArray(to, from, pack) {
		        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
		            if (ar || !(i in from)) {
		                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
		                ar[i] = from[i];
		            }
		        }
		        return to.concat(ar || Array.prototype.slice.call(from));
		    }

		    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
		        var e = new Error(message);
		        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
		    };

		    // export const SWITCH_TO_STRUCTURE = 193; (easily collides with DELETE_AND_ADD + fieldIndex = 2)
		    var SWITCH_TO_STRUCTURE = 255; // (decoding collides with DELETE_AND_ADD + fieldIndex = 63)
		    var TYPE_ID = 213;
		    /**
		     * Encoding Schema field operations.
		     */
		    exports.OPERATION = void 0;
		    (function (OPERATION) {
		        // add new structure/primitive
		        OPERATION[OPERATION["ADD"] = 128] = "ADD";
		        // replace structure/primitive
		        OPERATION[OPERATION["REPLACE"] = 0] = "REPLACE";
		        // delete field
		        OPERATION[OPERATION["DELETE"] = 64] = "DELETE";
		        // DELETE field, followed by an ADD
		        OPERATION[OPERATION["DELETE_AND_ADD"] = 192] = "DELETE_AND_ADD";
		        // TOUCH is used to determine hierarchy of nested Schema structures during serialization.
		        // touches are NOT encoded.
		        OPERATION[OPERATION["TOUCH"] = 1] = "TOUCH";
		        // MapSchema Operations
		        OPERATION[OPERATION["CLEAR"] = 10] = "CLEAR";
		    })(exports.OPERATION || (exports.OPERATION = {}));
		    // export enum OPERATION {
		    //     // add new structure/primitive
		    //     // (128)
		    //     ADD = 128, // 10000000,
		    //     // replace structure/primitive
		    //     REPLACE = 1,// 00000001
		    //     // delete field
		    //     DELETE = 192, // 11000000
		    //     // DELETE field, followed by an ADD
		    //     DELETE_AND_ADD = 224, // 11100000
		    //     // TOUCH is used to determine hierarchy of nested Schema structures during serialization.
		    //     // touches are NOT encoded.
		    //     TOUCH = 0, // 00000000
		    //     // MapSchema Operations
		    //     CLEAR = 10,
		    // }

		    var ChangeTree = /** @class */ (function () {
		        function ChangeTree(ref, parent, root) {
		            this.changed = false;
		            this.changes = new Map();
		            this.allChanges = new Set();
		            // cached indexes for filtering
		            this.caches = {};
		            this.currentCustomOperation = 0;
		            this.ref = ref;
		            this.setParent(parent, root);
		        }
		        ChangeTree.prototype.setParent = function (parent, root, parentIndex) {
		            var _this = this;
		            if (!this.indexes) {
		                this.indexes = (this.ref instanceof Schema)
		                    ? this.ref['_definition'].indexes
		                    : {};
		            }
		            this.parent = parent;
		            this.parentIndex = parentIndex;
		            // avoid setting parents with empty `root`
		            if (!root) {
		                return;
		            }
		            this.root = root;
		            //
		            // assign same parent on child structures
		            //
		            if (this.ref instanceof Schema) {
		                var definition = this.ref['_definition'];
		                for (var field in definition.schema) {
		                    var value = this.ref[field];
		                    if (value && value['$changes']) {
		                        var parentIndex_1 = definition.indexes[field];
		                        value['$changes'].setParent(this.ref, root, parentIndex_1);
		                    }
		                }
		            }
		            else if (typeof (this.ref) === "object") {
		                this.ref.forEach(function (value, key) {
		                    if (value instanceof Schema) {
		                        var changeTreee = value['$changes'];
		                        var parentIndex_2 = _this.ref['$changes'].indexes[key];
		                        changeTreee.setParent(_this.ref, _this.root, parentIndex_2);
		                    }
		                });
		            }
		        };
		        ChangeTree.prototype.operation = function (op) {
		            this.changes.set(--this.currentCustomOperation, op);
		        };
		        ChangeTree.prototype.change = function (fieldName, operation) {
		            if (operation === void 0) { operation = exports.OPERATION.ADD; }
		            var index = (typeof (fieldName) === "number")
		                ? fieldName
		                : this.indexes[fieldName];
		            this.assertValidIndex(index, fieldName);
		            var previousChange = this.changes.get(index);
		            if (!previousChange ||
		                previousChange.op === exports.OPERATION.DELETE ||
		                previousChange.op === exports.OPERATION.TOUCH // (mazmorra.io's BattleAction issue)
		            ) {
		                this.changes.set(index, {
		                    op: (!previousChange)
		                        ? operation
		                        : (previousChange.op === exports.OPERATION.DELETE)
		                            ? exports.OPERATION.DELETE_AND_ADD
		                            : operation,
		                    // : OPERATION.REPLACE,
		                    index: index
		                });
		            }
		            this.allChanges.add(index);
		            this.changed = true;
		            this.touchParents();
		        };
		        ChangeTree.prototype.touch = function (fieldName) {
		            var index = (typeof (fieldName) === "number")
		                ? fieldName
		                : this.indexes[fieldName];
		            this.assertValidIndex(index, fieldName);
		            if (!this.changes.has(index)) {
		                this.changes.set(index, { op: exports.OPERATION.TOUCH, index: index });
		            }
		            this.allChanges.add(index);
		            // ensure touch is placed until the $root is found.
		            this.touchParents();
		        };
		        ChangeTree.prototype.touchParents = function () {
		            if (this.parent) {
		                this.parent['$changes'].touch(this.parentIndex);
		            }
		        };
		        ChangeTree.prototype.getType = function (index) {
		            if (this.ref['_definition']) {
		                var definition = this.ref['_definition'];
		                return definition.schema[definition.fieldsByIndex[index]];
		            }
		            else {
		                var definition = this.parent['_definition'];
		                var parentType = definition.schema[definition.fieldsByIndex[this.parentIndex]];
		                //
		                // Get the child type from parent structure.
		                // - ["string"] => "string"
		                // - { map: "string" } => "string"
		                // - { set: "string" } => "string"
		                //
		                return Object.values(parentType)[0];
		            }
		        };
		        ChangeTree.prototype.getChildrenFilter = function () {
		            var childFilters = this.parent['_definition'].childFilters;
		            return childFilters && childFilters[this.parentIndex];
		        };
		        //
		        // used during `.encode()`
		        //
		        ChangeTree.prototype.getValue = function (index) {
		            return this.ref['getByIndex'](index);
		        };
		        ChangeTree.prototype.delete = function (fieldName) {
		            var index = (typeof (fieldName) === "number")
		                ? fieldName
		                : this.indexes[fieldName];
		            if (index === undefined) {
		                console.warn("@colyseus/schema ".concat(this.ref.constructor.name, ": trying to delete non-existing index: ").concat(fieldName, " (").concat(index, ")"));
		                return;
		            }
		            var previousValue = this.getValue(index);
		            // console.log("$changes.delete =>", { fieldName, index, previousValue });
		            this.changes.set(index, { op: exports.OPERATION.DELETE, index: index });
		            this.allChanges.delete(index);
		            // delete cache
		            delete this.caches[index];
		            // remove `root` reference
		            if (previousValue && previousValue['$changes']) {
		                previousValue['$changes'].parent = undefined;
		            }
		            this.changed = true;
		            this.touchParents();
		        };
		        ChangeTree.prototype.discard = function (changed, discardAll) {
		            var _this = this;
		            if (changed === void 0) { changed = false; }
		            if (discardAll === void 0) { discardAll = false; }
		            //
		            // Map, Array, etc:
		            // Remove cached key to ensure ADD operations is unsed instead of
		            // REPLACE in case same key is used on next patches.
		            //
		            // TODO: refactor this. this is not relevant for Collection and Set.
		            //
		            if (!(this.ref instanceof Schema)) {
		                this.changes.forEach(function (change) {
		                    if (change.op === exports.OPERATION.DELETE) {
		                        var index = _this.ref['getIndex'](change.index);
		                        delete _this.indexes[index];
		                    }
		                });
		            }
		            this.changes.clear();
		            this.changed = changed;
		            if (discardAll) {
		                this.allChanges.clear();
		            }
		            // re-set `currentCustomOperation`
		            this.currentCustomOperation = 0;
		        };
		        /**
		         * Recursively discard all changes from this, and child structures.
		         */
		        ChangeTree.prototype.discardAll = function () {
		            var _this = this;
		            this.changes.forEach(function (change) {
		                var value = _this.getValue(change.index);
		                if (value && value['$changes']) {
		                    value['$changes'].discardAll();
		                }
		            });
		            this.discard();
		        };
		        // cache(field: number, beginIndex: number, endIndex: number) {
		        ChangeTree.prototype.cache = function (field, cachedBytes) {
		            this.caches[field] = cachedBytes;
		        };
		        ChangeTree.prototype.clone = function () {
		            return new ChangeTree(this.ref, this.parent, this.root);
		        };
		        ChangeTree.prototype.ensureRefId = function () {
		            // skip if refId is already set.
		            if (this.refId !== undefined) {
		                return;
		            }
		            this.refId = this.root.getNextUniqueId();
		        };
		        ChangeTree.prototype.assertValidIndex = function (index, fieldName) {
		            if (index === undefined) {
		                throw new Error("ChangeTree: missing index for field \"".concat(fieldName, "\""));
		            }
		        };
		        return ChangeTree;
		    }());

		    function addCallback($callbacks, op, callback, existing) {
		        // initialize list of callbacks
		        if (!$callbacks[op]) {
		            $callbacks[op] = [];
		        }
		        $callbacks[op].push(callback);
		        //
		        // Trigger callback for existing elements
		        // - OPERATION.ADD
		        // - OPERATION.REPLACE
		        //
		        existing === null || existing === void 0 ? void 0 : existing.forEach(function (item, key) { return callback(item, key); });
		        return function () { return spliceOne($callbacks[op], $callbacks[op].indexOf(callback)); };
		    }
		    function removeChildRefs(changes) {
		        var _this = this;
		        var needRemoveRef = (typeof (this.$changes.getType()) !== "string");
		        this.$items.forEach(function (item, key) {
		            changes.push({
		                refId: _this.$changes.refId,
		                op: exports.OPERATION.DELETE,
		                field: key,
		                value: undefined,
		                previousValue: item
		            });
		            if (needRemoveRef) {
		                _this.$changes.root.removeRef(item['$changes'].refId);
		            }
		        });
		    }
		    function spliceOne(arr, index) {
		        // manually splice an array
		        if (index === -1 || index >= arr.length) {
		            return false;
		        }
		        var len = arr.length - 1;
		        for (var i = index; i < len; i++) {
		            arr[i] = arr[i + 1];
		        }
		        arr.length = len;
		        return true;
		    }

		    var DEFAULT_SORT = function (a, b) {
		        var A = a.toString();
		        var B = b.toString();
		        if (A < B)
		            return -1;
		        else if (A > B)
		            return 1;
		        else
		            return 0;
		    };
		    function getArrayProxy(value) {
		        value['$proxy'] = true;
		        //
		        // compatibility with @colyseus/schema 0.5.x
		        // - allow `map["key"]`
		        // - allow `map["key"] = "xxx"`
		        // - allow `delete map["key"]`
		        //
		        value = new Proxy(value, {
		            get: function (obj, prop) {
		                if (typeof (prop) !== "symbol" &&
		                    !isNaN(prop) // https://stackoverflow.com/a/175787/892698
		                ) {
		                    return obj.at(prop);
		                }
		                else {
		                    return obj[prop];
		                }
		            },
		            set: function (obj, prop, setValue) {
		                if (typeof (prop) !== "symbol" &&
		                    !isNaN(prop)) {
		                    var indexes = Array.from(obj['$items'].keys());
		                    var key = parseInt(indexes[prop] || prop);
		                    if (setValue === undefined || setValue === null) {
		                        obj.deleteAt(key);
		                    }
		                    else {
		                        obj.setAt(key, setValue);
		                    }
		                }
		                else {
		                    obj[prop] = setValue;
		                }
		                return true;
		            },
		            deleteProperty: function (obj, prop) {
		                if (typeof (prop) === "number") {
		                    obj.deleteAt(prop);
		                }
		                else {
		                    delete obj[prop];
		                }
		                return true;
		            },
		            has: function (obj, key) {
		                if (typeof (key) !== "symbol" &&
		                    !isNaN(Number(key))) {
		                    return obj['$items'].has(Number(key));
		                }
		                return Reflect.has(obj, key);
		            }
		        });
		        return value;
		    }
		    var ArraySchema = /** @class */ (function () {
		        function ArraySchema() {
		            var items = [];
		            for (var _i = 0; _i < arguments.length; _i++) {
		                items[_i] = arguments[_i];
		            }
		            this.$changes = new ChangeTree(this);
		            this.$items = new Map();
		            this.$indexes = new Map();
		            this.$refId = 0;
		            this.push.apply(this, items);
		        }
		        ArraySchema.prototype.onAdd = function (callback, triggerAll) {
		            if (triggerAll === void 0) { triggerAll = true; }
		            return addCallback((this.$callbacks || (this.$callbacks = {})), exports.OPERATION.ADD, callback, (triggerAll)
		                ? this.$items
		                : undefined);
		        };
		        ArraySchema.prototype.onRemove = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = {}), exports.OPERATION.DELETE, callback); };
		        ArraySchema.prototype.onChange = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = {}), exports.OPERATION.REPLACE, callback); };
		        ArraySchema.is = function (type) {
		            return (
		            // type format: ["string"]
		            Array.isArray(type) ||
		                // type format: { array: "string" }
		                (type['array'] !== undefined));
		        };
		        Object.defineProperty(ArraySchema.prototype, "length", {
		            get: function () {
		                return this.$items.size;
		            },
		            set: function (value) {
		                if (value === 0) {
		                    this.clear();
		                }
		                else {
		                    this.splice(value, this.length - value);
		                }
		            },
		            enumerable: false,
		            configurable: true
		        });
		        ArraySchema.prototype.push = function () {
		            var _this = this;
		            var values = [];
		            for (var _i = 0; _i < arguments.length; _i++) {
		                values[_i] = arguments[_i];
		            }
		            var lastIndex;
		            values.forEach(function (value) {
		                // set "index" for reference.
		                lastIndex = _this.$refId++;
		                _this.setAt(lastIndex, value);
		            });
		            return lastIndex;
		        };
		        /**
		         * Removes the last element from an array and returns it.
		         */
		        ArraySchema.prototype.pop = function () {
		            var key = Array.from(this.$indexes.values()).pop();
		            if (key === undefined) {
		                return undefined;
		            }
		            this.$changes.delete(key);
		            this.$indexes.delete(key);
		            var value = this.$items.get(key);
		            this.$items.delete(key);
		            return value;
		        };
		        ArraySchema.prototype.at = function (index) {
		            //
		            // FIXME: this should be O(1)
		            //
		            var key = Array.from(this.$items.keys())[index];
		            return this.$items.get(key);
		        };
		        ArraySchema.prototype.setAt = function (index, value) {
		            var _a, _b;
		            if (value === undefined || value === null) {
		                console.error("ArraySchema items cannot be null nor undefined; Use `deleteAt(index)` instead.");
		                return;
		            }
		            // skip if the value is the same as cached.
		            if (this.$items.get(index) === value) {
		                return;
		            }
		            if (value['$changes'] !== undefined) {
		                value['$changes'].setParent(this, this.$changes.root, index);
		            }
		            var operation = (_b = (_a = this.$changes.indexes[index]) === null || _a === void 0 ? void 0 : _a.op) !== null && _b !== void 0 ? _b : exports.OPERATION.ADD;
		            this.$changes.indexes[index] = index;
		            this.$indexes.set(index, index);
		            this.$items.set(index, value);
		            this.$changes.change(index, operation);
		        };
		        ArraySchema.prototype.deleteAt = function (index) {
		            var key = Array.from(this.$items.keys())[index];
		            if (key === undefined) {
		                return false;
		            }
		            return this.$deleteAt(key);
		        };
		        ArraySchema.prototype.$deleteAt = function (index) {
		            // delete at internal index
		            this.$changes.delete(index);
		            this.$indexes.delete(index);
		            return this.$items.delete(index);
		        };
		        ArraySchema.prototype.clear = function (changes) {
		            // discard previous operations.
		            this.$changes.discard(true, true);
		            this.$changes.indexes = {};
		            // clear previous indexes
		            this.$indexes.clear();
		            //
		            // When decoding:
		            // - enqueue items for DELETE callback.
		            // - flag child items for garbage collection.
		            //
		            if (changes) {
		                removeChildRefs.call(this, changes);
		            }
		            // clear items
		            this.$items.clear();
		            this.$changes.operation({ index: 0, op: exports.OPERATION.CLEAR });
		            // touch all structures until reach root
		            this.$changes.touchParents();
		        };
		        /**
		         * Combines two or more arrays.
		         * @param items Additional items to add to the end of array1.
		         */
		        // @ts-ignore
		        ArraySchema.prototype.concat = function () {
		            var _a;
		            var items = [];
		            for (var _i = 0; _i < arguments.length; _i++) {
		                items[_i] = arguments[_i];
		            }
		            return new (ArraySchema.bind.apply(ArraySchema, __spreadArray([void 0], (_a = Array.from(this.$items.values())).concat.apply(_a, items), false)))();
		        };
		        /**
		         * Adds all the elements of an array separated by the specified separator string.
		         * @param separator A string used to separate one element of an array from the next in the resulting String. If omitted, the array elements are separated with a comma.
		         */
		        ArraySchema.prototype.join = function (separator) {
		            return Array.from(this.$items.values()).join(separator);
		        };
		        /**
		         * Reverses the elements in an Array.
		         */
		        // @ts-ignore
		        ArraySchema.prototype.reverse = function () {
		            var _this = this;
		            var indexes = Array.from(this.$items.keys());
		            var reversedItems = Array.from(this.$items.values()).reverse();
		            reversedItems.forEach(function (item, i) {
		                _this.setAt(indexes[i], item);
		            });
		            return this;
		        };
		        /**
		         * Removes the first element from an array and returns it.
		         */
		        ArraySchema.prototype.shift = function () {
		            var indexes = Array.from(this.$items.keys());
		            var shiftAt = indexes.shift();
		            if (shiftAt === undefined) {
		                return undefined;
		            }
		            var value = this.$items.get(shiftAt);
		            this.$deleteAt(shiftAt);
		            return value;
		        };
		        /**
		         * Returns a section of an array.
		         * @param start The beginning of the specified portion of the array.
		         * @param end The end of the specified portion of the array. This is exclusive of the element at the index 'end'.
		         */
		        ArraySchema.prototype.slice = function (start, end) {
		            var sliced = new ArraySchema();
		            sliced.push.apply(sliced, Array.from(this.$items.values()).slice(start, end));
		            return sliced;
		        };
		        /**
		         * Sorts an array.
		         * @param compareFn Function used to determine the order of the elements. It is expected to return
		         * a negative value if first argument is less than second argument, zero if they're equal and a positive
		         * value otherwise. If omitted, the elements are sorted in ascending, ASCII character order.
		         * ```ts
		         * [11,2,22,1].sort((a, b) => a - b)
		         * ```
		         */
		        ArraySchema.prototype.sort = function (compareFn) {
		            var _this = this;
		            if (compareFn === void 0) { compareFn = DEFAULT_SORT; }
		            var indexes = Array.from(this.$items.keys());
		            var sortedItems = Array.from(this.$items.values()).sort(compareFn);
		            sortedItems.forEach(function (item, i) {
		                _this.setAt(indexes[i], item);
		            });
		            return this;
		        };
		        /**
		         * Removes elements from an array and, if necessary, inserts new elements in their place, returning the deleted elements.
		         * @param start The zero-based location in the array from which to start removing elements.
		         * @param deleteCount The number of elements to remove.
		         * @param items Elements to insert into the array in place of the deleted elements.
		         */
		        ArraySchema.prototype.splice = function (start, deleteCount) {
		            if (deleteCount === void 0) { deleteCount = this.length - start; }
		            var items = [];
		            for (var _i = 2; _i < arguments.length; _i++) {
		                items[_i - 2] = arguments[_i];
		            }
		            var indexes = Array.from(this.$items.keys());
		            var removedItems = [];
		            for (var i = start; i < start + deleteCount; i++) {
		                removedItems.push(this.$items.get(indexes[i]));
		                this.$deleteAt(indexes[i]);
		            }
		            for (var i = 0; i < items.length; i++) {
		                this.setAt(start + i, items[i]);
		            }
		            return removedItems;
		        };
		        /**
		         * Inserts new elements at the start of an array.
		         * @param items  Elements to insert at the start of the Array.
		         */
		        ArraySchema.prototype.unshift = function () {
		            var _this = this;
		            var items = [];
		            for (var _i = 0; _i < arguments.length; _i++) {
		                items[_i] = arguments[_i];
		            }
		            var length = this.length;
		            var addedLength = items.length;
		            // const indexes = Array.from(this.$items.keys());
		            var previousValues = Array.from(this.$items.values());
		            items.forEach(function (item, i) {
		                _this.setAt(i, item);
		            });
		            previousValues.forEach(function (previousValue, i) {
		                _this.setAt(addedLength + i, previousValue);
		            });
		            return length + addedLength;
		        };
		        /**
		         * Returns the index of the first occurrence of a value in an array.
		         * @param searchElement The value to locate in the array.
		         * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at index 0.
		         */
		        ArraySchema.prototype.indexOf = function (searchElement, fromIndex) {
		            return Array.from(this.$items.values()).indexOf(searchElement, fromIndex);
		        };
		        /**
		         * Returns the index of the last occurrence of a specified value in an array.
		         * @param searchElement The value to locate in the array.
		         * @param fromIndex The array index at which to begin the search. If fromIndex is omitted, the search starts at the last index in the array.
		         */
		        ArraySchema.prototype.lastIndexOf = function (searchElement, fromIndex) {
		            if (fromIndex === void 0) { fromIndex = this.length - 1; }
		            return Array.from(this.$items.values()).lastIndexOf(searchElement, fromIndex);
		        };
		        /**
		         * Determines whether all the members of an array satisfy the specified test.
		         * @param callbackfn A function that accepts up to three arguments. The every method calls
		         * the callbackfn function for each element in the array until the callbackfn returns a value
		         * which is coercible to the Boolean value false, or until the end of the array.
		         * @param thisArg An object to which the this keyword can refer in the callbackfn function.
		         * If thisArg is omitted, undefined is used as the this value.
		         */
		        ArraySchema.prototype.every = function (callbackfn, thisArg) {
		            return Array.from(this.$items.values()).every(callbackfn, thisArg);
		        };
		        /**
		         * Determines whether the specified callback function returns true for any element of an array.
		         * @param callbackfn A function that accepts up to three arguments. The some method calls
		         * the callbackfn function for each element in the array until the callbackfn returns a value
		         * which is coercible to the Boolean value true, or until the end of the array.
		         * @param thisArg An object to which the this keyword can refer in the callbackfn function.
		         * If thisArg is omitted, undefined is used as the this value.
		         */
		        ArraySchema.prototype.some = function (callbackfn, thisArg) {
		            return Array.from(this.$items.values()).some(callbackfn, thisArg);
		        };
		        /**
		         * Performs the specified action for each element in an array.
		         * @param callbackfn  A function that accepts up to three arguments. forEach calls the callbackfn function one time for each element in the array.
		         * @param thisArg  An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
		         */
		        ArraySchema.prototype.forEach = function (callbackfn, thisArg) {
		            Array.from(this.$items.values()).forEach(callbackfn, thisArg);
		        };
		        /**
		         * Calls a defined callback function on each element of an array, and returns an array that contains the results.
		         * @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
		         * @param thisArg An object to which the this keyword can refer in the callbackfn function. If thisArg is omitted, undefined is used as the this value.
		         */
		        ArraySchema.prototype.map = function (callbackfn, thisArg) {
		            return Array.from(this.$items.values()).map(callbackfn, thisArg);
		        };
		        ArraySchema.prototype.filter = function (callbackfn, thisArg) {
		            return Array.from(this.$items.values()).filter(callbackfn, thisArg);
		        };
		        /**
		         * Calls the specified callback function for all the elements in an array. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
		         * @param callbackfn A function that accepts up to four arguments. The reduce method calls the callbackfn function one time for each element in the array.
		         * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
		         */
		        ArraySchema.prototype.reduce = function (callbackfn, initialValue) {
		            return Array.prototype.reduce.apply(Array.from(this.$items.values()), arguments);
		        };
		        /**
		         * Calls the specified callback function for all the elements in an array, in descending order. The return value of the callback function is the accumulated result, and is provided as an argument in the next call to the callback function.
		         * @param callbackfn A function that accepts up to four arguments. The reduceRight method calls the callbackfn function one time for each element in the array.
		         * @param initialValue If initialValue is specified, it is used as the initial value to start the accumulation. The first call to the callbackfn function provides this value as an argument instead of an array value.
		         */
		        ArraySchema.prototype.reduceRight = function (callbackfn, initialValue) {
		            return Array.prototype.reduceRight.apply(Array.from(this.$items.values()), arguments);
		        };
		        /**
		         * Returns the value of the first element in the array where predicate is true, and undefined
		         * otherwise.
		         * @param predicate find calls predicate once for each element of the array, in ascending
		         * order, until it finds one where predicate returns true. If such an element is found, find
		         * immediately returns that element value. Otherwise, find returns undefined.
		         * @param thisArg If provided, it will be used as the this value for each invocation of
		         * predicate. If it is not provided, undefined is used instead.
		         */
		        ArraySchema.prototype.find = function (predicate, thisArg) {
		            return Array.from(this.$items.values()).find(predicate, thisArg);
		        };
		        /**
		         * Returns the index of the first element in the array where predicate is true, and -1
		         * otherwise.
		         * @param predicate find calls predicate once for each element of the array, in ascending
		         * order, until it finds one where predicate returns true. If such an element is found,
		         * findIndex immediately returns that element index. Otherwise, findIndex returns -1.
		         * @param thisArg If provided, it will be used as the this value for each invocation of
		         * predicate. If it is not provided, undefined is used instead.
		         */
		        ArraySchema.prototype.findIndex = function (predicate, thisArg) {
		            return Array.from(this.$items.values()).findIndex(predicate, thisArg);
		        };
		        /**
		         * Returns the this object after filling the section identified by start and end with value
		         * @param value value to fill array section with
		         * @param start index to start filling the array at. If start is negative, it is treated as
		         * length+start where length is the length of the array.
		         * @param end index to stop filling the array at. If end is negative, it is treated as
		         * length+end.
		         */
		        ArraySchema.prototype.fill = function (value, start, end) {
		            //
		            // TODO
		            //
		            throw new Error("ArraySchema#fill() not implemented");
		        };
		        /**
		         * Returns the this object after copying a section of the array identified by start and end
		         * to the same array starting at position target
		         * @param target If target is negative, it is treated as length+target where length is the
		         * length of the array.
		         * @param start If start is negative, it is treated as length+start. If end is negative, it
		         * is treated as length+end.
		         * @param end If not specified, length of the this object is used as its default value.
		         */
		        ArraySchema.prototype.copyWithin = function (target, start, end) {
		            //
		            // TODO
		            //
		            throw new Error("ArraySchema#copyWithin() not implemented");
		        };
		        /**
		         * Returns a string representation of an array.
		         */
		        ArraySchema.prototype.toString = function () { return this.$items.toString(); };
		        /**
		         * Returns a string representation of an array. The elements are converted to string using their toLocalString methods.
		         */
		        ArraySchema.prototype.toLocaleString = function () { return this.$items.toLocaleString(); };
		        /** Iterator */
		        ArraySchema.prototype[Symbol.iterator] = function () {
		            return Array.from(this.$items.values())[Symbol.iterator]();
		        };
		        Object.defineProperty(ArraySchema, Symbol.species, {
		            get: function () {
		                return ArraySchema;
		            },
		            enumerable: false,
		            configurable: true
		        });
		        /**
		         * Returns an iterable of key, value pairs for every entry in the array
		         */
		        ArraySchema.prototype.entries = function () { return this.$items.entries(); };
		        /**
		         * Returns an iterable of keys in the array
		         */
		        ArraySchema.prototype.keys = function () { return this.$items.keys(); };
		        /**
		         * Returns an iterable of values in the array
		         */
		        ArraySchema.prototype.values = function () { return this.$items.values(); };
		        /**
		         * Determines whether an array includes a certain element, returning true or false as appropriate.
		         * @param searchElement The element to search for.
		         * @param fromIndex The position in this array at which to begin searching for searchElement.
		         */
		        ArraySchema.prototype.includes = function (searchElement, fromIndex) {
		            return Array.from(this.$items.values()).includes(searchElement, fromIndex);
		        };
		        //
		        // ES2022
		        //
		        /**
		         * Calls a defined callback function on each element of an array. Then, flattens the result into
		         * a new array.
		         * This is identical to a map followed by flat with depth 1.
		         *
		         * @param callback A function that accepts up to three arguments. The flatMap method calls the
		         * callback function one time for each element in the array.
		         * @param thisArg An object to which the this keyword can refer in the callback function. If
		         * thisArg is omitted, undefined is used as the this value.
		         */
		        // @ts-ignore
		        ArraySchema.prototype.flatMap = function (callback, thisArg) {
		            // @ts-ignore
		            throw new Error("ArraySchema#flatMap() is not supported.");
		        };
		        /**
		         * Returns a new array with all sub-array elements concatenated into it recursively up to the
		         * specified depth.
		         *
		         * @param depth The maximum recursion depth
		         */
		        // @ts-ignore
		        ArraySchema.prototype.flat = function (depth) {
		            throw new Error("ArraySchema#flat() is not supported.");
		        };
		        ArraySchema.prototype.findLast = function () {
		            var arr = Array.from(this.$items.values());
		            // @ts-ignore
		            return arr.findLast.apply(arr, arguments);
		        };
		        ArraySchema.prototype.findLastIndex = function () {
		            var arr = Array.from(this.$items.values());
		            // @ts-ignore
		            return arr.findLastIndex.apply(arr, arguments);
		        };
		        //
		        // ES2023
		        //
		        ArraySchema.prototype.with = function (index, value) {
		            var copy = Array.from(this.$items.values());
		            copy[index] = value;
		            return new (ArraySchema.bind.apply(ArraySchema, __spreadArray([void 0], copy, false)))();
		        };
		        ArraySchema.prototype.toReversed = function () {
		            return Array.from(this.$items.values()).reverse();
		        };
		        ArraySchema.prototype.toSorted = function (compareFn) {
		            return Array.from(this.$items.values()).sort(compareFn);
		        };
		        // @ts-ignore
		        ArraySchema.prototype.toSpliced = function (start, deleteCount) {
		            var copy = Array.from(this.$items.values());
		            // @ts-ignore
		            return copy.toSpliced.apply(copy, arguments);
		        };
		        ArraySchema.prototype.setIndex = function (index, key) {
		            this.$indexes.set(index, key);
		        };
		        ArraySchema.prototype.getIndex = function (index) {
		            return this.$indexes.get(index);
		        };
		        ArraySchema.prototype.getByIndex = function (index) {
		            return this.$items.get(this.$indexes.get(index));
		        };
		        ArraySchema.prototype.deleteByIndex = function (index) {
		            var key = this.$indexes.get(index);
		            this.$items.delete(key);
		            this.$indexes.delete(index);
		        };
		        ArraySchema.prototype.toArray = function () {
		            return Array.from(this.$items.values());
		        };
		        ArraySchema.prototype.toJSON = function () {
		            return this.toArray().map(function (value) {
		                return (typeof (value['toJSON']) === "function")
		                    ? value['toJSON']()
		                    : value;
		            });
		        };
		        //
		        // Decoding utilities
		        //
		        ArraySchema.prototype.clone = function (isDecoding) {
		            var cloned;
		            if (isDecoding) {
		                cloned = new (ArraySchema.bind.apply(ArraySchema, __spreadArray([void 0], Array.from(this.$items.values()), false)))();
		            }
		            else {
		                cloned = new (ArraySchema.bind.apply(ArraySchema, __spreadArray([void 0], this.map(function (item) { return ((item['$changes'])
		                    ? item.clone()
		                    : item); }), false)))();
		            }
		            return cloned;
		        };
		        return ArraySchema;
		    }());

		    function getMapProxy(value) {
		        value['$proxy'] = true;
		        value = new Proxy(value, {
		            get: function (obj, prop) {
		                if (typeof (prop) !== "symbol" && // accessing properties
		                    typeof (obj[prop]) === "undefined") {
		                    return obj.get(prop);
		                }
		                else {
		                    return obj[prop];
		                }
		            },
		            set: function (obj, prop, setValue) {
		                if (typeof (prop) !== "symbol" &&
		                    (prop.indexOf("$") === -1 &&
		                        prop !== "onAdd" &&
		                        prop !== "onRemove" &&
		                        prop !== "onChange")) {
		                    obj.set(prop, setValue);
		                }
		                else {
		                    obj[prop] = setValue;
		                }
		                return true;
		            },
		            deleteProperty: function (obj, prop) {
		                obj.delete(prop);
		                return true;
		            },
		        });
		        return value;
		    }
		    var MapSchema = /** @class */ (function () {
		        function MapSchema(initialValues) {
		            var _this = this;
		            this.$changes = new ChangeTree(this);
		            this.$items = new Map();
		            this.$indexes = new Map();
		            this.$refId = 0;
		            if (initialValues) {
		                if (initialValues instanceof Map ||
		                    initialValues instanceof MapSchema) {
		                    initialValues.forEach(function (v, k) { return _this.set(k, v); });
		                }
		                else {
		                    for (var k in initialValues) {
		                        this.set(k, initialValues[k]);
		                    }
		                }
		            }
		        }
		        MapSchema.prototype.onAdd = function (callback, triggerAll) {
		            if (triggerAll === void 0) { triggerAll = true; }
		            return addCallback((this.$callbacks || (this.$callbacks = {})), exports.OPERATION.ADD, callback, (triggerAll)
		                ? this.$items
		                : undefined);
		        };
		        MapSchema.prototype.onRemove = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = {}), exports.OPERATION.DELETE, callback); };
		        MapSchema.prototype.onChange = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = {}), exports.OPERATION.REPLACE, callback); };
		        MapSchema.is = function (type) {
		            return type['map'] !== undefined;
		        };
		        /** Iterator */
		        MapSchema.prototype[Symbol.iterator] = function () { return this.$items[Symbol.iterator](); };
		        Object.defineProperty(MapSchema.prototype, Symbol.toStringTag, {
		            get: function () { return this.$items[Symbol.toStringTag]; },
		            enumerable: false,
		            configurable: true
		        });
		        Object.defineProperty(MapSchema, Symbol.species, {
		            get: function () {
		                return MapSchema;
		            },
		            enumerable: false,
		            configurable: true
		        });
		        MapSchema.prototype.set = function (key, value) {
		            if (value === undefined || value === null) {
		                throw new Error("MapSchema#set('".concat(key, "', ").concat(value, "): trying to set ").concat(value, " value on '").concat(key, "'."));
		            }
		            // Force "key" as string
		            // See: https://github.com/colyseus/colyseus/issues/561#issuecomment-1646733468
		            key = key.toString();
		            // get "index" for this value.
		            var hasIndex = typeof (this.$changes.indexes[key]) !== "undefined";
		            var index = (hasIndex)
		                ? this.$changes.indexes[key]
		                : this.$refId++;
		            var operation = (hasIndex)
		                ? exports.OPERATION.REPLACE
		                : exports.OPERATION.ADD;
		            var isRef = (value['$changes']) !== undefined;
		            if (isRef) {
		                value['$changes'].setParent(this, this.$changes.root, index);
		            }
		            //
		            // (encoding)
		            // set a unique id to relate directly with this key/value.
		            //
		            if (!hasIndex) {
		                this.$changes.indexes[key] = index;
		                this.$indexes.set(index, key);
		            }
		            else if (!isRef &&
		                this.$items.get(key) === value) {
		                // if value is the same, avoid re-encoding it.
		                return;
		            }
		            else if (isRef && // if is schema, force ADD operation if value differ from previous one.
		                this.$items.get(key) !== value) {
		                operation = exports.OPERATION.ADD;
		            }
		            this.$items.set(key, value);
		            this.$changes.change(key, operation);
		            return this;
		        };
		        MapSchema.prototype.get = function (key) {
		            return this.$items.get(key);
		        };
		        MapSchema.prototype.delete = function (key) {
		            //
		            // TODO: add a "purge" method after .encode() runs, to cleanup removed `$indexes`
		            //
		            // We don't remove $indexes to allow setting the same key in the same patch
		            // (See "should allow to remove and set an item in the same place" test)
		            //
		            // // const index = this.$changes.indexes[key];
		            // // this.$indexes.delete(index);
		            this.$changes.delete(key.toString());
		            return this.$items.delete(key);
		        };
		        MapSchema.prototype.clear = function (changes) {
		            // discard previous operations.
		            this.$changes.discard(true, true);
		            this.$changes.indexes = {};
		            // clear previous indexes
		            this.$indexes.clear();
		            //
		            // When decoding:
		            // - enqueue items for DELETE callback.
		            // - flag child items for garbage collection.
		            //
		            if (changes) {
		                removeChildRefs.call(this, changes);
		            }
		            // clear items
		            this.$items.clear();
		            this.$changes.operation({ index: 0, op: exports.OPERATION.CLEAR });
		            // touch all structures until reach root
		            this.$changes.touchParents();
		        };
		        MapSchema.prototype.has = function (key) {
		            return this.$items.has(key);
		        };
		        MapSchema.prototype.forEach = function (callbackfn) {
		            this.$items.forEach(callbackfn);
		        };
		        MapSchema.prototype.entries = function () {
		            return this.$items.entries();
		        };
		        MapSchema.prototype.keys = function () {
		            return this.$items.keys();
		        };
		        MapSchema.prototype.values = function () {
		            return this.$items.values();
		        };
		        Object.defineProperty(MapSchema.prototype, "size", {
		            get: function () {
		                return this.$items.size;
		            },
		            enumerable: false,
		            configurable: true
		        });
		        MapSchema.prototype.setIndex = function (index, key) {
		            this.$indexes.set(index, key);
		        };
		        MapSchema.prototype.getIndex = function (index) {
		            return this.$indexes.get(index);
		        };
		        MapSchema.prototype.getByIndex = function (index) {
		            return this.$items.get(this.$indexes.get(index));
		        };
		        MapSchema.prototype.deleteByIndex = function (index) {
		            var key = this.$indexes.get(index);
		            this.$items.delete(key);
		            this.$indexes.delete(index);
		        };
		        MapSchema.prototype.toJSON = function () {
		            var map = {};
		            this.forEach(function (value, key) {
		                map[key] = (typeof (value['toJSON']) === "function")
		                    ? value['toJSON']()
		                    : value;
		            });
		            return map;
		        };
		        //
		        // Decoding utilities
		        //
		        MapSchema.prototype.clone = function (isDecoding) {
		            var cloned;
		            if (isDecoding) {
		                // client-side
		                cloned = Object.assign(new MapSchema(), this);
		            }
		            else {
		                // server-side
		                cloned = new MapSchema();
		                this.forEach(function (value, key) {
		                    if (value['$changes']) {
		                        cloned.set(key, value['clone']());
		                    }
		                    else {
		                        cloned.set(key, value);
		                    }
		                });
		            }
		            return cloned;
		        };
		        return MapSchema;
		    }());

		    var registeredTypes = {};
		    function registerType(identifier, definition) {
		        registeredTypes[identifier] = definition;
		    }
		    function getType(identifier) {
		        return registeredTypes[identifier];
		    }

		    var SchemaDefinition = /** @class */ (function () {
		        function SchemaDefinition() {
		            //
		            // TODO: use a "field" structure combining all these properties per-field.
		            //
		            this.indexes = {};
		            this.fieldsByIndex = {};
		            this.deprecated = {};
		            this.descriptors = {};
		        }
		        SchemaDefinition.create = function (parent) {
		            var definition = new SchemaDefinition();
		            // support inheritance
		            definition.schema = Object.assign({}, parent && parent.schema || {});
		            definition.indexes = Object.assign({}, parent && parent.indexes || {});
		            definition.fieldsByIndex = Object.assign({}, parent && parent.fieldsByIndex || {});
		            definition.descriptors = Object.assign({}, parent && parent.descriptors || {});
		            definition.deprecated = Object.assign({}, parent && parent.deprecated || {});
		            return definition;
		        };
		        SchemaDefinition.prototype.addField = function (field, type) {
		            var index = this.getNextFieldIndex();
		            this.fieldsByIndex[index] = field;
		            this.indexes[field] = index;
		            this.schema[field] = (Array.isArray(type))
		                ? { array: type[0] }
		                : type;
		        };
		        SchemaDefinition.prototype.hasField = function (field) {
		            return this.indexes[field] !== undefined;
		        };
		        SchemaDefinition.prototype.addFilter = function (field, cb) {
		            if (!this.filters) {
		                this.filters = {};
		                this.indexesWithFilters = [];
		            }
		            this.filters[this.indexes[field]] = cb;
		            this.indexesWithFilters.push(this.indexes[field]);
		            return true;
		        };
		        SchemaDefinition.prototype.addChildrenFilter = function (field, cb) {
		            var index = this.indexes[field];
		            var type = this.schema[field];
		            if (getType(Object.keys(type)[0])) {
		                if (!this.childFilters) {
		                    this.childFilters = {};
		                }
		                this.childFilters[index] = cb;
		                return true;
		            }
		            else {
		                console.warn("@filterChildren: field '".concat(field, "' can't have children. Ignoring filter."));
		            }
		        };
		        SchemaDefinition.prototype.getChildrenFilter = function (field) {
		            return this.childFilters && this.childFilters[this.indexes[field]];
		        };
		        SchemaDefinition.prototype.getNextFieldIndex = function () {
		            return Object.keys(this.schema || {}).length;
		        };
		        return SchemaDefinition;
		    }());
		    function hasFilter(klass) {
		        return klass._context && klass._context.useFilters;
		    }
		    var Context = /** @class */ (function () {
		        function Context() {
		            this.types = {};
		            this.schemas = new Map();
		            this.useFilters = false;
		        }
		        Context.prototype.has = function (schema) {
		            return this.schemas.has(schema);
		        };
		        Context.prototype.get = function (typeid) {
		            return this.types[typeid];
		        };
		        Context.prototype.add = function (schema, typeid) {
		            if (typeid === void 0) { typeid = this.schemas.size; }
		            // FIXME: move this to somewhere else?
		            // support inheritance
		            schema._definition = SchemaDefinition.create(schema._definition);
		            schema._typeid = typeid;
		            this.types[typeid] = schema;
		            this.schemas.set(schema, typeid);
		        };
		        Context.create = function (options) {
		            if (options === void 0) { options = {}; }
		            return function (definition) {
		                if (!options.context) {
		                    options.context = new Context();
		                }
		                return type(definition, options);
		            };
		        };
		        return Context;
		    }());
		    var globalContext = new Context();
		    /**
		     * [See documentation](https://docs.colyseus.io/state/schema/)
		     *
		     * Annotate a Schema property to be serializeable.
		     * \@type()'d fields are automatically flagged as "dirty" for the next patch.
		     *
		     * @example Standard usage, with automatic change tracking.
		     * ```
		     * \@type("string") propertyName: string;
		     * ```
		     *
		     * @example You can provide the "manual" option if you'd like to manually control your patches via .setDirty().
		     * ```
		     * \@type("string", { manual: true })
		     * ```
		     */
		    function type(type, options) {
		        if (options === void 0) { options = {}; }
		        return function (target, field) {
		            var context = options.context || globalContext;
		            var constructor = target.constructor;
		            constructor._context = context;
		            if (!type) {
		                throw new Error("".concat(constructor.name, ": @type() reference provided for \"").concat(field, "\" is undefined. Make sure you don't have any circular dependencies."));
		            }
		            /*
		             * static schema
		             */
		            if (!context.has(constructor)) {
		                context.add(constructor);
		            }
		            var definition = constructor._definition;
		            definition.addField(field, type);
		            /**
		             * skip if descriptor already exists for this field (`@deprecated()`)
		             */
		            if (definition.descriptors[field]) {
		                if (definition.deprecated[field]) {
		                    // do not create accessors for deprecated properties.
		                    return;
		                }
		                else {
		                    // trying to define same property multiple times across inheritance.
		                    // https://github.com/colyseus/colyseus-unity3d/issues/131#issuecomment-814308572
		                    try {
		                        throw new Error("@colyseus/schema: Duplicate '".concat(field, "' definition on '").concat(constructor.name, "'.\nCheck @type() annotation"));
		                    }
		                    catch (e) {
		                        var definitionAtLine = e.stack.split("\n")[4].trim();
		                        throw new Error("".concat(e.message, " ").concat(definitionAtLine));
		                    }
		                }
		            }
		            var isArray = ArraySchema.is(type);
		            var isMap = !isArray && MapSchema.is(type);
		            // TODO: refactor me.
		            // Allow abstract intermediary classes with no fields to be serialized
		            // (See "should support an inheritance with a Schema type without fields" test)
		            if (typeof (type) !== "string" && !Schema.is(type)) {
		                var childType = Object.values(type)[0];
		                if (typeof (childType) !== "string" && !context.has(childType)) {
		                    context.add(childType);
		                }
		            }
		            if (options.manual) {
		                // do not declare getter/setter descriptor
		                definition.descriptors[field] = {
		                    enumerable: true,
		                    configurable: true,
		                    writable: true,
		                };
		                return;
		            }
		            var fieldCached = "_".concat(field);
		            definition.descriptors[fieldCached] = {
		                enumerable: false,
		                configurable: false,
		                writable: true,
		            };
		            definition.descriptors[field] = {
		                get: function () {
		                    return this[fieldCached];
		                },
		                set: function (value) {
		                    /**
		                     * Create Proxy for array or map items
		                     */
		                    // skip if value is the same as cached.
		                    if (value === this[fieldCached]) {
		                        return;
		                    }
		                    if (value !== undefined &&
		                        value !== null) {
		                        // automaticallty transform Array into ArraySchema
		                        if (isArray && !(value instanceof ArraySchema)) {
		                            value = new (ArraySchema.bind.apply(ArraySchema, __spreadArray([void 0], value, false)))();
		                        }
		                        // automaticallty transform Map into MapSchema
		                        if (isMap && !(value instanceof MapSchema)) {
		                            value = new MapSchema(value);
		                        }
		                        // try to turn provided structure into a Proxy
		                        if (value['$proxy'] === undefined) {
		                            if (isMap) {
		                                value = getMapProxy(value);
		                            }
		                            else if (isArray) {
		                                value = getArrayProxy(value);
		                            }
		                        }
		                        // flag the change for encoding.
		                        this.$changes.change(field);
		                        //
		                        // call setParent() recursively for this and its child
		                        // structures.
		                        //
		                        if (value['$changes']) {
		                            value['$changes'].setParent(this, this.$changes.root, this._definition.indexes[field]);
		                        }
		                    }
		                    else if (this[fieldCached]) {
		                        //
		                        // Setting a field to `null` or `undefined` will delete it.
		                        //
		                        this.$changes.delete(field);
		                    }
		                    this[fieldCached] = value;
		                },
		                enumerable: true,
		                configurable: true
		            };
		        };
		    }
		    /**
		     * `@filter()` decorator for defining data filters per client
		     */
		    function filter(cb) {
		        return function (target, field) {
		            var constructor = target.constructor;
		            var definition = constructor._definition;
		            if (definition.addFilter(field, cb)) {
		                constructor._context.useFilters = true;
		            }
		        };
		    }
		    function filterChildren(cb) {
		        return function (target, field) {
		            var constructor = target.constructor;
		            var definition = constructor._definition;
		            if (definition.addChildrenFilter(field, cb)) {
		                constructor._context.useFilters = true;
		            }
		        };
		    }
		    /**
		     * `@deprecated()` flag a field as deprecated.
		     * The previous `@type()` annotation should remain along with this one.
		     */
		    function deprecated(throws) {
		        if (throws === void 0) { throws = true; }
		        return function (target, field) {
		            var constructor = target.constructor;
		            var definition = constructor._definition;
		            definition.deprecated[field] = true;
		            if (throws) {
		                definition.descriptors[field] = {
		                    get: function () { throw new Error("".concat(field, " is deprecated.")); },
		                    set: function (value) { },
		                    enumerable: false,
		                    configurable: true
		                };
		            }
		        };
		    }
		    function defineTypes(target, fields, options) {
		        if (options === void 0) { options = {}; }
		        if (!options.context) {
		            options.context = target._context || options.context || globalContext;
		        }
		        for (var field in fields) {
		            type(fields[field], options)(target.prototype, field);
		        }
		        return target;
		    }

		    /**
		     * Copyright (c) 2018 Endel Dreyer
		     * Copyright (c) 2014 Ion Drive Software Ltd.
		     *
		     * Permission is hereby granted, free of charge, to any person obtaining a copy
		     * of this software and associated documentation files (the "Software"), to deal
		     * in the Software without restriction, including without limitation the rights
		     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
		     * copies of the Software, and to permit persons to whom the Software is
		     * furnished to do so, subject to the following conditions:
		     *
		     * The above copyright notice and this permission notice shall be included in all
		     * copies or substantial portions of the Software.
		     *
		     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
		     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
		     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
		     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
		     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
		     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
		     * SOFTWARE
		     */
		    /**
		     * msgpack implementation highly based on notepack.io
		     * https://github.com/darrachequesne/notepack
		     */
		    function utf8Length(str) {
		        var c = 0, length = 0;
		        for (var i = 0, l = str.length; i < l; i++) {
		            c = str.charCodeAt(i);
		            if (c < 0x80) {
		                length += 1;
		            }
		            else if (c < 0x800) {
		                length += 2;
		            }
		            else if (c < 0xd800 || c >= 0xe000) {
		                length += 3;
		            }
		            else {
		                i++;
		                length += 4;
		            }
		        }
		        return length;
		    }
		    function utf8Write(view, offset, str) {
		        var c = 0;
		        for (var i = 0, l = str.length; i < l; i++) {
		            c = str.charCodeAt(i);
		            if (c < 0x80) {
		                view[offset++] = c;
		            }
		            else if (c < 0x800) {
		                view[offset++] = 0xc0 | (c >> 6);
		                view[offset++] = 0x80 | (c & 0x3f);
		            }
		            else if (c < 0xd800 || c >= 0xe000) {
		                view[offset++] = 0xe0 | (c >> 12);
		                view[offset++] = 0x80 | (c >> 6 & 0x3f);
		                view[offset++] = 0x80 | (c & 0x3f);
		            }
		            else {
		                i++;
		                c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
		                view[offset++] = 0xf0 | (c >> 18);
		                view[offset++] = 0x80 | (c >> 12 & 0x3f);
		                view[offset++] = 0x80 | (c >> 6 & 0x3f);
		                view[offset++] = 0x80 | (c & 0x3f);
		            }
		        }
		    }
		    function int8$1(bytes, value) {
		        bytes.push(value & 255);
		    }
		    function uint8$1(bytes, value) {
		        bytes.push(value & 255);
		    }
		    function int16$1(bytes, value) {
		        bytes.push(value & 255);
		        bytes.push((value >> 8) & 255);
		    }
		    function uint16$1(bytes, value) {
		        bytes.push(value & 255);
		        bytes.push((value >> 8) & 255);
		    }
		    function int32$1(bytes, value) {
		        bytes.push(value & 255);
		        bytes.push((value >> 8) & 255);
		        bytes.push((value >> 16) & 255);
		        bytes.push((value >> 24) & 255);
		    }
		    function uint32$1(bytes, value) {
		        var b4 = value >> 24;
		        var b3 = value >> 16;
		        var b2 = value >> 8;
		        var b1 = value;
		        bytes.push(b1 & 255);
		        bytes.push(b2 & 255);
		        bytes.push(b3 & 255);
		        bytes.push(b4 & 255);
		    }
		    function int64$1(bytes, value) {
		        var high = Math.floor(value / Math.pow(2, 32));
		        var low = value >>> 0;
		        uint32$1(bytes, low);
		        uint32$1(bytes, high);
		    }
		    function uint64$1(bytes, value) {
		        var high = (value / Math.pow(2, 32)) >> 0;
		        var low = value >>> 0;
		        uint32$1(bytes, low);
		        uint32$1(bytes, high);
		    }
		    function float32$1(bytes, value) {
		        writeFloat32(bytes, value);
		    }
		    function float64$1(bytes, value) {
		        writeFloat64(bytes, value);
		    }
		    var _int32$1 = new Int32Array(2);
		    var _float32$1 = new Float32Array(_int32$1.buffer);
		    var _float64$1 = new Float64Array(_int32$1.buffer);
		    function writeFloat32(bytes, value) {
		        _float32$1[0] = value;
		        int32$1(bytes, _int32$1[0]);
		    }
		    function writeFloat64(bytes, value) {
		        _float64$1[0] = value;
		        int32$1(bytes, _int32$1[0 ]);
		        int32$1(bytes, _int32$1[1 ]);
		    }
		    function boolean$1(bytes, value) {
		        return uint8$1(bytes, value ? 1 : 0);
		    }
		    function string$1(bytes, value) {
		        // encode `null` strings as empty.
		        if (!value) {
		            value = "";
		        }
		        var length = utf8Length(value);
		        var size = 0;
		        // fixstr
		        if (length < 0x20) {
		            bytes.push(length | 0xa0);
		            size = 1;
		        }
		        // str 8
		        else if (length < 0x100) {
		            bytes.push(0xd9);
		            uint8$1(bytes, length);
		            size = 2;
		        }
		        // str 16
		        else if (length < 0x10000) {
		            bytes.push(0xda);
		            uint16$1(bytes, length);
		            size = 3;
		        }
		        // str 32
		        else if (length < 0x100000000) {
		            bytes.push(0xdb);
		            uint32$1(bytes, length);
		            size = 5;
		        }
		        else {
		            throw new Error('String too long');
		        }
		        utf8Write(bytes, bytes.length, value);
		        return size + length;
		    }
		    function number$1(bytes, value) {
		        if (isNaN(value)) {
		            return number$1(bytes, 0);
		        }
		        else if (!isFinite(value)) {
		            return number$1(bytes, (value > 0) ? Number.MAX_SAFE_INTEGER : -Number.MAX_SAFE_INTEGER);
		        }
		        else if (value !== (value | 0)) {
		            bytes.push(0xcb);
		            writeFloat64(bytes, value);
		            return 9;
		            // TODO: encode float 32?
		            // is it possible to differentiate between float32 / float64 here?
		            // // float 32
		            // bytes.push(0xca);
		            // writeFloat32(bytes, value);
		            // return 5;
		        }
		        if (value >= 0) {
		            // positive fixnum
		            if (value < 0x80) {
		                uint8$1(bytes, value);
		                return 1;
		            }
		            // uint 8
		            if (value < 0x100) {
		                bytes.push(0xcc);
		                uint8$1(bytes, value);
		                return 2;
		            }
		            // uint 16
		            if (value < 0x10000) {
		                bytes.push(0xcd);
		                uint16$1(bytes, value);
		                return 3;
		            }
		            // uint 32
		            if (value < 0x100000000) {
		                bytes.push(0xce);
		                uint32$1(bytes, value);
		                return 5;
		            }
		            // uint 64
		            bytes.push(0xcf);
		            uint64$1(bytes, value);
		            return 9;
		        }
		        else {
		            // negative fixnum
		            if (value >= -0x20) {
		                bytes.push(0xe0 | (value + 0x20));
		                return 1;
		            }
		            // int 8
		            if (value >= -0x80) {
		                bytes.push(0xd0);
		                int8$1(bytes, value);
		                return 2;
		            }
		            // int 16
		            if (value >= -0x8000) {
		                bytes.push(0xd1);
		                int16$1(bytes, value);
		                return 3;
		            }
		            // int 32
		            if (value >= -0x80000000) {
		                bytes.push(0xd2);
		                int32$1(bytes, value);
		                return 5;
		            }
		            // int 64
		            bytes.push(0xd3);
		            int64$1(bytes, value);
		            return 9;
		        }
		    }

		    var encode = /*#__PURE__*/Object.freeze({
		        __proto__: null,
		        utf8Write: utf8Write,
		        int8: int8$1,
		        uint8: uint8$1,
		        int16: int16$1,
		        uint16: uint16$1,
		        int32: int32$1,
		        uint32: uint32$1,
		        int64: int64$1,
		        uint64: uint64$1,
		        float32: float32$1,
		        float64: float64$1,
		        writeFloat32: writeFloat32,
		        writeFloat64: writeFloat64,
		        boolean: boolean$1,
		        string: string$1,
		        number: number$1
		    });

		    /**
		     * Copyright (c) 2018 Endel Dreyer
		     * Copyright (c) 2014 Ion Drive Software Ltd.
		     *
		     * Permission is hereby granted, free of charge, to any person obtaining a copy
		     * of this software and associated documentation files (the "Software"), to deal
		     * in the Software without restriction, including without limitation the rights
		     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
		     * copies of the Software, and to permit persons to whom the Software is
		     * furnished to do so, subject to the following conditions:
		     *
		     * The above copyright notice and this permission notice shall be included in all
		     * copies or substantial portions of the Software.
		     *
		     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
		     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
		     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
		     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
		     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
		     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
		     * SOFTWARE
		     */
		    function utf8Read(bytes, offset, length) {
		        var string = '', chr = 0;
		        for (var i = offset, end = offset + length; i < end; i++) {
		            var byte = bytes[i];
		            if ((byte & 0x80) === 0x00) {
		                string += String.fromCharCode(byte);
		                continue;
		            }
		            if ((byte & 0xe0) === 0xc0) {
		                string += String.fromCharCode(((byte & 0x1f) << 6) |
		                    (bytes[++i] & 0x3f));
		                continue;
		            }
		            if ((byte & 0xf0) === 0xe0) {
		                string += String.fromCharCode(((byte & 0x0f) << 12) |
		                    ((bytes[++i] & 0x3f) << 6) |
		                    ((bytes[++i] & 0x3f) << 0));
		                continue;
		            }
		            if ((byte & 0xf8) === 0xf0) {
		                chr = ((byte & 0x07) << 18) |
		                    ((bytes[++i] & 0x3f) << 12) |
		                    ((bytes[++i] & 0x3f) << 6) |
		                    ((bytes[++i] & 0x3f) << 0);
		                if (chr >= 0x010000) { // surrogate pair
		                    chr -= 0x010000;
		                    string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
		                }
		                else {
		                    string += String.fromCharCode(chr);
		                }
		                continue;
		            }
		            console.error('Invalid byte ' + byte.toString(16));
		            // (do not throw error to avoid server/client from crashing due to hack attemps)
		            // throw new Error('Invalid byte ' + byte.toString(16));
		        }
		        return string;
		    }
		    function int8(bytes, it) {
		        return uint8(bytes, it) << 24 >> 24;
		    }
		    function uint8(bytes, it) {
		        return bytes[it.offset++];
		    }
		    function int16(bytes, it) {
		        return uint16(bytes, it) << 16 >> 16;
		    }
		    function uint16(bytes, it) {
		        return bytes[it.offset++] | bytes[it.offset++] << 8;
		    }
		    function int32(bytes, it) {
		        return bytes[it.offset++] | bytes[it.offset++] << 8 | bytes[it.offset++] << 16 | bytes[it.offset++] << 24;
		    }
		    function uint32(bytes, it) {
		        return int32(bytes, it) >>> 0;
		    }
		    function float32(bytes, it) {
		        return readFloat32(bytes, it);
		    }
		    function float64(bytes, it) {
		        return readFloat64(bytes, it);
		    }
		    function int64(bytes, it) {
		        var low = uint32(bytes, it);
		        var high = int32(bytes, it) * Math.pow(2, 32);
		        return high + low;
		    }
		    function uint64(bytes, it) {
		        var low = uint32(bytes, it);
		        var high = uint32(bytes, it) * Math.pow(2, 32);
		        return high + low;
		    }
		    var _int32 = new Int32Array(2);
		    var _float32 = new Float32Array(_int32.buffer);
		    var _float64 = new Float64Array(_int32.buffer);
		    function readFloat32(bytes, it) {
		        _int32[0] = int32(bytes, it);
		        return _float32[0];
		    }
		    function readFloat64(bytes, it) {
		        _int32[0 ] = int32(bytes, it);
		        _int32[1 ] = int32(bytes, it);
		        return _float64[0];
		    }
		    function boolean(bytes, it) {
		        return uint8(bytes, it) > 0;
		    }
		    function string(bytes, it) {
		        var prefix = bytes[it.offset++];
		        var length;
		        if (prefix < 0xc0) {
		            // fixstr
		            length = prefix & 0x1f;
		        }
		        else if (prefix === 0xd9) {
		            length = uint8(bytes, it);
		        }
		        else if (prefix === 0xda) {
		            length = uint16(bytes, it);
		        }
		        else if (prefix === 0xdb) {
		            length = uint32(bytes, it);
		        }
		        var value = utf8Read(bytes, it.offset, length);
		        it.offset += length;
		        return value;
		    }
		    function stringCheck(bytes, it) {
		        var prefix = bytes[it.offset];
		        return (
		        // fixstr
		        (prefix < 0xc0 && prefix > 0xa0) ||
		            // str 8
		            prefix === 0xd9 ||
		            // str 16
		            prefix === 0xda ||
		            // str 32
		            prefix === 0xdb);
		    }
		    function number(bytes, it) {
		        var prefix = bytes[it.offset++];
		        if (prefix < 0x80) {
		            // positive fixint
		            return prefix;
		        }
		        else if (prefix === 0xca) {
		            // float 32
		            return readFloat32(bytes, it);
		        }
		        else if (prefix === 0xcb) {
		            // float 64
		            return readFloat64(bytes, it);
		        }
		        else if (prefix === 0xcc) {
		            // uint 8
		            return uint8(bytes, it);
		        }
		        else if (prefix === 0xcd) {
		            // uint 16
		            return uint16(bytes, it);
		        }
		        else if (prefix === 0xce) {
		            // uint 32
		            return uint32(bytes, it);
		        }
		        else if (prefix === 0xcf) {
		            // uint 64
		            return uint64(bytes, it);
		        }
		        else if (prefix === 0xd0) {
		            // int 8
		            return int8(bytes, it);
		        }
		        else if (prefix === 0xd1) {
		            // int 16
		            return int16(bytes, it);
		        }
		        else if (prefix === 0xd2) {
		            // int 32
		            return int32(bytes, it);
		        }
		        else if (prefix === 0xd3) {
		            // int 64
		            return int64(bytes, it);
		        }
		        else if (prefix > 0xdf) {
		            // negative fixint
		            return (0xff - prefix + 1) * -1;
		        }
		    }
		    function numberCheck(bytes, it) {
		        var prefix = bytes[it.offset];
		        // positive fixint - 0x00 - 0x7f
		        // float 32        - 0xca
		        // float 64        - 0xcb
		        // uint 8          - 0xcc
		        // uint 16         - 0xcd
		        // uint 32         - 0xce
		        // uint 64         - 0xcf
		        // int 8           - 0xd0
		        // int 16          - 0xd1
		        // int 32          - 0xd2
		        // int 64          - 0xd3
		        return (prefix < 0x80 ||
		            (prefix >= 0xca && prefix <= 0xd3));
		    }
		    function arrayCheck(bytes, it) {
		        return bytes[it.offset] < 0xa0;
		        // const prefix = bytes[it.offset] ;
		        // if (prefix < 0xa0) {
		        //   return prefix;
		        // // array
		        // } else if (prefix === 0xdc) {
		        //   it.offset += 2;
		        // } else if (0xdd) {
		        //   it.offset += 4;
		        // }
		        // return prefix;
		    }
		    function switchStructureCheck(bytes, it) {
		        return (
		        // previous byte should be `SWITCH_TO_STRUCTURE`
		        bytes[it.offset - 1] === SWITCH_TO_STRUCTURE &&
		            // next byte should be a number
		            (bytes[it.offset] < 0x80 || (bytes[it.offset] >= 0xca && bytes[it.offset] <= 0xd3)));
		    }

		    var decode = /*#__PURE__*/Object.freeze({
		        __proto__: null,
		        int8: int8,
		        uint8: uint8,
		        int16: int16,
		        uint16: uint16,
		        int32: int32,
		        uint32: uint32,
		        float32: float32,
		        float64: float64,
		        int64: int64,
		        uint64: uint64,
		        readFloat32: readFloat32,
		        readFloat64: readFloat64,
		        boolean: boolean,
		        string: string,
		        stringCheck: stringCheck,
		        number: number,
		        numberCheck: numberCheck,
		        arrayCheck: arrayCheck,
		        switchStructureCheck: switchStructureCheck
		    });

		    var CollectionSchema = /** @class */ (function () {
		        function CollectionSchema(initialValues) {
		            var _this = this;
		            this.$changes = new ChangeTree(this);
		            this.$items = new Map();
		            this.$indexes = new Map();
		            this.$refId = 0;
		            if (initialValues) {
		                initialValues.forEach(function (v) { return _this.add(v); });
		            }
		        }
		        CollectionSchema.prototype.onAdd = function (callback, triggerAll) {
		            if (triggerAll === void 0) { triggerAll = true; }
		            return addCallback((this.$callbacks || (this.$callbacks = [])), exports.OPERATION.ADD, callback, (triggerAll)
		                ? this.$items
		                : undefined);
		        };
		        CollectionSchema.prototype.onRemove = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = []), exports.OPERATION.DELETE, callback); };
		        CollectionSchema.prototype.onChange = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = []), exports.OPERATION.REPLACE, callback); };
		        CollectionSchema.is = function (type) {
		            return type['collection'] !== undefined;
		        };
		        CollectionSchema.prototype.add = function (value) {
		            // set "index" for reference.
		            var index = this.$refId++;
		            var isRef = (value['$changes']) !== undefined;
		            if (isRef) {
		                value['$changes'].setParent(this, this.$changes.root, index);
		            }
		            this.$changes.indexes[index] = index;
		            this.$indexes.set(index, index);
		            this.$items.set(index, value);
		            this.$changes.change(index);
		            return index;
		        };
		        CollectionSchema.prototype.at = function (index) {
		            var key = Array.from(this.$items.keys())[index];
		            return this.$items.get(key);
		        };
		        CollectionSchema.prototype.entries = function () {
		            return this.$items.entries();
		        };
		        CollectionSchema.prototype.delete = function (item) {
		            var entries = this.$items.entries();
		            var index;
		            var entry;
		            while (entry = entries.next()) {
		                if (entry.done) {
		                    break;
		                }
		                if (item === entry.value[1]) {
		                    index = entry.value[0];
		                    break;
		                }
		            }
		            if (index === undefined) {
		                return false;
		            }
		            this.$changes.delete(index);
		            this.$indexes.delete(index);
		            return this.$items.delete(index);
		        };
		        CollectionSchema.prototype.clear = function (changes) {
		            // discard previous operations.
		            this.$changes.discard(true, true);
		            this.$changes.indexes = {};
		            // clear previous indexes
		            this.$indexes.clear();
		            //
		            // When decoding:
		            // - enqueue items for DELETE callback.
		            // - flag child items for garbage collection.
		            //
		            if (changes) {
		                removeChildRefs.call(this, changes);
		            }
		            // clear items
		            this.$items.clear();
		            this.$changes.operation({ index: 0, op: exports.OPERATION.CLEAR });
		            // touch all structures until reach root
		            this.$changes.touchParents();
		        };
		        CollectionSchema.prototype.has = function (value) {
		            return Array.from(this.$items.values()).some(function (v) { return v === value; });
		        };
		        CollectionSchema.prototype.forEach = function (callbackfn) {
		            var _this = this;
		            this.$items.forEach(function (value, key, _) { return callbackfn(value, key, _this); });
		        };
		        CollectionSchema.prototype.values = function () {
		            return this.$items.values();
		        };
		        Object.defineProperty(CollectionSchema.prototype, "size", {
		            get: function () {
		                return this.$items.size;
		            },
		            enumerable: false,
		            configurable: true
		        });
		        CollectionSchema.prototype.setIndex = function (index, key) {
		            this.$indexes.set(index, key);
		        };
		        CollectionSchema.prototype.getIndex = function (index) {
		            return this.$indexes.get(index);
		        };
		        CollectionSchema.prototype.getByIndex = function (index) {
		            return this.$items.get(this.$indexes.get(index));
		        };
		        CollectionSchema.prototype.deleteByIndex = function (index) {
		            var key = this.$indexes.get(index);
		            this.$items.delete(key);
		            this.$indexes.delete(index);
		        };
		        CollectionSchema.prototype.toArray = function () {
		            return Array.from(this.$items.values());
		        };
		        CollectionSchema.prototype.toJSON = function () {
		            var values = [];
		            this.forEach(function (value, key) {
		                values.push((typeof (value['toJSON']) === "function")
		                    ? value['toJSON']()
		                    : value);
		            });
		            return values;
		        };
		        //
		        // Decoding utilities
		        //
		        CollectionSchema.prototype.clone = function (isDecoding) {
		            var cloned;
		            if (isDecoding) {
		                // client-side
		                cloned = Object.assign(new CollectionSchema(), this);
		            }
		            else {
		                // server-side
		                cloned = new CollectionSchema();
		                this.forEach(function (value) {
		                    if (value['$changes']) {
		                        cloned.add(value['clone']());
		                    }
		                    else {
		                        cloned.add(value);
		                    }
		                });
		            }
		            return cloned;
		        };
		        return CollectionSchema;
		    }());

		    var SetSchema = /** @class */ (function () {
		        function SetSchema(initialValues) {
		            var _this = this;
		            this.$changes = new ChangeTree(this);
		            this.$items = new Map();
		            this.$indexes = new Map();
		            this.$refId = 0;
		            if (initialValues) {
		                initialValues.forEach(function (v) { return _this.add(v); });
		            }
		        }
		        SetSchema.prototype.onAdd = function (callback, triggerAll) {
		            if (triggerAll === void 0) { triggerAll = true; }
		            return addCallback((this.$callbacks || (this.$callbacks = [])), exports.OPERATION.ADD, callback, (triggerAll)
		                ? this.$items
		                : undefined);
		        };
		        SetSchema.prototype.onRemove = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = []), exports.OPERATION.DELETE, callback); };
		        SetSchema.prototype.onChange = function (callback) { return addCallback(this.$callbacks || (this.$callbacks = []), exports.OPERATION.REPLACE, callback); };
		        SetSchema.is = function (type) {
		            return type['set'] !== undefined;
		        };
		        SetSchema.prototype.add = function (value) {
		            var _a, _b;
		            // immediatelly return false if value already added.
		            if (this.has(value)) {
		                return false;
		            }
		            // set "index" for reference.
		            var index = this.$refId++;
		            if ((value['$changes']) !== undefined) {
		                value['$changes'].setParent(this, this.$changes.root, index);
		            }
		            var operation = (_b = (_a = this.$changes.indexes[index]) === null || _a === void 0 ? void 0 : _a.op) !== null && _b !== void 0 ? _b : exports.OPERATION.ADD;
		            this.$changes.indexes[index] = index;
		            this.$indexes.set(index, index);
		            this.$items.set(index, value);
		            this.$changes.change(index, operation);
		            return index;
		        };
		        SetSchema.prototype.entries = function () {
		            return this.$items.entries();
		        };
		        SetSchema.prototype.delete = function (item) {
		            var entries = this.$items.entries();
		            var index;
		            var entry;
		            while (entry = entries.next()) {
		                if (entry.done) {
		                    break;
		                }
		                if (item === entry.value[1]) {
		                    index = entry.value[0];
		                    break;
		                }
		            }
		            if (index === undefined) {
		                return false;
		            }
		            this.$changes.delete(index);
		            this.$indexes.delete(index);
		            return this.$items.delete(index);
		        };
		        SetSchema.prototype.clear = function (changes) {
		            // discard previous operations.
		            this.$changes.discard(true, true);
		            this.$changes.indexes = {};
		            // clear previous indexes
		            this.$indexes.clear();
		            //
		            // When decoding:
		            // - enqueue items for DELETE callback.
		            // - flag child items for garbage collection.
		            //
		            if (changes) {
		                removeChildRefs.call(this, changes);
		            }
		            // clear items
		            this.$items.clear();
		            this.$changes.operation({ index: 0, op: exports.OPERATION.CLEAR });
		            // touch all structures until reach root
		            this.$changes.touchParents();
		        };
		        SetSchema.prototype.has = function (value) {
		            var values = this.$items.values();
		            var has = false;
		            var entry;
		            while (entry = values.next()) {
		                if (entry.done) {
		                    break;
		                }
		                if (value === entry.value) {
		                    has = true;
		                    break;
		                }
		            }
		            return has;
		        };
		        SetSchema.prototype.forEach = function (callbackfn) {
		            var _this = this;
		            this.$items.forEach(function (value, key, _) { return callbackfn(value, key, _this); });
		        };
		        SetSchema.prototype.values = function () {
		            return this.$items.values();
		        };
		        Object.defineProperty(SetSchema.prototype, "size", {
		            get: function () {
		                return this.$items.size;
		            },
		            enumerable: false,
		            configurable: true
		        });
		        SetSchema.prototype.setIndex = function (index, key) {
		            this.$indexes.set(index, key);
		        };
		        SetSchema.prototype.getIndex = function (index) {
		            return this.$indexes.get(index);
		        };
		        SetSchema.prototype.getByIndex = function (index) {
		            return this.$items.get(this.$indexes.get(index));
		        };
		        SetSchema.prototype.deleteByIndex = function (index) {
		            var key = this.$indexes.get(index);
		            this.$items.delete(key);
		            this.$indexes.delete(index);
		        };
		        SetSchema.prototype.toArray = function () {
		            return Array.from(this.$items.values());
		        };
		        SetSchema.prototype.toJSON = function () {
		            var values = [];
		            this.forEach(function (value, key) {
		                values.push((typeof (value['toJSON']) === "function")
		                    ? value['toJSON']()
		                    : value);
		            });
		            return values;
		        };
		        //
		        // Decoding utilities
		        //
		        SetSchema.prototype.clone = function (isDecoding) {
		            var cloned;
		            if (isDecoding) {
		                // client-side
		                cloned = Object.assign(new SetSchema(), this);
		            }
		            else {
		                // server-side
		                cloned = new SetSchema();
		                this.forEach(function (value) {
		                    if (value['$changes']) {
		                        cloned.add(value['clone']());
		                    }
		                    else {
		                        cloned.add(value);
		                    }
		                });
		            }
		            return cloned;
		        };
		        return SetSchema;
		    }());

		    var ClientState = /** @class */ (function () {
		        function ClientState() {
		            this.refIds = new WeakSet();
		            this.containerIndexes = new WeakMap();
		        }
		        // containerIndexes = new Map<ChangeTree, Set<number>>();
		        ClientState.prototype.addRefId = function (changeTree) {
		            if (!this.refIds.has(changeTree)) {
		                this.refIds.add(changeTree);
		                this.containerIndexes.set(changeTree, new Set());
		            }
		        };
		        ClientState.get = function (client) {
		            if (client.$filterState === undefined) {
		                client.$filterState = new ClientState();
		            }
		            return client.$filterState;
		        };
		        return ClientState;
		    }());

		    var ReferenceTracker = /** @class */ (function () {
		        function ReferenceTracker() {
		            //
		            // Relation of refId => Schema structure
		            // For direct access of structures during decoding time.
		            //
		            this.refs = new Map();
		            this.refCounts = {};
		            this.deletedRefs = new Set();
		            this.nextUniqueId = 0;
		        }
		        ReferenceTracker.prototype.getNextUniqueId = function () {
		            return this.nextUniqueId++;
		        };
		        // for decoding
		        ReferenceTracker.prototype.addRef = function (refId, ref, incrementCount) {
		            if (incrementCount === void 0) { incrementCount = true; }
		            this.refs.set(refId, ref);
		            if (incrementCount) {
		                this.refCounts[refId] = (this.refCounts[refId] || 0) + 1;
		            }
		        };
		        // for decoding
		        ReferenceTracker.prototype.removeRef = function (refId) {
		            var refCount = this.refCounts[refId];
		            if (refCount === undefined) {
		                console.warn("trying to remove reference ".concat(refId, " that doesn't exist"));
		                return;
		            }
		            if (refCount === 0) {
		                console.warn("trying to remove reference ".concat(refId, " with 0 refCount"));
		                return;
		            }
		            this.refCounts[refId] = refCount - 1;
		            this.deletedRefs.add(refId);
		        };
		        ReferenceTracker.prototype.clearRefs = function () {
		            this.refs.clear();
		            this.deletedRefs.clear();
		            this.refCounts = {};
		        };
		        // for decoding
		        ReferenceTracker.prototype.garbageCollectDeletedRefs = function () {
		            var _this = this;
		            this.deletedRefs.forEach(function (refId) {
		                //
		                // Skip active references.
		                //
		                if (_this.refCounts[refId] > 0) {
		                    return;
		                }
		                var ref = _this.refs.get(refId);
		                //
		                // Ensure child schema instances have their references removed as well.
		                //
		                if (ref instanceof Schema) {
		                    for (var fieldName in ref['_definition'].schema) {
		                        if (typeof (ref['_definition'].schema[fieldName]) !== "string" &&
		                            ref[fieldName] &&
		                            ref[fieldName]['$changes']) {
		                            _this.removeRef(ref[fieldName]['$changes'].refId);
		                        }
		                    }
		                }
		                else {
		                    var definition = ref['$changes'].parent._definition;
		                    var type = definition.schema[definition.fieldsByIndex[ref['$changes'].parentIndex]];
		                    if (typeof (Object.values(type)[0]) === "function") {
		                        Array.from(ref.values())
		                            .forEach(function (child) { return _this.removeRef(child['$changes'].refId); });
		                    }
		                }
		                _this.refs.delete(refId);
		                delete _this.refCounts[refId];
		            });
		            // clear deleted refs.
		            this.deletedRefs.clear();
		        };
		        return ReferenceTracker;
		    }());

		    var EncodeSchemaError = /** @class */ (function (_super) {
		        __extends(EncodeSchemaError, _super);
		        function EncodeSchemaError() {
		            return _super !== null && _super.apply(this, arguments) || this;
		        }
		        return EncodeSchemaError;
		    }(Error));
		    function assertType(value, type, klass, field) {
		        var typeofTarget;
		        var allowNull = false;
		        switch (type) {
		            case "number":
		            case "int8":
		            case "uint8":
		            case "int16":
		            case "uint16":
		            case "int32":
		            case "uint32":
		            case "int64":
		            case "uint64":
		            case "float32":
		            case "float64":
		                typeofTarget = "number";
		                if (isNaN(value)) {
		                    console.log("trying to encode \"NaN\" in ".concat(klass.constructor.name, "#").concat(field));
		                }
		                break;
		            case "string":
		                typeofTarget = "string";
		                allowNull = true;
		                break;
		            case "boolean":
		                // boolean is always encoded as true/false based on truthiness
		                return;
		        }
		        if (typeof (value) !== typeofTarget && (!allowNull || (allowNull && value !== null))) {
		            var foundValue = "'".concat(JSON.stringify(value), "'").concat((value && value.constructor && " (".concat(value.constructor.name, ")")) || '');
		            throw new EncodeSchemaError("a '".concat(typeofTarget, "' was expected, but ").concat(foundValue, " was provided in ").concat(klass.constructor.name, "#").concat(field));
		        }
		    }
		    function assertInstanceType(value, type, klass, field) {
		        if (!(value instanceof type)) {
		            throw new EncodeSchemaError("a '".concat(type.name, "' was expected, but '").concat(value.constructor.name, "' was provided in ").concat(klass.constructor.name, "#").concat(field));
		        }
		    }
		    function encodePrimitiveType(type, bytes, value, klass, field) {
		        assertType(value, type, klass, field);
		        var encodeFunc = encode[type];
		        if (encodeFunc) {
		            encodeFunc(bytes, value);
		        }
		        else {
		            throw new EncodeSchemaError("a '".concat(type, "' was expected, but ").concat(value, " was provided in ").concat(klass.constructor.name, "#").concat(field));
		        }
		    }
		    function decodePrimitiveType(type, bytes, it) {
		        return decode[type](bytes, it);
		    }
		    /**
		     * Schema encoder / decoder
		     */
		    var Schema = /** @class */ (function () {
		        // allow inherited classes to have a constructor
		        function Schema() {
		            var args = [];
		            for (var _i = 0; _i < arguments.length; _i++) {
		                args[_i] = arguments[_i];
		            }
		            // fix enumerability of fields for end-user
		            Object.defineProperties(this, {
		                $changes: {
		                    value: new ChangeTree(this, undefined, new ReferenceTracker()),
		                    enumerable: false,
		                    writable: true
		                },
		                // $listeners: {
		                //     value: undefined,
		                //     enumerable: false,
		                //     writable: true
		                // },
		                $callbacks: {
		                    value: undefined,
		                    enumerable: false,
		                    writable: true
		                },
		            });
		            var descriptors = this._definition.descriptors;
		            if (descriptors) {
		                Object.defineProperties(this, descriptors);
		            }
		            //
		            // Assign initial values
		            //
		            if (args[0]) {
		                this.assign(args[0]);
		            }
		        }
		        Schema.onError = function (e) {
		            console.error(e);
		        };
		        Schema.is = function (type) {
		            return (type['_definition'] &&
		                type['_definition'].schema !== undefined);
		        };
		        Schema.prototype.onChange = function (callback) {
		            return addCallback((this.$callbacks || (this.$callbacks = {})), exports.OPERATION.REPLACE, callback);
		        };
		        Schema.prototype.onRemove = function (callback) {
		            return addCallback((this.$callbacks || (this.$callbacks = {})), exports.OPERATION.DELETE, callback);
		        };
		        Schema.prototype.assign = function (props) {
		            Object.assign(this, props);
		            return this;
		        };
		        Object.defineProperty(Schema.prototype, "_definition", {
		            get: function () { return this.constructor._definition; },
		            enumerable: false,
		            configurable: true
		        });
		        /**
		         * (Server-side): Flag a property to be encoded for the next patch.
		         * @param instance Schema instance
		         * @param property string representing the property name, or number representing the index of the property.
		         * @param operation OPERATION to perform (detected automatically)
		         */
		        Schema.prototype.setDirty = function (property, operation) {
		            this.$changes.change(property, operation);
		        };
		        /**
		         * Client-side: listen for changes on property.
		         * @param prop the property name
		         * @param callback callback to be triggered on property change
		         * @param immediate trigger immediatelly if property has been already set.
		         */
		        Schema.prototype.listen = function (prop, callback, immediate) {
		            var _this = this;
		            if (immediate === void 0) { immediate = true; }
		            if (!this.$callbacks) {
		                this.$callbacks = {};
		            }
		            if (!this.$callbacks[prop]) {
		                this.$callbacks[prop] = [];
		            }
		            this.$callbacks[prop].push(callback);
		            if (immediate && this[prop] !== undefined) {
		                callback(this[prop], undefined);
		            }
		            // return un-register callback.
		            return function () { return spliceOne(_this.$callbacks[prop], _this.$callbacks[prop].indexOf(callback)); };
		        };
		        Schema.prototype.decode = function (bytes, it, ref) {
		            if (it === void 0) { it = { offset: 0 }; }
		            if (ref === void 0) { ref = this; }
		            var allChanges = [];
		            var $root = this.$changes.root;
		            var totalBytes = bytes.length;
		            var refId = 0;
		            $root.refs.set(refId, this);
		            while (it.offset < totalBytes) {
		                var byte = bytes[it.offset++];
		                if (byte == SWITCH_TO_STRUCTURE) {
		                    refId = number(bytes, it);
		                    var nextRef = $root.refs.get(refId);
		                    //
		                    // Trying to access a reference that haven't been decoded yet.
		                    //
		                    if (!nextRef) {
		                        throw new Error("\"refId\" not found: ".concat(refId));
		                    }
		                    ref = nextRef;
		                    continue;
		                }
		                var changeTree = ref['$changes'];
		                var isSchema = (ref['_definition'] !== undefined);
		                var operation = (isSchema)
		                    ? (byte >> 6) << 6 // "compressed" index + operation
		                    : byte; // "uncompressed" index + operation (array/map items)
		                if (operation === exports.OPERATION.CLEAR) {
		                    //
		                    // TODO: refactor me!
		                    // The `.clear()` method is calling `$root.removeRef(refId)` for
		                    // each item inside this collection
		                    //
		                    ref.clear(allChanges);
		                    continue;
		                }
		                var fieldIndex = (isSchema)
		                    ? byte % (operation || 255) // if "REPLACE" operation (0), use 255
		                    : number(bytes, it);
		                var fieldName = (isSchema)
		                    ? (ref['_definition'].fieldsByIndex[fieldIndex])
		                    : "";
		                var type = changeTree.getType(fieldIndex);
		                var value = void 0;
		                var previousValue = void 0;
		                var dynamicIndex = void 0;
		                if (!isSchema) {
		                    previousValue = ref['getByIndex'](fieldIndex);
		                    if ((operation & exports.OPERATION.ADD) === exports.OPERATION.ADD) { // ADD or DELETE_AND_ADD
		                        dynamicIndex = (ref instanceof MapSchema)
		                            ? string(bytes, it)
		                            : fieldIndex;
		                        ref['setIndex'](fieldIndex, dynamicIndex);
		                    }
		                    else {
		                        // here
		                        dynamicIndex = ref['getIndex'](fieldIndex);
		                    }
		                }
		                else {
		                    previousValue = ref["_".concat(fieldName)];
		                }
		                //
		                // Delete operations
		                //
		                if ((operation & exports.OPERATION.DELETE) === exports.OPERATION.DELETE) {
		                    if (operation !== exports.OPERATION.DELETE_AND_ADD) {
		                        ref['deleteByIndex'](fieldIndex);
		                    }
		                    // Flag `refId` for garbage collection.
		                    if (previousValue && previousValue['$changes']) {
		                        $root.removeRef(previousValue['$changes'].refId);
		                    }
		                    value = null;
		                }
		                if (fieldName === undefined) {
		                    console.warn("@colyseus/schema: definition mismatch");
		                    //
		                    // keep skipping next bytes until reaches a known structure
		                    // by local decoder.
		                    //
		                    var nextIterator = { offset: it.offset };
		                    while (it.offset < totalBytes) {
		                        if (switchStructureCheck(bytes, it)) {
		                            nextIterator.offset = it.offset + 1;
		                            if ($root.refs.has(number(bytes, nextIterator))) {
		                                break;
		                            }
		                        }
		                        it.offset++;
		                    }
		                    continue;
		                }
		                else if (operation === exports.OPERATION.DELETE) ;
		                else if (Schema.is(type)) {
		                    var refId_1 = number(bytes, it);
		                    value = $root.refs.get(refId_1);
		                    if (operation !== exports.OPERATION.REPLACE) {
		                        var childType = this.getSchemaType(bytes, it, type);
		                        if (!value) {
		                            value = this.createTypeInstance(childType);
		                            value.$changes.refId = refId_1;
		                            if (previousValue) {
		                                value.$callbacks = previousValue.$callbacks;
		                                // value.$listeners = previousValue.$listeners;
		                                if (previousValue['$changes'].refId &&
		                                    refId_1 !== previousValue['$changes'].refId) {
		                                    $root.removeRef(previousValue['$changes'].refId);
		                                }
		                            }
		                        }
		                        $root.addRef(refId_1, value, (value !== previousValue));
		                    }
		                }
		                else if (typeof (type) === "string") {
		                    //
		                    // primitive value (number, string, boolean, etc)
		                    //
		                    value = decodePrimitiveType(type, bytes, it);
		                }
		                else {
		                    var typeDef = getType(Object.keys(type)[0]);
		                    var refId_2 = number(bytes, it);
		                    var valueRef = ($root.refs.has(refId_2))
		                        ? previousValue || $root.refs.get(refId_2)
		                        : new typeDef.constructor();
		                    value = valueRef.clone(true);
		                    value.$changes.refId = refId_2;
		                    // preserve schema callbacks
		                    if (previousValue) {
		                        value['$callbacks'] = previousValue['$callbacks'];
		                        if (previousValue['$changes'].refId &&
		                            refId_2 !== previousValue['$changes'].refId) {
		                            $root.removeRef(previousValue['$changes'].refId);
		                            //
		                            // Trigger onRemove if structure has been replaced.
		                            //
		                            var entries = previousValue.entries();
		                            var iter = void 0;
		                            while ((iter = entries.next()) && !iter.done) {
		                                var _a = iter.value, key = _a[0], value_1 = _a[1];
		                                allChanges.push({
		                                    refId: refId_2,
		                                    op: exports.OPERATION.DELETE,
		                                    field: key,
		                                    value: undefined,
		                                    previousValue: value_1,
		                                });
		                            }
		                        }
		                    }
		                    $root.addRef(refId_2, value, (valueRef !== previousValue));
		                }
		                if (value !== null &&
		                    value !== undefined) {
		                    if (value['$changes']) {
		                        value['$changes'].setParent(changeTree.ref, changeTree.root, fieldIndex);
		                    }
		                    if (ref instanceof Schema) {
		                        ref[fieldName] = value;
		                        // ref[`_${fieldName}`] = value;
		                    }
		                    else if (ref instanceof MapSchema) {
		                        // const key = ref['$indexes'].get(field);
		                        var key = dynamicIndex;
		                        // ref.set(key, value);
		                        ref['$items'].set(key, value);
		                        ref['$changes'].allChanges.add(fieldIndex);
		                    }
		                    else if (ref instanceof ArraySchema) {
		                        // const key = ref['$indexes'][field];
		                        // console.log("SETTING FOR ArraySchema =>", { field, key, value });
		                        // ref[key] = value;
		                        ref.setAt(fieldIndex, value);
		                    }
		                    else if (ref instanceof CollectionSchema) {
		                        var index = ref.add(value);
		                        ref['setIndex'](fieldIndex, index);
		                    }
		                    else if (ref instanceof SetSchema) {
		                        var index = ref.add(value);
		                        if (index !== false) {
		                            ref['setIndex'](fieldIndex, index);
		                        }
		                    }
		                }
		                if (previousValue !== value) {
		                    allChanges.push({
		                        refId: refId,
		                        op: operation,
		                        field: fieldName,
		                        dynamicIndex: dynamicIndex,
		                        value: value,
		                        previousValue: previousValue,
		                    });
		                }
		            }
		            this._triggerChanges(allChanges);
		            // drop references of unused schemas
		            $root.garbageCollectDeletedRefs();
		            return allChanges;
		        };
		        Schema.prototype.encode = function (encodeAll, bytes, useFilters) {
		            if (encodeAll === void 0) { encodeAll = false; }
		            if (bytes === void 0) { bytes = []; }
		            if (useFilters === void 0) { useFilters = false; }
		            var rootChangeTree = this.$changes;
		            var refIdsVisited = new WeakSet();
		            var changeTrees = [rootChangeTree];
		            var numChangeTrees = 1;
		            for (var i = 0; i < numChangeTrees; i++) {
		                var changeTree = changeTrees[i];
		                var ref = changeTree.ref;
		                var isSchema = (ref instanceof Schema);
		                // Generate unique refId for the ChangeTree.
		                changeTree.ensureRefId();
		                // mark this ChangeTree as visited.
		                refIdsVisited.add(changeTree);
		                // root `refId` is skipped.
		                if (changeTree !== rootChangeTree &&
		                    (changeTree.changed || encodeAll)) {
		                    uint8$1(bytes, SWITCH_TO_STRUCTURE);
		                    number$1(bytes, changeTree.refId);
		                }
		                var changes = (encodeAll)
		                    ? Array.from(changeTree.allChanges)
		                    : Array.from(changeTree.changes.values());
		                for (var j = 0, cl = changes.length; j < cl; j++) {
		                    var operation = (encodeAll)
		                        ? { op: exports.OPERATION.ADD, index: changes[j] }
		                        : changes[j];
		                    var fieldIndex = operation.index;
		                    var field = (isSchema)
		                        ? ref['_definition'].fieldsByIndex && ref['_definition'].fieldsByIndex[fieldIndex]
		                        : fieldIndex;
		                    // cache begin index if `useFilters`
		                    var beginIndex = bytes.length;
		                    // encode field index + operation
		                    if (operation.op !== exports.OPERATION.TOUCH) {
		                        if (isSchema) {
		                            //
		                            // Compress `fieldIndex` + `operation` into a single byte.
		                            // This adds a limitaion of 64 fields per Schema structure
		                            //
		                            uint8$1(bytes, (fieldIndex | operation.op));
		                        }
		                        else {
		                            uint8$1(bytes, operation.op);
		                            // custom operations
		                            if (operation.op === exports.OPERATION.CLEAR) {
		                                continue;
		                            }
		                            // indexed operations
		                            number$1(bytes, fieldIndex);
		                        }
		                    }
		                    //
		                    // encode "alias" for dynamic fields (maps)
		                    //
		                    if (!isSchema &&
		                        (operation.op & exports.OPERATION.ADD) == exports.OPERATION.ADD // ADD or DELETE_AND_ADD
		                    ) {
		                        if (ref instanceof MapSchema) {
		                            //
		                            // MapSchema dynamic key
		                            //
		                            var dynamicIndex = changeTree.ref['$indexes'].get(fieldIndex);
		                            string$1(bytes, dynamicIndex);
		                        }
		                    }
		                    if (operation.op === exports.OPERATION.DELETE) {
		                        //
		                        // TODO: delete from filter cache data.
		                        //
		                        // if (useFilters) {
		                        //     delete changeTree.caches[fieldIndex];
		                        // }
		                        continue;
		                    }
		                    // const type = changeTree.childType || ref._schema[field];
		                    var type = changeTree.getType(fieldIndex);
		                    // const type = changeTree.getType(fieldIndex);
		                    var value = changeTree.getValue(fieldIndex);
		                    // Enqueue ChangeTree to be visited
		                    if (value &&
		                        value['$changes'] &&
		                        !refIdsVisited.has(value['$changes'])) {
		                        changeTrees.push(value['$changes']);
		                        value['$changes'].ensureRefId();
		                        numChangeTrees++;
		                    }
		                    if (operation.op === exports.OPERATION.TOUCH) {
		                        continue;
		                    }
		                    if (Schema.is(type)) {
		                        assertInstanceType(value, type, ref, field);
		                        //
		                        // Encode refId for this instance.
		                        // The actual instance is going to be encoded on next `changeTree` iteration.
		                        //
		                        number$1(bytes, value.$changes.refId);
		                        // Try to encode inherited TYPE_ID if it's an ADD operation.
		                        if ((operation.op & exports.OPERATION.ADD) === exports.OPERATION.ADD) {
		                            this.tryEncodeTypeId(bytes, type, value.constructor);
		                        }
		                    }
		                    else if (typeof (type) === "string") {
		                        //
		                        // Primitive values
		                        //
		                        encodePrimitiveType(type, bytes, value, ref, field);
		                    }
		                    else {
		                        //
		                        // Custom type (MapSchema, ArraySchema, etc)
		                        //
		                        var definition = getType(Object.keys(type)[0]);
		                        //
		                        // ensure a ArraySchema has been provided
		                        //
		                        assertInstanceType(ref["_".concat(field)], definition.constructor, ref, field);
		                        //
		                        // Encode refId for this instance.
		                        // The actual instance is going to be encoded on next `changeTree` iteration.
		                        //
		                        number$1(bytes, value.$changes.refId);
		                    }
		                    if (useFilters) {
		                        // cache begin / end index
		                        changeTree.cache(fieldIndex, bytes.slice(beginIndex));
		                    }
		                }
		                if (!encodeAll && !useFilters) {
		                    changeTree.discard();
		                }
		            }
		            return bytes;
		        };
		        Schema.prototype.encodeAll = function (useFilters) {
		            return this.encode(true, [], useFilters);
		        };
		        Schema.prototype.applyFilters = function (client, encodeAll) {
		            var _a, _b;
		            if (encodeAll === void 0) { encodeAll = false; }
		            var root = this;
		            var refIdsDissallowed = new Set();
		            var $filterState = ClientState.get(client);
		            var changeTrees = [this.$changes];
		            var numChangeTrees = 1;
		            var filteredBytes = [];
		            var _loop_1 = function (i) {
		                var changeTree = changeTrees[i];
		                if (refIdsDissallowed.has(changeTree.refId)) {
		                    return "continue";
		                }
		                var ref = changeTree.ref;
		                var isSchema = ref instanceof Schema;
		                uint8$1(filteredBytes, SWITCH_TO_STRUCTURE);
		                number$1(filteredBytes, changeTree.refId);
		                var clientHasRefId = $filterState.refIds.has(changeTree);
		                var isEncodeAll = (encodeAll || !clientHasRefId);
		                // console.log("REF:", ref.constructor.name);
		                // console.log("Encode all?", isEncodeAll);
		                //
		                // include `changeTree` on list of known refIds by this client.
		                //
		                $filterState.addRefId(changeTree);
		                var containerIndexes = $filterState.containerIndexes.get(changeTree);
		                var changes = (isEncodeAll)
		                    ? Array.from(changeTree.allChanges)
		                    : Array.from(changeTree.changes.values());
		                //
		                // WORKAROUND: tries to re-evaluate previously not included @filter() attributes
		                // - see "DELETE a field of Schema" test case.
		                //
		                if (!encodeAll &&
		                    isSchema &&
		                    ref._definition.indexesWithFilters) {
		                    var indexesWithFilters = ref._definition.indexesWithFilters;
		                    indexesWithFilters.forEach(function (indexWithFilter) {
		                        if (!containerIndexes.has(indexWithFilter) &&
		                            changeTree.allChanges.has(indexWithFilter)) {
		                            if (isEncodeAll) {
		                                changes.push(indexWithFilter);
		                            }
		                            else {
		                                changes.push({ op: exports.OPERATION.ADD, index: indexWithFilter, });
		                            }
		                        }
		                    });
		                }
		                for (var j = 0, cl = changes.length; j < cl; j++) {
		                    var change = (isEncodeAll)
		                        ? { op: exports.OPERATION.ADD, index: changes[j] }
		                        : changes[j];
		                    // custom operations
		                    if (change.op === exports.OPERATION.CLEAR) {
		                        uint8$1(filteredBytes, change.op);
		                        continue;
		                    }
		                    var fieldIndex = change.index;
		                    //
		                    // Deleting fields: encode the operation + field index
		                    //
		                    if (change.op === exports.OPERATION.DELETE) {
		                        //
		                        // DELETE operations also need to go through filtering.
		                        //
		                        // TODO: cache the previous value so we can access the value (primitive or `refId`)
		                        // (check against `$filterState.refIds`)
		                        //
		                        if (isSchema) {
		                            uint8$1(filteredBytes, change.op | fieldIndex);
		                        }
		                        else {
		                            uint8$1(filteredBytes, change.op);
		                            number$1(filteredBytes, fieldIndex);
		                        }
		                        continue;
		                    }
		                    // indexed operation
		                    var value = changeTree.getValue(fieldIndex);
		                    var type = changeTree.getType(fieldIndex);
		                    if (isSchema) {
		                        // Is a Schema!
		                        var filter = (ref._definition.filters &&
		                            ref._definition.filters[fieldIndex]);
		                        if (filter && !filter.call(ref, client, value, root)) {
		                            if (value && value['$changes']) {
		                                refIdsDissallowed.add(value['$changes'].refId);
		                            }
		                            continue;
		                        }
		                    }
		                    else {
		                        // Is a collection! (map, array, etc.)
		                        var parent = changeTree.parent;
		                        var filter = changeTree.getChildrenFilter();
		                        if (filter && !filter.call(parent, client, ref['$indexes'].get(fieldIndex), value, root)) {
		                            if (value && value['$changes']) {
		                                refIdsDissallowed.add(value['$changes'].refId);
		                            }
		                            continue;
		                        }
		                    }
		                    // visit child ChangeTree on further iteration.
		                    if (value['$changes']) {
		                        changeTrees.push(value['$changes']);
		                        numChangeTrees++;
		                    }
		                    //
		                    // Copy cached bytes
		                    //
		                    if (change.op !== exports.OPERATION.TOUCH) {
		                        //
		                        // TODO: refactor me!
		                        //
		                        if (change.op === exports.OPERATION.ADD || isSchema) {
		                            //
		                            // use cached bytes directly if is from Schema type.
		                            //
		                            filteredBytes.push.apply(filteredBytes, (_a = changeTree.caches[fieldIndex]) !== null && _a !== void 0 ? _a : []);
		                            containerIndexes.add(fieldIndex);
		                        }
		                        else {
		                            if (containerIndexes.has(fieldIndex)) {
		                                //
		                                // use cached bytes if already has the field
		                                //
		                                filteredBytes.push.apply(filteredBytes, (_b = changeTree.caches[fieldIndex]) !== null && _b !== void 0 ? _b : []);
		                            }
		                            else {
		                                //
		                                // force ADD operation if field is not known by this client.
		                                //
		                                containerIndexes.add(fieldIndex);
		                                uint8$1(filteredBytes, exports.OPERATION.ADD);
		                                number$1(filteredBytes, fieldIndex);
		                                if (ref instanceof MapSchema) {
		                                    //
		                                    // MapSchema dynamic key
		                                    //
		                                    var dynamicIndex = changeTree.ref['$indexes'].get(fieldIndex);
		                                    string$1(filteredBytes, dynamicIndex);
		                                }
		                                if (value['$changes']) {
		                                    number$1(filteredBytes, value['$changes'].refId);
		                                }
		                                else {
		                                    // "encodePrimitiveType" without type checking.
		                                    // the type checking has been done on the first .encode() call.
		                                    encode[type](filteredBytes, value);
		                                }
		                            }
		                        }
		                    }
		                    else if (value['$changes'] && !isSchema) {
		                        //
		                        // TODO:
		                        // - track ADD/REPLACE/DELETE instances on `$filterState`
		                        // - do NOT always encode dynamicIndex for MapSchema.
		                        //   (If client already has that key, only the first index is necessary.)
		                        //
		                        uint8$1(filteredBytes, exports.OPERATION.ADD);
		                        number$1(filteredBytes, fieldIndex);
		                        if (ref instanceof MapSchema) {
		                            //
		                            // MapSchema dynamic key
		                            //
		                            var dynamicIndex = changeTree.ref['$indexes'].get(fieldIndex);
		                            string$1(filteredBytes, dynamicIndex);
		                        }
		                        number$1(filteredBytes, value['$changes'].refId);
		                    }
		                }
		            };
		            for (var i = 0; i < numChangeTrees; i++) {
		                _loop_1(i);
		            }
		            return filteredBytes;
		        };
		        Schema.prototype.clone = function () {
		            var _a;
		            var cloned = new (this.constructor);
		            var schema = this._definition.schema;
		            for (var field in schema) {
		                if (typeof (this[field]) === "object" &&
		                    typeof ((_a = this[field]) === null || _a === void 0 ? void 0 : _a.clone) === "function") {
		                    // deep clone
		                    cloned[field] = this[field].clone();
		                }
		                else {
		                    // primitive values
		                    cloned[field] = this[field];
		                }
		            }
		            return cloned;
		        };
		        Schema.prototype.toJSON = function () {
		            var schema = this._definition.schema;
		            var deprecated = this._definition.deprecated;
		            var obj = {};
		            for (var field in schema) {
		                if (!deprecated[field] && this[field] !== null && typeof (this[field]) !== "undefined") {
		                    obj[field] = (typeof (this[field]['toJSON']) === "function")
		                        ? this[field]['toJSON']()
		                        : this["_".concat(field)];
		                }
		            }
		            return obj;
		        };
		        Schema.prototype.discardAllChanges = function () {
		            this.$changes.discardAll();
		        };
		        Schema.prototype.getByIndex = function (index) {
		            return this[this._definition.fieldsByIndex[index]];
		        };
		        Schema.prototype.deleteByIndex = function (index) {
		            this[this._definition.fieldsByIndex[index]] = undefined;
		        };
		        Schema.prototype.tryEncodeTypeId = function (bytes, type, targetType) {
		            if (type._typeid !== targetType._typeid) {
		                uint8$1(bytes, TYPE_ID);
		                number$1(bytes, targetType._typeid);
		            }
		        };
		        Schema.prototype.getSchemaType = function (bytes, it, defaultType) {
		            var type;
		            if (bytes[it.offset] === TYPE_ID) {
		                it.offset++;
		                type = this.constructor._context.get(number(bytes, it));
		            }
		            return type || defaultType;
		        };
		        Schema.prototype.createTypeInstance = function (type) {
		            var instance = new type();
		            // assign root on $changes
		            instance.$changes.root = this.$changes.root;
		            return instance;
		        };
		        Schema.prototype._triggerChanges = function (changes) {
		            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
		            var uniqueRefIds = new Set();
		            var $refs = this.$changes.root.refs;
		            var _loop_2 = function (i) {
		                var change = changes[i];
		                var refId = change.refId;
		                var ref = $refs.get(refId);
		                var $callbacks = ref['$callbacks'];
		                //
		                // trigger onRemove on child structure.
		                //
		                if ((change.op & exports.OPERATION.DELETE) === exports.OPERATION.DELETE &&
		                    change.previousValue instanceof Schema) {
		                    (_b = (_a = change.previousValue['$callbacks']) === null || _a === void 0 ? void 0 : _a[exports.OPERATION.DELETE]) === null || _b === void 0 ? void 0 : _b.forEach(function (callback) { return callback(); });
		                }
		                // no callbacks defined, skip this structure!
		                if (!$callbacks) {
		                    return "continue";
		                }
		                if (ref instanceof Schema) {
		                    if (!uniqueRefIds.has(refId)) {
		                        try {
		                            // trigger onChange
		                            (_c = $callbacks === null || $callbacks === void 0 ? void 0 : $callbacks[exports.OPERATION.REPLACE]) === null || _c === void 0 ? void 0 : _c.forEach(function (callback) {
		                                return callback();
		                            });
		                        }
		                        catch (e) {
		                            Schema.onError(e);
		                        }
		                    }
		                    try {
		                        if ($callbacks.hasOwnProperty(change.field)) {
		                            (_d = $callbacks[change.field]) === null || _d === void 0 ? void 0 : _d.forEach(function (callback) {
		                                return callback(change.value, change.previousValue);
		                            });
		                        }
		                    }
		                    catch (e) {
		                        Schema.onError(e);
		                    }
		                }
		                else {
		                    // is a collection of items
		                    if (change.op === exports.OPERATION.ADD && change.previousValue === undefined) {
		                        // triger onAdd
		                        (_e = $callbacks[exports.OPERATION.ADD]) === null || _e === void 0 ? void 0 : _e.forEach(function (callback) { var _a; return callback(change.value, (_a = change.dynamicIndex) !== null && _a !== void 0 ? _a : change.field); });
		                    }
		                    else if (change.op === exports.OPERATION.DELETE) {
		                        //
		                        // FIXME: `previousValue` should always be available.
		                        // ADD + DELETE operations are still encoding DELETE operation.
		                        //
		                        if (change.previousValue !== undefined) {
		                            // triger onRemove
		                            (_f = $callbacks[exports.OPERATION.DELETE]) === null || _f === void 0 ? void 0 : _f.forEach(function (callback) { var _a; return callback(change.previousValue, (_a = change.dynamicIndex) !== null && _a !== void 0 ? _a : change.field); });
		                        }
		                    }
		                    else if (change.op === exports.OPERATION.DELETE_AND_ADD) {
		                        // triger onRemove
		                        if (change.previousValue !== undefined) {
		                            (_g = $callbacks[exports.OPERATION.DELETE]) === null || _g === void 0 ? void 0 : _g.forEach(function (callback) { var _a; return callback(change.previousValue, (_a = change.dynamicIndex) !== null && _a !== void 0 ? _a : change.field); });
		                        }
		                        // triger onAdd
		                        (_h = $callbacks[exports.OPERATION.ADD]) === null || _h === void 0 ? void 0 : _h.forEach(function (callback) { var _a; return callback(change.value, (_a = change.dynamicIndex) !== null && _a !== void 0 ? _a : change.field); });
		                    }
		                    // trigger onChange
		                    if (change.value !== change.previousValue) {
		                        (_j = $callbacks[exports.OPERATION.REPLACE]) === null || _j === void 0 ? void 0 : _j.forEach(function (callback) { var _a; return callback(change.value, (_a = change.dynamicIndex) !== null && _a !== void 0 ? _a : change.field); });
		                    }
		                }
		                uniqueRefIds.add(refId);
		            };
		            for (var i = 0; i < changes.length; i++) {
		                _loop_2(i);
		            }
		        };
		        Schema._definition = SchemaDefinition.create();
		        return Schema;
		    }());

		    function dumpChanges(schema) {
		        var changeTrees = [schema['$changes']];
		        var numChangeTrees = 1;
		        var dump = {};
		        var currentStructure = dump;
		        var _loop_1 = function (i) {
		            var changeTree = changeTrees[i];
		            changeTree.changes.forEach(function (change) {
		                var ref = changeTree.ref;
		                var fieldIndex = change.index;
		                var field = (ref['_definition'])
		                    ? ref['_definition'].fieldsByIndex[fieldIndex]
		                    : ref['$indexes'].get(fieldIndex);
		                currentStructure[field] = changeTree.getValue(fieldIndex);
		            });
		        };
		        for (var i = 0; i < numChangeTrees; i++) {
		            _loop_1(i);
		        }
		        return dump;
		    }

		    var reflectionContext = { context: new Context() };
		    /**
		     * Reflection
		     */
		    var ReflectionField = /** @class */ (function (_super) {
		        __extends(ReflectionField, _super);
		        function ReflectionField() {
		            return _super !== null && _super.apply(this, arguments) || this;
		        }
		        __decorate([
		            type("string", reflectionContext)
		        ], ReflectionField.prototype, "name", void 0);
		        __decorate([
		            type("string", reflectionContext)
		        ], ReflectionField.prototype, "type", void 0);
		        __decorate([
		            type("number", reflectionContext)
		        ], ReflectionField.prototype, "referencedType", void 0);
		        return ReflectionField;
		    }(Schema));
		    var ReflectionType = /** @class */ (function (_super) {
		        __extends(ReflectionType, _super);
		        function ReflectionType() {
		            var _this = _super !== null && _super.apply(this, arguments) || this;
		            _this.fields = new ArraySchema();
		            return _this;
		        }
		        __decorate([
		            type("number", reflectionContext)
		        ], ReflectionType.prototype, "id", void 0);
		        __decorate([
		            type([ReflectionField], reflectionContext)
		        ], ReflectionType.prototype, "fields", void 0);
		        return ReflectionType;
		    }(Schema));
		    var Reflection = /** @class */ (function (_super) {
		        __extends(Reflection, _super);
		        function Reflection() {
		            var _this = _super !== null && _super.apply(this, arguments) || this;
		            _this.types = new ArraySchema();
		            return _this;
		        }
		        Reflection.encode = function (instance) {
		            var _a;
		            var rootSchemaType = instance.constructor;
		            var reflection = new Reflection();
		            reflection.rootType = rootSchemaType._typeid;
		            var buildType = function (currentType, schema) {
		                for (var fieldName in schema) {
		                    var field = new ReflectionField();
		                    field.name = fieldName;
		                    var fieldType = void 0;
		                    if (typeof (schema[fieldName]) === "string") {
		                        fieldType = schema[fieldName];
		                    }
		                    else {
		                        var type_1 = schema[fieldName];
		                        var childTypeSchema = void 0;
		                        //
		                        // TODO: refactor below.
		                        //
		                        if (Schema.is(type_1)) {
		                            fieldType = "ref";
		                            childTypeSchema = schema[fieldName];
		                        }
		                        else {
		                            fieldType = Object.keys(type_1)[0];
		                            if (typeof (type_1[fieldType]) === "string") {
		                                fieldType += ":" + type_1[fieldType]; // array:string
		                            }
		                            else {
		                                childTypeSchema = type_1[fieldType];
		                            }
		                        }
		                        field.referencedType = (childTypeSchema)
		                            ? childTypeSchema._typeid
		                            : -1;
		                    }
		                    field.type = fieldType;
		                    currentType.fields.push(field);
		                }
		                reflection.types.push(currentType);
		            };
		            var types = (_a = rootSchemaType._context) === null || _a === void 0 ? void 0 : _a.types;
		            for (var typeid in types) {
		                var type_2 = new ReflectionType();
		                type_2.id = Number(typeid);
		                buildType(type_2, types[typeid]._definition.schema);
		            }
		            return reflection.encodeAll();
		        };
		        Reflection.decode = function (bytes, it) {
		            var context = new Context();
		            var reflection = new Reflection();
		            reflection.decode(bytes, it);
		            var schemaTypes = reflection.types.reduce(function (types, reflectionType) {
		                var schema = /** @class */ (function (_super) {
		                    __extends(_, _super);
		                    function _() {
		                        return _super !== null && _super.apply(this, arguments) || this;
		                    }
		                    return _;
		                }(Schema));
		                var typeid = reflectionType.id;
		                types[typeid] = schema;
		                context.add(schema, typeid);
		                return types;
		            }, {});
		            reflection.types.forEach(function (reflectionType) {
		                var schemaType = schemaTypes[reflectionType.id];
		                reflectionType.fields.forEach(function (field) {
		                    var _a;
		                    if (field.referencedType !== undefined) {
		                        var fieldType = field.type;
		                        var refType = schemaTypes[field.referencedType];
		                        // map or array of primitive type (-1)
		                        if (!refType) {
		                            var typeInfo = field.type.split(":");
		                            fieldType = typeInfo[0];
		                            refType = typeInfo[1];
		                        }
		                        if (fieldType === "ref") {
		                            type(refType, { context: context })(schemaType.prototype, field.name);
		                        }
		                        else {
		                            type((_a = {}, _a[fieldType] = refType, _a), { context: context })(schemaType.prototype, field.name);
		                        }
		                    }
		                    else {
		                        type(field.type, { context: context })(schemaType.prototype, field.name);
		                    }
		                });
		            });
		            var rootType = schemaTypes[reflection.rootType];
		            var rootInstance = new rootType();
		            /**
		             * auto-initialize referenced types on root type
		             * to allow registering listeners immediatelly on client-side
		             */
		            for (var fieldName in rootType._definition.schema) {
		                var fieldType = rootType._definition.schema[fieldName];
		                if (typeof (fieldType) !== "string") {
		                    rootInstance[fieldName] = (typeof (fieldType) === "function")
		                        ? new fieldType() // is a schema reference
		                        : new (getType(Object.keys(fieldType)[0])).constructor(); // is a "collection"
		                }
		            }
		            return rootInstance;
		        };
		        __decorate([
		            type([ReflectionType], reflectionContext)
		        ], Reflection.prototype, "types", void 0);
		        __decorate([
		            type("number", reflectionContext)
		        ], Reflection.prototype, "rootType", void 0);
		        return Reflection;
		    }(Schema));

		    registerType("map", { constructor: MapSchema });
		    registerType("array", { constructor: ArraySchema });
		    registerType("set", { constructor: SetSchema });
		    registerType("collection", { constructor: CollectionSchema, });

		    exports.ArraySchema = ArraySchema;
		    exports.CollectionSchema = CollectionSchema;
		    exports.Context = Context;
		    exports.MapSchema = MapSchema;
		    exports.Reflection = Reflection;
		    exports.ReflectionField = ReflectionField;
		    exports.ReflectionType = ReflectionType;
		    exports.Schema = Schema;
		    exports.SchemaDefinition = SchemaDefinition;
		    exports.SetSchema = SetSchema;
		    exports.decode = decode;
		    exports.defineTypes = defineTypes;
		    exports.deprecated = deprecated;
		    exports.dumpChanges = dumpChanges;
		    exports.encode = encode;
		    exports.filter = filter;
		    exports.filterChildren = filterChildren;
		    exports.hasFilter = hasFilter;
		    exports.registerType = registerType;
		    exports.type = type;

		    Object.defineProperty(exports, '__esModule', { value: true });

		})); 
	} (umd, umd.exports));

	var umdExports = umd.exports;

	var Protocol = {};

	(function (exports) {
		// Use codes between 0~127 for lesser throughput (1 byte)
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.utf8Length = exports.utf8Read = exports.ErrorCode = exports.Protocol = void 0;
		(function (Protocol) {
		    // Room-related (10~19)
		    Protocol[Protocol["HANDSHAKE"] = 9] = "HANDSHAKE";
		    Protocol[Protocol["JOIN_ROOM"] = 10] = "JOIN_ROOM";
		    Protocol[Protocol["ERROR"] = 11] = "ERROR";
		    Protocol[Protocol["LEAVE_ROOM"] = 12] = "LEAVE_ROOM";
		    Protocol[Protocol["ROOM_DATA"] = 13] = "ROOM_DATA";
		    Protocol[Protocol["ROOM_STATE"] = 14] = "ROOM_STATE";
		    Protocol[Protocol["ROOM_STATE_PATCH"] = 15] = "ROOM_STATE_PATCH";
		    Protocol[Protocol["ROOM_DATA_SCHEMA"] = 16] = "ROOM_DATA_SCHEMA";
		    Protocol[Protocol["ROOM_DATA_BYTES"] = 17] = "ROOM_DATA_BYTES";
		})(exports.Protocol || (exports.Protocol = {}));
		(function (ErrorCode) {
		    ErrorCode[ErrorCode["MATCHMAKE_NO_HANDLER"] = 4210] = "MATCHMAKE_NO_HANDLER";
		    ErrorCode[ErrorCode["MATCHMAKE_INVALID_CRITERIA"] = 4211] = "MATCHMAKE_INVALID_CRITERIA";
		    ErrorCode[ErrorCode["MATCHMAKE_INVALID_ROOM_ID"] = 4212] = "MATCHMAKE_INVALID_ROOM_ID";
		    ErrorCode[ErrorCode["MATCHMAKE_UNHANDLED"] = 4213] = "MATCHMAKE_UNHANDLED";
		    ErrorCode[ErrorCode["MATCHMAKE_EXPIRED"] = 4214] = "MATCHMAKE_EXPIRED";
		    ErrorCode[ErrorCode["AUTH_FAILED"] = 4215] = "AUTH_FAILED";
		    ErrorCode[ErrorCode["APPLICATION_ERROR"] = 4216] = "APPLICATION_ERROR";
		})(exports.ErrorCode || (exports.ErrorCode = {}));
		function utf8Read(view, offset) {
		    const length = view[offset++];
		    var string = '', chr = 0;
		    for (var i = offset, end = offset + length; i < end; i++) {
		        var byte = view[i];
		        if ((byte & 0x80) === 0x00) {
		            string += String.fromCharCode(byte);
		            continue;
		        }
		        if ((byte & 0xe0) === 0xc0) {
		            string += String.fromCharCode(((byte & 0x1f) << 6) |
		                (view[++i] & 0x3f));
		            continue;
		        }
		        if ((byte & 0xf0) === 0xe0) {
		            string += String.fromCharCode(((byte & 0x0f) << 12) |
		                ((view[++i] & 0x3f) << 6) |
		                ((view[++i] & 0x3f) << 0));
		            continue;
		        }
		        if ((byte & 0xf8) === 0xf0) {
		            chr = ((byte & 0x07) << 18) |
		                ((view[++i] & 0x3f) << 12) |
		                ((view[++i] & 0x3f) << 6) |
		                ((view[++i] & 0x3f) << 0);
		            if (chr >= 0x010000) { // surrogate pair
		                chr -= 0x010000;
		                string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
		            }
		            else {
		                string += String.fromCharCode(chr);
		            }
		            continue;
		        }
		        throw new Error('Invalid byte ' + byte.toString(16));
		    }
		    return string;
		}
		exports.utf8Read = utf8Read;
		// Faster for short strings than Buffer.byteLength
		function utf8Length(str = '') {
		    let c = 0;
		    let length = 0;
		    for (let i = 0, l = str.length; i < l; i++) {
		        c = str.charCodeAt(i);
		        if (c < 0x80) {
		            length += 1;
		        }
		        else if (c < 0x800) {
		            length += 2;
		        }
		        else if (c < 0xd800 || c >= 0xe000) {
		            length += 3;
		        }
		        else {
		            i++;
		            length += 4;
		        }
		    }
		    return length + 1;
		}
		exports.utf8Length = utf8Length;
		
	} (Protocol));

	class SchemaSerializer extends EventTarget {
	    state;
	    setState(rawState) {
	        this.state.decode(rawState);
	        this.dispatchEvent(new CustomEvent('patch', { detail: null }));
	        this.dispatchEvent(new Event('load'));
	    }
	    getState() {
	        return this.state;
	    }
	    patch(patches) {
	        let res = this.state.decode(patches);
	        for (let change of res) {
	            if (change.field != 'gameTime') {
	                this.dispatchEvent(new CustomEvent('patch', { detail: res }));
	                break;
	            }
	        }
	    }
	    teardown() {
	        this.state?.['$changes']?.root.clearRefs();
	    }
	    handshake(bytes, it) {
	        if (this.state) {
	            const reflection = new umdExports.Reflection();
	            reflection.decode(bytes, it);
	        }
	        else {
	            // initialize reflected state from server
	            this.state = umdExports.Reflection.decode(bytes, it);
	        }
	        this.dispatchEvent(new CustomEvent('patch', { detail: null }));
	    }
	}
	const serializer = new SchemaSerializer();
	function onMessage(event) {
	    const bytes = Array.from(new Uint8Array(event.data));
	    const code = bytes[0];
	    if (code === colyseusExports.Protocol.JOIN_ROOM) {
	        let offset = 1;
	        const reconnectionToken = Protocol.utf8Read(bytes, offset);
	        offset += Protocol.utf8Length(reconnectionToken);
	        const serializerId = Protocol.utf8Read(bytes, offset);
	        offset += Protocol.utf8Length(serializerId);
	        console.log(reconnectionToken, serializerId, offset);
	        if (bytes.length > offset) {
	            serializer.handshake(bytes, { offset });
	        }
	    }
	    else if (code === colyseusExports.Protocol.ROOM_DATA_SCHEMA) ;
	    else if (code === colyseusExports.Protocol.ROOM_STATE) {
	        bytes.shift(); // drop `code` byte
	        serializer.setState(bytes);
	    }
	    else if (code === colyseusExports.Protocol.ROOM_STATE_PATCH) {
	        bytes.shift(); // drop `code` byte
	        serializer.patch(bytes);
	    }
	    else if (code === colyseusExports.Protocol.ROOM_DATA) {
	        const it = { offset: 1 };
	        const type = (umdExports.decode.stringCheck(bytes, it))
	            ? umdExports.decode.string(bytes, it)
	            : umdExports.decode.number(bytes, it);
	        const message = (bytes.length > it.offset)
	            ? decode_1(event.data, it.offset)
	            : undefined;
	        return { type, message };
	    }
	    else if (code === colyseusExports.Protocol.ROOM_DATA_BYTES) {
	        const it = { offset: 1 };
	        const type = (umdExports.decode.stringCheck(bytes, it))
	            ? umdExports.decode.string(bytes, it)
	            : umdExports.decode.number(bytes, it);
	        return { type, message: new Uint8Array(bytes.slice(it.offset)) };
	    }
	    return null;
	}

	class SocketManager extends EventTarget {
	    socket = null;
	    transportType = writable("unknown");
	    blueboatRoomId = null;
	    setup() {
	        let manager = this;
	        // override the default WebSocket
	        class NewWebSocket extends WebSocket {
	            constructor(url, params) {
	                super(url, params);
	                if (!manager.socket) {
	                    manager.registerSocket(this);
	                }
	            }
	            send(data) {
	                manager.onSend(data);
	                super.send(data);
	            }
	        }
	        // override XMLHttpRequest to get the room id
	        let nativeXMLSend = XMLHttpRequest.prototype.send;
	        XMLHttpRequest.prototype.send = function () {
	            this.addEventListener('load', () => {
	                if (!this.responseURL.endsWith("/matchmaker/join"))
	                    return;
	                let response = JSON.parse(this.responseText);
	                manager.blueboatRoomId = response.roomId;
	                console.log("Got Blueboat Room Id: " + manager.blueboatRoomId);
	            });
	            nativeXMLSend.apply(this, arguments);
	        };
	        getUnsafeWindow().WebSocket = NewWebSocket;
	    }
	    registerSocket(socket) {
	        this.socket = socket;
	        // detect the transport type
	        if ('Phaser' in getUnsafeWindow()) {
	            this.transportType.set("colyseus");
	            this.addEventListener('colyseusMessage', (e) => {
	                if (e.detail.type != "DEVICES_STATES_CHANGES")
	                    return;
	                let changes = parseChangePacket(e.detail.message);
	                this.dispatchEvent(new CustomEvent('deviceChanges', {
	                    detail: changes
	                }));
	            });
	        }
	        else
	            this.transportType.set("blueboat");
	        // when we get a message, decode it and dispatch it
	        socket.addEventListener('message', (e) => {
	            let decoded;
	            if (get_store_value(this.transportType) == 'colyseus') {
	                decoded = onMessage(e);
	                if (!decoded)
	                    return;
	                this.dispatchEvent(new CustomEvent('colyseusMessage', {
	                    detail: decoded
	                }));
	            }
	            else {
	                decoded = blueboat.decode(e.data);
	                if (!decoded)
	                    return;
	                this.dispatchEvent(new CustomEvent('blueboatMessage', {
	                    detail: decoded
	                }));
	            }
	        });
	    }
	    onSend(data) {
	        // if we're already in a room, get the room id from the data
	        if (get_store_value(this.transportType) == "blueboat" && !this.blueboatRoomId) {
	            let decoded = blueboat.decode(data);
	            if (decoded.roomId)
	                this.blueboatRoomId = decoded.roomId;
	            if (decoded.room)
	                this.blueboatRoomId = decoded.room;
	            if (this.blueboatRoomId) {
	                console.log("Got Blueboat Room Id: " + this.blueboatRoomId);
	            }
	        }
	    }
	    sendMessage(channel, data) {
	        if (!this.socket)
	            return;
	        if (!this.blueboatRoomId && get_store_value(this.transportType) == "blueboat")
	            return;
	        let encoded;
	        if (get_store_value(this.transportType) == 'colyseus') {
	            let header = [colyseusExports.Protocol.ROOM_DATA];
	            let channelEncoded = encode_1(channel);
	            let packetEncoded = encode_1(data);
	            // combine the arraybuffers
	            encoded = new Uint8Array(channelEncoded.byteLength + packetEncoded.byteLength + header.length);
	            encoded.set(header);
	            encoded.set(new Uint8Array(channelEncoded), header.length);
	            encoded.set(new Uint8Array(packetEncoded), header.length + channelEncoded.byteLength);
	        }
	        else
	            encoded = blueboat.encode(channel, data, this.blueboatRoomId);
	        this.socket.send(encoded);
	    }
	}
	const socketManager = new SocketManager();

	const showHud = writable(true);
	const storesLoaded = writable(false);
	getUnsafeWindow().storesLoaded = storesLoaded;
	const playerId = writable(null);
	socketManager.addEventListener('colyseusMessage', ((event) => {
	    if (event.detail.type !== 'AUTH_ID')
	        return;
	    playerId.set(event.detail.message);
	    console.log("[GC] Got player id: " + event.detail.message);
	}));
	const devicesLoaded = writable(false);
	socketManager.addEventListener('colyseusMessage', (e) => {
	    if (e.detail.type === 'DEVICES_STATES_CHANGES') {
	        // it takes a sec for the devices to get applied, for some reason?
	        let checkInterval = setInterval(() => {
	            let devices = getUnsafeWindow()?.stores?.phaser?.scene?.worldManager?.devices?.allDevices;
	            if (!devices)
	                return;
	            if (devices.length >= e.detail.message.changes.length) {
	                clearInterval(checkInterval);
	                devicesLoaded.set(true);
	            }
	        }, 100);
	    }
	});

	/* src\hud\Menu.svelte generated by Svelte v4.2.9 */

	const { window: window_1$1 } = globals;

	function add_css$f(target) {
		append_styles(target, "svelte-4jfbq8", ".menu.svelte-4jfbq8{position:absolute;background-color:var(--menuBackgroundColor);resize:both;overflow:hidden;min-width:150px;border-radius:5px;user-select:none;pointer-events:all;outline-width:3px;outline-style:solid;outline-color:var(--menuOutlineColor)}.children.svelte-4jfbq8{position:relative;height:calc(100% - 21px);overflow-x:hidden;overflow-y:auto}.groupContent{position:absolute;top:0;left:0;display:flex;flex-direction:column;width:100%}.groupContent.svelte-4jfbq8{transform:translateX(0);opacity:1;pointer-events:all}.menu.minimized.svelte-4jfbq8{overflow:hidden;resize:horizontal;height:21px !important}.header.svelte-4jfbq8{background-color:var(--menuHeaderBackgroundColor);position:relative;color:var(--menuHeaderTextColor);width:100%;text-align:center;font-size:14px;height:21px}.minimize.svelte-4jfbq8{background-color:transparent;border:none;align-items:center;position:absolute;right:5px;top:0;cursor:pointer}");
	}

	function create_fragment$E(ctx) {
		let div3;
		let div0;
		let t0;
		let t1;
		let button;
		let t2_value = (/*minimized*/ ctx[2] ? "+" : "-") + "";
		let t2;
		let t3;
		let div2;
		let div1;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[11].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[10], null);

		return {
			c() {
				div3 = element("div");
				div0 = element("div");
				t0 = text(/*name*/ ctx[0]);
				t1 = space();
				button = element("button");
				t2 = text(t2_value);
				t3 = space();
				div2 = element("div");
				div1 = element("div");
				if (default_slot) default_slot.c();
				attr(button, "class", "minimize svelte-4jfbq8");
				attr(div0, "class", "header svelte-4jfbq8");
				attr(div1, "class", "groupContent open svelte-4jfbq8");
				attr(div2, "class", "children svelte-4jfbq8");
				attr(div3, "class", "menu svelte-4jfbq8");
				set_style(div3, "left", /*$coordSpring*/ ctx[3].x + "px");
				set_style(div3, "top", /*$coordSpring*/ ctx[3].y + "px");
				toggle_class(div3, "minimized", /*minimized*/ ctx[2]);
			},
			m(target, anchor) {
				insert(target, div3, anchor);
				append(div3, div0);
				append(div0, t0);
				append(div0, t1);
				append(div0, button);
				append(button, t2);
				append(div3, t3);
				append(div3, div2);
				append(div2, div1);

				if (default_slot) {
					default_slot.m(div1, null);
				}

				/*div3_binding*/ ctx[12](div3);
				current = true;

				if (!mounted) {
					dispose = [
						listen(window_1$1, "mouseup", /*stopDrag*/ ctx[8]),
						listen(window_1$1, "mousemove", /*drag*/ ctx[7]),
						listen(window_1$1, "resize", /*onResize*/ ctx[5]),
						listen(button, "click", /*toggleMinimized*/ ctx[9]),
						listen(div3, "mousedown", /*startDrag*/ ctx[6])
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (!current || dirty[0] & /*name*/ 1) set_data(t0, /*name*/ ctx[0]);
				if ((!current || dirty[0] & /*minimized*/ 4) && t2_value !== (t2_value = (/*minimized*/ ctx[2] ? "+" : "-") + "")) set_data(t2, t2_value);

				if (default_slot) {
					if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 1024)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[10],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[10])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[10], dirty, null),
							null
						);
					}
				}

				if (!current || dirty[0] & /*$coordSpring*/ 8) {
					set_style(div3, "left", /*$coordSpring*/ ctx[3].x + "px");
				}

				if (!current || dirty[0] & /*$coordSpring*/ 8) {
					set_style(div3, "top", /*$coordSpring*/ ctx[3].y + "px");
				}

				if (!current || dirty[0] & /*minimized*/ 4) {
					toggle_class(div3, "minimized", /*minimized*/ ctx[2]);
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div3);
				}

				if (default_slot) default_slot.d(detaching);
				/*div3_binding*/ ctx[12](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$x($$self, $$props, $$invalidate) {
		let $coordSpring;
		let { $$slots: slots = {}, $$scope } = $$props;
		let { name } = $$props;

		// This whole file is a mess, but it's a mess that works*
		let transform = getMenuTransform(name);

		let x = transform?.x ?? 50;
		let y = transform?.y ?? 50;
		let width = transform?.width ?? 200;
		let height = transform?.height ?? 200;
		let lastWidth = width;
		let lastHeight = height;
		let coordSpring = spring(moveInbounds(x, y), { stiffness: 0.1, damping: 0.5 });
		component_subscribe($$self, coordSpring, value => $$invalidate(3, $coordSpring = value));
		let coords = get_store_value(coordSpring);
		let returnX = coords.x;
		let returnY = coords.y;

		function onResize() {
			let coords = get_store_value(coordSpring);
			coordSpring.set(moveInbounds(coords.x, coords.y));
		}

		function moveInbounds(x, y) {
			if (x < 0) x = 0;
			if (y < 0) y = 0;
			if (x + lastWidth > window.innerWidth) x = window.innerWidth - lastWidth;
			if (y + lastHeight > window.innerHeight) y = window.innerHeight - lastHeight;
			return { x, y };
		}

		let transitioning = false;

		// move out of the way when the hud is hidden
		showHud.subscribe(v => {
			if (v) {
				coordSpring.set(moveInbounds(returnX, returnY));
				transitioning = false;
			} else {
				transitioning = true;
				let coords = get_store_value(coordSpring);

				// move over the nearest edge
				let cX = coords.x + lastWidth / 2;

				let cY = coords.y + lastHeight / 2;

				let endX = cX < window.innerWidth / 2
				? -lastWidth
				: window.innerWidth;

				let endY = cY < window.innerHeight / 2
				? -lastHeight
				: window.innerHeight;

				if (Math.abs(endX - coords.x) < Math.abs(endY - coords.y)) {
					coordSpring.set({ x: endX, y: coords.y });
				} else {
					coordSpring.set({ x: coords.x, y: endY });
				}
			}
		});

		let element;
		let minimized = transform?.minimized ?? false;
		let dragState = 'waiting';
		let startX, startY;
		let dragDistance;

		function startDrag(event) {
			dragState = 'checking';
			const coords = get_store_value(coordSpring);
			startX = event.clientX - coords.x;
			startY = event.clientY - coords.y;
			dragDistance = 0;
		}

		function saveTransform() {
			if (transitioning) return;
			let coords = get_store_value(coordSpring);

			setMenuTransform(name, {
				x: coords.x,
				y: coords.y,
				width: lastWidth,
				height: lastHeight,
				minimized
			});
		}

		const saveTransformDebounce = debounce$1(saveTransform, 100);
		coordSpring.subscribe(() => saveTransformDebounce());

		function drag(event) {
			if (dragState == 'waiting') return;
			dragDistance += Math.abs(event.movementX) + Math.abs(event.movementY);

			if (dragState == 'checking' && dragDistance > 5) {
				dragState = 'dragging';
				return;
			}

			if (dragState == 'dragging') {
				let newX = event.clientX - startX;
				let newY = event.clientY - startY;
				returnX = newX;
				returnY = newY;
				coordSpring.set(moveInbounds(newX, newY));
				saveTransformDebounce();
			}
		}

		function stopDrag() {
			dragState = 'waiting';
		}

		let observer = new ResizeObserver(entries => {
				dragState = 'waiting';
				let entry = entries[0];

				if (!minimized) {
					lastHeight = entry.contentRect.height;
				}

				lastWidth = entry.contentRect.width;
				saveTransformDebounce();
			});

		onMount(() => {
			observer.observe(element);
			$$invalidate(1, element.style.height = `${Math.max(height, 21)}px`, element);
			$$invalidate(1, element.style.width = `${Math.max(width, 150)}px`, element);
		});

		onDestroy(() => {
			observer.disconnect();
		});

		function toggleMinimized() {
			$$invalidate(2, minimized = !minimized);
			saveTransformDebounce();
		}

		function div3_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(1, element);
			});
		}

		$$self.$$set = $$props => {
			if ('name' in $$props) $$invalidate(0, name = $$props.name);
			if ('$$scope' in $$props) $$invalidate(10, $$scope = $$props.$$scope);
		};

		return [
			name,
			element,
			minimized,
			$coordSpring,
			coordSpring,
			onResize,
			startDrag,
			drag,
			stopDrag,
			toggleMinimized,
			$$scope,
			slots,
			div3_binding
		];
	}

	class Menu extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$x, create_fragment$E, safe_not_equal, { name: 0 }, add_css$f, [-1, -1]);
		}
	}

	/* node_modules\svelte-material-icons\KeyboardOutline.svelte generated by Svelte v4.2.9 */

	function create_if_block_1$5(ctx) {
		let desc_1;
		let t;

		return {
			c() {
				desc_1 = svg_element("desc");
				t = text(/*desc*/ ctx[7]);
			},
			m(target, anchor) {
				insert(target, desc_1, anchor);
				append(desc_1, t);
			},
			p(ctx, dirty) {
				if (dirty & /*desc*/ 128) set_data(t, /*desc*/ ctx[7]);
			},
			d(detaching) {
				if (detaching) {
					detach(desc_1);
				}
			}
		};
	}

	// (16:165) {#if title}
	function create_if_block$b(ctx) {
		let title_1;
		let t;

		return {
			c() {
				title_1 = svg_element("title");
				t = text(/*title*/ ctx[6]);
			},
			m(target, anchor) {
				insert(target, title_1, anchor);
				append(title_1, t);
			},
			p(ctx, dirty) {
				if (dirty & /*title*/ 64) set_data(t, /*title*/ ctx[6]);
			},
			d(detaching) {
				if (detaching) {
					detach(title_1);
				}
			}
		};
	}

	function create_fragment$D(ctx) {
		let svg;
		let if_block0_anchor;
		let path;
		let if_block0 = /*desc*/ ctx[7] && create_if_block_1$5(ctx);
		let if_block1 = /*title*/ ctx[6] && create_if_block$b(ctx);

		return {
			c() {
				svg = svg_element("svg");
				if (if_block0) if_block0.c();
				if_block0_anchor = empty();
				if (if_block1) if_block1.c();
				path = svg_element("path");
				attr(path, "d", "M4,5A2,2 0 0,0 2,7V17A2,2 0 0,0 4,19H20A2,2 0 0,0 22,17V7A2,2 0 0,0 20,5H4M4,7H20V17H4V7M5,8V10H7V8H5M8,8V10H10V8H8M11,8V10H13V8H11M14,8V10H16V8H14M17,8V10H19V8H17M5,11V13H7V11H5M8,11V13H10V11H8M11,11V13H13V11H11M14,11V13H16V11H14M17,11V13H19V11H17M8,14V16H16V14H8Z");
				attr(path, "fill", /*color*/ ctx[2]);
				attr(svg, "viewBox", /*viewBox*/ ctx[3]);
				attr(svg, "width", /*width*/ ctx[0]);
				attr(svg, "height", /*height*/ ctx[1]);
				attr(svg, "class", /*className*/ ctx[8]);
				attr(svg, "aria-label", /*ariaLabel*/ ctx[4]);
				attr(svg, "aria-hidden", /*ariaHidden*/ ctx[5]);
			},
			m(target, anchor) {
				insert(target, svg, anchor);
				if (if_block0) if_block0.m(svg, null);
				append(svg, if_block0_anchor);
				if (if_block1) if_block1.m(svg, null);
				append(svg, path);
			},
			p(ctx, [dirty]) {
				if (/*desc*/ ctx[7]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
					} else {
						if_block0 = create_if_block_1$5(ctx);
						if_block0.c();
						if_block0.m(svg, if_block0_anchor);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (/*title*/ ctx[6]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);
					} else {
						if_block1 = create_if_block$b(ctx);
						if_block1.c();
						if_block1.m(svg, path);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}

				if (dirty & /*color*/ 4) {
					attr(path, "fill", /*color*/ ctx[2]);
				}

				if (dirty & /*viewBox*/ 8) {
					attr(svg, "viewBox", /*viewBox*/ ctx[3]);
				}

				if (dirty & /*width*/ 1) {
					attr(svg, "width", /*width*/ ctx[0]);
				}

				if (dirty & /*height*/ 2) {
					attr(svg, "height", /*height*/ ctx[1]);
				}

				if (dirty & /*className*/ 256) {
					attr(svg, "class", /*className*/ ctx[8]);
				}

				if (dirty & /*ariaLabel*/ 16) {
					attr(svg, "aria-label", /*ariaLabel*/ ctx[4]);
				}

				if (dirty & /*ariaHidden*/ 32) {
					attr(svg, "aria-hidden", /*ariaHidden*/ ctx[5]);
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(svg);
				}

				if (if_block0) if_block0.d();
				if (if_block1) if_block1.d();
			}
		};
	}

	function instance$w($$self, $$props, $$invalidate) {
		let { size = "1em" } = $$props;
		let { width = size } = $$props;
		let { height = size } = $$props;
		let { color = "currentColor" } = $$props;
		let { viewBox = "0 0 24 24" } = $$props;
		let { ariaLabel = void 0 } = $$props;
		let { ariaHidden = void 0 } = $$props;
		let { title = void 0 } = $$props;
		let { desc = void 0 } = $$props;
		let { class: className = void 0 } = $$props;

		$$self.$$set = $$props => {
			if ('size' in $$props) $$invalidate(9, size = $$props.size);
			if ('width' in $$props) $$invalidate(0, width = $$props.width);
			if ('height' in $$props) $$invalidate(1, height = $$props.height);
			if ('color' in $$props) $$invalidate(2, color = $$props.color);
			if ('viewBox' in $$props) $$invalidate(3, viewBox = $$props.viewBox);
			if ('ariaLabel' in $$props) $$invalidate(4, ariaLabel = $$props.ariaLabel);
			if ('ariaHidden' in $$props) $$invalidate(5, ariaHidden = $$props.ariaHidden);
			if ('title' in $$props) $$invalidate(6, title = $$props.title);
			if ('desc' in $$props) $$invalidate(7, desc = $$props.desc);
			if ('class' in $$props) $$invalidate(8, className = $$props.class);
		};

		return [
			width,
			height,
			color,
			viewBox,
			ariaLabel,
			ariaHidden,
			title,
			desc,
			className,
			size
		];
	}

	class KeyboardOutline extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$w, create_fragment$D, safe_not_equal, {
				size: 9,
				width: 0,
				height: 1,
				color: 2,
				viewBox: 3,
				ariaLabel: 4,
				ariaHidden: 5,
				title: 6,
				desc: 7,
				class: 8
			});
		}
	}

	class KeybindManager {
	    keysPressed = new Set();
	    keybinds = new Map();
	    constructor() {
	        window.addEventListener('keydown', (e) => {
	            this.keysPressed.add(e.key.toLowerCase());
	            // check if any keybinds are pressed
	            checkKeybinds: for (const [keys, callback] of this.keybinds) {
	                if (keys.size == 0)
	                    continue;
	                for (const key of keys) {
	                    if (!this.keysPressed.has(key)) {
	                        continue checkKeybinds;
	                    }
	                }
	                callback();
	            }
	        });
	        window.addEventListener('keyup', (e) => {
	            this.keysPressed.delete(e.key.toLowerCase());
	        });
	    }
	    addKeybind(keys, callback) {
	        this.keybinds.set(keys, callback);
	    }
	    removeKeybind(keys) {
	        this.keybinds.delete(keys);
	    }
	}
	const keybindManager = new KeybindManager();

	/* src\hud\KeybindCreator.svelte generated by Svelte v4.2.9 */

	function add_css$e(target) {
		append_styles(target, "svelte-1j00okq", "dialog.svelte-1j00okq{width:400px;height:300px;border-radius:15px;background-color:white;border:3px solid black;display:flex;flex-direction:column}h2.svelte-1j00okq{width:100%;text-align:center}button[disabled].svelte-1j00okq{opacity:0.5;cursor:not-allowed}.recordBtn.svelte-1j00okq{width:100%;height:50px;border:none;background-color:#f0f0f0;cursor:pointer;border-radius:10px}.hotkeyDisplay.svelte-1j00okq{width:100%;text-align:center;height:80px;overflow-y:auto;margin-top:20px}.completeContainer.svelte-1j00okq{display:flex;justify-content:space-between;margin-top:20px}.confirm.svelte-1j00okq,.cancel.svelte-1j00okq{width:40%;border:none;border-radius:3px}.confirm.svelte-1j00okq{background-color:lightgreen}.cancel.svelte-1j00okq{background-color:lightcoral}");
	}

	// (49:8) {:else}
	function create_else_block_2(ctx) {
		let t;

		return {
			c() {
				t = text("Re-record");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (47:39) 
	function create_if_block_3(ctx) {
		let t;

		return {
			c() {
				t = text("Start recording");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (45:8) {#if recording}
	function create_if_block_2(ctx) {
		let t;

		return {
			c() {
				t = text("Stop recording");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (60:8) {:else}
	function create_else_block_1$1(ctx) {
		let t_value = Array.from(/*keysDeref*/ ctx[0]).map(func).join(' + ') + "";
		let t;

		return {
			c() {
				t = text(t_value);
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*keysDeref*/ 1 && t_value !== (t_value = Array.from(/*keysDeref*/ ctx[0]).map(func).join(' + ') + "")) set_data(t, t_value);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (54:8) {#if keysDeref.size === 0}
	function create_if_block$a(ctx) {
		let if_block_anchor;

		function select_block_type_2(ctx, dirty) {
			if (/*recording*/ ctx[1]) return create_if_block_1$4;
			return create_else_block$3;
		}

		let current_block_type = select_block_type_2(ctx);
		let if_block = current_block_type(ctx);

		return {
			c() {
				if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
			},
			p(ctx, dirty) {
				if (current_block_type !== (current_block_type = select_block_type_2(ctx))) {
					if_block.d(1);
					if_block = current_block_type(ctx);

					if (if_block) {
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				}
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if_block.d(detaching);
			}
		};
	}

	// (57:12) {:else}
	function create_else_block$3(ctx) {
		let t;

		return {
			c() {
				t = text("No hotkey set");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (55:12) {#if recording}
	function create_if_block_1$4(ctx) {
		let t;

		return {
			c() {
				t = text("Press any keys");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	function create_fragment$C(ctx) {
		let dialog_1;
		let h2;
		let t1;
		let button0;
		let t2;
		let div0;
		let t3;
		let div1;
		let button1;
		let t4;
		let button1_disabled_value;
		let t5;
		let button2;
		let mounted;
		let dispose;

		function select_block_type(ctx, dirty) {
			if (/*recording*/ ctx[1]) return create_if_block_2;
			if (/*keysDeref*/ ctx[0].size === 0) return create_if_block_3;
			return create_else_block_2;
		}

		let current_block_type = select_block_type(ctx);
		let if_block0 = current_block_type(ctx);

		function select_block_type_1(ctx, dirty) {
			if (/*keysDeref*/ ctx[0].size === 0) return create_if_block$a;
			return create_else_block_1$1;
		}

		let current_block_type_1 = select_block_type_1(ctx);
		let if_block1 = current_block_type_1(ctx);

		return {
			c() {
				dialog_1 = element("dialog");
				h2 = element("h2");
				h2.textContent = "Create Hotkey";
				t1 = space();
				button0 = element("button");
				if_block0.c();
				t2 = space();
				div0 = element("div");
				if_block1.c();
				t3 = space();
				div1 = element("div");
				button1 = element("button");
				t4 = text("Confirm");
				t5 = space();
				button2 = element("button");
				button2.textContent = "No hotkey";
				attr(h2, "class", "svelte-1j00okq");
				attr(button0, "class", "recordBtn svelte-1j00okq");
				attr(div0, "class", "hotkeyDisplay svelte-1j00okq");
				button1.disabled = button1_disabled_value = /*keysDeref*/ ctx[0].size === 0;
				attr(button1, "class", "confirm svelte-1j00okq");
				attr(button2, "class", "cancel svelte-1j00okq");
				attr(div1, "class", "completeContainer svelte-1j00okq");
				attr(dialog_1, "class", "svelte-1j00okq");
			},
			m(target, anchor) {
				insert(target, dialog_1, anchor);
				append(dialog_1, h2);
				append(dialog_1, t1);
				append(dialog_1, button0);
				if_block0.m(button0, null);
				append(dialog_1, t2);
				append(dialog_1, div0);
				if_block1.m(div0, null);
				append(dialog_1, t3);
				append(dialog_1, div1);
				append(div1, button1);
				append(button1, t4);
				append(div1, t5);
				append(div1, button2);
				/*dialog_1_binding*/ ctx[10](dialog_1);

				if (!mounted) {
					dispose = [
						listen(window, "keydown", /*onKeydown*/ ctx[3]),
						listen(button0, "click", /*toggleRecording*/ ctx[4]),
						listen(button0, "keydown", prevent_default(/*keydown_handler*/ ctx[9])),
						listen(button1, "click", /*confirm*/ ctx[5]),
						listen(button2, "click", /*cancel*/ ctx[6]),
						listen(dialog_1, "mousedown", stop_propagation(/*mousedown_handler*/ ctx[8]))
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (current_block_type !== (current_block_type = select_block_type(ctx))) {
					if_block0.d(1);
					if_block0 = current_block_type(ctx);

					if (if_block0) {
						if_block0.c();
						if_block0.m(button0, null);
					}
				}

				if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1.d(1);
					if_block1 = current_block_type_1(ctx);

					if (if_block1) {
						if_block1.c();
						if_block1.m(div0, null);
					}
				}

				if (dirty & /*keysDeref*/ 1 && button1_disabled_value !== (button1_disabled_value = /*keysDeref*/ ctx[0].size === 0)) {
					button1.disabled = button1_disabled_value;
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(dialog_1);
				}

				if_block0.d();
				if_block1.d();
				/*dialog_1_binding*/ ctx[10](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	const func = key => key === ' ' ? 'Space' : key;

	function instance$v($$self, $$props, $$invalidate) {
		let { keys = new Set() } = $$props;
		let keysDeref = new Set(keys);

		// $: keysDeref = new Set(keys);
		let recording = false;

		let dialog;
		let dispatch = createEventDispatcher();

		function onKeydown(event) {
			if (!recording) return;

			if (event.key === 'Escape') {
				$$invalidate(1, recording = false);
				return;
			}

			keysDeref.add(event.key.toLowerCase());
			$$invalidate(0, keysDeref);
		}

		function toggleRecording() {
			$$invalidate(1, recording = !recording);

			if (recording) {
				keysDeref.clear();
				$$invalidate(0, keysDeref);
			}
		}

		function confirm() {
			dispatch('close', keysDeref);
		}

		function cancel() {
			dispatch('close', new Set());
		}

		onMount(() => {
			dialog.showModal();

			dialog.addEventListener('close', () => {
				dispatch('close', new Set());
			});
		});

		function mousedown_handler(event) {
			bubble.call(this, $$self, event);
		}

		function keydown_handler(event) {
			bubble.call(this, $$self, event);
		}

		function dialog_1_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				dialog = $$value;
				$$invalidate(2, dialog);
			});
		}

		$$self.$$set = $$props => {
			if ('keys' in $$props) $$invalidate(7, keys = $$props.keys);
		};

		return [
			keysDeref,
			recording,
			dialog,
			onKeydown,
			toggleRecording,
			confirm,
			cancel,
			keys,
			mousedown_handler,
			keydown_handler,
			dialog_1_binding
		];
	}

	class KeybindCreator extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$v, create_fragment$C, safe_not_equal, { keys: 7 }, add_css$e);
		}
	}

	/* src\hud\components\Hotkey.svelte generated by Svelte v4.2.9 */

	function add_css$d(target) {
		append_styles(target, "svelte-1tsrn0k", "button.svelte-1tsrn0k{background-color:transparent;border:none;height:30px;margin:0px;padding-right:0px}");
	}

	// (28:0) {#if keybindCreatorOpen}
	function create_if_block$9(ctx) {
		let keybindcreator;
		let current;
		keybindcreator = new KeybindCreator({ props: { keys: /*keybind*/ ctx[1] } });
		keybindcreator.$on("close", /*onCreatorClose*/ ctx[2]);

		return {
			c() {
				create_component(keybindcreator.$$.fragment);
			},
			m(target, anchor) {
				mount_component(keybindcreator, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(keybindcreator.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(keybindcreator.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(keybindcreator, detaching);
			}
		};
	}

	function create_fragment$B(ctx) {
		let t;
		let button;
		let keyboardoutline;
		let current;
		let mounted;
		let dispose;
		let if_block = /*keybindCreatorOpen*/ ctx[0] && create_if_block$9(ctx);
		keyboardoutline = new KeyboardOutline({ props: { width: 30, height: 30 } });

		return {
			c() {
				if (if_block) if_block.c();
				t = space();
				button = element("button");
				create_component(keyboardoutline.$$.fragment);
				attr(button, "class", "svelte-1tsrn0k");
			},
			m(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert(target, t, anchor);
				insert(target, button, anchor);
				mount_component(keyboardoutline, button, null);
				current = true;

				if (!mounted) {
					dispose = listen(button, "click", /*click_handler*/ ctx[4]);
					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (/*keybindCreatorOpen*/ ctx[0]) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty & /*keybindCreatorOpen*/ 1) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block$9(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(t.parentNode, t);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				transition_in(keyboardoutline.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				transition_out(keyboardoutline.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
					detach(button);
				}

				if (if_block) if_block.d(detaching);
				destroy_component(keyboardoutline);
				mounted = false;
				dispose();
			}
		};
	}

	function instance$u($$self, $$props, $$invalidate) {
		let { hotkeyId } = $$props;
		let dispatch = createEventDispatcher();
		let keybindCreatorOpen = false;
		let keybind = new Set(getHotkey(hotkeyId) ?? []);

		function onCreatorClose(result) {
			$$invalidate(0, keybindCreatorOpen = false);
			if (!result.detail) return;

			// gotta keep the refrence
			keybind.clear();

			for (let key of result.detail) {
				keybind.add(key);
			}

			setHotkey(hotkeyId, Array.from(keybind));
		}

		onMount(() => {
			keybindManager.addKeybind(keybind, () => {
				dispatch('trigger');
			});
		});

		const click_handler = () => $$invalidate(0, keybindCreatorOpen = !keybindCreatorOpen);

		$$self.$$set = $$props => {
			if ('hotkeyId' in $$props) $$invalidate(3, hotkeyId = $$props.hotkeyId);
		};

		return [keybindCreatorOpen, keybind, onCreatorClose, hotkeyId, click_handler];
	}

	class Hotkey extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$u, create_fragment$B, safe_not_equal, { hotkeyId: 3 }, add_css$d);
		}
	}

	/* src\hud\components\Button.svelte generated by Svelte v4.2.9 */

	function add_css$c(target) {
		append_styles(target, "svelte-o69qzc", ".wrap.svelte-o69qzc{display:flex;flex-wrap:nowrap;align-items:center;justify-content:space-between;margin:5px 10px}button.svelte-o69qzc{background-color:var(--buttonBackgroundColor);border:1px solid var(--buttonBorderColor);border-radius:5px;transition:transform 0.1s;flex-grow:1}button.svelte-o69qzc:disabled{opacity:0.5;cursor:not-allowed}button.svelte-o69qzc:active,button.active.svelte-o69qzc{transform:scale(0.95)}");
	}

	// (25:4) {#if hotkeyId}
	function create_if_block$8(ctx) {
		let hotkey;
		let current;
		hotkey = new Hotkey({ props: { hotkeyId: /*hotkeyId*/ ctx[2] } });
		hotkey.$on("trigger", /*trigger*/ ctx[6]);

		return {
			c() {
				create_component(hotkey.$$.fragment);
			},
			m(target, anchor) {
				mount_component(hotkey, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const hotkey_changes = {};
				if (dirty & /*hotkeyId*/ 4) hotkey_changes.hotkeyId = /*hotkeyId*/ ctx[2];
				hotkey.$set(hotkey_changes);
			},
			i(local) {
				if (current) return;
				transition_in(hotkey.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(hotkey.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(hotkey, detaching);
			}
		};
	}

	function create_fragment$A(ctx) {
		let div;
		let button_1;
		let button_1_disabled_value;
		let button_1_title_value;
		let t;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[8].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[7], null);
		let if_block = /*hotkeyId*/ ctx[2] && create_if_block$8(ctx);

		return {
			c() {
				div = element("div");
				button_1 = element("button");
				if (default_slot) default_slot.c();
				t = space();
				if (if_block) if_block.c();
				button_1.disabled = button_1_disabled_value = /*disabled*/ ctx[0] === true || /*disabled*/ ctx[0] === undefined;
				attr(button_1, "title", button_1_title_value = /*disabled*/ ctx[0] ? /*disabledMsg*/ ctx[1] : undefined);
				attr(button_1, "class", "svelte-o69qzc");
				toggle_class(button_1, "active", /*active*/ ctx[4]);
				attr(div, "class", "wrap svelte-o69qzc");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, button_1);

				if (default_slot) {
					default_slot.m(button_1, null);
				}

				/*button_1_binding*/ ctx[10](button_1);
				append(div, t);
				if (if_block) if_block.m(div, null);
				current = true;

				if (!mounted) {
					dispose = [
						listen(button_1, "click", /*onClick*/ ctx[5]),
						listen(button_1, "keydown", prevent_default(/*keydown_handler*/ ctx[9]))
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 128)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[7],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[7])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[7], dirty, null),
							null
						);
					}
				}

				if (!current || dirty & /*disabled*/ 1 && button_1_disabled_value !== (button_1_disabled_value = /*disabled*/ ctx[0] === true || /*disabled*/ ctx[0] === undefined)) {
					button_1.disabled = button_1_disabled_value;
				}

				if (!current || dirty & /*disabled, disabledMsg*/ 3 && button_1_title_value !== (button_1_title_value = /*disabled*/ ctx[0] ? /*disabledMsg*/ ctx[1] : undefined)) {
					attr(button_1, "title", button_1_title_value);
				}

				if (!current || dirty & /*active*/ 16) {
					toggle_class(button_1, "active", /*active*/ ctx[4]);
				}

				if (/*hotkeyId*/ ctx[2]) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty & /*hotkeyId*/ 4) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block$8(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(div, null);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				if (default_slot) default_slot.d(detaching);
				/*button_1_binding*/ ctx[10](null);
				if (if_block) if_block.d();
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$t($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		let { disabled = null } = $$props;
		let { disabledMsg = undefined } = $$props;
		let { hotkeyId = undefined } = $$props;
		let dispatch = createEventDispatcher();
		let button;
		let active = false;

		function onClick() {
			dispatch("click");
		}

		function trigger() {
			dispatch("click");
			$$invalidate(4, active = true);
			setTimeout(() => $$invalidate(4, active = false), 100);
		}

		function keydown_handler(event) {
			bubble.call(this, $$self, event);
		}

		function button_1_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				button = $$value;
				$$invalidate(3, button);
			});
		}

		$$self.$$set = $$props => {
			if ('disabled' in $$props) $$invalidate(0, disabled = $$props.disabled);
			if ('disabledMsg' in $$props) $$invalidate(1, disabledMsg = $$props.disabledMsg);
			if ('hotkeyId' in $$props) $$invalidate(2, hotkeyId = $$props.hotkeyId);
			if ('$$scope' in $$props) $$invalidate(7, $$scope = $$props.$$scope);
		};

		return [
			disabled,
			disabledMsg,
			hotkeyId,
			button,
			active,
			onClick,
			trigger,
			$$scope,
			slots,
			keydown_handler,
			button_1_binding
		];
	}

	class Button extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$t, create_fragment$A, safe_not_equal, { disabled: 0, disabledMsg: 1, hotkeyId: 2 }, add_css$c);
		}
	}

	/* src\hud\Group.svelte generated by Svelte v4.2.9 */

	function add_css$b(target) {
		append_styles(target, "svelte-151a7uw", ".groupContent.svelte-151a7uw{transform:translateX(100%);opacity:0;pointer-events:none;display:none}@keyframes slide-in-left{0%{transform:translateX(-100%);opacity:0;pointer-events:none}100%{transform:translateX(0%);opacity:1;pointer-events:all}}@keyframes slide-out-left{0%{transform:translateX(0%);opacity:1;pointer-events:all}100%{transform:translateX(-100%);opacity:0;pointer-events:none}}@keyframes slide-in-right{0%{transform:translateX(100%);opacity:0;pointer-events:none}100%{transform:translateX(0%);opacity:1;pointer-events:all}}@keyframes slide-out-right{0%{transform:translateX(0%);opacity:1;pointer-events:all}100%{transform:translateX(100%);opacity:0;pointer-events:none}}");
	}

	// (40:0) <Button on:click={openGroup}>
	function create_default_slot_1$6(ctx) {
		let t;

		return {
			c() {
				t = text(/*name*/ ctx[0]);
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*name*/ 1) set_data(t, /*name*/ ctx[0]);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (45:4) <Button on:click={closeGroup}>
	function create_default_slot$l(ctx) {
		let t;

		return {
			c() {
				t = text("Close");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	function create_fragment$z(ctx) {
		let button0;
		let t0;
		let div;
		let button1;
		let t1;
		let current;

		button0 = new Button({
				props: {
					$$slots: { default: [create_default_slot_1$6] },
					$$scope: { ctx }
				}
			});

		button0.$on("click", /*openGroup*/ ctx[2]);

		button1 = new Button({
				props: {
					$$slots: { default: [create_default_slot$l] },
					$$scope: { ctx }
				}
			});

		button1.$on("click", /*closeGroup*/ ctx[3]);
		const default_slot_template = /*#slots*/ ctx[4].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], null);

		return {
			c() {
				create_component(button0.$$.fragment);
				t0 = space();
				div = element("div");
				create_component(button1.$$.fragment);
				t1 = space();
				if (default_slot) default_slot.c();
				attr(div, "class", "groupContent svelte-151a7uw");
			},
			m(target, anchor) {
				mount_component(button0, target, anchor);
				insert(target, t0, anchor);
				insert(target, div, anchor);
				mount_component(button1, div, null);
				append(div, t1);

				if (default_slot) {
					default_slot.m(div, null);
				}

				/*div_binding*/ ctx[5](div);
				current = true;
			},
			p(ctx, [dirty]) {
				const button0_changes = {};

				if (dirty & /*$$scope, name*/ 65) {
					button0_changes.$$scope = { dirty, ctx };
				}

				button0.$set(button0_changes);
				const button1_changes = {};

				if (dirty & /*$$scope*/ 64) {
					button1_changes.$$scope = { dirty, ctx };
				}

				button1.$set(button1_changes);

				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[6],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, null),
							null
						);
					}
				}
			},
			i(local) {
				if (current) return;
				transition_in(button0.$$.fragment, local);
				transition_in(button1.$$.fragment, local);
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(button0.$$.fragment, local);
				transition_out(button1.$$.fragment, local);
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(div);
				}

				destroy_component(button0, detaching);
				destroy_component(button1);
				if (default_slot) default_slot.d(detaching);
				/*div_binding*/ ctx[5](null);
			}
		};
	}

	function slide(el, direction, side) {
		el.style.animation = `slide-${direction}-${side} 0.2s ease-in-out forwards`;

		if (direction == 'out') {
			el.classList.remove('open');

			setTimeout(
				() => {
					el.style.display = 'none';
				},
				200
			);
		} else {
			el.style.display = 'flex';
			el.classList.add('open');
		}
	}

	function instance$s($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		let { name } = $$props;
		let groupEl;
		let lastGroupEl;
		let parentMenu;

		function openGroup() {
			// find the previously opened group
			lastGroupEl = parentMenu.querySelector('.groupContent.open');

			// slide it out to the left
			if (lastGroupEl) slide(lastGroupEl, 'out', 'left');

			slide(groupEl, 'in', 'right');
		}

		function closeGroup() {
			slide(groupEl, 'out', 'right');
			if (lastGroupEl) slide(lastGroupEl, 'in', 'left');
		}

		onMount(() => {
			parentMenu = findMatchingParent(groupEl, '.menu .children');
			parentMenu.appendChild(groupEl);
		});

		function div_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				groupEl = $$value;
				$$invalidate(1, groupEl);
			});
		}

		$$self.$$set = $$props => {
			if ('name' in $$props) $$invalidate(0, name = $$props.name);
			if ('$$scope' in $$props) $$invalidate(6, $$scope = $$props.$$scope);
		};

		return [name, groupEl, openGroup, closeGroup, slots, div_binding, $$scope];
	}

	class Group extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$s, create_fragment$z, safe_not_equal, { name: 0 }, add_css$b);
		}
	}

	/* src\hud\components\ColorPicker.svelte generated by Svelte v4.2.9 */

	function add_css$a(target) {
		append_styles(target, "svelte-qar3ci", ".colorPicker.svelte-qar3ci{width:100%;display:flex;flex-direction:column;align-items:center}.inputs.svelte-qar3ci{display:flex;align-items:center;justify-content:space-around;width:100%;max-width:100%}.opacityBlock.svelte-qar3ci{display:flex;flex-direction:column;align-items:center}.alphaInput.svelte-qar3ci{flex-shrink:1;min-width:0;width:100%}.colorInput.svelte-qar3ci{flex-shrink:0}.preview.svelte-qar3ci{width:50px;height:50px;border-radius:10px;flex-shrink:0;border:2px solid black}");
	}

	// (36:8) {#if allowOpacity}
	function create_if_block$7(ctx) {
		let div1;
		let div0;
		let t1;
		let input;
		let mounted;
		let dispose;

		return {
			c() {
				div1 = element("div");
				div0 = element("div");
				div0.textContent = "Opacity";
				t1 = space();
				input = element("input");
				attr(input, "type", "range");
				attr(input, "min", /*minOpactiy*/ ctx[2]);
				attr(input, "max", "1");
				attr(input, "step", "0.01");
				attr(input, "class", "alphaInput svelte-qar3ci");
				attr(div1, "class", "opacityBlock svelte-qar3ci");
			},
			m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, div0);
				append(div1, t1);
				append(div1, input);
				set_input_value(input, /*alphaVal*/ ctx[4]);

				if (!mounted) {
					dispose = [
						listen(input, "change", /*input_change_input_handler*/ ctx[11]),
						listen(input, "input", /*input_change_input_handler*/ ctx[11]),
						listen(input, "input", /*onChange*/ ctx[6]),
						listen(input, "mousedown", stop_propagation(/*mousedown_handler*/ ctx[10]))
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty & /*minOpactiy*/ 4) {
					attr(input, "min", /*minOpactiy*/ ctx[2]);
				}

				if (dirty & /*alphaVal*/ 16) {
					set_input_value(input, /*alphaVal*/ ctx[4]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(div1);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	function create_fragment$y(ctx) {
		let div3;
		let div0;
		let t0;
		let t1;
		let div2;
		let t2;
		let input;
		let t3;
		let div1;
		let mounted;
		let dispose;
		let if_block = /*allowOpacity*/ ctx[1] && create_if_block$7(ctx);

		return {
			c() {
				div3 = element("div");
				div0 = element("div");
				t0 = text(/*text*/ ctx[0]);
				t1 = space();
				div2 = element("div");
				if (if_block) if_block.c();
				t2 = space();
				input = element("input");
				t3 = space();
				div1 = element("div");
				attr(input, "type", "color");
				attr(input, "class", "colorInput svelte-qar3ci");
				attr(div1, "class", "preview svelte-qar3ci");
				set_style(div1, "background-color", /*displayColor*/ ctx[5]);
				attr(div2, "class", "inputs svelte-qar3ci");
				attr(div3, "class", "colorPicker svelte-qar3ci");
			},
			m(target, anchor) {
				insert(target, div3, anchor);
				append(div3, div0);
				append(div0, t0);
				append(div3, t1);
				append(div3, div2);
				if (if_block) if_block.m(div2, null);
				append(div2, t2);
				append(div2, input);
				set_input_value(input, /*colorVal*/ ctx[3]);
				append(div2, t3);
				append(div2, div1);

				if (!mounted) {
					dispose = [
						listen(input, "input", /*input_input_handler*/ ctx[12]),
						listen(input, "input", /*onChange*/ ctx[6]),
						listen(input, "mousedown", stop_propagation(/*mousedown_handler_1*/ ctx[9]))
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*text*/ 1) set_data(t0, /*text*/ ctx[0]);

				if (/*allowOpacity*/ ctx[1]) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block$7(ctx);
						if_block.c();
						if_block.m(div2, t2);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if (dirty & /*colorVal*/ 8) {
					set_input_value(input, /*colorVal*/ ctx[3]);
				}

				if (dirty & /*displayColor*/ 32) {
					set_style(div1, "background-color", /*displayColor*/ ctx[5]);
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(div3);
				}

				if (if_block) if_block.d();
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$r($$self, $$props, $$invalidate) {
		let { text } = $$props;
		let { color = undefined } = $$props;
		let { bindValue = undefined } = $$props;
		let { allowOpacity = true } = $$props;
		let { minOpactiy = 0 } = $$props;
		let useColor = color ?? getCssVar(bindValue) ?? 'rgba(255, 255, 255, 1)';
		let channels = parseRGBA(useColor);
		let colorVal = rgbToHex(channels.r, channels.g, channels.b);
		let alphaVal = channels.a;
		let displayColor = useColor;

		function setVar(color) {
			setCssVar(bindValue, color);
		}

		const setVarDebounce = debounce$1(setVar, 100);

		function onChange() {
			let hexChannels = parseHex(colorVal);
			let newColor = `rgba(${hexChannels.r}, ${hexChannels.g}, ${hexChannels.b}, ${alphaVal})`;

			if (bindValue) {
				setVarDebounce(newColor);
				document.documentElement.style.setProperty(`--${bindValue}`, newColor);
			}

			$$invalidate(5, displayColor = newColor);
			if (color) $$invalidate(7, color = newColor);
		}

		function mousedown_handler_1(event) {
			bubble.call(this, $$self, event);
		}

		function mousedown_handler(event) {
			bubble.call(this, $$self, event);
		}

		function input_change_input_handler() {
			alphaVal = to_number(this.value);
			$$invalidate(4, alphaVal);
		}

		function input_input_handler() {
			colorVal = this.value;
			$$invalidate(3, colorVal);
		}

		$$self.$$set = $$props => {
			if ('text' in $$props) $$invalidate(0, text = $$props.text);
			if ('color' in $$props) $$invalidate(7, color = $$props.color);
			if ('bindValue' in $$props) $$invalidate(8, bindValue = $$props.bindValue);
			if ('allowOpacity' in $$props) $$invalidate(1, allowOpacity = $$props.allowOpacity);
			if ('minOpactiy' in $$props) $$invalidate(2, minOpactiy = $$props.minOpactiy);
		};

		return [
			text,
			allowOpacity,
			minOpactiy,
			colorVal,
			alphaVal,
			displayColor,
			onChange,
			color,
			bindValue,
			mousedown_handler_1,
			mousedown_handler,
			input_change_input_handler,
			input_input_handler
		];
	}

	class ColorPicker extends SvelteComponent {
		constructor(options) {
			super();

			init(
				this,
				options,
				instance$r,
				create_fragment$y,
				safe_not_equal,
				{
					text: 0,
					color: 7,
					bindValue: 8,
					allowOpacity: 1,
					minOpactiy: 2
				},
				add_css$a
			);
		}
	}

	/* src\hud\ResetStyles.svelte generated by Svelte v4.2.9 */

	function create_default_slot$k(ctx) {
		let t;

		return {
			c() {
				t = text("Reset All Styles");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	function create_fragment$x(ctx) {
		let button;
		let current;

		button = new Button({
				props: {
					$$slots: { default: [create_default_slot$k] },
					$$scope: { ctx }
				}
			});

		button.$on("click", /*resetStyles*/ ctx[0]);

		return {
			c() {
				create_component(button.$$.fragment);
			},
			m(target, anchor) {
				mount_component(button, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const button_changes = {};

				if (dirty & /*$$scope*/ 2) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);
			},
			i(local) {
				if (current) return;
				transition_in(button.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(button, detaching);
			}
		};
	}

	function instance$q($$self) {
		function resetStyles() {
			let res = confirm("Are you sure you want to reset all styles?");
			if (!res) return;

			for (let key in defaultCss) {
				document.documentElement.style.setProperty(`--${key}`, defaultCss[key]);
			}

			setCssVars(defaultCss);
		}

		return [resetStyles];
	}

	class ResetStyles extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$q, create_fragment$x, safe_not_equal, {});
		}
	}

	/* src\hud\components\ToggleButton.svelte generated by Svelte v4.2.9 */

	function create_else_block$2(ctx) {
		let t;

		return {
			c() {
				t = text(/*offText*/ ctx[2]);
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*offText*/ 4) set_data(t, /*offText*/ ctx[2]);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (17:4) {#if enabled}
	function create_if_block$6(ctx) {
		let t;

		return {
			c() {
				t = text(/*onText*/ ctx[1]);
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*onText*/ 2) set_data(t, /*onText*/ ctx[1]);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (16:0) <Button on:click={onClick} {disabled} {disabledMsg} {hotkeyId}>
	function create_default_slot$j(ctx) {
		let if_block_anchor;

		function select_block_type(ctx, dirty) {
			if (/*enabled*/ ctx[0]) return create_if_block$6;
			return create_else_block$2;
		}

		let current_block_type = select_block_type(ctx);
		let if_block = current_block_type(ctx);

		return {
			c() {
				if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
			},
			p(ctx, dirty) {
				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block.d(1);
					if_block = current_block_type(ctx);

					if (if_block) {
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				}
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if_block.d(detaching);
			}
		};
	}

	function create_fragment$w(ctx) {
		let button;
		let current;

		button = new Button({
				props: {
					disabled: /*disabled*/ ctx[3],
					disabledMsg: /*disabledMsg*/ ctx[4],
					hotkeyId: /*hotkeyId*/ ctx[5],
					$$slots: { default: [create_default_slot$j] },
					$$scope: { ctx }
				}
			});

		button.$on("click", /*onClick*/ ctx[6]);

		return {
			c() {
				create_component(button.$$.fragment);
			},
			m(target, anchor) {
				mount_component(button, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const button_changes = {};
				if (dirty & /*disabled*/ 8) button_changes.disabled = /*disabled*/ ctx[3];
				if (dirty & /*disabledMsg*/ 16) button_changes.disabledMsg = /*disabledMsg*/ ctx[4];
				if (dirty & /*hotkeyId*/ 32) button_changes.hotkeyId = /*hotkeyId*/ ctx[5];

				if (dirty & /*$$scope, onText, enabled, offText*/ 263) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);
			},
			i(local) {
				if (current) return;
				transition_in(button.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(button, detaching);
			}
		};
	}

	function instance$p($$self, $$props, $$invalidate) {
		let { onText } = $$props;
		let { offText } = $$props;
		let { enabled = false } = $$props;
		let { disabled = null } = $$props;
		let { disabledMsg = undefined } = $$props;
		let { hotkeyId = undefined } = $$props;
		let dispatch = createEventDispatcher();

		function onClick() {
			$$invalidate(0, enabled = !enabled);
			dispatch("click", enabled);
		}

		$$self.$$set = $$props => {
			if ('onText' in $$props) $$invalidate(1, onText = $$props.onText);
			if ('offText' in $$props) $$invalidate(2, offText = $$props.offText);
			if ('enabled' in $$props) $$invalidate(0, enabled = $$props.enabled);
			if ('disabled' in $$props) $$invalidate(3, disabled = $$props.disabled);
			if ('disabledMsg' in $$props) $$invalidate(4, disabledMsg = $$props.disabledMsg);
			if ('hotkeyId' in $$props) $$invalidate(5, hotkeyId = $$props.hotkeyId);
		};

		return [enabled, onText, offText, disabled, disabledMsg, hotkeyId, onClick];
	}

	class ToggleButton extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$p, create_fragment$w, safe_not_equal, {
				onText: 1,
				offText: 2,
				enabled: 0,
				disabled: 3,
				disabledMsg: 4,
				hotkeyId: 5
			});
		}
	}

	/* src\scripts\AutoAnswer.svelte generated by Svelte v4.2.9 */

	function create_fragment$v(ctx) {
		let togglebutton;
		let current;

		togglebutton = new ToggleButton({
				props: {
					disabled: !/*enabled*/ ctx[0],
					disabledMsg: "Questions haven't loaded yet",
					onText: "Stop auto answering",
					offText: "Start auto answering",
					enabled: false,
					hotkeyId: "autoAnswer"
				}
			});

		togglebutton.$on("click", /*toggleAutoAnswer*/ ctx[2]);

		return {
			c() {
				create_component(togglebutton.$$.fragment);
			},
			m(target, anchor) {
				mount_component(togglebutton, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const togglebutton_changes = {};
				if (dirty & /*enabled*/ 1) togglebutton_changes.disabled = !/*enabled*/ ctx[0];
				togglebutton.$set(togglebutton_changes);
			},
			i(local) {
				if (current) return;
				transition_in(togglebutton.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(togglebutton.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(togglebutton, detaching);
			}
		};
	}

	function instance$o($$self, $$props, $$invalidate) {
		let enabled;
		let $playerId;
		let $transportType;
		component_subscribe($$self, playerId, $$value => $$invalidate(10, $playerId = $$value));
		let { transportType } = socketManager;
		component_subscribe($$self, transportType, value => $$invalidate(8, $transportType = value));
		let questions = [];
		let answerDeviceId = null;
		let currentQuestionId = null;
		let questionIdList = [];
		let currentQuestionIndex = -1;

		function answerQuestion() {
			if ($transportType === 'colyseus') {
				if (currentQuestionId == null) return;

				// find the correct question
				let question = questions.find(q => q._id == currentQuestionId);

				if (!question) return;

				let packet = {
					key: 'answered',
					deviceId: answerDeviceId,
					data: {}
				};

				// create a packet to send to the server
				if (question.type == 'text') {
					packet.data.answer = question.answers[0].text;
				} else {
					let correctAnswerId = question.answers.find(a => a.correct)._id;
					packet.data.answer = correctAnswerId;
				}

				socketManager.sendMessage("MESSAGE_FOR_DEVICE", packet);
			} else {
				let questionId = questionIdList[currentQuestionIndex];
				let question = questions.find(q => q._id == questionId);
				if (!question) return;
				let answer;

				if (question.type == 'mc') {
					answer = question.answers.find(a => a.correct)._id;
				} else {
					answer = question.answers[0].text;
				}

				socketManager.sendMessage("QUESTION_ANSWERED", { answer, questionId });
			}
		}

		let answerInterval; // should probably be a number but I don't care

		function toggleAutoAnswer(event) {
			if (event.detail) {
				answerInterval = setInterval(answerQuestion, 1000);
			} else {
				clearInterval(answerInterval);
			}
		}

		socketManager.addEventListener("deviceChanges", event => {
			for (let { id, data } of event.detail) {
				for (let key in data) {
					if (key == "GLOBAL_questions") {
						$$invalidate(3, questions = JSON.parse(data[key]));
						console.log("Got questions", questions);
						$$invalidate(4, answerDeviceId = id);
					}

					if (key == `PLAYER_${$playerId}_currentQuestionId`) {
						$$invalidate(5, currentQuestionId = data[key]);
					}
				}
			}
		});

		socketManager.addEventListener("blueboatMessage", event => {
			if (event.detail?.key != "STATE_UPDATE") return;

			switch (event.detail.data.type) {
				case "GAME_QUESTIONS":
					$$invalidate(3, questions = event.detail.data.value);
					break;
				case "PLAYER_QUESTION_LIST":
					$$invalidate(6, questionIdList = event.detail.data.value.questionList);
					$$invalidate(7, currentQuestionIndex = event.detail.data.value.questionIndex);
					break;
				case "PLAYER_QUESTION_LIST_INDEX":
					$$invalidate(7, currentQuestionIndex = event.detail.data.value);
					break;
			}
		});

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*$transportType, questions, currentQuestionId, answerDeviceId, questionIdList, currentQuestionIndex*/ 504) {
				$$invalidate(0, enabled = $transportType == "colyseus"
				? questions.length > 0 && currentQuestionId != null && answerDeviceId != null
				: questionIdList.length > 0 && questions.length > 0 && currentQuestionIndex != -1);
			}
		};

		return [
			enabled,
			transportType,
			toggleAutoAnswer,
			questions,
			answerDeviceId,
			currentQuestionId,
			questionIdList,
			currentQuestionIndex,
			$transportType
		];
	}

	class AutoAnswer extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$o, create_fragment$v, safe_not_equal, {});
		}
	}

	/* src\scripts\2d\InstantUse.svelte generated by Svelte v4.2.9 */

	function create_fragment$u(ctx) {
		let togglebutton;
		let updating_enabled;
		let current;

		function togglebutton_enabled_binding(value) {
			/*togglebutton_enabled_binding*/ ctx[1](value);
		}

		let togglebutton_props = {
			onText: "Stop instant use",
			offText: "Enable instant use",
			hotkeyId: "instantUse"
		};

		if (/*enabled*/ ctx[0] !== void 0) {
			togglebutton_props.enabled = /*enabled*/ ctx[0];
		}

		togglebutton = new ToggleButton({ props: togglebutton_props });
		binding_callbacks.push(() => bind(togglebutton, 'enabled', togglebutton_enabled_binding));

		return {
			c() {
				create_component(togglebutton.$$.fragment);
			},
			m(target, anchor) {
				mount_component(togglebutton, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const togglebutton_changes = {};

				if (!updating_enabled && dirty & /*enabled*/ 1) {
					updating_enabled = true;
					togglebutton_changes.enabled = /*enabled*/ ctx[0];
					add_flush_callback(() => updating_enabled = false);
				}

				togglebutton.$set(togglebutton_changes);
			},
			i(local) {
				if (current) return;
				transition_in(togglebutton.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(togglebutton.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(togglebutton, detaching);
			}
		};
	}

	function instance$n($$self, $$props, $$invalidate) {
		let enabled = true;
		keybindManager.addKeybind(new Set(["enter"]), useNearest);

		function useNearest() {
			if (!enabled) return;
			let win = getUnsafeWindow();
			let devices = win?.stores?.phaser?.scene?.worldManager?.devices?.devicesInView;
			let body = win?.stores?.phaser?.mainCharacter?.body;
			if (!devices || !body) return;
			let closest = null;
			let closestDistance = Infinity;

			// Find the closest device with interactive zones
			for (let device of devices) {
				if (device.interactiveZones.zones.length == 0) continue;
				let distance = Math.sqrt(Math.pow(device.x - body.x, 2) + Math.pow(device.y - body.y, 2));

				if (distance < closestDistance) {
					closest = device;
					closestDistance = distance;
				}
			}

			if (!closest) return;
			closest?.interactiveZones?.onInteraction?.();
		}

		function togglebutton_enabled_binding(value) {
			enabled = value;
			$$invalidate(0, enabled);
		}

		return [enabled, togglebutton_enabled_binding];
	}

	class InstantUse extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$n, create_fragment$u, safe_not_equal, {});
		}
	}

	const knownSkins = ["dayOne", "echoAgent", "stripeDoubleGreen", "mustache", "vortexAgent", "grayGradient", "redNinja", "sprinklesRed", "redDeliciousApple", "sunny", "fadedBlueGradient", "glassHalfFull", "whiteAndBlueVerticalStripes", "polkaDotBlueAndYellow", "pinkPaste", "volcanoCracks", "mustachePink", "mountainAndSun", "camoTan", "redDinoCostume", "stripeDoubleRed", "coolRedBlueGradient", "pencilPack", "glyphsYellowBrown", "camoBlue", "purplePaste", "galaxy", "luchador", "fox", "pumpkin", "rockyWest", "mummy", "ghostCostume", "fifthBirthday", "corn", "feast", "pumpkinPie", "frostBuddy", "polkaDotWhiteAndRed", "festiveOnesieBlue", "festiveOnesieRed", "festiveOnesieGreen", "festiveOnesieTan", "gift", "hotChocolate", "snowman", "snowglobe", "mustacheSanta", "firework", "polkaDotFestiveReverse", "polkaDotFestive", "puzzleYellowPurple", "puzzleGreenBlue", "puzzleOrangeBlue", "puzzleGrayWhite", "puzzleRedGreen", "roses", "heart", "hamster", "leprechaun", "cellGold", "pirate", "constellationPurpleYellow", "constellationBlackGreen", "constellationBlackWhite", "constellationPinkGreen", "constellationYellowPink", "detective", "sketch", "astroHelmet", "mustacheBrown", "yinYang", "fisher", "coffee", "partyPineapple", "construction", "graduate", "graduateBlue", "stripeDoublePurple", "bananaSplit", "rainbowWave", "rockstar", "mountain", "tent", "goat", "daisy", "climber", "cookie", "zebra", "diamondRainbow", "circuitGreen", "circuitBlue", "circuitGray", "clock", "squiggles", "autumnTree", "crashTestDummy", "stripeDoubleYellow", "witch", "skeleton", "spiderWeb", "trickTreat", "calacaOne", "turkey", "farmer", "knight", "yellowCracksPurple", "arcticFox", "whistle", "penguinBlue", "goldenHotChocolate", "blastball", "blastballGimchester", "blastballKitcelona", "pufferJacket", "christmasTree", "rudolph", "snowball", "santaClaus", "causticWaterBlue", "causticWaterRed", "causticWaterGreen", "causticWaterCaribe", "causticWaterOcean", "causticWaterPurple", "taco", "gimKing", "sketchBlue", "clown", "camoGreen", "cellBlue", "burger", "sprinklesChocolate", "glyphsOrangeBlue", "frozenMummy", "evilPlantGreen", "evilPlantPink", "gamerGreen", "gamerPink", "gamerPurple", "gamerYellow", "sentryRobot", "8bit", "redDino", "calacaTwo", "calacaThree", "yarn", "racoon", "pilot", "shark", "redPanda", "marshmallow", "discoBall", "incognito", "dragon", "golden", "valenTime", "referee", "pilot", "sprinklesChocolate", "miningCart", "rainCloud", "watermelon", "terrainBlock", "floatingTube", "miner", "sproutingFlower", "luckyClover", "shark", "axolotlPink", "axolotlBlue", "axolotlYellow", "astroCaptain", "tuxedo", "blacksmith"];
	const knownTrails = ["origin_token", "fire_notes", "banana_peel", "rainbow_dots", "dust_particles", "bubble", "flowers", "metal_spring", "candy", "day_of_the_dead", "autumn_leaves", "corn", "hearts", "stars", "yin_yang", "puzzle_pieces", "taco", "blastball_phrases", "penguin_footprints", "blastball", "cupid_arrow", "birds", "mining_terrains", "beachball", "clovers", "easter_eggs"];

	/* src\hud\components\InputWithSelect.svelte generated by Svelte v4.2.9 */

	function add_css$9(target) {
		append_styles(target, "svelte-bgasye", ".container.svelte-bgasye{display:flex;padding:5px 10px;width:100%;justify-items:center;align-self:center}input.svelte-bgasye{flex-grow:1;color:black}select.svelte-bgasye{width:20px;color:black}");
	}

	function get_each_context$4(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[4] = list[i];
		return child_ctx;
	}

	// (11:8) {#each selectOptions as option}
	function create_each_block$4(ctx) {
		let option_1;
		let t_value = /*option*/ ctx[4] + "";
		let t;
		let option_1_value_value;

		return {
			c() {
				option_1 = element("option");
				t = text(t_value);
				option_1.__value = option_1_value_value = /*option*/ ctx[4];
				set_input_value(option_1, option_1.__value);
			},
			m(target, anchor) {
				insert(target, option_1, anchor);
				append(option_1, t);
			},
			p(ctx, dirty) {
				if (dirty & /*selectOptions*/ 2 && t_value !== (t_value = /*option*/ ctx[4] + "")) set_data(t, t_value);

				if (dirty & /*selectOptions*/ 2 && option_1_value_value !== (option_1_value_value = /*option*/ ctx[4])) {
					option_1.__value = option_1_value_value;
					set_input_value(option_1, option_1.__value);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(option_1);
				}
			}
		};
	}

	function create_fragment$t(ctx) {
		let div;
		let input;
		let t;
		let select;
		let mounted;
		let dispose;
		let each_value = ensure_array_like(/*selectOptions*/ ctx[1]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
		}

		return {
			c() {
				div = element("div");
				input = element("input");
				t = space();
				select = element("select");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr(input, "spellcheck", "false");
				attr(input, "class", "svelte-bgasye");
				attr(select, "class", "svelte-bgasye");
				attr(div, "class", "container svelte-bgasye");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, input);
				set_input_value(input, /*value*/ ctx[0]);
				append(div, t);
				append(div, select);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(select, null);
					}
				}

				if (!mounted) {
					dispose = [
						listen(input, "input", /*input_input_handler*/ ctx[3]),
						listen(select, "change", /*updateValue*/ ctx[2])
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*value*/ 1 && input.value !== /*value*/ ctx[0]) {
					set_input_value(input, /*value*/ ctx[0]);
				}

				if (dirty & /*selectOptions*/ 2) {
					each_value = ensure_array_like(/*selectOptions*/ ctx[1]);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$4(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$4(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_each(each_blocks, detaching);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$m($$self, $$props, $$invalidate) {
		let { selectOptions = [] } = $$props;
		let { value = "" } = $$props;

		function updateValue(e) {
			$$invalidate(0, value = e.target.value);
		}

		function input_input_handler() {
			value = this.value;
			$$invalidate(0, value);
		}

		$$self.$$set = $$props => {
			if ('selectOptions' in $$props) $$invalidate(1, selectOptions = $$props.selectOptions);
			if ('value' in $$props) $$invalidate(0, value = $$props.value);
		};

		return [value, selectOptions, updateValue, input_input_handler];
	}

	class InputWithSelect extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$m, create_fragment$t, safe_not_equal, { selectOptions: 1, value: 0 }, add_css$9);
		}
	}

	/* src\scripts\customization\CosmeticPicker.svelte generated by Svelte v4.2.9 */

	function add_css$8(target) {
		append_styles(target, "svelte-1ychv30", ".disclaimer.svelte-1ychv30{margin-left:5px;margin-right:5px;text-align:center}.description.svelte-1ychv30{width:100%;text-align:center}");
	}

	// (54:4) <Button disabled={!gotSkinId} disabledMsg="Character hasn't loaded" on:click={apply}>
	function create_default_slot_1$5(ctx) {
		let t;

		return {
			c() {
				t = text("Apply");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (42:0) <Group name="Cosmetic Picker">
	function create_default_slot$i(ctx) {
		let div0;
		let t1;
		let div1;
		let t3;
		let inputwithselect0;
		let updating_value;
		let t4;
		let div2;
		let t6;
		let inputwithselect1;
		let updating_value_1;
		let t7;
		let button;
		let current;

		function inputwithselect0_value_binding(value) {
			/*inputwithselect0_value_binding*/ ctx[4](value);
		}

		let inputwithselect0_props = { selectOptions: knownSkins };

		if (/*skinId*/ ctx[0] !== void 0) {
			inputwithselect0_props.value = /*skinId*/ ctx[0];
		}

		inputwithselect0 = new InputWithSelect({ props: inputwithselect0_props });
		binding_callbacks.push(() => bind(inputwithselect0, 'value', inputwithselect0_value_binding));

		function inputwithselect1_value_binding(value) {
			/*inputwithselect1_value_binding*/ ctx[5](value);
		}

		let inputwithselect1_props = { selectOptions: knownTrails };

		if (/*trailId*/ ctx[1] !== void 0) {
			inputwithselect1_props.value = /*trailId*/ ctx[1];
		}

		inputwithselect1 = new InputWithSelect({ props: inputwithselect1_props });
		binding_callbacks.push(() => bind(inputwithselect1, 'value', inputwithselect1_value_binding));

		button = new Button({
				props: {
					disabled: !/*gotSkinId*/ ctx[2],
					disabledMsg: "Character hasn't loaded",
					$$slots: { default: [create_default_slot_1$5] },
					$$scope: { ctx }
				}
			});

		button.$on("click", /*apply*/ ctx[3]);

		return {
			c() {
				div0 = element("div");
				div0.textContent = "These only work client-side. Nobody else can see these cosmetics.";
				t1 = space();
				div1 = element("div");
				div1.textContent = "Skin ID";
				t3 = space();
				create_component(inputwithselect0.$$.fragment);
				t4 = space();
				div2 = element("div");
				div2.textContent = "Trail ID";
				t6 = space();
				create_component(inputwithselect1.$$.fragment);
				t7 = space();
				create_component(button.$$.fragment);
				attr(div0, "class", "disclaimer svelte-1ychv30");
				attr(div1, "class", "description svelte-1ychv30");
				attr(div2, "class", "description svelte-1ychv30");
			},
			m(target, anchor) {
				insert(target, div0, anchor);
				insert(target, t1, anchor);
				insert(target, div1, anchor);
				insert(target, t3, anchor);
				mount_component(inputwithselect0, target, anchor);
				insert(target, t4, anchor);
				insert(target, div2, anchor);
				insert(target, t6, anchor);
				mount_component(inputwithselect1, target, anchor);
				insert(target, t7, anchor);
				mount_component(button, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const inputwithselect0_changes = {};

				if (!updating_value && dirty & /*skinId*/ 1) {
					updating_value = true;
					inputwithselect0_changes.value = /*skinId*/ ctx[0];
					add_flush_callback(() => updating_value = false);
				}

				inputwithselect0.$set(inputwithselect0_changes);
				const inputwithselect1_changes = {};

				if (!updating_value_1 && dirty & /*trailId*/ 2) {
					updating_value_1 = true;
					inputwithselect1_changes.value = /*trailId*/ ctx[1];
					add_flush_callback(() => updating_value_1 = false);
				}

				inputwithselect1.$set(inputwithselect1_changes);
				const button_changes = {};
				if (dirty & /*gotSkinId*/ 4) button_changes.disabled = !/*gotSkinId*/ ctx[2];

				if (dirty & /*$$scope*/ 256) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);
			},
			i(local) {
				if (current) return;
				transition_in(inputwithselect0.$$.fragment, local);
				transition_in(inputwithselect1.$$.fragment, local);
				transition_in(button.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(inputwithselect0.$$.fragment, local);
				transition_out(inputwithselect1.$$.fragment, local);
				transition_out(button.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div0);
					detach(t1);
					detach(div1);
					detach(t3);
					detach(t4);
					detach(div2);
					detach(t6);
					detach(t7);
				}

				destroy_component(inputwithselect0, detaching);
				destroy_component(inputwithselect1, detaching);
				destroy_component(button, detaching);
			}
		};
	}

	function create_fragment$s(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "Cosmetic Picker",
					$$slots: { default: [create_default_slot$i] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope, gotSkinId, trailId, skinId*/ 263) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	function instance$l($$self, $$props, $$invalidate) {
		let $playerId;
		component_subscribe($$self, playerId, $$value => $$invalidate(6, $playerId = $$value));
		let skinId = '';
		let trailId = '';
		let gotSkinId = false;

		let checkInterval = setInterval(
			() => {
				let char = getUnsafeWindow()?.stores?.phaser?.scene?.characterManager?.characters?.get($playerId);

				if (char) {
					$$invalidate(0, skinId = char.skin.skinId);
					$$invalidate(1, trailId = char.characterTrail.currentAppearanceId);
					$$invalidate(2, gotSkinId = true);
					clearInterval(checkInterval);
				}
			},
			500
		);

		function apply() {
			let char = getUnsafeWindow()?.stores?.phaser?.scene?.characterManager?.characters?.get($playerId);
			if (!char) return;

			if (skinId != "") {
				let setSkinId = skinId;
				if (!setSkinId.startsWith('character_')) setSkinId = 'character_' + setSkinId;
				char.skin.updateSkin({ id: setSkinId });
			}

			if (trailId != "") {
				let setTrailId = trailId;
				if (!setTrailId.startsWith('trail_')) setTrailId = 'trail_' + setTrailId;
				char.characterTrail.updateAppearance(setTrailId);
			}
		}

		onDestroy(() => {
			clearInterval(checkInterval);
		});

		function inputwithselect0_value_binding(value) {
			skinId = value;
			$$invalidate(0, skinId);
		}

		function inputwithselect1_value_binding(value) {
			trailId = value;
			$$invalidate(1, trailId);
		}

		return [
			skinId,
			trailId,
			gotSkinId,
			apply,
			inputwithselect0_value_binding,
			inputwithselect1_value_binding
		];
	}

	class CosmeticPicker extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$l, create_fragment$s, safe_not_equal, {}, add_css$8);
		}
	}

	const defaultThemes = [
	    {
	        question: {
	            background: "rgba(48, 63, 159, 1)",
	            text: "rgba(255, 255, 255, 1)"
	        },
	        palette: [
	            {
	                background: "rgba(119, 19, 34, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(168, 92, 21, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(13, 107, 51, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(7, 98, 150, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            }
	        ]
	    },
	    {
	        question: {
	            background: "rgba(108, 47, 0, 1)",
	            text: "rgba(255, 255, 255, 1)"
	        },
	        palette: [
	            {
	                background: "rgba(158, 104, 42, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(181, 71, 48, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(138, 151, 72, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(241, 185, 48, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            }
	        ]
	    },
	    {
	        question: {
	            background: "rgba(0, 10, 18, 1)",
	            text: "rgba(255, 255, 255, 1)"
	        },
	        palette: [
	            {
	                background: "rgba(38, 50, 56, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(55, 71, 79, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(69, 90, 100, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(84, 110, 122, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            }
	        ]
	    },
	    {
	        question: {
	            background: "rgba(13, 0, 25, 1)",
	            text: "rgba(255, 255, 255, 1)"
	        },
	        palette: [
	            {
	                background: "rgba(34, 0, 68, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(51, 0, 102, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(62, 0, 124, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(79, 23, 135, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            }
	        ]
	    },
	    {
	        question: {
	            background: "rgba(0, 0, 99, 1)",
	            text: "rgba(255, 255, 255, 1)"
	        },
	        palette: [
	            {
	                background: "rgba(40, 53, 147, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(7, 98, 150, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(2, 119, 189, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(21, 101, 192, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            }
	        ]
	    },
	    {
	        question: {
	            background: "rgba(76, 61, 51, 1)",
	            text: "rgba(255, 255, 255, 1)"
	        },
	        palette: [
	            {
	                background: "rgba(56, 86, 69, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(66, 92, 73, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(65, 86, 65, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(76, 99, 73, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            }
	        ]
	    },
	    {
	        question: {
	            background: "rgba(127, 116, 150, 1)",
	            text: "rgba(255, 255, 255, 1)"
	        },
	        palette: [
	            {
	                background: "rgba(244, 111, 90, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(237, 113, 45, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(122, 89, 106, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(232, 171, 60, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            }
	        ]
	    },
	    {
	        question: {
	            background: "rgba(255, 191, 209, 1)",
	            text: "rgba(67, 67, 67, 1)"
	        },
	        palette: [
	            {
	                background: "rgba(255, 166, 158, 1)",
	                text: "rgba(91, 91, 91, 1)"
	            },
	            {
	                background: "rgba(252, 246, 191, 1)",
	                text: "rgba(91, 91, 91, 1)"
	            },
	            {
	                background: "rgba(208, 244, 222, 1)",
	                text: "rgba(91, 91, 91, 1)"
	            },
	            {
	                background: "rgba(147, 225, 216, 1)",
	                text: "rgba(91, 91, 91, 1)"
	            }
	        ]
	    },
	    {
	        question: {
	            background: "rgba(156, 0, 34, 1)",
	            text: "rgba(255, 255, 255, 1)"
	        },
	        palette: [
	            {
	                background: "rgba(0, 29, 59, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(255, 174, 82, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(254, 89, 99, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            },
	            {
	                background: "rgba(167, 28, 148, 1)",
	                text: "rgba(255, 255, 255, 1)"
	            }
	        ]
	    },
	    {
	        question: {
	            background: "rgba(0, 0, 0, 1)",
	            text: "rgba(255, 205, 43, 1)"
	        },
	        palette: [
	            {
	                background: "rgba(255, 205, 43, 1)",
	                text: "rgba(0, 0, 0, 1)"
	            },
	            {
	                background: "rgba(255, 199, 33, 1)",
	                text: "rgba(0, 0, 0, 1)"
	            },
	            {
	                background: "rgba(255, 209, 71, 1)",
	                text: "rgba(0, 0, 0, 1)"
	            },
	            {
	                background: "rgba(255, 205, 56, 1)",
	                text: "rgba(0, 0, 0, 1)"
	            }
	        ]
	    }
	];

	/* node_modules\svelte-material-icons\Delete.svelte generated by Svelte v4.2.9 */

	function create_if_block_1$3(ctx) {
		let desc_1;
		let t;

		return {
			c() {
				desc_1 = svg_element("desc");
				t = text(/*desc*/ ctx[7]);
			},
			m(target, anchor) {
				insert(target, desc_1, anchor);
				append(desc_1, t);
			},
			p(ctx, dirty) {
				if (dirty & /*desc*/ 128) set_data(t, /*desc*/ ctx[7]);
			},
			d(detaching) {
				if (detaching) {
					detach(desc_1);
				}
			}
		};
	}

	// (16:165) {#if title}
	function create_if_block$5(ctx) {
		let title_1;
		let t;

		return {
			c() {
				title_1 = svg_element("title");
				t = text(/*title*/ ctx[6]);
			},
			m(target, anchor) {
				insert(target, title_1, anchor);
				append(title_1, t);
			},
			p(ctx, dirty) {
				if (dirty & /*title*/ 64) set_data(t, /*title*/ ctx[6]);
			},
			d(detaching) {
				if (detaching) {
					detach(title_1);
				}
			}
		};
	}

	function create_fragment$r(ctx) {
		let svg;
		let if_block0_anchor;
		let path;
		let if_block0 = /*desc*/ ctx[7] && create_if_block_1$3(ctx);
		let if_block1 = /*title*/ ctx[6] && create_if_block$5(ctx);

		return {
			c() {
				svg = svg_element("svg");
				if (if_block0) if_block0.c();
				if_block0_anchor = empty();
				if (if_block1) if_block1.c();
				path = svg_element("path");
				attr(path, "d", "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z");
				attr(path, "fill", /*color*/ ctx[2]);
				attr(svg, "viewBox", /*viewBox*/ ctx[3]);
				attr(svg, "width", /*width*/ ctx[0]);
				attr(svg, "height", /*height*/ ctx[1]);
				attr(svg, "class", /*className*/ ctx[8]);
				attr(svg, "aria-label", /*ariaLabel*/ ctx[4]);
				attr(svg, "aria-hidden", /*ariaHidden*/ ctx[5]);
			},
			m(target, anchor) {
				insert(target, svg, anchor);
				if (if_block0) if_block0.m(svg, null);
				append(svg, if_block0_anchor);
				if (if_block1) if_block1.m(svg, null);
				append(svg, path);
			},
			p(ctx, [dirty]) {
				if (/*desc*/ ctx[7]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
					} else {
						if_block0 = create_if_block_1$3(ctx);
						if_block0.c();
						if_block0.m(svg, if_block0_anchor);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (/*title*/ ctx[6]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);
					} else {
						if_block1 = create_if_block$5(ctx);
						if_block1.c();
						if_block1.m(svg, path);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}

				if (dirty & /*color*/ 4) {
					attr(path, "fill", /*color*/ ctx[2]);
				}

				if (dirty & /*viewBox*/ 8) {
					attr(svg, "viewBox", /*viewBox*/ ctx[3]);
				}

				if (dirty & /*width*/ 1) {
					attr(svg, "width", /*width*/ ctx[0]);
				}

				if (dirty & /*height*/ 2) {
					attr(svg, "height", /*height*/ ctx[1]);
				}

				if (dirty & /*className*/ 256) {
					attr(svg, "class", /*className*/ ctx[8]);
				}

				if (dirty & /*ariaLabel*/ 16) {
					attr(svg, "aria-label", /*ariaLabel*/ ctx[4]);
				}

				if (dirty & /*ariaHidden*/ 32) {
					attr(svg, "aria-hidden", /*ariaHidden*/ ctx[5]);
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(svg);
				}

				if (if_block0) if_block0.d();
				if (if_block1) if_block1.d();
			}
		};
	}

	function instance$k($$self, $$props, $$invalidate) {
		let { size = "1em" } = $$props;
		let { width = size } = $$props;
		let { height = size } = $$props;
		let { color = "currentColor" } = $$props;
		let { viewBox = "0 0 24 24" } = $$props;
		let { ariaLabel = void 0 } = $$props;
		let { ariaHidden = void 0 } = $$props;
		let { title = void 0 } = $$props;
		let { desc = void 0 } = $$props;
		let { class: className = void 0 } = $$props;

		$$self.$$set = $$props => {
			if ('size' in $$props) $$invalidate(9, size = $$props.size);
			if ('width' in $$props) $$invalidate(0, width = $$props.width);
			if ('height' in $$props) $$invalidate(1, height = $$props.height);
			if ('color' in $$props) $$invalidate(2, color = $$props.color);
			if ('viewBox' in $$props) $$invalidate(3, viewBox = $$props.viewBox);
			if ('ariaLabel' in $$props) $$invalidate(4, ariaLabel = $$props.ariaLabel);
			if ('ariaHidden' in $$props) $$invalidate(5, ariaHidden = $$props.ariaHidden);
			if ('title' in $$props) $$invalidate(6, title = $$props.title);
			if ('desc' in $$props) $$invalidate(7, desc = $$props.desc);
			if ('class' in $$props) $$invalidate(8, className = $$props.class);
		};

		return [
			width,
			height,
			color,
			viewBox,
			ariaLabel,
			ariaHidden,
			title,
			desc,
			className,
			size
		];
	}

	class Delete extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$k, create_fragment$r, safe_not_equal, {
				size: 9,
				width: 0,
				height: 1,
				color: 2,
				viewBox: 3,
				ariaLabel: 4,
				ariaHidden: 5,
				title: 6,
				desc: 7,
				class: 8
			});
		}
	}

	/* node_modules\svelte-material-icons\PlusCircleOutline.svelte generated by Svelte v4.2.9 */

	function create_if_block_1$2(ctx) {
		let desc_1;
		let t;

		return {
			c() {
				desc_1 = svg_element("desc");
				t = text(/*desc*/ ctx[7]);
			},
			m(target, anchor) {
				insert(target, desc_1, anchor);
				append(desc_1, t);
			},
			p(ctx, dirty) {
				if (dirty & /*desc*/ 128) set_data(t, /*desc*/ ctx[7]);
			},
			d(detaching) {
				if (detaching) {
					detach(desc_1);
				}
			}
		};
	}

	// (16:165) {#if title}
	function create_if_block$4(ctx) {
		let title_1;
		let t;

		return {
			c() {
				title_1 = svg_element("title");
				t = text(/*title*/ ctx[6]);
			},
			m(target, anchor) {
				insert(target, title_1, anchor);
				append(title_1, t);
			},
			p(ctx, dirty) {
				if (dirty & /*title*/ 64) set_data(t, /*title*/ ctx[6]);
			},
			d(detaching) {
				if (detaching) {
					detach(title_1);
				}
			}
		};
	}

	function create_fragment$q(ctx) {
		let svg;
		let if_block0_anchor;
		let path;
		let if_block0 = /*desc*/ ctx[7] && create_if_block_1$2(ctx);
		let if_block1 = /*title*/ ctx[6] && create_if_block$4(ctx);

		return {
			c() {
				svg = svg_element("svg");
				if (if_block0) if_block0.c();
				if_block0_anchor = empty();
				if (if_block1) if_block1.c();
				path = svg_element("path");
				attr(path, "d", "M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M13,7H11V11H7V13H11V17H13V13H17V11H13V7Z");
				attr(path, "fill", /*color*/ ctx[2]);
				attr(svg, "viewBox", /*viewBox*/ ctx[3]);
				attr(svg, "width", /*width*/ ctx[0]);
				attr(svg, "height", /*height*/ ctx[1]);
				attr(svg, "class", /*className*/ ctx[8]);
				attr(svg, "aria-label", /*ariaLabel*/ ctx[4]);
				attr(svg, "aria-hidden", /*ariaHidden*/ ctx[5]);
			},
			m(target, anchor) {
				insert(target, svg, anchor);
				if (if_block0) if_block0.m(svg, null);
				append(svg, if_block0_anchor);
				if (if_block1) if_block1.m(svg, null);
				append(svg, path);
			},
			p(ctx, [dirty]) {
				if (/*desc*/ ctx[7]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
					} else {
						if_block0 = create_if_block_1$2(ctx);
						if_block0.c();
						if_block0.m(svg, if_block0_anchor);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (/*title*/ ctx[6]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);
					} else {
						if_block1 = create_if_block$4(ctx);
						if_block1.c();
						if_block1.m(svg, path);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}

				if (dirty & /*color*/ 4) {
					attr(path, "fill", /*color*/ ctx[2]);
				}

				if (dirty & /*viewBox*/ 8) {
					attr(svg, "viewBox", /*viewBox*/ ctx[3]);
				}

				if (dirty & /*width*/ 1) {
					attr(svg, "width", /*width*/ ctx[0]);
				}

				if (dirty & /*height*/ 2) {
					attr(svg, "height", /*height*/ ctx[1]);
				}

				if (dirty & /*className*/ 256) {
					attr(svg, "class", /*className*/ ctx[8]);
				}

				if (dirty & /*ariaLabel*/ 16) {
					attr(svg, "aria-label", /*ariaLabel*/ ctx[4]);
				}

				if (dirty & /*ariaHidden*/ 32) {
					attr(svg, "aria-hidden", /*ariaHidden*/ ctx[5]);
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(svg);
				}

				if (if_block0) if_block0.d();
				if (if_block1) if_block1.d();
			}
		};
	}

	function instance$j($$self, $$props, $$invalidate) {
		let { size = "1em" } = $$props;
		let { width = size } = $$props;
		let { height = size } = $$props;
		let { color = "currentColor" } = $$props;
		let { viewBox = "0 0 24 24" } = $$props;
		let { ariaLabel = void 0 } = $$props;
		let { ariaHidden = void 0 } = $$props;
		let { title = void 0 } = $$props;
		let { desc = void 0 } = $$props;
		let { class: className = void 0 } = $$props;

		$$self.$$set = $$props => {
			if ('size' in $$props) $$invalidate(9, size = $$props.size);
			if ('width' in $$props) $$invalidate(0, width = $$props.width);
			if ('height' in $$props) $$invalidate(1, height = $$props.height);
			if ('color' in $$props) $$invalidate(2, color = $$props.color);
			if ('viewBox' in $$props) $$invalidate(3, viewBox = $$props.viewBox);
			if ('ariaLabel' in $$props) $$invalidate(4, ariaLabel = $$props.ariaLabel);
			if ('ariaHidden' in $$props) $$invalidate(5, ariaHidden = $$props.ariaHidden);
			if ('title' in $$props) $$invalidate(6, title = $$props.title);
			if ('desc' in $$props) $$invalidate(7, desc = $$props.desc);
			if ('class' in $$props) $$invalidate(8, className = $$props.class);
		};

		return [
			width,
			height,
			color,
			viewBox,
			ariaLabel,
			ariaHidden,
			title,
			desc,
			className,
			size
		];
	}

	class PlusCircleOutline extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$j, create_fragment$q, safe_not_equal, {
				size: 9,
				width: 0,
				height: 1,
				color: 2,
				viewBox: 3,
				ariaLabel: 4,
				ariaHidden: 5,
				title: 6,
				desc: 7,
				class: 8
			});
		}
	}

	/* src\scripts\customization\customTheme\CreateTheme.svelte generated by Svelte v4.2.9 */

	function add_css$7(target) {
		append_styles(target, "svelte-v66qr8", ".buttons.svelte-v66qr8{display:flex;flex-direction:row;width:100%}.submit.svelte-v66qr8,.cancel.svelte-v66qr8{padding:10px;margin:10px;font-size:20px;border:none;border-radius:5px;flex-grow:1}.submit.svelte-v66qr8{background-color:green}.cancel.svelte-v66qr8{background-color:red}dialog.svelte-v66qr8{width:80%;height:80%;display:flex}.pickers.svelte-v66qr8{width:200px;overflow-y:auto;overflow-x:hidden}.wrap.svelte-v66qr8{display:flex;flex-direction:column;height:100%;flex-grow:1}.question.svelte-v66qr8{width:100%;height:30%;font-family:'Product Sans', sans-serif;display:flex;align-items:center;justify-content:center;font-size:50px}.options.svelte-v66qr8{flex-grow:1;display:grid;grid-template-columns:repeat(2, 1fr);width:100%}.option.svelte-v66qr8{background-color:blue;display:flex;align-items:center;justify-content:center;font-family:'Product Sans', sans-serif;font-size:25px;border:6px solid rgba(0, 0, 0, 0.3)}");
	}

	function get_each_context$3(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[16] = list[i];
		child_ctx[18] = i;
		return child_ctx;
	}

	// (39:12) {#each { length: 4 } as _, i}
	function create_each_block$3(ctx) {
		let div1;
		let div0;
		let t2;

		return {
			c() {
				div1 = element("div");
				div0 = element("div");
				div0.textContent = `Option ${/*i*/ ctx[18] + 1}`;
				t2 = space();
				attr(div1, "class", "option svelte-v66qr8");
				set_style(div1, "background-color", /*theme*/ ctx[1].palette[/*i*/ ctx[18]].background);
				set_style(div1, "color", /*theme*/ ctx[1].palette[/*i*/ ctx[18]].text);
			},
			m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, div0);
				append(div1, t2);
			},
			p(ctx, dirty) {
				if (dirty & /*theme*/ 2) {
					set_style(div1, "background-color", /*theme*/ ctx[1].palette[/*i*/ ctx[18]].background);
				}

				if (dirty & /*theme*/ 2) {
					set_style(div1, "color", /*theme*/ ctx[1].palette[/*i*/ ctx[18]].text);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(div1);
				}
			}
		};
	}

	function create_fragment$p(ctx) {
		let dialog_1;
		let div0;
		let colorpicker0;
		let updating_color;
		let t0;
		let colorpicker1;
		let updating_color_1;
		let t1;
		let colorpicker2;
		let updating_color_2;
		let t2;
		let colorpicker3;
		let updating_color_3;
		let t3;
		let colorpicker4;
		let updating_color_4;
		let t4;
		let colorpicker5;
		let updating_color_5;
		let t5;
		let colorpicker6;
		let updating_color_6;
		let t6;
		let colorpicker7;
		let updating_color_7;
		let t7;
		let colorpicker8;
		let updating_color_8;
		let t8;
		let colorpicker9;
		let updating_color_9;
		let t9;
		let div5;
		let div2;
		let div1;
		let t11;
		let div3;
		let t12;
		let div4;
		let button0;
		let t14;
		let button1;
		let current;
		let mounted;
		let dispose;

		function colorpicker0_color_binding(value) {
			/*colorpicker0_color_binding*/ ctx[4](value);
		}

		let colorpicker0_props = {
			text: "Question Background",
			allowOpacity: false
		};

		if (/*theme*/ ctx[1].question.background !== void 0) {
			colorpicker0_props.color = /*theme*/ ctx[1].question.background;
		}

		colorpicker0 = new ColorPicker({ props: colorpicker0_props });
		binding_callbacks.push(() => bind(colorpicker0, 'color', colorpicker0_color_binding));

		function colorpicker1_color_binding(value) {
			/*colorpicker1_color_binding*/ ctx[5](value);
		}

		let colorpicker1_props = {
			text: "Question Text",
			allowOpacity: false
		};

		if (/*theme*/ ctx[1].question.text !== void 0) {
			colorpicker1_props.color = /*theme*/ ctx[1].question.text;
		}

		colorpicker1 = new ColorPicker({ props: colorpicker1_props });
		binding_callbacks.push(() => bind(colorpicker1, 'color', colorpicker1_color_binding));

		function colorpicker2_color_binding(value) {
			/*colorpicker2_color_binding*/ ctx[6](value);
		}

		let colorpicker2_props = {
			text: "Option 1 Background",
			allowOpacity: false
		};

		if (/*theme*/ ctx[1].palette[0].background !== void 0) {
			colorpicker2_props.color = /*theme*/ ctx[1].palette[0].background;
		}

		colorpicker2 = new ColorPicker({ props: colorpicker2_props });
		binding_callbacks.push(() => bind(colorpicker2, 'color', colorpicker2_color_binding));

		function colorpicker3_color_binding(value) {
			/*colorpicker3_color_binding*/ ctx[7](value);
		}

		let colorpicker3_props = {
			text: "Option 1 Text",
			allowOpacity: false
		};

		if (/*theme*/ ctx[1].palette[0].text !== void 0) {
			colorpicker3_props.color = /*theme*/ ctx[1].palette[0].text;
		}

		colorpicker3 = new ColorPicker({ props: colorpicker3_props });
		binding_callbacks.push(() => bind(colorpicker3, 'color', colorpicker3_color_binding));

		function colorpicker4_color_binding(value) {
			/*colorpicker4_color_binding*/ ctx[8](value);
		}

		let colorpicker4_props = {
			text: "Option 2 Background",
			allowOpacity: false
		};

		if (/*theme*/ ctx[1].palette[1].background !== void 0) {
			colorpicker4_props.color = /*theme*/ ctx[1].palette[1].background;
		}

		colorpicker4 = new ColorPicker({ props: colorpicker4_props });
		binding_callbacks.push(() => bind(colorpicker4, 'color', colorpicker4_color_binding));

		function colorpicker5_color_binding(value) {
			/*colorpicker5_color_binding*/ ctx[9](value);
		}

		let colorpicker5_props = {
			text: "Option 2 Text",
			allowOpacity: false
		};

		if (/*theme*/ ctx[1].palette[1].text !== void 0) {
			colorpicker5_props.color = /*theme*/ ctx[1].palette[1].text;
		}

		colorpicker5 = new ColorPicker({ props: colorpicker5_props });
		binding_callbacks.push(() => bind(colorpicker5, 'color', colorpicker5_color_binding));

		function colorpicker6_color_binding(value) {
			/*colorpicker6_color_binding*/ ctx[10](value);
		}

		let colorpicker6_props = {
			text: "Option 3 Background",
			allowOpacity: false
		};

		if (/*theme*/ ctx[1].palette[2].background !== void 0) {
			colorpicker6_props.color = /*theme*/ ctx[1].palette[2].background;
		}

		colorpicker6 = new ColorPicker({ props: colorpicker6_props });
		binding_callbacks.push(() => bind(colorpicker6, 'color', colorpicker6_color_binding));

		function colorpicker7_color_binding(value) {
			/*colorpicker7_color_binding*/ ctx[11](value);
		}

		let colorpicker7_props = {
			text: "Option 3 Text",
			allowOpacity: false
		};

		if (/*theme*/ ctx[1].palette[2].text !== void 0) {
			colorpicker7_props.color = /*theme*/ ctx[1].palette[2].text;
		}

		colorpicker7 = new ColorPicker({ props: colorpicker7_props });
		binding_callbacks.push(() => bind(colorpicker7, 'color', colorpicker7_color_binding));

		function colorpicker8_color_binding(value) {
			/*colorpicker8_color_binding*/ ctx[12](value);
		}

		let colorpicker8_props = {
			text: "Option 4 Background",
			allowOpacity: false
		};

		if (/*theme*/ ctx[1].palette[3].background !== void 0) {
			colorpicker8_props.color = /*theme*/ ctx[1].palette[3].background;
		}

		colorpicker8 = new ColorPicker({ props: colorpicker8_props });
		binding_callbacks.push(() => bind(colorpicker8, 'color', colorpicker8_color_binding));

		function colorpicker9_color_binding(value) {
			/*colorpicker9_color_binding*/ ctx[13](value);
		}

		let colorpicker9_props = {
			text: "Option 4 Text",
			allowOpacity: false
		};

		if (/*theme*/ ctx[1].palette[3].text !== void 0) {
			colorpicker9_props.color = /*theme*/ ctx[1].palette[3].text;
		}

		colorpicker9 = new ColorPicker({ props: colorpicker9_props });
		binding_callbacks.push(() => bind(colorpicker9, 'color', colorpicker9_color_binding));
		let each_value = ensure_array_like({ length: 4 });
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
		}

		return {
			c() {
				dialog_1 = element("dialog");
				div0 = element("div");
				create_component(colorpicker0.$$.fragment);
				t0 = space();
				create_component(colorpicker1.$$.fragment);
				t1 = space();
				create_component(colorpicker2.$$.fragment);
				t2 = space();
				create_component(colorpicker3.$$.fragment);
				t3 = space();
				create_component(colorpicker4.$$.fragment);
				t4 = space();
				create_component(colorpicker5.$$.fragment);
				t5 = space();
				create_component(colorpicker6.$$.fragment);
				t6 = space();
				create_component(colorpicker7.$$.fragment);
				t7 = space();
				create_component(colorpicker8.$$.fragment);
				t8 = space();
				create_component(colorpicker9.$$.fragment);
				t9 = space();
				div5 = element("div");
				div2 = element("div");
				div1 = element("div");
				div1.textContent = "Example Question Text";
				t11 = space();
				div3 = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t12 = space();
				div4 = element("div");
				button0 = element("button");
				button0.textContent = "Create";
				t14 = space();
				button1 = element("button");
				button1.textContent = "Cancel";
				attr(div0, "class", "pickers svelte-v66qr8");
				attr(div2, "class", "question svelte-v66qr8");
				set_style(div2, "background-color", /*theme*/ ctx[1].question.background);
				set_style(div2, "color", /*theme*/ ctx[1].question.text);
				attr(div3, "class", "options svelte-v66qr8");
				attr(button0, "class", "submit svelte-v66qr8");
				attr(button1, "class", "cancel svelte-v66qr8");
				attr(div4, "class", "buttons svelte-v66qr8");
				attr(div5, "class", "wrap svelte-v66qr8");
				attr(dialog_1, "class", "svelte-v66qr8");
			},
			m(target, anchor) {
				insert(target, dialog_1, anchor);
				append(dialog_1, div0);
				mount_component(colorpicker0, div0, null);
				append(div0, t0);
				mount_component(colorpicker1, div0, null);
				append(div0, t1);
				mount_component(colorpicker2, div0, null);
				append(div0, t2);
				mount_component(colorpicker3, div0, null);
				append(div0, t3);
				mount_component(colorpicker4, div0, null);
				append(div0, t4);
				mount_component(colorpicker5, div0, null);
				append(div0, t5);
				mount_component(colorpicker6, div0, null);
				append(div0, t6);
				mount_component(colorpicker7, div0, null);
				append(div0, t7);
				mount_component(colorpicker8, div0, null);
				append(div0, t8);
				mount_component(colorpicker9, div0, null);
				append(dialog_1, t9);
				append(dialog_1, div5);
				append(div5, div2);
				append(div2, div1);
				append(div5, t11);
				append(div5, div3);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div3, null);
					}
				}

				append(div5, t12);
				append(div5, div4);
				append(div4, button0);
				append(div4, t14);
				append(div4, button1);
				/*dialog_1_binding*/ ctx[14](dialog_1);
				current = true;

				if (!mounted) {
					dispose = [
						listen(button0, "click", /*submit*/ ctx[2]),
						listen(button1, "click", /*cancel*/ ctx[3]),
						listen(dialog_1, "close", /*cancel*/ ctx[3])
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				const colorpicker0_changes = {};

				if (!updating_color && dirty & /*theme*/ 2) {
					updating_color = true;
					colorpicker0_changes.color = /*theme*/ ctx[1].question.background;
					add_flush_callback(() => updating_color = false);
				}

				colorpicker0.$set(colorpicker0_changes);
				const colorpicker1_changes = {};

				if (!updating_color_1 && dirty & /*theme*/ 2) {
					updating_color_1 = true;
					colorpicker1_changes.color = /*theme*/ ctx[1].question.text;
					add_flush_callback(() => updating_color_1 = false);
				}

				colorpicker1.$set(colorpicker1_changes);
				const colorpicker2_changes = {};

				if (!updating_color_2 && dirty & /*theme*/ 2) {
					updating_color_2 = true;
					colorpicker2_changes.color = /*theme*/ ctx[1].palette[0].background;
					add_flush_callback(() => updating_color_2 = false);
				}

				colorpicker2.$set(colorpicker2_changes);
				const colorpicker3_changes = {};

				if (!updating_color_3 && dirty & /*theme*/ 2) {
					updating_color_3 = true;
					colorpicker3_changes.color = /*theme*/ ctx[1].palette[0].text;
					add_flush_callback(() => updating_color_3 = false);
				}

				colorpicker3.$set(colorpicker3_changes);
				const colorpicker4_changes = {};

				if (!updating_color_4 && dirty & /*theme*/ 2) {
					updating_color_4 = true;
					colorpicker4_changes.color = /*theme*/ ctx[1].palette[1].background;
					add_flush_callback(() => updating_color_4 = false);
				}

				colorpicker4.$set(colorpicker4_changes);
				const colorpicker5_changes = {};

				if (!updating_color_5 && dirty & /*theme*/ 2) {
					updating_color_5 = true;
					colorpicker5_changes.color = /*theme*/ ctx[1].palette[1].text;
					add_flush_callback(() => updating_color_5 = false);
				}

				colorpicker5.$set(colorpicker5_changes);
				const colorpicker6_changes = {};

				if (!updating_color_6 && dirty & /*theme*/ 2) {
					updating_color_6 = true;
					colorpicker6_changes.color = /*theme*/ ctx[1].palette[2].background;
					add_flush_callback(() => updating_color_6 = false);
				}

				colorpicker6.$set(colorpicker6_changes);
				const colorpicker7_changes = {};

				if (!updating_color_7 && dirty & /*theme*/ 2) {
					updating_color_7 = true;
					colorpicker7_changes.color = /*theme*/ ctx[1].palette[2].text;
					add_flush_callback(() => updating_color_7 = false);
				}

				colorpicker7.$set(colorpicker7_changes);
				const colorpicker8_changes = {};

				if (!updating_color_8 && dirty & /*theme*/ 2) {
					updating_color_8 = true;
					colorpicker8_changes.color = /*theme*/ ctx[1].palette[3].background;
					add_flush_callback(() => updating_color_8 = false);
				}

				colorpicker8.$set(colorpicker8_changes);
				const colorpicker9_changes = {};

				if (!updating_color_9 && dirty & /*theme*/ 2) {
					updating_color_9 = true;
					colorpicker9_changes.color = /*theme*/ ctx[1].palette[3].text;
					add_flush_callback(() => updating_color_9 = false);
				}

				colorpicker9.$set(colorpicker9_changes);

				if (!current || dirty & /*theme*/ 2) {
					set_style(div2, "background-color", /*theme*/ ctx[1].question.background);
				}

				if (!current || dirty & /*theme*/ 2) {
					set_style(div2, "color", /*theme*/ ctx[1].question.text);
				}

				if (dirty & /*theme*/ 2) {
					each_value = ensure_array_like({ length: 4 });
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$3(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$3(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div3, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			i(local) {
				if (current) return;
				transition_in(colorpicker0.$$.fragment, local);
				transition_in(colorpicker1.$$.fragment, local);
				transition_in(colorpicker2.$$.fragment, local);
				transition_in(colorpicker3.$$.fragment, local);
				transition_in(colorpicker4.$$.fragment, local);
				transition_in(colorpicker5.$$.fragment, local);
				transition_in(colorpicker6.$$.fragment, local);
				transition_in(colorpicker7.$$.fragment, local);
				transition_in(colorpicker8.$$.fragment, local);
				transition_in(colorpicker9.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(colorpicker0.$$.fragment, local);
				transition_out(colorpicker1.$$.fragment, local);
				transition_out(colorpicker2.$$.fragment, local);
				transition_out(colorpicker3.$$.fragment, local);
				transition_out(colorpicker4.$$.fragment, local);
				transition_out(colorpicker5.$$.fragment, local);
				transition_out(colorpicker6.$$.fragment, local);
				transition_out(colorpicker7.$$.fragment, local);
				transition_out(colorpicker8.$$.fragment, local);
				transition_out(colorpicker9.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(dialog_1);
				}

				destroy_component(colorpicker0);
				destroy_component(colorpicker1);
				destroy_component(colorpicker2);
				destroy_component(colorpicker3);
				destroy_component(colorpicker4);
				destroy_component(colorpicker5);
				destroy_component(colorpicker6);
				destroy_component(colorpicker7);
				destroy_component(colorpicker8);
				destroy_component(colorpicker9);
				destroy_each(each_blocks, detaching);
				/*dialog_1_binding*/ ctx[14](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$i($$self, $$props, $$invalidate) {
		let dialog;
		let theme = structuredClone({ ...defaultThemes[0], custom: true });
		let dispatch = createEventDispatcher();

		onMount(() => {
			document.body.appendChild(dialog);
			dialog.showModal();
		});

		function submit() {
			dispatch('submit', theme);
		}

		function cancel() {
			dispatch('submit', null);
		}

		function colorpicker0_color_binding(value) {
			if ($$self.$$.not_equal(theme.question.background, value)) {
				theme.question.background = value;
				$$invalidate(1, theme);
			}
		}

		function colorpicker1_color_binding(value) {
			if ($$self.$$.not_equal(theme.question.text, value)) {
				theme.question.text = value;
				$$invalidate(1, theme);
			}
		}

		function colorpicker2_color_binding(value) {
			if ($$self.$$.not_equal(theme.palette[0].background, value)) {
				theme.palette[0].background = value;
				$$invalidate(1, theme);
			}
		}

		function colorpicker3_color_binding(value) {
			if ($$self.$$.not_equal(theme.palette[0].text, value)) {
				theme.palette[0].text = value;
				$$invalidate(1, theme);
			}
		}

		function colorpicker4_color_binding(value) {
			if ($$self.$$.not_equal(theme.palette[1].background, value)) {
				theme.palette[1].background = value;
				$$invalidate(1, theme);
			}
		}

		function colorpicker5_color_binding(value) {
			if ($$self.$$.not_equal(theme.palette[1].text, value)) {
				theme.palette[1].text = value;
				$$invalidate(1, theme);
			}
		}

		function colorpicker6_color_binding(value) {
			if ($$self.$$.not_equal(theme.palette[2].background, value)) {
				theme.palette[2].background = value;
				$$invalidate(1, theme);
			}
		}

		function colorpicker7_color_binding(value) {
			if ($$self.$$.not_equal(theme.palette[2].text, value)) {
				theme.palette[2].text = value;
				$$invalidate(1, theme);
			}
		}

		function colorpicker8_color_binding(value) {
			if ($$self.$$.not_equal(theme.palette[3].background, value)) {
				theme.palette[3].background = value;
				$$invalidate(1, theme);
			}
		}

		function colorpicker9_color_binding(value) {
			if ($$self.$$.not_equal(theme.palette[3].text, value)) {
				theme.palette[3].text = value;
				$$invalidate(1, theme);
			}
		}

		function dialog_1_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				dialog = $$value;
				$$invalidate(0, dialog);
			});
		}

		return [
			dialog,
			theme,
			submit,
			cancel,
			colorpicker0_color_binding,
			colorpicker1_color_binding,
			colorpicker2_color_binding,
			colorpicker3_color_binding,
			colorpicker4_color_binding,
			colorpicker5_color_binding,
			colorpicker6_color_binding,
			colorpicker7_color_binding,
			colorpicker8_color_binding,
			colorpicker9_color_binding,
			dialog_1_binding
		];
	}

	class CreateTheme extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$i, create_fragment$p, safe_not_equal, {}, add_css$7);
		}
	}

	/* src\scripts\customization\customTheme\CustomTheme.svelte generated by Svelte v4.2.9 */

	function add_css$6(target) {
		append_styles(target, "svelte-1yznqq", ".createTheme.svelte-1yznqq.svelte-1yznqq{display:flex;align-items:center;justify-content:center;gap:5px}.title.svelte-1yznqq.svelte-1yznqq{position:relative;width:100%;text-align:center;display:flex;justify-content:center}.title.svelte-1yznqq>div.svelte-1yznqq{position:absolute;right:0;top:0}.theme.svelte-1yznqq.svelte-1yznqq{display:flex;flex-direction:column;align-items:center;margin:10px}.theme.selected.svelte-1yznqq.svelte-1yznqq{border:5px solid black;outline:3px solid white}.options.svelte-1yznqq.svelte-1yznqq{display:flex;flex-direction:row;align-items:center;width:100%}.option.svelte-1yznqq.svelte-1yznqq{flex-grow:1;text-align:center;margin:5px}.themeEnabled.svelte-1yznqq.svelte-1yznqq{display:flex;align-items:center;justify-content:center;margin-left:10px;margin-right:10px}.themeEnabled.svelte-1yznqq>div.svelte-1yznqq{margin-right:10px}.themeEnabled.svelte-1yznqq>input.svelte-1yznqq{width:20px;height:20px}");
	}

	function get_each_context$2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[20] = list[i];
		child_ctx[22] = i;
		return child_ctx;
	}

	function get_each_context_1$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[23] = list[i];
		child_ctx[25] = i;
		return child_ctx;
	}

	// (124:0) {#if createOpen}
	function create_if_block_1$1(ctx) {
		let createtheme;
		let current;
		createtheme = new CreateTheme({});
		createtheme.$on("submit", /*onSubmit*/ ctx[7]);

		return {
			c() {
				create_component(createtheme.$$.fragment);
			},
			m(target, anchor) {
				mount_component(createtheme, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(createtheme.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(createtheme.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(createtheme, detaching);
			}
		};
	}

	// (133:4) <Button on:click={() => createOpen = true}>
	function create_default_slot_1$4(ctx) {
		let div;
		let t;
		let pluscircleoutline;
		let current;
		pluscircleoutline = new PlusCircleOutline({ props: { width: 30, height: 30 } });

		return {
			c() {
				div = element("div");
				t = text("New Theme\r\n            ");
				create_component(pluscircleoutline.$$.fragment);
				attr(div, "class", "createTheme svelte-1yznqq");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, t);
				mount_component(pluscircleoutline, div, null);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(pluscircleoutline.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(pluscircleoutline.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_component(pluscircleoutline);
			}
		};
	}

	// (145:16) {#if theme.custom}
	function create_if_block$3(ctx) {
		let div;
		let delete_1;
		let current;
		let mounted;
		let dispose;
		delete_1 = new Delete({ props: { width: 25, height: 25 } });

		function click_handler_1() {
			return /*click_handler_1*/ ctx[11](/*theme*/ ctx[20]);
		}

		return {
			c() {
				div = element("div");
				create_component(delete_1.$$.fragment);
				attr(div, "class", "svelte-1yznqq");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				mount_component(delete_1, div, null);
				current = true;

				if (!mounted) {
					dispose = listen(div, "click", stop_propagation(click_handler_1));
					mounted = true;
				}
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
			},
			i(local) {
				if (current) return;
				transition_in(delete_1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(delete_1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_component(delete_1);
				mounted = false;
				dispose();
			}
		};
	}

	// (152:16) {#each theme.palette as color, j}
	function create_each_block_1$1(ctx) {
		let div;
		let t0_value = /*j*/ ctx[25] + 1 + "";
		let t0;
		let t1;

		return {
			c() {
				div = element("div");
				t0 = text(t0_value);
				t1 = space();
				attr(div, "class", "option svelte-1yznqq");
				set_style(div, "background-color", /*color*/ ctx[23].background);
				set_style(div, "color", /*color*/ ctx[23].text);
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, t0);
				append(div, t1);
			},
			p(ctx, dirty) {
				if (dirty & /*themes*/ 1) {
					set_style(div, "background-color", /*color*/ ctx[23].background);
				}

				if (dirty & /*themes*/ 1) {
					set_style(div, "color", /*color*/ ctx[23].text);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (139:4) {#each themes as theme, i}
	function create_each_block$2(ctx) {
		let div2;
		let div0;
		let t0;
		let t1_value = /*i*/ ctx[22] + 1 + "";
		let t1;
		let t2;
		let t3;
		let div1;
		let t4;
		let current;
		let mounted;
		let dispose;
		let if_block = /*theme*/ ctx[20].custom && create_if_block$3(ctx);
		let each_value_1 = ensure_array_like(/*theme*/ ctx[20].palette);
		let each_blocks = [];

		for (let i = 0; i < each_value_1.length; i += 1) {
			each_blocks[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
		}

		function click_handler_2() {
			return /*click_handler_2*/ ctx[12](/*theme*/ ctx[20]);
		}

		return {
			c() {
				div2 = element("div");
				div0 = element("div");
				t0 = text("Theme ");
				t1 = text(t1_value);
				t2 = space();
				if (if_block) if_block.c();
				t3 = space();
				div1 = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t4 = space();
				attr(div0, "class", "title svelte-1yznqq");
				attr(div1, "class", "options svelte-1yznqq");
				attr(div2, "class", "theme svelte-1yznqq");
				set_style(div2, "background-color", /*theme*/ ctx[20].question.background);
				set_style(div2, "color", /*theme*/ ctx[20].question.text);
				toggle_class(div2, "selected", /*selectedTheme*/ ctx[1] === /*theme*/ ctx[20]);
			},
			m(target, anchor) {
				insert(target, div2, anchor);
				append(div2, div0);
				append(div0, t0);
				append(div0, t1);
				append(div0, t2);
				if (if_block) if_block.m(div0, null);
				append(div2, t3);
				append(div2, div1);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div1, null);
					}
				}

				append(div2, t4);
				current = true;

				if (!mounted) {
					dispose = listen(div2, "click", click_handler_2);
					mounted = true;
				}
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;

				if (/*theme*/ ctx[20].custom) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty & /*themes*/ 1) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block$3(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(div0, null);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}

				if (dirty & /*themes*/ 1) {
					each_value_1 = ensure_array_like(/*theme*/ ctx[20].palette);
					let i;

					for (i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block_1$1(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(div1, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value_1.length;
				}

				if (!current || dirty & /*themes*/ 1) {
					set_style(div2, "background-color", /*theme*/ ctx[20].question.background);
				}

				if (!current || dirty & /*themes*/ 1) {
					set_style(div2, "color", /*theme*/ ctx[20].question.text);
				}

				if (!current || dirty & /*selectedTheme, themes*/ 3) {
					toggle_class(div2, "selected", /*selectedTheme*/ ctx[1] === /*theme*/ ctx[20]);
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div2);
				}

				if (if_block) if_block.d();
				destroy_each(each_blocks, detaching);
				mounted = false;
				dispose();
			}
		};
	}

	// (128:0) <Group name="Custom Theme">
	function create_default_slot$h(ctx) {
		let div1;
		let div0;
		let t1;
		let input;
		let t2;
		let button;
		let t3;
		let each_1_anchor;
		let current;
		let mounted;
		let dispose;

		button = new Button({
				props: {
					$$slots: { default: [create_default_slot_1$4] },
					$$scope: { ctx }
				}
			});

		button.$on("click", /*click_handler*/ ctx[10]);
		let each_value = ensure_array_like(/*themes*/ ctx[0]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
		}

		const out = i => transition_out(each_blocks[i], 1, 1, () => {
			each_blocks[i] = null;
		});

		return {
			c() {
				div1 = element("div");
				div0 = element("div");
				div0.textContent = "Use Custom Theme?";
				t1 = space();
				input = element("input");
				t2 = space();
				create_component(button.$$.fragment);
				t3 = space();

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_1_anchor = empty();
				attr(div0, "class", "svelte-1yznqq");
				attr(input, "type", "checkbox");
				attr(input, "class", "svelte-1yznqq");
				attr(div1, "class", "themeEnabled svelte-1yznqq");
			},
			m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, div0);
				append(div1, t1);
				append(div1, input);
				input.checked = /*themeEnabled*/ ctx[2];
				insert(target, t2, anchor);
				mount_component(button, target, anchor);
				insert(target, t3, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(target, anchor);
					}
				}

				insert(target, each_1_anchor, anchor);
				current = true;

				if (!mounted) {
					dispose = [
						listen(input, "change", /*input_change_handler*/ ctx[9]),
						listen(input, "change", /*updateEnabled*/ ctx[5])
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty & /*themeEnabled*/ 4) {
					input.checked = /*themeEnabled*/ ctx[2];
				}

				const button_changes = {};

				if (dirty & /*$$scope*/ 67108864) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);

				if (dirty & /*themes, selectedTheme, setTheme, deleteTheme*/ 323) {
					each_value = ensure_array_like(/*themes*/ ctx[0]);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$2(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
							transition_in(each_blocks[i], 1);
						} else {
							each_blocks[i] = create_each_block$2(child_ctx);
							each_blocks[i].c();
							transition_in(each_blocks[i], 1);
							each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
						}
					}

					group_outros();

					for (i = each_value.length; i < each_blocks.length; i += 1) {
						out(i);
					}

					check_outros();
				}
			},
			i(local) {
				if (current) return;
				transition_in(button.$$.fragment, local);

				for (let i = 0; i < each_value.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o(local) {
				transition_out(button.$$.fragment, local);
				each_blocks = each_blocks.filter(Boolean);

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div1);
					detach(t2);
					detach(t3);
					detach(each_1_anchor);
				}

				destroy_component(button, detaching);
				destroy_each(each_blocks, detaching);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function create_fragment$o(ctx) {
		let t;
		let group;
		let current;
		let if_block = /*createOpen*/ ctx[3] && create_if_block_1$1(ctx);

		group = new Group({
				props: {
					name: "Custom Theme",
					$$slots: { default: [create_default_slot$h] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				if (if_block) if_block.c();
				t = space();
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert(target, t, anchor);
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				if (/*createOpen*/ ctx[3]) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty & /*createOpen*/ 8) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block_1$1(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(t.parentNode, t);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}

				const group_changes = {};

				if (dirty & /*$$scope, themes, selectedTheme, createOpen, themeEnabled*/ 67108879) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}

				if (if_block) if_block.d(detaching);
				destroy_component(group, detaching);
			}
		};
	}

	const selector$1 = '[style^="opacity:"][style*="transform: translateY(0%)"]';

	function instance$h($$self, $$props, $$invalidate) {
		let $transportType;
		let { transportType } = socketManager;
		component_subscribe($$self, transportType, value => $$invalidate(14, $transportType = value));
		let themesString = getValue('customThemes');
		let themes = [];

		if (themesString) {
			themes = JSON.parse(themesString);
		} else {
			themes = defaultThemes.map(theme => ({ ...theme, custom: false }));
		}

		let questionElement = null;

		let observer = new MutationObserver(mutations => {
				for (let mutation of mutations) {
					for (let node of mutation.addedNodes) {
						if (!(node instanceof HTMLElement)) continue;
						let found;

						if ($transportType === 'colyseus') {
							found = node.querySelector(selector$1);
						} else if ($transportType === 'blueboat') {
							if (node.matches(selector$1)) {
								found = node;
							}
						}

						if (!found) continue;
						questionElement = found;
						applyTheme();
					}
				}
			});

		const attachObserver = () => {
			observer.observe(document.body, { childList: true, subtree: true });
		};

		if (!document.body) {
			window.addEventListener('DOMContentLoaded', attachObserver);
		} else {
			attachObserver();
		}

		let selectedTheme = themes[parseInt(getValue('selectedTheme', '0'))];
		let themeEnabled = getValue('themeEnabled') === 'true';

		function updateEnabled() {
			if (themeEnabled) {
				setValue('themeEnabled', 'true');
				setTheme(selectedTheme);
			} else {
				setValue('themeEnabled', 'false');
				removeTheme();
			}
		}

		function setTheme(theme) {
			$$invalidate(1, selectedTheme = theme);
			setValue('selectedTheme', themes.indexOf(theme).toString());
			if (themeEnabled) applyTheme();
		}

		function applyTheme() {
			if (!questionElement || !themeEnabled) return;
			let questionDisplay = questionElement.firstChild.firstChild.firstChild.firstChild;
			questionDisplay.style.background = selectedTheme.question.background;
			questionDisplay.style.color = selectedTheme.question.text;

			for (let i = 0; i < questionElement.children[1].children.length; i++) {
				let option = questionElement.children[1].children[i];
				let optionDisplay = option.firstChild;
				optionDisplay.style.background = selectedTheme.palette[i].background;
				optionDisplay.style.color = selectedTheme.palette[i].text;
			}
		}

		function removeTheme() {
			if (!questionElement) return;
			let questionDisplay = questionElement.firstChild.firstChild.firstChild.firstChild;
			questionDisplay.style.background = '';
			questionDisplay.style.color = '';

			for (let i = 0; i < questionElement.children[1].children.length; i++) {
				let option = questionElement.children[1].children[i];
				let optionDisplay = option.firstChild;
				optionDisplay.style.background = '';
				optionDisplay.style.color = '';
			}
		}

		let createOpen = false;

		function onSubmit(message) {
			$$invalidate(3, createOpen = false);
			if (!message.detail) return;
			$$invalidate(1, selectedTheme = message.detail);
			$$invalidate(0, themes = [message.detail, ...themes]);
			setValue('selectedTheme', '0');
			setValue('customThemes', JSON.stringify(themes));
			applyTheme();
		}

		function deleteTheme(theme) {
			let res = confirm('Are you sure you want to delete this theme?');
			if (!res) return;
			let index = themes.indexOf(theme);
			themes.splice(index, 1);
			setValue('customThemes', JSON.stringify(themes));

			if (theme === selectedTheme) {
				$$invalidate(1, selectedTheme = themes[0]);
				setValue('selectedTheme', '0');
				applyTheme();
			}

			$$invalidate(0, themes); // rerender
		}

		function input_change_handler() {
			themeEnabled = this.checked;
			$$invalidate(2, themeEnabled);
		}

		const click_handler = () => $$invalidate(3, createOpen = true);
		const click_handler_1 = theme => deleteTheme(theme);
		const click_handler_2 = theme => setTheme(theme);

		return [
			themes,
			selectedTheme,
			themeEnabled,
			createOpen,
			transportType,
			updateEnabled,
			setTheme,
			onSubmit,
			deleteTheme,
			input_change_handler,
			click_handler,
			click_handler_1,
			click_handler_2
		];
	}

	class CustomTheme extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$h, create_fragment$o, safe_not_equal, {}, add_css$6);
		}
	}

	/* src\scripts\2d\PlayerHighlighter.svelte generated by Svelte v4.2.9 */

	const { window: window_1 } = globals;

	function add_css$5(target) {
		append_styles(target, "svelte-gt58ph", "canvas.svelte-gt58ph{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none}");
	}

	// (71:0) <Group name="Player Highlighter">
	function create_default_slot$g(ctx) {
		let togglebutton0;
		let updating_enabled;
		let t;
		let togglebutton1;
		let updating_enabled_1;
		let current;

		function togglebutton0_enabled_binding(value) {
			/*togglebutton0_enabled_binding*/ ctx[6](value);
		}

		let togglebutton0_props = {
			onText: "Stop highlighting teammates",
			offText: "Highlight Teammates",
			hotkeyId: "highlightTeammates"
		};

		if (/*highlightTeammates*/ ctx[1] !== void 0) {
			togglebutton0_props.enabled = /*highlightTeammates*/ ctx[1];
		}

		togglebutton0 = new ToggleButton({ props: togglebutton0_props });
		binding_callbacks.push(() => bind(togglebutton0, 'enabled', togglebutton0_enabled_binding));
		togglebutton0.$on("click", /*render*/ ctx[4]);

		function togglebutton1_enabled_binding(value) {
			/*togglebutton1_enabled_binding*/ ctx[7](value);
		}

		let togglebutton1_props = {
			onText: "Stop highlighting enemies",
			offText: "Highlight Enemies",
			hotkeyId: "highlightEnemies"
		};

		if (/*highlightEnemies*/ ctx[2] !== void 0) {
			togglebutton1_props.enabled = /*highlightEnemies*/ ctx[2];
		}

		togglebutton1 = new ToggleButton({ props: togglebutton1_props });
		binding_callbacks.push(() => bind(togglebutton1, 'enabled', togglebutton1_enabled_binding));
		togglebutton1.$on("click", /*render*/ ctx[4]);

		return {
			c() {
				create_component(togglebutton0.$$.fragment);
				t = space();
				create_component(togglebutton1.$$.fragment);
			},
			m(target, anchor) {
				mount_component(togglebutton0, target, anchor);
				insert(target, t, anchor);
				mount_component(togglebutton1, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const togglebutton0_changes = {};

				if (!updating_enabled && dirty & /*highlightTeammates*/ 2) {
					updating_enabled = true;
					togglebutton0_changes.enabled = /*highlightTeammates*/ ctx[1];
					add_flush_callback(() => updating_enabled = false);
				}

				togglebutton0.$set(togglebutton0_changes);
				const togglebutton1_changes = {};

				if (!updating_enabled_1 && dirty & /*highlightEnemies*/ 4) {
					updating_enabled_1 = true;
					togglebutton1_changes.enabled = /*highlightEnemies*/ ctx[2];
					add_flush_callback(() => updating_enabled_1 = false);
				}

				togglebutton1.$set(togglebutton1_changes);
			},
			i(local) {
				if (current) return;
				transition_in(togglebutton0.$$.fragment, local);
				transition_in(togglebutton1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(togglebutton0.$$.fragment, local);
				transition_out(togglebutton1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}

				destroy_component(togglebutton0, detaching);
				destroy_component(togglebutton1, detaching);
			}
		};
	}

	function create_fragment$n(ctx) {
		let canvas_1;
		let t;
		let group;
		let current;
		let mounted;
		let dispose;

		group = new Group({
				props: {
					name: "Player Highlighter",
					$$slots: { default: [create_default_slot$g] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				canvas_1 = element("canvas");
				t = space();
				create_component(group.$$.fragment);
				attr(canvas_1, "width", window.innerWidth);
				attr(canvas_1, "height", window.innerHeight);
				attr(canvas_1, "class", "svelte-gt58ph");
			},
			m(target, anchor) {
				insert(target, canvas_1, anchor);
				/*canvas_1_binding*/ ctx[5](canvas_1);
				insert(target, t, anchor);
				mount_component(group, target, anchor);
				current = true;

				if (!mounted) {
					dispose = listen(window_1, "resize", /*onResize*/ ctx[3]);
					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope, highlightEnemies, highlightTeammates*/ 1030) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(canvas_1);
					detach(t);
				}

				/*canvas_1_binding*/ ctx[5](null);
				destroy_component(group, detaching);
				mounted = false;
				dispose();
			}
		};
	}

	function instance$g($$self, $$props, $$invalidate) {
		let ctx;
		let $playerId;
		component_subscribe($$self, playerId, $$value => $$invalidate(9, $playerId = $$value));
		let canvas;

		function onResize() {
			$$invalidate(0, canvas.width = window.innerWidth, canvas);
			$$invalidate(0, canvas.height = window.innerHeight, canvas);
		}

		let highlightTeammates = false;
		let highlightEnemies = false;

		function render() {
			if (!serializer?.state?.characters || !ctx) return;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			if (!highlightTeammates && !highlightEnemies) return;
			let camera = getUnsafeWindow()?.stores?.phaser?.scene?.cameras?.cameras[0];
			let player = serializer.state.characters.$items.get($playerId);
			if (!player || !camera) return;
			let camX = camera.midPoint.x;
			let camY = camera.midPoint.y;

			for (let [id, character] of serializer.state.characters.$items) {
				if (id === $playerId) continue;
				let isTeammate = player.teamId === character.teamId;
				if (isTeammate && !highlightTeammates) continue;
				if (!isTeammate && !highlightEnemies) continue;

				// get the angle between the player and the character
				let angle = Math.atan2(character.y - camY, character.x - camX);

				let distance = Math.sqrt(Math.pow(character.x - camX, 2) + Math.pow(character.y - camY, 2)) * camera.zoom;
				let arrowDist = Math.min(250, distance);
				let arrowTipX = Math.cos(angle) * arrowDist + canvas.width / 2;
				let arrowTipY = Math.sin(angle) * arrowDist + canvas.height / 2;
				let leftAngle = angle + Math.PI / 4 * 3;
				let rightAngle = angle - Math.PI / 4 * 3;

				// draw an arrow pointing to the character
				ctx.beginPath();

				ctx.moveTo(arrowTipX, arrowTipY);
				ctx.lineTo(arrowTipX + Math.cos(leftAngle) * 50, arrowTipY + Math.sin(leftAngle) * 50);
				ctx.moveTo(arrowTipX, arrowTipY);
				ctx.lineTo(arrowTipX + Math.cos(rightAngle) * 50, arrowTipY + Math.sin(rightAngle) * 50);
				ctx.lineWidth = 3;
				ctx.strokeStyle = isTeammate ? "green" : "red";
				ctx.stroke();

				// draw the character's name and distance
				ctx.fillStyle = "black";

				ctx.font = "20px Verdana";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(`${character.name} (${Math.floor(distance)})`, arrowTipX, arrowTipY);
			}
		}

		onMount(() => {
			document.body.appendChild(canvas);
		});

		setInterval(render, 1000 / 30);

		function canvas_1_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				canvas = $$value;
				$$invalidate(0, canvas);
			});
		}

		function togglebutton0_enabled_binding(value) {
			highlightTeammates = value;
			$$invalidate(1, highlightTeammates);
		}

		function togglebutton1_enabled_binding(value) {
			highlightEnemies = value;
			$$invalidate(2, highlightEnemies);
		}

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*canvas*/ 1) {
				ctx = canvas?.getContext("2d");
			}
		};

		return [
			canvas,
			highlightTeammates,
			highlightEnemies,
			onResize,
			render,
			canvas_1_binding,
			togglebutton0_enabled_binding,
			togglebutton1_enabled_binding
		];
	}

	class PlayerHighlighter extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$g, create_fragment$n, safe_not_equal, {}, add_css$5);
		}
	}

	/* src\hud\components\Slider.svelte generated by Svelte v4.2.9 */

	function add_css$4(target) {
		append_styles(target, "svelte-vkb13i", ".sliderWrap.svelte-vkb13i{display:flex;flex-direction:column;align-items:center;margin:5px 10px}.sliderWrap.disabled.svelte-vkb13i{opacity:0.5}input.svelte-vkb13i{flex-grow:1;width:100%}input[disabled].svelte-vkb13i{cursor:not-allowed}");
	}

	function create_fragment$m(ctx) {
		let div1;
		let div0;
		let t0;
		let t1;
		let input_1;
		let input_1_title_value;
		let input_1_disabled_value;
		let mounted;
		let dispose;

		return {
			c() {
				div1 = element("div");
				div0 = element("div");
				t0 = text(/*title*/ ctx[1]);
				t1 = space();
				input_1 = element("input");
				attr(input_1, "type", "range");
				attr(input_1, "min", /*min*/ ctx[2]);
				attr(input_1, "max", /*max*/ ctx[3]);
				attr(input_1, "step", /*step*/ ctx[4]);
				attr(input_1, "title", input_1_title_value = /*disabled*/ ctx[5] ? /*disabledMsg*/ ctx[6] : undefined);
				input_1.disabled = input_1_disabled_value = /*disabled*/ ctx[5] === true || /*disabled*/ ctx[5] === undefined;
				attr(input_1, "class", "svelte-vkb13i");
				attr(div1, "class", "sliderWrap svelte-vkb13i");
				toggle_class(div1, "disabled", /*disabled*/ ctx[5] === true || /*disabled*/ ctx[5] === undefined);
			},
			m(target, anchor) {
				insert(target, div1, anchor);
				append(div1, div0);
				append(div0, t0);
				append(div1, t1);
				append(div1, input_1);
				set_input_value(input_1, /*value*/ ctx[0]);
				/*input_1_binding*/ ctx[12](input_1);

				if (!mounted) {
					dispose = [
						listen(input_1, "change", /*input_1_change_input_handler*/ ctx[11]),
						listen(input_1, "input", /*input_1_change_input_handler*/ ctx[11]),
						listen(input_1, "mousedown", stop_propagation(/*mousedown_handler*/ ctx[9])),
						listen(input_1, "keydown", prevent_default(/*keydown_handler*/ ctx[10])),
						listen(input_1, "input", /*onInput*/ ctx[8])
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*title*/ 2) set_data(t0, /*title*/ ctx[1]);

				if (dirty & /*min*/ 4) {
					attr(input_1, "min", /*min*/ ctx[2]);
				}

				if (dirty & /*max*/ 8) {
					attr(input_1, "max", /*max*/ ctx[3]);
				}

				if (dirty & /*step*/ 16) {
					attr(input_1, "step", /*step*/ ctx[4]);
				}

				if (dirty & /*disabled, disabledMsg*/ 96 && input_1_title_value !== (input_1_title_value = /*disabled*/ ctx[5] ? /*disabledMsg*/ ctx[6] : undefined)) {
					attr(input_1, "title", input_1_title_value);
				}

				if (dirty & /*disabled*/ 32 && input_1_disabled_value !== (input_1_disabled_value = /*disabled*/ ctx[5] === true || /*disabled*/ ctx[5] === undefined)) {
					input_1.disabled = input_1_disabled_value;
				}

				if (dirty & /*value*/ 1) {
					set_input_value(input_1, /*value*/ ctx[0]);
				}

				if (dirty & /*disabled, undefined*/ 32) {
					toggle_class(div1, "disabled", /*disabled*/ ctx[5] === true || /*disabled*/ ctx[5] === undefined);
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(div1);
				}

				/*input_1_binding*/ ctx[12](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$f($$self, $$props, $$invalidate) {
		let { title } = $$props;
		let { min } = $$props;
		let { max } = $$props;
		let { value = (min + max) / 2 } = $$props;
		let { step = 1 } = $$props;
		let { disabled = null } = $$props;
		let { disabledMsg = undefined } = $$props;
		let dispatch = createEventDispatcher();
		let input;

		function onInput() {
			dispatch("input", parseFloat(input.value));
		}

		function mousedown_handler(event) {
			bubble.call(this, $$self, event);
		}

		function keydown_handler(event) {
			bubble.call(this, $$self, event);
		}

		function input_1_change_input_handler() {
			value = to_number(this.value);
			$$invalidate(0, value);
		}

		function input_1_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				input = $$value;
				$$invalidate(7, input);
			});
		}

		$$self.$$set = $$props => {
			if ('title' in $$props) $$invalidate(1, title = $$props.title);
			if ('min' in $$props) $$invalidate(2, min = $$props.min);
			if ('max' in $$props) $$invalidate(3, max = $$props.max);
			if ('value' in $$props) $$invalidate(0, value = $$props.value);
			if ('step' in $$props) $$invalidate(4, step = $$props.step);
			if ('disabled' in $$props) $$invalidate(5, disabled = $$props.disabled);
			if ('disabledMsg' in $$props) $$invalidate(6, disabledMsg = $$props.disabledMsg);
		};

		return [
			value,
			title,
			min,
			max,
			step,
			disabled,
			disabledMsg,
			input,
			onInput,
			mousedown_handler,
			keydown_handler,
			input_1_change_input_handler,
			input_1_binding
		];
	}

	class Slider extends SvelteComponent {
		constructor(options) {
			super();

			init(
				this,
				options,
				instance$f,
				create_fragment$m,
				safe_not_equal,
				{
					title: 1,
					min: 2,
					max: 3,
					value: 0,
					step: 4,
					disabled: 5,
					disabledMsg: 6
				},
				add_css$4
			);
		}
	}

	/* src\scripts\2d\Freecam.svelte generated by Svelte v4.2.9 */

	function add_css$3(target) {
		append_styles(target, "svelte-oqtmhy", "select.svelte-oqtmhy{width:calc(100% - 10px);padding:5px;margin-left:5px;margin-right:5px;color:black}select[disabled].svelte-oqtmhy{cursor:not-allowed}");
	}

	function get_each_context$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[20] = list[i];
		return child_ctx;
	}

	// (133:8) {:else}
	function create_else_block$1(ctx) {
		let t0_value = (/*freecamming*/ ctx[1] ? "Stop" : "Start") + "";
		let t0;
		let t1;

		return {
			c() {
				t0 = text(t0_value);
				t1 = text(" Freecam");
			},
			m(target, anchor) {
				insert(target, t0, anchor);
				insert(target, t1, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*freecamming*/ 2 && t0_value !== (t0_value = (/*freecamming*/ ctx[1] ? "Stop" : "Start") + "")) set_data(t0, t0_value);
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
				}
			}
		};
	}

	// (131:8) {#if spectating}
	function create_if_block$2(ctx) {
		let t;

		return {
			c() {
				t = text("Stop Spectating");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (129:4) <Button disabled={!$storesLoaded} disabledMsg="Camera hasn't loaded"      on:click={onBtnClick}>
	function create_default_slot_1$3(ctx) {
		let if_block_anchor;

		function select_block_type(ctx, dirty) {
			if (/*spectating*/ ctx[4]) return create_if_block$2;
			return create_else_block$1;
		}

		let current_block_type = select_block_type(ctx);
		let if_block = current_block_type(ctx);

		return {
			c() {
				if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
			},
			p(ctx, dirty) {
				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block.d(1);
					if_block = current_block_type(ctx);

					if (if_block) {
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				}
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if_block.d(detaching);
			}
		};
	}

	// (143:8) {#each specCharacters as char}
	function create_each_block$1(ctx) {
		let option;
		let t_value = /*char*/ ctx[20].name + "";
		let t;
		let option_value_value;

		return {
			c() {
				option = element("option");
				t = text(t_value);
				option.__value = option_value_value = /*char*/ ctx[20].id;
				set_input_value(option, option.__value);
			},
			m(target, anchor) {
				insert(target, option, anchor);
				append(option, t);
			},
			p(ctx, dirty) {
				if (dirty & /*specCharacters*/ 8 && t_value !== (t_value = /*char*/ ctx[20].name + "")) set_data(t, t_value);

				if (dirty & /*specCharacters*/ 8 && option_value_value !== (option_value_value = /*char*/ ctx[20].id)) {
					option.__value = option_value_value;
					set_input_value(option, option.__value);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(option);
				}
			}
		};
	}

	// (128:0) <Group name="Freecam">
	function create_default_slot$f(ctx) {
		let button;
		let t0;
		let slider;
		let t1;
		let select_1;
		let option;
		let select_1_disabled_value;
		let select_1_title_value;
		let current;
		let mounted;
		let dispose;

		button = new Button({
				props: {
					disabled: !/*$storesLoaded*/ ctx[5],
					disabledMsg: "Camera hasn't loaded",
					$$slots: { default: [create_default_slot_1$3] },
					$$scope: { ctx }
				}
			});

		button.$on("click", /*onBtnClick*/ ctx[9]);

		slider = new Slider({
				props: {
					title: "Camera Zoom",
					min: 0.1,
					max: 5,
					step: 0.1,
					disabled: !/*$storesLoaded*/ ctx[5],
					value: /*zoomValue*/ ctx[2],
					disabledMsg: "Camera hasn't loaded"
				}
			});

		slider.$on("input", /*setZoom*/ ctx[8]);
		let each_value = ensure_array_like(/*specCharacters*/ ctx[3]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
		}

		return {
			c() {
				create_component(button.$$.fragment);
				t0 = space();
				create_component(slider.$$.fragment);
				t1 = space();
				select_1 = element("select");
				option = element("option");
				option.textContent = "Pick a player to spectate";

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				option.__value = "";
				set_input_value(option, option.__value);
				option.selected = true;
				select_1.disabled = select_1_disabled_value = /*specCharacters*/ ctx[3].length === 0;

				attr(select_1, "title", select_1_title_value = /*specCharacters*/ ctx[3].length === 0
				? "No characters to spectate"
				: undefined);

				attr(select_1, "class", "svelte-oqtmhy");
			},
			m(target, anchor) {
				mount_component(button, target, anchor);
				insert(target, t0, anchor);
				mount_component(slider, target, anchor);
				insert(target, t1, anchor);
				insert(target, select_1, anchor);
				append(select_1, option);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(select_1, null);
					}
				}

				/*select_1_binding*/ ctx[12](select_1);
				current = true;

				if (!mounted) {
					dispose = [
						listen(select_1, "change", /*selectPlayer*/ ctx[10]),
						listen(select_1, "keydown", prevent_default(/*keydown_handler*/ ctx[11]))
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				const button_changes = {};
				if (dirty & /*$storesLoaded*/ 32) button_changes.disabled = !/*$storesLoaded*/ ctx[5];

				if (dirty & /*$$scope, spectating, freecamming*/ 8388626) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);
				const slider_changes = {};
				if (dirty & /*$storesLoaded*/ 32) slider_changes.disabled = !/*$storesLoaded*/ ctx[5];
				if (dirty & /*zoomValue*/ 4) slider_changes.value = /*zoomValue*/ ctx[2];
				slider.$set(slider_changes);

				if (dirty & /*specCharacters*/ 8) {
					each_value = ensure_array_like(/*specCharacters*/ ctx[3]);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$1(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$1(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select_1, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}

				if (!current || dirty & /*specCharacters*/ 8 && select_1_disabled_value !== (select_1_disabled_value = /*specCharacters*/ ctx[3].length === 0)) {
					select_1.disabled = select_1_disabled_value;
				}

				if (!current || dirty & /*specCharacters*/ 8 && select_1_title_value !== (select_1_title_value = /*specCharacters*/ ctx[3].length === 0
				? "No characters to spectate"
				: undefined)) {
					attr(select_1, "title", select_1_title_value);
				}
			},
			i(local) {
				if (current) return;
				transition_in(button.$$.fragment, local);
				transition_in(slider.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button.$$.fragment, local);
				transition_out(slider.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(select_1);
				}

				destroy_component(button, detaching);
				destroy_component(slider, detaching);
				destroy_each(each_blocks, detaching);
				/*select_1_binding*/ ctx[12](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function create_fragment$l(ctx) {
		let group;
		let current;
		let mounted;
		let dispose;

		group = new Group({
				props: {
					name: "Freecam",
					$$slots: { default: [create_default_slot$f] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;

				if (!mounted) {
					dispose = [
						listen(window, "keydown", /*onKeydown*/ ctx[6]),
						listen(window, "keyup", /*onKeyup*/ ctx[7])
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope, specCharacters, select, $storesLoaded, zoomValue, spectating, freecamming*/ 8388671) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$e($$self, $$props, $$invalidate) {
		let $playerId;
		let $storesLoaded;
		component_subscribe($$self, playerId, $$value => $$invalidate(15, $playerId = $$value));
		component_subscribe($$self, storesLoaded, $$value => $$invalidate(5, $storesLoaded = $$value));
		let keys = new Set();
		let select;
		let freecamming = false;

		function onKeydown(event) {
			if (!event.key.startsWith("Arrow")) return;

			// Prevent arrow keys from moving the character
			if (freecamming) {
				event.stopImmediatePropagation();
			}

			keys.add(event.key);
		}

		function onKeyup(event) {
			keys.delete(event.key);
		}

		let freecamPos = { x: 0, y: 0 };
		let freecamUpdateInterval;
		let zoomValue = 1;

		function startFreecam() {
			let scene = getUnsafeWindow().stores.phaser.scene;
			let camera = scene.cameras.cameras[0];
			scene.cameraHelper.stopFollow();

			freecamPos = {
				x: camera.midPoint.x,
				y: camera.midPoint.y
			};

			camera.useBounds = false;

			freecamUpdateInterval = setInterval(
				() => {
					let freecamSpeed = 20 / zoomValue * 1.75;
					if (keys.has("ArrowUp")) freecamPos.y -= freecamSpeed;
					if (keys.has("ArrowDown")) freecamPos.y += freecamSpeed;
					if (keys.has("ArrowLeft")) freecamPos.x -= freecamSpeed;
					if (keys.has("ArrowRight")) freecamPos.x += freecamSpeed;
					scene.cameraHelper.goTo(freecamPos);
				},
				1000 / 30
			);
		}

		function stopFreecam() {
			let phaser = getUnsafeWindow().stores.phaser;
			let charObj = phaser.scene.characterManager.characters.get(phaser.mainCharacter.id).body;
			phaser.scene.cameraHelper.startFollowingObject({ object: charObj });
			phaser.scene.cameras.cameras[0].useBounds = true;
			clearInterval(freecamUpdateInterval);
		}

		storesLoaded.subscribe(loaded => {
			if (!loaded) return;

			let getZoomInterval = setInterval(
				() => {
					let zoom = getUnsafeWindow()?.stores?.phaser?.scene?.cameras?.cameras[0]?.zoom;

					if (zoom) {
						$$invalidate(2, zoomValue = zoom);
						clearInterval(getZoomInterval);
					}
				},
				50
			);
		});

		function setZoom(event) {
			$$invalidate(2, zoomValue = event.detail);
			getUnsafeWindow().stores.phaser.scene.cameras.cameras[0].setZoom(event.detail);
		}

		let specCharacters = [];
		let unbinds = [];

		playerId.subscribe(id => {
			$$invalidate(3, specCharacters = specCharacters.filter(char => char.id !== id));
		});

		serializer.addEventListener("load", () => {
			const reloadCharacters = () => {
				$$invalidate(3, specCharacters = []);
				for (let unbind of unbinds) unbind();

				for (let [id, char] of serializer.state.characters.$items) {
					if (!char.isActive || id === $playerId) continue;
					specCharacters.push({ id, name: char.name });

					let unbind = char.listen("isActive", (_, prevVal) => {
						if (prevVal === undefined) return;
						reloadCharacters();
					});

					unbinds.push(unbind);
				}
			};

			serializer.state.characters.onChange(reloadCharacters);
			reloadCharacters();
		});

		let spectating = false;

		function onBtnClick() {
			if (spectating) {
				$$invalidate(4, spectating = false);
				stopFreecam();
				$$invalidate(0, select.value = "", select);
			} else {
				$$invalidate(1, freecamming = !freecamming);
				if (freecamming) startFreecam(); else stopFreecam();
			}
		}

		function selectPlayer() {
			if (!select.value) return;
			$$invalidate(4, spectating = true);
			$$invalidate(1, freecamming = false);
			stopFreecam();
			let char = getUnsafeWindow().stores.phaser.scene.characterManager.characters.get(select.value);
			if (!char) return;
			let camHelper = getUnsafeWindow().stores.phaser.scene.cameraHelper;
			camHelper.startFollowingObject({ object: char.body });
		}

		function keydown_handler(event) {
			bubble.call(this, $$self, event);
		}

		function select_1_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				select = $$value;
				$$invalidate(0, select);
				$$invalidate(3, specCharacters);
			});
		}

		return [
			select,
			freecamming,
			zoomValue,
			specCharacters,
			spectating,
			$storesLoaded,
			onKeydown,
			onKeyup,
			setZoom,
			onBtnClick,
			selectPlayer,
			keydown_handler,
			select_1_binding
		];
	}

	class Freecam extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$e, create_fragment$l, safe_not_equal, {}, add_css$3);
		}
	}

	/* src\scripts\2d\HideEnergyPopup.svelte generated by Svelte v4.2.9 */

	function create_fragment$k(ctx) {
		let togglebutton;
		let current;

		togglebutton = new ToggleButton({
				props: {
					onText: "Show Energy Popup",
					offText: "Hide Energy Popup",
					hotkeyId: "toggleEnergyPopup"
				}
			});

		togglebutton.$on("click", /*toggleEnergyPopup*/ ctx[0]);

		return {
			c() {
				create_component(togglebutton.$$.fragment);
			},
			m(target, anchor) {
				mount_component(togglebutton, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(togglebutton.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(togglebutton.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(togglebutton, detaching);
			}
		};
	}

	function instance$d($$self) {
		let popupEl;
		let hiding = false;

		let observer = new MutationObserver(mutations => {
				for (let mutation of mutations) {
					for (let node of mutation.addedNodes) {
						if (node.nodeType != Node.ELEMENT_NODE) continue;

						// check that the element is the energy popup
						if (node.matches(".maxAll.flex.hc") && node.querySelector("img[src^='/assets/map/inventory/resources/']")) {
							popupEl = node;
							if (hiding) popupEl.style.display = "none";
						}
					}
				}
			});

		const attach = () => {
			observer.observe(document.body, { childList: true, subtree: true });
		};

		if (document.body) attach(); else window.addEventListener("DOMContentLoaded", attach);

		function toggleEnergyPopup(event) {
			hiding = event.detail;
			if (!popupEl) return;
			popupEl.style.display = hiding ? "none" : "";
		}

		return [toggleEnergyPopup];
	}

	class HideEnergyPopup extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$d, create_fragment$k, safe_not_equal, {});
		}
	}

	/* src\scripts\classic\AutoPurchase.svelte generated by Svelte v4.2.9 */

	function create_default_slot$e(ctx) {
		let togglebutton;
		let current;

		togglebutton = new ToggleButton({
				props: {
					onText: "Stop auto purchasing",
					offText: "Auto Purchase Upgrades",
					hotkeyId: "classicAutoPurchase",
					disabled: /*money*/ ctx[0] == null,
					disabledMsg: "Money hasn't loaded yet"
				}
			});

		togglebutton.$on("click", /*onClick*/ ctx[1]);

		return {
			c() {
				create_component(togglebutton.$$.fragment);
			},
			m(target, anchor) {
				mount_component(togglebutton, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const togglebutton_changes = {};
				if (dirty & /*money*/ 1) togglebutton_changes.disabled = /*money*/ ctx[0] == null;
				togglebutton.$set(togglebutton_changes);
			},
			i(local) {
				if (current) return;
				transition_in(togglebutton.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(togglebutton.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(togglebutton, detaching);
			}
		};
	}

	function create_fragment$j(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "Classic",
					$$slots: { default: [create_default_slot$e] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope, money*/ 257) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	function instance$c($$self, $$props, $$invalidate) {
		const upgradesToGet = [
			["Streak Bonus", 2, 20],
			["Money Per Question", 3, 100],
			["Streak Bonus", 3, 200],
			["Multiplier", 3, 300],
			["Streak Bonus", 4, 2e3],
			["Multiplier", 4, 2e3],
			["Money Per Question", 5, 1e4],
			["Streak Bonus", 5, 2e4],
			["Multiplier", 5, 12e3],
			["Money Per Question", 6, 75e3],
			["Multiplier", 6, 85e3],
			["Streak Bonus", 6, 2e5],
			["Streak Bonus", 7, 2e6],
			["Streak Bonus", 8, 2e7],
			["Multiplier", 7, 7e5],
			["Money Per Question", 9, 1e7],
			["Multiplier", 8, 65e5],
			["Streak Bonus", 9, 2e8],
			["Multiplier", 9, 65e6],
			["Streak Bonus", 10, 2e9],
			["Money Per Question", 10, 1e8],
			["Multiplier", 10, 1e9]
		];

		var UpgradeType;

		(function (UpgradeType) {
			UpgradeType["Insurance"] = "insurance";
			UpgradeType["Money Per Question"] = "moneyPerQuestion";
			UpgradeType["Multiplier"] = "multiplier";
			UpgradeType["Streak Bonus"] = "streakBonus";
		})(UpgradeType || (UpgradeType = {}));

		let money = null;
		let upgradeLevels = {};
		let autoBuy = false;

		socketManager.addEventListener("blueboatMessage", e => {
			if (e.detail.data?.type == "UPGRADE_LEVELS") {
				upgradeLevels = e.detail.data.value;

				// delete any upgrades that we already have
				for (let i = 0; i < upgradesToGet.length; i++) {
					let upgrade = upgradesToGet[i];

					// check if we have the upgrade
					let upgradeAmount = upgradeLevels[UpgradeType[upgrade[0]]];

					if (upgradeAmount >= upgrade[1]) {
						upgradesToGet.splice(i, 1);
						i--;
					}
				}
			}

			if (e.detail.data?.type == "BALANCE") {
				$$invalidate(0, money = e.detail.data.value);
				checkAutoBuy();
			}
		});

		function checkAutoBuy() {
			if (!autoBuy) return;
			let upgrade = upgradesToGet[0];
			if (!upgrade) return;

			if (money >= upgrade[2]) {
				purchaseUpgrade(upgrade[0], upgrade[1]);
			}
		}

		function purchaseUpgrade(name, level) {
			socketManager.sendMessage("UPGRADE_PURCHASED", { upgradeName: name, level });
		}

		function onClick(message) {
			if (message.detail) {
				autoBuy = true;
				checkAutoBuy();
			} else {
				autoBuy = false;
			}
		}

		return [money, onClick];
	}

	let AutoPurchase$1 = class AutoPurchase extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$c, create_fragment$j, safe_not_equal, {});
		}
	};

	/* src\scripts\superRichMode\AutoPurchase.svelte generated by Svelte v4.2.9 */

	function create_default_slot$d(ctx) {
		let togglebutton;
		let current;

		togglebutton = new ToggleButton({
				props: {
					onText: "Stop auto purchasing",
					offText: "Auto Purchase Upgrades",
					hotkeyId: "richModeAutoPurchase",
					disabled: /*money*/ ctx[0] == null,
					disabledMsg: "Money hasn't loaded yet"
				}
			});

		togglebutton.$on("click", /*onClick*/ ctx[1]);

		return {
			c() {
				create_component(togglebutton.$$.fragment);
			},
			m(target, anchor) {
				mount_component(togglebutton, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const togglebutton_changes = {};
				if (dirty & /*money*/ 1) togglebutton_changes.disabled = /*money*/ ctx[0] == null;
				togglebutton.$set(togglebutton_changes);
			},
			i(local) {
				if (current) return;
				transition_in(togglebutton.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(togglebutton.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(togglebutton, detaching);
			}
		};
	}

	function create_fragment$i(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "Super Rich Mode",
					$$slots: { default: [create_default_slot$d] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope, money*/ 257) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	function instance$b($$self, $$props, $$invalidate) {
		const upgradesToGet = [
			["Streak Bonus", 2, 1e4],
			["Money Per Question", 3, 5e3],
			["Streak Bonus", 3, 1e5],
			["Multiplier", 3, 15e4],
			["Streak Bonus", 4, 1e6],
			["Multiplier", 4, 1e6],
			["Money Per Question", 5, 5e6],
			["Streak Bonus", 5, 1e7],
			["Multiplier", 5, 6e6],
			["Money Per Question", 6, 375e5],
			["Multiplier", 6, 425e5],
			["Streak Bonus", 6, 1e8],
			["Streak Bonus", 7, 1e9],
			["Streak Bonus", 8, 1e10],
			["Multiplier", 7, 35e7],
			["Money Per Question", 9, 5e9],
			["Multiplier", 8, 325e7],
			["Streak Bonus", 9, 1e11],
			["Multiplier", 9, 325e8],
			["Streak Bonus", 10, 1e12],
			["Money Per Question", 10, 5e10],
			["Multiplier", 10, 5e11]
		];

		var UpgradeType;

		(function (UpgradeType) {
			UpgradeType["Insurance"] = "insurance";
			UpgradeType["Money Per Question"] = "moneyPerQuestion";
			UpgradeType["Multiplier"] = "multiplier";
			UpgradeType["Streak Bonus"] = "streakBonus";
		})(UpgradeType || (UpgradeType = {}));

		let money = null;
		let upgradeLevels = {};
		let autoBuy = false;

		socketManager.addEventListener("blueboatMessage", e => {
			if (e.detail.data?.type == "UPGRADE_LEVELS") {
				upgradeLevels = e.detail.data.value;

				// delete any upgrades that we already have
				for (let i = 0; i < upgradesToGet.length; i++) {
					let upgrade = upgradesToGet[i];

					// check if we have the upgrade
					let upgradeAmount = upgradeLevels[UpgradeType[upgrade[0]]];

					if (upgradeAmount >= upgrade[1]) {
						upgradesToGet.splice(i, 1);
						i--;
					}
				}
			}

			if (e.detail.data?.type == "BALANCE") {
				$$invalidate(0, money = e.detail.data.value);
				checkAutoBuy();
			}
		});

		function checkAutoBuy() {
			if (!autoBuy) return;
			let upgrade = upgradesToGet[0];
			if (!upgrade) return;

			if (money >= upgrade[2]) {
				purchaseUpgrade(upgrade[0], upgrade[1]);
			}
		}

		function purchaseUpgrade(name, level) {
			socketManager.sendMessage("UPGRADE_PURCHASED", { upgradeName: name, level });
		}

		function onClick(message) {
			if (message.detail) {
				autoBuy = true;
				checkAutoBuy();
			} else {
				autoBuy = false;
			}
		}

		return [money, onClick];
	}

	class AutoPurchase extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$b, create_fragment$i, safe_not_equal, {});
		}
	}

	/* src\scripts\trustNoOne\ShowImposters.svelte generated by Svelte v4.2.9 */

	function add_css$2(target) {
		append_styles(target, "svelte-1h3d0lh", "div.svelte-1h3d0lh{padding-left:10px;padding-right:10px}");
	}

	// (12:0) <Group name="Trust No One">
	function create_default_slot$c(ctx) {
		let div;
		let p;
		let t1;

		let t2_value = (/*imposterNames*/ ctx[0].length == 0
		? "Waiting..."
		: /*imposterNames*/ ctx[0].join(", ")) + "";

		let t2;

		return {
			c() {
				div = element("div");
				p = element("p");
				p.textContent = "This script will only work if you don't join mid-game.";
				t1 = text("\r\n        Imposters: ");
				t2 = text(t2_value);
				attr(div, "class", "svelte-1h3d0lh");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, p);
				append(div, t1);
				append(div, t2);
			},
			p(ctx, dirty) {
				if (dirty & /*imposterNames*/ 1 && t2_value !== (t2_value = (/*imposterNames*/ ctx[0].length == 0
				? "Waiting..."
				: /*imposterNames*/ ctx[0].join(", ")) + "")) set_data(t2, t2_value);
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	function create_fragment$h(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "Trust No One",
					$$slots: { default: [create_default_slot$c] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope, imposterNames*/ 3) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	function instance$a($$self, $$props, $$invalidate) {
		let imposterNames = [];

		socketManager.addEventListener("blueboatMessage", e => {
			if (e.detail.key == "IMPOSTER_MODE_PEOPLE") {
				let imposters = e.detail.data.filter(person => person.role == "imposter");
				$$invalidate(0, imposterNames = imposters.map(person => person.name));
			}
		});

		return [imposterNames];
	}

	class ShowImposters extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$a, create_fragment$h, safe_not_equal, {}, add_css$2);
		}
	}

	/* src\scripts\shared\PurchaseAnywhere.svelte generated by Svelte v4.2.9 */

	function create_if_block$1(ctx) {
		let t0;
		let t1_value = (/*cost*/ ctx[1] ?? /*purchaseDevices*/ ctx[2][0]?.options?.amountOfRequiredItem) + "";
		let t1;
		let t2;

		return {
			c() {
				t0 = text("(");
				t1 = text(t1_value);
				t2 = text(")");
			},
			m(target, anchor) {
				insert(target, t0, anchor);
				insert(target, t1, anchor);
				insert(target, t2, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*cost, purchaseDevices*/ 6 && t1_value !== (t1_value = (/*cost*/ ctx[1] ?? /*purchaseDevices*/ ctx[2][0]?.options?.amountOfRequiredItem) + "")) set_data(t1, t1_value);
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(t2);
				}
			}
		};
	}

	// (65:0) <Button disabled={!$devicesLoaded || purchaseDevices.length == 0} disabledMsg={!$devicesLoaded ? "Devices haven't loaded yet" : "No matching purchase devices"}  on:click={purchase} >
	function create_default_slot$b(ctx) {
		let t0;
		let t1;
		let t2;
		let if_block_anchor;
		let if_block = /*purchaseDevices*/ ctx[2].length > 0 && (/*purchaseDevices*/ ctx[2][0]?.options?.amountOfRequiredItem || /*cost*/ ctx[1]) && create_if_block$1(ctx);

		return {
			c() {
				t0 = text("Purchase ");
				t1 = text(/*displayText*/ ctx[0]);
				t2 = space();
				if (if_block) if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				insert(target, t0, anchor);
				insert(target, t1, anchor);
				insert(target, t2, anchor);
				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*displayText*/ 1) set_data(t1, /*displayText*/ ctx[0]);

				if (/*purchaseDevices*/ ctx[2].length > 0 && (/*purchaseDevices*/ ctx[2][0]?.options?.amountOfRequiredItem || /*cost*/ ctx[1])) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block$1(ctx);
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(t2);
					detach(if_block_anchor);
				}

				if (if_block) if_block.d(detaching);
			}
		};
	}

	function create_fragment$g(ctx) {
		let button;
		let current;

		button = new Button({
				props: {
					disabled: !/*$devicesLoaded*/ ctx[3] || /*purchaseDevices*/ ctx[2].length == 0,
					disabledMsg: !/*$devicesLoaded*/ ctx[3]
					? "Devices haven't loaded yet"
					: "No matching purchase devices",
					$$slots: { default: [create_default_slot$b] },
					$$scope: { ctx }
				}
			});

		button.$on("click", /*purchase*/ ctx[4]);

		return {
			c() {
				create_component(button.$$.fragment);
			},
			m(target, anchor) {
				mount_component(button, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const button_changes = {};
				if (dirty & /*$devicesLoaded, purchaseDevices*/ 12) button_changes.disabled = !/*$devicesLoaded*/ ctx[3] || /*purchaseDevices*/ ctx[2].length == 0;

				if (dirty & /*$devicesLoaded*/ 8) button_changes.disabledMsg = !/*$devicesLoaded*/ ctx[3]
				? "Devices haven't loaded yet"
				: "No matching purchase devices";

				if (dirty & /*$$scope, cost, purchaseDevices, displayText*/ 135) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);
			},
			i(local) {
				if (current) return;
				transition_in(button.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(button, detaching);
			}
		};
	}

	function instance$9($$self, $$props, $$invalidate) {
		let $devicesLoaded;
		component_subscribe($$self, devicesLoaded, $$value => $$invalidate(3, $devicesLoaded = $$value));
		let { selector } = $$props;
		let { displayText } = $$props;
		let { reusable = false } = $$props;
		let { cost = undefined } = $$props;
		let purchaseDevices = [];

		devicesLoaded.subscribe(value => {
			if (!value) return;
			let devices = getUnsafeWindow()?.stores?.phaser?.scene?.worldManager?.devices?.allDevices;

			$$invalidate(2, purchaseDevices = devices.filter(device => {
				let matches = true;

				for (let [category, matchFields] of Object.entries(selector)) {
					for (let [key, value] of Object.entries(matchFields)) {
						if (value.endsWith?.("*")) {
							value = value.slice(0, -1);

							if (!device?.[category]?.[key]?.startsWith(value)) {
								matches = false;
								break;
							}
						} else if (typeof value == "function") {
							if (device?.[category]?.[key] != value()) {
								matches = false;
								break;
							}
						} else {
							// find an exact match
							if (device?.[category]?.[key] != value) {
								matches = false;
								break;
							}
						}
					}
				}

				return matches;
			}));

			purchaseDevices.sort((a, b) => a?.options?.amountOfRequiredItem - b?.options?.amountOfRequiredItem);
		});

		async function purchase() {
			let devices = getUnsafeWindow()?.stores?.phaser?.scene?.worldManager?.devices?.allDevices;

			// this code has been here a while and I don't know what exactly it does but I don't dare remove it
			if (!purchaseDevices[0]?.interactiveZones?.onInteraction) {
				$$invalidate(2, purchaseDevices = purchaseDevices.map(device => {
					return devices.find(d => d.id == device.id);
				}));

				return;
			}

			purchaseDevices[0]?.interactiveZones?.onInteraction();
			if (reusable) return;

			// check whether it was successfully purchased
			// wait 500ms for the purchase to go through
			await new Promise(resolve => setTimeout(resolve, 500));

			if (purchaseDevices[0].state.active) return; // it wasn't purchased
			purchaseDevices.shift();
			$$invalidate(2, purchaseDevices);
		}

		$$self.$$set = $$props => {
			if ('selector' in $$props) $$invalidate(5, selector = $$props.selector);
			if ('displayText' in $$props) $$invalidate(0, displayText = $$props.displayText);
			if ('reusable' in $$props) $$invalidate(6, reusable = $$props.reusable);
			if ('cost' in $$props) $$invalidate(1, cost = $$props.cost);
		};

		return [
			displayText,
			cost,
			purchaseDevices,
			$devicesLoaded,
			purchase,
			selector,
			reusable
		];
	}

	class PurchaseAnywhere extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$9, create_fragment$g, safe_not_equal, {
				selector: 5,
				displayText: 0,
				reusable: 6,
				cost: 1
			});
		}
	}

	/* src\scripts\ctf\Ctf.svelte generated by Svelte v4.2.9 */

	function create_default_slot$a(ctx) {
		let purchaseanywhere0;
		let t0;
		let purchaseanywhere1;
		let t1;
		let purchaseanywhere2;
		let t2;
		let purchaseanywhere3;
		let t3;
		let purchaseanywhere4;
		let t4;
		let purchaseanywhere5;
		let current;

		purchaseanywhere0 = new PurchaseAnywhere({
				props: {
					displayText: "Speed Upgrade",
					selector: {
						options: { grantedItemName: "Speed Upgrade" }
					}
				}
			});

		purchaseanywhere1 = new PurchaseAnywhere({
				props: {
					displayText: "Efficiency Upgrade",
					selector: {
						options: { grantedItemName: "Efficiency Upgrade" }
					}
				}
			});

		purchaseanywhere2 = new PurchaseAnywhere({
				props: {
					displayText: "Energy Per Question Upgrade",
					selector: {
						options: {
							grantedItemName: "Energy Per Question Upgrade"
						}
					}
				}
			});

		purchaseanywhere3 = new PurchaseAnywhere({
				props: {
					displayText: "Invisabits",
					reusable: true,
					selector: { options: { grantedItemId: "silver-ore" } }
				}
			});

		purchaseanywhere4 = new PurchaseAnywhere({
				props: {
					displayText: "Barrier",
					selector: {
						state: { active: true },
						options: {
							grantedItemName: "Barrier*",
							allowedPurchaseTeam: /*func*/ ctx[0]
						}
					}
				}
			});

		purchaseanywhere5 = new PurchaseAnywhere({
				props: {
					displayText: "Big Barrier",
					selector: {
						state: { active: true },
						options: {
							grantedItemName: "Big Barrier*",
							allowedPurchaseTeam: /*func_1*/ ctx[1]
						}
					}
				}
			});

		return {
			c() {
				create_component(purchaseanywhere0.$$.fragment);
				t0 = space();
				create_component(purchaseanywhere1.$$.fragment);
				t1 = space();
				create_component(purchaseanywhere2.$$.fragment);
				t2 = space();
				create_component(purchaseanywhere3.$$.fragment);
				t3 = space();
				create_component(purchaseanywhere4.$$.fragment);
				t4 = space();
				create_component(purchaseanywhere5.$$.fragment);
			},
			m(target, anchor) {
				mount_component(purchaseanywhere0, target, anchor);
				insert(target, t0, anchor);
				mount_component(purchaseanywhere1, target, anchor);
				insert(target, t1, anchor);
				mount_component(purchaseanywhere2, target, anchor);
				insert(target, t2, anchor);
				mount_component(purchaseanywhere3, target, anchor);
				insert(target, t3, anchor);
				mount_component(purchaseanywhere4, target, anchor);
				insert(target, t4, anchor);
				mount_component(purchaseanywhere5, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(purchaseanywhere0.$$.fragment, local);
				transition_in(purchaseanywhere1.$$.fragment, local);
				transition_in(purchaseanywhere2.$$.fragment, local);
				transition_in(purchaseanywhere3.$$.fragment, local);
				transition_in(purchaseanywhere4.$$.fragment, local);
				transition_in(purchaseanywhere5.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(purchaseanywhere0.$$.fragment, local);
				transition_out(purchaseanywhere1.$$.fragment, local);
				transition_out(purchaseanywhere2.$$.fragment, local);
				transition_out(purchaseanywhere3.$$.fragment, local);
				transition_out(purchaseanywhere4.$$.fragment, local);
				transition_out(purchaseanywhere5.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(t2);
					detach(t3);
					detach(t4);
				}

				destroy_component(purchaseanywhere0, detaching);
				destroy_component(purchaseanywhere1, detaching);
				destroy_component(purchaseanywhere2, detaching);
				destroy_component(purchaseanywhere3, detaching);
				destroy_component(purchaseanywhere4, detaching);
				destroy_component(purchaseanywhere5, detaching);
			}
		};
	}

	function create_fragment$f(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "Capture the Flag",
					$$slots: { default: [create_default_slot$a] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope*/ 4) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	function instance$8($$self) {
		const func = () => getUnsafeWindow()?.stores?.phaser?.mainCharacter?.teamId;
		const func_1 = () => getUnsafeWindow()?.stores?.phaser?.mainCharacter?.teamId;
		return [func, func_1];
	}

	class Ctf extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$8, create_fragment$f, safe_not_equal, {});
		}
	}

	/* src\scripts\tag\Tag.svelte generated by Svelte v4.2.9 */

	function create_default_slot$9(ctx) {
		let purchaseanywhere0;
		let t0;
		let purchaseanywhere1;
		let t1;
		let purchaseanywhere2;
		let t2;
		let purchaseanywhere3;
		let current;

		purchaseanywhere0 = new PurchaseAnywhere({
				props: {
					displayText: "Speed Upgrade",
					selector: {
						options: { grantedItemName: "Speed Upgrade" }
					}
				}
			});

		purchaseanywhere1 = new PurchaseAnywhere({
				props: {
					displayText: "Efficiency Upgrade",
					selector: {
						options: { grantedItemName: "Efficiency Upgrade" }
					}
				}
			});

		purchaseanywhere2 = new PurchaseAnywhere({
				props: {
					displayText: "Energy Per Question Upgrade",
					selector: {
						options: {
							grantedItemName: "Energy Per Question Upgrade"
						}
					}
				}
			});

		purchaseanywhere3 = new PurchaseAnywhere({
				props: {
					displayText: "Endurance Upgrade",
					selector: {
						options: { grantedItemName: "Endurance Upgrade" }
					}
				}
			});

		return {
			c() {
				create_component(purchaseanywhere0.$$.fragment);
				t0 = space();
				create_component(purchaseanywhere1.$$.fragment);
				t1 = space();
				create_component(purchaseanywhere2.$$.fragment);
				t2 = space();
				create_component(purchaseanywhere3.$$.fragment);
			},
			m(target, anchor) {
				mount_component(purchaseanywhere0, target, anchor);
				insert(target, t0, anchor);
				mount_component(purchaseanywhere1, target, anchor);
				insert(target, t1, anchor);
				mount_component(purchaseanywhere2, target, anchor);
				insert(target, t2, anchor);
				mount_component(purchaseanywhere3, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(purchaseanywhere0.$$.fragment, local);
				transition_in(purchaseanywhere1.$$.fragment, local);
				transition_in(purchaseanywhere2.$$.fragment, local);
				transition_in(purchaseanywhere3.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(purchaseanywhere0.$$.fragment, local);
				transition_out(purchaseanywhere1.$$.fragment, local);
				transition_out(purchaseanywhere2.$$.fragment, local);
				transition_out(purchaseanywhere3.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(t2);
				}

				destroy_component(purchaseanywhere0, detaching);
				destroy_component(purchaseanywhere1, detaching);
				destroy_component(purchaseanywhere2, detaching);
				destroy_component(purchaseanywhere3, detaching);
			}
		};
	}

	function create_fragment$e(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "Tag",
					$$slots: { default: [create_default_slot$9] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope*/ 1) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	class Tag extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, null, create_fragment$e, safe_not_equal, {});
		}
	}

	/* src\scripts\oneWayOut\OneWayOut.svelte generated by Svelte v4.2.9 */

	function create_default_slot$8(ctx) {
		let purchaseanywhere0;
		let t;
		let purchaseanywhere1;
		let current;

		purchaseanywhere0 = new PurchaseAnywhere({
				props: {
					displayText: "Med Pack",
					reusable: true,
					selector: { options: { grantedItemId: "medpack" } }
				}
			});

		purchaseanywhere1 = new PurchaseAnywhere({
				props: {
					displayText: "Shield Can",
					reusable: true,
					selector: { options: { grantedItemId: "shield-can" } }
				}
			});

		return {
			c() {
				create_component(purchaseanywhere0.$$.fragment);
				t = space();
				create_component(purchaseanywhere1.$$.fragment);
			},
			m(target, anchor) {
				mount_component(purchaseanywhere0, target, anchor);
				insert(target, t, anchor);
				mount_component(purchaseanywhere1, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(purchaseanywhere0.$$.fragment, local);
				transition_in(purchaseanywhere1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(purchaseanywhere0.$$.fragment, local);
				transition_out(purchaseanywhere1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}

				destroy_component(purchaseanywhere0, detaching);
				destroy_component(purchaseanywhere1, detaching);
			}
		};
	}

	function create_fragment$d(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "One Way Out",
					$$slots: { default: [create_default_slot$8] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope*/ 1) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	class OneWayOut extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, null, create_fragment$d, safe_not_equal, {});
		}
	}

	/* src\scripts\shared\Rapidfire.svelte generated by Svelte v4.2.9 */

	function create_fragment$c(ctx) {
		let togglebutton;
		let updating_enabled;
		let current;

		function togglebutton_enabled_binding(value) {
			/*togglebutton_enabled_binding*/ ctx[4](value);
		}

		let togglebutton_props = {
			onText: "" + (/*message*/ ctx[0] + ": On"),
			offText: "" + (/*message*/ ctx[0] + ": Off"),
			hotkeyId: /*hotkeyId*/ ctx[1]
		};

		if (/*rapidfireEnabled*/ ctx[2] !== void 0) {
			togglebutton_props.enabled = /*rapidfireEnabled*/ ctx[2];
		}

		togglebutton = new ToggleButton({ props: togglebutton_props });
		binding_callbacks.push(() => bind(togglebutton, 'enabled', togglebutton_enabled_binding));
		togglebutton.$on("click", /*onClick*/ ctx[3]);

		return {
			c() {
				create_component(togglebutton.$$.fragment);
			},
			m(target, anchor) {
				mount_component(togglebutton, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const togglebutton_changes = {};
				if (dirty & /*message*/ 1) togglebutton_changes.onText = "" + (/*message*/ ctx[0] + ": On");
				if (dirty & /*message*/ 1) togglebutton_changes.offText = "" + (/*message*/ ctx[0] + ": Off");
				if (dirty & /*hotkeyId*/ 2) togglebutton_changes.hotkeyId = /*hotkeyId*/ ctx[1];

				if (!updating_enabled && dirty & /*rapidfireEnabled*/ 4) {
					updating_enabled = true;
					togglebutton_changes.enabled = /*rapidfireEnabled*/ ctx[2];
					add_flush_callback(() => updating_enabled = false);
				}

				togglebutton.$set(togglebutton_changes);
			},
			i(local) {
				if (current) return;
				transition_in(togglebutton.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(togglebutton.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(togglebutton, detaching);
			}
		};
	}

	function instance$7($$self, $$props, $$invalidate) {
		let rapidfireEnabled = false;
		let rapidfireInterval;
		let { message } = $$props;
		let { hotkeyId } = $$props;

		function onClick() {
			if (rapidfireEnabled) {
				// set the interval to fire when the mouse is down
				rapidfireInterval = setInterval(
					() => {
						let mousePointer = getUnsafeWindow().stores.phaser.scene.input.mousePointer;
						let body = getUnsafeWindow().stores.phaser.mainCharacter.body;
						if (!mousePointer || !body || !mousePointer.isDown) return;

						// calculate the angle and mine
						let Vector2 = getUnsafeWindow().Phaser.Math.Vector2;

						let vector = new Vector2(mousePointer.worldX - body.x, mousePointer.worldY - (body.y - 3)).normalize();
						let angle = getUnsafeWindow().Phaser.Math.Angle.Between(0, 0, vector.x, vector.y);
						socketManager.sendMessage("FIRE", { angle, x: body.x, y: body.y });
					},
					50
				);
			} else {
				clearInterval(rapidfireInterval);
			}
		}

		function togglebutton_enabled_binding(value) {
			rapidfireEnabled = value;
			$$invalidate(2, rapidfireEnabled);
		}

		$$self.$$set = $$props => {
			if ('message' in $$props) $$invalidate(0, message = $$props.message);
			if ('hotkeyId' in $$props) $$invalidate(1, hotkeyId = $$props.hotkeyId);
		};

		return [message, hotkeyId, rapidfireEnabled, onClick, togglebutton_enabled_binding];
	}

	class Rapidfire extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$7, create_fragment$c, safe_not_equal, { message: 0, hotkeyId: 1 });
		}
	}

	/* src\scripts\snowbrawl\Snowbrawl.svelte generated by Svelte v4.2.9 */

	function create_default_slot$7(ctx) {
		let purchaseanywhere0;
		let t0;
		let purchaseanywhere1;
		let t1;
		let rapidfire;
		let current;

		purchaseanywhere0 = new PurchaseAnywhere({
				props: {
					displayText: "Med Pack",
					reusable: true,
					selector: { options: { grantedItemId: "medpack" } }
				}
			});

		purchaseanywhere1 = new PurchaseAnywhere({
				props: {
					displayText: "Shield Can",
					reusable: true,
					selector: { options: { grantedItemId: "shield-can" } }
				}
			});

		rapidfire = new Rapidfire({
				props: {
					message: "Rapid fire",
					hotkeyId: "snowbrawlRapidFire"
				}
			});

		return {
			c() {
				create_component(purchaseanywhere0.$$.fragment);
				t0 = space();
				create_component(purchaseanywhere1.$$.fragment);
				t1 = space();
				create_component(rapidfire.$$.fragment);
			},
			m(target, anchor) {
				mount_component(purchaseanywhere0, target, anchor);
				insert(target, t0, anchor);
				mount_component(purchaseanywhere1, target, anchor);
				insert(target, t1, anchor);
				mount_component(rapidfire, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(purchaseanywhere0.$$.fragment, local);
				transition_in(purchaseanywhere1.$$.fragment, local);
				transition_in(rapidfire.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(purchaseanywhere0.$$.fragment, local);
				transition_out(purchaseanywhere1.$$.fragment, local);
				transition_out(rapidfire.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
				}

				destroy_component(purchaseanywhere0, detaching);
				destroy_component(purchaseanywhere1, detaching);
				destroy_component(rapidfire, detaching);
			}
		};
	}

	function create_fragment$b(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "Snowbrawl",
					$$slots: { default: [create_default_slot$7] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope*/ 1) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	class Snowbrawl extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, null, create_fragment$b, safe_not_equal, {});
		}
	}

	/* src\scripts\floorIsLava\AutoBuild.svelte generated by Svelte v4.2.9 */

	function create_fragment$a(ctx) {
		let togglebutton;
		let updating_enabled;
		let current;

		function togglebutton_enabled_binding(value) {
			/*togglebutton_enabled_binding*/ ctx[2](value);
		}

		let togglebutton_props = {
			offText: "Enable Auto Buy",
			onText: "Disable Auto Buy",
			hotkeyId: "floorIsLavaAutoBuy"
		};

		if (/*enabled*/ ctx[0] !== void 0) {
			togglebutton_props.enabled = /*enabled*/ ctx[0];
		}

		togglebutton = new ToggleButton({ props: togglebutton_props });
		binding_callbacks.push(() => bind(togglebutton, 'enabled', togglebutton_enabled_binding));
		togglebutton.$on("click", /*onClick*/ ctx[1]);

		return {
			c() {
				create_component(togglebutton.$$.fragment);
			},
			m(target, anchor) {
				mount_component(togglebutton, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const togglebutton_changes = {};

				if (!updating_enabled && dirty & /*enabled*/ 1) {
					updating_enabled = true;
					togglebutton_changes.enabled = /*enabled*/ ctx[0];
					add_flush_callback(() => updating_enabled = false);
				}

				togglebutton.$set(togglebutton_changes);
			},
			i(local) {
				if (current) return;
				transition_in(togglebutton.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(togglebutton.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(togglebutton, detaching);
			}
		};
	}

	function instance$6($$self, $$props, $$invalidate) {
		const structures = [
			["spaceElevator", 5e7],
			["mountain", 5e6],
			["skyscaper", 5e5],
			["shoppingMall", 5e4],
			["house", 5e3],
			["wall", 5e2],
			["brick", 50],
			["plank", 5]
		]; // not a typo, it's actually called "skyscaper"
		// called "staircase" ingame

		let money = null;
		let enabled = false;
		let cooldown = false;

		socketManager.addEventListener('blueboatMessage', e => {
			if (e.detail.data?.type == "BALANCE") {
				money = e.detail.data.value;

				if (enabled) {
					checkAutoBuy();
				}
			}
		});

		function checkAutoBuy() {
			if (cooldown || !enabled) return;
			cooldown = true;

			setTimeout(
				() => {
					cooldown = false;
					checkAutoBuy();
				},
				150
			);

			for (let structure of structures) {
				if (money >= structure[1]) {
					buyStructure(structure[0]);
					break;
				}
			}
		}

		function buyStructure(type) {
			socketManager.sendMessage("LAVA_PURCHASE_PIECE", { type });
		}

		function onClick(message) {
			$$invalidate(0, enabled = message.detail);
			checkAutoBuy();
		}

		function togglebutton_enabled_binding(value) {
			enabled = value;
			$$invalidate(0, enabled);
		}

		return [enabled, onClick, togglebutton_enabled_binding];
	}

	class AutoBuild extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$6, create_fragment$a, safe_not_equal, {});
		}
	}

	/* src\scripts\floorIsLava\HidePopups.svelte generated by Svelte v4.2.9 */

	function create_fragment$9(ctx) {
		let togglebutton;
		let updating_enabled;
		let current;

		function togglebutton_enabled_binding(value) {
			/*togglebutton_enabled_binding*/ ctx[1](value);
		}

		let togglebutton_props = {
			offText: "Hide Purchase Popups",
			onText: "Show Purchase Popups",
			hotkeyId: "floorIsLavaHidePopups"
		};

		if (/*hidingPopups*/ ctx[0] !== void 0) {
			togglebutton_props.enabled = /*hidingPopups*/ ctx[0];
		}

		togglebutton = new ToggleButton({ props: togglebutton_props });
		binding_callbacks.push(() => bind(togglebutton, 'enabled', togglebutton_enabled_binding));
		togglebutton.$on("click", onClick);

		return {
			c() {
				create_component(togglebutton.$$.fragment);
			},
			m(target, anchor) {
				mount_component(togglebutton, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const togglebutton_changes = {};

				if (!updating_enabled && dirty & /*hidingPopups*/ 1) {
					updating_enabled = true;
					togglebutton_changes.enabled = /*hidingPopups*/ ctx[0];
					add_flush_callback(() => updating_enabled = false);
				}

				togglebutton.$set(togglebutton_changes);
			},
			i(local) {
				if (current) return;
				transition_in(togglebutton.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(togglebutton.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(togglebutton, detaching);
			}
		};
	}

	function onClick(message) {
		if (!message.detail) return;

		document.querySelectorAll(".Toastify__toast").forEach(node => {
			node.style.display = "none";
			node.querySelector('.Toastify__close-button')?.click();
		});
	}

	function instance$5($$self, $$props, $$invalidate) {
		let hidingPopups = false;

		let observer = new MutationObserver(mutations => {
				if (!hidingPopups) return;

				for (let mutation of mutations) {
					for (let node of mutation.addedNodes) {
						if (!(node instanceof HTMLElement)) continue;

						if (node.matches(".Toastify__toast")) {
							node.style.display = "none";
							node.querySelector('.Toastify__close-button')?.click();
						}
					}
				}
			});

		const attachObserver = () => {
			observer.observe(document.body, { childList: true, subtree: true });
		};

		if (!document.body) {
			window.addEventListener('DOMContentLoaded', attachObserver);
		} else {
			attachObserver();
		}

		function togglebutton_enabled_binding(value) {
			hidingPopups = value;
			$$invalidate(0, hidingPopups);
		}

		return [hidingPopups, togglebutton_enabled_binding];
	}

	class HidePopups extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$5, create_fragment$9, safe_not_equal, {});
		}
	}

	/* src\scripts\floorIsLava\FloorIsLava.svelte generated by Svelte v4.2.9 */

	function create_default_slot$6(ctx) {
		let autobuild;
		let t;
		let hidepopups;
		let current;
		autobuild = new AutoBuild({});
		hidepopups = new HidePopups({});

		return {
			c() {
				create_component(autobuild.$$.fragment);
				t = space();
				create_component(hidepopups.$$.fragment);
			},
			m(target, anchor) {
				mount_component(autobuild, target, anchor);
				insert(target, t, anchor);
				mount_component(hidepopups, target, anchor);
				current = true;
			},
			i(local) {
				if (current) return;
				transition_in(autobuild.$$.fragment, local);
				transition_in(hidepopups.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(autobuild.$$.fragment, local);
				transition_out(hidepopups.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}

				destroy_component(autobuild, detaching);
				destroy_component(hidepopups, detaching);
			}
		};
	}

	function create_fragment$8(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "The Floor is Lava",
					$$slots: { default: [create_default_slot$6] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope*/ 1) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	class FloorIsLava extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, null, create_fragment$8, safe_not_equal, {});
		}
	}

	/* src\scripts\farmchain\AutoPlant.svelte generated by Svelte v4.2.9 */

	function create_fragment$7(ctx) {
		let togglebutton;
		let current;

		togglebutton = new ToggleButton({
				props: {
					offText: "Start Auto Planting",
					onText: "Stop Auto Planting",
					disabled: !/*$devicesLoaded*/ ctx[0],
					disabledMsg: "Farm plots not loaded",
					hotkeyId: "farmchainAutoPlant"
				}
			});

		togglebutton.$on("click", /*onClick*/ ctx[1]);

		return {
			c() {
				create_component(togglebutton.$$.fragment);
			},
			m(target, anchor) {
				mount_component(togglebutton, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const togglebutton_changes = {};
				if (dirty & /*$devicesLoaded*/ 1) togglebutton_changes.disabled = !/*$devicesLoaded*/ ctx[0];
				togglebutton.$set(togglebutton_changes);
			},
			i(local) {
				if (current) return;
				transition_in(togglebutton.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(togglebutton.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(togglebutton, detaching);
			}
		};
	}

	function instance$4($$self, $$props, $$invalidate) {
		let $devicesLoaded;
		component_subscribe($$self, devicesLoaded, $$value => $$invalidate(0, $devicesLoaded = $$value));

		const seedRanking = [
			'yellow-seed',
			'tan-seed',
			'brown-seed',
			'purple-seed',
			'magenta-seed',
			'green-seed',
			'bronze-seed',
			'orange-seed',
			'gold-seed',
			'dark-green-seed',
			'red-seed',
			'blue-seed',
			'teal-seed'
		];

		let autoPlantInterval = undefined;

		function onClick(e) {
			if (e.detail) {
				let devices = getUnsafeWindow()?.stores?.phaser?.scene?.worldManager?.devices?.allDevices;
				let plots = devices.filter(device => device.options.style == "plant");
				let recipieDevices = {};

				for (let device of devices) {
					if (!seedRanking.includes(device.options?.ingredient1Item)) continue;
					recipieDevices[device.options?.ingredient1Item] = device;
				}

				// set up auto plant
				autoPlantInterval = setInterval(
					() => {
						let inventory = getUnsafeWindow()?.stores?.me?.inventory?.slots;
						if (!inventory) return;

						// find the most valuable seed that we can plant
						let mostValuableSeed = undefined;

						for (let seed of seedRanking) {
							let recipie = recipieDevices[seed];
							let canPlant = true;

							// check if we have enough of each ingredient
							for (let i = 0; i < 5; i++) {
								let reqIngredient = recipie?.options?.[`ingredient${i}Item`];
								if (!reqIngredient) continue;

								if (!inventory.get(reqIngredient)?.amount >= recipie.options[`ingredient${i}Amount`]) {
									canPlant = false;
									break;
								}
							}

							if (canPlant) {
								mostValuableSeed = seed;
								break;
							}
						}

						if (!mostValuableSeed) return;

						// plant the seed in the last idle plot
						let plantPlot = plots.findLast(plot => plot.state.status == "idle");

						socketManager.sendMessage("MESSAGE_FOR_DEVICE", {
							key: "craft",
							deviceId: plantPlot.id,
							data: {
								recipe: recipieDevices[mostValuableSeed].id
							}
						});
					},
					100
				);
			} else {
				clearInterval(autoPlantInterval);
			}
		}

		return [$devicesLoaded, onClick];
	}

	class AutoPlant extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$4, create_fragment$7, safe_not_equal, {});
		}
	}

	/* src\scripts\farmchain\AutoHarvest.svelte generated by Svelte v4.2.9 */

	function create_fragment$6(ctx) {
		let togglebutton;
		let updating_enabled;
		let current;

		function togglebutton_enabled_binding(value) {
			/*togglebutton_enabled_binding*/ ctx[1](value);
		}

		let togglebutton_props = {
			hotkeyId: "farmchainAutoHarvest",
			offText: "Start Auto Harvesting",
			onText: "Stop Auto Harvesting"
		};

		if (/*autoHarvesting*/ ctx[0] !== void 0) {
			togglebutton_props.enabled = /*autoHarvesting*/ ctx[0];
		}

		togglebutton = new ToggleButton({ props: togglebutton_props });
		binding_callbacks.push(() => bind(togglebutton, 'enabled', togglebutton_enabled_binding));

		return {
			c() {
				create_component(togglebutton.$$.fragment);
			},
			m(target, anchor) {
				mount_component(togglebutton, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const togglebutton_changes = {};

				if (!updating_enabled && dirty & /*autoHarvesting*/ 1) {
					updating_enabled = true;
					togglebutton_changes.enabled = /*autoHarvesting*/ ctx[0];
					add_flush_callback(() => updating_enabled = false);
				}

				togglebutton.$set(togglebutton_changes);
			},
			i(local) {
				if (current) return;
				transition_in(togglebutton.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(togglebutton.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(togglebutton, detaching);
			}
		};
	}

	function instance$3($$self, $$props, $$invalidate) {
		let autoHarvesting = false;

		socketManager.addEventListener('deviceChanges', e => {
			if (!autoHarvesting) return;
			let changes = e.detail;

			for (let change of changes) {
				for (let key in change.data) {
					if (!key.endsWith("status") || change.data[key] != "availableForCollection") continue;

					// harvest it
					let packet = { key: "collect", deviceId: change.id };

					socketManager.sendMessage("MESSAGE_FOR_DEVICE", packet);
				}
			}
		});

		function togglebutton_enabled_binding(value) {
			autoHarvesting = value;
			$$invalidate(0, autoHarvesting);
		}

		return [autoHarvesting, togglebutton_enabled_binding];
	}

	class AutoHarvest extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$3, create_fragment$6, safe_not_equal, {});
		}
	}

	/* src\scripts\farmchain\Farmchain.svelte generated by Svelte v4.2.9 */

	function create_default_slot_2$2(ctx) {
		let purchaseanywhere0;
		let t0;
		let purchaseanywhere1;
		let t1;
		let purchaseanywhere2;
		let t2;
		let purchaseanywhere3;
		let t3;
		let purchaseanywhere4;
		let t4;
		let purchaseanywhere5;
		let t5;
		let purchaseanywhere6;
		let t6;
		let purchaseanywhere7;
		let t7;
		let purchaseanywhere8;
		let t8;
		let purchaseanywhere9;
		let t9;
		let purchaseanywhere10;
		let t10;
		let purchaseanywhere11;
		let t11;
		let purchaseanywhere12;
		let current;

		purchaseanywhere0 = new PurchaseAnywhere({
				props: {
					displayText: "Corn Seed",
					reusable: true,
					selector: {
						options: { grantedItemId: "yellow-seed" }
					}
				}
			});

		purchaseanywhere1 = new PurchaseAnywhere({
				props: {
					displayText: "Wheat Seed",
					reusable: true,
					selector: { options: { grantedItemId: "tan-seed" } }
				}
			});

		purchaseanywhere2 = new PurchaseAnywhere({
				props: {
					displayText: "Potato Seed",
					reusable: true,
					selector: { options: { grantedItemId: "brown-seed" } }
				}
			});

		purchaseanywhere3 = new PurchaseAnywhere({
				props: {
					displayText: "Grape Seed",
					reusable: true,
					selector: {
						options: { grantedItemId: "purple-seed" }
					}
				}
			});

		purchaseanywhere4 = new PurchaseAnywhere({
				props: {
					displayText: "Raspberry Seed",
					reusable: true,
					selector: {
						options: { grantedItemId: "magenta-seed" }
					}
				}
			});

		purchaseanywhere5 = new PurchaseAnywhere({
				props: {
					displayText: "Watermelon Seed",
					reusable: true,
					selector: { options: { grantedItemId: "green-seed" } }
				}
			});

		purchaseanywhere6 = new PurchaseAnywhere({
				props: {
					displayText: "Coffee Bean Seed",
					reusable: true,
					selector: {
						options: { grantedItemId: "bronze-seed" }
					}
				}
			});

		purchaseanywhere7 = new PurchaseAnywhere({
				props: {
					displayText: "Orange Seed",
					reusable: true,
					selector: {
						options: { grantedItemId: "orange-seed" }
					}
				}
			});

		purchaseanywhere8 = new PurchaseAnywhere({
				props: {
					displayText: "Gimberry Seed",
					reusable: true,
					selector: { options: { grantedItemId: "gold-seed" } }
				}
			});

		purchaseanywhere9 = new PurchaseAnywhere({
				props: {
					displayText: "Cash Berry Seed",
					reusable: true,
					selector: {
						options: { grantedItemId: "dark-green-seed" }
					}
				}
			});

		purchaseanywhere10 = new PurchaseAnywhere({
				props: {
					displayText: "Pepper Seed",
					reusable: true,
					selector: { options: { grantedItemId: "red-seed" } }
				}
			});

		purchaseanywhere11 = new PurchaseAnywhere({
				props: {
					displayText: "Energy Bar Seed",
					reusable: true,
					selector: { options: { grantedItemId: "blue-seed" } }
				}
			});

		purchaseanywhere12 = new PurchaseAnywhere({
				props: {
					displayText: "Lottery Ticket Seed",
					reusable: true,
					selector: { options: { grantedItemId: "teal-seed" } }
				}
			});

		return {
			c() {
				create_component(purchaseanywhere0.$$.fragment);
				t0 = space();
				create_component(purchaseanywhere1.$$.fragment);
				t1 = space();
				create_component(purchaseanywhere2.$$.fragment);
				t2 = space();
				create_component(purchaseanywhere3.$$.fragment);
				t3 = space();
				create_component(purchaseanywhere4.$$.fragment);
				t4 = space();
				create_component(purchaseanywhere5.$$.fragment);
				t5 = space();
				create_component(purchaseanywhere6.$$.fragment);
				t6 = space();
				create_component(purchaseanywhere7.$$.fragment);
				t7 = space();
				create_component(purchaseanywhere8.$$.fragment);
				t8 = space();
				create_component(purchaseanywhere9.$$.fragment);
				t9 = space();
				create_component(purchaseanywhere10.$$.fragment);
				t10 = space();
				create_component(purchaseanywhere11.$$.fragment);
				t11 = space();
				create_component(purchaseanywhere12.$$.fragment);
			},
			m(target, anchor) {
				mount_component(purchaseanywhere0, target, anchor);
				insert(target, t0, anchor);
				mount_component(purchaseanywhere1, target, anchor);
				insert(target, t1, anchor);
				mount_component(purchaseanywhere2, target, anchor);
				insert(target, t2, anchor);
				mount_component(purchaseanywhere3, target, anchor);
				insert(target, t3, anchor);
				mount_component(purchaseanywhere4, target, anchor);
				insert(target, t4, anchor);
				mount_component(purchaseanywhere5, target, anchor);
				insert(target, t5, anchor);
				mount_component(purchaseanywhere6, target, anchor);
				insert(target, t6, anchor);
				mount_component(purchaseanywhere7, target, anchor);
				insert(target, t7, anchor);
				mount_component(purchaseanywhere8, target, anchor);
				insert(target, t8, anchor);
				mount_component(purchaseanywhere9, target, anchor);
				insert(target, t9, anchor);
				mount_component(purchaseanywhere10, target, anchor);
				insert(target, t10, anchor);
				mount_component(purchaseanywhere11, target, anchor);
				insert(target, t11, anchor);
				mount_component(purchaseanywhere12, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(purchaseanywhere0.$$.fragment, local);
				transition_in(purchaseanywhere1.$$.fragment, local);
				transition_in(purchaseanywhere2.$$.fragment, local);
				transition_in(purchaseanywhere3.$$.fragment, local);
				transition_in(purchaseanywhere4.$$.fragment, local);
				transition_in(purchaseanywhere5.$$.fragment, local);
				transition_in(purchaseanywhere6.$$.fragment, local);
				transition_in(purchaseanywhere7.$$.fragment, local);
				transition_in(purchaseanywhere8.$$.fragment, local);
				transition_in(purchaseanywhere9.$$.fragment, local);
				transition_in(purchaseanywhere10.$$.fragment, local);
				transition_in(purchaseanywhere11.$$.fragment, local);
				transition_in(purchaseanywhere12.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(purchaseanywhere0.$$.fragment, local);
				transition_out(purchaseanywhere1.$$.fragment, local);
				transition_out(purchaseanywhere2.$$.fragment, local);
				transition_out(purchaseanywhere3.$$.fragment, local);
				transition_out(purchaseanywhere4.$$.fragment, local);
				transition_out(purchaseanywhere5.$$.fragment, local);
				transition_out(purchaseanywhere6.$$.fragment, local);
				transition_out(purchaseanywhere7.$$.fragment, local);
				transition_out(purchaseanywhere8.$$.fragment, local);
				transition_out(purchaseanywhere9.$$.fragment, local);
				transition_out(purchaseanywhere10.$$.fragment, local);
				transition_out(purchaseanywhere11.$$.fragment, local);
				transition_out(purchaseanywhere12.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(t2);
					detach(t3);
					detach(t4);
					detach(t5);
					detach(t6);
					detach(t7);
					detach(t8);
					detach(t9);
					detach(t10);
					detach(t11);
				}

				destroy_component(purchaseanywhere0, detaching);
				destroy_component(purchaseanywhere1, detaching);
				destroy_component(purchaseanywhere2, detaching);
				destroy_component(purchaseanywhere3, detaching);
				destroy_component(purchaseanywhere4, detaching);
				destroy_component(purchaseanywhere5, detaching);
				destroy_component(purchaseanywhere6, detaching);
				destroy_component(purchaseanywhere7, detaching);
				destroy_component(purchaseanywhere8, detaching);
				destroy_component(purchaseanywhere9, detaching);
				destroy_component(purchaseanywhere10, detaching);
				destroy_component(purchaseanywhere11, detaching);
				destroy_component(purchaseanywhere12, detaching);
			}
		};
	}

	// (38:4) <Group name="Unlock Seeds">
	function create_default_slot_1$2(ctx) {
		let purchaseanywhere0;
		let t0;
		let purchaseanywhere1;
		let t1;
		let purchaseanywhere2;
		let t2;
		let purchaseanywhere3;
		let t3;
		let purchaseanywhere4;
		let t4;
		let purchaseanywhere5;
		let t5;
		let purchaseanywhere6;
		let t6;
		let purchaseanywhere7;
		let current;

		purchaseanywhere0 = new PurchaseAnywhere({
				props: {
					displayText: "Unlock Wheat Seed",
					selector: {
						options: { grantedItemName: "Wheat Seed Unlock" }
					}
				}
			});

		purchaseanywhere1 = new PurchaseAnywhere({
				props: {
					displayText: "Unlock Potato Seed",
					selector: {
						options: { grantedItemName: "Potato Seed Unlock" }
					}
				}
			});

		purchaseanywhere2 = new PurchaseAnywhere({
				props: {
					displayText: "Unlock Grape Seed",
					selector: {
						options: { grantedItemName: "Grape Seed Unlock" }
					}
				}
			});

		purchaseanywhere3 = new PurchaseAnywhere({
				props: {
					displayText: "Unlock Raspberry Seed",
					selector: {
						options: { grantedItemName: "Raspberry Seed Unlock" }
					}
				}
			});

		purchaseanywhere4 = new PurchaseAnywhere({
				props: {
					displayText: "Unlock Watermelon Seed",
					selector: {
						options: {
							grantedItemName: "Watermelon Seed Unlock"
						}
					}
				}
			});

		purchaseanywhere5 = new PurchaseAnywhere({
				props: {
					displayText: "Unlock Coffee Bean Seed",
					selector: {
						options: {
							grantedItemName: "Coffee Bean Seed Unlock"
						}
					}
				}
			});

		purchaseanywhere6 = new PurchaseAnywhere({
				props: {
					displayText: "Unlock Orange Seed",
					selector: {
						options: { grantedItemName: "Orange Seed Unlock" }
					}
				}
			});

		purchaseanywhere7 = new PurchaseAnywhere({
				props: {
					displayText: "Unlock Gimberry Seed",
					selector: {
						options: { grantedItemName: "Gimberry Seed Unlock" }
					}
				}
			});

		return {
			c() {
				create_component(purchaseanywhere0.$$.fragment);
				t0 = space();
				create_component(purchaseanywhere1.$$.fragment);
				t1 = space();
				create_component(purchaseanywhere2.$$.fragment);
				t2 = space();
				create_component(purchaseanywhere3.$$.fragment);
				t3 = space();
				create_component(purchaseanywhere4.$$.fragment);
				t4 = space();
				create_component(purchaseanywhere5.$$.fragment);
				t5 = space();
				create_component(purchaseanywhere6.$$.fragment);
				t6 = space();
				create_component(purchaseanywhere7.$$.fragment);
			},
			m(target, anchor) {
				mount_component(purchaseanywhere0, target, anchor);
				insert(target, t0, anchor);
				mount_component(purchaseanywhere1, target, anchor);
				insert(target, t1, anchor);
				mount_component(purchaseanywhere2, target, anchor);
				insert(target, t2, anchor);
				mount_component(purchaseanywhere3, target, anchor);
				insert(target, t3, anchor);
				mount_component(purchaseanywhere4, target, anchor);
				insert(target, t4, anchor);
				mount_component(purchaseanywhere5, target, anchor);
				insert(target, t5, anchor);
				mount_component(purchaseanywhere6, target, anchor);
				insert(target, t6, anchor);
				mount_component(purchaseanywhere7, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(purchaseanywhere0.$$.fragment, local);
				transition_in(purchaseanywhere1.$$.fragment, local);
				transition_in(purchaseanywhere2.$$.fragment, local);
				transition_in(purchaseanywhere3.$$.fragment, local);
				transition_in(purchaseanywhere4.$$.fragment, local);
				transition_in(purchaseanywhere5.$$.fragment, local);
				transition_in(purchaseanywhere6.$$.fragment, local);
				transition_in(purchaseanywhere7.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(purchaseanywhere0.$$.fragment, local);
				transition_out(purchaseanywhere1.$$.fragment, local);
				transition_out(purchaseanywhere2.$$.fragment, local);
				transition_out(purchaseanywhere3.$$.fragment, local);
				transition_out(purchaseanywhere4.$$.fragment, local);
				transition_out(purchaseanywhere5.$$.fragment, local);
				transition_out(purchaseanywhere6.$$.fragment, local);
				transition_out(purchaseanywhere7.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(t2);
					detach(t3);
					detach(t4);
					detach(t5);
					detach(t6);
				}

				destroy_component(purchaseanywhere0, detaching);
				destroy_component(purchaseanywhere1, detaching);
				destroy_component(purchaseanywhere2, detaching);
				destroy_component(purchaseanywhere3, detaching);
				destroy_component(purchaseanywhere4, detaching);
				destroy_component(purchaseanywhere5, detaching);
				destroy_component(purchaseanywhere6, detaching);
				destroy_component(purchaseanywhere7, detaching);
			}
		};
	}

	// (7:0) <Group name="Farmchain">
	function create_default_slot$5(ctx) {
		let autoharvest;
		let t0;
		let autoplant;
		let t1;
		let group0;
		let t2;
		let group1;
		let current;
		autoharvest = new AutoHarvest({});
		autoplant = new AutoPlant({});

		group0 = new Group({
				props: {
					name: "Purchase Seeds",
					$$slots: { default: [create_default_slot_2$2] },
					$$scope: { ctx }
				}
			});

		group1 = new Group({
				props: {
					name: "Unlock Seeds",
					$$slots: { default: [create_default_slot_1$2] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(autoharvest.$$.fragment);
				t0 = space();
				create_component(autoplant.$$.fragment);
				t1 = space();
				create_component(group0.$$.fragment);
				t2 = space();
				create_component(group1.$$.fragment);
			},
			m(target, anchor) {
				mount_component(autoharvest, target, anchor);
				insert(target, t0, anchor);
				mount_component(autoplant, target, anchor);
				insert(target, t1, anchor);
				mount_component(group0, target, anchor);
				insert(target, t2, anchor);
				mount_component(group1, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const group0_changes = {};

				if (dirty & /*$$scope*/ 1) {
					group0_changes.$$scope = { dirty, ctx };
				}

				group0.$set(group0_changes);
				const group1_changes = {};

				if (dirty & /*$$scope*/ 1) {
					group1_changes.$$scope = { dirty, ctx };
				}

				group1.$set(group1_changes);
			},
			i(local) {
				if (current) return;
				transition_in(autoharvest.$$.fragment, local);
				transition_in(autoplant.$$.fragment, local);
				transition_in(group0.$$.fragment, local);
				transition_in(group1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(autoharvest.$$.fragment, local);
				transition_out(autoplant.$$.fragment, local);
				transition_out(group0.$$.fragment, local);
				transition_out(group1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(t2);
				}

				destroy_component(autoharvest, detaching);
				destroy_component(autoplant, detaching);
				destroy_component(group0, detaching);
				destroy_component(group1, detaching);
			}
		};
	}

	function create_fragment$5(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "Farmchain",
					$$slots: { default: [create_default_slot$5] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope*/ 1) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	class Farmchain extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, null, create_fragment$5, safe_not_equal, {});
		}
	}

	let physicsConsts = writable(null);
	function exposeValues(parcel) {
	    // get the stores object
	    parcel.interceptRequire(exports => exports?.default?.characters, exports => {
	        getUnsafeWindow().stores = exports.default;
	        storesLoaded.set(true);
	        console.log("GC: Stores loaded via parcel");
	    });
	    // get the physics constants
	    parcel.interceptRequire(exports => exports?.CharacterPhysicsConsts, exports => {
	        physicsConsts.set(exports.CharacterPhysicsConsts);
	        console.log("GC: Physics constants loaded");
	    });
	}

	/* src\scripts\2d\Movement.svelte generated by Svelte v4.2.9 */

	function create_default_slot$4(ctx) {
		let slider0;
		let updating_value;
		let t0;
		let togglebutton0;
		let updating_enabled;
		let t1;
		let slider1;
		let updating_value_1;
		let t2;
		let togglebutton1;
		let updating_enabled_1;
		let current;

		function slider0_value_binding(value) {
			/*slider0_value_binding*/ ctx[11](value);
		}

		let slider0_props = {
			title: "Speedup Amount",
			min: 1,
			max: /*maxSpeedupMultiplier*/ ctx[6],
			step: 0.005
		};

		if (/*speedupMultiplier*/ ctx[0] !== void 0) {
			slider0_props.value = /*speedupMultiplier*/ ctx[0];
		}

		slider0 = new Slider({ props: slider0_props });
		binding_callbacks.push(() => bind(slider0, 'value', slider0_value_binding));
		slider0.$on("input", /*onSpeedupMultChange*/ ctx[8]);

		function togglebutton0_enabled_binding(value) {
			/*togglebutton0_enabled_binding*/ ctx[12](value);
		}

		let togglebutton0_props = {
			disabled: !/*$storesLoaded*/ ctx[5],
			onText: "Speedup: On",
			offText: "Speedup: Off",
			hotkeyId: "speedup"
		};

		if (/*speedupEnabled*/ ctx[1] !== void 0) {
			togglebutton0_props.enabled = /*speedupEnabled*/ ctx[1];
		}

		togglebutton0 = new ToggleButton({ props: togglebutton0_props });
		binding_callbacks.push(() => bind(togglebutton0, 'enabled', togglebutton0_enabled_binding));
		togglebutton0.$on("click", /*click_handler*/ ctx[13]);

		function slider1_value_binding(value) {
			/*slider1_value_binding*/ ctx[14](value);
		}

		let slider1_props = {
			title: "Jump Boost Amount",
			min: 1,
			max: /*maxSpeedupMultiplier*/ ctx[6],
			step: 0.005
		};

		if (/*jumpboostMultiplier*/ ctx[3] !== void 0) {
			slider1_props.value = /*jumpboostMultiplier*/ ctx[3];
		}

		slider1 = new Slider({ props: slider1_props });
		binding_callbacks.push(() => bind(slider1, 'value', slider1_value_binding));
		slider1.$on("input", /*onJumpboostMultChange*/ ctx[10]);

		function togglebutton1_enabled_binding(value) {
			/*togglebutton1_enabled_binding*/ ctx[15](value);
		}

		let togglebutton1_props = {
			disabled: !/*$physicsConsts*/ ctx[4],
			onText: "Jump Boost: On",
			offText: "Jump Boost: Off",
			hotkeyId: "jumpboost"
		};

		if (/*jumpboostEnabled*/ ctx[2] !== void 0) {
			togglebutton1_props.enabled = /*jumpboostEnabled*/ ctx[2];
		}

		togglebutton1 = new ToggleButton({ props: togglebutton1_props });
		binding_callbacks.push(() => bind(togglebutton1, 'enabled', togglebutton1_enabled_binding));
		togglebutton1.$on("click", /*click_handler_1*/ ctx[16]);

		return {
			c() {
				create_component(slider0.$$.fragment);
				t0 = space();
				create_component(togglebutton0.$$.fragment);
				t1 = space();
				create_component(slider1.$$.fragment);
				t2 = space();
				create_component(togglebutton1.$$.fragment);
			},
			m(target, anchor) {
				mount_component(slider0, target, anchor);
				insert(target, t0, anchor);
				mount_component(togglebutton0, target, anchor);
				insert(target, t1, anchor);
				mount_component(slider1, target, anchor);
				insert(target, t2, anchor);
				mount_component(togglebutton1, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const slider0_changes = {};

				if (!updating_value && dirty & /*speedupMultiplier*/ 1) {
					updating_value = true;
					slider0_changes.value = /*speedupMultiplier*/ ctx[0];
					add_flush_callback(() => updating_value = false);
				}

				slider0.$set(slider0_changes);
				const togglebutton0_changes = {};
				if (dirty & /*$storesLoaded*/ 32) togglebutton0_changes.disabled = !/*$storesLoaded*/ ctx[5];

				if (!updating_enabled && dirty & /*speedupEnabled*/ 2) {
					updating_enabled = true;
					togglebutton0_changes.enabled = /*speedupEnabled*/ ctx[1];
					add_flush_callback(() => updating_enabled = false);
				}

				togglebutton0.$set(togglebutton0_changes);
				const slider1_changes = {};

				if (!updating_value_1 && dirty & /*jumpboostMultiplier*/ 8) {
					updating_value_1 = true;
					slider1_changes.value = /*jumpboostMultiplier*/ ctx[3];
					add_flush_callback(() => updating_value_1 = false);
				}

				slider1.$set(slider1_changes);
				const togglebutton1_changes = {};
				if (dirty & /*$physicsConsts*/ 16) togglebutton1_changes.disabled = !/*$physicsConsts*/ ctx[4];

				if (!updating_enabled_1 && dirty & /*jumpboostEnabled*/ 4) {
					updating_enabled_1 = true;
					togglebutton1_changes.enabled = /*jumpboostEnabled*/ ctx[2];
					add_flush_callback(() => updating_enabled_1 = false);
				}

				togglebutton1.$set(togglebutton1_changes);
			},
			i(local) {
				if (current) return;
				transition_in(slider0.$$.fragment, local);
				transition_in(togglebutton0.$$.fragment, local);
				transition_in(slider1.$$.fragment, local);
				transition_in(togglebutton1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(slider0.$$.fragment, local);
				transition_out(togglebutton0.$$.fragment, local);
				transition_out(slider1.$$.fragment, local);
				transition_out(togglebutton1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(t2);
				}

				destroy_component(slider0, detaching);
				destroy_component(togglebutton0, detaching);
				destroy_component(slider1, detaching);
				destroy_component(togglebutton1, detaching);
			}
		};
	}

	function create_fragment$4(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "Movement",
					$$slots: { default: [create_default_slot$4] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope, $physicsConsts, jumpboostEnabled, jumpboostMultiplier, $storesLoaded, speedupEnabled, speedupMultiplier*/ 2097215) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	function instance$2($$self, $$props, $$invalidate) {
		let $physicsConsts;
		let $storesLoaded;
		component_subscribe($$self, physicsConsts, $$value => $$invalidate(4, $physicsConsts = $$value));
		component_subscribe($$self, storesLoaded, $$value => $$invalidate(5, $storesLoaded = $$value));
		const maxSpeedupMultiplier = 490 / 357; // gathered from some testing, any higher and we get teleported back

		// this file is a hot mess, but it works
		let speedupMultiplier = 1;

		let nativeSpeed = -1;
		let lastSetTo = undefined;
		let speedupEnabled = false;

		function enableSpeedup(value) {
			if (!getUnsafeWindow()?.stores?.me) return;
			let mapStyle = getUnsafeWindow().stores.session.mapStyle;

			// restore or set the speed
			if (mapStyle == "platformer") {
				if (!value) {
					set_store_value(physicsConsts, $physicsConsts.platformerGroundSpeed = nativeSpeed, $physicsConsts);
				} else {
					let newSpeed = nativeSpeed * speedupMultiplier;
					lastSetTo = newSpeed;
					set_store_value(physicsConsts, $physicsConsts.platformerGroundSpeed = newSpeed, $physicsConsts);
				}
			} else {
				if (!value) {
					getUnsafeWindow().stores.me.movementSpeed = nativeSpeed;
				} else {
					let newSpeed = nativeSpeed * speedupMultiplier;
					lastSetTo = newSpeed;
					getUnsafeWindow().stores.me.movementSpeed = newSpeed;
				}
			}
		}

		setInterval(checkSpeed, 500);

		function checkSpeed() {
			if (!getUnsafeWindow()?.stores?.me) return;
			let mapStyle = getUnsafeWindow().stores.session.mapStyle;
			if (!mapStyle) return;

			if (mapStyle == "platformer") {
				// 2d platformer modes
				let currentSpeed = $physicsConsts.platformerGroundSpeed;

				if (currentSpeed !== lastSetTo) {
					nativeSpeed = currentSpeed;
					if (speedupEnabled) enableSpeedup(true);
				}
			} else {
				// 2d modes
				let currentSpeed = getUnsafeWindow().stores.me.movementSpeed;

				if (currentSpeed !== lastSetTo) {
					nativeSpeed = currentSpeed;
					if (speedupEnabled) enableSpeedup(true);
				}
			}
		}

		function onSpeedupMultChange(value) {
			$$invalidate(0, speedupMultiplier = value.detail);
			if (!getUnsafeWindow()?.stores?.me || !speedupEnabled) return;
			let mapStyle = getUnsafeWindow().stores.session.mapStyle;
			if (!mapStyle) return;
			let newSpeed = nativeSpeed * value.detail;
			lastSetTo = newSpeed;

			if (mapStyle == "platformer") {
				set_store_value(physicsConsts, $physicsConsts.platformerGroundSpeed = newSpeed, $physicsConsts);
			} else {
				getUnsafeWindow().stores.me.movementSpeed = newSpeed;
			}
		}

		let jumpboostEnabled = false;
		let jumpboostMultiplier = 1;
		let nativeJumpboost = -1;

		function enableJumpboost(value) {
			if (nativeJumpboost == -1) nativeJumpboost = $physicsConsts.jump.height;

			if (!value) {
				set_store_value(physicsConsts, $physicsConsts.jump.height = nativeJumpboost, $physicsConsts);
			} else {
				let newJump = nativeJumpboost * jumpboostMultiplier;
				set_store_value(physicsConsts, $physicsConsts.jump.height = newJump, $physicsConsts);
			}
		}

		function onJumpboostMultChange(e) {
			$$invalidate(3, jumpboostMultiplier = e.detail);
			if (!jumpboostEnabled || !$physicsConsts) return;
			if (nativeJumpboost == -1) nativeJumpboost = $physicsConsts.jump.height;
			let newJump = nativeJumpboost * e.detail;
			set_store_value(physicsConsts, $physicsConsts.jump.height = newJump, $physicsConsts);
		}

		function slider0_value_binding(value) {
			speedupMultiplier = value;
			$$invalidate(0, speedupMultiplier);
		}

		function togglebutton0_enabled_binding(value) {
			speedupEnabled = value;
			$$invalidate(1, speedupEnabled);
		}

		const click_handler = e => enableSpeedup(e.detail);

		function slider1_value_binding(value) {
			jumpboostMultiplier = value;
			$$invalidate(3, jumpboostMultiplier);
		}

		function togglebutton1_enabled_binding(value) {
			jumpboostEnabled = value;
			$$invalidate(2, jumpboostEnabled);
		}

		const click_handler_1 = e => enableJumpboost(e.detail);

		return [
			speedupMultiplier,
			speedupEnabled,
			jumpboostEnabled,
			jumpboostMultiplier,
			$physicsConsts,
			$storesLoaded,
			maxSpeedupMultiplier,
			enableSpeedup,
			onSpeedupMultChange,
			enableJumpboost,
			onJumpboostMultChange,
			slider0_value_binding,
			togglebutton0_enabled_binding,
			click_handler,
			slider1_value_binding,
			togglebutton1_enabled_binding,
			click_handler_1
		];
	}

	class Movement extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$2, create_fragment$4, safe_not_equal, {});
		}
	}

	/* src\scripts\digItUp\Purchasers.svelte generated by Svelte v4.2.9 */

	function add_css$1(target) {
		append_styles(target, "svelte-1a7yjpn", ".notLoaded.svelte-1a7yjpn{width:100%;text-align:center}");
	}

	function get_each_context(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[9] = list[i];
		return child_ctx;
	}

	function get_each_context_1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[9] = list[i];
		return child_ctx;
	}

	// (52:4) {:else}
	function create_else_block_1(ctx) {
		let each_1_anchor;
		let current;
		let each_value_1 = ensure_array_like(/*permitDevices*/ ctx[0]);
		let each_blocks = [];

		for (let i = 0; i < each_value_1.length; i += 1) {
			each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
		}

		const out = i => transition_out(each_blocks[i], 1, 1, () => {
			each_blocks[i] = null;
		});

		return {
			c() {
				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_1_anchor = empty();
			},
			m(target, anchor) {
				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(target, anchor);
					}
				}

				insert(target, each_1_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty & /*buyPermit, permitDevices*/ 9) {
					each_value_1 = ensure_array_like(/*permitDevices*/ ctx[0]);
					let i;

					for (i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1(ctx, each_value_1, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
							transition_in(each_blocks[i], 1);
						} else {
							each_blocks[i] = create_each_block_1(child_ctx);
							each_blocks[i].c();
							transition_in(each_blocks[i], 1);
							each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
						}
					}

					group_outros();

					for (i = each_value_1.length; i < each_blocks.length; i += 1) {
						out(i);
					}

					check_outros();
				}
			},
			i(local) {
				if (current) return;

				for (let i = 0; i < each_value_1.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o(local) {
				each_blocks = each_blocks.filter(Boolean);

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(each_1_anchor);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	// (47:4) {#if permitDevices.length == 0}
	function create_if_block_1(ctx) {
		let div;
		let t1;
		let button;
		let current;

		button = new Button({
				props: {
					$$slots: { default: [create_default_slot_4$1] },
					$$scope: { ctx }
				}
			});

		button.$on("click", /*checkDevices*/ ctx[2]);

		return {
			c() {
				div = element("div");
				div.textContent = "Permits haven't loaded in yet";
				t1 = space();
				create_component(button.$$.fragment);
				attr(div, "class", "notLoaded svelte-1a7yjpn");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				insert(target, t1, anchor);
				mount_component(button, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const button_changes = {};

				if (dirty & /*$$scope*/ 16384) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);
			},
			i(local) {
				if (current) return;
				transition_in(button.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
					detach(t1);
				}

				destroy_component(button, detaching);
			}
		};
	}

	// (54:12) <Button on:click={() => buyPermit(device)}>
	function create_default_slot_5$1(ctx) {
		let t0_value = /*device*/ ctx[9].options.text + "";
		let t0;
		let t1;

		return {
			c() {
				t0 = text(t0_value);
				t1 = space();
			},
			m(target, anchor) {
				insert(target, t0, anchor);
				insert(target, t1, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*permitDevices*/ 1 && t0_value !== (t0_value = /*device*/ ctx[9].options.text + "")) set_data(t0, t0_value);
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
				}
			}
		};
	}

	// (53:8) {#each permitDevices as device}
	function create_each_block_1(ctx) {
		let button;
		let current;

		function click_handler() {
			return /*click_handler*/ ctx[5](/*device*/ ctx[9]);
		}

		button = new Button({
				props: {
					$$slots: { default: [create_default_slot_5$1] },
					$$scope: { ctx }
				}
			});

		button.$on("click", click_handler);

		return {
			c() {
				create_component(button.$$.fragment);
			},
			m(target, anchor) {
				mount_component(button, target, anchor);
				current = true;
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
				const button_changes = {};

				if (dirty & /*$$scope, permitDevices*/ 16385) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);
			},
			i(local) {
				if (current) return;
				transition_in(button.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(button, detaching);
			}
		};
	}

	// (51:8) <Button on:click={checkDevices}>
	function create_default_slot_4$1(ctx) {
		let t;

		return {
			c() {
				t = text("Retry");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (46:0) <Group name="Permits">
	function create_default_slot_3$1(ctx) {
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;
		const if_block_creators = [create_if_block_1, create_else_block_1];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*permitDevices*/ ctx[0].length == 0) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c() {
				if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if_blocks[current_block_type_index].d(detaching);
			}
		};
	}

	// (66:4) {:else}
	function create_else_block(ctx) {
		let each_1_anchor;
		let current;
		let each_value = ensure_array_like(/*pickaxeDevices*/ ctx[1]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		const out = i => transition_out(each_blocks[i], 1, 1, () => {
			each_blocks[i] = null;
		});

		return {
			c() {
				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_1_anchor = empty();
			},
			m(target, anchor) {
				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(target, anchor);
					}
				}

				insert(target, each_1_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty & /*buyPickaxe, pickaxeDevices*/ 18) {
					each_value = ensure_array_like(/*pickaxeDevices*/ ctx[1]);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
							transition_in(each_blocks[i], 1);
						} else {
							each_blocks[i] = create_each_block(child_ctx);
							each_blocks[i].c();
							transition_in(each_blocks[i], 1);
							each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
						}
					}

					group_outros();

					for (i = each_value.length; i < each_blocks.length; i += 1) {
						out(i);
					}

					check_outros();
				}
			},
			i(local) {
				if (current) return;

				for (let i = 0; i < each_value.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o(local) {
				each_blocks = each_blocks.filter(Boolean);

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(each_1_anchor);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	// (61:4) {#if pickaxeDevices.length == 0}
	function create_if_block(ctx) {
		let div;
		let t1;
		let button;
		let current;

		button = new Button({
				props: {
					$$slots: { default: [create_default_slot_1$1] },
					$$scope: { ctx }
				}
			});

		button.$on("click", /*checkDevices*/ ctx[2]);

		return {
			c() {
				div = element("div");
				div.textContent = "Pickaxes haven't loaded in yet";
				t1 = space();
				create_component(button.$$.fragment);
				attr(div, "class", "notLoaded svelte-1a7yjpn");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				insert(target, t1, anchor);
				mount_component(button, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const button_changes = {};

				if (dirty & /*$$scope*/ 16384) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);
			},
			i(local) {
				if (current) return;
				transition_in(button.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
					detach(t1);
				}

				destroy_component(button, detaching);
			}
		};
	}

	// (68:12) <Button on:click={() => buyPickaxe(device)}>
	function create_default_slot_2$1(ctx) {
		let t0_value = /*device*/ ctx[9].options.text + "";
		let t0;
		let t1;

		return {
			c() {
				t0 = text(t0_value);
				t1 = space();
			},
			m(target, anchor) {
				insert(target, t0, anchor);
				insert(target, t1, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*pickaxeDevices*/ 2 && t0_value !== (t0_value = /*device*/ ctx[9].options.text + "")) set_data(t0, t0_value);
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
				}
			}
		};
	}

	// (67:8) {#each pickaxeDevices as device}
	function create_each_block(ctx) {
		let button;
		let current;

		function click_handler_1() {
			return /*click_handler_1*/ ctx[6](/*device*/ ctx[9]);
		}

		button = new Button({
				props: {
					$$slots: { default: [create_default_slot_2$1] },
					$$scope: { ctx }
				}
			});

		button.$on("click", click_handler_1);

		return {
			c() {
				create_component(button.$$.fragment);
			},
			m(target, anchor) {
				mount_component(button, target, anchor);
				current = true;
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
				const button_changes = {};

				if (dirty & /*$$scope, pickaxeDevices*/ 16386) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);
			},
			i(local) {
				if (current) return;
				transition_in(button.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(button, detaching);
			}
		};
	}

	// (65:8) <Button on:click={checkDevices}>
	function create_default_slot_1$1(ctx) {
		let t;

		return {
			c() {
				t = text("Retry");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (60:0) <Group name="Pickaxes">
	function create_default_slot$3(ctx) {
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;
		const if_block_creators = [create_if_block, create_else_block];
		const if_blocks = [];

		function select_block_type_1(ctx, dirty) {
			if (/*pickaxeDevices*/ ctx[1].length == 0) return 0;
			return 1;
		}

		current_block_type_index = select_block_type_1(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c() {
				if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type_1(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if_blocks[current_block_type_index].d(detaching);
			}
		};
	}

	function create_fragment$3(ctx) {
		let group0;
		let t;
		let group1;
		let current;

		group0 = new Group({
				props: {
					name: "Permits",
					$$slots: { default: [create_default_slot_3$1] },
					$$scope: { ctx }
				}
			});

		group1 = new Group({
				props: {
					name: "Pickaxes",
					$$slots: { default: [create_default_slot$3] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group0.$$.fragment);
				t = space();
				create_component(group1.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group0, target, anchor);
				insert(target, t, anchor);
				mount_component(group1, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group0_changes = {};

				if (dirty & /*$$scope, permitDevices*/ 16385) {
					group0_changes.$$scope = { dirty, ctx };
				}

				group0.$set(group0_changes);
				const group1_changes = {};

				if (dirty & /*$$scope, pickaxeDevices*/ 16386) {
					group1_changes.$$scope = { dirty, ctx };
				}

				group1.$set(group1_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group0.$$.fragment, local);
				transition_in(group1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group0.$$.fragment, local);
				transition_out(group1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}

				destroy_component(group0, detaching);
				destroy_component(group1, detaching);
			}
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		let permitDevices = [];
		let permitPurchaseDevice = null;
		let pickaxeDevices = [];
		let pickaxePurchaseDevice = null;

		const checkDevices = () => {
			let devices = getUnsafeWindow().stores.phaser.scene.worldManager.devices.allDevices;

			// set permit devices
			$$invalidate(0, permitDevices = devices.filter(device => device.options.group === "permit upgrade"));

			permitPurchaseDevice = permitDevices.find(d => d.options.message);
			$$invalidate(0, permitDevices = permitDevices.filter(d => d !== permitPurchaseDevice));

			// set pickaxe devices
			$$invalidate(1, pickaxeDevices = devices.filter(device => device.options.group === "pickaxe upgrade"));

			pickaxePurchaseDevice = pickaxeDevices.find(d => d.options.message);
			$$invalidate(1, pickaxeDevices = pickaxeDevices.filter(d => d !== pickaxePurchaseDevice));
		};

		devicesLoaded.subscribe(val => {
			if (!val) return;
			checkDevices();
		});

		function buyPermit(device) {
			socketManager.sendMessage("MESSAGE_FOR_DEVICE", {
				key: "action",
				deviceId: permitPurchaseDevice.id,
				data: { action: device.id }
			});
		}

		function buyPickaxe(device) {
			socketManager.sendMessage("MESSAGE_FOR_DEVICE", {
				key: "action",
				deviceId: pickaxePurchaseDevice.id,
				data: { action: device.id }
			});
		}

		const click_handler = device => buyPermit(device);
		const click_handler_1 = device => buyPickaxe(device);

		return [
			permitDevices,
			pickaxeDevices,
			checkDevices,
			buyPermit,
			buyPickaxe,
			click_handler,
			click_handler_1
		];
	}

	class Purchasers extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$1, create_fragment$3, safe_not_equal, {}, add_css$1);
		}
	}

	/* src\scripts\digItUp\DigItUp.svelte generated by Svelte v4.2.9 */

	function create_default_slot$2(ctx) {
		let rapidfire;
		let t;
		let purchasers;
		let current;

		rapidfire = new Rapidfire({
				props: {
					message: "Speedmine",
					hotkeyId: "speedMine"
				}
			});

		purchasers = new Purchasers({});

		return {
			c() {
				create_component(rapidfire.$$.fragment);
				t = space();
				create_component(purchasers.$$.fragment);
			},
			m(target, anchor) {
				mount_component(rapidfire, target, anchor);
				insert(target, t, anchor);
				mount_component(purchasers, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(rapidfire.$$.fragment, local);
				transition_in(purchasers.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(rapidfire.$$.fragment, local);
				transition_out(purchasers.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}

				destroy_component(rapidfire, detaching);
				destroy_component(purchasers, detaching);
			}
		};
	}

	function create_fragment$2(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "Dig it Up",
					$$slots: { default: [create_default_slot$2] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope*/ 1) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	class DigItUp extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, null, create_fragment$2, safe_not_equal, {});
		}
	}

	/* src\scripts\knockback\Knockback.svelte generated by Svelte v4.2.9 */

	function create_default_slot$1(ctx) {
		let rapidfire;
		let current;

		rapidfire = new Rapidfire({
				props: {
					message: "Rapid fire",
					hotkeyId: "knockbackRapidFire"
				}
			});

		return {
			c() {
				create_component(rapidfire.$$.fragment);
			},
			m(target, anchor) {
				mount_component(rapidfire, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(rapidfire.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(rapidfire.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(rapidfire, detaching);
			}
		};
	}

	function create_fragment$1(ctx) {
		let group;
		let current;

		group = new Group({
				props: {
					name: "Knockback",
					$$slots: { default: [create_default_slot$1] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(group.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				const group_changes = {};

				if (dirty & /*$$scope*/ 1) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(group, detaching);
			}
		};
	}

	class Knockback extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, null, create_fragment$1, safe_not_equal, {});
		}
	}

	/* src\hud\Hud.svelte generated by Svelte v4.2.9 */

	function add_css(target) {
		append_styles(target, "svelte-1byew0x", "#gc-hud.svelte-1byew0x{position:absolute;top:0;left:0;z-index:9999999999;width:100vw;height:100vh;pointer-events:none;color:var(--textColor)}");
	}

	// (35:12) <Group name="Menu Appearance">
	function create_default_slot_5(ctx) {
		let colorpicker0;
		let t0;
		let colorpicker1;
		let t1;
		let colorpicker2;
		let t2;
		let colorpicker3;
		let current;

		colorpicker0 = new ColorPicker({
				props: {
					text: "Background Color",
					bindValue: "menuBackgroundColor"
				}
			});

		colorpicker1 = new ColorPicker({
				props: {
					text: "Outline Color",
					bindValue: "menuOutlineColor"
				}
			});

		colorpicker2 = new ColorPicker({
				props: {
					text: "Header Color",
					bindValue: "menuHeaderBackgroundColor"
				}
			});

		colorpicker3 = new ColorPicker({
				props: {
					text: "Header Text Color",
					bindValue: "menuHeaderTextColor"
				}
			});

		return {
			c() {
				create_component(colorpicker0.$$.fragment);
				t0 = space();
				create_component(colorpicker1.$$.fragment);
				t1 = space();
				create_component(colorpicker2.$$.fragment);
				t2 = space();
				create_component(colorpicker3.$$.fragment);
			},
			m(target, anchor) {
				mount_component(colorpicker0, target, anchor);
				insert(target, t0, anchor);
				mount_component(colorpicker1, target, anchor);
				insert(target, t1, anchor);
				mount_component(colorpicker2, target, anchor);
				insert(target, t2, anchor);
				mount_component(colorpicker3, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(colorpicker0.$$.fragment, local);
				transition_in(colorpicker1.$$.fragment, local);
				transition_in(colorpicker2.$$.fragment, local);
				transition_in(colorpicker3.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(colorpicker0.$$.fragment, local);
				transition_out(colorpicker1.$$.fragment, local);
				transition_out(colorpicker2.$$.fragment, local);
				transition_out(colorpicker3.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(t2);
				}

				destroy_component(colorpicker0, detaching);
				destroy_component(colorpicker1, detaching);
				destroy_component(colorpicker2, detaching);
				destroy_component(colorpicker3, detaching);
			}
		};
	}

	// (41:12) <Group name="Button Appearance">
	function create_default_slot_4(ctx) {
		let colorpicker0;
		let t;
		let colorpicker1;
		let current;

		colorpicker0 = new ColorPicker({
				props: {
					text: "Background Color",
					bindValue: "buttonBackgroundColor"
				}
			});

		colorpicker1 = new ColorPicker({
				props: {
					text: "Outline Color",
					bindValue: "buttonBorderColor"
				}
			});

		return {
			c() {
				create_component(colorpicker0.$$.fragment);
				t = space();
				create_component(colorpicker1.$$.fragment);
			},
			m(target, anchor) {
				mount_component(colorpicker0, target, anchor);
				insert(target, t, anchor);
				mount_component(colorpicker1, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(colorpicker0.$$.fragment, local);
				transition_in(colorpicker1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(colorpicker0.$$.fragment, local);
				transition_out(colorpicker1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}

				destroy_component(colorpicker0, detaching);
				destroy_component(colorpicker1, detaching);
			}
		};
	}

	// (33:8) <Group name="HUD Appearance">
	function create_default_slot_3(ctx) {
		let colorpicker;
		let t0;
		let group0;
		let t1;
		let group1;
		let current;

		colorpicker = new ColorPicker({
				props: {
					text: "Text Color",
					bindValue: "textColor",
					minOpactiy: 0.3
				}
			});

		group0 = new Group({
				props: {
					name: "Menu Appearance",
					$$slots: { default: [create_default_slot_5] },
					$$scope: { ctx }
				}
			});

		group1 = new Group({
				props: {
					name: "Button Appearance",
					$$slots: { default: [create_default_slot_4] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(colorpicker.$$.fragment);
				t0 = space();
				create_component(group0.$$.fragment);
				t1 = space();
				create_component(group1.$$.fragment);
			},
			m(target, anchor) {
				mount_component(colorpicker, target, anchor);
				insert(target, t0, anchor);
				mount_component(group0, target, anchor);
				insert(target, t1, anchor);
				mount_component(group1, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const group0_changes = {};

				if (dirty & /*$$scope*/ 2) {
					group0_changes.$$scope = { dirty, ctx };
				}

				group0.$set(group0_changes);
				const group1_changes = {};

				if (dirty & /*$$scope*/ 2) {
					group1_changes.$$scope = { dirty, ctx };
				}

				group1.$set(group1_changes);
			},
			i(local) {
				if (current) return;
				transition_in(colorpicker.$$.fragment, local);
				transition_in(group0.$$.fragment, local);
				transition_in(group1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(colorpicker.$$.fragment, local);
				transition_out(group0.$$.fragment, local);
				transition_out(group1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
				}

				destroy_component(colorpicker, detaching);
				destroy_component(group0, detaching);
				destroy_component(group1, detaching);
			}
		};
	}

	// (32:4) <Menu name="Customization">
	function create_default_slot_2(ctx) {
		let group;
		let t0;
		let resetstyles;
		let t1;
		let cosmeticpicker;
		let t2;
		let customtheme;
		let current;

		group = new Group({
				props: {
					name: "HUD Appearance",
					$$slots: { default: [create_default_slot_3] },
					$$scope: { ctx }
				}
			});

		resetstyles = new ResetStyles({});
		cosmeticpicker = new CosmeticPicker({});
		customtheme = new CustomTheme({});

		return {
			c() {
				create_component(group.$$.fragment);
				t0 = space();
				create_component(resetstyles.$$.fragment);
				t1 = space();
				create_component(cosmeticpicker.$$.fragment);
				t2 = space();
				create_component(customtheme.$$.fragment);
			},
			m(target, anchor) {
				mount_component(group, target, anchor);
				insert(target, t0, anchor);
				mount_component(resetstyles, target, anchor);
				insert(target, t1, anchor);
				mount_component(cosmeticpicker, target, anchor);
				insert(target, t2, anchor);
				mount_component(customtheme, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const group_changes = {};

				if (dirty & /*$$scope*/ 2) {
					group_changes.$$scope = { dirty, ctx };
				}

				group.$set(group_changes);
			},
			i(local) {
				if (current) return;
				transition_in(group.$$.fragment, local);
				transition_in(resetstyles.$$.fragment, local);
				transition_in(cosmeticpicker.$$.fragment, local);
				transition_in(customtheme.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(group.$$.fragment, local);
				transition_out(resetstyles.$$.fragment, local);
				transition_out(cosmeticpicker.$$.fragment, local);
				transition_out(customtheme.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(t2);
				}

				destroy_component(group, detaching);
				destroy_component(resetstyles, detaching);
				destroy_component(cosmeticpicker, detaching);
				destroy_component(customtheme, detaching);
			}
		};
	}

	// (51:4) <Menu name="General Cheats">
	function create_default_slot_1(ctx) {
		let autoanswer;
		let t0;
		let instantuse;
		let t1;
		let movement;
		let t2;
		let playerhighlighter;
		let t3;
		let freecam;
		let t4;
		let hideenergypopup;
		let current;
		autoanswer = new AutoAnswer({});
		instantuse = new InstantUse({});
		movement = new Movement({});
		playerhighlighter = new PlayerHighlighter({});
		freecam = new Freecam({});
		hideenergypopup = new HideEnergyPopup({});

		return {
			c() {
				create_component(autoanswer.$$.fragment);
				t0 = space();
				create_component(instantuse.$$.fragment);
				t1 = space();
				create_component(movement.$$.fragment);
				t2 = space();
				create_component(playerhighlighter.$$.fragment);
				t3 = space();
				create_component(freecam.$$.fragment);
				t4 = space();
				create_component(hideenergypopup.$$.fragment);
			},
			m(target, anchor) {
				mount_component(autoanswer, target, anchor);
				insert(target, t0, anchor);
				mount_component(instantuse, target, anchor);
				insert(target, t1, anchor);
				mount_component(movement, target, anchor);
				insert(target, t2, anchor);
				mount_component(playerhighlighter, target, anchor);
				insert(target, t3, anchor);
				mount_component(freecam, target, anchor);
				insert(target, t4, anchor);
				mount_component(hideenergypopup, target, anchor);
				current = true;
			},
			i(local) {
				if (current) return;
				transition_in(autoanswer.$$.fragment, local);
				transition_in(instantuse.$$.fragment, local);
				transition_in(movement.$$.fragment, local);
				transition_in(playerhighlighter.$$.fragment, local);
				transition_in(freecam.$$.fragment, local);
				transition_in(hideenergypopup.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(autoanswer.$$.fragment, local);
				transition_out(instantuse.$$.fragment, local);
				transition_out(movement.$$.fragment, local);
				transition_out(playerhighlighter.$$.fragment, local);
				transition_out(freecam.$$.fragment, local);
				transition_out(hideenergypopup.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(t2);
					detach(t3);
					detach(t4);
				}

				destroy_component(autoanswer, detaching);
				destroy_component(instantuse, detaching);
				destroy_component(movement, detaching);
				destroy_component(playerhighlighter, detaching);
				destroy_component(freecam, detaching);
				destroy_component(hideenergypopup, detaching);
			}
		};
	}

	// (60:4) <Menu name="Gamemode Specific Cheats">
	function create_default_slot(ctx) {
		let classicautopurchase;
		let t0;
		let richautopurchase;
		let t1;
		let digitup;
		let t2;
		let knockback;
		let t3;
		let ctf;
		let t4;
		let tag;
		let t5;
		let onewayout;
		let t6;
		let snowbrawl;
		let t7;
		let floorislava;
		let t8;
		let showimposters;
		let t9;
		let farmchain;
		let current;
		classicautopurchase = new AutoPurchase$1({});
		richautopurchase = new AutoPurchase({});
		digitup = new DigItUp({});
		knockback = new Knockback({});
		ctf = new Ctf({});
		tag = new Tag({});
		onewayout = new OneWayOut({});
		snowbrawl = new Snowbrawl({});
		floorislava = new FloorIsLava({});
		showimposters = new ShowImposters({});
		farmchain = new Farmchain({});

		return {
			c() {
				create_component(classicautopurchase.$$.fragment);
				t0 = space();
				create_component(richautopurchase.$$.fragment);
				t1 = space();
				create_component(digitup.$$.fragment);
				t2 = space();
				create_component(knockback.$$.fragment);
				t3 = space();
				create_component(ctf.$$.fragment);
				t4 = space();
				create_component(tag.$$.fragment);
				t5 = space();
				create_component(onewayout.$$.fragment);
				t6 = space();
				create_component(snowbrawl.$$.fragment);
				t7 = space();
				create_component(floorislava.$$.fragment);
				t8 = space();
				create_component(showimposters.$$.fragment);
				t9 = space();
				create_component(farmchain.$$.fragment);
			},
			m(target, anchor) {
				mount_component(classicautopurchase, target, anchor);
				insert(target, t0, anchor);
				mount_component(richautopurchase, target, anchor);
				insert(target, t1, anchor);
				mount_component(digitup, target, anchor);
				insert(target, t2, anchor);
				mount_component(knockback, target, anchor);
				insert(target, t3, anchor);
				mount_component(ctf, target, anchor);
				insert(target, t4, anchor);
				mount_component(tag, target, anchor);
				insert(target, t5, anchor);
				mount_component(onewayout, target, anchor);
				insert(target, t6, anchor);
				mount_component(snowbrawl, target, anchor);
				insert(target, t7, anchor);
				mount_component(floorislava, target, anchor);
				insert(target, t8, anchor);
				mount_component(showimposters, target, anchor);
				insert(target, t9, anchor);
				mount_component(farmchain, target, anchor);
				current = true;
			},
			i(local) {
				if (current) return;
				transition_in(classicautopurchase.$$.fragment, local);
				transition_in(richautopurchase.$$.fragment, local);
				transition_in(digitup.$$.fragment, local);
				transition_in(knockback.$$.fragment, local);
				transition_in(ctf.$$.fragment, local);
				transition_in(tag.$$.fragment, local);
				transition_in(onewayout.$$.fragment, local);
				transition_in(snowbrawl.$$.fragment, local);
				transition_in(floorislava.$$.fragment, local);
				transition_in(showimposters.$$.fragment, local);
				transition_in(farmchain.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(classicautopurchase.$$.fragment, local);
				transition_out(richautopurchase.$$.fragment, local);
				transition_out(digitup.$$.fragment, local);
				transition_out(knockback.$$.fragment, local);
				transition_out(ctf.$$.fragment, local);
				transition_out(tag.$$.fragment, local);
				transition_out(onewayout.$$.fragment, local);
				transition_out(snowbrawl.$$.fragment, local);
				transition_out(floorislava.$$.fragment, local);
				transition_out(showimposters.$$.fragment, local);
				transition_out(farmchain.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(t2);
					detach(t3);
					detach(t4);
					detach(t5);
					detach(t6);
					detach(t7);
					detach(t8);
					detach(t9);
				}

				destroy_component(classicautopurchase, detaching);
				destroy_component(richautopurchase, detaching);
				destroy_component(digitup, detaching);
				destroy_component(knockback, detaching);
				destroy_component(ctf, detaching);
				destroy_component(tag, detaching);
				destroy_component(onewayout, detaching);
				destroy_component(snowbrawl, detaching);
				destroy_component(floorislava, detaching);
				destroy_component(showimposters, detaching);
				destroy_component(farmchain, detaching);
			}
		};
	}

	function create_fragment(ctx) {
		let div;
		let menu0;
		let t0;
		let menu1;
		let t1;
		let menu2;
		let current;

		menu0 = new Menu({
				props: {
					name: "Customization",
					$$slots: { default: [create_default_slot_2] },
					$$scope: { ctx }
				}
			});

		menu1 = new Menu({
				props: {
					name: "General Cheats",
					$$slots: { default: [create_default_slot_1] },
					$$scope: { ctx }
				}
			});

		menu2 = new Menu({
				props: {
					name: "Gamemode Specific Cheats",
					$$slots: { default: [create_default_slot] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				div = element("div");
				create_component(menu0.$$.fragment);
				t0 = space();
				create_component(menu1.$$.fragment);
				t1 = space();
				create_component(menu2.$$.fragment);
				attr(div, "id", "gc-hud");
				set_style(div, "display", /*$showHud*/ ctx[0] ? 'block' : 'none');
				attr(div, "class", "svelte-1byew0x");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				mount_component(menu0, div, null);
				append(div, t0);
				mount_component(menu1, div, null);
				append(div, t1);
				mount_component(menu2, div, null);
				current = true;
			},
			p(ctx, [dirty]) {
				const menu0_changes = {};

				if (dirty & /*$$scope*/ 2) {
					menu0_changes.$$scope = { dirty, ctx };
				}

				menu0.$set(menu0_changes);
				const menu1_changes = {};

				if (dirty & /*$$scope*/ 2) {
					menu1_changes.$$scope = { dirty, ctx };
				}

				menu1.$set(menu1_changes);
				const menu2_changes = {};

				if (dirty & /*$$scope*/ 2) {
					menu2_changes.$$scope = { dirty, ctx };
				}

				menu2.$set(menu2_changes);

				if (!current || dirty & /*$showHud*/ 1) {
					set_style(div, "display", /*$showHud*/ ctx[0] ? 'block' : 'none');
				}
			},
			i(local) {
				if (current) return;
				transition_in(menu0.$$.fragment, local);
				transition_in(menu1.$$.fragment, local);
				transition_in(menu2.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(menu0.$$.fragment, local);
				transition_out(menu1.$$.fragment, local);
				transition_out(menu2.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_component(menu0);
				destroy_component(menu1);
				destroy_component(menu2);
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		let $showHud;
		component_subscribe($$self, showHud, $$value => $$invalidate(0, $showHud = $$value));

		keybindManager.addKeybind(new Set(["\\"]), () => {
			showHud.update(v => !v);
		});

		return [$showHud];
	}

	class Hud extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance, create_fragment, safe_not_equal, {}, add_css);
		}
	}

	async function createHud() {
	    if (!document.body) {
	        await new Promise(res => window.addEventListener('DOMContentLoaded', res));
	    }
	    new Hud({
	        target: document.body
	    });
	    addVars();
	}

	const selector = 'script[src^="/index"][type="module"]';
	function setup() {
	    const script = document.querySelector(selector);
	    if (script) {
	        addModifiedScript(script.src);
	        console.log("GC: Added modified script", script);
	        return;
	    }
	    let observer = new MutationObserver((mutations) => {
	        for (let mutation of mutations) {
	            for (let node of mutation.addedNodes) {
	                if (node instanceof HTMLScriptElement && node.src.includes("/index") && node.type == "module") {
	                    addModifiedScript(node.src);
	                    console.log("GC: Added modified script", node);
	                    observer.disconnect();
	                }
	            }
	        }
	    });
	    const attachObserver = () => {
	        observer.observe(document.head, {
	            childList: true
	        });
	    };
	    if (document.head)
	        attachObserver();
	    else
	        document.addEventListener('DOMContentLoaded', attachObserver);
	}
	function addModifiedScript(src) {
	    console.log(src);
	    // we want to manually fetch the script so we can modify it
	    fetch(src)
	        .then(response => response.text())
	        .then(text => {
	        // find the five character id (plus quotes) of the script we want to get
	        // eg: ,"5CPH7":"App.83745002.js",
	        const index = text.indexOf(':"App.');
	        if (!index) {
	            alert("GC: Failed to find the correct script to modify. Please open an issue on GitHub.");
	            return;
	        }
	        const id = text.substring(index - 7, index);
	        const scriptModuleIndex = text.lastIndexOf(').register(JSON.parse(', index);
	        const scriptModuleId = text.substring(scriptModuleIndex - 7, scriptModuleIndex);
	        const regex = new RegExp(`import\\("\\.\\/"\\+(.)\\(${scriptModuleId}\\)\\.resolve\\(${id}\\)\\)`, 'g');
	        // get the wildcard character
	        const wildcard = regex.exec(text)?.[1];
	        if (!wildcard) {
	            alert("GC: Failed to find the correct script to modify. Please open an issue on GitHub.");
	            return;
	        }
	        text = text.replace(regex, `new Promise(async (resolve) => {
    const src = "./"+${wildcard}(${scriptModuleId}).resolve(${id})
    console.log(src)
    const res = await fetch(src)
    let text = await res.text()
    const endRegex = /assignment:new\\(0,(.)\\.default\\)\\}/
    const endRes = endRegex.exec(text)
    const varRegex = /(.)={network:new/
    const varRes = varRegex.exec(text)
    if(!endRes[1] || !varRes[1]) {
        alert("GC: Failed to find the correct script to modify. Please open an issue on GitHub.")
        return;
    }
    text = text.replace(endRegex, 'assignment:new(0,'+endRes[1]+'.default)};window.stores='+varRes[1]+';window.storesLoaded.set(true);console.log("GC: Stores loaded via intercept");')

    const script = document.createElement('script');
    try {
        script.appendChild(document.createTextNode(text));
        document.head.appendChild(script);
    } catch(e) { 
        script.text = text;
        document.head.appendChild(script);
    }
    setTimeout(resolve, 0)
})`);
	        // replace all "./" with "/"
	        text = text.replace(/"\.\/"/g, '"/"');
	        // create a new script element with the modified url
	        const script = document.createElement('script');
	        script.type = "module";
	        document.querySelector("#root")?.remove();
	        let root = document.createElement('div');
	        root.id = "root";
	        document.body.appendChild(root);
	        try {
	            script.appendChild(document.createTextNode(text));
	            document.head.appendChild(script);
	        }
	        catch (e) {
	            script.text = text;
	            document.head.appendChild(script);
	        }
	    });
	}

	// mostly copied from https://github.com/TheLazySquid/Gimloader/blob/main/src/parcel/parcel.ts
	// which was inspired by https://codeberg.org/gimhook/gimhook
	class Parcel extends EventTarget {
	    _parcelModuleCache = {};
	    _parcelModules = {};
	    reqIntercepts = [];
	    readyToIntercept = true;
	    constructor() {
	        super();
	        let existingScripts = document.querySelectorAll('script[src*="index"]:not([nomodule])');
	        if (existingScripts.length > 0) {
	            this.readyToIntercept = false;
	            if (document.readyState === 'complete') {
	                this.setup();
	                this.reloadExistingScripts(existingScripts);
	            }
	            else {
	                window.addEventListener('load', () => {
	                    this.setup();
	                    this.reloadExistingScripts(existingScripts);
	                });
	            }
	        }
	        else
	            this.setup();
	        getUnsafeWindow().decachedImport = this.decachedImport.bind(this);
	    }
	    async reloadExistingScripts(existingScripts) {
	        // nuke the dom
	        this.nukeDom();
	        this.readyToIntercept = true;
	        this.emptyModules();
	        existingScripts.forEach(script => {
	            // re-import the script since it's already loaded
	            console.log(script, 'has already loaded, re-importing...');
	            this.decachedImport(script.src);
	            script.remove();
	        });
	    }
	    nukeDom() {
	        document.querySelector("#root")?.remove();
	        let newRoot = document.createElement('div');
	        newRoot.id = 'root';
	        document.body.appendChild(newRoot);
	        // remove all global variables
	        let vars = ["__mobxGlobals", "__mobxInstanceCount"];
	        for (let v of vars) {
	            if (v in window)
	                delete window[v];
	        }
	    }
	    async decachedImport(url) {
	        let src = new URL(url, location.origin).href;
	        let res = await fetch(src);
	        let text = await res.text();
	        // nasty hack to prevent the browser from caching other scripts
	        text = text.replaceAll('import(', 'window.decachedImport(');
	        text = text.replaceAll('import.meta.url', `'${src}'`);
	        let blob = new Blob([text], { type: 'application/javascript' });
	        let blobUrl = URL.createObjectURL(blob);
	        return import(blobUrl);
	    }
	    emptyModules() {
	        this._parcelModuleCache = {};
	        this._parcelModules = {};
	    }
	    interceptRequire(match, callback, once = false) {
	        if (!match || !callback)
	            throw new Error('match and callback are required');
	        let intercept = { match, callback, once };
	        this.reqIntercepts.push(intercept);
	        // return a cancel function
	        return () => {
	            let index = this.reqIntercepts.indexOf(intercept);
	            if (index !== -1)
	                this.reqIntercepts.splice(index, 1);
	        };
	    }
	    setup() {
	        let requireHook;
	        ((requireHook = (moduleName) => {
	            if (moduleName in this._parcelModuleCache) {
	                return this._parcelModuleCache[moduleName].exports;
	            }
	            if (moduleName in this._parcelModules) {
	                let moduleCallback = this._parcelModules[moduleName];
	                delete this._parcelModules[moduleName];
	                let moduleObject = {
	                    id: moduleName,
	                    exports: {}
	                };
	                this._parcelModuleCache[moduleName] = moduleObject;
	                moduleCallback.call(moduleObject.exports, moduleObject, moduleObject.exports);
	                // run intercepts
	                if (this.readyToIntercept) {
	                    for (let intercept of this.reqIntercepts) {
	                        if (intercept.match(moduleObject.exports)) {
	                            let returned = intercept.callback?.(moduleObject.exports);
	                            if (returned)
	                                moduleObject.exports = returned;
	                            if (intercept.once) {
	                                this.reqIntercepts.splice(this.reqIntercepts.indexOf(intercept), 1);
	                            }
	                        }
	                    }
	                }
	                return moduleObject.exports;
	            }
	            throw new Error(`Cannot find module '${moduleName}'`);
	        }
	        // @ts-ignore
	        ).register = (moduleName, moduleCallback) => {
	            this._parcelModules[moduleName] = moduleCallback;
	            // remove it from the cache if it's already been loaded
	            if (moduleName in this._parcelModuleCache) {
	                delete this._parcelModuleCache[moduleName];
	            }
	        });
	        Object.defineProperty(getUnsafeWindow(), "parcelRequire388b", {
	            value: requireHook,
	            writable: false,
	            enumerable: true,
	            configurable: false
	        });
	    }
	}

	// confirm that no amplitude.com script exists
	let gameLoaded = document.querySelector('script[src*="amplitude.com"]') !== null;
	if (gameLoaded) {
	    alert("This script can only be run before you join the game. Please reload the page and try again.");
	}
	else {
	    let parcel = new Parcel();
	    exposeValues(parcel);
	    setup();
	    socketManager.setup();
	    createHud();
	}

})();
