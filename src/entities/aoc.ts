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

import * as discord from "discord.js";
import { CCBot, CCBotEntity } from "../ccbot";
import { formatTable, getJSON } from "../utils";
import { WatcherEntity, WatcherEntityData } from "../watchers";

interface AOCViewerEntityData extends WatcherEntityData {
  endpoint: string;
  cookie: string;
  channelId: string;
}

interface Leaderboard {
  members: Record<
    string,
    {
      id: number;
      name: string;
      stars: number;
      global_score: number;
      local_score: number;
      last_star_ts: number;
    }
  >;
}

/// The base 'retrieve a JSON file of type T periodically' type.
abstract class AOCViewerEntity<T> extends WatcherEntity {
  public endpoint: string;
  public cookie: string;
  public channelId: string;

  public constructor(c: CCBot, id: string, data: AOCViewerEntityData) {
    super(c, id, data);
    this.endpoint = data.endpoint;
    this.cookie = data.cookie;
    this.channelId = data.channelId;
  }

  public async watcherTick(): Promise<void> {
    this.parseEndpointResponse(
      await getJSON<T>(`${this.endpoint}.json`, {
        cookie: `session=${this.cookie}`,
        "User-Agent":
          "Keeper Discord Bot (https://github.com/lexisother/ccbot-custom/blob/master/src/entities/aoc.ts)",
        Accept: "application/json",
      })
    );
  }

  public abstract parseEndpointResponse(data: T): void;

  public toSaveData(): WatcherEntityData {
    return Object.assign(super.toSaveData(), {
      refreshMs: this.refreshMs,
      endpoint: this.endpoint,
      cookie: this.cookie,
      channelId: this.channelId,
    });
  }
}

/// Acts as the source for plugin list information.
// Functionality wise, 95% of it was taken from here:
// <https://codeberg.org/Ven/bot/src/commit/e29d10e70de664ccd5f47d9e2140c15bc4762aa0/src/aoc.ts>
export class AOCLeaderboardEntity extends AOCViewerEntity<Leaderboard> {
  public leaderboard: Leaderboard;

  public constructor(c: CCBot, data: AOCViewerEntityData) {
    super(c, "aoc-viewer", data);
    this.leaderboard = { members: {} }; // dummy to satisfy type
  }

  public parseEndpointResponse(data: Leaderboard): void {
    this.leaderboard = data;
    this.postMessage();
  }

  public onKill(transferOwnership: boolean): void {
    super.onKill(transferOwnership);
  }

  public async postMessage(): Promise<void> {
    let boardChannel = this.client.channels.cache.get(
      this.channelId
    ) as discord.TextChannel;
    if (!boardChannel)
      boardChannel = (await this.client.channels.fetch(
        this.channelId
      )) as discord.TextChannel;

    let content = this.makeLeaderboardContent();
    let messages = await boardChannel.messages.fetch();
    let msg = messages.entries().next().value;
    if (msg) {
      if (msg.content !== content) await msg[1].edit({ content });
    } else await boardChannel.send({ content });
  }

  private makeLeaderboardContent(): string {
    const leaderboard = Object.values(this.leaderboard.members).sort(
      (a, b) =>
        b.stars - a.stars ||
        b.local_score - a.local_score ||
        b.global_score - a.global_score
    );

    const [lastStarTs, lastStarUser] = leaderboard.reduce<[number, string]>(
      ([lastTs, lastUser], u) => [
        Math.max(lastTs, u.last_star_ts),
        u.last_star_ts > lastTs ? u.name : lastUser,
      ],
      [0, "Noone"]
    );

    const digits = Math.floor(Math.log10(leaderboard[0].stars) + 1);

    const rows = leaderboard.map((u, i) => [
      `${i + 1}`,
      `${u.stars.toString().padStart(digits, " ")}⭐`,
      u.name || "Anonymous",
      `(${u.local_score} points)`,
    ]);

    return (
      `
**<:leaCheese:1085339191833022536> Advent of Code Leaderboard <:leaCheese:1085339191833022536>**

Leaderboard: ${this.endpoint}
Last Submission: <t:${lastStarTs}> by ${lastStarUser}

` +
      `\`\`\`\n${formatTable(rows)}\`\`\`` + // thanks prettier
      `\nLast Updated: <t:${Math.floor(Date.now() / 1000)}>`
    );
  }
}

export default async function load(
  c: CCBot,
  data: AOCViewerEntityData
): Promise<CCBotEntity> {
  return new AOCLeaderboardEntity(c, data);
}
