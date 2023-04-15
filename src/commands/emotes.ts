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
import {TextBasedChannel, emoteSafe, isGuildChannelTextBased, localAdminCheck, mdEsc, naturalComparison} from '../utils';
import {PageSwitcherOutputElement, outputElements} from '../entities/page-switcher';
import {userAwareGetEmote} from '../entities/user-datablock';

/// A command to list the accessible emotes.
export class ListEmotesCommand extends CCBotCommand {
    private sfw: boolean;

    public constructor(client: CCBot, sfw: boolean) {
        const name = sfw ? 'lsemotes-sfw' : 'lsemotes';
        const opt = {
            name,
            description: sfw ? 'Like lsemotes, but always only shows SFW emotes.' : 'Displays all emotes that the channel allows. Can search if given text, can get by guild ID if given a guild ID, and can show local overrides with "overrides".',
            group: 'general',
            memberName: name,
            args: [
                {
                    key: 'search',
                    prompt: 'Search terms (or a guild ID)?',
                    type: 'string',
                    default: ''
                }
            ]
        } as const;
        super(client, opt);
        this.sfw = sfw;
    }

    public async run(message: commando.CommandoMessage, args: {search: string}): Promise<commando.CommandoMessageResponse> {
        if (args.search == 'overrides')
            if (!message.guild)
                return await message.say('Cannot get overrides for a guild that doesn\'t exist.');
        // User aliases don't apply here, it's the *actual* emote list.
        const refs: string[] = this.client.emoteRegistry.getEmoteRefs(message.guild);
        refs.sort(naturalComparison);
        const elements: PageSwitcherOutputElement[] = [];

        for (const eref of refs) {
            const emote = this.client.emoteRegistry.getEmote(message.guild, eref);
            if (!emote || !emoteSafe(emote, message.channel, this.sfw))
                continue;
            let details = '**Native:**';
            if (args.search == 'overrides') {
                const overrideType = this.client.emoteRegistry.isOverride(message.guild, eref);
                if (!overrideType)
                    continue;
                details = `**${overrideType} override:**`;
            } else {
                // ".cc lsemotes <guild ID>" : emotes per guild
                // ".cc lsemotes XYZ" : Text search "XYZ"
                if ((!(emote instanceof discord.GuildEmoji) || (emote.guild.id !== args.search)) && !eref.includes(args.search))
                    continue;
                // Use this to diagnose problematic emotes
                if (emote instanceof discord.GuildEmoji)
                    details = `**${mdEsc(emote.guild.name)} [${emote.guild.id}]:**`;
            }
            elements.push({
                category: details,
                text: `${mdEsc(eref)} ${emote.toString()}`
            });
        }

        if (elements.length > 0)
            return outputElements(this.client, message, elements, 20, 2000);
        else
            return await message.say('No emotes found!');
    }
}

/// A command to say a set of emotes.
export class EmoteCommand extends CCBotCommand {
    public constructor(client: CCBot) {
        const opt: commando.CommandInfo = {
            name: '-general emote',
            description: 'Writes out a series of emotes. You can use two special characters for aligning multi-emote pictures: put ` - ` between two emotes to remove the space between them, use ` \\ ` to add a newline.',
            group: 'general',
            memberName: 'emote',
            args: [
                {
                    key: 'emotes',
                    prompt: 'Emotes',
                    type: 'string',
                    infinite: true
                }
            ]
        };
        super(client, opt);
    }

    public async run(message: commando.CommandoMessage, args: {emotes: string[]}): Promise<commando.CommandoMessageResponse> {
        if ((args.emotes.length > 0) && (args.emotes[0] == 'emote_reset')) {
            if (localAdminCheck(message)) {
                this.client.emoteRegistry.updateGlobalEmoteRegistry();
                return message.say('It is done.');
            } else {
                return message.say('Not allowed...');
            }
        }
        let text = '';
        let separator = ' ';
        for (let i = 0; i < args.emotes.length; i++) {
            const emoteArg = args.emotes[i];
            switch (emoteArg) {
                case '-': {
                    separator = '';
                    break;
                }
                case '\\': {
                    separator = '\n';
                    break;
                }
                default: {
                    const emote = await userAwareGetEmote(this.client, message.author, message.guild || null, emoteArg);
                    if (!emote || !emoteSafe(emote, message.channel))
                        continue;
                    if (text.length > 0)
                        text += separator;
                    text += emote.toString();
                    separator = ' ';
                }
            }
        }
        return message.say(text || 'No emotes or they were all nsfw');
    }
}

/// A command to react with a set of emotes.
export class ReactCommand extends CCBotCommand {
    public constructor(client: CCBot) {
        const opt = {
            name: '-general react',
            description: 'Provides the specified reactions.',
            group: 'general',
            memberName: 'react',
            args: [
                {
                    key: 'emotes',
                    prompt: 'Emote names. Can start with "chan=<channel id> id=<message id>" to target a specific message. In this case, "chan=<channel id>" can be omitted if the message is in the current channel. Can be used by replying to a different message.',
                    type: 'string',
                    infinite: true
                }
            ]
        } as const;
        super(client, opt);
    }

    public async run(message: commando.CommandoMessage, args: {emotes: string[]}): Promise<commando.CommandoMessageResponse> {
        if (args.emotes.length > 8)
            return await message.say('Why?');
        // NOTE: To prevent NSFW emote leakage, that check is done based on the target channel.
        // However, the *emote lookup* is based on the source channel (otherwise things don't make sense)
        let targetChannel: TextBasedChannel;
        let targetMessage: discord.Message;
        let start = 0;
        if (
            (message.type === discord.MessageType.Default || message.type === discord.MessageType.Reply) && message.reference != null &&
            message.reference.guildId === message.guild?.id && message.reference.messageId != null
        ) {
            let referencedChannel = message.guild?.channels.cache.get(message.reference.channelId);
            if (referencedChannel == null || !isGuildChannelTextBased(referencedChannel)) {
                return await message.say('That\'s surprising. How did you manage to reply to a message from an invalid channel?');
            }
            targetChannel = referencedChannel;
            try {
                targetMessage = await targetChannel.messages.fetch(message.reference.messageId);
            } catch (_e) {
                return await message.say('The message you replied to most likely was deleted.');
            }
        } else {
            targetChannel = message.channel;
            targetMessage = (await targetChannel.messages.fetch({ before: message.id, limit: 1 })).first() || message;
            if (args.emotes[start].startsWith('chan=')) {
                let place = args.emotes[start].substring(5);
                if (place.startsWith('<#') && place.endsWith('>'))
                    place = place.substring(2, place.length - 1);
                const part = this.client.channels.cache.get(place);
                if ((!part) || !(part instanceof discord.TextChannel))
                    return await message.say('The channel doesn\'t seem to exist or isn\'t valid for reaction.');
                targetChannel = part;
                start++;
            }
            if (args.emotes[start].startsWith('id=')) {
                try {
                    targetMessage = await targetChannel.messages.fetch(args.emotes[start].substring(3));
                } catch (_e) {
                    return await message.say('The message doesn\'t seem to exist.');
                }
                start++;
            }
        }
        if (targetMessage.channel !== targetChannel)
            return await message.say('Lea bye.');
        for (let i = start; i < args.emotes.length; i++) {
            const emote = await userAwareGetEmote(this.client, message.author, message.guild || null, args.emotes[i]);
            if (!emote || !emoteSafe(emote, targetChannel))
                continue;
            await targetMessage.react(emote instanceof discord.GuildEmoji ? emote : emote.name!);
        }
        return [];
    }
}
