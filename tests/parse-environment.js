'use strict';
const assert = require('assert');
const parseEnvironmentVariables = require('../lib/parse-environment');

describe('Parse Environment', () => {
    it('should return the same url when no brackets found', () => {
        const fragmentUrl = 'https://test.zalando.de/#/blub/12';
        assert.strictEqual(
            parseEnvironmentVariables(fragmentUrl),
            fragmentUrl,
            'The url is not the same anymore'
        );
    });

    it('should return the same url when only one bracket is found', () => {
        let fragmentUrl = 'https://{test.zalando.de/#/blub/12';
        assert.strictEqual(
            parseEnvironmentVariables(fragmentUrl),
            fragmentUrl,
            'The url is not the same anymore'
        );

        fragmentUrl = 'https://test.zalando.de}/#/blub/12';
        assert.strictEqual(
            parseEnvironmentVariables(fragmentUrl),
            fragmentUrl,
            'The url is not the same anymore'
        );
    });

    it('should return the same url when no environment variable is found', () => {
        const envVarName = `TEST__ROOT_HOST_${+new Date()}`;
        const fragmentUrl = `https://{${envVarName}}/#/blub/12`;
        delete process.env[envVarName];
        assert.strictEqual(
            parseEnvironmentVariables(fragmentUrl),
            fragmentUrl,
            'The url is not the same anymore'
        );
    });

    it('should return the modified url when everything is given', () => {
        const envVarName = `TEST__ROOT_HOST_${+new Date()}`;
        const envVarValue = 'test.zalando.de';
        const fragmentUrl = `https://{${envVarName}}/#/blub/12`;
        process.env[envVarName] = envVarValue;
        assert.strictEqual(
            parseEnvironmentVariables(fragmentUrl),
            fragmentUrl.replace(`{${envVarName}}`, envVarValue),
            'The url is the same'
        );
        delete process.env[envVarName];
    });
});
