<script lang="ts">
    import debounce from "debounce";
    import { onMount, onDestroy } from "svelte";
    import { get } from "svelte/store";
    import { spring } from "svelte/motion";
    import { getMenuTransform, setMenuTransform } from "./hudVarsManager";
    import { showHud } from "../stores";
    
    export let name: string;

    // This whole file is a mess, but it's a mess that works*

    let transform = getMenuTransform(name);

    let x = transform?.x ?? 50;
    let y = transform?.y ?? 50;
    let width = transform?.width ?? 200;
    let height = transform?.height ?? 200;

    let lastWidth = width;
    let lastHeight = height;

    let coordSpring = spring(moveInbounds( x, y ), {
        stiffness: 0.1,
        damping: 0.5
    });

    let coords = get(coordSpring);
    let returnX: number = coords.x;
    let returnY: number = coords.y;

    function onResize() {
        let coords = get(coordSpring);
        coordSpring.set(moveInbounds(coords.x, coords.y));
    }

    function moveInbounds(x: number, y: number) {
        if(x < 0) x = 0;
        if(y < 0) y = 0;
        if(x + lastWidth > window.innerWidth) x = window.innerWidth - lastWidth;
        if(y + lastHeight > window.innerHeight) y = window.innerHeight - lastHeight;
        return { x, y };
    }

    let transitioning = false;

    // move out of the way when the hud is hidden
    showHud.subscribe((v) => {
        if(v) {
            coordSpring.set(moveInbounds(returnX, returnY));
            transitioning = false;
        } else {
            transitioning = true;
            let coords = get(coordSpring);

            // move over the nearest edge
            let cX = coords.x + lastWidth / 2;
            let cY = coords.y + lastHeight / 2;

            let endX = cX < window.innerWidth / 2 ? -lastWidth : window.innerWidth;
            let endY = cY < window.innerHeight / 2 ? -lastHeight : window.innerHeight;
            
            if(Math.abs(endX - coords.x) < Math.abs(endY - coords.y)) {
                coordSpring.set({ x: endX, y: coords.y });
            } else {
                coordSpring.set({ x: coords.x, y: endY });
            }
        }
    })

    let element: HTMLDivElement;

    let minimized = transform?.minimized ?? false;
    let dragState = 'waiting';
    let startX: number, startY: number;
    let dragDistance: number;

    function startDrag(event: MouseEvent) {
        dragState = 'checking';
        const coords = get(coordSpring)
        startX = event.clientX - coords.x;
        startY = event.clientY - coords.y;
        dragDistance = 0;
    }

    function saveTransform() {
        if(transitioning) return;
        let coords = get(coordSpring);
        setMenuTransform(name, {
            x: coords.x,
            y: coords.y,
            width: lastWidth,
            height: lastHeight,
            minimized
        })
    }

    const saveTransformDebounce = debounce(saveTransform, 100);
    coordSpring.subscribe(() => saveTransformDebounce())

    function drag(event: MouseEvent) {
        if(dragState == 'waiting') return;
        dragDistance += Math.abs(event.movementX) + Math.abs(event.movementY);

        if(dragState == 'checking' && dragDistance > 5) {
            dragState = 'dragging';
            return;
        }

        if(dragState == 'dragging') {
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

    let observer = new ResizeObserver((entries) => {
        dragState = 'waiting';
        let entry = entries[0];
        if(!minimized) {
            lastHeight = entry.contentRect.height;
        }
        lastWidth = entry.contentRect.width;
        saveTransformDebounce();
    });

    onMount(() => {
        observer.observe(element);
        element.style.height = `${Math.max(height, 21)}px`;
        element.style.width = `${Math.max(width, 150)}px`;
    });

    onDestroy(() => {
        observer.disconnect();
    });

    function toggleMinimized() {
        minimized = !minimized;
        saveTransformDebounce();
    }
</script>

<svelte:window on:mouseup={ stopDrag } on:mousemove={ drag } on:resize={onResize} />

<!-- svelte-ignore a11y-no-static-element-interactions-->
<div class="menu" class:minimized={ minimized } bind:this={ element }
on:mousedown={ startDrag }
style="left: { $coordSpring.x }px; top: { $coordSpring.y }px;">
    <div class="header">
        {name}
        <button class="minimize" on:click={toggleMinimized}>
            {minimized ? "+" : "-"}
        </button>
    </div>
    <div class="children">
        <div class="groupContent open">
            <slot />
        </div>
    </div>
</div>

<style>
    .menu {
        position: absolute;
        background-color: var(--menuBackgroundColor);
        resize: both;
        overflow: hidden;
        min-width: 150px;
        border-radius: 5px;
        user-select: none;
        pointer-events: all;
        outline-width: 3px;
        outline-style: solid;
        outline-color: var(--menuOutlineColor);
    }

    .children {
        position: relative;
        height: calc(100% - 21px);
        overflow-x: hidden;
        overflow-y: auto;
    }

    :global(.groupContent) {
        position: absolute;
        top: 0;
        left: 0;
        display: flex;
        flex-direction: column;
        width: 100%;
    }

    .groupContent {
        transform: translateX(0);
        opacity: 1;
        pointer-events: all;
    }

    .menu.minimized {
        overflow: hidden;
        resize: horizontal;
        height: 21px !important;
    }

    .header {
        background-color: var(--menuHeaderBackgroundColor);
        position: relative;
        color: var(--menuHeaderTextColor);
        width: 100%;
        text-align: center;
        font-size: 14px;
        height: 21px;
    }

    .minimize {
        background-color: transparent;
        border: none;
        align-items: center;
        position: absolute;
        right: 5px;
        top: 0;
        cursor: pointer;
    }
</style>