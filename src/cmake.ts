/*
 * This file uses code from <https://github.com/lukka/get-cmake>.
 *
 * Copyright Copyright (c) 2020 Luca Cappa.
 */
import * as tools from '@actions/tool-cache';
import * as core from '@actions/core';
import * as path from 'path';
import * as fs from 'fs';

import { gte } from 'semver';

interface PackageInfo {
    url: string;
    binPath: string;
    extractFunction: {
        (url: string, outputPath: string): Promise<string>;
    };
    dropSuffix: string;
}

/**
 * Compute an unique number given some text.
 * @param {string} text
 * @returns {string}
 */
function hashCode(text: string): string {
    let hash = 42;
    if (text.length != 0) {
        for (let i = 0; i < text.length; i++) {
            const char: number = text.charCodeAt(i);
            hash = ((hash << 5) + hash) ^ char;
        }
    }

    return hash.toString();
}

function getOutputPath(subDir: string): string {
    if (!process.env.RUNNER_TEMP) {
        throw new Error(
            'Environment variable process.env.RUNNER_TEMP must be set, it is used as destination directory of the cache'
        );
    }
    return path.join(process.env.RUNNER_TEMP, subDir);
}

function get_artifact_path_win64(version: string): string {
    const post_3_20 = `https://github.com/Kitware/CMake/releases/download/v${version}/cmake-${version}-windows-x86_64.zip`;
    const pre_3_20 = `https://github.com/Kitware/CMake/releases/download/v${version}/cmake-${version}-win64-x64.zip`;

    if (gte(version, '3.20.0')) {
        return post_3_20;
    } else {
        return pre_3_20;
    }
}

function get_artifact_path_macos(version: string): string {
    const post_3_19_2 = `https://github.com/Kitware/CMake/releases/download/v${version}/cmake-${version}-macos-universal.tar.gz`;
    const pre_3_19_2 = `https://github.com/Kitware/CMake/releases/download/v${version}/cmake-${version}-Darwin-x86_64.tar.gz`;
    if (gte(version, '3.19.2')) {
        return post_3_19_2;
    } else {
        return pre_3_19_2;
    }
}

function get_artifact_path_linux(version: string): string {
    const post_3_20 = `https://github.com/Kitware/CMake/releases/download/v${version}/cmake-${version}-linux-x86_64.tar.gz`;
    const pre_3_20 = `https://github.com/Kitware/CMake/releases/download/v${version}/cmake-${version}-Linux-x86_64.tar.gz`;
    if (gte(version, '3.20.0')) {
        return post_3_20;
    } else {
        return pre_3_20;
    }
}

function getPlatformData(version: string, platform?: string): PackageInfo {
    const platformStr = platform || process.platform;
    switch (platformStr) {
        case 'win':
        case 'win32':
        case 'win64':
            return {
                binPath: 'bin/',
                dropSuffix: '.zip',
                extractFunction: tools.extractZip,
                url: get_artifact_path_win64(version)
            };
        case 'mac':
        case 'darwin':
            return {
                binPath: 'CMake.app/Contents/bin/',
                dropSuffix: '.tar.gz',
                extractFunction: tools.extractTar,
                url: get_artifact_path_macos(version)
            };
        case 'linux':
            return {
                binPath: 'bin/',
                dropSuffix: '.tar.gz',
                extractFunction: tools.extractTar,
                url: get_artifact_path_linux(version)
            };
        default:
            throw new Error(`Unsupported platform '${platformStr}'`);
    }
}

export async function cmake(): Promise<string> {
    const version = core.getInput('cmake', {
        required: true
    });

    const platform = core.getInput('platform');
    const data = getPlatformData(version, platform);

    // Get an unique output directory name from the URL.
    const key: string = hashCode(data.url);
    const cmakePath = getOutputPath(key);

    const { pathname } = new URL(data.url);
    const dirName = path.basename(pathname);
    const outputPath = path.join(
        cmakePath,
        dirName.replace(data.dropSuffix, ''),
        data.binPath
    );

    const cmakeDir = tools.find('cmake', version);
    if (cmakeDir) {
        core.addPath(cmakeDir);
        return path.join(cmakeDir, platform === 'win' ? 'cmake.exe' : 'cmake');
    }

    if (!fs.existsSync(cmakePath)) {
        await core.group('Download and extract CMake', async () => {
            const downloaded = await tools.downloadTool(data.url);
            await data.extractFunction(downloaded, cmakePath);
        });
    }

    try {
        core.startGroup(`Add CMake to PATH`);
        core.addPath(outputPath);
    } finally {
        core.endGroup();
    }

    await tools.cacheDir(cmakePath, 'cmake', version);

    return path.join(outputPath, platform === 'win' ? 'cmake.exe' : 'cmake');
}
