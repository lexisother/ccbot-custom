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
import * as commando from 'discord.js-commando'
import {CCBot, CCBotEntity} from '../ccbot';
import {EntityData} from '../entity-registry';

export interface UserDatablockEntityData extends EntityData {
    who: string;
    content: string;
}

// 30 days
const userDatablockTTL = 30 * (24 * 60 * 60 * 1000);
// This should leave a few extra characters in the embed window for show-user-settings.
const userDatablockMaxLength = 2000;

/// Dumb storage with a deathclock on it.
export class UserDatablockEntity extends CCBotEntity {
    public who: string;
    public content: string;

    public constructor(c: CCBot, data: UserDatablockEntityData) {
        // Reset timeouts if we change TTL, but try to stagger resulting deathclocks over a 16-second period.
        if (data.killTimeout !== userDatablockTTL) {
            data.killTime = Date.now() + userDatablockTTL + ((data.createTime || 0) % 16000);
            data.killTimeout = userDatablockTTL;
        }
        super(c, `user-datablock-${data.who}`, data);
        this.who = data.who;
        this.content = data.content;
    }

    public get(): Record<string, unknown> {
        this.postponeDeathAndUpdate();
        return JSON.parse(this.content);
    }
    public set(updated: Record<string, unknown>): void {
        const res = JSON.stringify(updated, null, '\t');
        if (res.length > userDatablockMaxLength)
            throw new Error(`User Datablock cannot be above ${userDatablockMaxLength} characters.`);
        this.content = res;
        this.postponeDeathAndUpdate();
    }

    public toSaveData(): UserDatablockEntityData {
        return Object.assign(super.toSaveData(), {
            who: this.who,
            content: this.content
        });
    }
}

export async function loadUserDatablock(c: CCBot, data: UserDatablockEntityData): Promise<CCBotEntity> {
    return new UserDatablockEntity(c, data);
}

export async function getUserDatablock(c: CCBot, user: commando.CommandoUser | string): Promise<UserDatablockEntity> {
    if (user instanceof discord.User)
        user = user.id;
    const entity = c.entities.getEntity<UserDatablockEntity>(`user-datablock-${user}`);
    if (entity) {
        return entity;
    } else {
        const res = new UserDatablockEntity(c, {
            type: 'user-datablock',
            who: user,
            content: '{}'
        });
        c.entities.newEntitySync(res);
        return res;
    }
}

export async function userAwareGetEmote(c: CCBot, user: commando.CommandoUser | string | null, guild: commando.CommandoGuild | null, name: string): Promise<discord.Emoji | commando.CommandoGuildEmoji | null> {
    if (user) {
        const datablock = await getUserDatablock(c, user);
        const res = datablock.get()[`emote-${name}`];
        if (res)
            return c.emoteRegistry.getEmote(null, String(res));
    }
    return c.emoteRegistry.getEmote(guild, name);
}
