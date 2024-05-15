// mostly copied from https://github.com/TheLazySquid/Gimloader/blob/main/src/parcel/parcel.ts
// which was inspired by https://codeberg.org/gimhook/gimhook

import { getUnsafeWindow } from "./utils";

type Intercept = { match: (exports: any) => boolean, callback: (exports: any) => any, once: boolean };

export default class Parcel extends EventTarget {
    _parcelModuleCache = {};
    _parcelModules = {};
    reqIntercepts: Intercept[] = [];
    readyToIntercept = true;

    constructor() {
        super();

        this.setup();
    }

    interceptRequire(match: (exports: any) => boolean, callback: (exports: any) => any, once: boolean = false) {
        if(!match || !callback) throw new Error('match and callback are required');
        let intercept: Intercept = { match, callback, once };
        this.reqIntercepts.push(intercept);

        // return a cancel function
        return () => {
            let index = this.reqIntercepts.indexOf(intercept);
            if(index !== -1) this.reqIntercepts.splice(index, 1);
        }
    }

    setup() {
        let requireHook: (moduleName: string) => void;
        let nativeParcel = getUnsafeWindow()["parcelRequire388b"];

        ((requireHook = (moduleName) => {
            if (moduleName in this._parcelModuleCache) {
                return this._parcelModuleCache[moduleName].exports;
            }
    
            if (moduleName in this._parcelModules) {
                let moduleCallback = this._parcelModules[moduleName];
                delete this._parcelModules[moduleName];
    
                let moduleObject = {
                    id: moduleName,
                    exports: {} as any
                };
    
                this._parcelModuleCache[moduleName] = moduleObject;
    
                moduleCallback.call(moduleObject.exports, moduleObject, moduleObject.exports);

                // run intercepts
                if(this.readyToIntercept) {
                    for (let intercept of this.reqIntercepts) {
                        if (intercept.match(moduleObject.exports)) {
                            let returned = intercept.callback?.(moduleObject.exports);
                            if(returned) moduleObject.exports = returned;
    
                            if(intercept.once) {
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

            if(nativeParcel) nativeParcel.register(moduleName, moduleCallback);
        });

        Object.defineProperty(getUnsafeWindow(), "parcelRequire388b", {
            value: requireHook,
            writable: false,
            enumerable: true,
            configurable: false
        });
    }
}