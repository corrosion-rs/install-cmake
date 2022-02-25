import * as fs from 'fs';
import * as process from 'process';
import * as path from 'path';
import * as io from '@actions/io';
import { cmake } from '../src/cmake';
import { spawnSync as spawn } from 'child_process';

const tempDirectory = path.join(__dirname, 'temp-get-cmake');

jest.setTimeout(30 * 1000);

describe.each([['3.12.4'], ['3.19.8'], ['3.20.0'], ['3.22.2']])(
    `get-cmake %s`,
    cmake_version => {
        beforeEach(async () => {
            await io.rmRF(tempDirectory);
            await io.mkdirP(tempDirectory);
            Object.keys(process.env)
                .filter(key => key.match(/^INPUT_/))
                .forEach(key => {
                    delete process.env[key];
                });
            const gh_path = path.join(tempDirectory, 'gh-path');
            fs.writeFileSync(gh_path, '');
            process.env.GITHUB_PATH = gh_path;
            process.env.GITHUB_WORKSPACE = tempDirectory;
            process.env.INPUT_CMAKE = cmake_version;
            process.env.RUNNER_TEMP = path.join(tempDirectory, 'temp');
            process.env.RUNNER_TOOL_CACHE = path.join(
                tempDirectory,
                'tempToolCache'
            );
        });

        afterAll(async () => {
            try {
                await io.rmRF(tempDirectory);
            } catch {
                console.log('Failed to remove test directories');
            }
        }, 100000);

        it(`should download CMake ${cmake_version}`, async () => {
            const cmakePath = await cmake();
            expect(cmakePath).toBeDefined();
            expect(cmakePath).not.toHaveLength(0);

            const { status, error } = spawn(cmakePath, ['--version'], {
                encoding: 'utf8'
            });
            expect(error).toBeUndefined();
            expect(status).toBe(0);
        });
    }
);
