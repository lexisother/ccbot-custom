import * as discord from 'discord.js';
import { CCBot, CCBotEntity } from '../ccbot';
import { EntityData } from '../entity-registry';

export interface StarboardData extends EntityData {
  // Guild ID
  guild: string;
  messages?: Record<discord.Snowflake, number>;
  starBinds?: Record<discord.Snowflake, discord.Snowflake>;
}

class StarboardEntity extends CCBotEntity {
  private guild: discord.Guild;
  private messages: Record<discord.Snowflake, number>;
  private starBinds: Record<discord.Snowflake, discord.Snowflake>;

  public constructor(c: CCBot, g: discord.Guild, data: StarboardData) {
    super(c, `starboard-${g.id}`, data);
    this.guild = g;
    this.messages = data.messages ?? {};
    this.starBinds = data.starBinds ?? {};
    this.client.on('ccbotMessageReactionAdd', this.handleReactionAdd.bind(this));
  }

  public handleReactionAdd(
    emote: discord.Emoji,
    message: discord.Snowflake,
    channel: discord.Snowflake,
    guild: discord.Snowflake,
  ) {
    if (guild !== this.guild.id) return;
    const gChannel = this.client.provider.get(this.guild, 'starboard-channel', 0);
    if (gChannel === 0) return;

    // Ye who tread here, tread with utmost care.
    if (emote.name === '⭐') {
      if (!this.messages[message]) this.messages[message] = 0;
      this.messages[message]++;
      if (this.messages[message] >= 1) {
        let fromChannel = this.guild.channels.cache.get(channel) as discord.TextChannel;
        if (!fromChannel)
          this.client.channels.fetch(channel).then((c) => (fromChannel = c as discord.TextChannel));
        let starredMessage = fromChannel.messages.cache.get(message) as discord.Message;
        if (!starredMessage)
          fromChannel.messages.fetch(message).then((m) => (starredMessage = m as discord.Message));

        let starboardChannel = this.guild.channels.cache.get(gChannel) as discord.TextChannel;
        if (!starboardChannel)
          this.client.channels
            .fetch(gChannel)
            .then((c) => (starboardChannel = c as discord.TextChannel));
        starboardChannel.send(starredMessage.content);
        this.toSaveData();
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
