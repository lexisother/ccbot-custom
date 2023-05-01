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
import { CCBot, CCBotCommand } from '../ccbot';
import { PageSwitcherOutputElementWithCategory, outputElements } from '../entities/page-switcher';

/// A counter.
export default class CounterCommand extends CCBotCommand {
    public constructor(client: CCBot) {
        super(client, {
            name: '-util counter',
            description: 'Creates a 50-page bunch of nonsense to read through for bot testing.',
            group: 'util',
            memberName: 'counter',
            args: [
                {
                    key: 'error',
                    prompt: 'Triggers an error (useful for testing handling)',
                    type: 'boolean',
                    default: false
                }
            ]
        });
    }

    public async run(message: commando.CommandoMessage, args: { error: boolean }): Promise<commando.CommandoMessageResponse> {
        if (args.error)
            throw new Error('The user wanted an error.');
        const pages: PageSwitcherOutputElementWithCategory[] = [];
        for (let i = 0; i < 50; i++) {
            pages.push({
                category: `Group ${Math.floor(i / 3)}`,
                text: `Element ${i + 1}`
            });
        }
        return await outputElements(this.client, message, pages, 2, 2000);
    }
}
