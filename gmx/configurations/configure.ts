import { getNetworkConfigurations } from "./configurations/configurations";
import { Deploy } from "./configurations/deploy";

// Select the deployment protocol and network
let deployment = Deploy.GMX_AVALANCHE;

export const NetworkConfigs = getNetworkConfigurations(deployment);