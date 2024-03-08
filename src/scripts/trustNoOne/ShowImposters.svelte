<script lang="ts">
    import Group from "../../hud/Group.svelte";
    import socketManager from "../../network/socketManager";

    let imposterNames = [];

    socketManager.addEventListener("blueboatMessage", (e: CustomEvent<any>) => {
        if(e.detail.key == "IMPOSTER_MODE_PEOPLE") {
            let imposters = e.detail.data.filter((person: any) => person.role == "imposter");
            imposterNames = imposters.map((person: any) => person.name);
        }
    });
</script>

<Group name="Trust No One">
    <div>
        <p>
            This script will only work if you don't join mid-game.
        </p>
        Imposters: {imposterNames.length == 0 ? "Waiting..." : imposterNames.join(", ")}
    </div>
</Group>

<style>
    div {
        padding-left: 10px;
        padding-right: 10px;
    }
</style>