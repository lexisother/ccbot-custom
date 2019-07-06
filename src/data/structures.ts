import {RichEmbedOptions} from 'discord.js';
// commands.json
export interface Command {
    // The description. Defaults to 'No Description'.
    description?: string;
    // Ensures this command will only run in NSFW channels.
    // Uses a different definition of NSFW channel to Commando.
    nsfw?: boolean;
    // Commando command info override.
    options?: object;

    // The text. At some point, may be expanded to contain formatting directives (hence the name).
    // The character '%' is reserved for said formatting directives.
    // As such, '%%' will be replaced with '%' as a form of escaping.
    format?: string;
    // Embed (ID of an embed from embed.json)
    embed?: string;
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
}

// embeds.json - maps an embed ID to the RichEmbedOptions for it.
export interface EmbedSet {[id: string]: RichEmbedOptions}
// entities.json - array of newEntity data objects
export type EntitySet = any[];
