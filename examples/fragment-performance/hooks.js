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
    return entries
        .filter(entry => entry.name === name)
        .map(entry => entry[key])[0];
}

async function analyseHooks(mark, measure) {
    /**
     * Performance Marks
     * 6 incluging start and end for fragments to capture the fragment timeline
     *  -> Header - 2
     *  -> Product - 2
     *  -> Product - 2
     * Mark start and Mark end is captured for each fragment script
     * No of script tags * (1 for mark start + 1 for mark end)
     *
     * Header - 1 script -> 0 Not required since there is only one script
     * Product - 2 script -> 4
     * Footer - 3 scripts -> 6
     *
     */
    assert.equal(mark.length, 16, 'No of mark entries must be 16');

    /**
     * Start time of header marking should happen first than other fragments
     * since header is loaded first
     *
     * Footer script is delayed by 200ms so it will always be the last to execute
     */
    const headerStart = get(mark, 'header', 'startTime');
    const productStart = get(mark, 'product', 'startTime');
    const footerStart = get(mark, 'footer', 'startTime');
    const productEnd = get(mark, 'productend', 'startTime');
    const footerEnd = get(mark, 'footerend', 'startTime');

    assert(
        headerStart < productStart && headerStart < footerStart,
        'header must start before product & footer'
    );
    assert(footerEnd > productEnd, 'footer must be the last to execute');

    /**
     * Header contains only 1 script tag
     * We should not have any marks for headers script tags
     *
     * 0 -> denoted script 1
     */

    const headerS1Mark = get(mark, 'header0', 'startTime');
    assert.equal(headerS1Mark, undefined, 'Header s1 mark should be undefined');

    /**
     * Footer has 3 scripts
     * script 1 - network delay by 500ms
     * script 2 - no network delay, returns promise that delays rendering by 200ms
     * script 3 - no network delay and sync
     *
     * Script 2 will start executing first and resume
     * Script 3 would kick in and finish before script 2 since it is delayed by 200ms
     * script 1 will download after 500ms and will execute at last
     *
     * 6, 7, 8 - denotes footer script 1,2,3
     */

    const footerS1Mark = get(mark, 'footer6', 'startTime');
    const footerS2Mark = get(mark, 'footer7', 'startTime');
    const footerS3Mark = get(mark, 'footer8', 'startTime');
    const footerS2MarkEnd = get(mark, 'footer7end', 'startTime');
    const footerS3MarkEnd = get(mark, 'footer8end', 'startTime');

    assert(
        footerS1Mark > footerS2Mark && footerS1Mark > footerS2Mark,
        'footer script 1 would be the last one to start'
    );
    assert(
        footerS2Mark < footerS3Mark && footerS2MarkEnd > footerS3MarkEnd,
        'footer script 2 would start first and exeute after s3'
    );

    /**
     * Performance Measures
     * 3 - timing groups - abovethefold, belowthefold, interactive
     * 1 - all done
     * 1- primary fragemnt done
     * 3 including all the fragments
     *  -> Header - 1
     *  -> Footer - 1
     *  -> Product - 1
     * 2 scripts tags in Product fragment, measurements are made for each script tag
     * to calculate the execution time
     *
     * 3 script tags in Footer fragment
     */
    assert.equal(measure.length, 13, 'No of measure entries must be 13');

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
     * Execution time must account for lazy rendering
     * Footer script 2 was delayed by 200 ms
     */
    const footerS2Measure = get(measure, 'fragment-footer2', 'duration');

    assert(
        footerS2Measure > 200,
        'footer script 2 exec time must be greater than 200ms'
    );

    /**
     * Footer fragment measure timeline should account for all script tags execution
     * time as well as network time of other 2 scripts
     */
    const footerS1Measure = get(measure, 'fragment-footer1', 'duration');
    const footerS3Measure = get(measure, 'fragment-footer3', 'duration');
    assert(
        footer > footerS1Measure + footerS2Measure + footerS3Measure,
        'footer timeline must account for all script tags'
    );

    // Same goes for product as well
    const productS1Measure = get(measure, 'fragment-product1', 'duration');
    assert(
        productS1Measure > 200,
        'product script 2 exec time must be greater than 200ms'
    );

    const productS2Measure = get(measure, 'fragment-product2', 'duration');
    assert(
        product > productS1Measure + productS2Measure,
        'product timeline must account for all script tags'
    );

    /**
     * Below the fold duration must be greater than abovethefold and interactive
     */

    assert(
        belowTheFold > aboveTheFold && belowTheFold > interactive,
        'below the fold > above the fold and interactive'
    );
    /**
     * All done should be the last one to happen
     */
    const allDone = get(measure, 'all-done', 'duration');

    assert(allDone > belowTheFold, 'all done is the last one to happen');

    console.log('Hurray! Metrics tests passed');
}
