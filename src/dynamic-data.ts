// Copyright (C) 2019-2020 CCDirectLink members
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import * as fs from 'fs';
import * as structures from './data/structures';

export abstract class DynamicTextFile {
    // Immediate access (prevents change-buffering behavior)
    public immediate: boolean;

    // RAM access (changes are always lost)
    // It does not make sense to have a non-immediate RAM
    public ram: boolean;
    private inMiddleOfSI: Promise<void> | null = null;

    // Resolves after the initial load.
    public initialLoad: Promise<void>;

    private path: string;

    // Used for the write buffering
    private modifyTimeoutActive: Array<() => void> | null = null;
    private modifyTimeoutReject: Array<(err: unknown) => void> | null = null;

    public constructor(name: string, immediate: boolean, ram: boolean) {
        this.path = `dynamic-data/${name}`;
        this.immediate = immediate;
        this.ram = ram;
        this.initialLoad = this.reload();
    }

    /// Used on save.
    protected abstract serialize(): string;

    /// Used on load. Can throw errors.
    protected abstract deserialize(text: string): void;

    /// Performs an immediate save.
    public saveImmediate(): Promise<void> {
        if (this.ram)
            return Promise.resolve();
        if (this.inMiddleOfSI) {
            // Defer until end of this SI
            const imos = this.inMiddleOfSI;
            return (async (): Promise<void> => {
                await imos;
                await this.saveImmediate();
            })();
        }
        this.inMiddleOfSI = new Promise((resolve: () => void, reject: (err: unknown) => void) => {
            console.log(`saving ${this.path}`);
            const npath = `${this.path}.new.${Date.now()}.${Math.random()}`;
            fs.writeFile(npath, this.serialize(), (err) => {
                if (err) {
                    this.inMiddleOfSI = null;
                    reject(err);
                } else {
                    fs.rename(npath, this.path, (err) => {
                        this.inMiddleOfSI = null;
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
        return this.inMiddleOfSI;
    }

    /// Indicates that the data should be saved eventually (unless this is an immediate object)
    public updated(): Promise<void> {
        if (this.immediate) {
            return this.saveImmediate();
        } else {
            // This logic ensures only one write is ongoing at a time.
            let mta: Array<() => void> = [];
            let mtj: Array<(err: unknown) => void> = [];
            if ((this.modifyTimeoutActive == null) || (this.modifyTimeoutReject == null)) {
                console.log(`opening save window on ${this.path}`);
                this.modifyTimeoutActive = mta;
                this.modifyTimeoutReject = mtj;
                setTimeout(() => {
                    this.saveImmediate().then(() => {
                        this.modifyTimeoutActive = null;
                        this.modifyTimeoutReject = null;
                        for (const f of mta)
                            f();
                    }, (err: unknown) => {
                        this.modifyTimeoutActive = null;
                        this.modifyTimeoutReject = null;
                        for (const f of mtj)
                            f(err);
                    });
                }, 30000);
            } else {
                mta = this.modifyTimeoutActive;
                mtj = this.modifyTimeoutReject;
            }
            return new Promise((resolve: () => void, reject: (err: unknown) => void) => {
                mta.push(resolve);
                mtj.push(reject);
            });
        }
    }

    /// Reloads the object.
    public reload(): Promise<void> {
        return new Promise((resolve: () => void, reject: (err: unknown) => void) => {
            fs.readFile(this.path, 'utf8', (err: unknown, data: string) => {
                if (!err) {
                    try {
                        this.deserialize(data);
                    } catch (e) {
                        reject(e);
                    }
                    resolve();
                } else {
                    resolve();
                }
            });
        });
    }

    /// Destroys the DynamicTextFile, severing the link to the filesystem (if there is one).
    /// Before doing so, saves any modified data, leaving things in a consistent state.
    public async destroy(): Promise<void> {
        await this.saveImmediate();
        this.ram = true;
    }
}

/// The sub-manager for a given object of 'dynamic data', i.e. that stuff we ideally would want to save/load.
export class DynamicData<T> extends DynamicTextFile {
    // The data. Please treat as read-only - use modify to modify it.
    public data: T;

    private modifyActions: Array<() => void> = [];

    public constructor(name: string, immediate: boolean, ram: boolean, defaultContent: T) {
        super(`${name}.json`, immediate, ram);
        this.data = defaultContent;
    }

    // Adds a modification callback.
    public onModify(action: () => void): void {
        this.modifyActions.push(action);
    }

    // Calls the various modifyActions.
    private callOnModify(): void {
        for (const v of this.modifyActions)
            v();
    }

    /*
     * Used to neatly wrap modifying accesses.
     * The promise is resolved when the data is written. It may be rejected if saving fails.
     */
    public modify(modifier: (value: T) => void): Promise<void> {
        modifier(this.data);
        this.callOnModify();
        return this.updated();
    }

    protected serialize(): string {
        return JSON.stringify(this.data);
    }

    protected deserialize(data: string): void {
        this.data = JSON.parse(data);
        this.callOnModify();
    }
}

export class DynamicDataDump<T> extends DynamicTextFile {
    public data: T | null = null;

    public constructor(name: string) {
        super(`${name}.json`, true, false);
    }

    public dump(data: T): Promise<void> {
        this.data = data;
        return this.updated();
    }

    public reload(): Promise<void> {
        return Promise.resolve();
    }

    public async destroy(): Promise<void> {
        this.ram = true;
    }

    protected serialize(): string {
        const text = JSON.stringify(this.data);
        this.data = null;
        return text;
    }

    protected deserialize(_text: string): void {
        throw new Error('deserialization disabled, this is a dump file');
    }
}

/// The place where all dynamic data goes.
/// Useful for eval access.
/// There should only be one of these at a time right now, since it's always based on the same folder.
export default class DynamicDataManager {
    public commands = new DynamicData<structures.CommandSet>('commands', false, true, {});
    public settings = new DynamicData<structures.GuildIndex>('settings', true, false, {});
    public emoteRegistryDump = new DynamicDataDump<structures.EmoteRegistryDump>('public/emote-registry');
    public aocMapping = new DynamicData<structures.AOCMapping>('aoc-mapping', true, false, {});

    public initialLoad: Promise<void>;

    public constructor() {
        // dmitmel: The last then with an empty closure is needed to change the
        // return type of the promise from void[] to void.
        this.initialLoad = Promise.all<void>([
            this.commands.initialLoad,
            this.settings.initialLoad,
            this.emoteRegistryDump.initialLoad
        ]).then(() => {})
    }

    public async destroy(): Promise<void> {
        await Promise.all([
            this.commands.destroy(),
            this.settings.destroy(),
            this.emoteRegistryDump.destroy()
        ]);
    }
}
