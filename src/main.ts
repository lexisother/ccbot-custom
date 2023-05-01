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
import {CCBot} from './ccbot';
import CCBotImpl from './ccbot-impl';
import {Secrets} from './data/structures'
import * as fs from 'fs';
import * as net from 'net';

declare global {
    // Using var declarations is the only way to get away from weird hacks.
    /* eslint-disable no-var */
    var ccbot: CCBotMain;
    var client: CCBot;
    var discord: typeof import('discord.js');
    var commando: typeof import('discord.js-commando');
    /* eslint-enable no-var */
}

/// The one and only main class, that initializes everything.
class CCBotMain {
    public readonly client: CCBot;
    public dataCollector: net.Server | null;
    public readonly secrets: Secrets;
    public constructor() {
        // This file may not exist in Travis.
        // So apparently the globalThis require thing doesn't work;
        // 1. Webpack *may* be providing the JSON conversion
        // 2. globalThis is >= Node 12.*
        this.secrets = JSON.parse(fs.readFileSync('secrets.json', 'utf8'));
        // See ccbot-impl.ts for more details on what's going on here.
        // Use CCBot to refer to the class.
        this.client = new CCBotImpl({
            owners: typeof this.secrets.owner === "string" ? [this.secrets.owner] : this.secrets.owner,
            prefix: this.secrets.commandPrefix,
            intents: [
                'MessageContent', 'Guilds', 'GuildEmojisAndStickers',   // these should go without saying
                'GuildMembers',                                         // (privileged) required for greeter, react-roles and a few other things
                'GuildBans',                                            // required for auditor
                // messages and reactions
                'GuildMessages',  'GuildMessageReactions',
                'DirectMessages', 'DirectMessageReactions'
            ]
        }, this.secrets.twitchClientId, this.secrets.youtubeData3Key);
        this.dataCollector = null;

        const kickstart = async (): Promise<void> => {
            try {
                // Makes sure that data isn't corrupt, makes sure that data is available
                await this.client.loadData();
                // Ok, *now* login
                await this.client.login(this.secrets.token);
                this.startDataCollector();
            } catch (e) {
                console.error(e);
                process.exit(1); // eslint-disable-line no-process-exit
            }
        }
        kickstart();
    }
    private startDataCollector(): void {
        // The data collector is "outside the system".
        if (this.secrets.dataCollectionPort) {
            // Data tallys
            let tallyRaw = 0;
            let tallyCreatedMessages = 0;
            let tallyCommandsExecuted = 0;
            const tallyCommandsBreakdown = new Map<string, number>();
            const entitiesBreakdown = new Map<string, number>();
            // Data incoming
            this.client.on('raw', (): void => {
                tallyRaw++;
            });
            this.client.on('messageCreate', (msg: commando.CommandoifiedMessage): void => {
                if (msg.author == this.client.user)
                    tallyCreatedMessages++;
            });
            this.client.on('commandRun', (command: commando.Command): void => {
                tallyCommandsExecuted++;
                tallyCommandsBreakdown.set(command.name, (tallyCommandsBreakdown.get(command.name) || 0) + 1);
            });
            // commandsExecuted
            // Main collector
            this.dataCollector = new net.Server();
            this.dataCollector.on('connection', (socket: net.Socket): void => {
                socket.on('error', (): void => {});
                entitiesBreakdown.clear();
                for (const { type } of this.client.entities.entities.values()) {
                    entitiesBreakdown.set(type, (entitiesBreakdown.get(type) || 0) + 1);
                }
                const guildsBreakdownYes = this.client.guilds.cache.filter((_guild) => {
                    return true;
                }).size;
                const guildsBreakdownSBS = this.client.guilds.cache.filter((_guild) => {
                    return false;
                }).size;
                const guildsBreakdownNo = this.client.guilds.cache.size - (guildsBreakdownYes + guildsBreakdownSBS);
                socket.end(`${JSON.stringify({
                    // ltp
                    guildsBreakdown: {
                        yes: guildsBreakdownYes,
                        sbs: guildsBreakdownSBS,
                        no: guildsBreakdownNo
                    },
                    commandsExecutedBreakdown: Object.fromEntries(tallyCommandsBreakdown),
                    // esd
                    emotesGlobalRegistry: this.client.emoteRegistry.globalEmoteRegistry.size,
                    emoteConflicts: this.client.emoteRegistry.globalConflicts,
                    // hdd
                    entities: this.client.entities.entities.size,
                    entitiesBreakdown: Object.fromEntries(entitiesBreakdown),
                    settingsLenChars: Buffer.byteLength(JSON.stringify(this.client.dynamicData.settings.data)),
                    // old stuff
                    guilds: this.client.guilds.cache.size,
                    channels: this.client.channels.cache.size,
                    emotes: this.client.emojis.cache.size,
                    rawEvents: tallyRaw,
                    // Not necessarily accurate for side-by-side.
                    messagesCreated: tallyCreatedMessages,
                    commandsExecuted: tallyCommandsExecuted
                }).replace(/\n/g, '')}\n`);
                // Reset tallys
                tallyRaw = 0;
                tallyCreatedMessages = 0;
                tallyCommandsExecuted = 0;
                tallyCommandsBreakdown.clear();
            });
            this.dataCollector.listen(this.secrets.dataCollectionPort, this.secrets.dataCollectionHost);
        }
    }
    public destroy(): Promise<void> {
        if (this.dataCollector)
            this.dataCollector.close();
        return this.client.destroy();
    }
}

// Please don't pay attention. {{{
const oldValidateInfo = commando.Command['validateInfo'];
commando.Command['validateInfo'] = function (client: commando.CommandoClient, info: commando.CommandInfo): void {
    try {
        oldValidateInfo(client, info);
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        if (error.message === 'Command name must not include spaces.') return;
        throw error;
    }
};
const oldValidateAndParseSlashInfo = commando.Command['validateAndParseSlashInfo'];
commando.Command['validateAndParseSlashInfo'] = function (info: commando.CommandInfo, slashInfo?: commando.SlashCommandInfo): commando.APISlashCommand | null {
    const commandInfo = commando.Util.deepCopy(info);
    commandInfo.name = commandInfo.name.split(' ').at(-1)!;
    return oldValidateAndParseSlashInfo(commandInfo, slashInfo);
};
const oldValidateAndParseContextMenuInfo = commando.Command['validateAndParseContextMenuInfo'];
commando.Command['validateAndParseContextMenuInfo'] = function (info: commando.CommandInfo): discord.RESTPostAPIContextMenuApplicationCommandsJSONBody[] {
    const commandInfo = commando.Util.deepCopy(info);
    commandInfo.name = commandInfo.name.split(' ').at(-1)!;
    return oldValidateAndParseContextMenuInfo(commandInfo);
};
// }}}

const ccbot = new CCBotMain();
global.ccbot = ccbot;
global.client = ccbot.client;
global.discord = discord;
global.commando = commando;

let shuttingDown = false;

async function shutdown(): Promise<void> {
    if (shuttingDown)
        return;
    console.log('Goodbye.');
    shuttingDown = true;
    try {
        await ccbot.destroy();
    } catch (e) {
        console.error('During shutdown:', e);
    }
    process.exit(0); // eslint-disable-line no-process-exit
}

process.on('exit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
