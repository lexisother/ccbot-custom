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
import {CCBot, CCBotEntity} from '../ccbot';
import {EntityData} from '../entity-registry';
import {silence} from '../utils';

/// Implements old behaviors into the bot.
class OldBehaviorsEntity extends CCBotEntity {
    private messageListener: (m: discord.Message) => void;

    public constructor(c: CCBot, data: EntityData) {
        super(c, 'old-behaviors-manager', data);
        this.messageListener = (m: discord.Message): void => {
            if (this.killed)
                return;

            const lowerContent = m.content.toLowerCase();

            // Where the actual behaviors are
            if (lowerContent.startsWith('failed to load')) {
                silence(m.channel.send('oof'));
            } else if (lowerContent.startsWith('?release')) {
                // Might need to be part of a relevant activity manager
                silence(m.channel.send('Watching the final countdown'));
            } else if (m.channel instanceof discord.GuildChannel && m.channel.name === 'media') {
                // Yes, the continued requirement of using any to do things is awkward.
                //const cc = m.guild.channels.find('name', 'crosscode');
            }
        };
        this.client.on('messageCreate', this.messageListener);
    }

    public onKill(transferOwnership: boolean): void {
        super.onKill(transferOwnership);
        this.client.removeListener('messageCreate', this.messageListener);
    }
}

export default async function load(c: CCBot, data: EntityData): Promise<CCBotEntity> {
    return new OldBehaviorsEntity(c, data);
}
