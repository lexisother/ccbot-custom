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

import { ActivityType } from 'discord.js';
import {CCBot, CCBotEntity} from '../ccbot';
import {randomArrayElement, silence} from '../utils';
import {WatcherEntity, WatcherEntityData} from '../watchers';

type ActivityStatus = ('online' | 'idle' | 'dnd' | 'invisible');

export interface Activity {
    status?: ActivityStatus;
    type: Exclude<ActivityType, ActivityType.Custom>;
    name: string;
}

export interface RandomActivityData extends WatcherEntityData {
    activities: Activity[];
}

class RandomActivityEntity extends WatcherEntity {
    public readonly activities: Activity[];

    public constructor(c: CCBot, data: RandomActivityData) {
        super(c, 'activity-manager', data);
        this.activities = data.activities;
    }

    public onKill(transferOwnership: boolean): void {
        if (!transferOwnership)
            this.client.user?.setPresence({
                status: 'online'
            });
    }

    public async watcherTick(): Promise<void> {
        const element = randomArrayElement(this.activities);
        this.client.user?.setPresence({
            status: element.status || 'online',
            activities: [{
                type: element.type,
                name: element.name
            }]
        });
    }

    public toSaveData(): RandomActivityData {
        return Object.assign(super.toSaveData(), {
            activities: this.activities
        });
    }
}

export default async function load(c: CCBot, data: RandomActivityData): Promise<CCBotEntity> {
    return new RandomActivityEntity(c, data);
}
