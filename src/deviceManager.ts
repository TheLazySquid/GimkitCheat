export default class DeviceManager {
    cheat: any;
    devices: any[] = [];

    constructor(cheat: any) {
        this.cheat = cheat;

        this.cheat.socketHandler.addEventListener("recieveMessage", (e: CustomEvent) => {
            // listen for when the devices are sent through or updated
            if(e.detail?.devices) {
                this.updateDevices(e.detail.devices);
            }
        })
    }

    updateDevices(devices: any) {
        let devicesFixed = devices.addedDevices.devices.map((d: any) => {
            let data: { [index: string]: any } = {}
            for(let val of d[6]) {
                let key1 = devices.addedDevices.values[val[0]];
                let key2 = devices.addedDevices.values[val[1]];
                data[key1] = key2;
            }

            return {
                id: d[0],
                data
            }
        })

        // merge/overwrite devices
        if(this.devices) {
            for(let device of devicesFixed) {
                let existingDeviceIndex = this.devices.findIndex(d => d.id == device.id)
                if(existingDeviceIndex != -1) {
                    this.devices[existingDeviceIndex] = device
                } else {
                    this.devices.push(device)
                }
            }
        } else {
            this.devices = devicesFixed
        }
    }

    getDevices(selector: { [index: string]: any }) {
        if(selector.id) {
            return this.devices.filter(d => d.id == selector.id)
        }

        let devices = this.devices;
        for(let key in selector) {
            devices = devices.filter(d => d.data[key] == selector[key])
        }

        return devices;
    }

    getDevice(selector: { [index: string]: any }) {
        return this.getDevices(selector)[0];
    }
}