<script lang="ts">
    import ToggleButton from "../../hud/components/ToggleButton.svelte";

    let popupEl: HTMLElement;
    let hiding = false;

    let observer = new MutationObserver((mutations) => {
        for(let mutation of mutations) {
            for(let node of mutation.addedNodes) {
                if(node.nodeType != Node.ELEMENT_NODE) continue;

                // check that the element is the energy popup
                if(
                    (node as HTMLElement).matches(".maxAll.flex.hc") &&
                    (node as HTMLElement).querySelector("img[src^='/assets/map/inventory/resources/']")
                ) {
                    popupEl = node as HTMLElement;
                    if(hiding) popupEl.style.display = "none";
                }
            }
        }
    })

    const attach = () => {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        })
    }
    if(document.body) attach();
    else window.addEventListener("DOMContentLoaded", attach);

    function toggleEnergyPopup(event: CustomEvent<boolean>) {
        hiding = event.detail;
        if(!popupEl) return;
        popupEl.style.display = hiding ? "none" : "";
    }
</script>

<ToggleButton onText="Show Energy Popup" offText="Hide Energy Popup"
on:click={toggleEnergyPopup} hotkeyId="toggleEnergyPopup" />