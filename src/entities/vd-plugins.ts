// Copyright (C) 2023+ Alyxia Sother
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

import { CCBot, CCBotEntity } from '../ccbot';
import { getJSON } from '../utils';
import { WatcherEntity, WatcherEntityData } from '../watchers';

export interface VDPDBViewerEntityData extends WatcherEntityData {
  endpoint: string;
}

interface Author {
  name: string;
  id?: string;
}

interface PluginManifest {
  name: string;
  description: string;
  authors: Author[];
  main: string;
  hash: string;
  vendetta: {
    icon?: string;
    original: string;
  };
  url: string;
}

type PluginDB = PluginManifest[];

/// The base 'retrieve a JSON file of type T periodically' type.
abstract class VDPDBViewerEntity<T> extends WatcherEntity {
  public endpoint: string;

  public constructor(c: CCBot, id: string, data: VDPDBViewerEntityData) {
    super(c, id, data);
    this.endpoint = data.endpoint;
  }

  public async watcherTick(): Promise<void> {
    this.parseEndpointResponse(await getJSON<T>(this.endpoint, {}));
  }

  public abstract parseEndpointResponse(data: T): void;

  public toSaveData(): WatcherEntityData {
    return Object.assign(super.toSaveData(), {
      refreshMs: this.refreshMs,
      endpoint: this.endpoint,
    });
  }
}

/// Acts as the source for plugin list information.
export class PluginDatabaseEntity extends VDPDBViewerEntity<PluginDB> {
  public plugins: PluginManifest[] = [];

  public constructor(c: CCBot, data: VDPDBViewerEntityData) {
    super(c, 'plugin-database-manager', data);
  }

  public parseEndpointResponse(data: PluginDB): void {
    this.plugins.length = 0;
    data = data.reverse().map((p) => ({
      ...p,
      url: new URL(p.vendetta.original, this.endpoint).href,
    }));
    this.plugins.push(...data);
  }
}

export default async function load(c: CCBot, data: VDPDBViewerEntityData): Promise<CCBotEntity> {
  return new PluginDatabaseEntity(c, data);
}
