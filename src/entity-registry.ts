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

import {DynamicTextFile} from './dynamic-data';

/// Entity's base data
export interface EntityData {
    type: string;
    createTime?: number;
    // If killTime is not provided, but killTimeout is,
    //  then killTime is set relative to createTime.
    killTime?: number;
    killTimeout?: number;
}

/// Entities are persistent mutable objects within the bot's system.
/// They are used to provide configurable behaviors that aren't tied to any specific invocation like a command is.
/// (This isn't to say commands can't affect entities, though.)
/// Note that this particular version is the base version,
///  which doesn't have the callbacks.
/// Check ccbot.ts CCBotEntity for that one.
export abstract class Entity<C> {
    // Used to alert callbacks to the entity's death.
    public killed = false;

    // This is more complicated than just a unique ID,
    //  because various entities have various fixed names as part of the event
    //  structure.
    // As such, the ID is not part of data, as that would require dynamically altering source JSON data in some cases.
    public readonly id: string;
    public readonly client: C;
    public readonly type: string;

    // The new Date().getTime() of initial creation, more or less.
    public readonly createTime: number;

    // NOTE: If this is 0, the entity won't die.
    // If this is 0 on creation, the entity still won't die until the next time the bot is run;
    //  entities that are loaded with a 0 killTime are assumed to be relatively permanent.
    // Lowering a killTime (making it happen sooner) may not actually work,
    //  due to measures to avoid kill-checks eating CPU.
    // Setting killTime to 0 potentially stops the kill checks, making it permanent for that run.
    private killTime: number;

    // This is how much from the current time postponeDeathAndUpdate postpones death for.
    private killTimeout: number;

    // This is a JSON serialized copy of the entity used for saving.
    private entitySerializedShadow = 'XXXOUTOFDATEXXX';
    private entitySerializedOutOfDate = true;

    public constructor(c: C, id: string, data: EntityData) {
        this.client = c;
        // These carry over.
        this.type = data.type;
        this.id = id;
        // If the creation time isn't in the data, this has just been created.
        if ('createTime' in data) {
            this.createTime = data.createTime!;
        } else {
            this.createTime = Date.now();
        }
        this.killTimeout = data.killTimeout || 0;
        if (data.killTime === undefined) {
            if (this.killTimeout) {
                this.killTime = this.createTime + this.killTimeout;
            } else {
                this.killTime = 0;
            }
        } else {
            this.killTime = data.killTime || 0;
        }
        if (this.killTime) {
            // The setImmediate ensures the entity isn't killed before insertion.
            setImmediate((): void => this.entityCheckIfShouldKill());
        }
    }

    /// Grants immunity to killTime.
    public becomeImmortalAndUpdate(): void {
        this.killTime = 0;
        this.updated();
    }

    /// Postpones killTime relative to now by the timeout value.
    public postponeDeathAndUpdate(): void {
        if (this.killTime) {
            const ntk = Date.now() + this.killTimeout;
            if (this.killTime < ntk)
                this.killTime = ntk;
        }
        this.updated();
    }

    /// Checks if the entity should be killed, and if not, waits until it should.
    /// This is only run if killTime was set in the first place.
    private entityCheckIfShouldKill(): void {
        if (this.killed)
            return;
        if (!this.killTime)
            return;
        const time = Date.now();
        if (time >= this.killTime) {
            this.kill(false);
        } else {
            let effectiveTime = this.killTime - time;
            // Workaround for Node timeout maximum limit. Works because we always re-verify the time
            if (effectiveTime >= 0x40100000)
                effectiveTime = 0x40000000 | (effectiveTime & 0xFFFFF);
            setTimeout((): void => this.entityCheckIfShouldKill(), effectiveTime);
        }
    }

    /// Used in the subclass to connect to killEntity.
    /// Is supposed to do nothing if the entity is dead, so it can be called from callbacks.
    public kill(_transferOwnership: boolean): void {
        throw new Error('Subclass did not implement kill()');
    }

    /// Used in the subclass to connect to the registry updated().
    /// Is supposed to do nothing if the entity is dead, so it can be called from callbacks.
    public updated(): void {
        this.entitySerializedOutOfDate = true;
    }

    /// Returns serialized entity data as a JSON string, updates the internal serialization shadow
    /// string if it is outdated. Is safe to be called by external code, but this isn't advised as
    /// this function is always called in registry's updated().
    public entityGetSerializedData(): string {
        if (this.entitySerializedOutOfDate) {
            this.entitySerializedShadow = JSON.stringify(this.toSaveData());
            this.entitySerializedOutOfDate = false;
        }
        return this.entitySerializedShadow;
    }

    /// Called just after the entity was killed.
    /// If the entity is maintaining a state, like an activity, this is where it would be reset.
    /// If 'transferOwnership' is true, the entity is being replaced, so it shouldn't do anything liable to cause race conditions.
    public onKill(_transferOwnership: boolean): void {

    }

    /// Called to save the entity.
    /// Must provide an object that can be passed to newEntity to get the same(ish) entity.
    public toSaveData(): EntityData {
        const sd: EntityData = {
            type: this.type,
            createTime: this.createTime
        };
        if ('killTime' in this)
            sd.killTime = this.killTime;
        return sd;
    }
}

/// A function responsible for fetching resources need for creation of an entity, actually creating
/// and "activating" it (performing any additional setup after calling the constructor). This function
/// **has** to completely setup the state of the entity, so that entities with invalid or incomplete
/// state don't end up in the registry where they can be freely referenced from other entities.
export type EntityLoader<C, T extends Entity<C>, D extends EntityData = EntityData> =
    (client: C, data: D) => Promise<T>;

// Used as part of unique-ish-ID-generation.
// The idea here is that if the log-entry-number and time aren't unique (due to some multi-instancing in future),
//  'stardate' probably will disambiguate.
// There's also a postfixed number just in case a collision were to somehow occur.
const stardate = Date.now();
let logEntryNumber = 0;

/// The EntityRegistry is the registry and processor for all Entity objects.
/// Entities are derived from the Entity class,
/// and are expected to be initialized with a json object like them.
export class EntityRegistry<C, T extends Entity<C>> extends DynamicTextFile {
    public readonly client: C;
    public readonly entityTypes = new Map<string, EntityLoader<C, T>>();
    public readonly entities = new Map<string, T>();

    // Until this is true, the EntityRegistry does nothing.
    // This is important because until the bot is ready,
    //  certain things might not exist that entities might want to access.
    private started = false;
    private cachedJSON = 'XXX_DID_NOT_LOAD_DATA_XXX';

    public constructor(c: C, path: string) {
        super(path, false, false);
        this.client = c;
    }

    // TODO: register classes directly, support spawning by class reference
    public registerEntityType<D extends EntityData = EntityData>(type: string, loader: EntityLoader<C, T, D>): this {
        this.entityTypes.set(type, loader as EntityLoader<C, T>);
        return this;
    }

    protected deserialize(json: string): void {
        if (!this.started) {
            this.cachedJSON = json;
            return;
        }
        const jsonData: EntityData[] = JSON.parse(json);
        this.killAllEntities();
        for (const entity of jsonData)
            this.newEntity(entity).catch((_e) => {
                // These will have already been reported.
            });
    }

    protected serialize(): string {
        if (!this.started)
            throw new Error('Absolutely can\'t serialize at this time, the bot hasn\'t started yet');
        // This is an efficient, if somewhat odd, way of achieving serialization.
        // Each entity has a serialization shadow string.
        // Being a string, it's quite efficient to handle compared to JSON.stringify on the whole block.
        // Entities only get *any* form of serialization if and when it is needed.
        const serializedEntities: string[] = [];
        for (const entity of this.entities.values()) {
            serializedEntities.push(entity.entityGetSerializedData());
        }
        return `[\n ${serializedEntities.join(',\n ')}\n]`;
    }

    /// Starts entities (i.e. creates them & such).
    /// Before this point, entity-related operations do nothing.
    /// This allows the entity system to be present (so commands run at the 'right' time fail gracefully),
    /// without entities having to account for the bot not being ready.
    public start(): void {
        if (this.started)
            return;
        this.started = true;
        this.deserialize(this.cachedJSON);
        this.cachedJSON = 'XXX_ALREADY_STARTED_XXX';
    }

    // Generates a unique-ish entity ID with a given prefix.
    public generateEntityID(prefix: string): string {
        prefix = `${prefix + stardate}-${Date.now()}-${logEntryNumber}-`;
        logEntryNumber++;
        let nid = `${prefix}0`;
        let idn = 0;
        while (this.entities.has(nid)) {
            idn++;
            nid = prefix + idn.toString();
        }
        return nid;
    }

    /// Creates an entity synchronously.
    /// Useful when circumstances should guarantee atomicity for safety reasons between entities which know each other.
    public newEntitySync(newEnt: T): void {
        this.killEntity(newEnt.id, true);
        this.entities.set(newEnt.id, newEnt);
        this.updated();
    }

    /// Creates a new entity from the JSON data for that entity.
    /// Must report errors to console.
    public async newEntity<D extends EntityData = EntityData>(data: D): Promise<T> {
        if (!this.started) {
            console.log('entity was being created before entities existed');
            throw new Error();
        }
        // Then create the entity by type.
        const entityLoader = this.entityTypes.get(data.type);
        if (entityLoader) {
            // Begins entity startup.
            // Notably, the entity doesn't get put in the registry until after activation.
            try {
                const newEnt = await entityLoader(this.client, data);
                // Entity finished, let's go
                this.newEntitySync(newEnt);
                return newEnt;
            } catch (err) {
                console.log('entity failed to load', err);
                throw new Error();
            }
        } else {
            console.log(`invalid entity type ${data.type} was in registry`);
            throw new Error();
        }
    }

    public getEntity<U extends T = T>(id: string): U | undefined {
        return this.entities.get(id) as U | undefined;
    }

    /// Kills the entity with the given ID.
    public killEntity(id: string, transferOwnership: boolean): void {
        const v = this.entities.get(id);
        if (v) {
            v.killed = true;
            this.entities.delete(id);
            v.onKill(transferOwnership);
            this.updated();
        }
    }

    /// Kills absolutely all entities (perhaps in preparation for a load)
    public killAllEntities(): void {
        // I'd avoid modifying a Map in-place while iterating it
        const entitiesCopy = Array.from(this.entities);
        for (const entry of entitiesCopy) {
            const [k, v] = entry;
            v.killed = true;
            this.entities.delete(k);
            v.onKill(false);
            // This should trigger GC on this entity earlier (I hope)
            (entry as unknown[]).length = 0;
        }
        this.updated();
    }
}
