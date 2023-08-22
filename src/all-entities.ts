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

import loadDateActivity from './entities/date-activity';
import loadPageSwitcher from './entities/page-switcher';
import loadOldBehaviors from './entities/old-behaviors';
import loadGreeter from './entities/greeter';
import loadAuditor from './entities/auditor';
import loadReactRoles from './entities/react-roles';
import loadRandomActivity from './entities/random-activity';
import {loadModDatabase, loadToolDatabase} from './entities/mod-database';
import loadStreamWatcher from './entities/stream-watcher';
import {loadPurgeDatabase, loadPurgeDatabaseChannel} from './entities/purge-database';
import {loadUserDatablock} from './entities/user-datablock';
import {newTwitchStreamProviderLoader} from './entities/twitch-stream-provider';
import {newYouTubeStreamProviderLoader} from './entities/youtube-stream-provider';
import loadCountdownActivity from './entities/countdown-activity';
import loadStarboard from './entities/starboard';
import {loadPluginDatabase, loadQuicklinks} from './entities/vd-plugins';
import {CCBot} from './ccbot';

/// Registers all the entities. (More or less.)
export default function registerAllEntities(cr: CCBot, twitchClientId: string | undefined, ytClientId: string | undefined): void {
    cr.entities
        .registerEntityType('date-activity', loadDateActivity)
        .registerEntityType('page-switcher', loadPageSwitcher)
        .registerEntityType('old-behaviors', loadOldBehaviors)
        .registerEntityType('greeter', loadGreeter)
        .registerEntityType('auditor', loadAuditor)
        .registerEntityType('react-roles', loadReactRoles)
        .registerEntityType('random-activity', loadRandomActivity)
        .registerEntityType('mod-database', loadModDatabase)
        .registerEntityType('tool-database', loadToolDatabase)
        .registerEntityType('purge-database', loadPurgeDatabase)
        .registerEntityType('purge-database-channel', loadPurgeDatabaseChannel)
        .registerEntityType('user-datablock', loadUserDatablock)
        .registerEntityType('countdown-activity', loadCountdownActivity)
        .registerEntityType('starboard', loadStarboard)
        .registerEntityType('plugin-database', loadPluginDatabase)
        .registerEntityType('plugin-quicklinks', loadQuicklinks);
    if (twitchClientId)
        cr.entities.registerEntityType('twitch-stream-provider', newTwitchStreamProviderLoader(twitchClientId));
    if (ytClientId)
        cr.entities.registerEntityType('youtube-stream-provider', newYouTubeStreamProviderLoader(ytClientId));
    cr.entities.registerEntityType('stream-watcher', loadStreamWatcher);
}
