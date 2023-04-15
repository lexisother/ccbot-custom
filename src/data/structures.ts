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
// commands.json
export interface Command {
    // The description. Defaults to 'No Description'.
    description?: string;
    // Ensures this command will only run in NSFW channels.
    // Uses a different definition of NSFW channel to Commando.
    nsfw?: boolean;
    // Commando command info override.
    options?: commando.CommandInfo;

    // The text. May contain traces of format directives, prefixed with %.
    // See formatter.ts for more details.
    format?: string;
    // Embed (Note, however, that all strings here are valid targets for format directives!)
    embed?: discord.EmbedData;
    // Reactions to the command.
    commandReactions?: string[];
}
export interface CommandGroup {[command: string]: Command}
export interface CommandSet {[group: string]: CommandGroup}

// secrets.json
export interface Secrets {
    // The Discord bot token.
    token: string;
    // Prefix for commands.
    commandPrefix: string;
    // Bot owners.
    owner: string | string[];
    // If present, the port for data collection.
    // Make sure this is properly secured!
    dataCollectionPort?: number;
    // If present, sets a host for the data collection (important for net. security)
    dataCollectionHost?: string;
    // Twitch Client ID, if you have one.
    // If not, twitch-stream-provider is not registered as a valid entity
    twitchClientId?: string;
    // YouTube Data API v3 API key, if you have one.
    // If not, youtube-stream-provider is not registered as a valid entity
    youtubeData3Key?: string;
}

// Implements the persistence backend.
export interface GuildData {[setting: string]: unknown}

export interface GuildIndex {[guildID: string]: GuildData}

export interface SettingsStructure {
    prefix?: string | null;
    emotes?: string[];
    emotePath?: string[];
    quotes: string[];
    lastQuote: number;
    'emotes-registry-allowList'?: string[];
    'emotes-registry-blockList'?: string[];
     [k: `cmd-${string}-${string}`]: boolean;
     [k: `grp-${string}`]: boolean;
     [k: `emote-${string}`]: number;
}

/// see https://github.com/CCDirectLink/CCModDB
export interface CCModDBPackagePage {
    name: string;
    url: string;
}
export interface CCModDBPackage {
    name: string;
    version: string;
    description?: string;
    page: CCModDBPackagePage[];
}

export interface EmoteRegistryDumpEntry {
    ref: string;
    id: discord.Snowflake;
    name: string;
    requires_colons: boolean;
    animated: boolean;
    url: string;
    safe: boolean;
    guild_id: discord.Snowflake;
    guild_name: string;
}

export interface EmoteRegistryDump {
    version: number;
    list: EmoteRegistryDumpEntry[];
}
