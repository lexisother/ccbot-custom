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
import {CCBot, CCBotCommand} from '../ccbot';
import {localRPCheck} from '../role-utils';
import {PurgeDatabaseChannelEntity} from '../entities/purge-database';

/// Purges the bot's messages.
export default class PurgeCommand extends CCBotCommand {
    public constructor(client: CCBot) {
        const opt: commando.CommandInfo = {
            name: 'purge',
            description: 'Deletes messages from the bot. Defaults to 1 minute.',
            group: 'general',
            memberName: 'purge',
            args: [
                {
                    key: 'seconds',
                    prompt: 'The amount of time in seconds?',
                    type: 'integer',
                    default: 60
                }
            ]
        };
        super(client, opt);
    }

    public async run(message: commando.CommandoMessage, args: {seconds: number}): Promise<commando.CommandoMessageResponse> {
        // Get the database
        const database = this.client.entities.getEntity<PurgeDatabaseChannelEntity>(`purge-channel-${message.channel.id}`);
        if (!database)
            return await message.say('The purge database doesn\'t exist.');
        if (args.seconds <= 1)
            return await message.say('Too short to be practical.');

        if (!localRPCheck(message, ['ViewChannel', 'ManageMessages'], 'purgers')) {
            return await message.say('You aren\'t authorized to do that.\nYou need READ\\_MESSAGES & MANAGE\\_MESSAGES, or you need to be in the `purgers` role group.');
        } else {
            if (message.channel.isDMBased())
                return await message.say('That can\'t be done here. (DM channel?)');
            // Nuke it. I hope you intended this...
            const collated: string[] = [];
            const targetTimestamp = message.createdAt.getTime() - (args.seconds * 1000);
            for (let i = database.messages.length - 1; i >= 0; i--) {
                const msgID = database.messages[i];
                if (discord.SnowflakeUtil.deconstruct(msgID).timestamp >= targetTimestamp) {
                    this.client.entities.killEntity(`message-${msgID}`, true);
                    collated.push(msgID);
                    if (collated.length >= 200)
                        break;
                } else {
                    break;
                }
            }
            await message.channel.bulkDelete(collated);
            return [];
        }
    }
}
