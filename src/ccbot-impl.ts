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

import * as commando from 'discord.js-commando';
import CCBotCommandRegistry from './command-registry';
import CCBotCommandDispatcher from './command-dispatcher';
import CCBotSettingProvider from './setting-provider';
import {CCBot} from './ccbot';
import registerAllCommands from './all-commands';
import registerAllEntities from './all-entities';

/// This separate class prevents a dependency loop that would otherwise occur.
/// Theoretically, it's just type definitions, but unfortunately the imports still happen.
/// Only the constructor should be here - the rest is API for the commands and so should be in CCBot.
export default class CCBotImpl extends CCBot {
    public constructor(co: commando.CommandoClientOptions) {
        super(co);
        this.registry = new CCBotCommandRegistry(this);
        this.dispatcher = new CCBotCommandDispatcher(this, this.registry);
        registerAllCommands(this);
        registerAllEntities(this);
        this.setProvider(new CCBotSettingProvider(this.dynamicData.settings));
    }
}
