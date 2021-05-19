const { Listr } = require('listr2');

const { PrivateKey } = require('@dashevo/dashcore-lib');
const { NETWORK_LOCAL } = require('../../constants');

/**
 *
 * @param {DockerCompose} dockerCompose
 * @param {waitForCorePeersConnected} waitForCorePeersConnected
 * @param {waitForMasternodesSync} waitForMasternodesSync
 * @param {createRpcClient} createRpcClient
 * @param {Docker} docker
 * @param {startNodeTask} startNodeTask
 * @param {waitForNodeToBeReadyTask} waitForNodeToBeReadyTask
 * @return {startGroupNodesTask}
 */
function startGroupNodesTaskFactory(
  dockerCompose,
  waitForCorePeersConnected,
  waitForMasternodesSync,
  createRpcClient,
  docker,
  startNodeTask,
  waitForNodeToBeReadyTask,
) {
  /**
   * @typedef {startGroupNodesTask}
   * @param {Config[]} configGroup
   * @return {Object}
   */
  function startGroupNodesTask(configGroup) {
    const minerConfig = configGroup.find((config) => (
      config.get('core.miner.enable')
    ));

    return new Listr([
      {
        title: 'Starting nodes',
        task: async () => {
          const tasks = configGroup.map((config) => ({
            title: `Starting ${config.getName()} node`,
            task: () => startNodeTask(config),
          }));

          return new Listr(tasks, { concurrent: true });
        },
      },
      {
        title: 'Wait for Core peers to be connected',
        enabled: () => minerConfig && minerConfig.get('network') === NETWORK_LOCAL,
        task: () => {
          const tasks = configGroup.map((config) => ({
            title: `Checking ${config.getName()} peers`,
            task: async () => {
              const rpcClient = createRpcClient({
                port: config.get('core.rpc.port'),
                user: config.get('core.rpc.user'),
                pass: config.get('core.rpc.password'),
              });

              await waitForCorePeersConnected(rpcClient);
            },
          }));

          return new Listr(tasks, { concurrent: true });
        },
      },
      {
        title: 'Adjust Core mock time',
        enabled: () => minerConfig && minerConfig.get('network') === NETWORK_LOCAL,
        task: async () => {
          const minerInterval = minerConfig.get('core.miner.interval');
          const secondsToAdd = 150;

          const tasks = configGroup.map((config) => ({
            title: `Adjust ${config.getName()} mock time`,
            task: async () => {
              /* eslint-disable no-useless-escape */
              await dockerCompose.execCommand(
                config.toEnvs(),
                'core',
                [
                  'bash',
                  '-c',
                  `
              while true
              do
                response=\$(dash-cli getblockchaininfo)
                mediantime=\$(echo \${response} | grep -o -E '\"mediantime\"\: [0-9]+' |  cut -d ' ' -f2)
                mocktime=\$((mediantime + ${secondsToAdd}))
                dash-cli setmocktime \$mocktime
                sleep ${minerInterval}
              done
              `,
                ],
                ['--detach'],
              );
              /* eslint-enable no-useless-escape */
            },
          }));

          return new Listr(tasks, { concurrent: true });
        },
      },
      {
        title: 'Start a miner',
        enabled: () => minerConfig && minerConfig.get('network') === NETWORK_LOCAL,
        task: async () => {
          let minerAddress = minerConfig.get('core.miner.address');

          if (minerAddress === null) {
            const privateKey = new PrivateKey();
            minerAddress = privateKey.toAddress('regtest').toString();

            minerConfig.set('core.miner.address', minerAddress);
          }

          const minerInterval = minerConfig.get('core.miner.interval');

          await dockerCompose.execCommand(
            minerConfig.toEnvs(),
            'core',
            [
              'bash',
              '-c',
              `while true; do dash-cli generatetoaddress 1 ${minerAddress}; sleep ${minerInterval}; done`,
            ],
            ['--detach'],
          );
        },
      },
      {
        title: 'Wait for nodes to be ready',
        enabled: (ctx) => Boolean(ctx.waitForReadiness),
        task: () => {
          const tasks = configGroup
            .filter((config) => config.has('platform'))
            .map((config) => ({
              title: `Wait for ${config.getName()} node`,
              task: () => waitForNodeToBeReadyTask(config),
            }));

          return new Listr(tasks, { concurrent: true });
        },
      },
    ]);
  }

  return startGroupNodesTask;
}

module.exports = startGroupNodesTaskFactory;