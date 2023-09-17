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

import {safeParseInt} from '../utils';

const vmMaxTime = 1024;
const vmEvalTime = 8;
const vmMaxAnythingLength = 2048;

export interface Value {
    constructor: Function; // eslint-disable-line @typescript-eslint/ban-types
}

export const trueValue = 'true';
export const falseValue = '';

export function asBoolean(v: Value): boolean {
    // Value[] is truthy
    // Empty string is not truthy
    return Boolean(v);
}

export function asString(v: Value): string {
    if (typeof v === 'string')
        return v;
    throw new Error(`Value of kind ${v.constructor} not convertible to string`);
}

export function asInteger(v: Value): number {
    return safeParseInt(asString(v));
}

export function asList(v: Value): Value[] {
    if (Array.isArray(v))
        return v;
    throw new Error(`Value of kind ${v.constructor} not convertible to list`);
}

export type VMFunction = (arg: Value[], scope: VMScope) => Promise<Value>;

export function wrapFunc(name: string, argCount: number, fun: (args: Value[], scope: VMScope) => Promise<Value>): VMFunction {
    return async (args: Value[], scope: VMScope): Promise<Value> => {
        if (argCount != -1)
            if ((argCount + 1) != args.length)
                throw new Error(`Incorrect form for function ${name}`);
        const resArgs: Value[] = [];
        for (let i = 1; i < args.length; i++)
            resArgs.push(await scope.vm.run(args[i], scope));
        return fun(resArgs, scope);
    };
}

/// Scoping. Not actually used but kept in for safety purposes...
export class VMScope {
    public readonly vm: VM;
    public readonly parent: VMScope | null;
    public readonly functions = new Map<string, VMFunction>();

    public constructor(vm: VM, parent: VMScope | null) {
        this.vm = vm;
        this.parent = parent;
    }
    public extend(): VMScope {
        return new VMScope(this.vm, this);
    }
    public getFunction(name: string): VMFunction | null {
        const fun = this.functions.get(name);
        if (fun)
            return fun;
        if (this.parent)
            return this.parent.getFunction(name);
        return null;
    }
    public addFunction(name: string, value: VMFunction, local: boolean): void {
        if (this.parent && (!local) && (!this.functions.has(name))) {
            this.parent.addFunction(name, value, local);
        } else {
            this.functions.set(name, value);
        }
    }
}

/// Creates the VM for the formatted parts.
/// The VM is essentially LISPy, but keep in mind:
/// The only valid types are strings and lists.
///
/// WARNING! The VM handles arbitrary input from any user.
/// If it didn't, there'd be no point having this layer in the first place.
/// Don't trust it with too much information, don't let it do unbounded-time operations, try to make costly operations costly.
export class VM {
    public time = 0;
    // The input to this is the *amount of consumeTime calls*,
    //  so there is no possible way for a glitch to "grant" time on this clock
    public backupTime = 0;
    public globalScope: VMScope;

    public constructor() {
        this.time = 0;
        this.globalScope = new VMScope(this, null);
    }

    public install(prims: Record<string, VMFunction>): void {
        for (const k in prims)
            this.globalScope.addFunction(k, prims[k], false);
    }

    public consumeTime(time: number): void {
        this.time += time;
        this.backupTime++;
        if (this.time > vmMaxTime)
            throw new Error('Time consumed puts VM over-budget, cancelling operation');
        if (this.backupTime > vmMaxTime)
            throw new Error('I don\'t know what you did but the backup timer didn\'t like it. REPORT THIS IMMEDIATELY');
    }

    public async run(arg: Value, scope: VMScope): Promise<Value> {
        this.consumeTime(vmEvalTime);

        // arg.length == 0 is also known as "nil"
        if (Array.isArray(arg)) {
            const args = arg;
            if (args.length != 0) {
                if (typeof args[0] === 'string') {
                    const fname = args[0];
                    const fun = scope.getFunction(fname);
                    if (!fun)
                        throw new Error(`No such function ${fname}`);
                    const res = await fun(args, scope);
                    if (res.toString().length > vmMaxAnythingLength)
                        throw new Error('Returned value above max size');
                    return res;
                } else if (Array.isArray(args[0])) {
                    // NON-LISP rule: As function names have to be constant strings,
                    //  a list of statements is now possible.
                    // The way this works is that if the first arg is an *array*,
                    //  then all args including first are statements
                    let lastResult: Value = falseValue;
                    for (const stmt of args)
                        lastResult = await this.run(stmt, scope);
                    return lastResult;
                }
            }
        }
        return arg;
    }
}

export async function runFormatInternal(text: string, runner: (a: Value) => Promise<string>): Promise<string> {
    let workspace = '';
    let escapeMode = false;
    let stringMode = false;
    let emoteMode: string | null = null;
    let urlMode = false;
    // Note: Index 0 here is the innermost (currently-appending-to) list.
    const listStack: Value[][] = [];
    // Unique reference for unescaped '
    const mySecretQuoteObject: Value[] = [];
    let listCurrentToken = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const whitespace = (ch == ' ') || (ch == '\r') || (ch == '\n') || (ch == '\t');
        if (escapeMode) {
            if (listStack.length > 0) {
                listCurrentToken += ch;
            } else if (emoteMode != null) {
                emoteMode += ch;
            } else if (ch == '(') {
                listStack.unshift([]);
            } else {
                workspace += ch;
            }
            escapeMode = false;
        } else if ((ch == '%') && !urlMode) {
            escapeMode = true;
        } else if (emoteMode != null) {
            if (ch == '/') {
                if (emoteMode == '') {
                    workspace += '//';
                    urlMode = true;
                } else {
                    // Done!
                    workspace += await runner(['emote', emoteMode]);
                }
                emoteMode = null;
            } else {
                emoteMode += ch;
            }
        } else if (listStack.length > 0) {
            if (stringMode) {
                // Inside a string
                if (ch == '"') {
                    listStack[0].push(listCurrentToken);
                    listCurrentToken = '';
                    stringMode = false;
                } else {
                    listCurrentToken += ch;
                }
            } else if (whitespace || (ch == '\'') || (ch == '(') || (ch == ')') || (ch == '"')) {
                // 'Breaking' characters
                if (listCurrentToken.length > 0)
                    listStack[0].push(listCurrentToken);
                listCurrentToken = '';
                // 'Break/Place/Break' characters
                if (ch == '(') {
                    listStack.unshift([]);
                } else if (ch == ')') {
                    // Post-process the list that's being worked on to apply quotes.
                    const list = listStack.shift() as Value[];
                    for (let i = 0; i < list.length; i++) {
                        if (list[i] === mySecretQuoteObject) {
                            list.splice(i, 1);
                            list[i] = ['\'', list[i]];
                            i--;
                        }
                    }
                    if (listStack.length == 0) {
                        workspace += await runner(list);
                    } else {
                        listStack[0].push(list);
                    }
                } else if (ch == '\'') {
                    listStack[0].push(mySecretQuoteObject);
                } else if (ch == '"') {
                    stringMode = true;
                }
                // By default characters act as whitespace since they don't get appended
            } else {
                // Normal characters
                listCurrentToken += ch;
            }
        } else if ((ch == '/') && !urlMode) {
            // Entering emote mode
            emoteMode = '';
        } else {
            if (ch == ' ')
                urlMode = false;
            workspace += ch;
        }
    }
    if (emoteMode != null)
        throw new Error(`Unterminated Emote (state: ${emoteMode})`);
    if (escapeMode)
        throw new Error('Unterminated Escape');
    if (stringMode)
        throw new Error('Unterminated String');
    if (listStack.length)
        throw new Error('Unterminated Invocation');
    // URL mode doesn't go here, it's not a formal body, just a "keep away from this" mechanism
    return workspace;
}

/// See the "public" formatter.ts for more details.
export async function runFormat(text: string, runner: VM): Promise<string> {
    const res = await runFormatInternal(text, async (v: Value): Promise<string> => {
        return (await runner.run(v, runner.globalScope)).toString();
    });
    // return res + '\n' + runner.time + 'TU';
    return res;
}
