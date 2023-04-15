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
import {doneResponse, localAdminCheck} from '../utils';
import {getUserDatablock} from '../entities/user-datablock';
import { SaneSettingProvider } from '../setting-provider';
import { SettingsStructure } from '../data/structures';

// Important (i.e. non-obvious) limits
const limitLocalCommand = 2000;
const limitLocalEmote = 128;
const limitLocalChannelName = 128;
const limitLocalEmotesArray = 2000;
const limitLocalRoleGroup = 2000;
const limitPrefix = 16;

export enum SettingsOperation {
    Get,
    Set,
    Rm
}

export enum SettingsContext {
    Global,
    Local,
    User
}

// <editor-fold desc="Backend" defaultstate=collapsed>
// Returns null on success.
async function runLocalSettingTransaction(provider: SaneSettingProvider, context: discord.Guild, name: keyof SettingsStructure, value: undefined | string | undefined[]): Promise<string | null> {
    let maxLength = 0;
    let doneCallback = async (): Promise<void> => {};
    const startsWithRG = name.startsWith('roles-group-');
    if (name === 'prefix') {
        if ((value === undefined) || (typeof value === 'string'))
            maxLength = limitPrefix;
    } else if (name === 'nsfw') {
        if ((value === undefined) || (typeof value === 'boolean'))
            maxLength = 16;
    } else if (name === 'headerless-say') {
        if ((value === undefined) || (typeof value === 'boolean'))
            maxLength = 16;
    } else if (name === 'optin-roles') {
        if ((value === undefined) || (value === 'yes') || (value === 'both') || (value === 'no'))
            maxLength = 16;
    } else if ((name === 'greeting') || (name === 'dm-greeting') || (name == 'farewell')) {
        if ((value === undefined) || (typeof value === 'string'))
            maxLength = limitLocalCommand;
    } else if ((name === 'emotes-sfw') || (name === 'emotes-registry-allowList') || (name === 'emotes-registry-blockList')) {
        if ((value === undefined) || (Array.isArray(value)))
            maxLength = limitLocalEmotesArray;
    } else if (name.startsWith('emote-') || startsWithRG) {
        // NOTE: Despite the name of variables here, this gets both emote- and roles-group- items.
        const base = startsWithRG ? 'roles-group-' : 'emote-';
        const arrayName = startsWithRG ? 'roles-groups' : 'emotes';

        let emotesArrayBase: string[] = await provider.get(context, arrayName, []);
        if (!Array.isArray(emotesArrayBase))
            emotesArrayBase = [];
        const emotesArray = emotesArrayBase.concat();
        const emoteName = name.substring(base.length);
        if (value === undefined) {
            // Removal always works
            maxLength = 1;
            const emotesArrayIndex = emotesArray.indexOf(emoteName);
            if (emotesArrayIndex !== -1) {
                emotesArray.splice(emotesArrayIndex, 1);
                doneCallback = async (): Promise<void> => {
                    await provider.set(context, arrayName, emotesArray);
                };
            }
        } else if (startsWithRG ? Array.isArray(value) : typeof value === 'string') {
            // Addition requires doing a sanity length check on the emotes array
            maxLength = startsWithRG ? limitLocalRoleGroup : limitLocalEmote;
            const emotesArrayIndex = emotesArray.indexOf(emoteName);
            if (emotesArrayIndex === -1)
                emotesArray.push(emoteName);
            if (JSON.stringify(emotesArray).length > limitLocalEmotesArray)
                return 'Adding this item would make the items array too long.';
            doneCallback = async (): Promise<void> => {
                await provider.set(context, arrayName, emotesArray);
            };
        }
    } else if ((name === 'roles-exclusive') || (name === 'roles-inclusive') || (name === 'roles-whitelist')) {
        if ((value === undefined) || (Array.isArray(value)))
            maxLength = limitLocalRoleGroup;
    } else if ((name === 'channel-greet') || (name === 'channel-info') || (name === 'channel-syslog') || (name === 'channel-editlog')) {
        if ((value === undefined) || (typeof value === 'string'))
            maxLength = limitLocalChannelName;
    }
    if (!maxLength)
        return 'The setting was not recognized. If this setting is readable, keep in mind that some documented settings are automatically maintained.';
    if (value === undefined) {
        await provider.remove(context, name);
    } else {
        if (JSON.stringify(value).length > maxLength)
            return 'The setting is too long.';
        if (name === 'prefix') {
            // dmitmel: While debugging this I blamed every encountered bug on
            // Commando. I WASN'T WRONG!
            // TODO: Maybe the special case for the prefix can be moved into
            // the SaneSettingProvider.
            (context as commando.CommandoGuild).prefix = value as string;
        } else {
            await provider.set(context, name, value as string);
        }
    }
    await doneCallback();
    return null;
}

function isAuthorized(message: commando.CommandoMessage, operation: SettingsOperation, context: SettingsContext, contextInstance: string): boolean {
    // Validate instance
    if ((context == SettingsContext.Global) && (contextInstance != 'global'))
        return false;
    if ((context == SettingsContext.Local) && (!message.client.guilds.cache.has(contextInstance)))
        return false;
    if ((context == SettingsContext.User) && (!message.client.users.cache.has(contextInstance)))
        return false;
    // Authorized?
    if (message.client.isOwner(message.author))
        return true;
    if (context == SettingsContext.Local) {
        if (!message.guild)
            return false;
        if (!localAdminCheck(message))
            return false;
        if (contextInstance != message.guild.id)
            return false;
        return true;
    } else if (context == SettingsContext.User) {
        return message.author.id == contextInstance;
    } else {
        // Also covers Global (which has no access except for owner) so do not make true by default
        return false;
    }
}

function isAuthorizedToChange(message: commando.CommandoMessage, name: string): boolean {
    if (message.client.isOwner(message.author))
        return true;
    // Owner-only settings
    if (name === 'nsfw')
        return false;
    // ...

    if (localAdminCheck(message))
        return true;
    // Admin-only settings
    // ...

    return true;
}
// </editor-fold>

/// A command to configure bot systems.
export class SettingsCommand extends CCBotCommand {
    public readonly operation: SettingsOperation;
    public readonly context: SettingsContext;
    public constructor(client: CCBot, op: SettingsOperation, target: SettingsContext) {
        const localName = `${SettingsOperation[op].toLowerCase()}-${SettingsContext[target].toLowerCase()}`;
        const opt: commando.CommandInfo<boolean, commando.ArgumentInfo[]> = {
            name: `-util ${localName}`,
            description: `${SettingsOperation[op]} ${SettingsContext[target].toLowerCase()} setting.`,
            group: 'util',
            memberName: localName,
            args: [
                {
                    key: 'key',
                    prompt: 'Which setting?',
                    type: 'string'
                }
            ]
        };
        if (op == SettingsOperation.Set) {
            opt.args?.push({
                key: 'value',
                prompt: 'What value would you like today? (JSON)',
                type: 'string'
            })
        }
        super(client, opt);
        this.operation = op;
        this.context = target;
    }

    public async run(message: commando.CommandoMessage, args: {key: keyof SettingsStructure; value: string}): Promise<commando.CommandoMessageResponse> {
        let instance = '';
        if (this.context === SettingsContext.Global) {
            instance = 'global';
        } else if (this.context === SettingsContext.Local) {
            if (message.guild) {
                instance = message.guild.id;
            } else {
                return message.say('No local guild.');
            }
        } else if (this.context === SettingsContext.User) {
            instance = message.author.id;
        }

        if (!isAuthorized(message, this.operation, this.context, instance))
            return message.say('You aren\'t authorized to do that.');

        let value;
        if (this.operation == SettingsOperation.Get) {
            // Reading
            if ((this.context == SettingsContext.Global) || (this.context == SettingsContext.Local)) {
                // This relies on instance === 'global' for Global context.
                // Essentially, if not for runLocalSettingTransaction,
                //  both local & global contexts would use the same code
                value = this.client.provider!.get(instance, args.key);
            } else if (this.context == SettingsContext.User) {
                const dbl = await getUserDatablock(this.client, instance);
                value = dbl.get()[args.key];
            }
            if (value === undefined)
                return message.say('That value does not exist.');
            return message.say(`Done:\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``);
        } else {
            // Writing
            if (!isAuthorizedToChange(message, args.key))
                return message.say('You aren\'t authorized to change that.');

            if (this.operation == SettingsOperation.Set) {
                try {
                    value = JSON.parse(args.value);
                } catch (e) {
                    return message.say(`Your JSON was incorrect:\n${e}`);
                }
            }
            if (this.context == SettingsContext.Global) {
                if (value === undefined) {
                    await this.client.provider!.remove('global', args.key);
                } else {
                    await this.client.provider!.set('global', args.key, value);
                }
                return message.say(doneResponse());
            } else if (this.context == SettingsContext.Local) {
                const guild = this.client.guilds.cache.get(instance);
                if (!guild)
                    return message.say('How\'d you get here, then?');
                return message.say((await runLocalSettingTransaction(this.client.provider!, guild, args.key, value)) || doneResponse());
            } else if (this.context == SettingsContext.User) {
                const dbl = await getUserDatablock(this.client, instance);
                const db = dbl.get();
                if (value === undefined) {
                    delete db[args.key];
                } else {
                    db[args.key] = value;
                }
                dbl.set(db);
                return message.say(doneResponse());
            }
        }
        return message.say('Unable to handle the specified request.');
    }
}

/// A command to configure bot systems.
export class ShowUserSettingsCommand extends CCBotCommand {
    public constructor(client: CCBot) {
        const opt = {
            name: '-util show-user-settings',
            description: 'Show the entire contents of your user settings datablock.',
            group: 'util',
            memberName: 'show-user-settings'
        };
        super(client, opt);
    }

    public async run(message: commando.CommandoMessage): Promise<commando.CommandoMessageResponse> {
        const res = (await getUserDatablock(this.client, message.author)).content;
        return message.say(`\`\`\`json\n${discord.cleanCodeBlockContent(res)}\n\`\`\``);
    }
}
