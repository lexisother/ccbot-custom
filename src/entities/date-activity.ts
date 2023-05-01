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
import {WatcherEntity, WatcherEntityData} from '../watchers';

/// Updates a visible date every 10 seconds.
/// Additional fields: None.
class DateActivityEntity extends WatcherEntity {
    public constructor(c: CCBot, data: WatcherEntityData) {
        super(c, 'activity-manager', {
            ...data,
            refreshMs: 10000
        });
    }

    public onKill(transferOwnership: boolean): void {
        if (!transferOwnership)
            this.client.user?.setPresence({
                status: 'online'
            });
    }

    public async watcherTick(): Promise<void> {
        this.client.user?.setPresence({
            status: 'online',
            activities: [{
                type: ActivityType.Watching,
                name: new Date().toString()
            }]
        });
    }
}

export default async function load(c: CCBot, data: WatcherEntityData): Promise<CCBotEntity> {
    return new DateActivityEntity(c, data);
}
