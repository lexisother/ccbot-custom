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

import * as commando from 'discord.js-commando';
import {CCBot, CCBotCommand} from '../ccbot';

/// Reloads the JSON commands.
export default class ReloadCommand extends CCBotCommand {
    public constructor(client: CCBot) {
        const opt = {
            name: '-commands reload-json',
            description: 'Reloads all JSON commands. Only usable by bot owner.',
            group: 'commands',
            memberName: 'reload-json',
            ownerOnly: true
        };
        super(client, opt);
    }

    public run(message: commando.CommandoMessage): Promise<commando.CommandoMessageResponse> {
        this.client.dynamicData.commands.reload();
        return message.say('[nods] <:leaNOD:400777547991744523>');
    }
}
