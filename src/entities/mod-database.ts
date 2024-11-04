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

import {CCBot, CCBotEntity} from '../ccbot';
import {getJSON} from '../utils';
import {WatcherEntity, WatcherEntityData} from '../watchers';
import {Package, PackageDB} from 'ccmoddb/build/src/types';

export interface CCModDBViewerEntityData extends WatcherEntityData {
    endpoint: string;
}

/// The base 'retrieve a JSON file of type T periodically' type.
abstract class CCModDBViewerEntity<T> extends WatcherEntity {
    public endpoint: string;

    public constructor(c: CCBot, id: string, data: CCModDBViewerEntityData) {
        super(c, id, data);
        this.endpoint = data.endpoint;
    }

    public async watcherTick(): Promise<void> {
        this.parseEndpointResponse(await getJSON<T>(this.endpoint, {}));
    }

    public abstract parseEndpointResponse(data: T): void;

    public toSaveData(): CCModDBViewerEntityData {
        return Object.assign(super.toSaveData(), {
            refreshMs: this.refreshMs,
            endpoint: this.endpoint,
        });
    }
}

/// Acts as the source for mod list information.
export class ModDatabaseEntity extends CCModDBViewerEntity<PackageDB> {
    public packages: Package[] = [];

    public constructor(c: CCBot, data: CCModDBViewerEntityData) {
        super(c, 'mod-database-manager', data);
    }

    public parseEndpointResponse(dbData: PackageDB): void {
        this.packages.length = 0;
        for (const id in dbData) {
            const pkg = dbData[id];
            const {metadataCCMod: metadata} = pkg;
            if (!metadata) throw new Error(`Mod: ${id} has to have a ccmod.json, duno how this happended`);

            if (metadata.tags?.some(tag => tag == 'base' || tag == 'externaltool')) continue;

            const isInstallable = pkg.installation.some(i => i.type === 'zip');
            if (!isInstallable) continue;

            this.packages.push(pkg);
        }
    }
}

/// Acts as the source for mod list information.
export class ToolDatabaseEntity extends CCModDBViewerEntity<PackageDB> {
    public packages: Package[] = [];

    public constructor(c: CCBot, data: CCModDBViewerEntityData) {
        super(c, 'tool-database-manager', data);
    }

    public parseEndpointResponse(data: PackageDB): void {
        this.packages.length = 0;
        this.packages.push(...Object.values(data));
    }
}

export async function loadModDatabase(c: CCBot, data: CCModDBViewerEntityData): Promise<CCBotEntity> {
    return new ModDatabaseEntity(c, data);
}
export async function loadToolDatabase(c: CCBot, data: CCModDBViewerEntityData): Promise<CCBotEntity> {
    return new ToolDatabaseEntity(c, data);
}
