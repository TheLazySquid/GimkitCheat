import { PurchaseMenu } from "../../interfaces";

const purchases: PurchaseMenu = {
    "Capture The Flag": [
        {
            displayName: "Speed Upgrade",
            selector: {
                grantedItemName: "Speed Upgrade",
            },
            reusable: false
        },
        {
            displayName: "Efficiency Upgrade",
            selector: {
                grantedItemName: "Efficiency Upgrade",
            },
            reusable: false
        },
        {
            displayName: "Energy Per Question Upgrade",
            selector: {
                grantedItemName: "Energy Per Question Upgrade",
            },
            reusable: false
        },
        {
            displayName: "InvisaBits",
            selector: {
                grantedItemId: "silver-ore"
            },
            reusable: true
        }
    ],
    "Tag": [
        {
            displayName: "Speed Upgrade",
            selector: {
                grantedItemName: "Speed Upgrade"
            },
            reusable: false
        },
        {
            displayName: "Efficiency Upgrade",
            selector: {
                grantedItemName: "Efficiency Upgrade"
            },
            reusable: false
        },
        {
            displayName: "Energy Per Question Upgrade",
            selector: {
                grantedItemName: "Energy Per Question Upgrade"
            },
            reusable: false
        },
        {
            displayName: "Endurance Upgrade",
            selector: {
                grantedItemName: "Endurance Upgrade"
            },
            reusable: false
        }
    ],
    "Snowbrawl": [
        {
            displayName: "Med Pack",
            selector: {
                grantedItemId: "medpack"
            },
            reusable: true
        },
        {
            displayName: "Shield Can",
            selector: {
                grantedItemId: "shield-can"
            },
            reusable: true
        }
    ],
    "Farmchain": {
        "Seeds": [
            {
                displayName: "Corn Seed",
                selector: {
                    grantedItemId: "yellow-seed"
                },
                reusable: true
            },
            {
                displayName: "Wheat Seed",
                selector: {
                    grantedItemId: "tan-seed",
                    grantAction: "Grant Item"
                },
                reusable: true
            },
            {
                displayName: "Potato Seed",
                selector: {
                    grantedItemId: "brown-seed"
                },
                reusable: true
            },
            {
                displayName: "Grape Seed",
                selector: {
                    grantedItemId: "purple-seed"
                },
                reusable: true
            },
            {
                displayName: "Raspberry Seed",
                selector: {
                    grantedItemId: "magenta-seed"
                },
                reusable: true
            },
            {
                displayName: "Watermelon Seed",
                selector: {
                    grantedItemId: "green-seed"
                },
                reusable: true
            },
            {
                displayName: "Coffee Bean",
                selector: {
                    grantedItemId: "bronze-seed"
                },
                reusable: true
            },
            {
                displayName: "Orange Seed",
                selector: {
                    grantedItemId: "orange-seed"
                },
                reusable: true
            },
            {
                displayName: "Gimberry Seed",
                selector: {
                    grantedItemId: "gold-seed"
                },
                reusable: true
            },
            {
                displayName: "Cash Berry Seed",
                selector: {
                    grantedItemId: "dark-green-seed"
                },
                reusable: true
            },
            {
                displayName: "Pepper Seed",
                selector: {
                    grantedItemId: "red-seed"
                },
                reusable: true
            },
            {
                displayName: "Energy Bar Seed",
                selector: {
                    grantedItemId: "blue-seed"
                },
                reusable: true
            },
            {
                displayName: "Lottery Ticket Seed",
                selector: {
                    grantedItemId: "teal-seed"
                },
                reusable: true
            }
        ],
        "Seed Unlocks": [
            {
                displayName: "Wheat Seed Unlock",
                selector: {
                    grantedItemName: "Wheat Seed Unlock"
                },
                reusable: false
            },
            {
                displayName: "Potato Seed Unlock",
                selector: {
                    grantedItemName: "Potato Seed Unlock"
                },
                reusable: false
            },
            {
                displayName: "Grape Seed Unlock",
                selector: {
                    grantedItemName: "Grape Seed Unlock"
                },
                reusable: false
            },
            {
                displayName: "Raspberry Seed Unlock",
                selector: {
                    grantedItemName: "Raspberry Seed Unlock"
                },
                reusable: false
            },
            {
                displayName: "Watermelon Seed Unlock",
                selector: {
                    grantedItemName: "Watermelon Seed Unlock"
                },
                reusable: false
            },
            {
                displayName: "Coffee Bean Seed Unlock",
                selector: {
                    grantedItemName: "Coffee Bean Seed Unlock"
                },
                reusable: false
            },
            {
                displayName: "Orange Seed Unlock",
                selector: {
                    grantedItemName: "Orange Seed Unlock"
                },
                reusable: false
            },
            {
                displayName: "Gimberry Seed Unlock",
                selector: {
                    grantedItemName: "Gimberry Seed Unlock"
                },
                reusable: false
            }
        ]
    }
};

export default purchases;