'use strict';

const path = require('path');
const url = require('url');
const fs = require('fs');

const TEMPLATE_ERROR = 0;
const TEMPLATE_NOT_FOUND = 1;

class TemplateError extends Error {
    constructor(...args) {
        super(...args);
        this.code = TEMPLATE_ERROR;
        this.presentable = 'template error';
        const [{ code }] = args;

        if (code === 'ENOENT') {
            this.code = TEMPLATE_NOT_FOUND;
            this.presentable = 'template not found';
        }
    }
}

/**
 * Read the file from File System
 *
 * @param {string} path
 */
const readFile = (path) =>
    new Promise((resolve, reject) => {
        fs.readFile(path, 'utf-8', (err, data) => {
            if (err) {
                reject(new TemplateError(err));
                return;
            }
            resolve(data);
        });
    });

/**
 * Returns the template path validating a exactly file or a directory
 *
 * @param  {String} templatesPath - TemplatesPath config
 * @param  {String} pathname - Path name based on Request Object
 *
 * @return {Promise} Template Path on success or TemplateError on fail
 */
const getTemplatePath = (templatesPath, pathname) =>
    new Promise((resolve, reject) => {
        fs.lstat(
            templatesPath,
            (err, data) => {
                if (err) {
                    return reject(new TemplateError(err));
                }

                if (data.isFile()) {
                    return resolve(templatesPath);
                }
                return resolve(factoryFilePath(templatesPath, pathname));
            }
        );
    });

/**
 * Returns pathname by request
 *
 * @param  {Object} request - Request Object
 *
 * @return {String} pathname
 */
const getPathName = (request) => url.parse(request.url, true).pathname;

/**
 * Factory the complete file path
 *
 * @param  {String} templatesPath - Templates dir path
 * @param  {String} filename - file name without extension
 *
 * @return {String} complete file path
 */
const factoryFilePath = (templatesPath, filename) =>
    `${path.join(templatesPath, filename)}.html`;

/**
 * Fetches the template from File System
 *
 * @param {string} templatesPath - The path where the templates are stored
 * @param {function=} baseTemplateFn - Function that returns the Base template name for a given page
 */
module.exports = (templatesPath, baseTemplateFn) =>
    (request, parseTemplate) => {
        const pathname = getPathName(request);

        return getTemplatePath(templatesPath, pathname)
            .then((templatePath) => readFile(templatePath))
            .then((baseTemplate) => {
                if (typeof baseTemplateFn !== 'function') {
                    return parseTemplate(baseTemplate);
                }

                const templateName = baseTemplateFn(pathname);
                if (!templateName) {
                    return parseTemplate(baseTemplate);
                }

                const pageTemplate = baseTemplate;
                const baseTemplatePath = factoryFilePath(templatesPath, templateName);
                return readFile(baseTemplatePath)
                    .then((baseTemplate) => parseTemplate(baseTemplate, pageTemplate));
            });
    };

module.exports.TEMPLATE_ERROR = TEMPLATE_ERROR;
module.exports.TEMPLATE_NOT_FOUND = TEMPLATE_NOT_FOUND;
