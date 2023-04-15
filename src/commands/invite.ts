// Copyright (C) 2019-2021 CCDirectLink members
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

export default class InviteCommand extends CCBotCommand {
    public constructor(client: CCBot) {
        const opt = {
            name: 'invite',
            description: 'Gives instructions for adding the bot to your server',
            group: 'general',
            memberName: 'invite'
        };
        super(client, opt);
    }

    public async run(message: commando.CommandoMessage): Promise<commando.CommandoMessageResponse> {
        // https://github.com/discordjs/Commando/blob/v0.12.0/src/commands/base.js#L346-L357
        const {owners} = this.client;
		const ownerList = owners ? owners.map((usr, i) => {
			const or = i === owners.length - 1 && owners.length > 1 ? 'or ' : '';
			return `${or}${discord.Util.escapeMarkdown(usr.username)}#${usr.discriminator}`;
		}).join(owners.length > 2 ? ', ' : ' ') : '';
        return await message.say(`Please contact ${ownerList || 'the bot owner'} and tell that you would like to add the bot to your server.`);
    }
}
