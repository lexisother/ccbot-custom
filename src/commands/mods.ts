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
import {ModDatabaseEntity, ToolDatabaseEntity} from '../entities/mod-database';
import {outputElements} from '../entities/page-switcher';

/// Gets a list of mods.
export class ModsToolsGetCommand extends CCBotCommand {
    public readonly tools: boolean;
    public constructor(client: CCBot, group: string, name: string, tools: boolean) {
        const opt = {
            name: `-${group} ${name}`,
            description: !tools ? 'Gets a list of the available mods.' : 'Gets a list of the available tools.',
            group,
            memberName: name
        };
        super(client, opt);
        this.tools = tools;
    }

    public async run(message: commando.CommandoMessage): Promise<commando.CommandoMessageResponse> {
        const entityName = !this.tools ? 'mod-database-manager' : 'tool-database-manager';
        const modDB = this.client.entities.getEntity<ModDatabaseEntity | ToolDatabaseEntity>(entityName);
        if (modDB) {
            if (modDB.packages.length > 0) {
                const mods: string[] = modDB.packages.map(pkg => {
                    const components: string[] = [`**${pkg.name} (${pkg.version})**`];
                    if (pkg.description) components.push(pkg.description);
                    for (const page of pkg.page) components.push(`[View on ${page.name}](${page.url})`);
                    components.push('');
                    return components.join('\n');
                });
                const footer = !this.tools ? '\nNote: All mods require a mod loader to work. (See `.cc installing-mods` for details.)' : '\nNote: Tools require their own installation procedures. Check their pages for details.';
                return outputElements(this.client, message, mods, 25, 2000, {
                    textFooter: footer,
                    footer: {
                        text: 'From CCModDB'
                    }
                });
            } else {
                let possibleError = '';
                if (modDB.lastError)
                    possibleError += `\n${modDB.lastErrorString()}`;
                return message.say(
                    `Mod information isn't available (has the bot just started up? is the modlist updater dead?).\nPlease see the CCDirectLink website for more information: https://c2dl.info/cc/mods${possibleError}`
                );
            }
        }
        return message.say(`ooo! you haven't added the initial entities! (no ${entityName})`);
    }
}
