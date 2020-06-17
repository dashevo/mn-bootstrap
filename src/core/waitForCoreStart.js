const wait = require('../util/wait');

/**
 * Wait for Core to start
 *
 * @typedef {waitForCoreStart}
 * @param {CoreService} coreService
 * @return {Promise<void>}
 */
async function waitForCoreStart(coreService) {
  let retires = 0;
  let isReady = false;
  const maxRetries = 1200; // ~2 minutes

  do {
    try {
      // just any random request
      await coreService.getRpcClient().ping();

      isReady = true;
    } catch (e) {
      console.log(e);
      // just wait 1 second before next try
      await wait(1000);
      ++retires;
    }
  } while (!isReady && retires < maxRetries);

  if (!isReady) {
    throw new Error('Could not connect to Dash core RPC');
  }
}

module.exports = waitForCoreStart;
