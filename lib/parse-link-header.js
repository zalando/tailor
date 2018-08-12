'use strict';
/**
 * Parse link headers
 * '<http://example.com/script.js>; rel="fragment-script"'
 *
 * [
 *   {
 *     rel: "fragment-script",
 *     uri: "http://localhost:8080/script.js"
 *   }
 * ]
 *
 * Based on code from parse-link-header!
 * https://github.com/thlorenz/parse-link-header/blob/master/index.js
 */
module.exports = function parseLinkHeader(linkHeader) {
    const assets = linkHeader
        .split(/,\s*</)
        .map(link => {
            const match = link.match(/<?([^>]*)>(.*)/);
            if (!match) {
                return null;
            }
            const linkUrl = match[1];
            const parts = match[2].split(';');
            parts.shift();
            return {
                uri: linkUrl,
                rel: getRelValue(parts[0])
            };
        })
        .filter(v => v && v.rel != null)
        .reduce((acc, curr) => {
            return acc.concat(curr);
        }, []);

    return assets;
};

/**
 * Get the value of rel attribute
 *
 * rel="fragment-script" -> ["rel", "fragment-script"]
 */
function getRelValue(parts) {
    const m = parts.match(/\s*(.+)\s*=\s*"?([^"]+)"?/);
    if (!m) {
        return null;
    }
    return m[2];
}
