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
import {CCBot, CCBotEntity} from '../ccbot';
import {TextBasedChannel, isChannelTextBased, silence} from '../utils';
import {StreamProviderEntity, WatcherEntity, WatcherEntityData} from '../watchers';

// All the kinds of stream provider we care about
const streamProviders: string[] = ['twitch', 'youtube'];

export interface StreamWatcherData extends WatcherEntityData {
    // Channel ID.
    channel: string;
    // Message ID (not present if it must be created)
    message?: string;
}

/// Watches the streams go by.
class StreamWatcherEntity extends WatcherEntity {
    private channel: TextBasedChannel;
    private message: discord.Message;

    public constructor(c: CCBot, channel: TextBasedChannel, message: discord.Message, data: StreamWatcherData) {
        super(c, `message-${message.id}`, data, 10000);
        this.channel = channel;
        this.message = message;
    }

    public async watcherTick(): Promise<void> {
        const streams: Array<{ name: string; value: string; }> = [];
        const guild = this.channel instanceof discord.GuildChannel ? this.channel.guild : undefined;
        for (const providerType of streamProviders) {
            const provider = this.client.entities.getEntity<StreamProviderEntity>(`stream-provider-${providerType}`);
            if (provider) {
                if (provider.lastError !== null)
                    streams.push({
                        name: `<error from ${provider.id}>`,
                        value: provider.lastErrorString()
                    });
                for (const stream of provider.streams) {
                    let langTag = '';
                    if (stream.language)
                        langTag = `(${stream.language.toUpperCase()})`;

                    let titleTag = '';
                    if (stream.title)
                        titleTag = `: ${stream.title}`;

                    const streamLongTail: string[] = [stream.url];
                    if (stream.started)
                        streamLongTail.push(`Started at ${stream.started}.`);
                    if (guild) {
                        const foundMember = guild.members.cache.find((member: discord.GuildMember): boolean => {
                            if (member.user.username.toLowerCase() === stream.userName.toLowerCase())
                                return true;
                            return false;
                        });
                        if (foundMember)
                            streamLongTail.push(`Possibly here as ${foundMember.nickname}`);
                    }
                    streams.push({
                        name: `${stream.userName} ${langTag} on ${stream.service}${titleTag}`,
                        value: streamLongTail.join('\n')
                    });
                }
            }
        }
        await this.message.edit({
            embeds: [{
                title: 'CrossCode Streams',
                fields: streams,
                timestamp: Date.now().toString()
            }]
        });
    }

    public toSaveData(): StreamWatcherData {
        return Object.assign(super.toSaveData(), {
            channel: this.channel.id,
            message: this.message.id
        });
    }

    public onKill(transferOwnership: boolean): void {
        super.onKill(transferOwnership);
        if (!transferOwnership)
            silence(this.message.delete());
    }
}

/// Creates a stream watcher.
export default async function load(c: CCBot, data: StreamWatcherData): Promise<CCBotEntity> {
    const channel = c.channels.cache.get(data.channel);
    if (!channel || !isChannelTextBased(channel))
        throw Error('involved channel no longer exists');
    let message: discord.Message;
    if (!data.message) {
        // New
        message = await channel.send('Did you know that it takes at least one second for a stream watcher to initialize?') as discord.Message;
    } else {
        // Reused
        message = await channel.messages.fetch(data.message);
    }
    return new StreamWatcherEntity(c, channel, message, data);
}
