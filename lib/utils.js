'use strict';

const getCrossOrigin = (url = '', host = '') => {
    if (url.includes(`://${host}`)) {
        return '';
    }
    return 'crossorigin';
};

const getPreloadAttributes = ({
    assetUrl,
    host,
    asAttribute,
    corsCheck = false,
    noPush = true // Disable HTTP/2 Push behaviour until digest spec is implemented by most browsers
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
const getFragmentAssetsToPreload = (styleRefs, scriptRefs, { host } = {}) => {
    let assetsToPreload = [];

    // Handle Server rendered fragments without depending on assets
    if (scriptRefs.length === 0 && styleRefs.length === 0) {
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
