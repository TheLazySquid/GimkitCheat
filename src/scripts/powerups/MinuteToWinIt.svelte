<script lang="ts">
    import Group from "../../hud/Group.svelte";
    import Button from "../../hud/components/Button.svelte";
    import Dropdown from "../../hud/components/Dropdown.svelte";

    let selectedOption = "";

    function handleDropdownChange(event) {
        selectedOption = event.detail.selected;
        console.log("Selected option:", selectedOption);
}
</script>

<Group name="Minute To Win It">

    <Dropdown
    placeholder="Buy When"
    options={[
    { label: "Test1", value: "test1" },
    { label: "TEST2", value: "test2" },
    { label: "test 3", value: "test3" }
    ]}
    on:change={handleDropdownChange}
    />


    <Dropdown
    placeholder="Use When"
    options={[
    { label: "Test11", value: "test1" },
    { label: "TEST22", value: "test2" },
    { label: "test 33", value: "test3" }
    ]}
    on:change={handleDropdownChange}
    />
</Group>