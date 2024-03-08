<script lang="ts">
    import { onMount } from "svelte";
    import { findMatchingParent } from "../utils";
    import Button from "./components/Button.svelte";

    export let name: string;

    let groupEl: HTMLDivElement;
    let lastGroupEl: HTMLDivElement;
    let parentMenu: HTMLDivElement;

    function slide(el: HTMLElement, direction: 'in' | 'out', side: 'left' | 'right') {
        el.style.animation = `slide-${direction}-${side} 0.2s ease-in-out forwards`;

        if(direction == 'out') {
            el.classList.remove('open');
            setTimeout(() => {
                el.style.display = 'none';
            }, 200);
        } else {
            el.style.display = 'flex';
            el.classList.add('open');
        }
    }

    function openGroup() {
        // find the previously opened group
        lastGroupEl = parentMenu.querySelector('.groupContent.open') as HTMLDivElement;
        // slide it out to the left
        if(lastGroupEl) slide(lastGroupEl, 'out', 'left');

        slide(groupEl, 'in', 'right');
    }

    function closeGroup() {
        slide(groupEl, 'out', 'right');
        if(lastGroupEl) slide(lastGroupEl, 'in', 'left');
    }

    onMount(() => {
        parentMenu = findMatchingParent(groupEl, '.menu .children') as HTMLDivElement;
        parentMenu.appendChild(groupEl);
    })
</script>

<Button on:click={openGroup}>
    {name}
</Button>

<div class="groupContent" bind:this={groupEl}>
    <Button on:click={closeGroup}>
        Close
    </Button>
    <slot />
</div>

<style lang="scss">
    .groupContent {
        transform: translateX(100%);
        opacity: 0;
        pointer-events: none;
        display: none;
    }

    @mixin slide($name, $entering: false, $start: 0%, $end: 100%) {
        @keyframes #{$name} {
            0% {
                transform: translateX($start);
                @if $entering {
                    opacity: 0;
                    pointer-events: none;
                } @else {
                    opacity: 1;
                    pointer-events: all;
                }
            }
    
            100% {
                transform: translateX($end);
                @if $entering {
                    opacity: 1;
                    pointer-events: all;
                } @else {
                    opacity: 0;
                    pointer-events: none;
                }
            }
        }
    }

    @include slide('-global-slide-in-left', true, -100%, 0%);
    @include slide('-global-slide-out-left', false, 0%, -100%);
    @include slide('-global-slide-in-right', true, 100%, 0%);
    @include slide('-global-slide-out-right', false, 0%, 100%);
</style>