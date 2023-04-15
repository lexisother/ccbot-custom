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
import {EntityData} from '../entity-registry';
import {CCBot, CCBotEntity} from '../ccbot';
import {runRoleCommand} from '../commands/roles';

export interface ReactRolesData extends EntityData {
    // Guild ID
    guild: string;
    // Message ID
    message: string;
    // Reactstring->Role-Names mapping
    reactions: {[react: string]: string[]};
}

/// Given a message that is setup by the administration (thus killing != deleting)
/// for controlling user roles based on reactions.
/// Not perfect; performs the roles add/rm logic, but doesn't apply it to the reactions the user has.
/// That would be impossible in some cases anyway.
class ReactRolesEntity extends CCBotEntity {
    private guild: discord.Guild;
    private messageId: string;
    private reactions: {[react: string]: string[]};

    public constructor(c: CCBot, g: discord.Guild, data: ReactRolesData) {
        super(c, `message-${data.message}`, data);
        this.guild = g;
        this.messageId = data.message;
        this.reactions = data.reactions;
    }

    public toSaveData(): ReactRolesData {
        return Object.assign(super.toSaveData(), {
            guild: this.guild.id,
            message: this.messageId,
            reactions: this.reactions
        });
    }

    public emoteReactionTouched(target: discord.Emoji, user: discord.User, add: boolean): void {
        super.emoteReactionTouched(target, user, add);
        const member = this.guild.members.resolve(user);
        if (!member)
            return;
        const reaction = this.reactions[target.id ?? target.name ?? ''];
        if (reaction)
            runRoleCommand(this.client, member, reaction, add);
    }
}

export default async function load(c: CCBot, data: ReactRolesData): Promise<CCBotEntity> {
    const guild = c.guilds.cache.get(data.guild);
    if (!guild)
        throw new Error(`unable to find the guild ${data.guild}`);
    return new ReactRolesEntity(c, guild, data);
}
