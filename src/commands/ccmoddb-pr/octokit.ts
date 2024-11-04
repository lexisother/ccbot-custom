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

import {Octokit} from '@octokit/rest';

let octokit: Octokit | undefined;
let owner: string;
let repo: string;

export function isInited(): boolean {
    return Boolean(octokit);
}

export function initOctokit(token: string, owner1: string, repo1: string): void {
    octokit = new Octokit({auth: token});
    owner = owner1;
    repo = repo1;
}

export async function getBranchList(): Promise<string[]> {
    const res = await octokit!.repos.listBranches({owner, repo});
    return res.data.map(branch => branch.name);
}

export async function createBranch(baseBranch: string, newBranch: string): Promise<void> {
    try {
        const {data: baseBranchData} = await octokit!.request('GET /repos/{owner}/{repo}/git/refs/heads/{branch}', {
            owner,
            repo,
            branch: baseBranch,
        });
        const baseBranchSha = baseBranchData.object.sha;

        await octokit!.request('POST /repos/{owner}/{repo}/git/refs', {
            owner,
            repo,
            ref: `refs/heads/${newBranch}`,
            sha: baseBranchSha,
        });
    } catch (error) {
        console.error(`Error creating branch: ${typeof error == 'object' && error && 'message' in error ? error.message : error}`);
        throw error;
    }
}

export async function fetchFile(branch: string, filePath: string): Promise<string> {
    try {
        const {
            data: {content},
        } = (await octokit!.repos.getContent({
            owner,
            repo,
            path: filePath,
            ref: branch,
        })) as {data: {content: string}};
        return Buffer.from(content, 'base64').toString();
    } catch (error) {
        console.error(`Error fetching branch: ${typeof error == 'object' && error && 'message' in error ? error.message : error}`);
        throw error;
    }
}

export async function commitFile(branch: string, filePath: string, content: string, message: string): Promise<void> {
    const {
        data: {sha},
    } = (await octokit!.repos.getContent({owner, repo, path: filePath, ref: branch})) as {data: {sha: string}};

    const newContent = Buffer.from(content).toString('base64');
    await octokit!.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: filePath,
        message,
        content: newContent,
        sha,
        branch,
    });
}

export async function createPullRequest(baseBranch: string, newBranch: string, title: string, body: string): Promise<string | undefined> {
    try {
        const res = await octokit!.request('POST /repos/{owner}/{repo}/pulls', {
            owner,
            repo,
            title,
            body,
            head: newBranch,
            base: baseBranch,
        });
        const url: string = res.data._links.html.href;
        return url;
    } catch (error) {
        console.error(`Error creating pull request: ${typeof error == 'object' && error && 'message' in error ? error.message : error}`);
        throw error;
    }
}
