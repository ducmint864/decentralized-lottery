/**Here is the definition of type DeployInfos*/
export default interface DeployInfos {
    chainId: number;
    isDevelopmentChain: boolean;
    vrfSubscriptionId: bigint;
    vrfGasLane: string;
    prize:  bigint;
    joinFee: bigint;
    callbackGasLimit: bigint;
    upKeepInterval: bigint;
    vrfCoordinatorV2Address: string;
    lotteryAddress?: string;
}