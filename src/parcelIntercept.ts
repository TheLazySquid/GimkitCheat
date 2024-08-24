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

        let existingScripts = document.querySelectorAll<HTMLScriptElement>('script[src*="index"]:not([nomodule])');
        if(existingScripts.length > 0) {
            this.readyToIntercept = false;
            window.addEventListener('load', () => {
                this.setup();
                this.reloadExistingScripts(existingScripts);
            })
        }
        else this.setup();

        (getUnsafeWindow() as any).decachedImport = this.decachedImport.bind(this);
    }

    async reloadExistingScripts(existingScripts: NodeListOf<HTMLScriptElement>) {
        // nuke the dom
        this.nukeDom();

        this.readyToIntercept = true;
        this.emptyModules();

        existingScripts.forEach(script => {
            // re-import the script since it's already loaded
            console.log(script, 'has already loaded, re-importing...')
            
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
        let vars = ["__mobxGlobals", "__mobxInstanceCount"]
        for(let v of vars) {
            if(v in window) delete window[v];
        }
    }

    async decachedImport(url: string) {
        let src = new URL(url, location.origin).href;

        let res = await fetch(src);
        let text = await res.text();

        // nasty hack to prevent the browser from caching other scripts
        text = text.replaceAll('import(', 'window.decachedImport(');
        text = text.replaceAll('import.meta.url', `'${src}'`)

        let blob = new Blob([text], { type: 'application/javascript' });
        let blobUrl = URL.createObjectURL(blob);

        return import(blobUrl);
    }

    emptyModules() {
        this._parcelModuleCache = {};
        this._parcelModules = {};
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