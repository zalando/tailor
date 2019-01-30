'use strict';
const Agent = require('agentkeepalive');
const { SOCKET_TTL } = require('./constants');

class AgentStore {
    constructor() {
        const defaultAgentOpts = { socketActiveTTL: SOCKET_TTL };
        this.httpAgent = new Agent(defaultAgentOpts);
        this.httpsAgent = new Agent.HttpsAgent(defaultAgentOpts);
    }

    getAgent(protocol) {
        if (protocol === 'http:') {
            return this.httpAgent;
        }
        return this.httpsAgent;
    }
}

module.exports = new AgentStore();
