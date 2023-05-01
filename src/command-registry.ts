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
import JSONCommand from './commands/json';
import HelpCommand from './commands/help';
import { CCBot } from './ccbot';

/// A modified version of the CommandRegistry.
///
/// JSON commands are read from the 'commands.json' dynamicData file.
/// Their structure is defined in: data/structures.js
export default class CCBotCommandRegistry extends commando.CommandoRegistry {
    public readonly client!: CCBot;
    private allJSONCommands: commando.Command[];

    public constructor(c: CCBot) {
        super(c);
        this.allJSONCommands = [];
        c.dynamicData.commands.onModify(() => {
            this.unloadJSONCommands();
            this.loadJSONCommands();
        });
    }
    public registerDefaults(): this {
        super.registerDefaults();
        this.loadJSONCommands();
        return this;
    }
    public loadJSONCommands(): void {
        // Register JSON commands & groups
        const commands = this.client.dynamicData.commands.data;
        for (const g in commands) {
            if (!this.groups.has(g))
                this.registerGroup({ id: g });

            const gcmd: commando.Command = new HelpCommand(this.client, g);
            this.allJSONCommands.push(gcmd);
            this.registerCommand(gcmd);

            for (const k in commands[g]) {
                const cmd: commando.Command = new JSONCommand(this.client, g, k, commands[g][k]);
                this.allJSONCommands.push(cmd);
                this.registerCommand(cmd);
            }
        }
    }
    public unloadJSONCommands(): void {
        const njc = this.allJSONCommands;
        this.allJSONCommands = [];
        for (const cmd of njc)
            this.unregisterCommand(cmd);
    }
}
