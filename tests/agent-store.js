'use strict';
const { parse } = require('url');
const Agent = require('agentkeepalive');
const assert = require('assert');
const agentStore = require('../lib/agent-store');

describe('Agent Store', () => {
    it('should get https agent by default', () => {
        const agent = agentStore.getAgent();
        assert(agent instanceof Agent.HttpsAgent);
    });

    it('shoulg get http agent for http endpoints', () => {
        const { protocol } = parse('http://test.com');
        const agent = agentStore.getAgent(protocol);
        assert(agent instanceof Agent);
    });
});
