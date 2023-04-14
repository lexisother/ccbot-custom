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
import * as commando from 'discord.js-commando';
import {CCBot, CCBotCommand} from '../ccbot';

/// Inspires you with a quote.
export class InspireCommand extends CCBotCommand {
    public constructor(client: CCBot) {
        const opt = {
            name: 'inspire',
            description: 'inspires you with a quote',
            group: 'general',
            memberName: 'inspire'
        };
        super(client, opt);
    }

    public async run(message: commando.CommandoMessage): Promise<commando.CommandoMessageResponse> {
        if (!this.client.isProviderReady()) return message.say("Something terrible has happened, the settings provider is not initialized.");
        const quotes: string[] = this.client.provider.get('global', 'quotes', []);
        const lastQuote: number = this.client.provider.get('global', 'lastQuote', -1);
        if (quotes.length == 0)
            return message.say('I\'m actually two thirds space alien, one third goat, another two thirds blueberry, and five thirds pure, unintensified hugs.\nAnd I have no quotes for you.');
        if (quotes.length == 1) {
            if (lastQuote != 0)
                await this.client.provider.set('global', 'lastQuote', 0);
            return message.say(`0: ${quotes[0]}`);
        }
        const effectiveLength: number = ((lastQuote >= 0) && (lastQuote < quotes.length)) ? (quotes.length - 1) : quotes.length;
        let target = Math.floor(Math.random() * effectiveLength);
        if (lastQuote >= 0)
            if (target >= lastQuote)
                target++;
        await this.client.provider.set('global', 'lastQuote', target);
        return message.say(`${target}: ${quotes[target]}`);
    }
}

/// Adds a quote.
export class AddQuoteCommand extends CCBotCommand {
    public constructor(client: CCBot) {
        const opt = {
            name: '-util add-quote',
            description: 'adds a quote',
            group: 'util',
            memberName: 'add-quote',
            ownerOnly: true,
            args: [
                {
                    key: 'quote',
                    prompt: 'Text?',
                    type: 'string'
                }
            ]
        };
        super(client, opt);
    }

    public async run(message: commando.CommandoMessage, args: {quote: string}): Promise<commando.CommandoMessageResponse> {
        if (!this.client.isProviderReady()) return message.say("Something terrible has happened, the settings provider is not initialized.");
        const quotes: string[] = this.client.provider.get('global', 'quotes', []);
        const newQuotes: string[] = JSON.parse(JSON.stringify(quotes));
        newQuotes.push(args.quote);
        await this.client.provider.set('global', 'quotes', newQuotes);
        return message.say(`Done, this is quote ${quotes.length}`); // *not* newQuotes, then it'd have to -1
    }
}

/// Removes a quote.
export class RmQuoteCommand extends CCBotCommand {
    public constructor(client: CCBot) {
        const opt = {
            name: '-util rm-quote',
            description: 'removes a quote',
            group: 'util',
            memberName: 'rm-quote',
            ownerOnly: true,
            args: [
                {
                    key: 'quote',
                    prompt: 'ID?',
                    type: 'integer'
                }
            ]
        };
        super(client, opt);
    }

    public async run(message: commando.CommandoMessage, args: {quote: number}): Promise<commando.CommandoMessageResponse> {
        if (!this.client.isProviderReady()) return message.say("Something terrible has happened, the settings provider is not initialized.");
        const quotes: string[] = this.client.provider.get('global', 'quotes', []);
        const newQuotes: string[] = JSON.parse(JSON.stringify(quotes));
        if (args.quote < 0)
            return message.say('Can\'t, Curly Brace would be mad.');
        if (args.quote >= newQuotes.length)
            return message.say('Can\'t, the *other* Curly Brace would be mad.');
        newQuotes.splice(args.quote, 1);
        await this.client.provider.set('global', 'quotes', newQuotes);
        return message.say(`Done, this is quote ${quotes.length}`); // *not* newQuotes, then it'd have to -1
    }
}
