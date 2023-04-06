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
import * as structures from '../data/structures';
import {nsfw} from '../utils';
import {CCBot, CCBotCommand} from '../ccbot';
import {VM, VMContext, runFormat} from '../formatter';
import {userAwareGetEmote} from '../entities/user-datablock';

/// Copies an object while also formatting it.
/// Don't ask me how the type conversions are supposed to make sense.
/// They don't.
async function copyAndFormat(vm: VM, embed: unknown): Promise<unknown> {
    if (typeof embed === 'string')
        return await runFormat(embed, vm);
    if (typeof embed === 'object') {
        const o: Record<string, unknown> = {};
        for (const k in embed)
            o[k] = await copyAndFormat(vm, (embed as Record<string, unknown>)[k]);
        return o;
    }
    return embed;
}

/// A JSON-run "command", but really more like a responder.
/// For format details, please see the structures file.
export default class JSONCommand extends CCBotCommand {
    // The JSON command structure.
    private readonly command: structures.Command;

    public constructor(client: CCBot, group: string, name: string, json: structures.Command) {
        const opt = {
            name: `-${group.toLowerCase()} ${name.toLowerCase()}`,
            description: json.description || 'No description.',
            group: group.toLowerCase(),
            memberName: name.toLowerCase()
        };
        // Allows overriding the involved Commando options.
        // This includes adding arguments.
        if (json.options)
            Object.assign(opt, json.options);
        super(client, opt);
        this.command = json;
    }

    public async run(message: commando.CommandoMessage, args: {args: string[]}): Promise<discord.Message|discord.Message[]> {
        if (this.command.nsfw && !nsfw(message.channel))
            return await message.say('That command is NSFW, and this is not an NSFW channel.');

        // VM State Init
        const vmContext: VMContext = {
            client: this.client,
            channel: message.channel,
            cause: message.author,
            // JSON commands are always part of the bot (for now)
            writer: message.author,
            protectedContent: false,
            args: [],
        };

        // VM Arguments Init
        if (args && args.args) {
            // TODO: when can args.args be not an array?
            if (args.args.constructor === Array) {
                vmContext.args = args.args;
            } else {
                vmContext.args = [args.args.toString()];
            }
        }
        for (const arg of vmContext.args)
            if (typeof arg !== 'string')
                return await message.say('That command can only eat strings, but it was given non-strings.');

        // VM Execution
        let formatText;
        {
            const vm = new VM(vmContext);
            // Basic Command
            formatText = await runFormat(this.command.format || '', vm);
            // MO/JSON-supplied Embed
            if (this.command.embed)
                vmContext.embed = await copyAndFormat(vm, this.command.embed) as discord.MessageEmbedOptions;
        }

        // Message Options
        const opts: discord.MessageOptions & { split: false } = { split: false };
        let hasMeta = false;
        {
            // Embed
            if (vmContext.embed) {
                opts.embed = vmContext.embed;
                hasMeta = true;
            }
        }

        // Side-effects
        {
            // Reactions to original command message
            if (this.command.commandReactions) {
                for (const react of this.command.commandReactions) {
                    const emote = await userAwareGetEmote(this.client, message.author, message.guild || null, react);
                    // @ts-ignore
                    await message.react(emote instanceof discord.BaseGuildEmoji ? emote : emote.name);
                }
            }
        }

        // Actually send resulting message if necessary
        if ((formatText != '') || hasMeta)
            return await message.say(formatText, opts);
        return [];
    }
}
