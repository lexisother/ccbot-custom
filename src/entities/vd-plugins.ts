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

import * as discord from 'discord.js';
import { ButtonStyle, ComponentType } from 'discord.js';
import { CCBot, CCBotEntity } from '../ccbot';
import { EntityData } from '../entity-registry';
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

// QuickLinks data
export interface VDQLEntityData extends EntityData {
  guild: string;
  // RegExp in a string, e.g. "\s+"
  tags: string;
  blacklist: string[];
}
export class QuickLinksEntity extends CCBotEntity {
  private readonly guild: string;
  private readonly tags: RegExp;
  private readonly blacklist: string[];
  private readonly messageListener: (m: discord.Message) => void;

  public constructor(c: CCBot, data: VDQLEntityData) {
    super(c, 'quicklinks-listener', data);
    this.guild = data.guild;
    this.tags = RegExp(data.tags) ?? /\[\[(.*?)\]\]/;
    this.blacklist = data.blacklist ?? [];

    this.messageListener = (m: discord.Message): void => {
      if (!this.client.isProviderReady()) return;
      if (this.killed) return;
      if (m.guildId !== this.guild) return;
      const blacklist: string[] = this.client.provider.get(this.guild, 'quicklinks-blacklist', []);
      if (blacklist.includes(m.channelId)) return;

      const matches = m.content.match(this.tags);
      if (matches == null || !matches[1]) return;

      const pluginDB =
        this.client.entities.getEntity<PluginDatabaseEntity>('plugin-database-manager');
      if (pluginDB) {
        if (pluginDB.plugins.length > 0) {
          let dbPlugins = pluginDB.plugins;

          const normalize = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ');
          const query = normalize(matches[1]);
          if (!query) return;

          dbPlugins = pluginDB.plugins
            .filter((x) =>
              [x.name, x.description, ...x.authors.map((x) => x.name)].some((x) =>
                normalize(x).includes(query),
              ),
            )
            .sort((a, b) => {
              const aNameMatch = normalize(a.name).includes(query);
              const bNameMatch = normalize(b.name).includes(query);
              if (aNameMatch && !bNameMatch) return -1;
              if (!aNameMatch && bNameMatch) return 1;

              const aNameStartsWith = normalize(a.name).startsWith(query);
              const bNameStartsWith = normalize(b.name).startsWith(query);
              if (aNameStartsWith && !bNameStartsWith) return -1;
              if (!aNameStartsWith && bNameStartsWith) return 1;

              const aDescMatch = normalize(a.description).includes(query);
              const bDescMatch = normalize(b.description).includes(query);
              if (aDescMatch && !bDescMatch) return -1;

              return 0;
            });

          if (!dbPlugins[0]) {
            m.reply('No plugins found with that query');
            return;
          }

          let plugin = dbPlugins[0];
          m.reply({
            embeds: [
              {
                title: plugin.name,
                description: plugin.description,
                fields: [
                  {
                    name: 'Author(s)',
                    value: plugin.authors.map((e) => e.name).join(', '),
                  },
                ],
              },
            ],
            components: [
              {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.Button,
                    label: 'Install Plugin',
                    url: `https://vd-plugins.github.io/proxy/${plugin.vendetta.original}`,
                    style: ButtonStyle.Link,
                  },
                ],
              },
            ],
          });
        }
      } else {
        m.reply(
          "ooo! you haven't started the plugin database entity! (no plugin-database-manager found)",
        );
      }
    };
    this.client.on('messageCreate', this.messageListener);
  }

  public toSaveData(): VDQLEntityData {
    return Object.assign(super.toSaveData(), {
      guild: this.guild,
      tags: this.tags.toString().slice(1, -1),
      blacklist: this.blacklist,
    });
  }

  public onKill(transferOwnership: boolean): void {
    super.onKill(transferOwnership);
    this.client.removeListener('messageCreate', this.messageListener);
  }
}

export async function loadPluginDatabase(
  c: CCBot,
  data: VDPDBViewerEntityData,
): Promise<CCBotEntity> {
  return new PluginDatabaseEntity(c, data);
}

export async function loadQuicklinks(c: CCBot, data: VDQLEntityData): Promise<CCBotEntity> {
  return new QuickLinksEntity(c, data);
}
