// Copyright (C) 2019-2024 CCDirectLink members
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
import {CCBot, CCBotCommand} from '../../ccbot';

import * as prettier from 'prettier/standalone';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import * as prettierPluginEstree from 'prettier/plugins/estree';

import * as octokitUtil from './octokit';
import {InputLocations} from 'ccmoddb/build/src/types';

async function prettierJson(obj: object): Promise<string> {
    return await prettier.format(JSON.stringify(obj), {
        parser: 'json',
        plugins: [prettierPluginBabel, prettierPluginEstree],
        tabWidth: 4,
        printWidth: 170,
        bracketSameLine: true,
    });
}

async function checkUrlFileType(url: string): Promise<string | undefined> {
    try {
        const response = await fetch(url, {method: 'HEAD'});
        const contentType = response.headers.get('content-type');
        return contentType?.split(';')[0];
    } catch (_) {}
    return undefined;
}

function addOrUpdateUrl(inputs: InputLocations, url: string, source: string): {status: 'pushed' | 'changed' | 'sameUrl'; index: number} {
    const obj = {url, source};
    const repoUrl = url.split('/').slice(0, 5).join('/');

    if (url.startsWith('https://github.com/CCDirectLink/CCLoader')) {
        // example url:
        // https://github.com/CCDirectLink/CCLoader/archive/refs/tags/v2.25.0/v2.14.2.zip

        let versionSubStr = url.substring('https://github.com/CCDirectLink/CCLoader/archive/refs/tags/v'.length); // 2.25.0/v2.14.2.zip
        versionSubStr = versionSubStr.substring(0, versionSubStr.length - '.zip'.length); // 2.25.0/v2.14.2
        const [cclV, simpV] = versionSubStr.split('/'); // example: cclV: "2.25.0" simpV: "v2.14.2"

        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            if (input.url.startsWith(repoUrl) && (!input.type || input.type == 'zip')) {
                input.url = obj.url;

                for (const key of ['source', 'ccmodPath'] as const) {
                    const val = input[key];
                    if (!val) continue;
                    const restI = val.indexOf('/');
                    input[key] = `CCLoader-${cclV}-${simpV}${val.substring(restI == -1 ? 10e10 : restI)}`;
                }
                // this must be true
            }
        }
        return {index: 0, status: 'changed'};
    }

    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        if (input.url.startsWith(repoUrl)) {
            const status = input.url == obj.url ? 'sameUrl' : 'changed';
            obj.source = source || obj.source;
            inputs[i] = obj;

            return {status, index: i};
        }
    }
    return {index: inputs.push(obj), status: 'pushed'};
}

const stableBranch = 'stable';
const testingBranch = 'testing';
const botBranchPrefix = 'ccbot/';
const inputLocationsPath = 'input-locations.json';
const inputLocationsOldPath = 'input-locations.old.json';

async function createPr(url: string, author: string, branch: string, source: string): Promise<string> {
    if (!url.startsWith('https://github.com/') || !(url.endsWith('.zip') || url.endsWith('.ccmod'))) {
        return 'Invalid url :(';
    }
    const fileType = await checkUrlFileType(url);
    const okFileTypes = new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream' /* <- ccmod */]);
    if (!fileType || !okFileTypes.has(fileType)) {
        return 'Invalid url :(';
    }

    try {
        const branches: string[] = (await octokitUtil.getBranchList()).filter(name => name.startsWith(botBranchPrefix));
        const branchIds: number[] = branches.map(name => name.substring(botBranchPrefix.length)).map(Number);
        const maxBranchId: number = branchIds.reduce((acc, v) => (v > acc ? v : acc), -1);
        const newBranchName = `${botBranchPrefix}${maxBranchId + 1}`;

        await octokitUtil.createBranch(branch, newBranchName);
        const inputLocationsStr = await octokitUtil.fetchFile(branch, inputLocationsPath);
        const inputLocationsJson: InputLocations = JSON.parse(inputLocationsStr);

        const {status, index} = addOrUpdateUrl(inputLocationsJson, url, source);

        let toCommit: {path: string; json: InputLocations};
        if (status == 'pushed' || status == 'changed') {
            toCommit = {path: inputLocationsPath, json: inputLocationsJson};
        } else {
            /* if nothing was changed in input-locations.json (aka the supplied url was already in input-locations.json)
             * then change the entry in input-locations.old.json just slightly so that the database actually updates */

            /* input-locations.old.json has the same contents as input-locations.json at this moment */
            const inputLocationsOldJson: InputLocations = JSON.parse(inputLocationsStr);
            inputLocationsOldJson[index].url = url.substring(0, url.length - 1);

            toCommit = {path: inputLocationsOldPath, json: inputLocationsOldJson};
        }

        const rawJson = await prettierJson(toCommit.json);
        await octokitUtil.commitFile(newBranchName, toCommit.path, rawJson, `CCBot ${branch}: ${newBranchName}`);

        const prUrl = await octokitUtil.createPullRequest(branch, newBranchName, `CCBot ${branch}: ${newBranchName}`, `Submitted by: <br>${author}`);
        return `PR submitted!\n${prUrl}`;
    } catch (err) {
        return err as string;
    }
}

export default class ModsPrCommand extends CCBotCommand {
    public constructor(
        client: CCBot,
        public publishChannelId: string[] | undefined
    ) {
        const opt: commando.CommandInfo = {
            name: 'publish-mod',
            description: 'Publish or update a mod to CCModDB, a central mod repository.',
            group: 'general',
            memberName: 'publish-mod',
            args: [
                {
                    key: 'url',
                    prompt: 'Mod .zip or .ccmod GitHub link',
                    type: 'string',
                },
                {
                    key: 'branch',
                    prompt: 'Target branch. Either "stable" or "testing". Use "testing" if you want to publish this mod as a pre-release.',
                    type: 'string',
                    default: 'stable',
                },
                {
                    key: 'source',
                    prompt: 'The relative path to the directory containing the `ccmod.json` file.',
                    type: 'string',
                    default: '',
                },
            ],
        };
        super(client, opt);

        this.publishChannelId = publishChannelId;
    }

    public async run(message: commando.CommandoMessage, args: {url: string; branch: string; source: string}): Promise<commando.CommandoMessageResponse> {
        if (this.publishChannelId && !this.publishChannelId.includes(message.channel.id)) {
            return await message.say(`This command is only allowed in ${this.publishChannelId?.map(id => `<#${id}>`).join(', ')}`);
        }
        if (!octokitUtil.isInited()) return await message.say('Not configured to be used here!');

        if (args.branch != stableBranch && args.branch != testingBranch) {
            return message.say('Invalid branch!', {});
        }

        const text = await createPr(args.url, message.author.tag, args.branch, args.source);
        const msg = await message.say(text, {});
        for (const m of Array.isArray(msg) ? msg : [msg]) {
            m?.suppressEmbeds();
        }
        return msg;
    }
}
