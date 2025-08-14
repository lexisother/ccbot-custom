import * as discord from "discord.js";
import { CCBot, CCBotEntity } from "../ccbot";
import { diffArrays, getJSON } from "../utils";
import { WatcherEntity, WatcherEntityData } from "../watchers";
import {
  APIGalacticWarEffect,
  ApiType,
  def_effect_types,
  def_effect_value_types,
} from "../data/hd2";

interface HD2TrackerEntityData extends WatcherEntityData {
  channelId: discord.Snowflake;
  baseUrl: string;
  apiType: ApiType;

  effects?: APIGalacticWarEffect[];
}

class HD2TrackerEntity extends WatcherEntity {
  public channel: discord.TextBasedChannel;
  public baseUrl: string;
  public apiType: ApiType;
  public effects: APIGalacticWarEffect[];

  public constructor(
    c: CCBot,
    id: string,
    channel: discord.TextBasedChannel,
    data: HD2TrackerEntityData
  ) {
    super(c, `hd2-tracker-${id}`, data);

    this.channel = channel;
    this.baseUrl = data.baseUrl.endsWith("/")
      ? data.baseUrl.slice(0, -1)
      : data.baseUrl;
    this.apiType = data.apiType;

    this.effects = data.effects ?? [];
  }

  public async watcherTick(): Promise<void> {
    const urls = this.apiUrls();
    for (const type of Object.keys(urls)) {
      const res = await getJSON<APIGalacticWarEffect[]>(urls[type], {
        "User-Agent":
          "Keeper Discord Bot (https://github.com/lexisother/ccbot-custom/blob/master/src/entities/hd2.ts)",
      });

      switch (type) {
        case "effects":
          this.handleEffects(res);
          break;
      }
    }
  }

  public toSaveData(): HD2TrackerEntityData {
    return Object.assign(super.toSaveData(), {
      refreshMs: this.refreshMs,
      channelId: this.channel.id,
      baseUrl: this.baseUrl,
      apiType: this.apiType,

      effects: this.effects,
    });
  }

  private handleEffects(fetchedEffects: APIGalacticWarEffect[]): void {
    const oldEffects = this.effects;
    if (oldEffects.length === 0) {
      this.effects = fetchedEffects;
      return;
    }

    const diff = diffArrays<APIGalacticWarEffect>(oldEffects, fetchedEffects);

    for (const addition of diff.additions) {
      const embed = this.constructEffectEmbed("added", addition);
      this.channel.send({ embeds: [embed] });
    }

    for (const removal of diff.removals) {
      const embed = this.constructEffectEmbed("removed", removal);
      this.channel.send({ embeds: [embed] });
    }

    for (const change of diff.changes) {
      const embed = this.constructEffectEmbed("changed", change.before);
      for (const key of Object.keys(change.before)) {
        if (
          JSON.stringify(change.before[key]) !==
          JSON.stringify(change.after[key])
        ) {
          embed.addFields({
            name: key,
            value: `\`${change.before[key]}\` → \`${change.after[key]}\``,
            inline: true,
          });
        }
      }
      this.channel.send({ embeds: [embed] });
    }

    this.effects = fetchedEffects;
  }

  private constructEffectEmbed(
    type: "added" | "changed" | "removed",
    effect: APIGalacticWarEffect
  ): discord.EmbedBuilder {
    const values = [];
    for (let i = 0; i < 2; i++) {
      const [type, value] = [effect.valueTypes[i], effect.values[i]];
      values.push(
        `Type \`${def_effect_value_types[type] ?? `UNK`}\` (${type}): ${value}`
      );
    }

    return new discord.EmbedBuilder()
      .setAuthor({ name: `Galactic War Effect ${type} on ${this.apiType}` })
      .setTitle(
        `${effect.id} \`${def_effect_types[effect.effectType] ?? 'UNK'} ${
          effect.effectType
        }\``
      )
      .addFields([
        {
          name: "`nameHash`",
          value: `\`${effect.nameHash}\``,
          inline: true
        },
        {
          name: "`gameplayEffectId32`",
          value: `\`${effect.gameplayEffectId32}\``,
          inline: true
        },
        ...values.map((v, i) => ({
          name: `Value ${i + 1}`,
          value: v,
        })),
      ])
      .setColor(
        type === "added"
          ? "#2DB610"
          : type === "changed"
          ? "#E0A313"
          : "#E01D13"
      );
  }

  private apiUrls(): Record<string, string> {
    return {
      effects: `${this.baseUrl}/api/WarSeason/GalacticWarEffects`,
    };
  }
}

export default async function load(
  c: CCBot,
  data: HD2TrackerEntityData
): Promise<CCBotEntity> {
  const channel = c.channels.cache.get(data.channelId);
  if (!channel) throw new Error(`unable to find the channel ${data.channelId}`);
  if (!channel.isTextBased())
    throw new Error(`channel ${data.channelId} is not a text channel`);
  return new HD2TrackerEntity(
    c,
    `${data.apiType}-${data.channelId}`,
    channel,
    data
  );
}
