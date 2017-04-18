'use strict';

const loadtest = require('loadtest');
const options = {
    url: 'http://localhost:8080',
    maxRequests: 5000,
    concurrency: 100
};

loadtest.loadTest(options, (error, result) => {
    console.log('LoadTest Metrics', JSON.stringify(result, null, 2));
});
