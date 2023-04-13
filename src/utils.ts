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
import * as https from 'https';
import * as http from 'http';
import * as url from 'url';

// dmitmel: Needed for running tests because of Commando extensions
import './ccbot';

/// Alias that's simpler to access
export const mdEsc = discord.escapeMarkdown;

/// Returns if a given channel is appropriate for NSFW information.
export function nsfw(channel: discord.Channel): boolean {
    if (channel instanceof discord.TextChannel) {
        if (channel.guild.verified)
            return false;
        return channel.nsfw;
    } else if (channel instanceof discord.DMChannel) {
        return true;
    }
    return false;
}

/// Returns if a given guild is considered a liability SFW-wise.
export function nsfwGuild(client: commando.CommandoClient, guild: discord.Guild): boolean {
    if (!client.isProviderReady()) return false;
    if (client.provider.get('global', `nsfw-${guild.id}`, false))
        return true;
    const val = client.provider.get(guild, 'nsfw', true);
    return (val || false) && true;
}

/// Ensures an emote is safe to use. If 'sfw' is set to true, ignores channel NSFWness.
export function emoteSafe(emote: discord.Emoji, channel: discord.Channel | null, sfw?: boolean): boolean {
    // otherwise, let's reason this out:
    const client = emote.client as unknown as commando.CommandoClient;
    if (!client.isProviderReady()) return false;
    sfw = sfw || false;
    // if channel is NSFW, it's always safe to use it here
    if (!sfw && channel != null && nsfw(channel))
        return true;
    if (!(emote instanceof discord.GuildEmoji))
        return true; // No guild? Discord built-in, can't be lewd
    const { guild } = emote;
    // *global* NSFW flag means WE DO NOT TRUST THIS GUILD (i.e. they've not properly documented their NSFW stuff)
    if (client.provider.get('global', `nsfw-${guild.id}`, false))
        return false;
    // We trust the guild, so first check the specific emote
    if (emote.id) {
        const sfwList: string[] = client.provider.get(guild, 'emotes-sfw', [])
        if (Array.isArray(sfwList) && sfwList.includes(emote.id))
            return true;
    }
    // Failing this, *local* NSFW flag means guild emotes should be considered NSFW by default
    if (client.provider.get(guild, 'nsfw', true))
        return false;
    // Failing this, we have no reason to believe the emote is NSFW
    return true;
}

export type GuildTextBasedChannel = discord.TextChannel | discord.NewsChannel;
export function isGuildChannelTextBased(channel: discord.GuildChannel): channel is GuildTextBasedChannel {
    return channel instanceof discord.TextChannel || channel instanceof discord.NewsChannel;
}

export type TextBasedChannel = discord.DMChannel | GuildTextBasedChannel;
export function isChannelTextBased(channel: discord.Channel): channel is TextBasedChannel {
    return channel instanceof discord.DMChannel || isGuildChannelTextBased(channel as discord.GuildChannel);
}

export function getGuildTextChannel(client: commando.CommandoClient, guild: discord.Guild, id: string): GuildTextBasedChannel | undefined {
    if (!client.isProviderReady()) return;
    const guildChannel = client.provider.get(guild, `channel-${id}`, '');
    const result = guild.channels.cache.find((c: discord.GuildBasedChannel) => {
        return (c.id == guildChannel) || (c.name == guildChannel)
    }) as unknown as discord.GuildChannel;
    if (!result || !isGuildChannelTextBased(result))
        return undefined;
    return result;
}

/// Use if you think a failed promise really doesn't matter.
export function silence(n: Promise<unknown>): void {
    n.catch((): void => {});
}

/// A random array element picker.
export function randomArrayElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

/// Sorts in a natural (?) manner.
export function naturalComparison(a: string, b: string): number {
    a = a.toLowerCase();
    b = b.toLowerCase();
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const cha = a.charCodeAt(i);
        const chb = b.charCodeAt(i);
        if (cha < chb)
            return -1;
        if (cha > chb)
            return 1;
    }
    if (a.length < b.length)
        return -1;
    if (a.length > b.length)
        return 1;
    return 0;
}

/// Checks if a user is at the local guild's bot-administrative level.
export function localAdminCheck(t: commando.CommandoMessage): boolean {
    if (t.client.owners!.includes(t.author))
        return true;
    if (t.member)
        if (t.member.permissions.has("Administrator"))
            return true;
    return false;
}

export const mentionRegex = /<@!?([0-9]*)>/g;

export function findMemberByRef(t: discord.Guild | undefined | null, ref: string): discord.GuildMember | null {
    if (!t)
        return null;

    const mention = mentionRegex.exec(ref);
    if (mention)
        return t.members.cache.get(mention[1]) || null;

    const byId = t.members.cache.get(ref);
    if (byId)
        return byId;

    const candidates: discord.GuildMember[] = t.members.cache.filter((v: discord.GuildMember): boolean => {
        return (v.user.username.includes(ref)) || (ref == (`${v.user.username}#${v.user.discriminator}`)) || (ref == v.user.id) || (ref == v.nickname);
    }).toJSON();
    if (candidates.length == 1)
        return candidates[0];
    return null;
}

// An integer parser that knows when to abort
export function safeParseInt(a: string): number {
    const res = parseInt(a); // eslint-disable-line radix
    if (!Number.isSafeInteger(res))
        throw new Error(`Number ${a} is not a sane integer`);
    if (res.toString() !== a)
        throw new Error(`Number ${a} does not convert back into itself`);
    return res;
}

export function checkIntegerResult(a: number): void {
    if (!Number.isSafeInteger(a))
        throw new Error(`Operation result became ${a}`);
}

/// Retrieves a JSON file from the 'web
/// NOTE: headers is modified for added spice.
export function getJSON<T>(endpoint: string, headers: Record<string, string>): Promise<T> {
    // Older versions of Node don't do the "automatic parsing of URLs" thing if an object is passed
    // Rest of the bot works fine so might as well put this here
    const endpointURL = new url.URL(endpoint);
    const builtObj: http.ClientRequestArgs = {
        protocol: endpointURL.protocol,
        hostname: endpointURL.hostname,
        port: endpointURL.port,
        path: endpointURL.pathname + endpointURL.search,
        headers
    };
    const secure = endpointURL.protocol == 'https:';
    headers['user-agent'] = 'ccbot-new (red queen)';
    // Empty-string-check-behavior INTENDED
    if (endpointURL.username)
        builtObj.auth = `${endpointURL.username}:${endpointURL.password}`
    return new Promise((resolve, reject): void => {
        const target = secure ? https : http;
        const request = target.get(builtObj, (res: http.IncomingMessage): void => {
            res.setEncoding('utf8');
            let data = '';
            res.on('data', (piece): void => {
                data += piece;
            });
            res.on('end', (): void => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        request.on('error', (e: Error): void => {
            reject(e);
        });
    });
}

/// Puts anti-stupidity limits on anything that looks remotely like an HTTP request-related number.
/// This is meant for numbers *below* the setTimeout ceiling and *will throw* if a number above that is given.
export function boundRequestTimeout(n: number | undefined): number {
    n = n || 60000;
    if (n >= 0x40000000)
        throw new Error('boundRequestTimeout, which usually does not handle several-day-long timeouts, received a several-day-long timeout. Something is wrong with your configuration.');
    return Math.min(Math.max(n, 60000), 0x40000000);
}

/// Reports a random "Done!"-like response to make the spam less boring.
export function doneResponse(): string {
    return randomArrayElement([
        'Ah, yes. I\'ve done it.',
        'As you wish.',
        'Done!',
        'Done thing!',
        'Did it in ten (^-1). Seconds. Flat.',
        'Did it! (Do I get a sandwich now?)',
        'Eeeyup!',
        'I\'ve done that.',
        'It\'s done.',
        'It\'s done!',
        'Ja! <Yes!>',
        'Objective complete.',
        'Objective complete! What next?',
        'Okay!',
        'Ok! (Hi!)',
        'Ok, did it!',
        'Okie-dokie!',
        'Okie-dokie-lokie!',
        'Success!',
        'Successful.',
        'Succeeded!',
        'Sure! ...Done!',
        'Yes!',
        'Yep!',
        'Your wish is my command.',
        'Yup!',
        'Yuppers!',
        'Yeah, did it.',
        '👍',
        '*nods*',
        '*smiles, then nods*',
        '*wakes up and sees the command. Her eyes widen, she performs the task, and she nods.*',
    ])
}
