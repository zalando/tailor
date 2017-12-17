'use strict';

const LinkHeader = require('http-link-header');

const getCrossOrigin = (url = '', host) => {
    if (host && url.indexOf(`://${host}`) < 0) {
        return 'crossorigin';
    }
    return '';
};

const getPreloadAttributes = ({
    assetUrl,
    host,
    asAttribute,
    corsCheck = false,
    noPush = true // Disable HTTP/2 Push behaviour for now
}) => {
    return (
        assetUrl &&
        `<${assetUrl}>; rel="preload"; as="${asAttribute}"; ${noPush
            ? 'nopush;'
            : ''} ${corsCheck ? getCrossOrigin(assetUrl, host) : ''}`.trim()
    );
};

// Module loader script used by tailor for managing dependency between fragments
const getLoaderScript = (amdLoaderUrl, { host } = {}) => {
    if (amdLoaderUrl.startsWith('file://')) {
        return '';
    }

    return getPreloadAttributes({
        assetUrl: amdLoaderUrl,
        asAttribute: 'script',
        corsCheck: true,
        host
    });
};

// Early preloading of primary fragments assets to improve Performance
const getFragmentAssetsToPreload = ({ link = '' }, { host } = {}) => {
    let assetsToPreload = [];

    const { refs = [] } = LinkHeader.parse(link);
    const scriptRefs = refs
        .filter(ref => ref.rel === 'fragment-script')
        .map(ref => ref.uri);
    const styleRefs = refs
        .filter(ref => ref.rel === 'stylesheet')
        .map(ref => ref.uri);

    // Handle Server rendered fragments without depending on assets
    if (!scriptRefs[0] && !styleRefs[0]) {
        return assetsToPreload;
    }

    for (const uri of styleRefs) {
        assetsToPreload.push(
            getPreloadAttributes({
                assetUrl: uri,
                asAttribute: 'style'
            })
        );
    }

    for (const uri of scriptRefs) {
        assetsToPreload.push(
            getPreloadAttributes({
                assetUrl: uri,
                asAttribute: 'script',
                corsCheck: true,
                host
            })
        );
    }

    return assetsToPreload;
};

const nextIndexGenerator = (initialIndex, step) => {
    let index = initialIndex;

    return () => {
        let pastIndex = index;
        index += step;
        return pastIndex;
    };
};

module.exports = {
    getCrossOrigin,
    getFragmentAssetsToPreload,
    getLoaderScript,
    nextIndexGenerator
};
