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
import {ModDatabaseEntity, ToolDatabaseEntity} from '../entities/mod-database';
import {outputElements} from '../entities/page-switcher';
import {LocalizedString, Page} from 'ccmoddb/build/src/types';

/// Gets a list of mods.
export class ModsToolsGetCommand extends CCBotCommand {
    public readonly tools: boolean;
    public constructor(client: CCBot, group: string, name: string, tools: boolean) {
        const opt = {
            name: `-${group} ${name}`,
            description: !tools ? 'Gets a list of the available mods.' : 'Gets a list of the available tools.',
            group,
            memberName: name,
        };
        super(client, opt);
        this.tools = tools;
    }

    public async run(message: commando.CommandoMessage): Promise<commando.CommandoMessageResponse> {
        const entityName = !this.tools ? 'mod-database-manager' : 'tool-database-manager';
        const modDB = this.client.entities.getEntity<ModDatabaseEntity | ToolDatabaseEntity>(entityName);
        if (modDB)
            if (modDB.packages.length > 0) {
                const mods: string[] = modDB.packages.map(pkg => {
                    const metadata = pkg.metadataCCMod!;

                    const components: string[] = [];

                    let header = `**${getStringFromLocalisedString(metadata.title)}**`;
                    header += ` **(${metadata.version})**`;
                    header += ` by ***${typeof metadata.authors === 'string' ? metadata.authors : metadata.authors.join(', ')}***`;
                    if (pkg.stars) {
                        header += ` (⭐**${pkg.stars}**)`;
                    }
                    components.push(header);

                    components.push(getStringFromLocalisedString(metadata.description));

                    if (metadata.tags) {
                        metadata.tags = metadata.tags.filter(tag => tag != 'externaltool');
                        if (metadata.tags.length > 0) components.push(`Tags: *${metadata.tags.join(', ')}*`);
                    }

                    for (const url of [metadata.homepage, metadata.repository]) {
                        if (!url) continue;
                        const repoPage = getRepositoryEntry(url)[0];
                        components.push(`[View at ${repoPage.name}](${repoPage.url})`);
                    }

                    components.push('');
                    return components.join('\n');
                });
                const footer = !this.tools
                    ? '\nNote: All mods require a mod loader to work. (See `.cc installing-mods` for details.)'
                    : '\nNote: Tools require their own installation procedures. Check their pages for details.';
                return outputElements(this.client, message, mods, 25, 2000, {
                    textFooter: footer,
                    footer: {
                        text: 'From CCModDB',
                    },
                });
            } else {
                let possibleError = '';
                if (modDB.lastError) possibleError += `\n${modDB.lastErrorString()}`;
                return message.say(
                    `Mod information isn't available (has the bot just started up? is the modlist updater dead?).\nPlease see the CCDirectLink website for more information: https://c2dl.info/cc/mods${possibleError}`
                );
            }

        return message.say(`ooo! you haven't added the initial entities! (no ${entityName})`);
    }
}

// modified https://github.com/CCDirectLink/CCModDB/blob/733650957c04ef72de6da8f8f47772e5b3fc8215/build/src/api.ts#L23
export function getStringFromLocalisedString(str: LocalizedString, lang = 'en_US'): string {
    if (!str) throw new Error(`No string found: ${str}`);
    if (typeof str !== 'string') {
        const newStr = str[lang];
        if (!newStr) throw new Error(`No ${lang} string found: ${str}`);
        str = newStr;
    }
    /* remove crosscode icons and colors */
    return str
        .replace(/\\c\[[^\]]*\]/g, '')
        .replace(/\\s\[[^\]]*\]/g, '')
        .replace(/\\i\[[^\]]*\]/g, '');
}

// https://github.com/CCDirectLink/CCModDB/blob/733650957c04ef72de6da8f8f47772e5b3fc8215/build/src/api.ts#L3
export function getRepositoryEntry(url?: string): Page[] {
    if (!url) {
        return [];
    }

    let name: string;
    switch (new URL(url).hostname) {
        case 'github.com':
            name = 'GitHub';
            break;
        case 'gitlab.com':
            name = 'GitLab';
            break;
        default:
            name = "mod's homepage";
    }

    return [{name, url}];
}
