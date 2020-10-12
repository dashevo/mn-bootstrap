const fs = require('fs');
const dots = require('dot');

/**
 * @return {renderServiceTemplates}
 */
function renderServiceTemplatesFactory(writeServiceConfigs) {

  /**
   * Render templates for services
   * @typedef {renderServiceTemplates}
   * @param {Config} config
   * @param {String} homeDirPath
   * @returns {Promise<void>}
   */
  async function renderServiceTemplates(config, homeDirPath) {
    const files = fs.readdirSync('./templates');

    dots.templateSettings.strip = false;
    let configFiles = {};
    for (const file of files) {
      const fileContents = fs.readFileSync('./templates/' + file, 'utf-8');
      const fileTemplate = dots.template(fileContents);
      const fileOutput = fileTemplate(config.options);
      configFiles[file] = fileOutput;
    }
    writeServiceConfigs(configFiles, homeDirPath, config.name);
  }

  return renderServiceTemplates;
}

module.exports = renderServiceTemplatesFactory;
