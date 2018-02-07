const assert = require('assert');
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    try {
        // Forcing to wait till there are no networking events
        await page.goto('http://localhost:8080/index', {
            waitUntil: 'networkidle0'
        });
        // Capture all the fragment related metrics
        const metrics = await page.evaluate(() => {
            // Serializing the outputs otherwise it will be undefined
            return [
                JSON.stringify(performance.getEntriesByType('mark')),
                JSON.stringify(performance.getEntriesByType('measure'))
            ];
        });
        const [mark, measure] = [
            JSON.parse(metrics[0]),
            JSON.parse(metrics[1])
        ];
        await analyseHooks(mark, measure);
        await browser.close();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();

function get(entries, name, key) {
    return entries.filter(entry => entry.name === name).map(entry => entry[key]);
}

async function analyseHooks(mark, measure) {
    /** 
     * Performance Marks
     * 3 - fragment starts
     * 3 - fragment end scripts
     */
    assert.equal(mark.length, 6, 'No of mark entries must be 6');
    
    /**
     * Start time of header marking should happen first than other fragments
     * since header is loaded first
     * 
     * Footer script is delayed by 500ms so it will always be the last to execute
     */
    const headerStart = get(mark, 'header', 'startTime');
    const productStart = get(mark, 'product', 'startTime');
    const footerStart = get(mark, 'footer', 'startTime');
    const productEnd = get(mark, 'productend', 'startTime');
    const footerEnd = get(mark, 'footerend', 'startTime');

    assert(headerStart < productStart, 'header must start before product')
    assert(headerStart < footerStart, 'header must start before footer')
    assert(footerEnd > productEnd, 'footer must be the last to execute')

    /** 
     * Performance Measures
     * 3 - timing groups - abovethefold, belowthefold, interactive
     * 1 - all done 
     * 3 - fragment-header, footer, product - when fragment scripts are executed
     */
    assert.equal(measure.length, 7, 'No of mark entries must be 7');

    /**
     * All done should be the last one to happen
     */
    
    const aboveTheFold = get(measure, 'abovethefold', 'duration');
    const interactive = get(measure, 'interactive', 'duration');
    const belowTheFold = get(measure, 'belowthefold', 'duration');
    const header = get(measure, 'fragment-header', 'duration');
    const product = get(measure, 'fragment-product', 'duration');
    const footer = get(measure, 'fragment-footer', 'duration');

    /**
     * Below the fold duration must be greater than abovethefold and interactive
     */

    assert(belowTheFold > aboveTheFold && belowTheFold > interactive, 
        'below the fold > above the fold and interactive')
    /**
     * All done should be the last one to happen
     */
    const allDone = get(measure, 'all-done', 'duration');

    assert(allDone > belowTheFold, 
        'all done is the last one to happen')

    console.log('Hurray! Metrics tests passed');
}
