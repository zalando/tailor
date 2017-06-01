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
    maxAssetLinks: 2,
    fetchTemplate: fetchTemplate(templatesPath, baseTemplateFn)
});
const assert = require('assert');
const asserters = wd.asserters;

const PLATFORMS = [{
    browserName: 'internet explorer',
    version: '10.0'
},{
    browserName: 'chrome'
}];

describe('Frontend test', function () {

    this.timeout(100000);

    let server, fragment1, fragment2, fragment3;

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
        fragment3 = http.createServer(fragment('body-start', 'http://localhost:8083'));
        return Promise.all([
            server.listen(8080),
            fragment1.listen(8081),
            fragment2.listen(8082),
            fragment3.listen(8083)
        ]);
    });

    after(() => {
        return Promise.all([
            server.close(),
            fragment1.close(),
            fragment2.close(),
            fragment3.close()
        ]);
    });

    PLATFORMS.forEach((platform) => {
        it('should open the page and initialise three fragments, each requiring two scripts in ' + platform.browserName, () => {
            return testOnPlatform(platform, (browser) => {
                return browser
                    .get('http://localhost:8080/index')
                    .title()
                    .then((title) => {
                        assert.equal(title, 'Test Page', 'Test page is not loaded');
                    })
                    .waitForElementByCss('.fragment-hello-js1', asserters.textInclude('js1'), 2000)
                    .waitForElementByCss('.fragment-hello-js2', asserters.textInclude('js2'), 2000)
                    .waitForElementByCss('.fragment-world-js1', asserters.textInclude('js1'), 2000)
                    .waitForElementByCss('.fragment-world-js2', asserters.textInclude('js2'), 2000)
                    .waitForElementByCss('.fragment-body-start-js1', asserters.textInclude('js1'), 2000)
                    .waitForElementByCss('.fragment-body-start-js2', asserters.textInclude('js2'), 2000);

            });
        });
    });

});
