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

import * as discord from 'discord.js';
import * as commando from 'discord.js-commando';
import * as structures from './data/structures';
import {DynamicData} from './dynamic-data';

/// The setting bindings are *in the provider* for some reason.
/// This fixes SettingProvider to handle this properly.
export abstract class SaneSettingProvider extends commando.SettingProvider<structures.SettingsStructure> {
    public client!: commando.CommandoClient;

    private listenerCommandPrefixChange: (guild: commando.CommandoGuild | null, prefix: string | null) => void;
    private listenerCommandStatusChange: (guild: discord.Guild | string, group: commando.Command, enabled: boolean) => void;
    private listenerGroupStatusChange: (guild: discord.Guild | string, group: commando.CommandGroup, enabled: boolean) => void;
    private listenerReloadSettings: () => void;

    public constructor() {
        super();
        this.listenerCommandPrefixChange = (guild: commando.CommandoGuild | null, prefix: string | null): void => {
            this.set(guild, 'prefix', prefix);
        };
        this.listenerCommandStatusChange = (guild: discord.Guild | string, group: commando.Command, enabled: boolean): void => {
            this.set(guild, `cmd-${group.groupId}-${group.memberName}`, enabled);
        };
        this.listenerGroupStatusChange = (guild: discord.Guild | string, group: commando.CommandGroup, enabled: boolean): void => {
            this.set(guild, `grp-${group.id}`, enabled);
        };
        this.listenerReloadSettings = (): void => {
            this.reloadSettings();
        };
    }

    /// Pokes the awful internals because setEnabledIn fails for reasons
    private reloadSettings(): void {
        // -- Prefixes
        this.client.prefix = this.get('global', 'prefix', this.client.prefix)!.toString();
        for (const guild of this.client.guilds.cache.values())
            (guild as commando.CommandoGuild).prefix = this.get(guild, 'prefix', null);
        // -- Groups
        for (const group of this.client.registry.groups.values()) {
            const settingName = `grp-${group.id}` as const;
            group['_globalEnabled'] = this.get('global', settingName, true) as boolean;
            for (const guild of this.client.guilds.cache.values()) {
                const guildE = guild as unknown as { _groupsEnabled: Record<string, boolean> };
                // Oh dear goodness.
                guildE._groupsEnabled = guildE._groupsEnabled || {};
                const int = this.get(guild, settingName);
                if (int !== undefined)
                    guildE._groupsEnabled[group.name] = Boolean(int);
            }
        }
        // -- Commands
        for (const command of this.client.registry.commands.values()) {
            const settingName = `cmd-${command.groupId}-${command.memberName}` as const;
            // eslint-disable-next-line dot-notation
            command['_globalEnabled'] = this.get('global', settingName, true);
            for (const guild of this.client.guilds.cache.values()) {
                const guildE = guild as unknown as { _commandsEnabled: Record<string, boolean> };
                // Oh dear goodness.
                guildE._commandsEnabled = guildE._commandsEnabled || {};
                const int = this.get(guild, settingName);
                if (int !== undefined)
                    guildE._commandsEnabled[command.name] = Boolean(int);
            }
        }
    }

    public async init(client: commando.CommandoClient): Promise<void> {
        this.client = client;
        this.listenerReloadSettings();
        client.on('commandPrefixChange', this.listenerCommandPrefixChange);
        client.on('commandStatusChange', this.listenerCommandStatusChange);
        client.on('groupStatusChange', this.listenerGroupStatusChange);
        client.on('guildCreate', this.listenerReloadSettings);
        client.on('commandRegister', this.listenerReloadSettings);
        client.on('groupRegister', this.listenerReloadSettings);
    }

    public async destroy(): Promise<void> {
        this.client.removeListener('commandPrefixChange', this.listenerCommandPrefixChange);
        this.client.removeListener('commandStatusChange', this.listenerCommandStatusChange);
        this.client.removeListener('groupStatusChange', this.listenerGroupStatusChange);
        this.client.removeListener('guildCreate', this.listenerReloadSettings);
        this.client.removeListener('commandRegister', this.listenerReloadSettings);
        this.client.removeListener('groupRegister', this.listenerReloadSettings);
    }
}

/// A modified version of the CommandDispatcher.
class CCBotSettingProvider extends SaneSettingProvider {
    // TODO: use maps here?
    public readonly data: DynamicData<structures.GuildIndex>;

    public constructor(d: DynamicData<structures.GuildIndex>) {
        super();
        this.data = d;
    }

    public async init(client: commando.CommandoClient): Promise<void> {
        await this.data.initialLoad;
        await super.init(client);
    }

    public async destroy(): Promise<void> {
        await super.destroy();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public get(guild: discord.Guild | string, key: string, def?: any): any {
        const id: string = commando.SettingProvider.getGuildID(guild);
        const guildObj = this.data.data[id];
        if (!guildObj)
            return def;
        if (!(key in guildObj))
            return def;
        return guildObj[key];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async set(guild: discord.Guild | string, key: string, val: any): Promise<any> {
        const id: string = commando.SettingProvider.getGuildID(guild);
        await this.data.modify((t: structures.GuildIndex) => {
            t[id] = t[id] || {};
            t[id][key] = val;
        });
        return val;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async remove(guild: discord.Guild | string, key: string): Promise<any> {
        const value = this.get(guild, key);
        const id: string = commando.SettingProvider.getGuildID(guild);
        await this.data.modify((t: structures.GuildIndex) => {
            if (t[id])
                delete t[id][key];
        });
        return value;
    }

    public clear(guild: discord.Guild | string): Promise<void> {
        const id: string = commando.SettingProvider.getGuildID(guild);
        return this.data.modify((t: structures.GuildIndex) => {
            delete t[id];
        });
    }
}

export default CCBotSettingProvider;
