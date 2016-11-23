'use strict';

const SAUCE_USERNAME = process.env.SAUCE_USERNAME;
const SAUCE_ACCESS_KEY = process.env.SAUCE_ACCESS_KEY;
const TUNNEL_ID = process.env.TRAVIS_JOB_NUMBER;
const wd = require('wd');
const http = require('http');
const path = require('path');
const Tailor = require('../../index');
const fetchTemplate = require('../../lib/fetch-template');
const templatesPath = path.join(__dirname, 'templates');
const baseTemplateFn = () => 'base-template';
const fragment = require('./fragment');
const tailor = new Tailor({
    fetchTemplate: fetchTemplate(templatesPath, baseTemplateFn)
});
const assert = require('assert');
const asserters = wd.asserters;

const PLATFORMS = [
    {
        browserName: 'internet explorer',
        platform: 'Windows XP',
        version: '8.0'
    },
    {
        browserName: 'chrome'
    }
];


describe('Frontend test', function () {

    this.timeout(100000);

    let server;
    let fragment1;
    let fragment2;

    function testOnPlatform (platform, callback) {
        const browser = wd.promiseChainRemote(
            'ondemand.saucelabs.com',
            80,
            SAUCE_USERNAME,
            SAUCE_ACCESS_KEY
        );
        return callback(
            browser.init(Object.assign({
                'tunnel-identifier': TUNNEL_ID
            }, platform))
        )
            .then(() => browser.quit())
            .then(
                () => browser.sauceJobStatus(true),
                () => browser.sauceJobStatus(false)
            );
    }

    before(() => {
        server = http.createServer(tailor.requestHandler);
        fragment1 = http.createServer(fragment('hello', 'http://localhost:8081'));
        fragment2 = http.createServer(fragment('world', 'http://localhost:8082'));
        return Promise.all([
            new Promise((resolve) => server.listen(8080, () => resolve())),
            new Promise((resolve) => fragment1.listen(8081, () => resolve())),
            new Promise((resolve) => fragment2.listen(8082, () => resolve()))
        ]);
    });

    after(() => {
        return Promise.all([
            new Promise((resolve) => server.close(() => resolve())),
            new Promise((resolve) => fragment1.close(() => resolve())),
            new Promise((resolve) => fragment2.close(() => resolve()))
        ]);
    });

    PLATFORMS.forEach((platform) => {
        it('should open the page and initialise two fragments in ' + platform.browserName, () => {
            return testOnPlatform(platform, (browser) => {
                return browser
                    .get('http://localhost:8080/index')
                    .title()
                    .then((title) => {
                        assert.equal(title, 'Test Page', 'Test page is not loaded');
                    })
                    .waitForElementByCss('.fragment-hello-initialised', asserters.textInclude('initialised'), 2000)
                    .waitForElementByCss('.fragment-world-initialised', asserters.textInclude('initialised'), 2000);
            });
        });
    });

});
