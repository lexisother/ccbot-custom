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

import * as discord from 'discord.js';
import { CCBot, CCBotEntity } from '../ccbot';
import { EntityData } from '../entity-registry';

export interface StarboardData extends EntityData {
  // Guild ID
  guild: string;
  messages?: Record<discord.Snowflake, number>;
  starBinds?: Record<discord.Snowflake, discord.Snowflake>;
}

/// I wish every
///   reader of this code
/// a happy
///   aneurysm
class StarboardEntity extends CCBotEntity {
  /// Guild we're watching.
  private guild: discord.Guild;
  /// The amount of stars on a message.
  private messages: Record<discord.Snowflake, number>;
  /// Record of origin messages that map to their starboard messages.
  private starBinds: Record<discord.Snowflake, discord.Snowflake>;

  public constructor(c: CCBot, g: discord.Guild, data: StarboardData) {
    super(c, `starboard-${g.id}`, data);
    this.guild = g;
    this.messages = data.messages ?? {};
    this.starBinds = data.starBinds ?? {};
    this.client.on('ccbotMessageReactionAdd', this.handleReactionAdd.bind(this));
  }

  public async handleReactionAdd(
    emote: discord.Emoji,
    message: discord.Snowflake,
    channel: discord.Snowflake,
    guild: discord.Snowflake,
    add: boolean,
  ): Promise<void> {
    if (!this.client.isProviderReady()) return;
    if (guild !== this.guild.id) return;
    const gChannel = this.client.provider.get(this.guild, 'starboard-channel', "0");
    if (gChannel === "0") return;

    // Ye who tread here, tread with utmost care.
    if (emote.name === '⭐') {
      let starboardChannel = this.guild.channels.cache.get(gChannel) as discord.TextChannel;
      if (!starboardChannel)
        starboardChannel = (await this.client.channels.fetch(gChannel)) as discord.TextChannel;
      if (!add) {
        if (!this.messages[message]) return;
        this.messages[message]--;
        console.log(this.messages[message]);
        let starboardMessage = starboardChannel.messages.cache.get(
          this.starBinds[message],
        ) as discord.Message;
        if (!starboardMessage)
          starboardMessage = (await starboardChannel.messages.fetch(
            this.starBinds[message],
          )) as discord.Message;
        const newContent = starboardMessage.content.replace(
          /⭐ \d+/,
          `⭐ ${this.messages[message]}`,
        );
        await starboardMessage.edit(newContent);
        return;
      }
      if (!this.messages[message]) this.messages[message] = 0;
      this.messages[message]++;
      if (this.messages[message] === 1) {
        // Don't look at it. {{{
        let fromChannel = this.guild.channels.cache.get(channel) as discord.TextChannel;
        if (!fromChannel)
          fromChannel = (await this.client.channels.fetch(channel)) as discord.TextChannel;
        let starredMessage = fromChannel.messages.cache.get(message) as discord.Message;
        if (!starredMessage)
          starredMessage = (await fromChannel.messages.fetch(message)) as discord.Message;
        // }}}

        const starboardMessage = await starboardChannel.send(
          `⭐ ${this.messages[message]}: ${starredMessage.content}`,
        );
        this.starBinds[starredMessage.id] = starboardMessage.id;
        this.toSaveData();
      }
      if (this.messages[message] >= 2) {
        let starboardMessage = starboardChannel.messages.cache.get(
          this.starBinds[message],
        ) as discord.Message;
        if (!starboardMessage)
          starboardMessage = (await starboardChannel.messages.fetch(
            this.starBinds[message],
          )) as discord.Message;

        const newContent = starboardMessage.content.replace(
          /⭐ \d+/,
          `⭐ ${this.messages[message]}`,
        );
        await starboardMessage.edit(newContent);
      }
    }
  }

  public toSaveData(): StarboardData {
    return Object.assign(super.toSaveData(), {
      guild: this.guild.id,
      messages: this.messages,
      starBinds: this.starBinds,
    });
  }

  public onKill(transferOwnership: boolean): void {
    super.onKill(transferOwnership);
    this.client.removeListener('ccbotMessageReactionAdd', this.handleReactionAdd);
  }

  // Don't mind this. The reaction handlers call this and we have to make sure
  // there are no errors due to some missing reference or something.
  public emoteReactionTouched(emote: discord.Emoji, user: discord.User, add: boolean): void {
    super.emoteReactionTouched(emote, user, add);
  }
}

export default async function load(c: CCBot, data: StarboardData): Promise<CCBotEntity> {
  console.log('Starting starboard entity with:', data);
  const guild = c.guilds.cache.get(data.guild);
  if (!guild) throw new Error(`unable to find the guild ${data.guild}`);
  console.log('provided guild found:', guild.id);
  return new StarboardEntity(c, guild, data);
}
