'use strict';

module.exports = function handleTag ({ headers = {} }, tag) {
    if (tag.name === 'service-worker') {
        return `<script>navigator.serviceWorker.register('./sw.js')
            .then(function (registration) {
                console.log('Static assets are cached');
            })
            .catch(function (e) {
                console.error('Error during service worker registration:', e);
            });
        </script>`;
    }

    return '';
};
