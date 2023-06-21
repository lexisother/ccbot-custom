// Copyright (C) 2023+ Alyxia Sother
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
import { PluginDatabaseEntity } from '../entities/vd-plugins';
import { outputElements } from '../entities/page-switcher';

/// Gets a list of plugins.
export default class PluginsGetCommand extends CCBotCommand {
  public constructor(client: CCBot) {
    const opt: commando.CommandInfo = {
      name: `-general vdplugins`,
      description: 'Gets a list of the available plugins.',
      group: 'general',
      memberName: 'vdplugins',
      args: [
        {
          key: 'search',
          prompt: 'Search terms',
          type: 'string',
          default: '',
        },
      ],
    };
    super(client, opt);
  }

  public async run(
    message: commando.CommandoMessage,
    args: { search: string },
  ): Promise<commando.CommandoMessageResponse> {
    const entityName = 'plugin-database-manager';
    const pluginDB = this.client.entities.getEntity<PluginDatabaseEntity>(entityName);
    if (pluginDB) {
      if (pluginDB.plugins.length > 0) {
        let dbPlugins = pluginDB.plugins;

        if (args.search) {
          const normalize = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ');
          const normalizedQuery = normalize(args.search);
          // I would have used Fuse.JS like the website does, but it was being
          // uncooperative for some reason.
          // <https://github.com/replugged-org/replugged-backend/blob/32b0b70cd3852a010d4b1331a94507bd868dbeca/api/src/api/store/items.ts#L55-L79>
          dbPlugins = pluginDB.plugins
            .filter((x) =>
              [x.name, x.description, ...x.authors.map((x) => x.name)].some((x) =>
                normalize(x).includes(normalizedQuery),
              ),
            )
            .sort((a, b) => {
              const aNameMatch = normalize(a.name).includes(normalizedQuery);
              const bNameMatch = normalize(b.name).includes(normalizedQuery);
              if (aNameMatch && !bNameMatch) return -1;
              if (!aNameMatch && bNameMatch) return 1;

              const aNameStartsWith = normalize(a.name).startsWith(normalizedQuery);
              const bNameStartsWith = normalize(b.name).startsWith(normalizedQuery);
              if (aNameStartsWith && !bNameStartsWith) return -1;
              if (!aNameStartsWith && bNameStartsWith) return 1;

              const aDescMatch = normalize(a.description).includes(normalizedQuery);
              const bDescMatch = normalize(b.description).includes(normalizedQuery);
              if (aDescMatch && !bDescMatch) return -1;

              return 0;
            });
        }

        const plugins: string[] = dbPlugins.map((plugin) => {
            const authors = plugin.authors.map(e => e.name).join(", ")
          const components: string[] = [`**${plugin.name}** (by ${authors})`];
          if (plugin.description) components.push(plugin.description);
          components.push(`[Link](${plugin.url})`);
          components.push('');
          return components.join('\n');
        });
        return outputElements(this.client, message, plugins, 10, 2000, {
          footer: {
            text: "From Vendetta's plugin proxy",
          },
        });
      } else {
        let possibleError = '';
        if (pluginDB.lastError) possibleError += `\n${pluginDB.lastErrorString()}`;
        return message.say(
          `Plugin information isn't available (has the bot just started up? is the plugin list updater dead?)\nPlease see the online plugin list: https://vd-plugins.github.io/web/${
            possibleError && `\n\nError: \`\`\`${possibleError}\`\`\``
          }`,
        );
      }
    }
    return message.say(
      `ooo! you haven't started the plugin database entity! (no ${entityName} found)`,
    );
  }
}
