<script lang="ts">
    import Group from "../../hud/Group.svelte";
    import Dropdown from "../../hud/components/Dropdown.svelte";
    import socketManager from '../../network/socketManager'

    let selectedOption = "";

    // Function to handle when an upgrade is bought
    function BuyChange(event) {
        selectedOption = event.detail.selected;
        
        // Listen for the blueboatMessage event
        socketManager.addEventListener("blueboatMessage", (e: CustomEvent<any>) => {
            const data = e.detail.data;

            // Check if the message type is "UPGRADE_LEVELS"
            if (data?.type === "UPGRADE_LEVELS") {

                console.log(data.value)
                console.log(JSON.stringify(data.value))
                
                if (JSON.stringify(data.value).includes(selectedOption)) {
                    console.log("I see you bought " + selectedOption);
                    alert("You got what you selected SIGMA")
                }
                
            }
        });
    }

    // Function to handle when an upgrade is used
    function UseChange(event) {
        selectedOption = event.detail.selected;
        // Handle use change here if needed
    }
</script>

<Group name="Mega Bonus">
    <!-- Dropdown for buying upgrades -->
    <Dropdown
        placeholder="Buy When"
        options={[
            { label: "Multiplier Lvl 1", value: "multiplier:1" },
            { label: "Multiplier Lvl 2", value: "multiplier:2" },
            { label: "Multiplier Lvl 3", value: "multiplier:3" }
        ]}
        on:change={BuyChange}
    />

    <!-- Dropdown for using upgrades -->
    <Dropdown
        placeholder="Use When"
        options={[
            { label: "Multiplier Lvl 1", value: "multiplier1use" },
            { label: "Multiplier Lvl 2", value: "multiplier2use" },
            { label: "Multiplier Lvl 3", value: "multiplier3use" }
        ]}
        on:change={UseChange}
    />
</Group>
