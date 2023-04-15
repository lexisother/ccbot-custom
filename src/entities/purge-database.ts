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
import {EntityData} from '../entity-registry';

export interface PurgeDatabaseEntityData extends EntityData {
    timeMs: number;
}

export interface PurgeDatabaseChannelEntityData extends EntityData {
    channel: string;
    messages: string[];
}

/// Stores the IDs of sent messages.
/// Dumb storage; won't be updated by itself
export class PurgeDatabaseChannelEntity extends CCBotEntity {
    public channelID: string;
    public messages: string[];

    public constructor(c: CCBot, data: PurgeDatabaseChannelEntityData) {
        super(c, `purge-channel-${data.channel}`, data);
        this.channelID = data.channel;
        this.messages = data.messages;
    }

    public toSaveData(): PurgeDatabaseChannelEntityData {
        return Object.assign(super.toSaveData(), {
            channel: this.channelID,
            messages: this.messages
        });
    }
}

/// Maintains the PurgeDatabaseChannelEntity instances.
export class PurgeDatabaseEntity extends CCBotEntity {
    public timeMs: number;
    private messageCallback: (msg: discord.Message) => void;

    public constructor(c: CCBot, data: PurgeDatabaseEntityData) {
        super(c, 'purge-database-manager', data);
        this.timeMs = data.timeMs;
        // Clean out older entries every minute
        const loopCallback = (): void => {
            if (this.killed)
                return;
            const deleteBefore = Date.now() - this.timeMs;
            for (const entity of this.client.entities.entities.values()) {
                if (entity instanceof PurgeDatabaseChannelEntity) {
                    const array = entity.messages;
                    let changed = false;
                    while ((array.length > 0) && (discord.SnowflakeUtil.deconstruct(array[0]).timestamp < deleteBefore)) {
                        array.shift();
                        changed = true;
                    }
                    if (array.length == 0) {
                        entity.kill(false);
                    } else if (changed) {
                        entity.updated();
                    }
                }
            }
            setTimeout(loopCallback, 60000);
        };
        loopCallback();
        this.messageCallback = (message: discord.Message): void => {
            if (message.author == this.client.user) {
                const entity = this.client.entities.getEntity<PurgeDatabaseChannelEntity>(`purge-channel-${message.channel.id}`);
                if (!entity) {
                    const data: PurgeDatabaseChannelEntityData = {
                        type: 'purge-database-channel',
                        channel: message.channel.id,
                        messages: [message.id]
                    };
                    this.client.entities.newEntitySync(new PurgeDatabaseChannelEntity(this.client, data));
                } else {
                    entity.messages.push(message.id);
                    entity.updated();
                }
            }
        };
        this.client.on('messageCreate', this.messageCallback);
    }

    public onKill(transferOwnership: boolean): void {
        super.onKill(transferOwnership);
        this.client.removeListener('messageCreate', this.messageCallback);
    }

    public toSaveData(): PurgeDatabaseEntityData {
        return Object.assign(super.toSaveData(), {
            timeMs: this.timeMs
        });
    }
}

export async function loadPurgeDatabase(c: CCBot, data: PurgeDatabaseEntityData): Promise<CCBotEntity> {
    return new PurgeDatabaseEntity(c, data);
}

export async function loadPurgeDatabaseChannel(c: CCBot, data: PurgeDatabaseChannelEntityData): Promise<CCBotEntity> {
    return new PurgeDatabaseChannelEntity(c, data);
}
