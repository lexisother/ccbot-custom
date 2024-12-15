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

import type * as discord from "discord.js";
import type { CCBot, CCBotEntity } from "../ccbot";
import { formatTable, getJSON } from "../utils";
import { WatcherEntity, type WatcherEntityData } from "../watchers";

interface AOCViewerEntityData extends WatcherEntityData {
  endpoint: string;
  cookie: string;
  channelId: string;
  threadChannelId: string;
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
      completion_day_level: {
        [date: string]: {
          [star: string]: {
            get_star_ts: number;
            star_index: number;
          };
        };
      };
    }
  >;
}

/// The base 'retrieve a JSON file of type T periodically' type.
abstract class AOCViewerEntity<T> extends WatcherEntity {
  public endpoint: string;
  public cookie: string;
  public channelId: string;
  public threadChannelId: string;

  public constructor(c: CCBot, id: string, data: AOCViewerEntityData) {
    super(c, id, data);
    this.endpoint = data.endpoint;
    this.cookie = data.cookie;
    this.channelId = data.channelId;
    this.threadChannelId = data.threadChannelId;
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
      threadChannelId: this.threadChannelId,
    });
  }
}

// Functionality wise, 95% of it was taken from here:
// <https://codeberg.org/Ven/bot/src/commit/e29d10e70de664ccd5f47d9e2140c15bc4762aa0/src/aoc.ts>
export class AOCLeaderboardEntity extends AOCViewerEntity<Leaderboard> {
  public static THREAD_NAME_REGEX = /Discussion Thread Day (\d+)/;

  public leaderboard: Leaderboard;

  public constructor(c: CCBot, data: AOCViewerEntityData) {
    super(c, "aoc-viewer", data);
    this.leaderboard = { members: {} }; // dummy to satisfy type
  }

  public parseEndpointResponse(data: Leaderboard): void {
    this.leaderboard = data;
    this.postMessage();
    this.reconcileThreadAccess();
  }

  public onKill(transferOwnership: boolean): void {
    super.onKill(transferOwnership);
  }

  public async reconcileThreadAccess(): Promise<void> {
    let threadChannel = this.client.channels.cache.get(
      this.threadChannelId
    ) as discord.TextChannel;
    if (!threadChannel)
      threadChannel = (await this.client.channels.fetch(
        this.threadChannelId
      )) as discord.TextChannel;

    // Fetch all active and inactive threads
    let activeThreads = (await threadChannel.threads.fetchActive()).threads;
    let inactiveThreads = (
      await threadChannel.threads.fetchArchived({
        type: "private",
        fetchAll: true,
      })
    ).threads;
    let threads = [...activeThreads, ...inactiveThreads];

    // Sort threads by day number
    const collator = new Intl.Collator("en");
    threads = threads.sort((a, b) => {
      return collator.compare(a[1].name, b[1].name);
    });

    // Construct a list of days with the AOC ids that have completed it
    const completions: Record<string, string[]> = {};
    for (const [id, user] of Object.entries(this.leaderboard.members)) {
      for (let [day, dayData] of Object.entries(user.completion_day_level)) {
        day = day.padStart(2, "0");

        const completed = dayData["2"] !== undefined;
        if (!completed) continue;

        completions[day] ??= [];
        completions[day].push(id);
      }
    }

    // Go over each thread and check if all users are a member, if not, add them
    for (const [, thread] of threads) {
      const members = await thread.members.fetch();
      const day = this.getThreadDayNumber(thread);
      if (completions[day] === undefined) continue;

      for (const id of completions[day]) {
        let discordId = this.aocToDiscord(id);
        if (!discordId) continue;

        const user = await this.client.users.fetch(discordId);
        if (!members.has(user.id)) {
          this.log(`User ${user.username} isn't in this thread, adding`);
          thread.send(`<@${user.id}>`);
        }
      }
    }
  }

  public async postMessage(): Promise<void> {
    let boardChannel = this.client.channels.cache.get(
      this.channelId
    ) as discord.TextChannel;
    if (!boardChannel)
      boardChannel = (await this.client.channels.fetch(
        this.channelId
      )) as discord.TextChannel;

    const content = this.makeLeaderboardContent();
    const messages = await boardChannel.messages.fetch();
    const msg = messages.entries().next().value;
    if (msg) {
      if (msg[1].content !== content) await msg[1].edit({ content });
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

  private aocToDiscord(id: string): string | null {
    const mapping = this.client.dynamicData.aocMapping.data;
    return mapping[id as keyof typeof mapping];
  }

  private getThreadDayNumber(thread: discord.ThreadChannel): string {
    return thread.name.match(AOCLeaderboardEntity.THREAD_NAME_REGEX)![1];
  }
}

export default async function load(
  c: CCBot,
  data: AOCViewerEntityData
): Promise<CCBotEntity> {
  return new AOCLeaderboardEntity(c, data);
}
