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
import {emoteSafe, naturalComparison, nsfwGuild, silence} from './utils';
import {EmoteRegistryDump} from './data/structures';
import {RawEmojiData} from 'discord.js/typings/rawDataTypes';

/// Determine if a bit of text looks like an emoji.
/// Notably, it doesn't actually have to *be* an emoji,
/// it just has to not look too much like one to stop people complaining over 'bugs' that don't exist.
/// We're not embedding a dictionary of every possible emoji combination just so that
/// emote doesn't accept a few invalid combinations.
function looksLikeAnEmoji(text: string): boolean {
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code < 128)
            return false;
    }
    return true;
}

class CCBotEmoji extends discord.Emoji {
  constructor(client: CCBot, emoji: RawEmojiData) {
    super(client, emoji);
  }
}

/// A registry of emotes.
/// Not enough of a separatable process to qualify for Entity status,
/// but it would be messy for this to remain in the main CCBot class.
export default class CCBotEmoteRegistry {
    public readonly client: CCBot;

    // NOTE: This does *not* include per-guild settings or global settings.
    public globalEmoteRegistry: Map<string, discord.GuildEmoji> = new Map();
    public globalConflicts = 0;

    public constructor(c: CCBot) {
        this.client = c;
    }

    /// Updates the global emote registry.
    /// This is where all the emotes go.
    /// In case of conflict, it uses 'trust prioritization' to try and avoid any incidents.
    public updateGlobalEmoteRegistry(): void {
        // NOTE! The type here isn't totally right, but the constructor-checking condition prevents any issues.
        // It is possible for some truly evil JSON to set constructor, but it can't be set to Array legitimately.
        const safetyList: string[] | undefined = this.client.provider.get('global', 'emotePath', []);
        const globalAllowList: string[] | undefined = this.client.provider.get('global', 'emotes-registry-allowList');
        const globalBlockList: string[] | undefined = this.client.provider.get('global', 'emotes-registry-blockList');
        const localRegistryCollation: Map<string, discord.GuildEmoji[]> = new Map();
        for (const guild of this.client.guilds.cache.values()) {
            const allowList: string[] | undefined = this.client.provider.get(guild, 'emotes-registry-allowList');
            const blockList: string[] | undefined = this.client.provider.get(guild, 'emotes-registry-blockList');
            for (const emote of guild.emojis.cache.values()) {
                if ((globalBlockList?.includes(emote.id)) || (blockList?.includes(emote.id)))
                    continue;
                if ((globalAllowList && !globalAllowList.includes(emote.id)) || (allowList && !allowList.includes(emote.id)))
                    continue;
                let emotes: discord.GuildEmoji[] | undefined = localRegistryCollation.get(emote.name);
                if (!emotes) {
                    emotes = [];
                    localRegistryCollation.set(emote.name, emotes);
                }
                emotes.push(emote);
            }
        }
        const localRegistry: Map<string, discord.GuildEmoji> = new Map();
        // Start tallying conflicts
        this.globalConflicts = 0;
        for (const pair of localRegistryCollation) {
            // Conflict resolution
            pair[1].sort((a: discord.GuildEmoji, b: discord.GuildEmoji): number => {
                // Firstly, check position in safety list (if available)
                // This code is written with safety margins to prevent crashing in case of user error.
                if (safetyList && Array.isArray(safetyList)) {
                    let ag = safetyList.indexOf(a.guild.id);
                    if (ag < 0)
                        ag = safetyList.length;
                    let bg = safetyList.indexOf(b.guild.id);
                    if (bg < 0)
                        bg = safetyList.length;

                    if (ag < bg) {
                        return -1;
                    } else if (ag > bg) {
                        return 1;
                    }
                }
                // Secondly, SFW emotes are prioritized over NSFW ones,
                //  so an NSFW emote can't be used to shadow a SFW emote even when both emotes are untrusted,
                //  which should prevent anything mysterious happening (NSFW emotes being hidden)
                const nsfwA = nsfwGuild(this.client, a.guild);
                const nsfwB = nsfwGuild(this.client, b.guild);
                if (nsfwA != nsfwB) {
                    if (nsfwA) {
                        return 1;
                    } else {
                        return -1;
                    }
                }
                // Thirdly, natural comparison of emote snowflakes.
                return naturalComparison(a.id, b.id);
            });
            // Assign IDs: Winner gets the real name, losers get the #-postfixed names
            localRegistry.set(pair[0], pair[1][0]);
            if (pair[1].length != 1)
                this.globalConflicts++;
            for (let i = 1; i < pair[1].length; i++)
                localRegistry.set(`${pair[0]}#${pair[1][i].guild.id}`, pair[1][i]);
        }
        this.globalEmoteRegistry = localRegistry;

        this.dumpToFile();
    }

    /// Checks if an emote is overridden at guild or global level.
    public isOverride(guild: discord.Guild | null, name: string): 'guild' | 'global' | null {
        // Local emote overrides
        if (guild) {
            const value = this.client.provider.get(guild, `emote-${name}`);
            if (value)
                return 'guild';
        }
        // Global emote overrides
        const value = this.client.provider.get('global', `emote-${name}`);
        if (value)
            return 'global';
        return null;
    }

    /// Gets an emote as a discord.Emoji
    /// NOTE! Use userAwareGetEmote whenever possible.
    /// Emote grabbing should operate from the Writer's perspective,
    /// which means hug emote can be overridden by user, etc.
    public getEmote(guild: discord.Guild | null, name: string): discord.GuildEmoji | discord.Emoji {
        // Local emote overrides
        if (guild) {
            const value = this.client.provider.get(guild, `emote-${name}`);
            if (value)
                return this.emojiResolverNina(value.toString());
        }
        // Global emote overrides
        const value = this.client.provider.get('global', `emote-${name}`);
        if (value)
            return this.emojiResolverNina(value.toString());
        // Emote registry
        const gResult = this.globalEmoteRegistry.get(name);
        if (gResult)
            return gResult;
        // Emote IDs / Written custom emotes / Unicode emotes
        return this.emojiResolverNina(name);
    }

    /// Don't ask about the name.
    /// This defines the syntax of the "emote-".
    public emojiResolverNina(text: string): commando.CommandoGuildEmoji | discord.Emoji {
        // Is it just an emote ID?
        const direct = this.client.emojis.cache.get(text);
        if (direct)
            return direct;
        // Is it a written custom emote?
        if (text.startsWith('<') && text.endsWith('>')) {
            let match = /^<a?:[^:\s]+:([0-9]+)>$/.exec(text);
            console.log(match);
            if (match) {
                const direct = this.client.emojis.cache.get(match[1]);
                if (direct)
                    return direct;
            }
        }
        // Is it a unicode emote?
        return new CCBotEmoji(this.client, {
            animated: false,
            name: looksLikeAnEmoji(text) ? text : '❓',
            // id: null,
        });
    }

    /// Lists all emote refs.
    public getEmoteRefs(guild: discord.Guild | null): string[] {
        const a: string[] = [];
        for (const k of this.globalEmoteRegistry.keys())
            a.push(k);
        for (const v of this.client.provider.get('global', 'emotes', []))
            if (!a.includes(v))
                a.push(v.toString());
        if (guild)
            for (const v of this.client.provider.get(guild, 'emotes', []))
                if (!a.includes(v))
                    a.push(v.toString());
        return a;
    }

    public dumpToFile(): void {
        const data: EmoteRegistryDump = { version: 1, list: [] };
        // TODO: perhaps iterate this.globalEmoteRegistry directly?
        for (const ref of this.getEmoteRefs(null)) {
            const emote = this.getEmote(null, ref);
            if (emote instanceof discord.GuildEmoji) {
                data.list.push({
                    ref,
                    id: emote.id,
                    name: emote.name,
                    requires_colons: emote.requiresColons || false,
                    animated: emote.animated,
                    url: emote.url,
                    safe: emoteSafe(emote, null, true),
                    guild_id: emote.guild.id,
                    guild_name: emote.guild.name,
                });
            }
        }
        silence(this.client.dynamicData.emoteRegistryDump.dump(data));
    }
}
