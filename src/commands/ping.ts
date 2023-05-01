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

/// Thanks the RFG developers for an awesome game.
export default class PingCommand extends CCBotCommand {
    public constructor(client: CCBot) {
        const opt = {
            name: 'ping',
            description: 'tests bot response time',
            group: 'general',
            memberName: 'ping'
        };
        super(client, opt);
    }

    public async run(message: commando.CommandoMessage): Promise<commando.CommandoMessageResponse> {
        // This is semi-ported from the old bot's code! Credit to whoever wrote that.
        // Please don't sue me.
        // this measures the time it took to get here
        const themUs = Date.now() - message.createdTimestamp;
        const message1 = await message.reply(`>:) pew pew. Got here in ${themUs} ms, and...`) as discord.Message;
        // this measures the return trip time
        const newDuration = Date.now() - message1.createdTimestamp;
        const message2 = await message.say(`sent back in ${newDuration} ms`) as discord.Message;
        return [message1, message2];
    }
}
